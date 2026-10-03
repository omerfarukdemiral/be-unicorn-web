// Horizon (docs/CORE_LOOP.md §5 "Ufuk", docs/LAYOUT.md §3.2): what is coming in the next weeks — payday
// (projected lump), delayed decision effects, release ETAs, the round. The engine lists them (state.derived.horizon).
// Shown as READABLE TEXT in the notification strip's right slot ("Maaş günü 8 gün · Sürüm ~4 gün"), never as
// icons stacked on a line; the full list lives in the strip popover (HorizonList).
// A month waiting on the payday desk (GAMEPLAY V2 §6.1) is not text: a red cash icon + `3g`, the one number, only while
// the desk is closed (open, time stands still and a countdown would lie); a tap reopens the desk.
// A known storm (§5.1) is a "?" tile with its countdown ("? · 58g") until CRISIS_TELEGRAPH_DAYS, then its own icon and
// name. A loan in covenant trouble (§6.2) shows the days to the next check beside the desk's countdown.
import { useShallow } from 'zustand/react/shallow'
import { covenantState } from '../engine'
import type { CrisisId, HorizonItem } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import { Icon, type IconName } from './icons'
import { t } from './i18n'
import { money } from './format'
import { cx } from './primitives'
import { soft } from './theme'
import { requestOverlay } from './modalQueue'
import { optionLabel, releaseName } from './loopUi'

/** Identity hue + icon per kind. Payday is neutral ink even when runway is tight: danger lives on Runway (§4.1). */
export const HORIZON_KIND: Record<HorizonItem['kind'], { icon: IconName; color: string }> = {
  payday: { icon: 'cash', color: 'var(--color-ink-2)' },
  delayed: { icon: 'hourglass', color: 'var(--color-kind-decision)' },
  release: { icon: 'rocket', color: 'var(--color-brand)' },
  roundClose: { icon: 'handshake', color: 'var(--color-brand)' },
  roundReady: { icon: 'rocket', color: 'var(--color-positive)' },
  // A known storm, not danger: brick identity hue, never --color-negative (one red rule).
  crisis: { icon: 'warning', color: 'var(--color-g-burn)' },
  // The market is saturated (§8.1): users hue, not a warning.
  saturation: { icon: 'pie', color: 'var(--color-g-users)' },
  // Known exams (§8.3–8.4): the board in the equity hue, a renewal in the cash hue; neither is danger.
  board: { icon: 'bars', color: 'var(--color-g-equity)' },
  renewal: { icon: 'handshake', color: 'var(--color-g-cash)' },
}

/** A month waiting on the payday desk (§6.1) is the one payday that is danger: red, with its countdown. */
const PAYDAY_DUE = { icon: 'cash' as IconName, color: 'var(--color-negative)' }

/** A revealed crisis wears its own icon (content/crises.ts ids); an unknown id keeps the storm sign. */
const CRISIS_ICON: Readonly<Partial<Record<CrisisId, IconName>>> = {
  'lease-hike': 'building',
  'cac-war': 'megaphone',
  'key-account-renewal': 'handshake',
  'investor-winter': 'trend',
  'market-correction': 'bars',
}

export function horizonKindOf(h: HorizonItem): { icon: IconName; color: string } {
  if (h.kind === 'payday' && h.due) return PAYDAY_DUE
  if (h.kind === 'crisis' && !h.hidden && h.crisisId) return { icon: CRISIS_ICON[h.crisisId] ?? HORIZON_KIND.crisis.icon, color: HORIZON_KIND.crisis.color }
  return HORIZON_KIND[h.kind]
}

/** True while a crisis is a date without a name: its tile is a "?" instead of an icon. */
const unknownCrisis = (h: HorizonItem): boolean => h.kind === 'crisis' && (!!h.hidden || !h.crisisId)

/** An item's tile: its kind's icon in its hue, a "?" for a crisis not revealed yet. */
export function HorizonTile({ h, size = 24 }: { h: HorizonItem; size?: number }) {
  const k = horizonKindOf(h)
  return (
    <span className="grid shrink-0 place-items-center rounded-[7px]" style={{ width: size, height: size, color: k.color, background: soft(k.color, 14) }}>
      {unknownCrisis(h) ? <span className="text-[11px] font-bold leading-none">{t('horizon.crisisHidden')}</span> : <Icon name={k.icon} size={Math.round(size * 0.54)} />}
    </span>
  )
}

export function horizonLabel(h: HorizonItem, projectName: (id: string | undefined) => string): string {
  switch (h.kind) {
    case 'payday':
      if (h.due) return t('horizon.paydayDue', { v: `−${money(h.amount ?? 0)}` })
      return t('horizon.payday', { v: `−${money(h.amount ?? 0)}` })
    case 'delayed': {
      const label = optionLabel(h.cardId, h.optionIndex)
      return label ? t('horizon.delayed', { v: label }) : t('horizon.delayedNote')
    }
    case 'release':
      return t('horizon.release', { project: projectName(h.projectId), level: releaseName(h.level ?? 1, h.update) })
    case 'roundClose':
      return t('horizon.roundClose')
    case 'roundReady':
      return t('horizon.roundReady')
    case 'crisis':
      return crisisName(h)
    case 'saturation':
      return t('horizon.saturation')
    case 'board':
      return t('horizon.board', { v: money(h.amount ?? 0) })
    case 'renewal':
      return t('horizon.renewal', { v: h.contractName ?? '' })
  }
}

function whenLabel(days: number, short = false): string {
  if (days < 0.5) return t('horizon.today')
  return t(short ? 'horizon.daysShort' : 'horizon.days', { v: Math.max(1, Math.round(days)) })
}

/** Readable one-liner of an item: "Maaş günü 8 gün", "Sürüm ~4 gün", "Tur kapanışı ~12 gün". */
/** "?" until the reveal (CRISIS_TELEGRAPH_DAYS), then the crisis name. */
function crisisName(h: HorizonItem): string {
  return h.hidden || !h.crisisId ? t('horizon.crisisHidden') : t(`crisis.${h.crisisId}`)
}

export function horizonItemText(h: HorizonItem, days: number, short = false): string {
  if (h.kind === 'payday' && h.due) return t('horizon.item.paydayDue', { d: whenLabel(days, short) })
  const v = h.kind === 'crisis' ? crisisName(h) : h.kind === 'board' ? money(h.amount ?? 0) : undefined
  return t(`horizon.item.${h.kind}`, { d: whenLabel(days, short), ...(v !== undefined ? { v } : {}) })
}

function useHorizon() {
  return useGameStore(
    useShallow((s) => ({
      items: s.state.derived.horizon,
      day: s.state.time.day,
      projects: s.state.projects,
      deskOpen: s.ui.overlay?.kind === 'payday',
    })),
  )
}

const isDue = (h: HorizonItem): boolean => h.kind === 'payday' && !!h.due

/**
 * The desk's countdown: red cash icon + "3g", its own button beside the strip's horizon button (never inside it).
 * Hidden while the desk is open (time stands still there) or when no month waits.
 */
export function HorizonDue() {
  const { items, day, deskOpen } = useHorizon()
  const item = items?.find(isDue)
  if (!item || deskOpen) return null
  return (
    <button
      type="button"
      data-payday-due=""
      title={t('desk.dueTitle')}
      aria-label={t('desk.dueTitle')}
      onClick={() => requestOverlay({ kind: 'payday' })}
      className="tabular inline-flex h-full shrink-0 items-center gap-1 rounded-md px-1 text-[13px] font-bold text-negative-ink hover:bg-negative/10"
    >
      <Icon name="cash" size={14} />
      {whenLabel(item.day - day, true)}
    </button>
  )
}

/**
 * The covenant countdown (§6.2): while the next payday counts a breach (or one was counted), the scale icon + days to
 * that check. Identity hue, never red (the red belongs to runway and the payday clock). A tap opens the Kasa dökümü.
 */
export function HorizonLoan() {
  const c = useGameStore(useShallow((s) => {
    const cv = covenantState(s.state)
    return cv && (cv.light === 'atRisk' || cv.light === 'breached') ? { days: cv.checkDays, breaches: cv.breaches } : null
  }))
  if (!c) return null
  const d = Math.max(0, Math.round(c.days))
  // Once a breach is counted the tooltip says how many ("İhlal 1 · 12g"), the same line as Metrikler's loan row.
  const title = c.breaches > 0 ? t('loan.warn', { n: c.breaches, d }) : t('loan.dueTitle', { d })
  return (
    <button
      type="button"
      data-loan-due=""
      title={title}
      aria-label={title}
      onClick={() => useGameStore.getState().openPanel({ kind: 'metrics', focus: 'burnBreakdown' }, { root: true })}
      className="tabular inline-flex h-full shrink-0 items-center gap-1 rounded-md px-1 text-[13px] font-bold hover:bg-surface-2"
      style={{ color: 'var(--color-g-burn)' }}
    >
      <Icon name="scale" size={14} />
      {whenLabel(c.days, true)}
    </button>
  )
}

/** One item per kind, nearest first (two paydays / three releases would only repeat the same word); the desk's deadline is its own kind. */
function firstOfEachKind(items: readonly HorizonItem[]): HorizonItem[] {
  const seen = new Set<string>()
  const out: HorizonItem[] = []
  for (const h of [...items].sort((a, b) => a.day - b.day)) {
    const key = h.kind === 'payday' && h.due ? 'paydayDue' : h.kind
    if (seen.has(key)) continue
    seen.add(key)
    out.push(h)
  }
  return out
}

/**
 * Strip slot: the nearest items as text, "Maaş günü 8 gün · Sürüm ~4 gün". `max` items (1 on narrow strips);
 * `compact` = phone badge, nearest item only: "Maaş günü 3g". The amounts and full labels are in the title / popover.
 */
export function HorizonMini({ max = 3, compact, className }: { max?: number; compact?: boolean; className?: string }) {
  const { items, day, projects } = useHorizon()
  const list = items ? firstOfEachKind(items.filter((h) => !isDue(h))) : []
  const first = list[0]
  if (!first) return null
  const name = (id: string | undefined) => projects.find((p) => p.id === id)?.name ?? ''
  const title = list.map((h) => `${whenLabel(h.day - day)} · ${horizonLabel(h, name)}`).join('\n')
  if (compact) {
    return (
      <span className={cx('tabular inline-flex min-w-0 items-center gap-1 text-[11px] font-semibold text-ink', className)} title={title}>
        <HorizonTile h={first} size={20} />
        <span className="truncate">{horizonItemText(first, first.day - day, true)}</span>
      </span>
    )
  }
  const shown = list.slice(0, Math.max(1, max))
  return (
    <span className={cx('tabular inline-flex min-w-0 items-center gap-1.5 text-[12px] font-medium text-ink-2', className)} title={title}>
      <Icon name="timer" size={14} className="shrink-0 text-ink-3" />
      <span className="min-w-0 truncate">
        {shown.map((h, i) => (
          <span key={`${h.kind}-${i}`}>
            {i > 0 && <span className="text-ink-3"> · </span>}
            {/* A revealed crisis carries its icon in the line ("⚑ Reklam savaşı · 12 gün"); "?" is its own sign. */}
            {h.kind === 'crisis' && !unknownCrisis(h) && <Icon name={horizonKindOf(h).icon} size={13} className="mr-0.5 inline-block align-[-2px]" style={{ color: HORIZON_KIND.crisis.color }} />}
            <span className={cx(i === 0 && 'font-semibold text-ink')}>{horizonItemText(h, h.day - day)}</span>
          </span>
        ))}
      </span>
    </span>
  )
}

/** Popover list: every upcoming item in day order, labelled, with its amount. */
export function HorizonList() {
  const { items, day, projects, deskOpen } = useHorizon()
  const name = (id: string | undefined) => projects.find((p) => p.id === id)?.name ?? ''
  const list = items ? items.filter((h) => !(deskOpen && isDue(h))).sort((a, b) => a.day - b.day) : []
  if (!list.length) return <p className="px-2 py-1.5 text-xs text-ink-2">{t('horizon.empty')}</p>
  return (
    <ul className="flex flex-col">
      {list.map((h, i) => {
        return (
          <li key={`${h.kind}-${i}-${Math.round(h.day)}`} className="flex items-center gap-2 px-2 py-1.5">
            <HorizonTile h={h} />
            <span className="tabular w-12 shrink-0 text-xs font-semibold text-ink">{whenLabel(h.day - day)}</span>
            <span className="font-text min-w-0 flex-1 truncate text-xs text-ink-2">{horizonLabel(h, name)}</span>
          </li>
        )
      })}
    </ul>
  )
}
