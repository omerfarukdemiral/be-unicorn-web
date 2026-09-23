// UI-side visual constants (render keeps its own palette.ts; UI may not import render).
import type { Dept, EmployeeStatus, FounderActionKind, HudWidget, SlotType, StageIndex } from '../engine/types'
import { STAGES } from '../content'
import type { IconName } from './icons'

/** CSS colour at a low opacity: the ~12% tint behind coloured icons, dept chips and brand-soft rows. */
export function soft(color: string, pct = 12): string {
  return `color-mix(in oklab, ${color} ${pct}%, transparent)`
}

/**
 * Icon colour for a gauge hue drawn on its own soft() tile: the hue pulled 20% toward ink so the icon keeps
 * >= 3:1 on the tile (WCAG 1.4.11) even where it is the only identifier (compact HUD). Bars keep the bright hue.
 */
export function iconTone(color: string): string {
  return `color-mix(in oklab, ${color} 80%, var(--color-ink))`
}

/** Ink or white, whichever reads better on a solid hex fill (book spines in the Defter shelf). */
export function readableOn(hex: string): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return 'var(--color-ink)'
  const lin = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  const L = 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!
  // Contrast vs white (1.05 / (L + .05)) against contrast vs ink (#1f1d24, L≈.013): pick the larger.
  return 1.05 / (L + 0.05) >= (L + 0.05) / 0.063 ? '#ffffff' : 'var(--color-ink)'
}

/**
 * Department identity: vivid dot + a light tint for chips/avatars. Text on the tint stays ink (AA).
 * `dot` is a CSS colour for inline styles; mirrors DEPT_COLORS in src/render/palette.ts (shirts).
 */
export const DEPT_COLOR: Record<Dept, { bg: string; fg: string; dot: string }> = {
  eng: { bg: 'bg-dept-eng/12', fg: 'text-ink', dot: 'var(--color-dept-eng)' },
  product: { bg: 'bg-dept-product/12', fg: 'text-ink', dot: 'var(--color-dept-product)' },
  marketing: { bg: 'bg-dept-marketing/12', fg: 'text-ink', dot: 'var(--color-dept-marketing)' },
  sales: { bg: 'bg-dept-sales/14', fg: 'text-ink', dot: 'var(--color-dept-sales)' },
  ops: { bg: 'bg-dept-ops/12', fg: 'text-ink', dot: 'var(--color-dept-ops)' },
}

/**
 * HUD gauge hue per widget (icon, icon tile, thin bar / sparkline / stacked bar ramp). Values stay ink;
 * only warnings turn the number red. Tokens: --color-g-* in src/index.css.
 */
export const WIDGET_COLOR: Record<HudWidget, string> = {
  cash: 'var(--color-g-cash)',
  users: 'var(--color-g-users)',
  morale: 'var(--color-g-morale)',
  runway: 'var(--color-g-runway)',
  burnBreakdown: 'var(--color-g-burn)',
  retention: 'var(--color-g-retention)',
  profitProjection: 'var(--color-g-cash)',
  capTable: 'var(--color-g-equity)',
  roundTimer: 'var(--color-brand)',
  candidateQuality: 'var(--color-g-equity)',
  moraleHeatmap: 'var(--color-g-morale)',
  churn: 'var(--color-g-churn)',
  arpu: 'var(--color-g-sky)',
  reputation: 'var(--color-g-reputation)',
  equity: 'var(--color-g-equity)',
  ltvCac: 'var(--color-g-retention)',
  channelBreakdown: 'var(--color-g-users)',
  debtCounter: 'var(--color-g-debt)',
  coordinationWarning: 'var(--color-g-sky)',
  cultureBadge: 'var(--color-g-morale)',
  revenueDistribution: 'var(--color-g-indigo)',
  archetypeBadge: 'var(--color-brand)',
}

/** Founder action hue (icon + tint + ring); locked / unavailable buttons fall back to neutral. */
export const FOUNDER_COLOR: Record<FounderActionKind, string> = {
  findUsers: 'var(--color-g-users)',
  talkToUsers: 'var(--color-g-retention)',
  motivateTeam: 'var(--color-g-morale)',
  investorCoffee: 'var(--color-g-cash)',
  salesCall: 'var(--color-g-runway)',
  rest: 'var(--color-g-reputation)',
}

/** Status pill text colour (Pill supplies the neutral hairline frame). Red only for bad states. */
export const STATUS_TONE: Record<EmployeeStatus, string> = {
  working: 'text-ink-2',
  tired: 'text-ink',
  burnout: 'text-ink',
  break: 'text-ink-2',
  onboarding: 'text-ink-2',
  leaving: 'text-ink',
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

/** Morale bar fill: morale hue normally, faded in the tired band, red when critical. */
export function moraleTone(m: number): string {
  if (m < 28) return 'bg-negative'
  if (m < 40) return 'bg-g-morale/45'
  return 'bg-g-morale'
}

/** Text colour for a signed number (positive/negative only on numbers). */
export function deltaTone(n: number): string {
  if (n > 0) return 'text-positive-ink'
  if (n < 0) return 'text-negative-ink'
  return 'text-ink-2'
}
