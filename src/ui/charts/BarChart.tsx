// Bar chart (docs/GAMEPLAY_V2.md §14.4): grouped and/or stacked columns per x. Each group holds one column per `bars`
// entry; a column with several parts stacks them (ramp() strengths of one hue). A one-part column may go below zero
// (users lost). Legend under the chart, no tooltip.
import type { ReactNode } from 'react'
import { Legend, type LegendPart } from '../theme'
import { useWidth } from './LineChart'
import { linear, niceTicks, stackParts } from './scale'

export interface BarDef {
  /** Column name (legend). */
  label: string
  /** Part names + colours, bottom first; one part = a plain column. */
  parts: readonly { label: string; color: string }[]
}

export interface BarGroup {
  x: number
  /** values[bar][part]. */
  values: readonly (readonly number[])[]
}

const PAD = { top: 8, right: 8, bottom: 18, left: 38 }

export function BarChart({
  bars,
  groups,
  height = 180,
  formatY,
  formatX,
  legendFormat,
  label,
  selectedX = null,
  labelEach = false,
}: {
  bars: readonly BarDef[]
  groups: readonly BarGroup[]
  height?: number
  formatY: (n: number) => string
  formatX: (x: number) => string
  /** Legend values are the newest group's; omit to show names only. */
  legendFormat?: (n: number) => string
  label: string
  selectedX?: number | null
  /** Name every group under its columns (categories: departments); default = first and last x only (months). */
  labelEach?: boolean
}) {
  const [box, width] = useWidth()
  const w = Math.max(160, width)
  let lo = 0
  let hi = 0
  for (const g of groups)
    g.values.forEach((vals) => {
      if (vals.length === 1) lo = Math.min(lo, vals[0] ?? 0)
      hi = Math.max(hi, stackParts(vals).at(-1)?.y1 ?? 0)
    })
  const ticks = niceTicks(lo, hi)
  const sy = linear([ticks[0]!, ticks.at(-1)!], [height - PAD.bottom, PAD.top])
  const slot = (w - PAD.left - PAD.right) / Math.max(1, groups.length)
  const gap = Math.min(6, slot * 0.25)
  const colW = Math.max(1, (slot - gap) / Math.max(1, bars.length))

  const cols: ReactNode[] = []
  groups.forEach((g, gi) => {
    const dim = selectedX !== null && g.x !== selectedX
    g.values.forEach((vals, bi) => {
      const x = PAD.left + gi * slot + gap / 2 + bi * colW
      const def = bars[bi]
      if (!def) return
      if (vals.length === 1 && (vals[0] ?? 0) < 0) {
        const v = vals[0]!
        cols.push(<rect key={`${gi}-${bi}`} x={x} width={Math.max(1, colW - 1)} y={sy(0)} height={Math.max(0, sy(v) - sy(0))} fill={def.parts[0]?.color} opacity={dim ? 0.35 : 1} />)
        return
      }
      stackParts(vals).forEach((p, pi) => {
        if (p.y1 <= p.y0) return
        cols.push(
          <rect
            key={`${gi}-${bi}-${pi}`}
            x={x}
            width={Math.max(1, colW - 1)}
            y={sy(p.y1)}
            height={Math.max(0.5, sy(p.y0) - sy(p.y1))}
            fill={def.parts[pi]?.color}
            opacity={dim ? 0.35 : 1}
          />,
        )
      })
    })
  })

  // Legend: every part of every column (≤ 4 hues per chart; the stack is one hue in ramp strengths).
  const newest = groups.at(-1)
  const legend: LegendPart[] = bars.flatMap((b, bi) =>
    b.parts.map((p, pi) => ({ label: p.label, color: p.color, value: legendFormat ? (newest?.values[bi]?.[pi] ?? 0) : 1 })),
  )

  return (
    <div ref={box} className="w-full min-w-0">
      <svg role="img" aria-label={label} width="100%" height={height} viewBox={`0 0 ${w} ${height}`} className="block select-none">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={w - PAD.right} y1={sy(v)} y2={sy(v)} stroke={v === 0 ? 'var(--color-border-strong)' : 'var(--color-border)'} strokeWidth={1} />
            <text x={PAD.left - 6} y={sy(v)} dy="0.32em" textAnchor="end" className="tabular fill-ink-3 text-[10px]">
              {formatY(v)}
            </text>
          </g>
        ))}
        {cols}
        {labelEach &&
          groups.map((g, gi) => (
            <text key={`x${gi}`} x={PAD.left + gi * slot + slot / 2} y={height - 4} textAnchor="middle" className="fill-ink-2 text-[10px] font-semibold">
              {formatX(g.x)}
            </text>
          ))}
        {!labelEach && groups.length > 0 && (
          <>
            <text x={PAD.left} y={height - 4} className="tabular fill-ink-3 text-[10px]">
              {formatX(groups[0]!.x)}
            </text>
            <text x={w - PAD.right} y={height - 4} textAnchor="end" className="tabular fill-ink-3 text-[10px]">
              {formatX(groups.at(-1)!.x)}
            </text>
          </>
        )}
      </svg>
      <Legend parts={legend} format={legendFormat ?? (() => '')} className="mt-1.5" />
    </div>
  )
}
