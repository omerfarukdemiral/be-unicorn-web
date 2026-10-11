// Local visual movement for characters: furniture-avoiding paths on the floor, plus pose helpers.
// Purely cosmetic — never written back to GameState.
import { WALK_SPEED } from './constants'
import type { Rig } from './CharacterModel'
import { pathFromDoor, pathToDoor, type OfficeLayout, type XZ } from './layout'
import { findPath } from './nav'

function angleLerp(a: number, b: number, t: number): number {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

/** Walk-speed multiplier for a game speed (0 = paused: nobody walks). One formula for every character. */
export const speedMultiplier = (speed: number): number => (speed === 0 ? 0 : 0.8 + 0.3 * speed)

/** Distance from door.outside over which a person grows in / shrinks out at the threshold. */
export const DOOR_FADE = 0.5

/** Threshold scale: a person grows from 85% as they step in and shrinks back as they step out (shared materials: scale, never opacity). */
export const doorScale = (fade: number): number => 0.85 + 0.15 * fade

/** Two visible people closer than this push apart (soft separation). */
export const SEPARATION = 0.4
/** Separation never moves a person more than this per frame. */
const SEP_STEP = 0.05
/** Pushed this far off the spot it walked to (someone squeezed past), a standing person steps back onto it. */
export const DRIFT_BACK = 0.15
/** The final turn toward faceYaw blends in over this much of the remaining path. */
const TURN_IN = 0.5
/** Seated / arrived only once the facing is this close (radians). */
export const YAW_SETTLED = 0.1

/** The door takes one person at a time: the next waits outside until the last one is this far in (world units). */
export const DOOR_CLEAR = 0.75

/** Longest wait at the door (scene seconds at 1×) before stepping in regardless. */
const DOOR_WAIT_MAX = 6

/** The last person who stepped in through the door (module-wide: every Mover shares the one door). */
let doorUser: Mover | null = null

/** People on their way out (visitors leaving together, a resigner, ghosts): they file through the door one at a time. */
const leavers = new Set<Mover>()

/** An exit waits this close to the threshold (DOOR_CLEAR + this, world units) while someone else is in the doorway. */
const EXIT_HOLD = 0.4
/** Longest an exit waits for the doorway (scene seconds at 1×) before walking out regardless. */
const EXIT_WAIT_MAX = 3

/** New office / tests: nobody is in the doorway. */
export function resetDoor(): void {
  doorUser = null
  leavers.clear()
}

/** Anyone else in the scene, as sceneRegistry.speakerPositions holds them. */
export interface Neighbour {
  x: number
  z: number
  visible: boolean
}

/** Distance from (x, z) to the segment a→b. */
function segDist(x: number, z: number, a: XZ, b: XZ): number {
  const vx = b[0] - a[0]
  const vz = b[1] - a[1]
  const len2 = vx * vx + vz * vz
  const k = len2 > 0 ? Math.min(1, Math.max(0, ((x - a[0]) * vx + (z - a[1]) * vz) / len2)) : 0
  return Math.hypot(x - (a[0] + vx * k), z - (a[1] + vz * k))
}

function angleDiff(a: number, b: number): number {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

export class Mover {
  /** Own speaker id: skipped when pushing apart from neighbours. */
  id = ''
  x: number
  z: number
  yaw = 0
  path: XZ[] = []
  /** Walked out of the door; hidden until it comes back in. */
  outside = false
  goalKey = ''
  /** performance.now() when the last path finished. */
  arrivedAt = 0
  /** Yaw to face once arrived (null = keep). */
  faceYaw: number | null = null
  phase = 0
  /** 0 at door.outside (or outside) → 1 at DOOR_FADE away; the frame loop maps it to scale. */
  fade = 1
  private exitAfter = false
  /** Where the last goTo ends (null: exiting / teleported); a body shoved off it walks back. */
  private goal: XZ | null = null
  /** door.outside of the last layout this mover planned with. */
  private door: XZ | null = null
  /** performance.now() of the last update (a door holder that stops updating is gone). */
  tickedAt = 0
  /** Waiting outside for the doorway to clear (walks in on a later update). */
  private queued: { target: XZ; layout: OfficeLayout; waited: number } | null = null
  /** Scene seconds this exit has waited at the doorway (EXIT_WAIT_MAX). */
  private exitWaited = 0

  constructor(x: number, z: number, outside = false) {
    this.x = x
    this.z = z
    this.outside = outside
    this.fade = outside ? 0 : 1
  }

  private updateFade(): void {
    if (this.outside) this.fade = 0
    else if (!this.door) this.fade = 1
    else this.fade = Math.min(1, Math.hypot(this.x - this.door[0], this.z - this.door[1]) / DOOR_FADE)
  }

  /** Walking, or queued at the door to walk in. */
  get moving(): boolean {
    return this.path.length > 0 || this.queued !== null
  }

  /**
   * Free to step in: the last entrant is DOOR_CLEAR in (or gone back out), and nobody visible stands in the doorway
   * lane (door.outside → door.inside, a body's width either side) or within DOOR_CLEAR of door.outside (someone
   * walking out, a visitor waiting on the threshold). Without this, people arriving together share one point and
   * walk in as one merged body.
   * `forced` (waited DOOR_WAIT_MAX): the lane may stay busy, but the last entrant must still be DOOR_CLEAR in and the
   * threshold point itself free, so a crowd that waited together still walks in one at a time, never as one body.
   */
  private doorFree(door: OfficeLayout['door'], others: ReadonlyMap<string, Neighbour> | null, forced = false): boolean {
    const out = door.outside
    const u = doorUser
    // An entrant that stopped updating (unmounted, new office) no longer holds the door.
    const live = !!u && performance.now() - u.tickedAt < 500
    if (u && live && u !== this && !u.outside && Math.hypot(u.x - out[0], u.z - out[1]) < DOOR_CLEAR) return false
    if (others) {
      for (const [k, o] of others) {
        if (k === this.id || k === 'desk' || !o.visible) continue
        const d = Math.hypot(o.x - out[0], o.z - out[1])
        if (forced ? d < SEPARATION + 0.1 : d < DOOR_CLEAR || segDist(o.x, o.z, out, door.inside) < SEPARATION + 0.1) return false
      }
    }
    return true
  }

  /**
   * Free to walk out: nobody else (the last entrant, an earlier leaver) is within DOOR_CLEAR of the threshold. Leavers
   * closer to the door go first, so a group that leaves together files out instead of merging on the door tile (QA:
   * four visitors drawn through each other in the doorframe). Never waits on someone parked inside (a resigner).
   */
  private exitFree(): boolean {
    const out = this.door
    if (!out) return true
    const now = performance.now()
    const near = (m: Mover | null): boolean =>
      !!m && m !== this && !m.outside && now - m.tickedAt < 500 && Math.hypot(m.x - out[0], m.z - out[1]) < DOOR_CLEAR
    if (near(doorUser)) return false
    const mine = Math.hypot(this.x - out[0], this.z - out[1])
    for (const m of leavers) {
      if (m === this) continue
      // Unmounted mid-exit (a visitor answered and removed): drop it.
      if (now - m.tickedAt > 2_000) {
        leavers.delete(m)
        continue
      }
      if (near(m)) return false
      // Two leavers waiting at the same doorway: the one nearer the door (then by id) walks first.
      if (m.outside || now - m.tickedAt >= 500 || m.path.length === 0) continue
      const d = Math.hypot(m.x - out[0], m.z - out[1])
      if (d < DOOR_CLEAR + EXIT_HOLD && (d < mine - 1e-3 || (Math.abs(d - mine) <= 1e-3 && m.id < this.id))) return false
    }
    return true
  }

  private enter(target: XZ, layout: OfficeLayout): void {
    this.queued = null
    this.x = layout.door.outside[0]
    this.z = layout.door.outside[1]
    this.outside = false
    this.path = pathFromDoor(target, layout)
    this.goal = this.path[this.path.length - 1] ?? target
    doorUser = this
  }

  /** Arrived facing the way it should (|yaw error| < YAW_SETTLED): sit / settle only then. */
  get yawSettled(): boolean {
    return this.faceYaw === null || Math.abs(angleDiff(this.yaw, this.faceYaw)) < YAW_SETTLED
  }

  /** Path length still to walk, stopping once it exceeds `cap`. */
  private remaining(cap: number): number {
    let d = 0
    let px = this.x
    let pz = this.z
    for (const p of this.path) {
      d += Math.hypot(p[0] - px, p[1] - pz)
      if (d > cap) return d
      px = p[0]
      pz = p[1]
    }
    return d
  }

  /**
   * Push away from visible neighbours closer than SEPARATION (each side moves itself, capped per
   * frame), so two bodies never share a point. Skips `ids` 'desk' (a fixed anchor) and itself.
   */
  separate(others: ReadonlyMap<string, Neighbour>, dt: number): void {
    if (this.outside || dt <= 0) return
    let px = 0
    let pz = 0
    for (const [k, o] of others) {
      if (k === this.id || k === 'desk' || !o.visible) continue
      const dx = this.x - o.x
      const dz = this.z - o.z
      const d = Math.hypot(dx, dz)
      if (d >= SEPARATION) continue
      // Exactly on top of each other: split by id so both do not pick the same direction.
      const ux = d > 1e-4 ? dx / d : this.id < k ? 1 : -1
      const uz = d > 1e-4 ? dz / d : 0
      px += ux * (SEPARATION - d) * 0.5
      pz += uz * (SEPARATION - d) * 0.5
    }
    const len = Math.hypot(px, pz)
    if (len < 1e-5) return
    const k = Math.min(1, SEP_STEP / len)
    this.x += px * k
    this.z += pz * k
  }

  teleport(p: XZ, yaw?: number): void {
    this.x = p[0]
    this.z = p[1]
    this.path = []
    this.queued = null
    this.outside = false
    this.exitAfter = false
    leavers.delete(this)
    this.goal = null
    if (yaw !== undefined) this.yaw = yaw
    this.updateFade()
  }

  /** Walk to a point inside the office (entering through the door if outside). */
  goTo(target: XZ, layout: OfficeLayout, key: string, faceYaw: number | null = null): void {
    this.goalKey = key
    this.faceYaw = faceYaw
    this.exitAfter = false
    leavers.delete(this)
    this.goal = target
    this.door = layout.door.outside
    if (this.outside) {
      // Queued: the next update walks in once the doorway is clear.
      this.queued = { target, layout, waited: this.queued?.waited ?? 0 }
      this.path = []
    } else {
      this.path = findPath([this.x, this.z], target, layout)
      // The path's end, not the asked point: a goal deep in furniture stops at the free edge (nav.findPath).
      this.goal = this.path[this.path.length - 1] ?? target
    }
  }

  /** Not coming in yet (no free spot inside): stay outside, unseen, and drop any place in the door queue. */
  stayOut(key: string): void {
    this.goalKey = key
    if (!this.outside) return
    this.goal = null
    this.queued = null
    this.path = []
    this.faceYaw = null
  }

  /** Walk out of the door and disappear. */
  exit(layout: OfficeLayout, key: string): void {
    this.goalKey = key
    this.faceYaw = null
    this.goal = null
    this.door = layout.door.outside
    this.queued = null
    if (this.outside) return
    this.path = pathToDoor([this.x, this.z], layout, true)
    this.exitAfter = true
    this.exitWaited = 0
    leavers.add(this)
  }

  /**
   * Advance along the path. Returns true while moving. `others` (speaker positions) turns on soft
   * separation; pass null for someone who must not be nudged (seated at their desk).
   */
  update(dt: number, speedMul: number, now: number, others: ReadonlyMap<string, Neighbour> | null = null): boolean {
    this.tickedAt = performance.now()
    const q = this.queued
    if (q) {
      if (speedMul <= 0) return false
      // Someone parked in the lane for good (a spot next to the door) must not lock the door: after a while, step in
      // past them (still one entrant at a time, never onto a body on the threshold) and let separation sort it out.
      q.waited += dt * speedMul
      if (!this.doorFree(q.layout.door, others, q.waited >= DOOR_WAIT_MAX)) return false
      this.enter(q.target, q.layout)
    }
    if (others && speedMul > 0) {
      this.separate(others, dt)
      // Separation shoves standing people too; without this, two shoved bodies settle 0.4 apart off their spots.
      const g = this.goal
      if (g && this.path.length === 0 && !this.outside && Math.hypot(this.x - g[0], this.z - g[1]) > DRIFT_BACK) this.path = [g]
    }
    // Walking out: wait just short of the doorway while someone else is on the threshold (one body at a time).
    if (this.exitAfter && this.door && this.path.length > 0 && speedMul > 0 && this.exitWaited < EXIT_WAIT_MAX) {
      const d = Math.hypot(this.x - this.door[0], this.z - this.door[1])
      if (d >= DOOR_CLEAR && d < DOOR_CLEAR + EXIT_HOLD && !this.exitFree()) {
        this.exitWaited += dt * speedMul
        this.updateFade()
        return false
      }
    }
    const next = this.path[0]
    this.updateFade()
    if (!next) {
      if (this.faceYaw !== null) this.yaw = angleLerp(this.yaw, this.faceYaw, Math.min(1, dt * 8))
      return false
    }
    const dx = next[0] - this.x
    const dz = next[1] - this.z
    const dist = Math.hypot(dx, dz)
    const step = WALK_SPEED * speedMul * dt
    if (dist > 1e-4) {
      let want = Math.atan2(dx, dz)
      // Over the last TURN_IN of the walk, ease from the walking heading into the arrival facing.
      if (this.faceYaw !== null) {
        const left = this.remaining(TURN_IN)
        if (left < TURN_IN) want = angleLerp(want, this.faceYaw, 1 - left / TURN_IN)
      }
      this.yaw = angleLerp(this.yaw, want, Math.min(1, dt * 12))
    }
    if (dist <= step) {
      this.x = next[0]
      this.z = next[1]
      this.path.shift()
      if (this.path.length === 0) {
        this.arrivedAt = now
        if (this.exitAfter) {
          this.outside = true
          this.exitAfter = false
          leavers.delete(this)
        }
      }
    } else {
      this.x += (dx / dist) * step
      this.z += (dz / dist) * step
    }
    this.phase += dt * speedMul * 9
    this.updateFade()
    return true
  }
}

function set(g: { rotation: { x: number; z: number } } | null, x: number, z = 0): void {
  if (!g) return
  g.rotation.x = x
  g.rotation.z = z
}

export function poseWalk(rig: Rig, phase: number, amp = 0.6): void {
  const s = Math.sin(phase)
  set(rig.legL, s * amp)
  set(rig.legR, -s * amp)
  set(rig.armL, -s * amp * 0.8)
  set(rig.armR, s * amp * 0.8)
  if (rig.body) {
    rig.body.position.y = Math.abs(Math.cos(phase)) * 0.03
    rig.body.position.z = 0
  }
  if (rig.head) rig.head.rotation.x = 0
}

export function poseStand(rig: Rig, t: number): void {
  set(rig.legL, 0)
  set(rig.legR, 0)
  set(rig.armL, Math.sin(t * 1.3) * 0.05)
  set(rig.armR, -Math.sin(t * 1.3) * 0.05)
  if (rig.body) {
    rig.body.position.y = Math.sin(t * 2) * 0.008
    rig.body.position.z = 0
  }
  if (rig.head) rig.head.rotation.x = 0
}

export function poseSit(rig: Rig, t: number, typing: number): void {
  set(rig.legL, -Math.PI / 2)
  set(rig.legR, -Math.PI / 2)
  if (rig.body) {
    rig.body.position.y = 0
    rig.body.position.z = -0.04
  }
  if (typing > 0) {
    const k = t * 14 * typing
    set(rig.armL, -1.25 + Math.sin(k) * 0.12)
    set(rig.armR, -1.25 + Math.sin(k + Math.PI) * 0.12)
    if (rig.head) rig.head.rotation.x = 0.12 + Math.sin(t * 0.7) * 0.03
  } else {
    set(rig.armL, -0.3)
    set(rig.armR, -0.3)
    if (rig.head) rig.head.rotation.x = 0.35
  }
}

/** Yawn every few seconds (tired). */
export function overlayYawn(rig: Rig, t: number, seed: number): void {
  const cycle = (t + seed * 7) % 6
  if (cycle < 1.2) {
    const k = Math.sin((cycle / 1.2) * Math.PI)
    if (rig.head) rig.head.rotation.x = -0.45 * k
    set(rig.armR, -2.6 * k, -0.3 * k)
  }
}

export function poseCheer(rig: Rig, t: number, seed: number): number {
  const k = t * 9 + seed * 3
  set(rig.armL, -2.8 + Math.sin(k) * 0.3, -0.25)
  set(rig.armR, -2.8 - Math.sin(k) * 0.3, 0.25)
  set(rig.legL, 0)
  set(rig.legR, 0)
  if (rig.head) rig.head.rotation.x = -0.2
  return Math.abs(Math.sin(k * 0.5)) * 0.18
}

export function poseSip(rig: Rig, t: number, seed: number): void {
  poseStand(rig, t)
  const cycle = (t + seed * 5) % 4
  const k = cycle < 1 ? Math.sin(cycle * Math.PI) : 0
  set(rig.armR, -0.9 - k * 1.2)
  if (rig.head) rig.head.rotation.x = -0.15 * k
}

/** Pose blend rate: limbs chase the pose functions' targets instead of snapping (sit ↔ stand). */
const SETTLE_K = 14
/** Smoothed limb values per rig: legL x/z, legR x/z, armL x/z, armR x/z, body y/z, head x, cup scale. */
const settled = new WeakMap<Rig, Float32Array>()

function readRig(rig: Rig, out: Float32Array, cup: number): void {
  out[0] = rig.legL?.rotation.x ?? 0
  out[1] = rig.legL?.rotation.z ?? 0
  out[2] = rig.legR?.rotation.x ?? 0
  out[3] = rig.legR?.rotation.z ?? 0
  out[4] = rig.armL?.rotation.x ?? 0
  out[5] = rig.armL?.rotation.z ?? 0
  out[6] = rig.armR?.rotation.x ?? 0
  out[7] = rig.armR?.rotation.z ?? 0
  out[8] = rig.body?.position.y ?? 0
  out[9] = rig.body?.position.z ?? 0
  out[10] = rig.head?.rotation.x ?? 0
  out[11] = cup
}

const target = new Float32Array(12)

/**
 * Run after the pose functions every frame: what they wrote becomes the target, and each limb
 * moves toward it with a damped step (k = SETTLE_K), so switching pose never snaps. The coffee cup
 * grows / shrinks (scale) instead of blinking. dt = 0 (held world) freezes the pose. The first call
 * for a rig takes the target as is.
 */
export function settle(rig: Rig, dt: number, cup = 0): void {
  readRig(rig, target, cup)
  let cur = settled.get(rig)
  if (!cur) {
    cur = Float32Array.from(target)
    settled.set(rig, cur)
  } else {
    const a = 1 - Math.exp(-SETTLE_K * dt)
    for (let i = 0; i < 12; i++) cur[i] = cur[i]! + (target[i]! - cur[i]!) * a
  }
  set(rig.legL, cur[0]!, cur[1]!)
  set(rig.legR, cur[2]!, cur[3]!)
  set(rig.armL, cur[4]!, cur[5]!)
  set(rig.armR, cur[6]!, cur[7]!)
  if (rig.body) {
    rig.body.position.y = cur[8]!
    rig.body.position.z = cur[9]!
  }
  if (rig.head) rig.head.rotation.x = cur[10]!
  if (rig.cup) {
    const s = cur[11]!
    rig.cup.visible = s > 0.02
    rig.cup.scale.setScalar(Math.max(0.001, s))
  }
}
