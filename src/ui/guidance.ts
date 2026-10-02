// Guidance as objects, not sentences (docs/GAMEPLAY_V2.md §11, §10.1 D8): the next step lights the thing to touch —
// a Dock tab breathes, the "Bul" slot breathes, a gauge carries a goal notch. At most two objects at once, and only
// in the garage: from Pre-seed on the player knows the way and nothing breathes.
// Pure (state in, targets out): the Dock, the founder slots and the top gauges each read their own part.
import type { ActionErrorCode, FounderActionKind, GameState, NextStepId, Slot, SlotId } from '../engine/types'
import { firstFreeDesk, isFreeDesk } from '../engine/office'
import type { DockTab } from '../store/types'

/** Objects that breathe at the same time (D8). */
export const GUIDANCE_MAX = 2

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

/** What to light for the engine's next step (state.derived.nextStep); [] after the garage or once the run is over. */
export function guidanceTargets(s: Pick<GameState, 'stage' | 'gameOver' | 'derived'>): GuidanceTarget[] {
  const step = s.derived.nextStep
  if (!step || s.stage > 0 || s.gameOver) return []
  const out: GuidanceTarget[] = []
  switch (step.id) {
    case 'findUsers':
      out.push({ kind: 'slot', action: 'findUsers' })
      break
    case 'users':
      out.push({ kind: 'gauge', gauge: 'users', goal: clamp01(step.progress ?? 0) }, { kind: 'slot', action: 'findUsers' })
      break
    case 'traction':
      // Pre-revenue valuation is users + releases: the hands-on find and the product.
      out.push({ kind: 'slot', action: 'findUsers' }, { kind: 'dock', tab: 'projects' })
      break
    default: {
      const tab = DOCK[step.id]
      if (tab) out.push({ kind: 'dock', tab })
    }
  }
  return out.slice(0, GUIDANCE_MAX)
}

/** The Dock tab that breathes (null = none). */
export function guidedTab(s: Pick<GameState, 'stage' | 'gameOver' | 'derived'>): DockTab | null {
  for (const g of guidanceTargets(s)) if (g.kind === 'dock') return g.tab
  return null
}

/** The founder slot that breathes (null = none). */
export function guidedSlot(s: Pick<GameState, 'stage' | 'gameOver' | 'derived'>): FounderActionKind | null {
  for (const g of guidanceTargets(s)) if (g.kind === 'slot') return g.action
  return null
}

/** Goal notch (0–1) on a top gauge, or null when that gauge is not the target. */
export function guidedGoal(s: Pick<GameState, 'stage' | 'gameOver' | 'derived'>, gauge: GuidanceGauge): number | null {
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
export function shopSlotTarget(s: Pick<GameState, 'stage' | 'gameOver' | 'derived' | 'office'>, lastError: LastError, dropped = 0): SlotId | undefined {
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
