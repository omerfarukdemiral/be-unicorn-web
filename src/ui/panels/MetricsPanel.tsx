// Metrikler (docs/LAYOUT.md §5): every secondary gauge the learned concepts opened, grouped (Para, Büyüme, Ekip, Yol),
// each with a "pin to the top bar" toggle (max 2, the 3rd evicts the oldest). A pinned card the top bar is drawing
// shows "Üst barda" instead of its value (one home per number); on phones the pins lead the list with their values.
// A newly opened gauge (PLAN Hisset → Adlandır → KULLAN) carries a "Yeni" tag and a brand tint for a few seconds.
// Never pauses (not a pauseReason).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { CONCEPT_TITLE, CONCEPTS } from '../../content'
import type { ConceptId, HudWidget } from '../../engine/types'
import { useGameStore } from '../../store/gameStore'
import { metricSources, metricUnlocked, PIN_MAX, unseenMetrics } from '../../store/metricPins'
import { cashFlow } from '../cashflow'
import { money } from '../format'
import { useIsMobile } from '../hooks'
import { t } from '../i18n'
import { Icon } from '../icons'
import { PIN_VISIBLE } from '../layout/tokens'
import { cx, IconBadge, IconButton, SectionTitle } from '../primitives'
import { WIDGET_COLOR } from '../theme'
import { METRIC_CARDS, METRIC_GROUPS, ledgerMoney, usePinnedMetrics, visiblePins, WidgetChip, WIDGETS, type MetricGroup } from '../widgets'

/** How long a new card keeps its "Yeni" tint, and when it counts as seen (docs/LAYOUT.md §5.1). */
const NEW_TINT_MS = 4000
const SEEN_AFTER_MS = 1500
const FOCUS_MS = 1500

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
      <div className="flex items-start justify-between gap-2">
        <p className="font-text text-xs leading-relaxed text-ink-2">{t('metrics.intro')}</p>
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

      <p className="flex items-center gap-2 rounded-control border border-dashed border-border-strong px-3 py-2.5 text-xs text-ink-2">
        <Icon name={lockedCount > 0 ? 'lock' : 'check'} size={14} className="shrink-0 text-ink-3" />
        <span className="font-text">{lockedCount > 0 ? t('metrics.more', { n: lockedCount }) : t('metrics.allOpen')}</span>
      </p>
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
  const pinLabel = pinned ? t('metrics.unpin') : pins.length >= PIN_MAX ? t('metrics.pinReplace', { old: t(WIDGETS[pins[0]!].labelKey) }) : t('metrics.pin')

  return (
    <div
      data-metric={id}
      className={cx(
        'flex items-start gap-1 rounded-control border px-1 py-1 transition-colors duration-500',
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
      {def.pinnable && (
        <IconButton
          icon="pin"
          label={pinLabel}
          aria-pressed={pinned}
          size={mobile ? 44 : 36}
          onClick={() => (pinned ? unpinMetric(id) : pinMetric(id))}
          // Pinned = quiet brand tint (a solid brand disc per row would shout louder than the numbers).
          className={cx(pinned ? 'bg-brand-soft text-brand-ink hover:bg-brand-soft hover:text-brand-ink' : 'text-ink-3')}
        />
      )}
    </div>
  )
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
    </div>
  )
}
