// Radar (docs/GAMEPLAY_V2.md §14.4): fixed axis order, two polygons: the company (filled, brand) and the investor's
// expectation (dashed outline). Values come normalised by the engine (0–max, 1 = what the stage expects); a null axis
// is grey with a lock and is left out of the polygon.
import { Icon } from '../icons'
import { polar } from './scale'

const RINGS = [0.5, 1, 1.5]

function polygon(values: readonly (number | null)[], c: number, r: number, max: number): string {
  const n = values.length
  return values
    .flatMap((v, i) => {
      if (v === null) return []
      const p = polar(c, c, (Math.max(0, Math.min(max, v)) / max) * r, i, n)
      return [`${p.x.toFixed(1)},${p.y.toFixed(1)}`]
    })
    .join(' ')
}

export function RadarChart({
  axes,
  values,
  target,
  max = 1.5,
  color = 'var(--color-brand)',
  size = 260,
  label,
}: {
  /** Axis names, in drawing order (axis 0 up, then clockwise). */
  axes: readonly string[]
  values: readonly (number | null)[]
  /** Second polygon (due-diligence expectation). */
  target?: readonly (number | null)[]
  max?: number
  color?: string
  size?: number
  label: string
}) {
  const pad = 38
  const box = size + pad * 2
  const c = box / 2
  const r = size / 2
  const n = axes.length
  return (
    <svg role="img" aria-label={label} width="100%" viewBox={`0 0 ${box} ${box}`} className="mx-auto block max-w-[360px] select-none">
      {RINGS.filter((q) => q <= max).map((q) => (
        <polygon
          key={q}
          points={Array.from({ length: n }, (_, i) => {
            const p = polar(c, c, (q / max) * r, i, n)
            return `${p.x},${p.y}`
          }).join(' ')}
          fill="none"
          stroke={q === 1 ? 'var(--color-border-strong)' : 'var(--color-border)'}
          strokeWidth={1}
        />
      ))}
      {axes.map((name, i) => {
        const end = polar(c, c, r, i, n)
        const at = polar(c, c, r + 18, i, n)
        const locked = values[i] === null
        const anchor = Math.abs(at.x - c) < 4 ? 'middle' : at.x > c ? 'start' : 'end'
        return (
          <g key={name}>
            <line x1={c} y1={c} x2={end.x} y2={end.y} stroke="var(--color-border)" strokeWidth={1} strokeDasharray={locked ? '2 3' : undefined} />
            {locked && <Icon name="lock" size={12} x={end.x - 6} y={end.y - 6} className="text-ink-3" />}
            <text x={at.x} y={at.y} dy="0.32em" textAnchor={anchor} className={locked ? 'fill-ink-3 text-[11px] font-semibold' : 'fill-ink-2 text-[11px] font-semibold'}>
              {name}
            </text>
          </g>
        )
      })}
      {target && <polygon points={polygon(target, c, r, max)} fill="none" stroke="var(--color-ink-2)" strokeWidth={1.5} strokeDasharray="5 4" />}
      <polygon points={polygon(values, c, r, max)} fill={`color-mix(in oklab, ${color} 22%, transparent)`} stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {values.map((v, i) => {
        if (v === null) return null
        const p = polar(c, c, (Math.max(0, Math.min(max, v)) / max) * r, i, n)
        return <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />
      })}
    </svg>
  )
}
