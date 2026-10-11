// Standing-spot reservations: two people never pick the same point to stand on (idle row, lounge,
// the door while resigning). Pure render bookkeeping; never written back to GameState.
import type { XZ } from './layout'

/** The one kind every standing / seated body shares (idle row, lounge, the door, seats, visitors). */
export const STAND = 'stand'

/** Live reservations per kind: id → spot. */
const table = new Map<string, Map<string, XZ>>()

function far(p: XZ, others: Iterable<XZ>, minDist: number): boolean {
  for (const o of others) if (Math.hypot(p[0] - o[0], p[1] - o[1]) < minDist) return false
  return true
}

function tableOf(kind: string): Map<string, XZ> {
  let byId = table.get(kind)
  if (!byId) table.set(kind, (byId = new Map()))
  return byId
}

function othersOf(byId: ReadonlyMap<string, XZ>, id: string): XZ[] {
  const others: XZ[] = []
  for (const [k, p] of byId) if (k !== id) others.push(p)
  return others
}

/** The spot `id` already holds, when it is still a candidate and still clear (a reservation never hops frame to frame). */
function keep(byId: ReadonlyMap<string, XZ>, id: string, candidates: readonly XZ[], others: readonly XZ[], minDist: number): XZ | null {
  const held = byId.get(id)
  if (!held) return null
  const same = candidates.find((c) => c[0] === held[0] && c[1] === held[1])
  return same && far(same, others, minDist) ? same : null
}

/**
 * Strict reservation: the first candidate at least `minDist` from everyone else holding a spot of this kind (the one
 * already held wins while it stays clear). Null when every candidate is taken; the table is then left as it was, so
 * the caller can try another list (the door queue) or keep the person outside.
 */
export function claim(kind: string, id: string, candidates: readonly XZ[], minDist = 0.55): XZ | null {
  if (candidates.length === 0) return null
  const byId = tableOf(kind)
  const others = othersOf(byId, id)
  const pick = keep(byId, id, candidates, others, minDist) ?? candidates.find((c) => far(c, others, minDist))
  if (!pick) return null
  byId.set(id, pick)
  return pick
}

/**
 * Spot for `id` among `candidates`: as claim(), but when everything is taken it still answers with the least
 * crowded candidate (someone already inside has to stand somewhere). Returns the candidate itself (same
 * reference), or null when there are no candidates.
 */
export function reserve(kind: string, id: string, candidates: readonly XZ[], minDist = 0.55): XZ | null {
  const got = claim(kind, id, candidates, minDist)
  if (got || candidates.length === 0) return got
  const byId = tableOf(kind)
  const others = othersOf(byId, id)
  // Everything is crowded: the candidate whose nearest neighbour is furthest away.
  let pick = candidates[0]!
  let best = -1
  for (const c of candidates) {
    let near = Infinity
    for (const o of others) near = Math.min(near, Math.hypot(c[0] - o[0], c[1] - o[1]))
    if (near > best) {
      best = near
      pick = c
    }
  }
  byId.set(id, pick)
  return pick
}

/** Take `p` outright (a seat: it belongs to its occupant whoever else is near), so later reservations step around it. */
export function hold(kind: string, id: string, p: XZ): void {
  const byId = tableOf(kind)
  const cur = byId.get(id)
  if (!cur || cur[0] !== p[0] || cur[1] !== p[1]) byId.set(id, p)
}

/** Give the spot back (mode change, unmount). */
export function release(kind: string, id: string): void {
  table.get(kind)?.delete(id)
}

/** Every reservation of every kind (tests, new game). */
export function clearSpots(): void {
  table.clear()
}

/** Who holds what (tests / debugging). */
export function reservations(kind: string): ReadonlyMap<string, XZ> {
  return table.get(kind) ?? new Map()
}

/** Offset of visitor `i` of `n` waiting at the same target: a shallow fan across the front. */
export function visitorFan(i: number, n: number): { dx: number; dz: number } {
  return { dx: (i - (n - 1) / 2) * 0.6, dz: -0.12 * i }
}

/** Pawn (release-wave user figure) radius steps around the target, in cells. */
const PAWN_RINGS = [0.9, 1.25, 1.6, 0.6]
/** Angle tries per pawn on each ring (half-step offsets either way). */
const PAWN_TURNS = [0, 0.5, -0.5, 1, -1]

/**
 * Where the release-wave pawns stop around `target`: the even ring of the old wave, but a point that lands on
 * furniture or within `minDist` of anyone holding a STAND spot (seats, visitors, idle / lounge people) or of an
 * earlier pawn slides along the ring, then out to a wider one, so a pawn never stands inside a character.
 * `free` says whether a point is open floor (nav.isFreeFloor). Read-only: pawns reserve nothing.
 */
export function pawnSpots(target: XZ, count: number, cell: number, free: (p: XZ) => boolean, minDist = 0.55): XZ[] {
  const people = [...(table.get(STAND)?.values() ?? [])]
  const out: XZ[] = []
  for (let i = 0; i < count; i++) {
    const a0 = (i / Math.max(1, count)) * Math.PI * 2
    const step = (Math.PI * 2) / Math.max(1, count)
    let pick: XZ | null = null
    for (const r of PAWN_RINGS) {
      for (const t of PAWN_TURNS) {
        const a = a0 + t * step * 0.5
        const p: XZ = [target[0] + Math.cos(a) * cell * r, target[1] + Math.sin(a) * cell * r]
        if (free(p) && far(p, people, minDist) && far(p, out, minDist * 0.8)) {
          pick = p
          break
        }
      }
      if (pick) break
    }
    out.push(pick ?? [target[0] + Math.cos(a0) * cell * 0.9, target[1] + Math.sin(a0) * cell * 0.9])
  }
  return out
}
