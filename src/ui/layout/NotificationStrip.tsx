// Notification strip (docs/LAYOUT.md §3): ONE channel, one style, one line, one item at a time, right above the
// bottom bar. Sources: bankruptcy clock (P0), runway falling under 3 months (P0, 6 s), placing mode (P1), errors,
// moments (receipt, release, outcome, goal, round beats), new metric, activity (P2), and the next step (P3, resting).
// Right slot: the horizon as readable text ("Maaş günü 8 gün · Sürüm ~4 gün") + ⌃ popover (upcoming + recent events).
// Rules (priority, queue, merge, 4× timing, de-duplication) are pure in stripRules.ts.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { BANKRUPT_DAYS } from '../../engine/balance'
import type { ActivityEntry, ActivityKind, HudWidget } from '../../engine/types'
import { useGameStore } from '../../store/gameStore'
import type { Panel } from '../../store/types'
import { canonicalMetric, effectivePins } from '../../store/metricPins'
import { Icon, type IconName } from '../icons'
import { t } from '../i18n'
import { fixed } from '../format'
import { cx } from '../primitives'
import { soft } from '../theme'
import { useExclusiveExpander } from '../hooks'
import { WIDGETS } from '../widgets'
import { activityText, ActivityHistory } from '../ActivityLine'
import { errorText, usePlacing } from '../Feedback'
import { HorizonList, HorizonMini } from '../Horizon'
import { momentLook, MomentLine, momentText, useMomentSource, type Moment } from '../Moments'
import { NextStepChip, useNextStep } from '../NextStepChip'
import { activityShown, enqueue, nextHover, nextStepShown, pickSlot, stripClockRuns, stripLifeMs, stripVisible, type TransientKind } from './stripRules'
import { STRIP_H, STRIP_H_MOBILE } from './tokens'

type Item =
  | { key: number; kind: Moment['kind']; moment: Moment }
  | { key: number; kind: 'runwayLow'; runway: number }
  | { key: number; kind: 'error'; code: string }
  | { key: number; kind: 'newMetric'; id: HudWidget; where: 'pinned' | 'top' | 'listed' }
  | { key: number; kind: 'activity'; entry: ActivityEntry }

/** Keys for non-engine items (errors, runway, metrics) never collide with engine event ids. */
let localKey = -1
const nextKey = () => localKey--

const TOP_BAR: ReadonlySet<HudWidget> = new Set<HudWidget>(['cash', 'users', 'morale', 'runway'])

/** Registry label of a gauge (labelKey once the Metrikler registry has it, else the widget name table). */
export function metricLabel(id: HudWidget): string {
  const def = WIDGETS[id]
  return 'labelKey' in def && typeof def.labelKey === 'string' ? t(def.labelKey) : t(`widget.${id}`)
}

function activityPanel(kind: ActivityKind): Panel | null {
  switch (kind) {
    case 'hired':
    case 'fired':
    case 'resigned':
    case 'resignWarning':
    case 'retained':
      return { kind: 'team' }
    case 'projectLaunched':
      return { kind: 'projects' }
    case 'roundStarted':
    case 'roundClosed':
    case 'roundShrunk':
      return { kind: 'growth', section: 'round' }
    case 'milestone':
    case 'enterpriseWon':
    case 'enterpriseLost':
      return { kind: 'growth' }
    default:
      return null
  }
}

interface Look {
  icon: IconName
  color: string
  body: ReactNode
  title: string
  panel: Panel | null
  danger?: boolean
}

function lookOf(item: Item): Look {
  switch (item.kind) {
    case 'runwayLow': {
      const text = t('strip.runwayLow', { v: fixed(item.runway, 1) })
      return {
        icon: 'hourglass',
        color: 'var(--color-negative)',
        danger: true,
        title: text,
        panel: { kind: 'metrics', focus: 'profitProjection' },
        body: (
          <>
            <span className="font-semibold text-negative-ink">{text}</span>
            <span className="text-ink-2"> · {t('strip.runwayLowSub')}</span>
          </>
        ),
      }
    }
    case 'error': {
      const text = errorText(item.code)
      return { icon: 'warning', color: 'var(--color-energy)', title: text, panel: null, body: <span className="font-semibold text-ink">{text}</span> }
    }
    case 'newMetric': {
      const name = metricLabel(item.id)
      const where = t(`strip.newMetric.${item.where}`)
      return {
        icon: WIDGETS[item.id].icon,
        color: 'var(--color-brand)',
        title: `${t('strip.newMetric', { name })} · ${where}`,
        panel: TOP_BAR.has(item.id) ? null : { kind: 'metrics', focus: canonicalMetric(item.id) },
        body: (
          <>
            <span className="font-semibold text-ink">{t('strip.newMetric', { name })}</span>
            <span className="text-brand-ink"> · {where}</span>
          </>
        ),
      }
    }
    case 'activity': {
      const text = activityText(item.entry)
      return { icon: 'sparkle', color: 'var(--color-ink-2)', title: text, panel: activityPanel(item.entry.kind), body: <span className="font-text text-ink">{text}</span> }
    }
    default: {
      const m = item.moment
      const { icon, color, panel } = momentLook(m)
      return { icon, color, panel, title: momentText(m), body: <MomentLine m={m} /> }
    }
  }
}

/** Feeds engine events, errors, runway and newly unlocked metrics into the queue. */
function useStripQueue(): [Item[], (key: number) => void] {
  const [queue, setQueue] = useState<Item[]>([])
  const recent = useRef<{ kind: TransientKind; at: number }[]>([])
  const generation = useGameStore((s) => s.ui.generation)
  const fast = () => useGameStore.getState().state.time.speed >= 4
  const push = (add: Item[]) => {
    const now = performance.now()
    for (const a of add) if (a.kind !== 'activity') recent.current.push({ kind: a.kind, at: now })
    recent.current = recent.current.filter((r) => now - r.at < 4000)
    setQueue((cur) => enqueue(cur, add, { fast: fast() }))
  }

  // Moments (engine events).
  useMomentSource((ms) => push(ms.map((moment): Item => ({ key: moment.key, kind: moment.kind, moment }))))

  // Rejected action.
  const lastError = useGameStore((s) => s.ui.lastError)
  const seenError = useRef(lastError?.at ?? 0)
  useEffect(() => {
    if (!lastError || lastError.at === seenError.current) return
    seenError.current = lastError.at
    push([{ key: nextKey(), kind: 'error', code: lastError.code }])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastError])

  // Runway falls under 3 months (the moment of crossing; afterwards only the top bar stays red).
  const runway = useGameStore((s) => s.state.finance.runway)
  const prevRunway = useRef<{ gen: number; v: number | null } | null>(null)
  useEffect(() => {
    const p = prevRunway.current
    prevRunway.current = { gen: generation, v: runway }
    if (!p || p.gen !== generation) return
    const wasSafe = p.v === null || p.v >= 3
    if (wasSafe && runway !== null && runway < 3) push([{ key: nextKey(), kind: 'runwayLow', runway }])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runway, generation])

  // Newly unlocked metrics (PLAN Hisset → Adlandır → Kullan): announced once, with where they live now.
  const unlocked = useGameStore(useShallow((s) => s.state.unlockedWidgets))
  const prevUnlocked = useRef<{ gen: number; ids: readonly HudWidget[] } | null>(null)
  useEffect(() => {
    const p = prevUnlocked.current
    prevUnlocked.current = { gen: generation, ids: unlocked }
    if (!p || p.gen !== generation) return
    const fresh = unlocked.filter((id) => !p.ids.includes(id) && WIDGETS[id].group !== 'hidden')
    if (!fresh.length) return
    const { ui, state } = useGameStore.getState()
    const pins = effectivePins(ui.pinnedMetrics, state.unlockedWidgets)
    push(
      fresh.map((id): Item => ({
        key: nextKey(),
        kind: 'newMetric',
        id,
        where: TOP_BAR.has(id) ? 'top' : pins.includes(canonicalMetric(id)) ? 'pinned' : 'listed',
      })),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, generation])

  // Activity: the listed kinds, unless a moment just told the same story.
  const activity = useGameStore(useShallow((s) => s.state.activity))
  const prevActivity = useRef<{ gen: number; id: number } | null>(null)
  useEffect(() => {
    const lastId = activity[activity.length - 1]?.id ?? 0
    const p = prevActivity.current
    prevActivity.current = { gen: generation, id: lastId }
    if (!p || p.gen !== generation || lastId <= p.id) return
    const now = performance.now()
    const add = activity.filter((e) => e.id > p.id && activityShown(e.kind, recent.current, now)).map((entry): Item => ({ key: nextKey(), kind: 'activity', entry }))
    if (add.length) setQueue((cur) => enqueue(cur, add, { fast: fast() }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity, generation])

  // A new run starts with an empty strip.
  useEffect(() => setQueue([]), [generation])

  return [queue, (key) => setQueue((cur) => cur.filter((x) => x.key !== key))]
}

/**
 * The strip. `mobile`: h36, compact horizon badge. `sheetOpen` (phone sheet up): the resting next step hides,
 * P0–P2 still show. Renders nothing when there is nothing to say (the space stays reserved by BottomStack).
 */
export function NotificationStrip({ mobile = false, sheetOpen = false, className }: { mobile?: boolean; sheetOpen?: boolean; className?: string }) {
  const [queue, drop] = useStripQueue()
  const bankrupt = useGameStore(useShallow((s) => (s.state.finance.payrollMissed && !s.state.gameOver ? { days: Math.max(0, BANKRUPT_DAYS - s.state.finance.negativeCashDays) } : null)))
  const placing = usePlacing()
  const step = useNextStep()
  const speed = useGameStore((s) => s.state.time.speed)
  const openPanel = useGameStore((s) => s.openPanel)
  const hasHorizon = useGameStore((s) => !!s.state.derived.horizon?.length)
  const [hold, setHold] = useState(false)
  const [more, setMore] = useExclusiveExpander()

  const showStep = nextStepShown({
    hasStep: !!step.step,
    startCall: step.startCall,
    stepId: step.step?.id,
    canStartRound: step.canStartRound,
    over: step.over,
    sheetOpen,
  })
  const front = queue[0]
  const slot = pickSlot({ bankrupt: !!bankrupt, placing: !!placing, nextStep: showStep, front })
  const overlay = useGameStore((s) => s.ui.overlay !== null)

  // A strip that unmounts under the cursor gets no mouseleave: drop the stale hover (else later items freeze).
  const hover = nextHover(hold, slot, sheetOpen)
  useEffect(() => {
    if (hold && !hover) setHold(false)
  }, [hold, hover])

  // Life of the front item: runs only while it is on screen, not mouse-hovered and not under a full-screen overlay;
  // a displaced item keeps its time.
  const left = useRef(new Map<number, number>())
  const bar = useRef<HTMLSpanElement>(null)
  const running = stripClockRuns({ slot, hasFront: !!front, hover, overlay })
  useEffect(() => {
    if (!running || !front) return
    const key = front.key
    const remaining = left.current.get(key) ?? stripLifeMs(front.kind, speed)
    const start = performance.now()
    let done = false
    const anim = bar.current?.animate([{ transform: `scaleX(${remaining / stripLifeMs(front.kind, speed)})` }, { transform: 'scaleX(0)' }], { duration: remaining, fill: 'forwards' })
    const id = window.setTimeout(() => {
      done = true
      left.current.delete(key)
      drop(key)
    }, remaining)
    return () => {
      window.clearTimeout(id)
      anim?.pause()
      if (!done) left.current.set(key, Math.max(0, remaining - (performance.now() - start)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, front?.key])

  if (!stripVisible(slot, sheetOpen) && !more) return null

  const h = mobile ? STRIP_H_MOBILE : STRIP_H
  let content: ReactNode = null
  let danger = false
  let live: 'polite' | 'assertive' = 'polite'
  if (slot === 'bankrupt' && bankrupt) {
    danger = true
    live = 'assertive'
    content = (
      <Row icon="warning" color="var(--color-negative)" title={t('strip.bankrupt', { d: bankrupt.days })} onClick={() => openPanel({ kind: 'metrics' }, { root: true })}>
        <span className="tabular font-semibold text-negative-ink">{t('strip.bankrupt', { d: bankrupt.days })}</span>
        {!mobile && <span className="text-ink-2"> · {t('strip.bankruptSub')}</span>}
      </Row>
    )
  } else if (slot === 'placing' && placing) {
    content = (
      <div className="flex h-full min-w-0 flex-1 items-center gap-2">
        <IconTile icon="move" color="var(--color-brand)" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink" title={placing.text}>
          {placing.text}
        </span>
        <button type="button" onClick={placing.cancel} className="inline-flex h-7 shrink-0 items-center rounded-[8px] border border-border-strong px-2.5 text-[12px] font-semibold text-ink hover:bg-surface-2">
          {t('common.cancel')}
        </button>
      </div>
    )
  } else if (slot === 'queue' && front) {
    const look = lookOf(front)
    danger = !!look.danger
    if (danger) live = 'assertive'
    content = (
      <Row
        key={front.key}
        icon={look.icon}
        color={look.color}
        title={look.title}
        animate
        onClick={() => {
          if (look.panel) openPanel(look.panel, { root: true })
          left.current.delete(front.key)
          drop(front.key)
        }}
      >
        {look.body}
      </Row>
    )
  } else if (slot === 'nextStep') {
    content = <NextStepChip variant="strip" compact={mobile} />
  }

  return (
    <div
      className={cx('pointer-events-auto relative w-full', className)}
      // Mouse only: a tap fires enter without a reliable leave, so touch never holds the clock.
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHold(true)}
      onPointerLeave={() => setHold(false)}
    >
      {more && (
        <div className="ui-card ui-scroll absolute bottom-[calc(100%+8px)] right-0 z-10 max-h-[280px] w-[min(360px,100%)] animate-slide-up overflow-y-auto p-1">
          <p className="ui-label px-2 pb-1 pt-1.5">{t('strip.upcoming')}</p>
          <HorizonList />
          <div className="my-1 h-px bg-border" />
          <p className="ui-label px-2 pb-1 pt-1.5">{t('strip.recent')}</p>
          <ActivityHistory />
        </div>
      )}
      <div
        role={danger ? 'alert' : 'status'}
        aria-live={live}
        aria-label={t('strip.label')}
        className={cx('@container ui-card relative flex items-center gap-2 overflow-hidden pl-2 pr-1', danger && 'border-negative/60')}
        style={{ height: h }}
      >
        <div className="relative flex h-full min-w-0 flex-1 items-center">{content}</div>
        {hasHorizon && (
          <>
            <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border" />
            <button type="button" onClick={() => setMore((o) => !o)} className="flex h-full min-w-0 max-w-[40%] shrink items-center rounded-md px-1 hover:bg-surface-2" aria-label={t('strip.more')}>
              {mobile ? (
                <HorizonMini compact />
              ) : (
                <>
                  {/* Display toggled on wrappers: HorizonMini's own inline-flex would fight a `hidden` passed in. */}
                  <span className="hidden min-w-0 @min-[640px]:flex">
                    <HorizonMini max={2} />
                  </span>
                  <span className="flex min-w-0 @min-[640px]:hidden">
                    <HorizonMini compact />
                  </span>
                </>
              )}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => setMore((o) => !o)}
          aria-expanded={more}
          aria-label={t('strip.more')}
          title={t('strip.more')}
          className={cx('grid shrink-0 place-items-center rounded-md text-ink-2 hover:bg-surface-2 hover:text-ink', mobile ? 'size-11' : 'size-8')}
        >
          <Icon name={more ? 'chevronDown' : 'chevronUp'} size={16} />
        </button>
        {slot === 'queue' && <span ref={bar} aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-ink/15" />}
      </div>
    </div>
  )
}

function IconTile({ icon, color }: { icon: IconName; color: string }) {
  return (
    <span className="grid size-6 shrink-0 place-items-center rounded-[7px]" style={{ color, background: soft(color, 16) }}>
      <Icon name={icon} size={14} />
    </span>
  )
}

function Row({ icon, color, title, children, onClick, animate }: { icon: IconName; color: string; title: string; children: ReactNode; onClick?: () => void; animate?: boolean }) {
  return (
    <button type="button" onClick={onClick} title={title} className={cx('flex h-full min-w-0 flex-1 items-center gap-2 text-left', animate && 'animate-slide-up')}>
      <IconTile icon={icon} color={color} />
      <span className="min-w-0 flex-1 truncate text-[13px] leading-none">{children}</span>
    </button>
  )
}
