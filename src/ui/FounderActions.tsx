// Active founder actions as ability slots (docs/GAMEPLAY_V2.md §10.4): energy and cooldown in the garage, the weekly
// move budget from Pre-seed (§7.1), stage locks as grey silhouettes with the stage pill + teaser (§9.4), saturation "½".
// The logic lives here (`useFounderActions`); the bottom bar draws it (layout/FounderBar.tsx): one 44px square per
// action, the hue only on the icon, the name only in the tooltip.
// Colours (docs/LAYOUT.md §4.1): low energy is a WARNING (energy / energy-ink), never red.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { FOUNDER_ACTION_DEFS } from '../engine/balance'
import { founderActionError, refactorDebtCut } from '../engine/founder'
import { FOUNDER_ACTIONS, type ActionErrorCode, type FounderActionKind, type MovesView } from '../engine/types'
import { STAGES, TEASERS } from '../content'
import { panelSelection, useGameStore } from '../store/gameStore'
import { Icon } from './icons'
import { t } from './i18n'
import { Bar, cx } from './primitives'
import { money } from './format'
import { FOUNDER_COLOR, FOUNDER_ICON, founderActionStage, iconTone } from './theme'
import { guidedSlot } from './guidance'

/** "+3–6", or "+1" when both ends are the same (never "+1–1"). */
function range(a: number, b: number, f: (v: number) => string = String): string {
  return a === b ? `+${f(a)}` : `+${f(a)}–${f(b)}`
}

export const LOW_ENERGY = 20
/** Ms a tapped locked slot keeps its teaser up (touch has no hover). */
export const PEEK_MS = 2600

export interface FounderActionView {
  kind: FounderActionKind
  locked: boolean
  disabled: boolean
  running: boolean
  /** 0–1 of the running action done. */
  runFrac: number
  /** 0–1 of the cooldown left. */
  cdFrac: number
  saturated: boolean
  /** The return the saturation badge shows: "½", "¼" or a percent below that ("6%"). */
  satLabel?: string
  /** Return below a quarter: the icon goes ink-3 so the dead lever reads dead (still tappable). */
  dead?: boolean
  /** Moves it takes this week (0 in the garage or for a free action). */
  moves: number
  /** The week's moves do not cover it: still tappable, the engine answers "Haftaya". */
  outOfMoves: boolean
  /** The next step points here (the slot breathes, GAMEPLAY V2 §11). */
  guided: boolean
  /** Locked: the stage that opens it (the pill). */
  stageName: string
  /** Slot name (≤ 2 words, tooltip only). */
  name: string
  /** Long label (aria): the action + why it is unavailable or what it returns. */
  label: string
  /** Tooltip line under the name: the return preview, or the teaser of the stage that opens a locked slot. */
  tip: string
  run: () => void
}

export function useFounderActions(): { energy: number; low: boolean; moves: MovesView | undefined; day: number; actions: FounderActionView[] } {
  const f = useGameStore(
    useShallow((s) => ({
      energy: s.state.founder.energy,
      current: s.state.founder.currentAction,
      cooldowns: s.state.founder.cooldowns,
      stage: s.state.stage,
      day: s.state.time.day,
      over: !!s.state.gameOver,
    })),
  )
  // Same checks the engine runs (energy, missing project…), so buttons never promise an action that fails.
  const errors = useGameStore(
    useShallow((s) => Object.fromEntries(FOUNDER_ACTIONS.map((k) => [k, founderActionError(s.state, k)])) as Record<FounderActionKind, ActionErrorCode | null>),
  )
  // "Elle kullanıcı bul" return preview (monthly saturation, docs/CORE_LOOP.md §5 dont-scale).
  const find = useGameStore(useShallow((s) => s.state.derived.findUsers))
  const findRange = find ? range(find.min, find.max) : ''
  const findText = find
    ? find.reasons.includes('big')
      ? t('founder.findUsers.big', { r: findRange })
      : find.reasons.includes('circle')
        ? t('founder.findUsers.circle', { r: findRange })
        : t('founder.findUsers.preview', { r: findRange, n: find.fullLeft })
    : ''
  const findSaturated = !!find && find.factor < 1
  // "Satış görüşmesi": contract size preview, the month's saturation and the contract length.
  const sales = useGameStore(useShallow((s) => s.state.derived.salesCall))
  const salesText = sales
    ? sales.factor < 1
      ? t('founder.salesCall.saturated', { r: range(sales.min, sales.max, money) })
      : t('founder.salesCall.preview', { r: range(sales.min, sales.max, money), d: sales.contractDays, n: sales.fullLeft })
    : ''
  const salesSaturated = !!sales && sales.factor < 1
  const factorOf = (kind: FounderActionKind): number | undefined => (kind === 'findUsers' ? find?.factor : kind === 'salesCall' ? sales?.factor : undefined)
  // "Refactor sprinti" (GAMEPLAY V2 §4.2): the debt it pays back, from the engine (8 + one per engineer).
  const refactorCut = useGameStore((s) => Math.round(refactorDebtCut(s.state)))
  const refactorText = t('founder.refactorSprint.preview', { n: refactorCut })
  // Talking on a finished product feeds the next update (engine founder.ts), not maturity.
  const allDone = useGameStore((s) => s.state.projects.length > 0 && s.state.projects.every((p) => p.maturity >= 1))
  const moves = useGameStore(useShallow((s) => s.state.derived.moves))
  const guided = useGameStore((s) => guidedSlot(s.state))
  const dispatch = useGameStore((s) => s.dispatch)
  const selection = useGameStore(useShallow((s) => panelSelection(s.ui.panel)))
  const projects = useGameStore(useShallow((s) => s.state.projects))
  // Remember when each cooldown started so the slot line can show the fraction left.
  const cdStart = useRef<Partial<Record<FounderActionKind, { start: number; end: number }>>>({})

  const run = (kind: FounderActionKind) => {
    let targetId: string | undefined
    if (kind === 'talkToUsers') {
      targetId = selection?.kind === 'project' ? selection.id : (projects.find((p) => p.maturity < 1) ?? projects[0])?.id
    }
    dispatch({ type: 'founderAction', kind, targetId })
  }

  const busy = !!f.current && f.current.endDay > f.day
  const actions = FOUNDER_ACTIONS.map((kind): FounderActionView => {
    const unlockStage = founderActionStage(kind)
    const locked = f.stage < unlockStage
    const cdEnd = f.cooldowns[kind]
    let cdFrac = 0
    if (cdEnd !== undefined && cdEnd > f.day) {
      const rec = cdStart.current[kind]
      if (!rec || rec.end !== cdEnd) cdStart.current[kind] = { start: f.day, end: cdEnd }
      const r = cdStart.current[kind]!
      cdFrac = r.end > r.start ? (r.end - f.day) / (r.end - r.start) : 0
    }
    const running = f.current?.kind === kind && busy
    const runFrac = running && f.current ? (f.day - f.current.startDay) / Math.max(0.01, f.current.endDay - f.current.startDay) : 0
    const err = errors[kind]
    const disabled = locked || f.over || cdFrac > 0 || (busy && !running) || (!running && err !== null)
    const outOfMoves = !locked && !f.over && !busy && err === 'noMoves'
    const stageName = STAGES[unlockStage]?.name ?? ''
    const action = t(`founder.${kind}`)
    const label = locked
      ? t('founder.lockedAt', { action, stage: stageName })
      : cdFrac > 0 && cdEnd !== undefined
        ? t('founder.cooldown', { action, d: Math.max(1, Math.ceil(cdEnd - f.day)) })
        : err === 'noEnergy'
          ? t('founder.noEnergy', { action })
          : err === 'noMoves'
            ? t('founder.noMoves', { action })
          : err === 'notFound'
            ? t('founder.noProject', { action })
            : kind === 'findUsers' && findText
              ? `${action}: ${findText}`
              : kind === 'salesCall' && salesText
                ? `${action}: ${salesText}`
                : kind === 'talkToUsers' && allDone
                  ? `${action}: ${t('founder.talkToUsers.update')}`
                  : kind === 'refactorSprint'
                    ? `${action}: ${refactorText}`
                    : `${action}: ${t(`founder.${kind}.desc`)}`
    const tip = locked
      ? (TEASERS[(unlockStage - 1) as keyof typeof TEASERS] ?? '')
      : kind === 'findUsers' && find
        ? t('slot.findTip', { r: findRange })
        : kind === 'salesCall' && sales
          ? t('slot.salesTip', { r: range(sales.min, sales.max, money) })
          : kind === 'refactorSprint'
            ? t('slot.debtCut', { n: refactorCut })
            : ''
    const saturated = !locked && ((kind === 'findUsers' && findSaturated) || (kind === 'salesCall' && salesSaturated))
    return {
      kind,
      locked,
      disabled,
      running,
      runFrac,
      cdFrac,
      saturated,
      ...(saturated ? { satLabel: satLabel(factorOf(kind) ?? 1), dead: (factorOf(kind) ?? 1) < SAT_DEAD && !running } : {}),
      moves: moves ? FOUNDER_ACTION_DEFS[kind].moves : 0,
      outOfMoves,
      guided: guided === kind && !locked,
      stageName,
      name: t(`slot.${kind}`),
      label,
      tip,
      run: () => run(kind),
    }
  })
  return { energy: f.energy, low: f.energy < LOW_ENERGY, moves, day: f.day, actions }
}

/** Below this return the slot's icon greys out (playtest LD3: a 6% find looked as live as a 50% one). */
const SAT_DEAD = 0.25

/** Saturation badge text: the return as "½" / "¼", or a whole percent below a quarter. */
export function satLabel(factor: number): string {
  return factor >= 0.5 ? '½' : factor >= SAT_DEAD ? '¼' : `${Math.round(factor * 100)}%`
}

/** Slot size (px): 44 everywhere (the phone row is 44 tall; touch targets stay ≥ 44, docs/GAMEPLAY_V2.md §10.4). */
export const SLOT = 44

/**
 * One ability slot (docs/GAMEPLAY_V2.md §10.4): a 44px square, icon 22 in the action's hue, the move cost top right
 * (on the budget), saturation "½" / "¼" / "6%" top left (a dead lever greys its icon), running / cooldown as a 2px line along the bottom edge. No visible label:
 * the name (≤ 2 words) lives in the tooltip. Locked = grey silhouette + lock + the unlocking stage's pill; a tap shows
 * the teaser and opens nothing. `tipAlign` keeps tips on screen. `floats`: numbers rising above the slot.
 * Exported pieces are pure props (no store): FloatingNumber.test.tsx renders a slot to a string.
 */
export function FounderSlot({
  a,
  tipAlign = 'center',
  floats,
  onPeek,
}: {
  a: FounderActionView
  tipAlign?: 'left' | 'center'
  floats?: ReactNode
  /** Phones: the row scrolls (it would clip the tip), so the bar shows a tapped locked slot's tip itself. */
  onPeek?: (a: FounderActionView) => void
}) {
  const hue = FOUNDER_COLOR[a.kind]
  const idle = a.disabled && !a.running
  const frac = a.running ? a.runFrac : a.cdFrac > 0 && !a.locked ? 1 - a.cdFrac : null
  const [peek, setPeek] = useState(false)
  useEffect(() => {
    if (!peek) return
    const id = window.setTimeout(() => setPeek(false), PEEK_MS)
    return () => window.clearTimeout(id)
  }, [peek])
  const onClick = () => {
    // Locked: show what opens it, never a panel. Out of moves: the engine answers ("Haftaya", strip 2.6 s).
    if (a.locked) return onPeek ? onPeek(a) : setPeek(true)
    if (a.outOfMoves) return a.run()
    if (!a.disabled) a.run()
  }
  return (
    <span className="relative inline-flex shrink-0">
      {floats}
      <button
        type="button"
        onClick={onClick}
        aria-disabled={a.disabled || undefined}
        aria-label={a.label}
        data-slot={a.kind}
        className={cx(
          'group relative grid shrink-0 place-items-center rounded-control border transition-colors',
          a.locked ? 'border-dashed border-border-strong bg-transparent' : 'border-border bg-surface-2',
          a.running && 'border-border-strong',
          !a.disabled && 'hover:border-border-strong hover:bg-surface active:scale-[0.96]',
          idle && !a.locked && 'bg-transparent',
          a.guided && !a.disabled && 'animate-breathe border-brand',
        )}
        style={{ width: SLOT, height: SLOT }}
      >
        <Icon
          name={FOUNDER_ICON[a.kind]}
          size={a.locked ? 18 : 22}
          className={cx('shrink-0', a.locked ? '-mt-2.5 text-ink-3 opacity-40' : (idle || a.dead) && 'text-ink-3')}
          style={idle || a.dead ? undefined : { color: iconTone(hue) }}
        />
        {a.locked && (
          <>
            <span aria-hidden="true" className="absolute right-0.5 top-0.5 text-ink-2">
              <Icon name="lock" size={11} />
            </span>
            {/* The stage that opens it: a small pill along the bottom edge (inside: the phone row clips). */}
            <span aria-hidden="true" className="tabular absolute bottom-[3px] left-1/2 max-w-[40px] -translate-x-1/2 truncate whitespace-nowrap rounded-full bg-surface-2 px-1 text-[8px] font-bold uppercase leading-3 text-ink-2">
              {a.stageName}
            </span>
          </>
        )}
        {!a.locked && a.moves > 0 && (
          // Move cost (GAMEPLAY V2 §7.1): Nunito figure in the top-right corner.
          <span aria-hidden="true" className={cx('tabular absolute right-[3px] top-[2px] text-[10px] font-bold leading-none', a.outOfMoves ? 'text-ink-3' : 'text-ink-2')}>
            {a.moves}
          </span>
        )}
        {frac !== null && (
          // The one progress treatment: a 2px line along the bottom edge (running in the hue, cooldown in ink).
          <span aria-hidden="true" className="absolute inset-x-1.5 bottom-[3px] h-[2px] overflow-hidden rounded-full bg-border">
            <span className="block h-full rounded-full" style={{ width: `${Math.round(frac * 100)}%`, background: a.running ? hue : 'var(--color-ink-3)' }} />
          </span>
        )}
        {a.saturated && (
          // Saturated: a small amber "½" / "¼" / "6%" so the diminishing return is visible before the click.
          <span aria-hidden="true" className="tabular absolute -left-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-energy-ink px-0.5 text-[9px] font-bold leading-none text-on-ink">
            {a.satLabel ?? '½'}
          </span>
        )}
        <span
          role="tooltip"
          className={cx(
            'pointer-events-none absolute bottom-[calc(100%+8px)] z-20 max-w-[280px] flex-col gap-0.5 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-left text-[11px] font-semibold text-on-ink shadow-pop group-hover:flex group-focus-visible:flex',
            peek ? 'flex' : 'hidden',
            tipAlign === 'left' ? 'left-0' : 'left-1/2 -translate-x-1/2',
          )}
        >
          <span>{a.name}</span>
          {a.tip && <span className="tabular font-medium opacity-80">{a.tip}</span>}
        </span>
      </button>
    </span>
  )
}

/** Weekly moves (GAMEPLAY V2 §7.1, from Pre-seed): pips + "3/4"; the refill day in the title. Empty week = ink-3. */
export function MovesMeter({ moves, day, compact }: { moves: MovesView; day: number; compact?: boolean }) {
  const d = Math.max(1, Math.ceil(moves.resetDay - day))
  const title = t('moves.title', { l: moves.left, t: moves.total, d })
  const empty = moves.left <= 0
  return (
    <div className="flex shrink-0 items-center gap-1.5" title={title} aria-label={title}>
      {!compact && (
        <span aria-hidden="true" className="flex items-center gap-[3px]">
          {Array.from({ length: moves.total }, (_, i) => (
            <span key={i} className={cx('h-3 w-1.5 rounded-[2px]', i < moves.left ? 'bg-brand' : 'bg-border')} />
          ))}
        </span>
      )}
      <span className={cx('tabular text-[13px] font-semibold', empty ? 'text-ink-3' : 'text-ink')}>{t('moves.count', { l: moves.left, t: moves.total })}</span>
    </div>
  )
}

/** Energy: bolt + bar + number. Low (< 20) = warning: amber number + warning icon, no red (§4.1). */
export function EnergyMeter({ energy, low, compact }: { energy: number; low: boolean; compact?: boolean }) {
  const v = Math.round(Math.max(0, Math.min(100, energy)))
  return (
    <div className={cx('flex shrink-0 items-center gap-1.5', compact ? 'w-auto' : 'w-[104px]')} title={low ? t('founder.energyLow') : t('founder.energyValue', { v })} aria-label={t('founder.energyValue', { v })}>
      <Icon name={low ? 'warning' : 'bolt'} size={16} className={cx('shrink-0', low ? 'text-energy-ink' : 'text-energy')} fill={low ? 'none' : 'currentColor'} />
      {!compact && (
        <div className="min-w-0 flex-1">
          <Bar value={v / 100} height={6} color="var(--color-energy)" />
        </div>
      )}
      <span className={cx('tabular min-w-[2ch] text-right text-[13px] font-semibold', low ? 'font-bold text-energy-ink' : 'text-ink')}>{v}</span>
    </div>
  )
}
