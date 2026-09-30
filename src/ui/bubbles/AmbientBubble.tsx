// Ambient office line (PLAN §6.4): short, not clickable, ~3 s visible. Only people coming and going or a crisis
// speak, at most one line a game day, from the strip's daily budget (docs/GAMEPLAY_V2.md §9.4).
import { useShallow } from 'zustand/react/shallow'
import { OFFICE_LINES } from '../../content'
import { useGameStore } from '../../store/gameStore'
import { admitOfficeLine, sharedBudget } from '../layout/stripRules'
import { cx } from '../primitives'
import { BubbleTail, SpeakerLine } from './shell'
import { speakerName } from './speaker'

export const AMBIENT_MS = 3_000

/** Verdict per bubble (generation|id): a line asked again while on screen keeps its answer and its budget slot. */
const officeVerdicts = new Map<string, boolean>()

/** Whether this office line may show: its trigger speaks and today's office-line budget has room. */
export function officeLineShown(bubbleId: string, lineId: string): boolean {
  const { ui, state } = useGameStore.getState()
  const key = `${ui.generation}|${bubbleId}`
  const known = officeVerdicts.get(key)
  if (known !== undefined) return known
  const trigger = OFFICE_LINES.find((l) => l.id === lineId)?.trigger
  const [ok, next] = admitOfficeLine(sharedBudget.current, trigger, state.time.day)
  sharedBudget.current = next
  if (officeVerdicts.size > 256) officeVerdicts.clear()
  officeVerdicts.set(key, ok)
  return ok
}

/** Presentational; fades in and out over 3 s via CSS. `pointer-events-none` by design. */
export function AmbientBubbleView({ text, speaker, className, tail }: { text: string; speaker?: string; className?: string; tail?: boolean }) {
  return (
    <div
      role="status"
      className={cx(
        'pointer-events-none relative max-w-[min(280px,80vw)] animate-ambient rounded-card border border-border bg-surface/95 px-2.5 py-1.5 font-text text-xs leading-snug text-ink shadow-card',
        className,
      )}
    >
      {speaker && <SpeakerLine speaker={speaker} className="mb-1" />}
      <span className="block">{text}</span>
      {tail && <BubbleTail />}
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
        if (b.untilDay < day || !officeLineShown(b.id, b.lineId)) return null
        const line = OFFICE_LINES.find((l) => l.id === b.lineId)
        if (!line) return null
        return <AmbientBubbleView key={b.id} text={line.text} speaker={names[i]} />
      })}
    </div>
  )
}
