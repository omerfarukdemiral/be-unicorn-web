// Line chart (docs/GAMEPLAY_V2.md §14.4), hand-drawn SVG: several series, the last point filled with its value, a
// dashed projection, vertical marks (payday / crisis / board), horizontal target lines, click-to-select a month.
// No hover tooltip (touch screens): a tap selects the nearest x and the tile header prints that month.
// Colours come in as props (one gauge hue per series, ≤ 4 per chart); red only for the `danger` point.
import { useEffect, useRef, useState, type RefObject } from 'react'
import { linear, niceTicks } from './scale'

export type LinePoint = { x: number; y: number | null }

export interface LineSeries {
  id: string
  color: string
  points: readonly LinePoint[]
  /** Thin grey reference line (e.g. the lead rival's valuation): no end dot, no value. */
  thin?: boolean
}

export interface ChartMark {
  x: number
  color?: string
}

export interface TargetLine {
  y: number
  label: string
  color?: string
}

const PAD = { top: 10, right: 44, bottom: 18, left: 38 }

/** Container width in px (ResizeObserver); `fallback` on the server and before the first measure. */
export function useWidth(fallback = 320): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null)
  const [w, setW] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => {
      const next = Math.round(e?.contentRect.width ?? 0)
      if (next > 0) setW(next)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

export function reducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** Split at null gaps: one `M…L…` run per unbroken stretch. */
function pathOf(points: readonly LinePoint[], sx: (v: number) => number, sy: (v: number) => number): string {
  let d = ''
  let open = false
  for (const p of points) {
    if (p.y === null || !Number.isFinite(p.y)) {
      open = false
      continue
    }
    d += `${open ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`
    open = true
  }
  return d
}

function lastPoint(points: readonly LinePoint[]): { x: number; y: number } | null {
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i]!
    if (p.y !== null && Number.isFinite(p.y)) return { x: p.x, y: p.y }
  }
  return null
}

export function LineChart({
  series,
  projection,
  danger,
  marks = [],
  targets = [],
  height = 200,
  formatY,
  formatX,
  zeroFloor = true,
  selectedX = null,
  onSelect,
  animate = false,
  label,
}: {
  series: readonly LineSeries[]
  /** Dashed continuation of the first series (cash projection). */
  projection?: readonly LinePoint[]
  /** The one red mark: where the line hits the floor (Kasa biter). */
  danger?: { x: number; y: number } | null
  marks?: readonly ChartMark[]
  targets?: readonly TargetLine[]
  height?: number
  formatY: (n: number) => string
  formatX: (x: number) => string
  /** Keep 0 on the y axis (money, users); off for ratios that never reach it. */
  zeroFloor?: boolean
  selectedX?: number | null
  onSelect?: (x: number | null) => void
  /** Draw the lines in once (400 ms stroke-dashoffset); the screen passes it on its first open only. */
  animate?: boolean
  /** Accessible name of the chart. */
  label: string
}) {
  const [box, width] = useWidth()
  const svg = useRef<SVGSVGElement | null>(null)
  const drawn = useRef(false)

  // The death point is in the domain too: it can lie past the projection's last payday.
  const all = [...series.flatMap((s) => s.points), ...(projection ?? []), ...(danger ? [danger] : [])]
  const xs = all.map((p) => p.x)
  const ys = all.flatMap((p) => (p.y === null || !Number.isFinite(p.y) ? [] : [p.y]))
  for (const tl of targets) ys.push(tl.y)
  if (zeroFloor) ys.push(0)
  const x0 = xs.length ? Math.min(...xs) : 0
  const x1 = xs.length ? Math.max(...xs) : 1
  const ticks = niceTicks(ys.length ? Math.min(...ys) : 0, ys.length ? Math.max(...ys) : 1)
  const w = Math.max(160, width)
  const sx = linear([x0, x1], [PAD.left, w - PAD.right])
  const sy = linear([ticks[0]!, ticks.at(-1)!], [height - PAD.bottom, PAD.top])

  // First open: each solid line draws itself in (pathLength 1 → dash offset 1 → 0). Once per mount, off for reduced motion.
  useEffect(() => {
    if (drawn.current) return
    drawn.current = true
    if (!animate || reducedMotion() || !svg.current) return
    for (const el of svg.current.querySelectorAll<SVGPathElement>('path[data-draw]')) {
      el.animate?.([{ strokeDasharray: '1 1', strokeDashoffset: 1 }, { strokeDasharray: '1 1', strokeDashoffset: 0 }], { duration: 400, easing: 'ease-out' })
    }
  }, [animate])

  const pick = (clientX: number) => {
    if (!onSelect || !svg.current) return
    const r = svg.current.getBoundingClientRect()
    const px = ((clientX - r.left) / r.width) * w
    let best: number | null = null
    let dist = Infinity
    for (const p of series[0]?.points ?? []) {
      const d = Math.abs(sx(p.x) - px)
      if (d < dist) {
        dist = d
        best = p.x
      }
    }
    onSelect(best === selectedX ? null : best)
  }

  const selY = (s: LineSeries): number | null => {
    if (selectedX === null) return null
    const p = s.points.find((q) => q.x === selectedX)
    return p && p.y !== null && Number.isFinite(p.y) ? p.y : null
  }
  const lastSolid = series[0] ? lastPoint(series[0].points) : null

  return (
    <div ref={box} className="w-full min-w-0">
      <svg
        ref={svg}
        role="img"
        aria-label={label}
        width="100%"
        height={height}
        viewBox={`0 0 ${w} ${height}`}
        className={onSelect ? 'block cursor-pointer select-none' : 'block select-none'}
        onClick={(e) => pick(e.clientX)}
      >
        {/* Grid: hairlines on the round ticks, the value at the left edge. */}
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={w - PAD.right} y1={sy(v)} y2={sy(v)} stroke={v === 0 ? 'var(--color-border-strong)' : 'var(--color-border)'} strokeWidth={1} />
            <text x={PAD.left - 6} y={sy(v)} dy="0.32em" textAnchor="end" className="tabular fill-ink-3 text-[10px]">
              {formatY(v)}
            </text>
          </g>
        ))}
        <text x={PAD.left} y={height - 4} className="tabular fill-ink-3 text-[10px]">
          {formatX(x0)}
        </text>
        <text x={w - PAD.right} y={height - 4} textAnchor="end" className="tabular fill-ink-3 text-[10px]">
          {formatX(x1)}
        </text>

        {marks.map((m, i) => (
          <line key={`m${i}`} x1={sx(m.x)} x2={sx(m.x)} y1={PAD.top} y2={height - PAD.bottom} stroke={m.color ?? 'var(--color-border-strong)'} strokeWidth={1} strokeDasharray="2 3" />
        ))}

        {targets.map((tl) => (
          <g key={tl.label}>
            <line x1={PAD.left} x2={w - PAD.right} y1={sy(tl.y)} y2={sy(tl.y)} stroke={tl.color ?? 'var(--color-ink-3)'} strokeWidth={1} strokeDasharray="5 4" />
            <text x={w - PAD.right + 4} y={sy(tl.y)} dy="0.32em" className="fill-ink-2 text-[10px] font-semibold">
              {tl.label}
            </text>
          </g>
        ))}

        {projection && projection.length > 0 && lastSolid && series[0] && (
          <path
            d={pathOf([lastSolid, ...projection], sx, sy)}
            fill="none"
            stroke={series[0].color}
            strokeOpacity={0.7}
            strokeWidth={1.75}
            strokeDasharray="4 4"
            strokeLinejoin="round"
          />
        )}

        {series.map((s) => (
          <path
            key={s.id}
            data-draw={s.thin ? undefined : ''}
            pathLength={s.thin ? undefined : 1}
            d={pathOf(s.points, sx, sy)}
            fill="none"
            stroke={s.thin ? 'var(--color-ink-4)' : s.color}
            strokeWidth={s.thin ? 1.25 : 2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {series.map((s) => {
          if (s.thin) return null
          const p = lastPoint(s.points)
          if (!p) return null
          return (
            <g key={`${s.id}-end`}>
              <circle cx={sx(p.x)} cy={sy(p.y)} r={3.5} fill={s.color} stroke="var(--color-surface)" strokeWidth={1.5} />
              <text x={sx(p.x) + 6} y={sy(p.y)} dy="0.32em" className="tabular fill-ink text-[11px] font-semibold">
                {formatY(p.y)}
              </text>
            </g>
          )
        })}

        {danger && (
          <g>
            <circle cx={sx(danger.x)} cy={sy(danger.y)} r={4.5} fill="var(--color-negative)" stroke="var(--color-surface)" strokeWidth={1.5} />
          </g>
        )}

        {selectedX !== null && (
          <g>
            <line x1={sx(selectedX)} x2={sx(selectedX)} y1={PAD.top} y2={height - PAD.bottom} stroke="var(--color-ink-2)" strokeWidth={1} />
            {series.map((s) => {
              const y = selY(s)
              return y === null || s.thin ? null : <circle key={`${s.id}-sel`} cx={sx(selectedX)} cy={sy(y)} r={3} fill="var(--color-surface)" stroke={s.color} strokeWidth={2} />
            })}
          </g>
        )}
      </svg>
    </div>
  )
}
