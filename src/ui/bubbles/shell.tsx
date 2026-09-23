// Shared speech-bubble chrome (lane C): neutral surface, 1px hairline, light shadow, optional tail.
// Bubble kinds are told apart by a small icon mark next to the speaker, never by coloured frames.
import type { ReactNode } from 'react'
import { Icon, type IconName } from '../icons'
import { cx } from '../primitives'

/** Surface + hairline + card radius. Interactive bubbles add hover/press feedback. */
export const BUBBLE_SHELL = 'relative rounded-card border border-border bg-surface shadow-card'
export const BUBBLE_HOVER = 'transition-[transform,border-color] duration-150 hover:-translate-y-0.5 hover:border-border-strong active:translate-y-0'

/** Small tail pointing at the speaker (centred; the bubble is centred above the head). */
export function BubbleTail({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx('pointer-events-none absolute -bottom-[5px] left-1/2 size-2.5 -translate-x-1/2 rotate-45 border-b border-r border-border bg-surface', className)}
    />
  )
}

/** Speaker line: kind mark (tiny icon) + speaker name as a .ui-label (same label style as HUD/panels). */
export function SpeakerLine({ icon, speaker, className }: { icon?: IconName; speaker?: string; className?: string }) {
  if (!icon && !speaker) return null
  return (
    <span className={cx('ui-label flex min-w-0 items-center gap-1 leading-none', className)}>
      {icon && <Icon name={icon} size={11} className="shrink-0 text-ink" />}
      {speaker && <span className="truncate">{speaker}</span>}
    </span>
  )
}

/** Reading text inside a bubble (Inter). Use inside a flex column (children are blockified). */
export function BubbleText({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('font-text text-[13px] font-medium leading-snug text-ink', className)}>{children}</span>
}
