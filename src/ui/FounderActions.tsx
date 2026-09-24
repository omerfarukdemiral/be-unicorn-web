// Active founder actions (PLAN §4.4): energy, cooldown rings, stage locks, saturation "½".
// The logic lives here (`useFounderActions`); the bottom bar draws it (layout/FounderBar.tsx, docs/LAYOUT.md §1):
// labelled chips on desktop (icon + short label), icons on phones; one neutral shape, the hue only on the icon.
// Colours (docs/LAYOUT.md §4.1): low energy is a WARNING (energy / energy-ink), never red.
import { useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { founderActionError } from '../engine/founder'
import { FOUNDER_ACTIONS, type ActionErrorCode, type FounderActionKind } from '../engine/types'
import { STAGES } from '../content'
import { panelSelection, useGameStore } from '../store/gameStore'
import { Icon } from './icons'
import { t } from './i18n'
import { Bar, cx, Ring } from './primitives'
import { money } from './format'
import { FOUNDER_COLOR, FOUNDER_ICON, founderActionStage, iconTone } from './theme'

/** "+3–6", or "+1" when both ends are the same (never "+1–1"). */
function range(a: number, b: number, f: (v: number) => string = String): string {
  return a === b ? `+${f(a)}` : `+${f(a)}–${f(b)}`
}

export const LOW_ENERGY = 20

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
  /** Long label (tooltip, aria): the action + why it is unavailable or what it returns. */
  label: string
  /** Short visible hover tip. */
  tip: string
  run: () => void
}

export function useFounderActions(): { energy: number; low: boolean; actions: FounderActionView[] } {
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
  // Talking on a finished product feeds the next update (engine founder.ts), not maturity.
  const allDone = useGameStore((s) => s.state.projects.length > 0 && s.state.projects.every((p) => p.maturity >= 1))
  const dispatch = useGameStore((s) => s.dispatch)
  const selection = useGameStore(useShallow((s) => panelSelection(s.ui.panel)))
  const projects = useGameStore(useShallow((s) => s.state.projects))
  // Remember when each cooldown started so the ring can show the fraction left.
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
    const action = t(`founder.${kind}`)
    const label = locked
      ? t('founder.lockedAt', { action, stage: STAGES[unlockStage]?.name ?? '' })
      : cdFrac > 0 && cdEnd !== undefined
        ? t('founder.cooldown', { action, d: Math.max(1, Math.ceil(cdEnd - f.day)) })
        : err === 'noEnergy'
          ? t('founder.noEnergy', { action })
          : err === 'notFound'
            ? t('founder.noProject', { action })
            : kind === 'findUsers' && findText
              ? `${action}: ${findText}`
              : kind === 'salesCall' && salesText
                ? `${action}: ${salesText}`
                : kind === 'talkToUsers' && allDone
                  ? `${action}: ${t('founder.talkToUsers.update')}`
                  : `${action}: ${t(`founder.${kind}.desc`)}`
    const tip = locked ? label : kind === 'findUsers' && findText ? findText : kind === 'salesCall' && salesText ? salesText : action
    const saturated = !locked && ((kind === 'findUsers' && findSaturated) || (kind === 'salesCall' && salesSaturated))
    return { kind, locked, disabled, running, runFrac, cdFrac, saturated, label, tip, run: () => run(kind) }
  })
  return { energy: f.energy, low: f.energy < LOW_ENERGY, actions }
}

/**
 * One action. `chip`: h40 icon + short label (desktop bottom bar); `icon`: 44 round icon (phones, landscape).
 * One neutral family (docs/DESIGN.md: neutral surfaces + indicator colour): every action, available or not, is the
 * same surface-2 shape; the action's hue is only on its icon. Running / cooldown = one 2px line along the bottom
 * edge (chip) or a ring (icon); a locked action keeps the same shape with a lock icon. `tipAlign` keeps tips on screen.
 */
export function FounderActionButton({ a, variant, tipAlign = 'center' }: { a: FounderActionView; variant: 'chip' | 'icon'; tipAlign?: 'left' | 'center' }) {
  const hue = FOUNDER_COLOR[a.kind]
  const chip = variant === 'chip'
  const size = chip ? 40 : 44
  const idle = a.disabled && !a.running
  const frac = a.running ? a.runFrac : a.cdFrac > 0 && !a.locked ? 1 - a.cdFrac : null
  return (
    <button
      type="button"
      onClick={a.run}
      disabled={a.disabled}
      aria-label={a.label}
      title={chip ? undefined : a.label}
      className={cx(
        'group relative inline-flex shrink-0 items-center justify-center border border-border bg-surface-2 transition-colors',
        chip ? 'gap-1.5 rounded-control pl-2.5 pr-3' : 'rounded-full',
        a.running && 'border-border-strong',
        !a.disabled && 'hover:border-border-strong hover:bg-surface active:scale-[0.97]',
        idle && 'bg-transparent',
      )}
      style={{ height: size, ...(chip ? null : { width: size }) }}
    >
      {!chip && frac !== null && <Ring value={a.running ? a.runFrac : a.cdFrac} size={size} stroke={2} tone={a.running ? hue : 'var(--color-ink-3)'} />}
      <Icon
        name={a.locked ? 'lock' : FOUNDER_ICON[a.kind]}
        size={chip ? 18 : 20}
        className={cx('shrink-0', idle && 'text-ink-3')}
        style={idle ? undefined : { color: iconTone(hue) }}
      />
      {chip && <span className={cx('whitespace-nowrap text-[13px] font-semibold', idle ? 'text-ink-3' : 'text-ink')}>{t(`founder.short.${a.kind}`)}</span>}
      {chip && frac !== null && (
        // The one progress treatment on chips: a 2px line along the bottom edge (running in the hue, cooldown in ink).
        <span aria-hidden="true" className="absolute inset-x-2 bottom-[3px] h-[2px] overflow-hidden rounded-full bg-border">
          <span className="block h-full rounded-full" style={{ width: `${Math.round(frac * 100)}%`, background: a.running ? hue : 'var(--color-ink-3)' }} />
        </span>
      )}
      {a.saturated && (
        // Saturated: a small amber "½" so the diminishing return is visible before the click.
        <span aria-hidden="true" className="tabular absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-energy-ink px-0.5 text-[9px] font-bold leading-none text-on-ink">
          ½
        </span>
      )}
      {chip && (
        <span
          role="tooltip"
          className={cx(
            'pointer-events-none absolute bottom-[calc(100%+8px)] z-10 hidden max-w-[320px] whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-semibold text-on-ink shadow-pop group-hover:block group-focus-visible:block',
            tipAlign === 'left' ? 'left-0' : 'left-1/2 -translate-x-1/2',
          )}
        >
          {a.tip}
        </span>
      )}
    </button>
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
