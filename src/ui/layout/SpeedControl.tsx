// Speed control (top bar, section C): ⏸ 1× 2× 4× + the time status label. With the thin ScreenFrame this is
// the ONLY place the speed colour appears (docs/LAYOUT.md §4.2). Paused = calm red, running = green; the speeds
// differ by icon (▶ / ▶▶ / ▶▶▶) and fill density, never by hue (docs/GAMEPLAY_V2.md §13). ONE soft inset pill holds
// the four segments: no box per segment, only the active one is filled (its colour tint, ink text); the chosen speed
// during a focus pause keeps a small green underline. No frames, no dashed outlines anywhere.
import { useRef, type CSSProperties } from 'react'
import type { GameSpeed } from '../../engine/types'
import { useGameStore } from '../../store/gameStore'
import { Icon, type IconName } from '../icons'
import { t } from '../i18n'
import { BARE_HOVER, cx } from '../primitives'
import { holdLabel, isFocusHold, SPEED_COLOR, SPEED_FILL, useRecentSlowdown, useTimeStatus, type TimeStatus } from '../time'

const SPEEDS: GameSpeed[] = [0, 1, 2, 4]

/** Running speed icon: one, two or three triangles. */
const SPEED_ICON: Record<Exclude<GameSpeed, 0>, IconName> = { 1: 'play', 2: 'play2', 4: 'play3' }

/** The filled segment's colour: the speed colour at SPEED_FILL density over the surface. Background only: an inline
 * box-shadow would beat the press utilities below, so the lift lives in FILL_LIFT. */
function fillStyle(speed: GameSpeed): CSSProperties {
  return { background: `color-mix(in srgb, ${SPEED_COLOR[speed]} ${SPEED_FILL[speed]}%, var(--color-surface))` }
}

/** A whisper of lift on the filled segment (no edge); a press drops it 1px and the lift goes flat. */
const FILL_LIFT =
  'shadow-[inset_0_1px_0_rgb(255_255_255/.55),0_1px_2px_rgb(74_52_28/.16)] transition-[transform,box-shadow,background-color] duration-100 enabled:active:translate-y-px enabled:active:shadow-none'

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
    // Plain pause: the red-filled pause segment already says it (no "Duraklatıldı" word, 2026-10-06).
    return null
  }
  if (slowed) return { text: t('top.slowed'), title: t('time.slowed'), tone: 'ink' }
  // Running: the green-filled segment says it; no "Zaman akıyor" flash.
  return null
}

/**
 * Desktop: one pill with ⏸ 1× 2× 4× inside. The filled segment is the speed time really runs at (a focus pause
 * fills the pause segment red; the chosen speed keeps a small green underline meanwhile). Text and icons stay ink
 * on every fill (calm: a focus pause never flashes a solid red).
 * Phone (`compact`): one 44px pill cycling pause → 1× → 2× → 4×, filled with the current speed's tint.
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
    const now = still ? t('time.paused') : `${effective}×`
    const next = nextSpeed === 0 ? t('speed.pause') : `${nextSpeed}×`
    return (
      <button
        type="button"
        onClick={() => setSpeed(nextSpeed)}
        disabled={time.gameOver}
        aria-label={t('top.speedCycle', { v: now, next })}
        title={label?.title ?? t('top.speedCycle', { v: now, next })}
        className={cx('ui-num flex h-11 min-w-11 shrink-0 items-center justify-center gap-0.5 rounded-full px-3 text-[13px] text-ink disabled:opacity-40', FILL_LIFT)}
        style={fillStyle(effective)}
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
        className="ui-inset flex h-11 shrink-0 items-center gap-0.5 rounded-full p-1"
        role="group"
        aria-label={t('speed.label')}
        title={held ? t('time.resumesAt', { v: chosen }) : undefined}
      >
        {SPEEDS.map((v) => {
          const active = effective === v
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
                'relative flex h-9 w-9 flex-col items-center justify-center gap-px rounded-full disabled:opacity-40',
                active ? cx('text-ink', FILL_LIFT) : cx('text-ink-2 transition-colors enabled:hover:text-ink', BARE_HOVER),
              )}
              style={active ? fillStyle(v) : undefined}
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
              {/* The speed time returns to after a focus pause: a short green underline, no frame. */}
              {held && chosen === v && (
                <span aria-hidden="true" className="absolute bottom-[3px] left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full" style={{ background: SPEED_COLOR[v] }} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
