// Moments (docs/CORE_LOOP.md §4.2, §7 "Popup bütçesi"; docs/LAYOUT.md §3): month receipt (ay fişi) on payday,
// release moment (sürüm anı), "Kararın → sonucu", ☆ goal reached, and the round beats (early window, each round week).
// They are items of the ONE notification strip now: `useMomentSource` turns fresh engine events into moments,
// `MomentLine` draws one as a single line, `momentLook` gives its icon / hue / panel. Nothing here pauses time.
import type { MonthReceipt } from '../engine/types'
import { GOALS, STAGES } from '../content'
import type { Panel } from '../store/types'
import type { IconName } from './icons'
import { t } from './i18n'
import { fixed, money } from './format'
import { cx } from './primitives'
import { effectSummary, optionLabel, releaseName, useFreshEvents } from './loopUi'
import { momentPanel } from './momentRules'

export type Moment =
  | { key: number; kind: 'receipt'; receipt: MonthReceipt }
  | { key: number; kind: 'release'; project: string; level: number; update?: number; users: number; mrr: number }
  | { key: number; kind: 'outcome'; option: string; effects: string }
  | { key: number; kind: 'goal'; text: string }
  | { key: number; kind: 'roundWindow'; stage: string }
  | { key: number; kind: 'roundWeek'; week: number; weeks: number; from: number; to: number; pitch: boolean }

/** Calls `onMoments` with the moments hidden in fresh engine events (skips a loaded run's history). */
export function useMomentSource(onMoments: (add: Moment[]) => void): void {
  useFreshEvents((events, s) => {
    const add: Moment[] = []
    for (const e of events) {
      if (e.kind === 'payday' && s.finance.lastReceipt) {
        add.push({ key: e.id, kind: 'receipt', receipt: s.finance.lastReceipt })
      } else if (e.kind === 'release') {
        const r = s.releases?.find((x) => x.id === e.refId)
        if (r) add.push({ key: e.id, kind: 'release', project: r.projectName, level: r.level, ...(r.update !== undefined ? { update: r.update } : {}), users: r.users, mrr: r.mrr })
      } else if (e.kind === 'delayedEffect') {
        const o = [...(s.decisions.outcomes ?? [])].reverse().find((x) => x.cardId === e.refId)
        if (o) add.push({ key: e.id, kind: 'outcome', option: optionLabel(o.cardId, o.optionIndex) ?? '', effects: effectSummary(o.effects) })
      } else if (e.kind === 'roundWindow') {
        add.push({ key: e.id, kind: 'roundWindow', stage: STAGES[e.value ?? s.stage + 1]?.name ?? '' })
      } else if (e.kind === 'roundWeek' && s.round?.lastMove) {
        const m = s.round.lastMove
        add.push({ key: e.id, kind: 'roundWeek', week: m.week, weeks: s.round.weeksTotal, from: m.from, to: m.to, pitch: s.round.pitchDue !== undefined })
      } else if (e.kind === 'goalDone') {
        const g = GOALS.find((x) => x.id === e.refId)
        if (g) add.push({ key: e.id, kind: 'goal', text: g.text })
      }
    }
    if (add.length) onMoments(add)
  })
}

/**
 * Icon, identity hue and the panel a moment opens. No red here (docs/LAYOUT.md §4.1): a negative receipt uses the
 * burn identity hue, a falling round offer the warning (energy) hue.
 */
export function momentLook(m: Moment): { icon: IconName; color: string; panel: Panel } {
  const panel = momentPanel(m.kind)
  switch (m.kind) {
    case 'receipt':
      return { icon: 'cash', color: m.receipt.net >= 0 ? 'var(--color-positive)' : 'var(--color-g-burn)', panel }
    case 'release':
      return { icon: 'rocket', color: 'var(--color-brand)', panel }
    case 'outcome':
      return { icon: 'hourglass', color: 'var(--color-kind-decision)', panel }
    case 'goal':
      return { icon: 'star', color: 'var(--color-g-equity)', panel }
    case 'roundWindow':
      return { icon: 'rocket', color: 'var(--color-brand)', panel }
    case 'roundWeek':
      return { icon: 'handshake', color: m.to >= m.from ? 'var(--color-positive)' : 'var(--color-energy)', panel }
  }
}

const neg = (v: number) => (v > 0.5 ? `−${money(v)}` : money(0))
const sgn = (v: number) => (v >= 0 ? `+${money(v)}` : `−${money(-v)}`)
const months = (r: number | null) => (r === null ? t('receipt.infinite') : t('unit.months', { v: fixed(r, 1) }))

/** The receipt's runway part, or null when it says nothing ("∞ → ∞", "4.2 ay → 4.2 ay", a first month at ∞). */
export function receiptRunway(r: Pick<MonthReceipt, 'month' | 'runwayBefore' | 'runwayAfter'>): string | null {
  const a = r.runwayBefore === null ? null : fixed(r.runwayBefore, 1)
  const b = r.runwayAfter === null ? null : fixed(r.runwayAfter, 1)
  if (r.month > 0 && a !== b) return t('receipt.runwayMove', { a: months(r.runwayBefore), b: months(r.runwayAfter) })
  return b === null ? null : months(r.runwayAfter)
}

/** Plain one-line text of a moment (strip title attribute, screen readers). */
export function momentText(m: Moment): string {
  switch (m.kind) {
    case 'receipt': {
      const r = m.receipt
      const runway = receiptRunway(r)
      return t('strip.receipt', { m: r.month + 1, p: neg(r.paid), n: sgn(r.net), r: runway ? ` · ${t('receipt.runway')} ${runway}` : '' })
    }
    case 'release':
      return t('strip.release', { project: m.project, level: releaseName(m.level, m.update), u: Math.round(m.users), m: money(m.mrr) })
    case 'outcome':
      return t('outcome.line', { option: m.option, effects: m.effects })
    case 'goal':
      return t('strip.goal', { v: m.text })
    case 'roundWindow':
      return `${t('moment.roundWindow', { stage: m.stage })} · ${t('moment.roundWindowSub')}`
    case 'roundWeek':
      return t('strip.roundWeek', { w: m.week, n: m.weeks, a: money(m.from), b: money(m.to) }) + (m.pitch ? ` · ${t('moment.roundWeekSub')}` : '')
  }
}

/** One line: main text in ink semibold, the secondary part in ink-2 (everything truncates as one line). */
export function MomentLine({ m }: { m: Moment }) {
  const main = 'font-semibold text-ink'
  const sub = 'text-ink-2'
  switch (m.kind) {
    case 'receipt': {
      const r = m.receipt
      const runway = receiptRunway(r)
      // Net first: on a narrow strip the truncation eats the tail (ödenen, runway), never the month's result.
      return (
        <span className="tabular">
          <span className={main}>{t('receipt.title', { m: r.month + 1 })}</span>
          <span className={sub}>
            {' · '}
            {t('receipt.net')} <span className={cx('font-semibold', r.net >= 0 ? 'text-positive-ink' : 'text-ink')}>{sgn(r.net)}</span> · {t('strip.paid')} {neg(r.paid)}
            {runway && ` · ${t('receipt.runway')} ${runway}`}
          </span>
        </span>
      )
    }
    case 'release':
      return (
        <span className="tabular">
          <span className={main}>{t('release.title', { project: m.project, level: releaseName(m.level, m.update) })}</span>
          <span className="font-medium text-positive-ink"> · {t('release.wave', { u: Math.round(m.users), m: money(m.mrr) })}</span>
        </span>
      )
    case 'outcome':
      return (
        <span>
          <span className={main}>{t('outcome.title')}</span>
          <span className={sub}> · {t('outcome.line', { option: m.option, effects: m.effects })}</span>
        </span>
      )
    case 'goal':
      return <span className={main}>{t('strip.goal', { v: m.text })}</span>
    case 'roundWindow':
      return (
        <span>
          <span className={main}>{t('moment.roundWindow', { stage: m.stage })}</span>
          <span className={sub}> · {t('moment.roundWindowSub')}</span>
        </span>
      )
    case 'roundWeek':
      return (
        <span className="tabular">
          <span className={main}>{t('strip.roundWeek', { w: m.week, n: m.weeks, a: money(m.from), b: money(m.to) })}</span>
          {m.pitch && <span className="text-brand-ink"> · {t('moment.roundWeekSub')}</span>}
        </span>
      )
  }
}

