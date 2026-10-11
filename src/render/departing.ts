// Departing ghosts: a person removed from GameState stays in the scene a little longer so they
// never pop out. Pure bookkeeping (People.tsx draws them); never written back to GameState.

export type GhostKind = 'employee' | 'visitor'
/** 'walk' = out through the door (resigned / let go / a visit that ended); 'fade' = shrink in place (fired). */
export type GhostMode = 'walk' | 'fade'

/** What render saw of a person on the previous frame of state. */
export interface Seen<T> {
  id: string
  kind: GhostKind
  /** Employee status was 'leaving' (resignation window): their exit is a walk, not a firing. */
  leaving: boolean
  data: T
}

export interface Ghost<T> {
  id: string
  kind: GhostKind
  mode: GhostMode
  /** Timestamp the person left state (ms). */
  since: number
  data: T
}

/** A ghost that never reports finished (stuck path, held world for long) is dropped after this. */
export const GHOST_MAX_MS = 20000
/** A 'fade' ghost shrinks over this long. */
export const FADE_MS = 250

/** People present before and missing now become ghosts. Render cannot know a firing, so: a leaver or a visitor walks, anyone else fades. */
export function diffDeparting<T>(prev: readonly Seen<T>[], nextIds: ReadonlySet<string>, now: number): Ghost<T>[] {
  const out: Ghost<T>[] = []
  for (const p of prev) {
    if (nextIds.has(p.id)) continue
    out.push({ id: p.id, kind: p.kind, mode: p.kind === 'visitor' || p.leaving ? 'walk' : 'fade', since: now, data: p.data })
  }
  return out
}

/** Add new ghosts to the list: one per id, and anyone back in state is no longer a ghost. */
export function mergeGhosts<T>(current: readonly Ghost<T>[], added: readonly Ghost<T>[], nextIds: ReadonlySet<string>): Ghost<T>[] {
  const out = current.filter((g) => !nextIds.has(g.id) && !added.some((a) => a.id === g.id))
  for (const a of added) out.push(a)
  return out
}

/** Drop ghosts that reported done (walked outside / finished shrinking) or overstayed. */
export function pruneGhosts<T>(ghosts: readonly Ghost<T>[], done: ReadonlySet<string>, now: number, maxMs = GHOST_MAX_MS): Ghost<T>[] {
  return ghosts.filter((g) => !done.has(g.id) && now - g.since < maxMs)
}

/** Scale of a 'fade' ghost after `elapsedMs`: 1 → 0, ease-in. */
export function fadeScale(elapsedMs: number): number {
  const k = Math.min(1, Math.max(0, elapsedMs / FADE_MS))
  return 1 - k * k
}
