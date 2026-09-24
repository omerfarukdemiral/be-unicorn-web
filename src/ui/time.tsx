// Time flow made visible: paused start (Başlat call), focus pauses (decision / Defter card / modal),
// the speed colour code (pause neutral grey + dashed, 1× yellow, 2× orange, 4× green: docs/LAYOUT.md §4.2),
// the day clock with its (neutral) month ring, the paused veil over the scene and a small number tween for Kasa.
// The speed colour lives only in the speed control (layout/SpeedControl.tsx) and the thin ScreenFrame.
// Effective speed = the player's speed (state.time.speed) unless a store pause reason holds it at 0.
import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { GameSpeed } from '../engine/types'
import { STAGES } from '../content'
import { effectiveSpeed, useGameStore } from '../store/gameStore'
import type { PauseReason } from '../store/types'
import { Icon } from './icons'
import { t } from './i18n'
import { money } from './format'
import { cx } from './primitives'
import { soft } from './theme'
import { useIsMobile } from './hooks'

/** Border / fill colour of each speed state (docs/DESIGN.md --color-speed-*). */
export const SPEED_COLOR: Record<GameSpeed, string> = {
  0: 'var(--color-speed-pause)',
  1: 'var(--color-speed-1)',
  2: 'var(--color-speed-2)',
  4: 'var(--color-speed-4)',
}

export type TimeHold = PauseReason | 'start' | 'manual' | null

export interface TimeStatus {
  /** Speed the world runs at right now (0 = still). */
  effective: GameSpeed
  /** The player's chosen speed (what time returns to once focus pauses clear). */
  chosen: GameSpeed
  /** Why time is still (null = flowing). A focus pause wins over the player's own pause in the label. */
  hold: TimeHold
  runStarted: boolean
  gameOver: boolean
}

export function useTimeStatus(): TimeStatus {
  return useGameStore(
    useShallow((st) => {
      const effective = effectiveSpeed(st)
      const chosen = st.state.time.speed
      const reason = st.ui.pauseReasons[0]
      const hold: TimeHold = effective > 0 ? null : reason ? reason : !st.ui.runStarted ? 'start' : 'manual'
      return { effective, chosen, hold, runStarted: st.ui.runStarted, gameOver: !!st.state.gameOver }
    }),
  )
}

/** State colour: neutral grey (speed-pause = ink-3) whenever time is still, otherwise the running speed's colour. */
export function timeColor(s: Pick<TimeStatus, 'effective'>): string {
  return SPEED_COLOR[s.effective]
}

/** Eases a number toward its target (Kasa counts up/down instead of jumping per engine chunk). */
export function useTween(target: number, ms = 450): number {
  const [shown, setShown] = useState(target)
  const from = useRef(target)
  const cur = useRef(target)
  useEffect(() => {
    if (!Number.isFinite(target)) {
      setShown(target)
      return
    }
    from.current = cur.current
    const start = performance.now()
    let raf = 0
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms)
      const e = 1 - (1 - k) ** 3
      cur.current = from.current + (target - from.current) * e
      setShown(cur.current)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return shown
}

// ---------------------------------------------------------------------------
// Day clock (HUD center): month ring + date that ticks every day + time status
// ---------------------------------------------------------------------------

/** Ms a "Zaman akıyor" label stays after the clock (re)starts (speed control label). */
export const FLOW_LABEL_MS = 4500
/** Ms the "Önemli an · 1×'e yavaşladı" note stays after an automatic 4× → 1× slowdown. */
const SLOWED_LABEL_MS = 3500

/** True for a few seconds after the store slowed 4× down to 1× on an important moment. */
export function useRecentSlowdown(): boolean {
  const at = useGameStore((s) => s.ui.slowdownAt)
  const [recent, setRecent] = useState(false)
  useEffect(() => {
    if (at === null) return
    const left = SLOWED_LABEL_MS - (performance.now() - at)
    if (left <= 0) return
    setRecent(true)
    const id = window.setTimeout(() => setRecent(false), left)
    return () => window.clearTimeout(id)
  }, [at])
  return recent
}

/** Focus pause (the game holds time while a card is read), as opposed to the player's own pause. */
export function isFocusHold(hold: TimeHold): hold is PauseReason {
  return hold === 'decision' || hold === 'concept' || hold === 'modal' || hold === 'offer'
}

/**
 * Month ring + date that ticks every day. Neutral (ink-2): the speed colour is the speed control's and the
 * screen edge's alone (docs/LAYOUT.md §4.2); the time status label lives in the speed control.
 */
export function DayClock({ compact }: { compact?: boolean }) {
  const { day, month } = useGameStore(useShallow((s) => ({ day: s.state.time.day, month: s.state.time.month })))
  const flowing = useGameStore((s) => effectiveSpeed(s) > 0)
  const dayInt = Math.floor(day)
  const dayOfMonth = Math.floor(day % 30) + 1
  const monthFrac = (day % 30) / 30
  const size = 18
  const r = 7
  const c = 2 * Math.PI * r
  return (
    <span className="inline-flex min-w-0 items-center gap-1" title={t('time.monthProgress', { m: month + 1, d: dayOfMonth })}>
      {/* Phones: the short date alone (the 2-row top bar has no room for the ring next to name + round). */}
      {!compact && <svg width={size} height={size} viewBox="0 0 18 18" className="shrink-0 -rotate-90" aria-hidden="true">
        <circle cx={9} cy={9} r={r} fill="none" stroke="var(--color-border)" strokeWidth={2.5} />
        <circle cx={9} cy={9} r={r} fill="none" stroke="var(--color-ink-2)" strokeWidth={2.5} strokeLinecap="round" strokeDasharray={`${Math.max(0.001, monthFrac) * c} ${c}`} />
      </svg>}
      <span key={flowing ? dayInt : 'still'} className={cx('tabular inline-block shrink-0 text-[11px] font-semibold text-ink-2', flowing && 'animate-day-tick')}>
        {t(compact ? 'top.dateShort' : 'hud.date', { m: month + 1, d: dayOfMonth })}
      </span>
    </span>
  )
}

export function holdLabel(hold: TimeHold): string {
  return hold ? t(`time.reason.${hold}`) : ''
}

// ---------------------------------------------------------------------------
// Screen frame: the whole viewport edge carries the time colour (docs/CORE_LOOP.md §3.3)
// ---------------------------------------------------------------------------

/**
 * Thin frame around the viewport in the time colour: yellow 1×, orange 2×, green 4× (solid). Any pause is
 * neutral grey (speed-pause = ink-3) and DASHED: pausing is not danger, red is kept for real danger
 * (docs/LAYOUT.md §4). A focus pause (decision / Defter card / modal) adds a faint inner band in the chosen
 * speed's colour (the speed time returns to). While time flows a soft glow runs along it once per game day.
 * Colour is never the only signal: solid vs dashed + the speed control label carry the same state.
 */
export function ScreenFrame() {
  const mobile = useIsMobile()
  const status = useTimeStatus()
  const dayInt = useGameStore((s) => Math.floor(s.state.time.day))
  if (status.gameOver) return null
  const color = timeColor(status)
  const focus = isFocusHold(status.hold) && status.chosen > 0
  const w = mobile ? 2 : 3
  const flowing = status.effective > 0
  return (
    <div
      aria-hidden="true"
      data-testid="screen-frame"
      data-state={flowing ? `${status.effective}x` : focus ? 'focus' : 'paused'}
      className="pointer-events-none fixed z-[55]"
      style={{
        top: 'env(safe-area-inset-top, 0px)',
        right: 'env(safe-area-inset-right, 0px)',
        bottom: 'env(safe-area-inset-bottom, 0px)',
        left: 'env(safe-area-inset-left, 0px)',
        border: `${w}px ${flowing ? 'solid' : 'dashed'} ${color}`,
        boxShadow: focus ? `inset 0 0 0 ${w + 3}px ${soft(SPEED_COLOR[status.chosen], 22)}` : flowing ? `inset 0 0 0 1px ${soft(color, 25)}` : undefined,
        transition: 'border-color 300ms ease, box-shadow 300ms ease',
      }}
    >
      {flowing && (
        <div
          key={dayInt}
          className="absolute inset-0 animate-frame-beat"
          style={{ boxShadow: `inset 0 0 ${mobile ? 10 : 16}px ${soft(color, 55)}`, animationDuration: `${Math.max(250, 700 / status.effective)}ms` }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Scene layers: paused veil + the paused-start call
// ---------------------------------------------------------------------------

/** Still world: the scene fades a little (desaturated, soft vignette). Below every UI surface. */
export function PauseVeil() {
  const { still, overlay } = useGameStore(useShallow((s) => ({ still: effectiveSpeed(s) === 0 && !s.state.gameOver, overlay: s.ui.overlay !== null })))
  const show = still && !overlay // modals bring their own backdrop
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 transition-opacity duration-300"
      style={{
        opacity: show ? 1 : 0,
        background: 'radial-gradient(ellipse at 50% 55%, transparent 45%, rgb(31 29 36 / 0.22) 100%)',
        backdropFilter: show ? 'saturate(0.55) brightness(0.97)' : undefined,
        WebkitBackdropFilter: show ? 'saturate(0.55) brightness(0.97)' : undefined,
      }}
    />
  )
}

/** One clear call on a paused start: the stage goal + a big Başlat (Space / 1 / 2 / 3 work too). Centred in the
 * scene area between the bars (store.ui.sceneInset, viewport px: hence `fixed`). */
export function StartCall() {
  const mobile = useIsMobile()
  const inset = useGameStore((st) => st.ui.sceneInset)
  const s = useGameStore(
    useShallow((st) => ({
      show: !st.ui.runStarted && st.state.time.speed === 0 && !st.state.gameOver && st.ui.overlay === null,
      stage: st.state.stage,
    })),
  )
  const dispatch = useGameStore((st) => st.dispatch)
  if (!s.show) return null
  const next = STAGES[s.stage + 1]
  const goal = next?.targetValuation ? t('time.startGoal', { stage: STAGES[s.stage]?.name ?? '', v: money(next.targetValuation) }) : null
  return (
    <div className="pointer-events-none fixed left-0 z-10 grid place-items-center px-4" style={{ top: inset.top, right: inset.right, bottom: inset.bottom }}>
      <div className="pointer-events-auto flex w-full max-w-[340px] animate-pop-in flex-col items-center gap-3 rounded-card border border-border bg-surface/95 p-5 text-center shadow-pop">
        {goal && (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-soft px-2 py-1 text-xs font-semibold text-brand-ink">
            <Icon name="flag" size={13} />
            {goal}
          </span>
        )}
        <p className="text-base font-semibold leading-tight text-ink">{t('time.startTitle')}</p>
        <button
          type="button"
          onClick={() => dispatch({ type: 'setSpeed', speed: 1 })}
          className="inline-flex min-h-14 w-full animate-cta-glow items-center justify-center gap-2 rounded-control bg-brand px-6 text-lg font-bold tracking-wide text-on-ink transition-colors hover:bg-brand-hover active:scale-[0.98]"
        >
          <Icon name="play" size={22} />
          {t('time.start')}
          {!mobile && <kbd className="ml-1 rounded-[6px] border border-on-ink/40 px-1.5 py-0.5 text-[11px] font-semibold opacity-85">Space</kbd>}
        </button>
        <p className="font-text text-[12px] leading-snug text-ink-2">{t('time.startHint')}</p>
      </div>
    </div>
  )
}
