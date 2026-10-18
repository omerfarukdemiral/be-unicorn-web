// Notification strip (docs/LAYOUT.md §3): ONE channel, one style, one line, one item at a time, right above the
// bottom bar. Desktop (`island`, T05): no band; a pill above the founder island only while a message is up. Sources: bankruptcy clock (P0), runway falling under 3 months (P0, 6 s), placing mode (P1), errors,
// moments (receipt, release, outcome), activity (P2), and the next step (P3, resting). No achievements: a new gauge,
// concept or goal only badges its home (docs/GAMEPLAY_V2.md §12 D9). At most 2 P2 items a game day; the rest fold
// into a digest counted on the ⌃ button. The one rival item: the lead rival passing the player (`rivalPassed`, P2, once
// per rival in DEDUPE_DAYS); a thread step, a goal or a discovery never reaches the strip (docs/GAMEPLAY_V2.md §9.4).
// Right slot: the horizon as readable text ("Maaş günü 8 gün · Sürüm ~4 gün") + ⌃ popover (upcoming + recent events).
// Rules (priority, queue, merge, 4× timing, de-duplication, daily budget) are pure in stripRules.ts.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { BANKRUPT_DAYS } from '../../engine/balance'
import { FOUNDER_ACTIONS, type ActivityEntry, type ActivityKind, type FounderActionKind, type GameEvent, type GameState } from '../../engine/types'
import { blockingOverlay, useGameStore } from '../../store/gameStore'
import type { Panel } from '../../store/types'
import { Icon, type IconName } from '../icons'
import { STAGES, UI_TEXT } from '../../content'
import { t } from '../i18n'
import { fixed } from '../format'
import { cx } from '../primitives'
import { founderActionStage, soft } from '../theme'
import { useExclusiveExpander } from '../hooks'
import { activityText, ActivityHistory } from '../ActivityLine'
import { errorText, usePlacing } from '../Feedback'
import { HorizonDue, HorizonList, HorizonLoan, HorizonMini, PaydayCountdown } from '../Horizon'
import { useFreshEvents } from '../loopUi'
import { momentLook, MomentLine, momentText, useMomentSource, type Moment } from '../Moments'
import { NextStepChip, useNextStep } from '../NextStepChip'
import {
  activityShown,
  admit,
  enqueue,
  nextHover,
  nextStepShown,
  pickSlot,
  readDigest,
  resetSharedBudget,
  sharedBudget,
  stripClockRuns,
  stripLifeMs,
  stripVisible,
  type TransientKind,
} from './stripRules'
import { STRIP_H, STRIP_H_MOBILE } from './tokens'

type Item =
  | { key: number; kind: Moment['kind']; moment: Moment }
  | { key: number; kind: 'runwayLow'; runway: number }
  | { key: number; kind: 'error'; code: string; action?: string; detail?: string }
  | { key: number; kind: 'activity'; entry: ActivityEntry }
  | RivalItem

/** The lead rival went past the player: a P2 line, de-duplicated per rival for DEDUPE_DAYS by the daily budget. */
export type RivalItem = { key: number; kind: 'activity'; rival: string; dedupeKey: string }

/** Strip items hidden in fresh engine events: only `rivalPassed` (rivalBorn, threads, goals stay off the strip). */
export function rivalPassedItems(events: readonly GameEvent[], s: Pick<GameState, 'rivals'>): RivalItem[] {
  return events
    .filter((e) => e.kind === 'rivalPassed')
    .map((e): RivalItem => ({ key: e.id, kind: 'activity', rival: s.rivals?.find((r) => r.id === e.refId)?.name ?? t('rival.unknown'), dedupeKey: `rivalPassed:${e.refId ?? ''}` }))
}

/**
 * Whether the strip shell is on screen. A shell only exists while it holds something to read: a message (`content`),
 * the horizon (rows only) or the open history. Under a blocking modal (stage-up, move scene) it steps away; the front
 * item keeps its time (stripClockRuns) and comes back with the world. QA: an empty white pill under every stage-up.
 */
export function stripShellShown(p: { visible: boolean; content: boolean; horizon: boolean; more: boolean; overlay: boolean }): boolean {
  if (p.overlay) return false
  if (p.more) return true
  return p.visible && (p.content || p.horizon)
}

/** Shell exit: the strip fades out instead of blinking away (ms). */
const STRIP_EXIT_MS = 180

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Entry motion through WAAPI with no fill: a CSS `both` fill parks the text at opacity 0 while the animation waits
 * for its first frame (QA: a busy frame under a paused scene left a blank pill for seconds). Here the resting style
 * stays opaque, and the shell fades in as a whole: a stalled start hides the whole pill, never only its text.
 * Module-level (stable) so the ref runs once per mount.
 */
const fadeInShell = (el: HTMLElement | null) => {
  if (el && !reducedMotion()) el.animate?.([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' })
}
// The first keyframe is still a legible line: on a slow device the timeline can sit on it for a few frames, and the old
// 35% / 14px start read as faint text cut off by the card's bottom edge (QA "empty white pill").
const riseInRow = (el: HTMLElement | null) => {
  if (el && !reducedMotion()) el.animate?.([{ opacity: 0.7, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' })
}

/** True while `on`, and for `ms` after it turns off (the exit fade keeps the last frame on screen). */
function useLinger(on: boolean, ms: number): boolean {
  const [linger, setLinger] = useState(on)
  useEffect(() => {
    if (on) {
      setLinger(true)
      return
    }
    const id = window.setTimeout(() => setLinger(false), ms)
    return () => window.clearTimeout(id)
  }, [on, ms])
  return on || linger
}

/** Keys for non-engine items (errors, runway, activity) never collide with engine event ids. */
let localKey = -1
const nextKey = () => localKey--

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
      const text = errorLine(item)
      return { icon: 'warning', color: 'var(--color-energy)', title: text, panel: null, body: <span className="font-semibold text-ink">{text}</span> }
    }
    case 'activity': {
      if ('rival' in item) {
        const text = t('rival.passed', { name: item.rival })
        return { icon: 'flag', color: 'var(--color-kind-decision)', title: text, panel: null, body: <span className="font-semibold text-ink">{text}</span> }
      }
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

/**
 * "İşe alım: Masasız." A founder action names itself, and a locked one its stage ("Ekibi motive et Pre-seed aşamasında
 * açılır"): "Kurucu aksiyonu: Kilitli." told the player nothing (QA).
 */
function errorLine(item: { code: string; action?: string; detail?: string }): string {
  const founder = item.action === 'founderAction' && item.detail && (FOUNDER_ACTIONS as readonly string[]).includes(item.detail) ? (item.detail as FounderActionKind) : null
  if (founder && item.code === 'notUnlocked') return t('founder.lockedAt', { action: t(`founder.${founder}`), stage: STAGES[founderActionStage(founder)]?.name ?? '' })
  const subject = founder ? t(`founder.${founder}`) : item.action ? UI_TEXT[`actionSubject.${item.action}`] : undefined
  return subject ? `${subject}: ${errorText(item.code)}` : errorText(item.code)
}

/** Lets items through the day's budget (shared with the office lines); the rest go to the digest or are dropped. */
function budgeted(add: readonly Item[]): Item[] {
  const day = useGameStore.getState().state.time.day
  return add.filter((item) => {
    const [verdict, next] = admit(sharedBudget.current, item, day)
    sharedBudget.current = next
    return verdict === 'show'
  })
}

/** Feeds engine events, errors, runway and activity into the queue (through the daily budget). Returns the digest count too. */
/** `island` (desktop): the month receipt is left to the money island's payday card. */
function useStripQueue(island = false): [Item[], (key: number) => void, number, () => void] {
  const [queue, setQueue] = useState<Item[]>([])
  const [digest, setDigest] = useState(0)
  const recent = useRef<{ kind: TransientKind; at: number }[]>([])
  const generation = useGameStore((s) => s.ui.generation)
  const fast = () => useGameStore.getState().state.time.speed >= 4
  const admitAll = (add: readonly Item[]): Item[] => {
    const out = budgeted(add)
    setDigest(sharedBudget.current.digest)
    return out
  }
  const push = (fresh: Item[]) => {
    const now = performance.now()
    for (const a of fresh) if (a.kind !== 'activity') recent.current.push({ kind: a.kind, at: now })
    recent.current = recent.current.filter((r) => now - r.at < 4000)
    const add = admitAll(fresh)
    if (add.length) setQueue((cur) => enqueue(cur, add, { fast: fast() }))
  }

  // Moments (engine events). Desktop (`island`): the month receipt is the money island's payday card (T09), not a pill.
  useMomentSource((ms) => push(ms.filter((m) => !(island && m.kind === 'receipt')).map((moment): Item => ({ key: moment.key, kind: moment.kind, moment }))))

  // The lead rival passing the player (the one rival line; its dedupe key holds it to once a month per rival).
  useFreshEvents((events, s) => {
    const add = rivalPassedItems(events, s)
    if (add.length) push(add)
  })

  // Rejected action.
  const lastError = useGameStore((s) => s.ui.lastError)
  const seenError = useRef(lastError?.at ?? 0)
  useEffect(() => {
    if (!lastError || lastError.at === seenError.current) return
    seenError.current = lastError.at
    // 'notFound' is a stale tap (the thing just left: a card answered, a candidate gone): nothing to tell.
    if (lastError.code === 'notFound') return
    push([{ key: nextKey(), kind: 'error', code: lastError.code, action: lastError.action, detail: lastError.detail }])
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

  // Activity: the listed kinds, unless a moment just told the same story.
  const activity = useGameStore(useShallow((s) => s.state.activity))
  const prevActivity = useRef<{ gen: number; id: number } | null>(null)
  useEffect(() => {
    const lastId = activity[activity.length - 1]?.id ?? 0
    const p = prevActivity.current
    prevActivity.current = { gen: generation, id: lastId }
    if (!p || p.gen !== generation || lastId <= p.id) return
    const now = performance.now()
    const add = admitAll(activity.filter((e) => e.id > p.id && activityShown(e.kind, recent.current, now)).map((entry): Item => ({ key: nextKey(), kind: 'activity', entry })))
    if (add.length) setQueue((cur) => enqueue(cur, add, { fast: fast() }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity, generation])

  // A new run starts with an empty strip and a fresh budget.
  useEffect(() => {
    setQueue([])
    resetSharedBudget(useGameStore.getState().state.time.day)
    setDigest(0)
  }, [generation])

  const readAll = () => {
    sharedBudget.current = readDigest(sharedBudget.current)
    setDigest(0)
  }
  return [queue, (key) => setQueue((cur) => cur.filter((x) => x.key !== key)), digest, readAll]
}

/**
 * The strip. `mobile`: h36, compact horizon badge. `sheetOpen` (phone sheet up): the resting next step hides,
 * P0–P2 still show. Renders nothing (after a short fade) when there is nothing to read or a blocking modal is up
 * (stripShellShown; the space stays reserved by BottomStack).
 */
export function NotificationStrip({
  mobile = false,
  sheetOpen = false,
  island = false,
  className,
}: {
  mobile?: boolean
  sheetOpen?: boolean
  /** Desktop "dört köşe" (T05): no resting band. Only P0–P2 messages show, as a content-width pill; the next step
   *  lives under the stage island (TopBar › GoalChip) and the horizon in the money island (MoneyIsland). */
  island?: boolean
  className?: string
}) {
  const [queue, drop, digest, readAll] = useStripQueue(island)
  const bankrupt = useGameStore(useShallow((s) => (s.state.finance.payrollMissed && !s.state.gameOver ? { days: Math.max(0, BANKRUPT_DAYS - s.state.finance.negativeCashDays) } : null)))
  const placing = usePlacing()
  const step = useNextStep()
  const speed = useGameStore((s) => s.state.time.speed)
  const openPanel = useGameStore((s) => s.openPanel)
  const hasHorizon = useGameStore((s) => !!s.state.derived.horizon?.length)
  const [hold, setHold] = useState(false)
  const [more, setMoreRaw] = useExclusiveExpander()
  // Opening the history popover reads the digest.
  const setMore: typeof setMoreRaw = (v) => {
    readAll()
    setMoreRaw(v)
  }

  const showStep = nextStepShown({
    hasStep: !!step.step,
    startCall: step.startCall,
    stepId: step.step?.id,
    canStartRound: step.canStartRound,
    over: step.over,
    sheetOpen,
  }) && !island
  const front = queue[0]
  const slot = pickSlot({ bankrupt: !!bankrupt, placing: !!placing, nextStep: showStep, front })
  // A center screen leaves the strip readable (time flows under it); only a blocking modal covers it.
  const overlay = useGameStore((s) => blockingOverlay(s.ui) !== null)

  // A strip that unmounts under the cursor gets no mouseleave: drop the stale hover (else later items freeze).
  // A blocking modal hides the strip: its hover goes with it.
  const hover = nextHover(hold, slot, sheetOpen) && !overlay
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

  // Phones: a message owns the row while it speaks (QA 390px: "Yayınd…" next to a full-width "1g $645K ✓"); the
  // horizon comes back with the resting next step and stays in the ⌃ popover meanwhile.
  const horizon = hasHorizon && !island && !(mobile && (slot === 'queue' || slot === 'bankrupt'))

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
  } else if (slot === 'nextStep' && step.step && !step.over) {
    // Same guard as the chip's own `return null`: a JSX element that renders nothing must not count as content.
    content = <NextStepChip variant="strip" compact={mobile} />
  }

  // Nothing to read (no message, no horizon, no history) → no shell: never an empty white pill or a bare ⌃ row.
  const shown = stripShellShown({ visible: stripVisible(slot, sheetOpen), content: content !== null, horizon, more, overlay })
  return (
    <StripShell shown={shown} className={cx(island ? 'w-auto min-w-[320px]' : 'w-full', className)} onHold={setHold}>
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
        // No @container on the desktop pill: inline-size containment gives it no intrinsic width, so it sat at its
        // 320px minimum and cut the sentence ("MRR +$…") with room to spare. Only the horizon variants query it.
        className={cx('ui-card relative flex items-center gap-2 overflow-hidden pl-2', island ? 'pr-3' : '@container pr-1', danger && 'border-negative/60')}
        style={{ height: h }}
      >
        {/* Nothing to say on the left (no step, no message): the horizon takes the row instead of an empty half. */}
        {/* flex-auto (basis = the text): a content-width desktop pill sizes to its sentence instead of collapsing to min-w. */}
        {/* Phones: basis 0 and at least 42% of the row, so the two-line step (N9) and the payday countdown share it. */}
        {content !== null ? <div className={cx('relative flex h-full min-w-0 items-center', mobile ? 'min-w-[42%] flex-1 basis-0' : 'flex-auto')}>{content}</div> : <span className="flex-1" />}
        {horizon && (
          <>
            {content !== null && <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border" />}
            <HorizonDue />
            <PaydayCountdown compact={mobile} />
            <HorizonLoan />
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
        {!island && (
          <button
            type="button"
            onClick={() => setMore((o) => !o)}
            aria-expanded={more}
            aria-label={t('strip.more')}
            title={t('strip.more')}
            className={cx('relative grid shrink-0 place-items-center rounded-md text-ink-2 hover:bg-surface-2 hover:text-ink', mobile ? 'size-11' : 'size-8')}
          >
            <Icon name={more ? 'chevronDown' : 'chevronUp'} size={16} />
            {digest > 0 && !more && (
              <span aria-hidden="true" className="tabular pointer-events-none absolute -right-0.5 -top-0.5 rounded-full bg-surface-2 px-1 text-[9px] font-bold leading-[14px] text-ink-2 ring-1 ring-border">
                {t('strip.digest', { n: digest })}
              </span>
            )}
          </button>
        )}
        {slot === 'queue' && <span ref={bar} aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-ink/15" />}
      </div>
    </StripShell>
  )
}

/**
 * The strip's outer box: mounts with a fade-in, and on `shown` → false keeps its last frame for STRIP_EXIT_MS while it
 * fades out (inert), then unmounts. The frozen frame is the last one that had something to say.
 */
function StripShell({ shown, className, onHold, children }: { shown: boolean; className?: string; onHold: (hold: boolean) => void; children: ReactNode }) {
  const present = useLinger(shown, STRIP_EXIT_MS)
  const last = useRef<ReactNode>(null)
  if (shown) last.current = children
  if (!present) return null
  return (
    <div
      ref={fadeInShell}
      className={cx('relative', shown ? 'pointer-events-auto' : 'pointer-events-none', className)}
      style={{ opacity: shown ? 1 : 0, transition: `opacity ${STRIP_EXIT_MS}ms ease-out` }}
      aria-hidden={shown ? undefined : true}
      inert={!shown}
      // Mouse only: a tap fires enter without a reliable leave, so touch never holds the clock.
      onPointerEnter={(e) => shown && e.pointerType === 'mouse' && onHold(true)}
      onPointerLeave={() => onHold(false)}
    >
      {shown ? children : last.current}
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
    <button type="button" ref={animate ? riseInRow : undefined} onClick={onClick} title={title} className="flex h-full min-w-0 flex-auto items-center gap-2 text-left">
      <IconTile icon={icon} color={color} />
      <span className="min-w-0 flex-auto truncate text-[13px] leading-none">{children}</span>
    </button>
  )
}
