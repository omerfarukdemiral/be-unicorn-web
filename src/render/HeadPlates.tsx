// Head plates (H1, design §5): a small DOM card over each seated person: specialty icon, first name, salary, a thin
// fatigue bar and at most one state glyph (tired > low morale > bored; a gold star for a project lead). One drei <Html>
// at the origin holds every plate; one frame callback projects each seat and writes the transform straight to the
// element (no React state per frame). Plates never take taps, bubbles win (a plate that touches a bubble, or belongs
// to someone with one, fades), and they never overlap (fix round 2 N5): laid out nearest-first, a plate that would touch
// one already placed drops its salary, then its name, then hides. The hovered or selected person's plate always shows.
import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { memo, useMemo, useRef } from 'react'
import { Vector3 } from 'three'
import type { GameState } from '../engine/types'
import { DEPT_COLORS } from './palette'
import { declutterPlates, fatigueTone, plateGlyph, plateSalary, plateShown, plateWidths, shortName, type PlateBox, type PlateGlyph, type PlateLevel, type PlateRect } from './headPlate'
import { useHtmlPortal } from './htmlPortal'
import { DEPT_PATH, GLYPH_PATH } from './plateIcons'
import { hoveredPerson, seatedRegistry, speakerPositions } from './sceneRegistry'
import { useGS, useSceneCovered, useUi } from './source'
import { panelSelection } from '../store/gameStore'

/** Anchor height over the floor: just above a seated head. */
const ANCHOR_Y = 1.42
const MEASURE_MS = 150
/** A whole plate's height (px): the name row, the bar and the padding. */
const PLATE_H = 28
/** Plates keep this far (px) inside the screen's side edges. */
const EDGE = 4
const TONE_COLOR = { ok: 'var(--color-positive)', warn: 'var(--color-energy)', bad: 'var(--color-negative)' } as const
const GLYPH_COLOR: Record<PlateGlyph | 'lead', string> = { tired: 'var(--color-energy)', morale: 'var(--color-g-sky)', bored: 'var(--color-ink-3)', lead: 'var(--color-g-equity)' }

interface Plate {
  id: string
  name: string
  salary: string
  dept: keyof typeof DEPT_COLORS
  lead: boolean
  fatigue: number
  glyph: PlateGlyph | null
}

const SEP = '\u001f'

/** One primitive per day-granular change: the store clones state every tick, so an array selector would re-render at 60 Hz. */
function selectKey(s: GameState): string {
  const leads = new Set<string>()
  for (const p of s.projects) if (p.leadId) leads.add(p.leadId)
  const fx = { day: Math.floor(s.time.day), people: s.derived.people }
  const rows: string[] = []
  for (const e of s.employees) {
    if (!e.deskSlotId) continue
    rows.push([e.id, shortName(e.name), plateSalary(e.salary), e.dept, leads.has(e.id) ? 1 : 0, Math.round((e.fatigue ?? 0) / 5) * 5, plateGlyph(e, fx) ?? ''].join(SEP))
  }
  return rows.join('\n')
}

function parse(key: string): Plate[] {
  if (!key) return []
  return key.split('\n').map((row) => {
    const [id, name, salary, dept, lead, fatigue, glyph] = row.split(SEP)
    return { id: id!, name: name!, salary: salary!, dept: dept as Plate['dept'], lead: lead === '1', fatigue: Number(fatigue), glyph: (glyph || null) as PlateGlyph | null }
  })
}

function Glyph({ d, color, size }: { d: React.ReactNode; color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      {d}
    </svg>
  )
}

interface Refs {
  root: HTMLDivElement | null
  text: HTMLElement | null
  salary: HTMLElement | null
  /** Widths per level, from the plate's text. */
  w: PlateBox['w'] | null
  /** Measured state, so the DOM is written only when it changes. */
  shown: boolean
  level: PlateLevel
  seen: boolean
}

const PlateView = memo(function PlateView({ plate, reg }: { plate: Plate; reg: (id: string, r: Partial<Refs> | null) => void }) {
  const color = DEPT_COLORS[plate.dept]
  const tone = TONE_COLOR[fatigueTone(plate.fatigue)]
  return (
    <div
      data-head-plate={plate.id}
      ref={(el) => reg(plate.id, el ? { root: el, w: plateWidths(plate) } : null)}
      className="absolute left-0 top-0 w-max rounded-lg bg-surface/85 px-1.5 pb-1 pt-1 backdrop-blur-sm"
      style={{ opacity: 0, transition: 'opacity 150ms ease-out', willChange: 'transform' }}
    >
      <div className="flex items-center gap-1 leading-none">
        <span className="grid size-[16px] shrink-0 place-items-center rounded-full" style={{ background: color }}>
          <Glyph d={DEPT_PATH[plate.dept]} color="#fff" size={11} />
        </span>
        {plate.lead && <Glyph d={GLYPH_PATH.lead} color={GLYPH_COLOR.lead} size={12} />}
        <span ref={(el) => reg(plate.id, { text: el })} className="flex items-center gap-1">
          <span className="text-[11px] font-semibold text-ink">{plate.name}</span>
          <span ref={(el) => reg(plate.id, { salary: el })} className="text-[10px] tabular-nums text-ink-2">
            {plate.salary}
          </span>
          {plate.glyph && <Glyph d={GLYPH_PATH[plate.glyph]} color={GLYPH_COLOR[plate.glyph]} size={13} />}
        </span>
      </div>
      <div className="mt-[3px] h-[3px] overflow-hidden rounded-full bg-ink/10">
        <div className="h-full rounded-full" style={{ width: `${Math.max(6, Math.min(100, plate.fatigue))}%`, background: tone }} />
      </div>
    </div>
  )
})

const tmp = new Vector3()

export function HeadPlates() {
  const portal = useHtmlPortal()
  const key = useGS(selectKey)
  const plates = useMemo(() => parse(key), [key])
  const covered = useSceneCovered()
  const zoom = useUi((u) => u.zoom)
  const selected = useUi((u) => {
    const sel = panelSelection(u.panel)
    return sel?.kind === 'employee' ? sel.id : null
  })
  const refs = useRef(new Map<string, Refs>())
  const gate = useRef({ covered, zoom, selected })
  gate.current = { covered, zoom, selected }
  const last = useRef(0)
  /** Obstacle rects and bubble owners, refreshed every MEASURE_MS (DOM reads). */
  const obstacles = useRef<PlateRect[]>([])
  const owners = useRef(new Set<string>())
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const gl = useThree((s) => s.gl)

  const reg = useMemo(
    () => (id: string, r: Partial<Refs> | null) => {
      if (!r) {
        refs.current.delete(id)
        return
      }
      const cur = refs.current.get(id)
      // A re-mounted ref callback (new Plate objects every key change) must not forget what the DOM already shows.
      const fresh = { ...r }
      if (r.root) (fresh as Partial<Refs>).shown = r.root.style.opacity === '1'
      // A fresh text / salary element shows everything: the level is written again on the next frame.
      if (r.text || r.salary) (fresh as Partial<Refs>).level = 'full'
      if (cur) Object.assign(cur, fresh)
      else refs.current.set(id, { root: null, text: null, salary: null, w: null, shown: false, level: 'full', seen: false, ...fresh })
    },
    [],
  )

  useFrame(() => {
    const now = performance.now()
    if (now - last.current > MEASURE_MS) {
      last.current = now
      // DOM reads, throttled: bubbles / status chips and the "+N" floats are obstacles plates keep off; a bubble of
      // the person's own hides their plate (bubbles win).
      const c = gl.domElement.getBoundingClientRect()
      const obs: PlateRect[] = []
      const speakers: (string | undefined)[] = []
      for (const el of document.querySelectorAll<HTMLElement>('[data-bubble-key]')) {
        if (el.style.visibility === 'hidden' || el.style.opacity === '0') continue
        speakers.push(el.dataset.bubbleSpeaker)
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) obs.push({ l: r.left - c.left, r: r.right - c.left, t: r.top - c.top, b: r.bottom - c.top })
      }
      for (const el of document.querySelectorAll<HTMLElement>('[data-juice-float] > *')) {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) obs.push({ l: r.left - c.left, r: r.right - c.left, t: r.top - c.top, b: r.bottom - c.top })
      }
      obstacles.current = obs
      owners.current = new Set(speakers.filter((x): x is string => !!x))
    }
    const pos = new Map<string, [number, number]>()
    const boxes: PlateBox[] = []
    const pinned = (id: string) => id === gate.current.selected || id === hoveredPerson.id
    for (const [id, r] of refs.current) {
      const sp = speakerPositions.get(id)
      if (!r.root || !r.w || !sp || !seatedRegistry.get(id)) continue
      tmp.set(sp.x, ANCHOR_Y, sp.z).project(camera)
      const x = (tmp.x + 1) * (size.width / 2)
      const y = (1 - tmp.y) * (size.height / 2)
      pos.set(id, [x, y])
      if (owners.current.has(id)) continue
      boxes.push({ id, x, y, w: r.w, h: PLATE_H, pinned: pinned(id) })
    }
    const laid = declutterPlates(boxes, gate.current.zoom === 0 ? 'icon' : 'full', obstacles.current, { minX: EDGE, maxX: size.width - EDGE })
    for (const [id, r] of refs.current) {
      const el = r.root
      if (!el) continue
      const p = pos.get(id)
      const got = laid.get(id)
      const level = got?.level ?? 'hidden'
      const shown = !!p && level !== 'hidden' && plateShown({ seated: true, covered: gate.current.covered, ownBubble: owners.current.has(id), overlapsBubble: false })
      if (p) {
        // Centred over the anchor (slid inside the screen edge), bottom edge on it.
        el.style.transform = `translate3d(${Math.round(got?.x ?? p[0])}px, ${Math.round(p[1])}px, 0) translate(-50%, -100%)`
      }
      if (shown !== r.shown) {
        r.shown = shown
        el.style.opacity = shown ? '1' : '0'
      }
      if (level !== 'hidden' && level !== r.level && r.text && r.salary) {
        r.level = level
        r.text.style.display = level === 'icon' ? 'none' : ''
        r.salary.style.display = level === 'full' ? '' : 'none'
      }
    }
  })

  return (
    <Html portal={portal} calculatePosition={() => [0, 0]} zIndexRange={[12, 10]} wrapperClass="pointer-events-none" style={{ pointerEvents: 'none' }}>
      <div className="pointer-events-none" style={{ pointerEvents: 'none' }}>
        {plates.map((pl) => (
          <PlateView key={pl.id} plate={pl} reg={reg} />
        ))}
      </div>
    </Html>
  )
}
