// Speed control (top bar, section C): ⏸ 1× 2× 4× + the time status label. With the thin ScreenFrame this is
// the ONLY place the speed colour appears (docs/LAYOUT.md §4.2). Paused = calm red, running = green; the speeds
// differ by icon (▶ / ▶▶ / ▶▶▶) and fill density, never by hue (docs/GAMEPLAY_V2.md §13). The segments are physical
// keys in an inset tray: the active segment = a sunk key in its colour; the chosen speed during a focus pause keeps a
// solid green edge on its raised key. No dashed frames anywhere.
import { useRef, type CSSProperties } from 'react'
import type { GameSpeed } from '../../engine/types'
import { useGameStore } from '../../store/gameStore'
import { Icon, type IconName } from '../icons'
import { t } from '../i18n'
import { cx } from '../primitives'
import { holdLabel, isFocusHold, SPEED_COLOR, SPEED_FILL, useRecentSlowdown, useTimeStatus, type TimeStatus } from '../time'

const SPEEDS: GameSpeed[] = [0, 1, 2, 4]

/** Running speed icon: one, two or three triangles. */
const SPEED_ICON: Record<Exclude<GameSpeed, 0>, IconName> = { 1: 'play', 2: 'play2', 4: 'play3' }

function setSpeed(speed: GameSpeed) {
  useGameStore.getState().dispatch({ type: 'setSpeed', speed })
}

/** Short label next to the segments (≤ 84px): only when something other than the player holds time, or the slowdown note. */
function useStatusLabel(time: TimeStatus): { text: string; title: string; tone: 'ink' | 'ink-2' } | null {
  const flowing = time.effective > 0
  const slowed = useRecentSlowdown()

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
    // Plain pause: the sunk red pause key already says it (no "Duraklatıldı" word, 2026-10-06).
    return null
  }
  if (slowed) return { text: t('top.slowed'), title: t('time.slowed'), tone: 'ink' }
  // Running: the sunk green key says it; no "Zaman akıyor" flash.
  return null
}

/**
 * Desktop: segmented ⏸ 1× 2× 4×. The active segment is the speed time really runs at (a focus pause sinks the red
 * pause key; the chosen speed keeps a solid green edge meanwhile). Every active segment gets the same treatment: a
 * sunk key filled with its colour at SPEED_FILL density, a solid 2px edge in that colour and ink text (calm: a focus
 * pause never flashes a solid red key).
 * Phone (`compact`): one 44px key cycling pause → 1× → 2× → 4× (no sunk state: it cycles).
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
        className="ui-key ui-num flex h-11 min-w-11 shrink-0 items-center justify-center gap-0.5 px-2 text-[13px] text-ink disabled:opacity-40"
        style={
          {
            '--key-fill': `color-mix(in srgb, ${c} ${SPEED_FILL[effective]}%, var(--color-surface))`,
            '--key-edge': c,
            '--key-lip': `color-mix(in oklab, ${c} 70%, var(--color-ink))`,
          } as CSSProperties
        }
      >
        <Icon name={effective === 0 ? 'pause' : SPEED_ICON[effective]} size={effective === 4 ? 16 : 14} fill={still ? undefined : 'currentColor'} />
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
          className={cx('max-w-[84px] truncate text-[12px] font-bold animate-fade-in', label.tone === 'ink' ? 'text-ink' : 'text-ink-2')}
        >
          {label.text}
        </span>
      )}
      <div
        className="ui-inset flex h-11 shrink-0 items-center gap-1 p-1"
        role="group"
        aria-label={t('speed.label')}
        title={held ? t('time.resumesAt', { v: chosen }) : undefined}
      >
        {SPEEDS.map((v) => {
          const active = effective === v
          const c = SPEED_COLOR[v]
          // Active: sunk, tinted, solid edge in its colour. The chosen speed under a focus pause: raised, green edge only.
          const style = active
            ? ({ '--key-fill': `color-mix(in srgb, ${c} ${SPEED_FILL[v]}%, var(--color-surface))`, '--key-edge': c } as CSSProperties)
            : held && chosen === v
              ? ({ '--key-edge': c } as CSSProperties)
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
              data-down={active ? '' : undefined}
              className={cx(
                'ui-key ui-key-sm flex h-8 w-9 flex-col items-center justify-center gap-px rounded-[9px] disabled:opacity-40',
                active ? 'text-ink' : 'ui-key-routine text-ink-2 hover:text-ink',
              )}
              style={style}
            >
              {v === 0 ? (
                <Icon name={playerPaused ? 'play' : 'pause'} size={15} fill={playerPaused ? 'currentColor' : undefined} />
              ) : (
                <>
                  {/* ▶ / ▶▶ / ▶▶▶ over the 1× / 2× / 4× text: the speed reads without the (shared) green. */}
                  <Icon name={SPEED_ICON[v]} size={v === 4 ? 15 : 13} fill="currentColor" />
                  <span className="ui-num text-[10px] leading-none">{`${v}×`}</span>
                </>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
