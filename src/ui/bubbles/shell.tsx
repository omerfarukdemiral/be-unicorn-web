// Shared speech-bubble chrome (lane C): surface, 1px hairline, light shadow, optional tail.
// Bubble kinds are told apart by a small coloured mark next to the speaker (karar = orange, kavram =
// violet: --color-kind-*). An actionable bubble's pill and its open header sit on a light ground of that colour (T15,
// "çizgi yerine renkli zemin"); the answers below stay on the neutral surface so their green / red chips keep reading.
import type { CSSProperties, ReactNode } from 'react'
import { Icon, type IconName } from '../icons'
import { cx } from '../primitives'
import { iconTone, soft } from '../theme'

/** Surface + hairline + card radius. Interactive bubbles add hover/press feedback. */
export const BUBBLE_SHELL = 'relative rounded-card border border-border bg-surface shadow-card'
export const BUBBLE_HOVER = 'transition-[transform,border-color] duration-150 hover:-translate-y-0.5 hover:border-border-strong active:translate-y-0'

/** The light ground of a kind colour (pill, open header) and its hairline. */
export function tintGround(color: string): CSSProperties {
  return { background: `color-mix(in oklab, ${color} 13%, var(--color-surface))`, borderColor: `color-mix(in oklab, ${color} 36%, var(--color-surface))` }
}

/** Hairline only (an open card: tinted edge, neutral body). */
export function tintEdge(color: string): CSSProperties {
  return { borderColor: `color-mix(in oklab, ${color} 36%, var(--color-surface))` }
}

/** Small tail pointing at the speaker (centred; the bubble is centred above the head). `style` matches its bubble's ground. */
export function BubbleTail({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      style={style}
      className={cx('bubble-tail pointer-events-none absolute -bottom-[5px] left-1/2 size-2.5 -translate-x-1/2 rotate-45 border-b border-r border-border bg-surface', className)}
    />
  )
}

/** Speaker line: kind mark (tiny icon on a light tile of `color`) + speaker name as a .ui-label, then an optional topic in ink. */
export function SpeakerLine({ icon, color, speaker, topic, className }: { icon?: IconName; color?: string; speaker?: string; topic?: string; className?: string }) {
  if (!icon && !speaker && !topic) return null
  return (
    <span className={cx('ui-label flex min-w-0 items-center gap-1 leading-none', className)}>
      {icon &&
        (color ? (
          <span aria-hidden="true" className="grid size-[18px] shrink-0 place-items-center rounded-[5px]" style={{ color: iconTone(color), background: soft(color, 14) }}>
            <Icon name={icon} size={11} />
          </span>
        ) : (
          <Icon name={icon} size={11} className="shrink-0 text-ink" />
        ))}
      {(speaker || topic) && (
        <span className="min-w-0 truncate">
          {speaker}
          {speaker && topic && ' · '}
          {topic && <span className="text-ink">{topic}</span>}
        </span>
      )}
    </span>
  )
}

/** Reading text inside a bubble (Inter). Use inside a flex column (children are blockified). */
export function BubbleText({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('font-text text-[13px] font-medium leading-snug text-ink', className)}>{children}</span>
}
