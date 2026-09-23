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

export class Mover {
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
  private exitAfter = false

  constructor(x: number, z: number, outside = false) {
    this.x = x
    this.z = z
    this.outside = outside
  }

  get moving(): boolean {
    return this.path.length > 0
  }

  teleport(p: XZ, yaw?: number): void {
    this.x = p[0]
    this.z = p[1]
    this.path = []
    this.outside = false
    this.exitAfter = false
    if (yaw !== undefined) this.yaw = yaw
  }

  /** Walk to a point inside the office (entering through the door if outside). */
  goTo(target: XZ, layout: OfficeLayout, key: string, faceYaw: number | null = null): void {
    this.goalKey = key
    this.faceYaw = faceYaw
    this.exitAfter = false
    if (this.outside) {
      this.x = layout.door.outside[0]
      this.z = layout.door.outside[1]
      this.outside = false
      this.path = pathFromDoor(target, layout)
    } else {
      this.path = findPath([this.x, this.z], target, layout)
    }
  }

  /** Walk out of the door and disappear. */
  exit(layout: OfficeLayout, key: string): void {
    this.goalKey = key
    this.faceYaw = null
    if (this.outside) return
    this.path = pathToDoor([this.x, this.z], layout, true)
    this.exitAfter = true
  }

  /** Advance along the path. Returns true while moving. */
  update(dt: number, speedMul: number, now: number): boolean {
    const next = this.path[0]
    if (!next) {
      if (this.faceYaw !== null) this.yaw = angleLerp(this.yaw, this.faceYaw, Math.min(1, dt * 8))
      return false
    }
    const dx = next[0] - this.x
    const dz = next[1] - this.z
    const dist = Math.hypot(dx, dz)
    const step = WALK_SPEED * speedMul * dt
    if (dist > 1e-4) this.yaw = angleLerp(this.yaw, Math.atan2(dx, dz), Math.min(1, dt * 12))
    if (dist <= step) {
      this.x = next[0]
      this.z = next[1]
      this.path.shift()
      if (this.path.length === 0) {
        this.arrivedAt = now
        if (this.exitAfter) {
          this.outside = true
          this.exitAfter = false
        }
      }
    } else {
      this.x += (dx / dist) * step
      this.z += (dz / dist) * step
    }
    this.phase += dt * speedMul * 9
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
