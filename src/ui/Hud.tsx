// Top HUD: left = indicators (grow with learned concepts), center = stage/time/speed, right = view controls.
import { useState } from 'react'
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
import { useIsMobile } from './hooks'

/** Round button → Büyüme panel, scrolled to the round block. */
function openRound() {
  useGameStore.getState().openPanel({ kind: 'growth', section: 'round' }, { root: true })
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
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
      <div className="pointer-events-auto flex w-[260px] flex-col gap-2 lg:w-[300px]">
        <div className="ui-card grid gap-1 p-1.5">
          {primary.map((id) => {
            const W = WIDGETS[id].Component
            return <W key={id} />
          })}
        </div>
        {secondary.length > 0 && (
          <div className="ui-card ui-scroll grid max-h-[max(9rem,calc(100dvh-420px))] min-h-0 grid-cols-2 gap-1 p-1.5">
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
      <StageBar />
      <ViewControls />
    </div>
  )
}

function MobileHud() {
  const { primary, secondary } = useWidgetLists()
  const [open, setOpen] = useState(false)
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-1.5 px-2 pt-2">
      <div className="pointer-events-auto flex items-center gap-1.5">
        <StageBar compact />
        <ViewControls compact />
      </div>
      <div className="pointer-events-auto ui-card flex items-stretch gap-1 p-1">
        {/* Cash gets the widest column: value + monthly net (PLAN §7.4). */}
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
            className="flex min-h-11 min-w-11 shrink-0 flex-col items-center justify-center rounded-2xl bg-cream-200/80 text-[11px] font-bold text-ink-700"
          >
            <Icon name={open ? 'chevronUp' : 'chevronDown'} size={16} />+{secondary.length}
          </button>
        )}
      </div>
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
      day: st.state.time.day,
      month: st.state.time.month,
      speed: st.state.time.speed,
      progress: st.state.derived.stageProgress,
      valuation: st.state.finance.valuation,
      canStart: st.state.derived.canStartRound,
      roundActive: !!st.state.round?.active,
      weeksLeft: st.state.round?.weeksLeft ?? 0,
    })),
  )
  const dispatch = useGameStore((st) => st.dispatch)
  const next = STAGES[s.stage + 1]
  const dayOfMonth = Math.floor(s.day % 30) + 1
  const pctW = Math.max(0, Math.min(1, s.progress)) * 100

  const roundBtn = s.roundActive ? (
    <button
      type="button"
      onClick={openRound}
      className="inline-flex min-h-9 items-center gap-1 rounded-full bg-lilac-100 px-3 text-xs font-bold text-lilac-500 max-md:min-h-11"
    >
      <Icon name="timer" size={14} />
      {t('round.inProgressShort', { v: Math.max(0, Math.ceil(s.weeksLeft)) })}
    </button>
  ) : s.canStart ? (
    <button
      type="button"
      onClick={openRound}
      className="inline-flex min-h-9 animate-pop-in items-center gap-1 rounded-full bg-ink-900 px-3 text-xs font-bold text-cream-50 max-md:min-h-11"
    >
      <Icon name="rocket" size={14} />
      {t('round.start')}
    </button>
  ) : null

  return (
    <div className={cx('pointer-events-auto ui-card flex min-w-0 items-center gap-2 p-1.5', compact ? 'flex-1' : 'w-[min(520px,46vw)] px-3')}>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-extrabold tracking-tight">{STAGES[s.stage]?.name ?? '—'}</span>
          <span className="tabular truncate text-[11px] font-semibold text-ink-600">{t('hud.date', { m: s.month + 1, d: dayOfMonth })}</span>
        </div>
        {next ? (
          <div className="mt-1 flex items-center gap-2" title={t('hud.stageProgressTitle', { stage: next.name })}>
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-cream-200">
              <div className="h-full rounded-full bg-gradient-to-r from-lilac-300 to-rose-300 transition-[width] duration-700" style={{ width: `${pctW}%` }} />
            </div>
            {!compact && (
              <span className="tabular shrink-0 text-[11px] font-semibold text-ink-600">
                {money(s.valuation)} / {money(next.targetValuation ?? 0)}
              </span>
            )}
          </div>
        ) : null}
      </div>
      {!compact && roundBtn}
      <SpeedControl speed={s.speed} onChange={(speed) => dispatch({ type: 'setSpeed', speed })} compact={compact} />
      {compact && roundBtn}
    </div>
  )
}

function SpeedControl({ speed, onChange, compact }: { speed: GameSpeed; onChange: (s: GameSpeed) => void; compact?: boolean }) {
  if (compact) {
    // One button cycles pause → 1× → 2× → 4×.
    const idx = SPEEDS.indexOf(speed)
    const nextSpeed = SPEEDS[(idx + 1) % SPEEDS.length] ?? 1
    return (
      <button
        type="button"
        onClick={() => onChange(nextSpeed)}
        aria-label={t('speed.label')}
        className={cx('flex min-h-11 min-w-11 items-center justify-center gap-0.5 rounded-full text-xs font-extrabold', speed === 0 ? 'bg-peach-300 text-ink-900' : 'bg-ink-900 text-cream-50')}
      >
        <Icon name={speed === 0 ? 'pause' : 'play'} size={14} />
        {speed > 0 && `${speed}×`}
      </button>
    )
  }
  return (
    <div className="flex shrink-0 items-center rounded-full bg-cream-200/80 p-0.5" role="group" aria-label={t('speed.label')}>
      {SPEEDS.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={speed === v}
          title={v === 0 ? t('speed.pauseHint') : t('speed.hint', { v })}
          className={cx(
            'flex h-8 min-w-9 items-center justify-center rounded-full px-2 text-xs font-extrabold transition-colors',
            speed === v ? (v === 0 ? 'bg-peach-300 text-ink-900' : 'bg-ink-900 text-cream-50') : 'text-ink-700 hover:bg-cream-50',
          )}
        >
          {v === 0 ? <Icon name="pause" size={14} /> : `${v}×`}
        </button>
      ))}
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
        <span className="mx-0.5 h-6 w-px bg-cream-300" />
      </div>
      <button
        type="button"
        title={t('view.languageSoon')}
        aria-label={t('view.language')}
        className="hidden h-10 min-w-10 items-center justify-center gap-1 rounded-full px-2 text-[11px] font-extrabold text-ink-700 hover:bg-cream-200/80 lg:flex"
        onClick={toggleSettings}
      >
        <Icon name="globe" size={16} />
        TR
      </button>
      <IconButton icon="gear" label={t('settings.title')} onClick={toggleSettings} size={40} />
    </div>
  )
}
