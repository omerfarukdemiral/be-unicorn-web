// Ring chart (docs/GAMEPLAY_V2.md §14.4): slices of one total, the biggest number in the hole, legend beside it.
// Slices under 3% fold into one "other" wedge (foldSmall), so nothing is a hairline.
import type { ReactNode } from 'react'
import { Legend, type LegendPart } from '../theme'
import { arcPath, foldSmall } from './scale'

export function PieChart({
  slices,
  center,
  format,
  otherLabel,
  size = 132,
  label,
  track,
}: {
  slices: readonly LegendPart[]
  /** Big number in the hole (share, total). */
  center?: ReactNode
  format: (n: number) => string
  /** Name of the folded < 3% wedge. */
  otherLabel: string
  size?: number
  label: string
  /** Gauge mode (market fill): only the first slice is drawn, over the empty track; the rest of the total stays track. */
  track?: boolean
}) {
  const r = size / 2 - 2
  const ri = r * 0.64
  const c = size / 2
  // Gauge mode keeps the one slice as is (a 2% market fill is still the answer); a split folds the crumbs.
  const kept = track ? slices.slice(0, 1).map((s) => ({ from: 0, value: Math.max(0, s.value) })) : foldSmall(slices.map((s) => s.value))
  const total = track ? slices.reduce((a, s) => a + Math.max(0, s.value), 0) : kept.reduce((a, k) => a + k.value, 0)
  let a = 0
  const wedges = kept.map((k) => {
    const s = k.from >= 0 ? slices[k.from]! : { label: otherLabel, color: 'var(--color-ink-4)', value: k.value }
    const a0 = a
    a += (k.value / total) * 2 * Math.PI
    return { ...s, value: k.value, a0, a1: a }
  })
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg role="img" aria-label={label} width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
          <circle cx={c} cy={c} r={(r + ri) / 2} fill="none" stroke="var(--color-border)" strokeWidth={r - ri} />
          {total > 0 &&
            wedges.map((wd) => <path key={wd.label} d={arcPath(c, c, r, ri, wd.a0, wd.a1)} fill={wd.color} stroke="var(--color-surface)" strokeWidth={wedges.length > 1 ? 1.5 : 0} />)}
        </svg>
        {center !== undefined && <div className="tabular absolute inset-0 grid place-items-center text-[18px] font-semibold leading-none text-ink">{center}</div>}
      </div>
      <Legend parts={wedges.map((wd) => ({ label: wd.label, color: wd.color, value: wd.value }))} format={format} className="min-w-0 flex-1 flex-col" />
    </div>
  )
}
