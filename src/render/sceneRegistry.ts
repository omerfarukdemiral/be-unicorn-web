// Render-local mutable registry: where each character currently is (for bubbles that follow
// heads) and short-lived visual moods (celebration). Never written to GameState.
import { useFrame } from '@react-three/fiber'
import { useCallback, useMemo, useRef } from 'react'
import type { DecorPiece, GameState, OfficeState, WallPiece } from '../engine/types'
import { draftOffice } from '../store/layoutEdit'
import { computeLayout, type OfficeLayout, type XZ } from './layout'
import { getGS, useGS, useMockState, useUi } from './source'

export interface SpeakerPos {
  x: number
  y: number
  z: number
  /** False while the character is outside (walked out of the door). */
  visible: boolean
  /** On the way somewhere (walking or queued at the door): an actionable pill waits until they stand still. */
  walking?: boolean
  /** Where a walking visitor will stand (their reserved spot): their ask waits there, still, instead of riding the head. */
  dest?: { x: number; z: number } | null
}

/** Keyed by employee id, visitor id, 'founder' or 'desk' (the founder's desk: decisions about the company). */
export const speakerPositions = new Map<string, SpeakerPos>()

// Dev-only handle for scripted scene QA (two bodies on one spot, a pill riding a walker).
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __speakers: typeof speakerPositions }).__speakers = speakerPositions

export function setSpeakerPos(id: string, x: number, y: number, z: number, visible: boolean, walking = false, dest: XZ | null = null): void {
  const p = speakerPositions.get(id)
  if (p) {
    p.x = x
    p.y = y
    p.z = z
    p.visible = visible
    p.walking = walking
    if (!dest) p.dest = null
    else if (p.dest) {
      p.dest.x = dest[0]
      p.dest.z = dest[1]
    } else p.dest = { x: dest[0], z: dest[1] }
  } else speakerPositions.set(id, { x, y, z, visible, walking, dest: dest ? { x: dest[0], z: dest[1] } : null })
}

/**
 * Speaker is walking in / across the room (or still outside) with no known spot to stand on: a pill above them would
 * slide under the thumb. A visitor heading for a reserved spot is not: their pill waits above that spot (resolveAnchor).
 */
export function speakerWalking(id: string): boolean {
  const p = speakerPositions.get(id)
  return !!p && (!!p.walking || !p.visible) && !p.dest
}

/** Employee id → standing still at their own desk this frame (head plates show only then). Written by Character. */
export const seatedRegistry = new Map<string, boolean>()

export function clearSpeaker(id: string): void {
  speakerPositions.delete(id)
  seatedRegistry.delete(id)
}

/** The founder's desk as a fixed speaker: desk bubbles do not follow the founder around the office. */
export function registerDesk(x: number, z: number): void {
  setSpeakerPos('desk', x, 1.25, z, true)
}

export interface LastPos {
  x: number
  z: number
  yaw: number
  outside: boolean
}

/**
 * Last drawn spot of every character, written each frame. When a person leaves GameState their
 * departing ghost starts from here instead of popping out of existence (People.tsx).
 */
export const lastPos = new Map<string, LastPos>()

export function setLastPos(id: string, x: number, z: number, yaw: number, outside: boolean): void {
  const p = lastPos.get(id)
  if (p) {
    p.x = x
    p.z = z
    p.yaw = yaw
    p.outside = outside
  } else lastPos.set(id, { x, z, yaw, outside })
}

/**
 * The scene's one clock (seconds). Advanced once per frame by People with dt·(held ? 0 : 1), so
 * while a bubble / card holds the world every pose, wave, float and confetti piece stands still.
 */
export const sceneTime = { t: 0, dt: 0, held: false }

/** Advance sceneTime; runs before the other frame callbacks (negative priority does not take over rendering). */
export function useSceneClock(held: boolean): void {
  const heldRef = useRef(held)
  heldRef.current = held
  useFrame((_, rawDt) => {
    const dt = heldRef.current ? 0 : Math.min(rawDt, 0.1)
    sceneTime.held = heldRef.current
    sceneTime.dt = dt
    sceneTime.t += dt
  }, -1)
}

/** setTimeout on scene time: a held world also holds what is about to disappear. */
export function useSceneTimers(): (ms: number, fn: () => void) => void {
  const timers = useRef<{ at: number; fn: () => void }[]>([])
  useFrame(() => {
    const list = timers.current
    if (list.length === 0) return
    const t = sceneTime.t
    if (!list.some((x) => x.at <= t)) return
    timers.current = list.filter((x) => x.at > t)
    for (const x of list) if (x.at <= t) x.fn()
  })
  return useCallback((ms: number, fn: () => void) => void timers.current.push({ at: sceneTime.t + ms / 1000, fn }), [])
}

/** performance.now() timestamp until which characters cheer. */
export const mood = { celebrateUntil: 0, renovateUntil: 0 }

export function celebrate(ms = 2600): void {
  mood.celebrateUntil = Math.max(mood.celebrateUntil, performance.now() + ms)
}

export function isCelebrating(now = performance.now()): boolean {
  return now < mood.celebrateUntil
}

/**
 * Structural signature of the office. The engine clones the whole state every step, so
 * `office.slots` is a new array each tick even when nothing changed; render keys on this
 * string instead so the scene only re-renders when the office really changes.
 */
export function officeSignature(s: GameState): string {
  const o = s.office
  let k = `${o.stage}|`
  for (const r of o.rings) k += r.unlocked ? '1' : '0'
  for (const x of o.slots) k += `|${x.id},${x.ring},${x.type},${x.pos.x},${x.pos.z},${x.rotation},${x.itemId ?? ''},${x.spanOf ?? ''},${x.occupantId ?? ''}`
  // Floor decor is in the walk layout (obstacles) and hides the suggested cells under it.
  for (const p of o.decor ?? []) k += `|${p.id}:${p.kind},${p.pos.x},${p.pos.z},${p.rotation}`
  return k
}

/**
 * Signature of what the decor layer draws: floor pieces and wall pieces (paint included). No seats and no furniture,
 * so a hire, a purchase or a desk move never rebakes the decor (grid §7).
 */
export function decorSignature(s: GameState): string {
  return decorKey(s.office.stage, s.office.decor, s.office.walls)
}

function decorKey(stage: number, decor: readonly DecorPiece[] | undefined, walls: readonly WallPiece[] | undefined): string {
  let k = `${stage}`
  for (const p of decor ?? []) k += `|${p.id}:${p.kind},${p.pos.x},${p.pos.z},${p.rotation}`
  k += '#'
  for (const w of walls ?? []) k += `|${w.wall},${w.seg},${w.kind},${w.color ?? ''}`
  return k
}

export interface DecorView {
  stage: number
  decor: readonly DecorPiece[]
  walls: readonly WallPiece[]
  key: string
}

/** What the decor layer draws: the live pieces, or the edit draft's while the edit mode is open. Stable per key. */
export function useDecorView(): DecorView {
  const sig = useGS(decorSignature)
  const mock = useMockState()
  const draft = useUi((u) => (mock ? null : (u.layoutEdit?.draft ?? null)))
  return useMemo(() => {
    const o = getGS(mock).office
    const decor = draft ? draft.decor : (o.decor ?? [])
    const walls = draft?.walls ?? o.walls ?? []
    return { stage: o.stage, decor, walls, key: draft ? decorKey(o.stage, decor, walls) : sig }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, mock, draft?.decor, draft?.walls])
}

/** Office snapshot with a stable reference while its signature is unchanged. */
export function useOffice(): OfficeState {
  const sig = useGS(officeSignature)
  const mock = useMockState()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => getGS(mock).office, [sig, mock])
}

/** Memoised scene layout for the current office (stable across engine ticks). */
export function useLayout(): OfficeLayout {
  const office = useOffice()
  return useMemo(() => computeLayout(office.slots, office.rings, office.stage, office.decor), [office])
}

/** True while the office edit mode is open (PC only): slots, people and badges step aside for the grid overlay. */
export function useLayoutEditing(): boolean {
  const mock = useMockState()
  return useUi((u) => u.layoutEdit !== null) && !mock
}

/**
 * The office the furniture is drawn from: the live one, or the edit draft while the edit mode is open. Moved pieces
 * keep their live slot ids (store/layoutEdit draftOffice), so a drop only moves a transform: the shell and the
 * per-piece bakes are untouched until Bitti / Vazgeç.
 */
export function useFurnitureView(): { office: OfficeState; layout: OfficeLayout } {
  const office = useOffice()
  const layout = useLayout()
  const mock = useMockState()
  const draft = useUi((u) => (mock ? null : (u.layoutEdit?.draft ?? null)))
  return useMemo(() => {
    const view = draft ? draftOffice(office, draft) : office
    return view === office ? { office, layout } : { office: view, layout: computeLayout(view.slots, view.rings, view.stage, view.decor) }
  }, [office, layout, draft])
}
