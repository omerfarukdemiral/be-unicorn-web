// Time flow made visible: paused start (Başlat call), focus pauses (decision / Defter card / modal),
// the speed colour code (paused = calm red, a thicker frame; running = green at 1×/2×/4×: docs/GAMEPLAY_V2.md §13),
// the day clock with its (neutral) month ring and the paused veil over the scene.
// The speed colour lives only in the speed control (layout/SpeedControl.tsx) and the thin ScreenFrame.
// Effective speed = the player's speed (state.time.speed) unless a store pause reason holds it at 0.
import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { GameSpeed } from '../engine/types'
import { STAGES } from '../content'
import { blockingOverlay, effectiveSpeed, useGameStore } from '../store/gameStore'
import type { PauseReason, UiState } from '../store/types'
import { Icon } from './icons'
import { t } from './i18n'
import { money } from './format'
import { Label, cx } from './primitives'
import { soft } from './theme'
import { useIsMobile } from './hooks'

/** Number tween: lives in hooks.ts, re-exported for the existing callers. */
export { useTween } from './hooks'

/**
 * Border / fill colour of each speed state (docs/DESIGN.md --color-speed-*): paused red, running green. 1×/2×/4× share
 * the green; the speed control tells them apart by icon (▶/▶▶/▶▶▶) and fill density (SPEED_FILL).
 */
export const SPEED_COLOR: Record<GameSpeed, string> = {
  0: 'var(--color-speed-pause)',
  1: 'var(--color-speed-run)',
  2: 'var(--color-speed-run)',
  4: 'var(--color-speed-run)',
}

/** Fill density (% of the speed colour) of the active speed segment: faster = denser. */
export const SPEED_FILL: Record<GameSpeed, number> = { 0: 18, 1: 18, 2: 24, 4: 32 }

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

/** State colour: pause red whenever time is still, otherwise the running green. */
function timeColor(s: Pick<TimeStatus, 'effective'>): string {
  return SPEED_COLOR[s.effective]
}

// ---------------------------------------------------------------------------
// Day clock (HUD center): month ring + date that ticks every day + time status
// ---------------------------------------------------------------------------

/** Ms a "Zaman akıyor" label stays after the clock (re)starts (speed control label). */
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
  return hold === 'decision' || hold === 'concept' || hold === 'modal' || hold === 'offer' || hold === 'payday'
}

/**
 * Month ring + date that ticks every day. Neutral (ink-2): the speed colour is the speed control's and the
 * screen edge's alone (docs/LAYOUT.md §4.2); the time status label lives in the speed control.
 */
export function DayClock({ compact }: { compact?: boolean }) {
  const { day, month } = useGameStore(useShallow((s) => ({ day: s.state.time.day, month: s.state.time.month })))
  const flowing = useGameStore((s) => effectiveSpeed(s) > 0)
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
      {/* No per-day motion (at 2×/4× it would never rest): only a new month fades in, opacity alone. */}
      <span key={flowing ? month : 'still'} className={cx('tabular inline-block shrink-0 text-[12px] font-bold text-ink-2', flowing && 'animate-fade-in')}>
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
 * Frame around the viewport in the time colour, always solid (no dashes: the HUD reads as toy keys, not a wireframe).
 * Running = a 1px soft green hairline (any speed). Any pause is the calm pause red, softened and thicker (3px, 2px on
 * phones): waiting, not danger (--color-speed-pause is not --color-negative; docs/GAMEPLAY_V2.md §13). A focus pause
 * (decision / Defter card / modal) adds a faint inner band in the chosen speed's colour (the speed time returns to).
 * While time flows a soft glow runs along it once per game day. Colour is never the only signal: thick vs thin + the
 * speed control's ⏸/▶ icon and label carry the same state.
 */
export function ScreenFrame() {
  const mobile = useIsMobile()
  const status = useTimeStatus()
  const dayInt = useGameStore((s) => Math.floor(s.state.time.day))
  if (status.gameOver) return null
  const color = timeColor(status)
  const focus = isFocusHold(status.hold) && status.chosen > 0
  const flowing = status.effective > 0
  const w = flowing ? 1 : mobile ? 2 : 3
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
        border: `${w}px solid ${soft(color, flowing ? 25 : 55)}`,
        boxShadow: focus ? `inset 0 0 0 ${w + 3}px ${soft(SPEED_COLOR[status.chosen], 22)}` : undefined,
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

/** The veil shows on a still world with nothing open: a blocking modal brings its own backdrop and a center
 * screen (stats, Kanun Kitabı, Pazar haritası) sits over the scene itself (docs/GAMEPLAY_V2.md §14.3). */
export function pauseVeilShown(speed: GameSpeed, gameOver: boolean, ui: Pick<UiState, 'overlay'>): boolean {
  return speed === 0 && !gameOver && ui.overlay === null
}

/** Still world: the scene fades a little (desaturated, soft vignette). Below every UI surface. */
export function PauseVeil() {
  const show = useGameStore((s) => pauseVeilShown(effectiveSpeed(s), !!s.state.gameOver, s.ui))
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

/** One clear call on a paused start: the stage goal as a number, one sentence and a big Başlat (Space / 1 / 2 / 3 work
 * too; docs/GAMEPLAY_V2.md §10.1 D1-D2: the number is the biggest thing, the sentence the only one). Centred in the
 * scene area between the bars (store.ui.sceneInset, viewport px: hence `fixed`). A HUD callout, not a plate: the text
 * sits on the scene itself; a soft canvas glow behind it keeps it readable over the desaturated office (PauseVeil). */
export function StartCall() {
  const mobile = useIsMobile()
  const inset = useGameStore((st) => st.ui.sceneInset)
  const s = useGameStore(
    useShallow((st) => ({
      show: !st.ui.runStarted && st.state.time.speed === 0 && !st.state.gameOver && blockingOverlay(st.ui) === null,
      stage: st.state.stage,
      panelOpen: st.ui.panel !== null,
    })),
  )
  const dispatch = useGameStore((st) => st.dispatch)
  // Phones: an open sheet (Liderlik, Yol haritası…) owns the screen; the top bar's play button still starts time.
  if (!s.show || (mobile && s.panelOpen)) return null
  const next = STAGES[s.stage + 1]
  return (
    <div className="pointer-events-none fixed left-0 z-10 grid place-items-center px-4" style={{ top: inset.top, right: inset.right, bottom: inset.bottom }}>
      <div
        className="pointer-events-none flex max-w-[320px] animate-pop-in flex-col items-center gap-3 text-center"
        style={{ padding: 28, background: 'radial-gradient(closest-side, color-mix(in oklab, var(--color-canvas-bg) 85%, transparent), transparent)' }}
      >
        {next?.targetValuation ? (
          <div className="flex flex-col items-center gap-0.5">
            <Label className="inline-flex items-center gap-1 text-brand-ink">
              <Icon name="flag" size={12} />
              {t('start.goalLabel', { stage: STAGES[s.stage]?.name ?? '' })}
            </Label>
            <span className="tabular text-[34px] font-extrabold leading-none text-ink">{money(next.targetValuation)}</span>
          </div>
        ) : null}
        <p className="text-[15px] font-semibold leading-tight text-ink-2">{t('time.startTitle')}</p>
        {/* The breath sits on a wrapper: a transform on the key itself would fight its own press transform and lip. */}
        <span className="flex animate-breathe rounded-control">
          <button
            type="button"
            onClick={() => dispatch({ type: 'setSpeed', speed: 1 })}
            aria-keyshortcuts="Space"
            className="ui-key ui-key-commit pointer-events-auto inline-flex min-h-14 items-center justify-center gap-2 px-8 text-lg font-extrabold"
          >
            <Icon name="play" size={22} fill="currentColor" />
            {t('time.start')}
            {!mobile && <span className="ml-1 text-[11px] font-bold opacity-80">Space</span>}
          </button>
        </span>
      </div>
    </div>
  )
}
