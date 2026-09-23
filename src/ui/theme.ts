// UI-side visual constants (render keeps its own palette.ts; UI may not import render).
import type { Dept, EmployeeStatus, FounderActionKind, SlotType, StageIndex } from '../engine/types'
import { STAGES } from '../content'
import type { IconName } from './icons'

export const DEPT_COLOR: Record<Dept, { bg: string; fg: string; dot: string }> = {
  eng: { bg: 'bg-sky-100', fg: 'text-sky-600', dot: '#7fb6ee' },
  product: { bg: 'bg-lilac-100', fg: 'text-lilac-500', dot: '#b894f0' },
  marketing: { bg: 'bg-peach-100', fg: 'text-peach-600', dot: '#ffae86' },
  sales: { bg: 'bg-mint-100', fg: 'text-mint-600', dot: '#7fd3ad' },
  ops: { bg: 'bg-lemon-100', fg: 'text-lemon-600', dot: '#f0d05f' },
}

export const STATUS_TONE: Record<EmployeeStatus, string> = {
  working: 'bg-mint-100 text-mint-600',
  tired: 'bg-lemon-100 text-lemon-600',
  burnout: 'bg-rose-100 text-rose-600',
  break: 'bg-sky-100 text-sky-600',
  onboarding: 'bg-lilac-100 text-lilac-500',
  leaving: 'bg-rose-100 text-rose-600',
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

export function moraleTone(m: number): string {
  if (m < 28) return 'bg-rose-300'
  if (m < 40) return 'bg-peach-300'
  if (m < 60) return 'bg-lemon-300'
  return 'bg-mint-300'
}
