// Top HUD: left = indicators (grow with learned concepts), center = stage/time/speed, right = view controls.
import { useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { GameSpeed, HudWidget } from '../engine/types'
import { STAGES } from '../content'
import { useGameStore } from '../store/gameStore'
import type { ZoomLevel } from '../store/types'
import { Icon } from './icons'
import { t } from './i18n'
import { money } from './format'
import { cx, IconButton } from './primitives'
import { WIDGETS } from './widgets'
import { useExclusiveExpander, useIsMobile } from './hooks'
import { DayClock, SPEED_COLOR, timeColor, useTimeStatus, type TimeStatus } from './time'
import { soft } from './theme'
import { NextStepChip } from './NextStepChip'
import { HorizonNext, HorizonStrip } from './Horizon'
import { MomentFeed } from './Moments'
import { PANEL_RESERVE } from './RightPanel'
import { valuationLine } from './loopUi'

/** Round button → Büyüme panel, scrolled to the round block (again closes it, like the dock tabs). */
function openRound() {
  const { ui, openPanel, closePanel } = useGameStore.getState()
  if (ui.panel?.kind === 'growth') closePanel()
  else openPanel({ kind: 'growth', section: 'round' }, { root: true })
}

/** Gear → settings in the single panel (again closes it). */
function toggleSettings() {
  const { ui, openPanel, closePanel } = useGameStore.getState()
  if (ui.panel?.kind === 'settings') closePanel()
  else openPanel({ kind: 'settings' }, { root: true })
}

const SPEEDS: GameSpeed[] = [0, 1, 2, 4]

export function Hud() {
  const mobile = useIsMobile()
  return mobile ? <MobileHud /> : <DesktopHud />
}

function useWidgetLists(): { primary: HudWidget[]; secondary: HudWidget[] } {
  const unlocked = useGameStore(useShallow((s) => s.state.unlockedWidgets))
  const primary: HudWidget[] = []
  const secondary: HudWidget[] = []
  for (const id of unlocked) {
    const def = WIDGETS[id]
    if (!def) continue
    if (def.tier === 'primary') primary.push(id)
    else if (def.tier === 'secondary') secondary.push(id)
  }
  return { primary, secondary }
}

function DesktopHud() {
  const { primary, secondary } = useWidgetLists()
  // An open panel (top 76px down, right side) would cover the horizon, the chip and the moment cards: the HUD row
  // then ends at the panel's left edge and the centre column shrinks into the scene area. The view controls sit
  // above the panel's top edge, so they move out of the row and stay where they are.
  const panelOpen = useGameStore((s) => s.ui.panel !== null)
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3" style={panelOpen ? { paddingRight: PANEL_RESERVE } : undefined}>
      <div className="pointer-events-auto flex w-[260px] flex-col gap-2 lg:w-[300px]">
        <div className="ui-card grid divide-y divide-border p-1">
          {primary.map((id) => {
            const W = WIDGETS[id].Component
            return <W key={id} />
          })}
        </div>
        {secondary.length > 0 && (
          <div className="ui-card ui-scroll grid max-h-[max(9rem,calc(100dvh-420px))] min-h-0 grid-cols-2 gap-x-1 gap-y-0.5 p-1">
            {secondary.map((id) => {
              const W = WIDGETS[id].Component
              return (
                <div key={id} className="min-w-0 animate-pop-in">
                  <W />
                </div>
              )
            })}
          </div>
        )}
      </div>
      {/* Center column: stage + time, the horizon ahead, the next link of the chain, short moment cards. */}
      <div className={cx('pointer-events-none flex min-w-0 flex-col items-stretch gap-1.5', panelOpen ? 'mx-auto w-full max-w-[560px] flex-1' : 'w-[min(560px,48vw)]')}>
        <StageBar />
        <HorizonStrip />
        <div className="flex min-w-0 justify-center">
          <NextStepChip className="max-w-full" />
        </div>
        <MomentFeed />
      </div>
      {panelOpen ? (
        <div className="pointer-events-none absolute right-3 top-3">
          <ViewControls />
        </div>
      ) : (
        <ViewControls />
      )}
    </div>
  )
}

function MobileHud() {
  const { primary, secondary } = useWidgetLists()
  // Local expander, but still "one thing open": it closes when the panel opens and closes the panel.
  const [open, setOpen] = useExclusiveExpander()
  return (
    <div data-scene-top className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-1.5 px-2 pt-2">
      <div className="pointer-events-auto flex items-center gap-1.5">
        <StageBar compact />
        <ViewControls compact />
      </div>
      <div className="pointer-events-auto ui-card flex items-stretch gap-1 p-1">
        {/* Cash gets the widest column: value + daily net (the monthly net is in the desktop chip / Büyüme). */}
        <div className="grid min-w-0 flex-1 grid-cols-[1.4fr_1fr_1fr] gap-1">
          {primary.map((id) => {
            const W = WIDGETS[id].Component
            return <W key={id} compact />
          })}
        </div>
        {secondary.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={t('hud.more')}
            className="flex min-h-11 min-w-11 shrink-0 flex-col items-center justify-center rounded-control border border-border text-[11px] font-semibold text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink aria-expanded:bg-surface-2 aria-expanded:text-ink"
          >
            <Icon name={open ? 'chevronUp' : 'chevronDown'} size={16} />+{secondary.length}
          </button>
        )}
      </div>
      {/* Phone: chip and horizon share one line; moment cards stay thin under it. */}
      <div className="flex min-w-0 items-stretch gap-1.5">
        <NextStepChip compact className="min-w-0 flex-1" />
        <HorizonNext className="max-w-[46%]" />
      </div>
      <MomentFeed />
      {open && secondary.length > 0 && (
        <div className="pointer-events-auto ui-card ui-scroll grid max-h-[45vh] animate-slide-up grid-cols-2 gap-1 p-1.5 landscape:grid-cols-3">
          {secondary.map((id) => {
            const W = WIDGETS[id].Component
            return <W key={id} />
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Center: stage, date, progress, speed
// ---------------------------------------------------------------------------

function StageBar({ compact }: { compact?: boolean }) {
  const s = useGameStore(
    useShallow((st) => ({
      stage: st.state.stage,
      progress: st.state.derived.stageProgress,
      valuation: st.state.finance.valuation,
      canStart: st.state.derived.canStartRound,
      roundActive: !!st.state.round?.active,
      weeksLeft: st.state.round?.weeksLeft ?? 0,
      parts: st.state.derived.valuationParts,
    })),
  )
  const dispatch = useGameStore((st) => st.dispatch)
  const time = useTimeStatus()
  const next = STAGES[s.stage + 1]
  const pctW = Math.max(0, Math.min(1, s.progress)) * 100

  // Phones: the round buttons shrink to square icon buttons so stage name and date keep their width.
  const roundInProgress = t('round.inProgressShort', { v: Math.max(0, Math.ceil(s.weeksLeft)) })
  const roundBtn = s.roundActive ? (
    <button
      type="button"
      onClick={openRound}
      aria-label={roundInProgress}
      title={roundInProgress}
      className={cx(
        'tabular inline-flex shrink-0 items-center justify-center gap-1 rounded-control border border-brand/40 bg-brand-soft text-xs font-semibold text-brand-ink transition-colors hover:border-brand',
        compact ? 'min-h-11 min-w-11 px-1.5' : 'min-h-9 px-3',
      )}
    >
      <Icon name="timer" size={14} />
      {compact ? Math.max(0, Math.ceil(s.weeksLeft)) : roundInProgress}
    </button>
  ) : s.canStart ? (
    <button
      type="button"
      onClick={openRound}
      aria-label={t('round.start')}
      title={t('round.start')}
      className={cx(
        'inline-flex shrink-0 animate-pop-in items-center justify-center gap-1 rounded-control bg-brand text-xs font-semibold tracking-wide text-on-ink shadow-[0_4px_12px_-4px_var(--color-brand)] transition-colors hover:bg-brand-hover',
        compact ? 'size-11' : 'min-h-9 px-3',
      )}
    >
      <Icon name="rocket" size={compact ? 18 : 14} />
      {!compact && t('round.start')}
    </button>
  ) : null

  return (
    // The card's 2px frame carries the time state: red = still, yellow 1×, orange 2×, green 4×.
    <div
      className={cx('pointer-events-auto ui-card flex min-w-0 items-center gap-2 p-1.5 transition-[border-color,box-shadow] duration-300', compact ? 'flex-1' : 'w-full px-3')}
      style={{ borderWidth: 2, borderColor: timeColor(time), boxShadow: `0 0 0 3px ${soft(timeColor(time), 14)}, var(--shadow-card)` }}
    >
      <div className="min-w-0 flex-1">
        <div className={cx('flex items-center gap-x-2', compact && 'flex-wrap gap-y-0.5')}>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold tracking-wide text-ink">
            <span aria-hidden="true" className="size-2 rounded-full bg-brand" />
            {STAGES[s.stage]?.name ?? '—'}
          </span>
          <DayClock compact={compact} />
        </div>
        {next ? (
          <div className="mt-1 flex items-center gap-2" title={`${t('hud.stageProgressTitle', { stage: next.name })}\n${valuationLine(s.parts)}`}>
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-brand/15">
              <div className="h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${pctW}%` }} />
            </div>
            {!compact && (
              <span className="tabular shrink-0 text-[11px] font-medium text-ink-2">
                {money(s.valuation)} / {money(next.targetValuation ?? 0)}
              </span>
            )}
          </div>
        ) : null}
      </div>
      {!compact && roundBtn}
      <SpeedControl time={time} onChange={(speed) => dispatch({ type: 'setSpeed', speed })} compact={compact} />
      {compact && roundBtn}
    </div>
  )
}

/**
 * Speed segments coloured by state (pause red, 1× yellow, 2× orange, 4× green). The active segment shows the
 * speed time actually runs at, so a focus pause lights the pause segment; the player's chosen speed keeps a
 * dashed frame meanwhile ("kapatınca 2× devam").
 */
function SpeedControl({ time, onChange, compact }: { time: TimeStatus; onChange: (s: GameSpeed) => void; compact?: boolean }) {
  const { effective, chosen } = time
  const held = effective === 0 && chosen > 0
  // Player-paused: the pause segment turns into play and resumes the last running speed.
  const lastSpeed = useRef<GameSpeed>(1)
  if (chosen > 0) lastSpeed.current = chosen
  const playerPaused = chosen === 0
  if (compact) {
    // One button cycles pause → 1× → 2× → 4× (from the player's speed; a focus pause does not change it).
    const idx = SPEEDS.indexOf(chosen)
    const nextSpeed = SPEEDS[(idx + 1) % SPEEDS.length] ?? 1
    const c = SPEED_COLOR[effective]
    return (
      <button
        type="button"
        onClick={() => onChange(nextSpeed)}
        aria-label={`${t('speed.label')}: ${effective === 0 ? t('time.paused') : `${effective}×`}`}
        className="tabular flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-0.5 rounded-control border-2 text-xs font-bold text-ink transition-[border-color,background-color] duration-300"
        style={{ borderColor: c, background: soft(c, 16) }}
      >
        <Icon name={effective === 0 ? 'pause' : 'play'} size={14} />
        {effective > 0 && `${effective}×`}
      </button>
    )
  }
  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-control bg-surface-2 p-0.5" role="group" aria-label={t('speed.label')} title={held ? t('time.resumesAt', { v: chosen }) : undefined}>
      {SPEEDS.map((v) => {
        const active = effective === v
        const c = SPEED_COLOR[v]
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v === 0 && playerPaused ? lastSpeed.current : v)}
            aria-pressed={chosen === v}
            title={v === 0 ? (playerPaused ? t('speed.play') : t('speed.pauseHint')) : t('speed.hint', { v })}
            className={cx(
              'tabular flex h-8 min-w-9 items-center justify-center rounded-[8px] px-2 text-xs font-semibold transition-[background-color,box-shadow,color] duration-300',
              active ? 'text-ink' : 'text-ink-2 hover:bg-surface hover:text-ink',
            )}
            style={
              active
                ? { background: soft(c, 22), boxShadow: `inset 0 0 0 2px ${c}` }
                : held && chosen === v
                  ? { outline: `1.5px dashed ${c}`, outlineOffset: -3 }
                  : undefined
            }
          >
            {v === 0 ? <Icon name={playerPaused ? 'play' : 'pause'} size={14} /> : `${v}×`}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Right: zoom, sound, language (placeholder), settings
// ---------------------------------------------------------------------------

function ViewControls({ compact }: { compact?: boolean }) {
  const zoom = useGameStore((s) => s.ui.zoom)
  const setZoom = useGameStore((s) => s.setZoom)
  const z = (d: number) => setZoom(Math.max(0, Math.min(2, zoom + d)) as ZoomLevel)

  if (compact) {
    return (
      <div className="ui-card flex shrink-0 items-center p-0.5">
        <IconButton icon="zoomOut" label={t('view.zoomOut')} onClick={() => z(-1)} disabled={zoom === 0} />
        <IconButton icon="zoomIn" label={t('view.zoomIn')} onClick={() => z(1)} disabled={zoom === 2} />
        <IconButton icon="gear" label={t('settings.title')} onClick={toggleSettings} />
      </div>
    )
  }
  return (
    <div className="pointer-events-auto ui-card flex items-center gap-0.5 p-1">
      <div className="flex items-center gap-0.5">
        <IconButton icon="zoomOut" label={t('view.zoomOut')} onClick={() => z(-1)} disabled={zoom === 0} size={40} />
        <IconButton icon="zoomIn" label={t('view.zoomIn')} onClick={() => z(1)} disabled={zoom === 2} size={40} />
        <span className="mx-0.5 h-6 w-px bg-border" />
      </div>
      <button
        type="button"
        title={t('view.languageSoon')}
        aria-label={t('view.language')}
        className="hidden h-10 min-w-10 items-center justify-center gap-1 rounded-control px-2 text-[11px] font-semibold tracking-wide text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink lg:flex"
        onClick={toggleSettings}
      >
        <Icon name="globe" size={16} />
        TR
      </button>
      <IconButton icon="gear" label={t('settings.title')} onClick={toggleSettings} size={40} />
    </div>
  )
}
