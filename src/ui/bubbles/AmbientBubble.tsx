// Ambient office line (PLAN §6.4): short, not clickable, ~3 s visible.
import { useShallow } from 'zustand/react/shallow'
import { OFFICE_LINES } from '../../content'
import { useGameStore } from '../../store/gameStore'
import { cx } from '../primitives'
import { speakerName } from './speaker'

export const AMBIENT_MS = 3_000

/** Presentational; fades in and out over 3 s via CSS. `pointer-events-none` by design. */
export function AmbientBubbleView({ text, speaker, className }: { text: string; speaker?: string; className?: string }) {
  return (
    <div
      role="status"
      className={cx(
        'pointer-events-none max-w-[min(280px,80vw)] animate-ambient rounded-2xl rounded-bl-sm bg-cream-50/95 px-3 py-1.5 text-xs text-ink-900 shadow-[var(--shadow-card)]',
        className,
      )}
    >
      {speaker && <span className="mr-1 font-bold text-ink-600">{speaker}:</span>}
      {text}
    </div>
  )
}

/** Connected: newest ambient bubbles from state (screen-space fallback). */
export function AmbientBubbles({ max = 2 }: { max?: number }) {
  const bubbles = useGameStore(useShallow((s) => s.state.bubbles))
  const day = useGameStore((s) => s.state.time.day)
  const names = useGameStore(
    useShallow((s) => s.state.bubbles.slice(-max).map((b) => speakerName(s.state, b.speakerId))),
  )
  const visible = bubbles.slice(-max)
  return (
    <div className="flex flex-col items-start gap-1">
      {visible.map((b, i) => {
        if (b.untilDay < day) return null
        const line = OFFICE_LINES.find((l) => l.id === b.lineId)
        if (!line) return null
        return <AmbientBubbleView key={b.id} text={line.text} speaker={names[i]} />
      })}
    </div>
  )
}
