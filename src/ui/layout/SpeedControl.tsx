// Speed control (top bar, section C): ⏸ 1× 2× 4× + the time status label. With the thin ScreenFrame this is
// the ONLY place the speed colour appears (docs/LAYOUT.md §4.2). Pause is neutral (ink-3, dashed), never red.
import { useEffect, useRef, useState } from 'react'
import type { GameSpeed } from '../../engine/types'
import { useGameStore } from '../../store/gameStore'
import { Icon } from '../icons'
import { t } from '../i18n'
import { cx } from '../primitives'
import { soft } from '../theme'
import { FLOW_LABEL_MS, holdLabel, isFocusHold, SPEED_COLOR, useRecentSlowdown, useTimeStatus, type TimeStatus } from '../time'

const SPEEDS: GameSpeed[] = [0, 1, 2, 4]

function setSpeed(speed: GameSpeed) {
  useGameStore.getState().dispatch({ type: 'setSpeed', speed })
}

/** Short label next to the segments (≤ 84px): why time is still, "Zaman akıyor" after a start, or the slowdown note. */
function useStatusLabel(time: TimeStatus): { text: string; title: string; tone: 'ink' | 'ink-2' } | null {
  const flowing = time.effective > 0
  const slowed = useRecentSlowdown()
  const [flowLabel, setFlowLabel] = useState(false)
  useEffect(() => {
    if (!flowing) {
      setFlowLabel(false)
      return
    }
    setFlowLabel(true)
    const id = window.setTimeout(() => setFlowLabel(false), FLOW_LABEL_MS)
    return () => window.clearTimeout(id)
  }, [flowing])

  if (time.gameOver) return null
  if (!flowing) {
    if (isFocusHold(time.hold) && time.chosen > 0) {
      const reason = t(`time.reasonShort.${time.hold}`)
      return {
        text: t('top.speedFocus', { reason, v: time.chosen }),
        title: t('top.speedFocusTitle', { reason: holdLabel(time.hold), v: time.chosen }),
        tone: 'ink-2',
      }
    }
    return { text: t('time.paused'), title: t('top.speedPausedTitle', { reason: holdLabel(time.hold) }), tone: 'ink-2' }
  }
  if (slowed) return { text: t('top.slowed'), title: t('time.slowed'), tone: 'ink' }
  if (flowLabel) return { text: t('time.flowing'), title: t('time.speedState', { v: `${time.effective}×` }), tone: 'ink-2' }
  return null
}

/**
 * Desktop: segmented ⏸ 1× 2× 4×. The active segment is the speed time really runs at (a focus pause lights
 * the neutral pause segment; the player's chosen speed keeps a dashed frame in its colour meanwhile).
 * Phone (`compact`): one 44px button cycling pause → 1× → 2× → 4×.
 */
export function SpeedControl({ compact, showLabel = true }: { compact?: boolean; showLabel?: boolean }) {
  const time = useTimeStatus()
  const { effective, chosen } = time
  const held = effective === 0 && chosen > 0
  const playerPaused = chosen === 0
  // Player-paused: the pause segment turns into play and resumes the last running speed.
  const lastSpeed = useRef<GameSpeed>(1)
  if (chosen > 0) lastSpeed.current = chosen
  const label = useStatusLabel(time)

  if (compact) {
    const idx = SPEEDS.indexOf(chosen)
    const nextSpeed = SPEEDS[(idx + 1) % SPEEDS.length] ?? 1
    const still = effective === 0
    const c = SPEED_COLOR[effective]
    const now = still ? t('time.paused') : `${effective}×`
    const next = nextSpeed === 0 ? t('speed.pause') : `${nextSpeed}×`
    return (
      <button
        type="button"
        onClick={() => setSpeed(nextSpeed)}
        disabled={time.gameOver}
        aria-label={t('top.speedCycle', { v: now, next })}
        title={label?.title ?? t('top.speedCycle', { v: now, next })}
        className="tabular flex h-11 min-w-11 shrink-0 items-center justify-center gap-0.5 rounded-control border-2 px-1.5 text-xs font-bold text-ink transition-[border-color,background-color] duration-300 disabled:opacity-40"
        style={still ? { borderColor: 'var(--color-speed-pause)', borderStyle: 'dashed', background: 'var(--color-surface-2)' } : { borderColor: c, background: soft(c, 18) }}
      >
        <Icon name={still ? 'pause' : 'play'} size={14} />
        {!still && `${effective}×`}
      </button>
    )
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {showLabel && label && (
        <span
          role="status"
          title={label.title}
          className={cx('max-w-[84px] truncate text-[11px] font-semibold animate-fade-in', label.tone === 'ink' ? 'text-ink' : 'text-ink-2')}
        >
          {label.text}
        </span>
      )}
      <div
        className="flex h-10 shrink-0 items-center gap-0.5 rounded-control bg-surface-2 p-0.5"
        role="group"
        aria-label={t('speed.label')}
        title={held ? t('time.resumesAt', { v: chosen }) : undefined}
      >
        {SPEEDS.map((v) => {
          const active = effective === v
          const c = SPEED_COLOR[v]
          const style =
            active && v === 0
              ? // Still: neutral segment with an ink-3 ring (pause is not danger).
                { background: 'var(--color-surface)', boxShadow: 'inset 0 0 0 1.5px var(--color-speed-pause)' }
              : active
                ? { background: soft(c, 22), boxShadow: `inset 0 0 0 2px ${c}` }
                : held && chosen === v
                  ? { outline: `1.5px dashed ${c}`, outlineOffset: -3 }
                  : undefined
          return (
            <button
              key={v}
              type="button"
              disabled={time.gameOver}
              onClick={() => setSpeed(v === 0 && playerPaused ? lastSpeed.current : v)}
              aria-pressed={chosen === v}
              aria-label={v === 0 ? (playerPaused ? t('speed.play') : t('speed.pause')) : t('speed.hint', { v })}
              title={v === 0 ? (playerPaused ? t('speed.play') : t('speed.pauseHint')) : t('speed.hint', { v })}
              className={cx(
                'tabular flex h-9 w-9 items-center justify-center rounded-[8px] text-xs font-semibold transition-[background-color,box-shadow,color] duration-300 disabled:opacity-40',
                active ? 'text-ink' : 'text-ink-2 hover:bg-surface hover:text-ink',
              )}
              style={style}
            >
              {v === 0 ? <Icon name={playerPaused ? 'play' : 'pause'} size={14} /> : `${v}×`}
            </button>
          )
        })}
      </div>
    </div>
  )
}
