// UI-side visual constants (render keeps its own palette.ts; UI may not import render).
import type { Dept, EmployeeStatus, FounderActionKind, SlotType, StageIndex } from '../engine/types'
import { STAGES } from '../content'
import type { IconName } from './icons'

/**
 * Department identity. Minimal palette: departments are shown ONLY as a small dot (6-8px, see <Dot />).
 * `bg`/`fg` are kept neutral for legacy callers (dept pills); `dot` is a CSS colour for inline styles.
 */
export const DEPT_COLOR: Record<Dept, { bg: string; fg: string; dot: string }> = {
  eng: { bg: 'bg-surface-2', fg: 'text-ink-2', dot: 'var(--color-dept-eng)' },
  product: { bg: 'bg-surface-2', fg: 'text-ink-2', dot: 'var(--color-dept-product)' },
  marketing: { bg: 'bg-surface-2', fg: 'text-ink-2', dot: 'var(--color-dept-marketing)' },
  sales: { bg: 'bg-surface-2', fg: 'text-ink-2', dot: 'var(--color-dept-sales)' },
  ops: { bg: 'bg-surface-2', fg: 'text-ink-2', dot: 'var(--color-dept-ops)' },
}

/** Status pill text colour (Pill supplies the neutral hairline frame). Red only for bad states. */
export const STATUS_TONE: Record<EmployeeStatus, string> = {
  working: 'text-ink-2',
  tired: 'text-ink',
  burnout: 'text-negative',
  break: 'text-ink-2',
  onboarding: 'text-ink-2',
  leaving: 'text-negative',
}

/** Small status mark colour (dot next to a status label). */
export const STATUS_DOT: Record<EmployeeStatus, string> = {
  working: 'var(--color-positive)',
  tired: 'var(--color-ink-3)',
  burnout: 'var(--color-negative)',
  break: 'var(--color-ink-3)',
  onboarding: 'var(--color-ink-3)',
  leaving: 'var(--color-negative)',
}

export const SLOT_ICON: Record<SlotType, IconName> = {
  desk: 'desk',
  common: 'coffee',
  room: 'door2',
  special: 'sparkle',
}

export const FOUNDER_ICON: Record<FounderActionKind, IconName> = {
  findUsers: 'search',
  talkToUsers: 'chat',
  motivateTeam: 'megaphone',
  investorCoffee: 'coffee',
  salesCall: 'phone',
  rest: 'bed',
}

/** PLAN §4.4 unlock stages (display gating only; the engine is the authority). */
export const FOUNDER_ACTION_STAGE: Record<FounderActionKind, StageIndex> = {
  findUsers: 0,
  talkToUsers: 0,
  rest: 0,
  motivateTeam: 1,
  investorCoffee: 1,
  salesCall: 2,
}

/** Stage an action unlocks at: content's StageDef.unlockActions if present, else the PLAN table. */
export function founderActionStage(kind: FounderActionKind): StageIndex {
  const s = STAGES.find((st) => st.unlockActions?.includes(kind))
  return s ? s.index : FOUNDER_ACTION_STAGE[kind]
}

export function stageName(i: number): string {
  return STAGES[i]?.name ?? '—'
}

/** First stage at which a slot type becomes available (from STAGES.newSlotType). */
export function slotTypeStage(type: SlotType): StageIndex {
  const s = STAGES.find((st) => st.newSlotType === type)
  return s ? s.index : 0
}

/** Morale bar fill: ink normally, red only when critical. */
export function moraleTone(m: number): string {
  if (m < 28) return 'bg-negative'
  if (m < 40) return 'bg-ink-3'
  return 'bg-ink'
}

/** Text colour for a signed number (positive/negative only on numbers). */
export function deltaTone(n: number): string {
  if (n > 0) return 'text-positive'
  if (n < 0) return 'text-negative'
  return 'text-ink-2'
}
