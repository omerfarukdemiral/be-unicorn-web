// Guidance as objects, not sentences (docs/GAMEPLAY_V2.md §11, §10.1 D8): the next step lights the thing to touch —
// a Dock tab breathes, the "Bul" slot breathes, a gauge carries a goal notch. At most two objects at once. In the
// garage the engine's next step picks them; from Pre-seed on the chip stays closed and only real levers breathe
// (DECISIONS #31): idle builders → Projeler (any stage), no marketer while one is for hire → Ekip, "Bul" only while it
// still pays. A ready or running round owns its moment: no lever breathes over it.
// Pure (state in, targets out): the Dock, the founder slots and the top gauges each read their own part.
import * as B from '../engine/balance'
import type { ActionErrorCode, FounderActionKind, GameState, NextStepId, Slot, SlotId } from '../engine/types'
import { idleBuilders } from '../engine/loopSelectors'
import { firstFreeDesk, isFreeDesk } from '../engine/office'
import type { DockTab } from '../store/types'

/** Objects that breathe at the same time (D8). */
export const GUIDANCE_MAX = 2

/** "Bul" breathes only while a find still returns at least this share (playtest LD3: a 6% return is a dead lever). */
const FIND_WORTH = B.FIND_USERS_SATURATION

export type GuidanceGauge = 'users'

export type GuidanceTarget =
  | { kind: 'dock'; tab: DockTab }
  | { kind: 'slot'; action: FounderActionKind }
  /** `goal`: 0–1 of the way to the step's target (the notch on the gauge). */
  | { kind: 'gauge'; gauge: GuidanceGauge; goal: number }

const DOCK: Partial<Record<NextStepId, DockTab>> = {
  idea: 'projects',
  launch: 'projects',
  desk: 'shop',
  hire: 'team',
  revenue: 'growth',
  round: 'growth',
  roundWait: 'growth',
  grow: 'growth',
}

export type GuidanceState = Pick<GameState, 'stage' | 'gameOver' | 'derived' | 'employees' | 'projects' | 'stats' | 'round' | 'candidates'>

/** Garage steps an idle-builder hint must not cover: the round moment, and the desk / hire steps it would contradict. */
const NO_IDLE_HINT: ReadonlySet<NextStepId> = new Set<NextStepId>(['round', 'roundWait', 'desk', 'hire'])

/** A hands-on find still pays (its return multiplier is at least FIND_WORTH). */
function findWorth(s: Pick<GameState, 'derived'>): boolean {
  return (s.derived.findUsers?.factor ?? 1) >= FIND_WORTH
}

/** What to light: the engine's next step in the garage, the open levers after it; [] once the run is over. */
export function guidanceTargets(s: GuidanceState): GuidanceTarget[] {
  if (s.gameOver) return []
  if (s.stage > 0) return leverTargets(s)
  const step = s.derived.nextStep
  if (!step) return []
  let out: GuidanceTarget[] = []
  const find = findWorth(s)
  switch (step.id) {
    case 'findUsers':
      if (find) out.push({ kind: 'slot', action: 'findUsers' })
      break
    case 'users':
      // The goal, not the road (2026-10-08): a notch on Kullanıcı; finding by hand, ads, a sales call or a launch
      // all get there, so no single lever breathes.
      out.push({ kind: 'gauge', gauge: 'users', goal: clamp01(step.progress ?? 0) })
      break
    case 'traction':
      // Pre-revenue valuation is users + releases: the product is the one road every strategy shares.
      out.push({ kind: 'dock', tab: 'projects' })
      break
    default: {
      const tab = DOCK[step.id]
      if (tab) out.push({ kind: 'dock', tab })
    }
  }
  // Builders with nothing to build: a new project puts them to work (playtest LD1), first in line.
  if (!NO_IDLE_HINT.has(step.id) && idleBuilders(s).length > 0) {
    out = [{ kind: 'dock', tab: 'projects' }, ...out.filter((g) => !(g.kind === 'dock' && g.tab === 'projects'))]
  }
  return out.slice(0, GUIDANCE_MAX)
}

/**
 * After the garage: the levers still open, in order — builders with nothing to build or no project at all (Projeler),
 * no marketer while users come in and one is in the pool (Ekip), a find that still pays (Bul). Silent while a round is
 * ready or running (the top bar's round pop-in owns that moment) and once nothing applies: a busy player sees nothing
 * breathe.
 */
function leverTargets(s: GuidanceState): GuidanceTarget[] {
  if (s.round?.active || s.derived.canStartRound) return []
  const out: GuidanceTarget[] = []
  if (s.projects.length === 0 || idleBuilders(s).length > 0) out.push({ kind: 'dock', tab: 'projects' })
  const marketerForHire = s.candidates.some((c) => c.dept === 'marketing')
  if ((s.derived.deptCounts?.marketing ?? 0) === 0 && s.stats.users > 0 && marketerForHire) out.push({ kind: 'dock', tab: 'team' })
  // Past FIND_USERS_BIG_AT users a find is a rounding error next to the base, whatever its multiplier says.
  if (findWorth(s) && s.stats.users <= B.FIND_USERS_BIG_AT) out.push({ kind: 'slot', action: 'findUsers' })
  return out.slice(0, GUIDANCE_MAX)
}

/** The Dock tab that breathes (null = none). */
export function guidedTab(s: GuidanceState): DockTab | null {
  for (const g of guidanceTargets(s)) if (g.kind === 'dock') return g.tab
  return null
}

/** The founder slot that breathes (null = none). */
export function guidedSlot(s: GuidanceState): FounderActionKind | null {
  for (const g of guidanceTargets(s)) if (g.kind === 'slot') return g.action
  return null
}

/** Goal notch (0–1) on a top gauge, or null when that gauge is not the target. */
export function guidedGoal(s: GuidanceState, gauge: GuidanceGauge): number | null {
  for (const g of guidanceTargets(s)) if (g.kind === 'gauge' && g.gauge === gauge) return g.goal
  return null
}

/** The UI's last bounced action (store `ui.lastError`). */
export type LastError = { code: ActionErrorCode; at: number } | null | undefined

/**
 * Precondition errors point at the shop (§11 "önce masa koy" → Mağaza badge + ghost slot): a hire bounced off a
 * missing desk and there is still no free desk. `dropped` is the `at` of a noDesk error already answered
 * (dropDeskError): once a desk has been free since the error, filling it again does not bring the badge back.
 */
export function deskNeeded(s: Pick<GameState, 'office'>, lastError: LastError, dropped = 0): boolean {
  return lastError?.code === 'noDesk' && lastError.at !== dropped && !firstFreeDesk(s.office)
}

/** Fold for `dropped`: a free desk answers the current noDesk error (bought, or freed), for good. */
export function dropDeskError(dropped: number, s: Pick<GameState, 'office'>, lastError: LastError): number {
  return lastError?.code === 'noDesk' && firstFreeDesk(s.office) ? lastError.at : dropped
}

/**
 * The slot a Mağaza press should open on: the ghost desk after a bounced hire, or the engine's empty desk slot
 * while the garage's "desk" step is the guided one. undefined = a plain toggle.
 */
export function shopSlotTarget(s: GuidanceState & Pick<GameState, 'office'>, lastError: LastError, dropped = 0): SlotId | undefined {
  if (deskNeeded(s, lastError, dropped)) return ghostDeskSlot(s)?.id
  const step = s.derived.nextStep
  if (step?.id === 'desk' && guidedTab(s) === 'shop') return step.slotId
  return undefined
}

/** The empty desk slot a purchase should land on (the scene's ghost slot), inner rings first. */
export function ghostDeskSlot(s: Pick<GameState, 'office'>): Slot | undefined {
  return s.office.slots.find((x) => isFreeDesk(s.office, x) && x.itemId === undefined && x.spanOf === undefined)
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}
