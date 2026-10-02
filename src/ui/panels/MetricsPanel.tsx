// Metrikler (docs/LAYOUT.md §5): every secondary gauge the learned concepts opened, grouped (Para, Büyüme, Ekip, Yol),
// each with a "pin to the top bar" toggle (max 2, the 3rd evicts the oldest). A pinned card the top bar is drawing
// shows "Üst barda" instead of its value (one home per number); on phones the pins lead the list with their values.
// A newly opened gauge (PLAN Hisset → Adlandır → KULLAN) carries a "Yeni" tag and a brand tint for a few seconds.
// HUD grammar (GAMEPLAY V2 §10.5): a card is one row, name + number (+ spark / bar under it); a long press (or a
// right click) pins it. The loan sits in the Kasa split: balance, rate, the covenant light and its counter.
// Never pauses (not a pauseReason).
import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { CONCEPT_TITLE, CONCEPTS } from '../../content'
import { covenantState } from '../../engine/loopSelectors'
import type { ConceptId, HudWidget } from '../../engine/types'
import { useGameStore } from '../../store/gameStore'
import { metricSources, metricUnlocked, PIN_MAX, pinEvictee, unseenMetrics } from '../../store/metricPins'
import { cashFlow } from '../cashflow'
import { money, pct } from '../format'
import { useIsMobile } from '../hooks'
import { t } from '../i18n'
import { Icon } from '../icons'
import { PIN_VISIBLE } from '../layout/tokens'
import { cx, Dot, IconBadge, IconButton, SectionTitle } from '../primitives'
import { WIDGET_COLOR } from '../theme'
import { METRIC_CARDS, METRIC_GROUPS, ledgerMoney, usePinnedMetrics, visiblePins, WidgetChip, WIDGETS, type MetricGroup } from '../widgets'

/** How long a new card keeps its "Yeni" tint, and when it counts as seen (docs/LAYOUT.md §5.1). */
const NEW_TINT_MS = 4000
const SEEN_AFTER_MS = 1500
const FOCUS_MS = 1500
/** Press this long on a row to pin / unpin it. */
const HOLD_MS = 450

/** The Defter card that opened a gauge (reputation has none: it opens with the first press). */
function conceptOf(id: HudWidget): ConceptId | undefined {
  const src = metricSources(id)
  return CONCEPTS.find((c) => {
    const u = c.unlocks
    if (u === undefined) return false
    return typeof u === 'string' ? src.includes(u as HudWidget) : u.some((x) => src.includes(x as HudWidget))
  })?.id
}

function useViewportWidth(): number {
  const [w, setW] = useState(() => (typeof window === 'undefined' ? 1440 : window.innerWidth))
  useEffect(() => {
    const on = () => setW(window.innerWidth)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return w
}

export function MetricsPanel({ focus }: { focus?: HudWidget }) {
  const unlocked = useGameStore(useShallow((s) => s.state.unlockedWidgets))
  const seen = useGameStore(useShallow((s) => s.ui.seenMetrics))
  const markMetricsSeen = useGameStore((s) => s.markMetricsSeen)
  const pins = usePinnedMetrics()
  const mobile = useIsMobile()
  const vw = useViewportWidth()
  // Pins the top bar is drawing right now (phones draw none there: they lead this list instead).
  const onBar = useMemo(() => new Set(mobile ? [] : visiblePins(pins, PIN_VISIBLE(vw))), [mobile, pins, vw])

  const cards = METRIC_CARDS.filter((id) => metricUnlocked(id, unlocked))
  const lockedCount = METRIC_CARDS.length - cards.length

  // "Yeni": cards not yet seen get a tint for NEW_TINT_MS and count as seen after SEEN_AFTER_MS on screen.
  const unseen = unseenMetrics(unlocked, seen)
  const unseenKey = unseen.join(',')
  const [fresh, setFresh] = useState<ReadonlySet<HudWidget>>(() => new Set(unseen))
  useEffect(() => {
    if (!unseenKey) return
    const ids = unseenKey.split(',') as HudWidget[]
    setFresh((cur) => new Set([...cur, ...ids]))
    const seenTimer = window.setTimeout(() => markMetricsSeen(ids.flatMap(metricSources)), SEEN_AFTER_MS)
    const tintTimer = window.setTimeout(() => setFresh((cur) => new Set([...cur].filter((x) => !ids.includes(x)))), NEW_TINT_MS)
    return () => {
      window.clearTimeout(seenTimer)
      window.clearTimeout(tintTimer)
    }
  }, [unseenKey, markMetricsSeen])

  // Opened from a pinned chip / the strip: scroll that card into view and highlight it briefly.
  const [focused, setFocused] = useState<HudWidget | null>(null)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!focus) return
    const id = WIDGETS[focus]?.mergedInto ?? focus
    setFocused(id)
    root.current?.querySelector(`[data-metric="${id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const tm = window.setTimeout(() => setFocused(null), FOCUS_MS)
    return () => window.clearTimeout(tm)
  }, [focus])

  const leading = mobile ? pins : []
  const byGroup = (g: MetricGroup) => cards.filter((id) => WIDGETS[id].group === g && !leading.includes(id))

  const row = (id: HudWidget) => <MetricRow key={id} id={id} pins={pins} onBar={onBar.has(id)} isNew={fresh.has(id)} focused={focused === id} />

  return (
    <div ref={root} className="flex flex-col gap-4">
      <div className="flex justify-end">
        <span className="tabular shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-2">{t('metrics.pinnedCount', { n: pins.length, max: PIN_MAX })}</span>
      </div>

      {leading.length > 0 && (
        <section>
          <SectionTitle>{t('metrics.group.pinned')}</SectionTitle>
          <div className="flex flex-col gap-1">{leading.map(row)}</div>
        </section>
      )}

      {METRIC_GROUPS.map((g) => {
        const ids = byGroup(g)
        if (g !== 'money' && ids.length === 0) return null
        return (
          <section key={g}>
            <SectionTitle>{t(`metrics.group.${g}`)}</SectionTitle>
            <div className="flex flex-col gap-1">
              {g === 'money' && <CashBreakdown />}
              {ids.map(row)}
            </div>
          </section>
        )
      })}

      <div className="flex items-center gap-2 rounded-control border border-dashed border-border-strong px-3 py-2 text-xs text-ink-2">
        <Icon name={lockedCount > 0 ? 'lock' : 'check'} size={14} className="shrink-0 text-ink-3" />
        <span className="font-text">{lockedCount > 0 ? t('metrics.more', { n: lockedCount }) : t('metrics.allOpen')}</span>
      </div>
    </div>
  )
}

/** One Metrikler card: the gauge (or "Üst barda"), its concept link, the pin toggle. */
function MetricRow({ id, pins, onBar, isNew, focused }: { id: HudWidget; pins: readonly HudWidget[]; onBar: boolean; isNew: boolean; focused: boolean }) {
  const def = WIDGETS[id]
  const pinMetric = useGameStore((s) => s.pinMetric)
  const unpinMetric = useGameStore((s) => s.unpinMetric)
  const openPanel = useGameStore((s) => s.openPanel)
  const mobile = useIsMobile()
  const pinned = pins.includes(id)
  const label = t(def.labelKey)
  const concept = conceptOf(id)
  const W = def.Component
  // The hint names the pin the store would really evict (a pin locked in this run goes first, silently).
  const evictee = useGameStore((s) => (pinned ? null : pinEvictee(s.ui.pinnedMetrics, id, s.state.unlockedWidgets)))
  const pinLabel = pinned ? t('metrics.unpin') : evictee ? t('metrics.pinReplace', { old: t(WIDGETS[evictee].labelKey) }) : t('metrics.pin')
  const togglePin = () => (pinned ? unpinMetric(id) : pinMetric(id))
  const hold = useHold(def.pinnable ? togglePin : undefined)

  return (
    <div
      data-metric={id}
      title={def.pinnable ? t('metrics.holdTitle') : undefined}
      {...hold}
      className={cx(
        'flex select-none items-start gap-1 rounded-control border px-0.5 transition-colors duration-500',
        focused ? 'border-brand bg-brand-soft' : isNew ? 'border-brand/30 bg-brand-soft' : 'border-transparent',
      )}
    >
      <div className="min-w-0 flex-1">
        {onBar ? (
          // Its value is in the top bar right now: no second copy here.
          <WidgetChip
            icon={def.icon}
            color={def.color}
            label={label}
            value={
              <span className="inline-flex items-center gap-1 text-[13px] font-medium text-ink-2">
                <Icon name="pin" size={13} />
                {t('metrics.onTopBar')}
              </span>
            }
          />
        ) : (
          <W variant="panel" />
        )}
        {concept && (
          <button
            type="button"
            onClick={() => openPanel({ kind: 'journal', conceptId: concept })}
            className="ml-11 mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-medium text-ink-2 hover:text-brand-ink"
          >
            {t('metrics.concept', { c: CONCEPT_TITLE[concept] })}
            <Icon name="chevronRight" size={12} />
          </button>
        )}
      </div>
      {isNew && <span className="mt-2 shrink-0 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-on-ink">{t('metrics.new')}</span>}
      {/* A pinned row shows the pin (tap to unpin); a pinnable one a faint mark (pinning itself is the long press). */}
      {def.pinnable && !pinned && (
        <span data-pin-mark="" title={pinLabel} className="grid size-8 shrink-0 place-items-center text-ink-3/60">
          <Icon name="pin" size={13} />
        </span>
      )}
      {def.pinnable && pinned && (
        <IconButton
          icon="pin"
          label={pinLabel}
          aria-pressed
          size={mobile ? 44 : 32}
          onClick={togglePin}
          // A press here is the button's own tap, never the row's long press (it would toggle twice).
          onPointerDown={(e) => e.stopPropagation()}
          // Pinned = quiet brand tint (a solid brand disc per row would shout louder than the numbers).
          className="bg-brand-soft text-brand-ink hover:bg-brand-soft hover:text-brand-ink"
        />
      )}
    </div>
  )
}

/**
 * Long press (HOLD_MS) or right click runs `action` once; a tap stays a tap (the concept link, the unpin button).
 * A touch long press also fires `contextmenu` (Android) and may end in a click: once the timer has run, both are
 * swallowed until the next press, so one press never pins and unpins, nor opens the concept card under the finger.
 * Pointer handlers only: no timers left behind when the row goes away mid-press.
 */
function useHold(action: (() => void) | undefined) {
  const timer = useRef<number | null>(null)
  const fired = useRef(false)
  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(() => clear, [])
  if (!action) return {}
  return {
    onPointerDown: (e: PointerEvent) => {
      fired.current = false
      if (e.button !== 0) return
      clear()
      timer.current = window.setTimeout(() => {
        timer.current = null
        fired.current = true
        action()
      }, HOLD_MS)
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault()
      clear()
      if (fired.current) return
      fired.current = true
      action()
    },
    onClickCapture: (e: MouseEvent) => {
      if (!fired.current) return
      e.preventDefault()
      e.stopPropagation()
    },
  }
}

/** Bankada / maaş gününe ayrılan / kullanılabilir: the split behind the top bar's Kasa (not pinnable). */
function CashBreakdown() {
  const f = useGameStore(useShallow((s) => {
    const c = cashFlow(s.state)
    return { bank: c.bank, owed: c.owed, usable: c.usable }
  }))
  const cells: [string, string, boolean][] = [
    [t('metrics.cash.bank'), ledgerMoney(f.bank), false],
    [t('metrics.cash.owed'), f.owed > 0.5 ? `−${money(f.owed)}` : money(0), false],
    [t('metrics.cash.usable'), ledgerMoney(f.usable), f.usable < 0],
  ]
  return (
    <div data-metric="cash" className="rounded-control px-2 py-1.5">
      <div className="flex items-center gap-2">
        <IconBadge icon="cash" size={28} color={WIDGET_COLOR.cash} className="rounded-[7px]" />
        <span className="ui-label">{t('metrics.cash.title')}</span>
      </div>
      <dl className="tabular mt-1.5 grid grid-cols-3 gap-2 pl-9">
        {cells.map(([k, v, danger]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[10.5px] font-medium leading-tight text-ink-2">{k}</dt>
            <dd className={cx('text-[14px] font-semibold leading-tight', danger ? 'text-negative-ink' : 'text-ink')}>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="font-text mt-1.5 pl-9 text-[11px] leading-snug text-ink-2">{t('metrics.cash.note')}</p>
      <LoanRow />
    </div>
  )
}

/**
 * The loan (GAMEPLAY V2 §6.2) under the Kasa split, from finance.loan as the engine keeps it: balance, monthly rate,
 * and the covenant light: grace days left, clean, at risk (runway already under the lender's line: the next payday
 * counts a breach), or the breach count with the days to the next check (payday).
 * Amber, never red: a breach is a warning (the one red rule stays with runway / payroll).
 */
function LoanRow() {
  const l = useGameStore(
    useShallow((s) => {
      const loan = s.state.finance.loan
      const c = covenantState(s.state)
      if (!loan || !c) return null
      return { balance: loan.balance, rate: loan.rateMonthly, ...c }
    }),
  )
  if (!l) return null
  const light =
    l.light === 'grace'
      ? { color: 'var(--color-ink-3)', text: t('loan.grace', { d: Math.ceil(l.graceDays) }) }
      : l.light === 'breached'
        ? { color: 'var(--color-energy)', text: t('loan.warn', { n: l.breaches, d: Math.ceil(l.checkDays) }) }
        : l.light === 'atRisk'
          ? { color: 'var(--color-energy)', text: t('loan.risk', { d: Math.ceil(l.checkDays) }) }
          : { color: 'var(--color-positive)', text: t('loan.ok') }
  return (
    <div data-loan="" className="mt-2 border-t border-border pt-1.5 pl-9">
      <div className="ui-label">{t('loan.title')}</div>
      <dl className="tabular mt-0.5 grid grid-cols-3 gap-2">
        <div className="min-w-0">
          <dt className="text-[10.5px] font-medium leading-tight text-ink-2">{t('loan.balance')}</dt>
          <dd className="text-[14px] font-semibold leading-tight text-ink">{money(l.balance)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[10.5px] font-medium leading-tight text-ink-2">{t('loan.rate')}</dt>
          <dd className="text-[14px] font-semibold leading-tight text-ink">{pct(l.rate, 1)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[10.5px] font-medium leading-tight text-ink-2">{t('loan.covenant')}</dt>
          <dd data-covenant={l.breaches} data-covenant-risk={l.light === 'atRisk' || undefined} className="flex items-center gap-1 text-[13px] font-semibold leading-tight text-ink">
            <Dot color={light.color} size={7} />
            {light.text}
          </dd>
        </div>
      </dl>
    </div>
  )
}
