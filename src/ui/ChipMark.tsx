// The chip's mark on an item in its place (round 6, chipTarget.ts): a brand ring that breathes while marked.
import type { ReactNode } from 'react'
import { useChipMark } from './chipTarget'
import { cx } from './primitives'

export function ChipMark({ k, className, children }: { k: string; className?: string; children: ReactNode }) {
  const { ref, marked, markClass } = useChipMark<HTMLDivElement>(k)
  return (
    <div ref={ref} data-chip-mark={marked ? '' : undefined} className={cx('rounded-control', markClass, className)}>
      {children}
    </div>
  )
}
