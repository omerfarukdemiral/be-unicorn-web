// Short, non-blocking moment cards under the HUD (docs/CORE_LOOP.md §4.2, §7 "Popup bütçesi"):
// month receipt (ay fişi) on payday, release moment (sürüm anı), "Kararın → sonucu", ☆ goal reached, and the round
// beats: the early window opening and each round week (live offer move + "pick this week's pitch").
// Each card is clickable (opens the related panel), never pauses time and closes by itself in ≤ 5 s.
import { useEffect, useRef, useState } from 'react'
import type { MonthReceipt } from '../engine/types'
import { GOALS, STAGES } from '../content'
import { useGameStore } from '../store/gameStore'
import type { Panel } from '../store/types'
import { Icon, type IconName } from './icons'
import { t } from './i18n'
import { fixed, money, pct } from './format'
import { cx } from './primitives'
import { soft } from './theme'
import { effectSummary, optionLabel, releaseLevelName, useFreshEvents } from './loopUi'

type Moment =
  | { key: number; kind: 'receipt'; receipt: MonthReceipt; compact: boolean }
  | { key: number; kind: 'release'; project: string; level: number; users: number; mrr: number }
  | { key: number; kind: 'outcome'; option: string; effects: string }
  | { key: number; kind: 'goal'; text: string }
  | { key: number; kind: 'roundWindow'; stage: string }
  | { key: number; kind: 'roundWeek'; week: number; weeks: number; from: number; to: number; pitch: boolean }

const LIFE_MS: Record<Moment['kind'], number> = { receipt: 4500, release: 4000, outcome: 5000, goal: 4000, roundWindow: 5000, roundWeek: 4000 }
const MAX_SHOWN = 2

function open(panel: Panel) {
  useGameStore.getState().openPanel(panel, { root: true })
}

export function MomentFeed({ className }: { className?: string }) {
  const [items, setItems] = useState<Moment[]>([])
  useFreshEvents((events, s) => {
    const add: Moment[] = []
    for (const e of events) {
      if (e.kind === 'payday' && s.finance.lastReceipt) {
        // At 4× paydays come every 15 s: the receipt shrinks to one line (§4.2).
        add.push({ key: e.id, kind: 'receipt', receipt: s.finance.lastReceipt, compact: s.time.speed === 4 })
      } else if (e.kind === 'release') {
        const r = s.releases?.find((x) => x.id === e.refId)
        if (r) add.push({ key: e.id, kind: 'release', project: r.projectName, level: r.level, users: r.users, mrr: r.mrr })
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
    if (add.length) setItems((cur) => [...cur, ...add].slice(-4))
  })
  const dismiss = (key: number) => setItems((cur) => cur.filter((m) => m.key !== key))
  const shown = items.slice(0, MAX_SHOWN)
  if (!shown.length) return null
  return (
    <div className={cx('pointer-events-none flex flex-col items-center gap-1.5', className)} aria-live="polite">
      {shown.map((m) => (
        <MomentCard key={m.key} m={m} onDone={() => dismiss(m.key)} />
      ))}
    </div>
  )
}

/** Auto-closing shell; hovering keeps it open, clicking opens the related panel. */
function MomentCard({ m, onDone }: { m: Moment; onDone: () => void }) {
  const [hold, setHold] = useState(false)
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    if (hold) return
    const id = window.setTimeout(() => done.current(), LIFE_MS[m.kind])
    return () => window.clearTimeout(id)
  }, [hold, m.kind])
  const { icon, color, panel } = look(m)
  return (
    <button
      type="button"
      onClick={() => {
        open(panel)
        onDone()
      }}
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      className="pointer-events-auto flex max-w-full animate-slide-up items-center gap-2 rounded-card border bg-surface/97 px-2.5 py-1.5 text-left shadow-pop transition-colors hover:bg-surface-2"
      style={{ borderColor: soft(color, 45) }}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-[8px]" style={{ color, background: soft(color, 16) }}>
        <Icon name={icon} size={15} />
      </span>
      <span className="min-w-0">{body(m)}</span>
    </button>
  )
}

function look(m: Moment): { icon: IconName; color: string; panel: Panel } {
  switch (m.kind) {
    case 'receipt':
      return { icon: 'cash', color: m.receipt.net >= 0 ? 'var(--color-positive)' : 'var(--color-g-burn)', panel: { kind: 'growth' } }
    case 'release':
      return { icon: 'rocket', color: 'var(--color-brand)', panel: { kind: 'projects' } }
    case 'outcome':
      return { icon: 'hourglass', color: 'var(--color-kind-decision)', panel: { kind: 'growth' } }
    case 'goal':
      return { icon: 'star', color: 'var(--color-g-equity)', panel: { kind: 'growth' } }
    case 'roundWindow':
      return { icon: 'rocket', color: 'var(--color-brand)', panel: { kind: 'growth', section: 'round' } }
    case 'roundWeek':
      return { icon: 'handshake', color: m.to >= m.from ? 'var(--color-positive)' : 'var(--color-negative)', panel: { kind: 'growth', section: 'round' } }
  }
}

const neg = (v: number) => (v > 0.5 ? `−${money(v)}` : money(0))
const sgn = (v: number) => (v >= 0 ? `+${money(v)}` : `−${money(-v)}`)
const months = (r: number | null) => (r === null ? t('receipt.infinite') : t('unit.months', { v: fixed(r, 1) }))

function body(m: Moment) {
  switch (m.kind) {
    case 'receipt': {
      const r = m.receipt
      if (m.compact) {
        return <span className="tabular block truncate text-xs font-semibold text-ink">{t('receipt.compact', { v: neg(r.paid), n: sgn(r.net) })}</span>
      }
      const rows: [string, string, boolean?][] = [
        [t('receipt.revenue'), sgn(r.revenue), true],
        [t('receipt.salaries'), neg(r.salaries)],
        [t('receipt.rent'), neg(r.rent)],
      ]
      if (r.infra > 0.5) rows.push([t('receipt.infra'), neg(r.infra)])
      if (r.ads > 0.5) rows.push([t('receipt.ads'), neg(r.ads)])
      return (
        <span className="block" title={t('receipt.open')}>
          <span className="ui-label block leading-none">{t('receipt.title', { m: r.month + 1 })}</span>
          <span className="tabular mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11.5px] text-ink-2">
            {rows.map(([k, v, up]) => (
              <span key={k} className="whitespace-nowrap">
                {k} <span className={cx('font-semibold', up ? 'text-positive-ink' : 'text-ink')}>{v}</span>
              </span>
            ))}
            <span className="whitespace-nowrap">
              {t('receipt.net')} <span className={cx('font-bold', r.net >= 0 ? 'text-positive-ink' : 'text-negative-ink')}>{sgn(r.net)}</span>
            </span>
            <span className="whitespace-nowrap">
              {t('receipt.runway')} <span className="font-semibold text-ink">{r.month > 0 ? t('receipt.runwayMove', { a: months(r.runwayBefore), b: months(r.runwayAfter) }) : months(r.runwayAfter)}</span>
            </span>
            {r.mrr > 0 && <span className="whitespace-nowrap">{t('receipt.growth', { v: pct(r.mom, 1), m: fixed(r.multiple, 0) })}</span>}
          </span>
        </span>
      )
    }
    case 'release':
      return (
        <span className="block">
          <span className="block truncate text-[13px] font-bold text-ink">{t('release.title', { project: m.project, level: releaseLevelName(m.level) })}</span>
          <span className="tabular block text-[11.5px] font-semibold text-positive-ink">{t('release.wave', { u: Math.round(m.users), m: money(m.mrr) })}</span>
        </span>
      )
    case 'outcome':
      return (
        <span className="block">
          <span className="ui-label block leading-none" style={{ color: 'var(--color-kind-decision)' }}>
            {t('outcome.title')}
          </span>
          <span className="font-text mt-0.5 block text-[12px] leading-snug text-ink">{t('outcome.line', { option: m.option, effects: m.effects })}</span>
        </span>
      )
    case 'goal':
      return <span className="block text-[12.5px] font-semibold text-ink">☆ {t('goals.toast', { v: m.text })}</span>
    case 'roundWindow':
      return (
        <span className="block">
          <span className="block text-[13px] font-bold text-ink">{t('moment.roundWindow', { stage: m.stage })}</span>
          <span className="font-text block text-[11.5px] text-ink-2">{t('moment.roundWindowSub')}</span>
        </span>
      )
    case 'roundWeek':
      return (
        <span className="block">
          <span className="tabular block text-[12.5px] font-semibold text-ink">{t('moment.roundWeek', { w: m.week, n: m.weeks, a: money(m.from), b: money(m.to) })}</span>
          {m.pitch && <span className="font-text block text-[11.5px] text-brand-ink">{t('moment.roundWeekSub')}</span>}
        </span>
      )
  }
}

