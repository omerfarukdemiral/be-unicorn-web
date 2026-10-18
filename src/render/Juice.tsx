// Scene juice for the core loop beats (docs/CORE_LOOP.md §7), kept apart from Office/Npc/Character:
// - release moment: a short toast at the top edge of the scene, under the top HUD (version name; a module or a version
//   also names itself and its wave, with the wave as a "+N" float over the desk), a light pulse,
//   confetti (from v1 on; MVP already celebrates via projectLaunched) and a wave of simple user figures walking in;
// - payday: a short warm-red light pulse over the office, and the amount paid rising over the desk;
// - a manual user hunt (founder action): a few figures walk in through the door and "+N" rises over the desk
//   (playtest 2026-10-06: the result is seen where it happens, not only as a number changing in the top bar).
// Watches state.events with its own cursor; a new game / loaded save skips the history.
// Runs on scene time (sceneRegistry.sceneTime): while a bubble holds the world nothing here moves or expires.
import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { GameState, ReleaseEntry } from '../engine/types'
import { UI_TEXT, moduleName } from '../content'
import { slotsOpened } from '../engine/modules'
import { CELL } from './constants'
import { Confetti } from './Effects'
import { pathFromDoor, type XZ } from './layout'
import { isFreeFloor } from './nav'
import { pawnSpots } from './spots'
import { useHtmlPortal } from './htmlPortal'
import { CONFETTI_COLORS } from './palette'
import { celebrate, sceneTime, useLayout, useSceneTimers } from './sceneRegistry'
import { useGS, useSceneCovered, useUi } from './source'
import { useYieldToBubbles } from './yieldToBubbles'
import { DOOR_FADE } from './walker'
import { usePaydayCardOn } from '../ui/toastSlot'

const MAX_FIGURES = 8
const WALK_SPEED = 2.4 // world units / s
const FIGURE_LINGER = 1.4 // s at the spot before fading
/** The release toast's life (ms of scene time): a short toast, gone before the next beat. */
const BANNER_MS = 2800
/** Gap (px) between the toast and the top HUD islands above it. */
const TOAST_GAP = 8
/** The wave (banner + figures) unmounts after this long. */
const WAVE_MS = 9000
const PULSE_MS = 1400
/** A scene float's life (ms); several stack upwards. */
const FLOAT_MS = 1800
/** At most a users float and a payday float at once: several "+N" stacked over a desk covered its plates (round 3). */
const MAX_FLOATS = 2

interface SceneFloat {
  id: number
  text: string
  tone: 'users' | 'cash' | 'ink'
  /** Scene time (ms). */
  started: number
}

/** Scene time in ms (the started / expiry clock of every beat here). */
const sceneMs = () => sceneTime.t * 1000

function text(key: string, params: Record<string, string | number>): string {
  return (UI_TEXT[key] ?? key).replace(/\{(\w+)\}/g, (m, k: string) => (params[k] === undefined ? m : String(params[k])))
}

interface Wave {
  id: number
  release: ReleaseEntry
  started: number
}

const selectEvents = (s: GameState) => s.events
const selectReleases = (s: GameState) => s.releases

export function JuiceLayer() {
  const events = useGS(selectEvents)
  const releases = useGS(selectReleases)
  const generation = useUi((u) => u.generation)
  const layout = useLayout()
  const cursor = useRef<{ generation: number; id: number } | null>(null)
  const [wave, setWave] = useState<Wave | null>(null)
  const [confetti, setConfetti] = useState(0)
  const [floats, setFloats] = useState<SceneFloat[]>([])
  const [hunt, setHunt] = useState<{ id: number; count: number } | null>(null)
  const pulse = useRef<{ at: number; color: THREE.Color } | null>(null)
  const later = useSceneTimers()

  useEffect(() => {
    const maxId = events[events.length - 1]?.id ?? 0
    const c = cursor.current
    if (!c || c.generation !== generation || maxId < c.id) {
      cursor.current = { generation, id: maxId }
      return
    }
    for (const e of events) {
      if (e.id <= c.id) continue
      if (e.kind === 'release') {
        const r = releases?.find((x) => x.id === e.refId)
        if (!r) continue
        setWave({ id: e.id, release: r, started: sceneMs() })
        const id = e.id
        later(WAVE_MS, () => setWave((w) => (w?.id === id ? null : w)))
        pulse.current = { at: sceneMs(), color: new THREE.Color('#ffe7a8') }
        // MV2c: a module or a version brings its wave as a "+N" over the desk too (the banner names the moment).
        if ((r.module || (r.version !== undefined && r.version > 1 && r.minor === undefined)) && r.users >= 1) addFloat({ id: e.id, text: `+${Math.round(r.users)}`, tone: 'users', started: sceneMs() })
        if (r.level >= 2) {
          setConfetti((n) => n + 1)
          celebrate(2000)
        }
      } else if (e.kind === 'payday' && (e.value ?? 0) > 0.5) {
        pulse.current = { at: sceneMs(), color: new THREE.Color('#ff9a8a') }
        addFloat({ id: e.id, text: `−${money(e.value ?? 0)}`, tone: 'ink', started: sceneMs() })
        // Phones feel payday (a short tick); desktops ignore it.
        try {
          navigator.vibrate?.(30)
        } catch {
          /* not allowed: fine */
        }
      } else if (e.kind === 'founderActionDone' && e.refId === 'findUsers' && (e.value ?? 0) >= 1) {
        const n = Math.round(e.value ?? 0)
        addFloat({ id: e.id, text: `+${n}`, tone: 'users', started: sceneMs() })
        const id = e.id
        setHunt({ id, count: Math.min(5, Math.max(1, n)) })
        later(WAVE_MS, () => setHunt((h) => (h?.id === id ? null : h)))
      }
    }
    c.id = maxId
    // eslint-disable-next-line react-hooks/exhaustive-deps -- addFloat only uses stable setters / later
  }, [events, releases, generation, later])

  function addFloat(f: SceneFloat) {
    // One float per tone: a new users wave while one still rises adds into it ("+3" then "+1266" reads "+1269").
    setFloats((cur) => {
      const live = cur.filter((x) => sceneMs() - x.started < FLOAT_MS)
      const same = live.find((x) => x.tone === f.tone)
      const n = (t: string) => Number(t.replace(/[^0-9.]/g, '')) || 0
      const merged = same && f.tone === 'users' ? { ...f, text: `+${Math.round(n(same.text) + n(f.text))}` } : f
      return [...live.filter((x) => x.tone !== f.tone), merged].slice(-MAX_FLOATS)
    })
    later(FLOAT_MS, () => setFloats((cur) => cur.filter((x) => x.id !== f.id)))
  }

  const desk = useMemo<XZ>(() => layout.itemCenter.get('founder')?.pos ?? layout.slotWorld.get('founder') ?? layout.center, [layout])

  // One point light over the desk; brightens for a moment on a release (warm) or payday (red).
  const light = useRef<THREE.PointLight>(null)
  useFrame(() => {
    const l = light.current
    if (!l) return
    const p = pulse.current
    if (!p) {
      l.intensity = 0
      return
    }
    const k = (sceneMs() - p.at) / PULSE_MS
    if (k >= 1) {
      pulse.current = null
      l.intensity = 0
      return
    }
    l.color.copy(p.color)
    l.intensity = 9 * Math.sin(Math.PI * Math.min(1, k * 1.4)) * (1 - k)
  })

  // A card or the start call owns the screen: the banner and "+N" wait out of sight (they keep their clock).
  const covered = useSceneCovered()
  // One live note at a time (fix round 5): the release toast waits while the payday card shows.
  const paydayOn = usePaydayCardOn()

  return (
    <>
      <pointLight ref={light} position={[desk[0], 3.2, desk[1]]} distance={CELL * 7} decay={1.6} intensity={0} />
      <Confetti trigger={confetti} origin={desk} />
      {wave && <ReleaseBanner key={wave.id} wave={wave} hidden={covered || paydayOn} />}
      {wave && <UserWave key={`w${wave.id}`} count={Math.min(MAX_FIGURES, Math.max(2, Math.round(Math.sqrt(wave.release.users))))} target={desk} />}
      {hunt && !wave && <UserWave key={`h${hunt.id}`} count={hunt.count} target={desk} />}
      {floats.length > 0 && <Floats items={floats} at={desk} hidden={covered} />}
    </>
  )
}

const TONE_COLOR: Record<SceneFloat['tone'], string> = { users: 'var(--color-g-users)', cash: 'var(--color-g-cash)', ink: 'var(--color-ink)' }

/** CSS animations follow the scene clock: paused while a bubble holds the world. */
function usePlayState(): 'paused' | 'running' {
  return useUi((u) => u.pauseReasons.length > 0) ? 'paused' : 'running'
}

/** "+4 👤" / "−$3.2K" rising over the desk; newer ones sit above older ones. */
function Floats({ items, at, hidden }: { items: readonly SceneFloat[]; at: XZ; hidden: boolean }) {
  const play = usePlayState()
  const portal = useHtmlPortal()
  const box = useRef<HTMLDivElement>(null)
  // The "+N" floats also clear the release banner above them.
  useYieldToBubbles(box, '[data-juice-banner]')
  return (
    <Html portal={portal} position={[at[0], 2.2, at[1]]} center zIndexRange={[14, 10]} wrapperClass="pointer-events-none" style={{ pointerEvents: 'none' }}>
      <div ref={box} data-juice-float="" style={{ display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', gap: 4, visibility: hidden ? 'hidden' : undefined }}>
        {items.map((f) => (
          <div
            key={f.id}
            className="tabular whitespace-nowrap rounded-[8px] px-2 py-0.5 shadow-pop"
            style={{
              background: 'var(--color-surface)',
              color: TONE_COLOR[f.tone],
              fontFamily: 'var(--font-ui, inherit)',
              fontSize: 15,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              animation: `rise-float ${FLOAT_MS}ms ease-out both`,
              animationPlayState: play,
            }}
          >
            {f.tone === 'users' && <UsersGlyph />}
            {f.text}
          </div>
        ))}
      </div>
    </Html>
  )
}

function UsersGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
      <circle cx="17" cy="9.5" r="2.4" />
      <path d="M16 14.2c2.3.1 4 1.6 4.5 4.3" />
    </svg>
  )
}

function money(n: number): string {
  const a = Math.abs(n)
  return a >= 1e6 ? `$${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `$${(a / 1e3).toFixed(1)}K` : `$${Math.round(a)}`
}

/** The toast re-reads the HUD this often (ms): a card can widen while it shows (the garage's round timer chip). */
const TOAST_MEASURE_MS = 200

/**
 * Screen point (px, canvas space) of the release toast and its widest allowed width: centred on the free scene (left
 * of the side panel), just under the lowest top HUD island, live (round 3: a stage card that widened while the toast
 * showed slid over it). Visual rects (transforms included), not layout boxes. On a phone the banner over the desk sat
 * in the middle of the scene, over the team (fix round §4); a toast at the top edge never covers it.
 */
function toastAnchor(canvas: HTMLElement, width: number, height: number, inset: number): { x: number; y: number; maxW: number } {
  const c = canvas.getBoundingClientRect()
  const freeRight = Math.max(width - inset, width * 0.3)
  let top = 0
  for (const el of document.querySelectorAll<HTMLElement>('[data-scene-island]')) {
    const q = el.getBoundingClientRect()
    if (!q.width || !q.height) continue
    const r = { left: q.left - c.left, top: q.top - c.top, bottom: q.bottom - c.top }
    if (r.top < height * 0.3 && r.bottom < height * 0.4 && r.left < freeRight) top = Math.max(top, r.bottom)
  }
  return { x: freeRight / 2, y: top + TOAST_GAP, maxW: Math.max(160, freeRight - 24) }
}

function ReleaseBanner({ wave, hidden }: { wave: Wave; hidden: boolean }) {
  const [on, setOn] = useState(true)
  const play = usePlayState()
  const portal = useHtmlPortal()
  const box = useRef<HTMLDivElement>(null)
  // A decision bubble under the toast still wins: the toast steps aside (or fades) for it.
  useYieldToBubbles(box)
  const later = useSceneTimers()
  const gl = useThree((st) => st.gl)
  const size = useThree((st) => st.size)
  const inset = useUi((u) => u.sceneInset.right)
  const at = useRef(toastAnchor(gl.domElement, size.width, size.height, inset))
  const pill = useRef<HTMLDivElement>(null)
  const measured = useRef(0)
  useFrame(() => {
    const now = performance.now()
    if (now - measured.current < TOAST_MEASURE_MS) return
    measured.current = now
    at.current = toastAnchor(gl.domElement, size.width, size.height, inset)
    if (pill.current) pill.current.style.maxWidth = `${at.current.maxW}px`
  })
  const place = useMemo(() => () => [at.current.x, at.current.y], [])
  useEffect(() => later(BANNER_MS, () => setOn(false)), [later])
  const r = wave.release
  const category = useGS((s) => s.projects.find((p) => p.id === r.projectId)?.category)
  if (!on) return null
  const level = UI_TEXT[`release.level.${Math.max(1, Math.min(5, r.level))}`] ?? String(r.level)
  // Always names the project (three projects can each ship a v4.8): "Limanhub v4.8 yayında", "Limanhub: Geri bildirim
  // yayında", "Limanhub v5 yayında · +2 slot". One line; the wave's numbers are the strip's.
  const isVersion = r.version !== undefined && r.version > 1 && r.minor === undefined && !r.module
  const project = r.projectName
  const line = r.module
    ? text('release.toastModule', { project, module: moduleName(r.module, category) })
    : isVersion
      ? slotsOpened(r.version!) > 0
        ? text('release.version', { project, v: r.version!, n: slotsOpened(r.version!) })
        : text('release.versionFull', { project, v: r.version! })
      : text('release.toast', { project, level: r.version !== undefined && r.minor !== undefined ? text('release.minor', { v: r.version, m: r.minor }) : level })
  return (
    <Html portal={portal} calculatePosition={place} zIndexRange={[15, 10]} wrapperClass="pointer-events-none" style={{ pointerEvents: 'none', transform: 'translateX(-50%)' }}>
      {/* A toast: anchored on the screen (top edge of the scene), not on the desk. Centred by the Html style, the yield
          (translate + fade) on the wrapper below. */}
      <div ref={box} data-juice-banner="" style={{ visibility: hidden ? 'hidden' : undefined }}>
        <div
          className="animate-pop-in overflow-hidden text-ellipsis whitespace-nowrap rounded-full px-3 py-1 shadow-pop"
          ref={pill}
          style={{ maxWidth: at.current.maxW, background: 'var(--color-brand)', color: 'var(--color-on-ink)', fontFamily: 'var(--font-ui, inherit)', fontSize: 13, fontWeight: 700, letterSpacing: '0.02em', animationPlayState: play }}
        >
          {/* Name only: the numbers are the strip's (one channel per number, docs/GAMEPLAY_V2.md §12 D9). */}
          {line}
        </div>
      </div>
    </Html>
  )
}

interface Figure {
  path: XZ[]
  delay: number
  color: THREE.Color
}

/** Simple user figures (body + head) walking in through the door to the desk area, then fading out. */
function UserWave({ count, target }: { count: number; target: XZ }) {
  const layout = useLayout()
  const started = useRef(sceneTime.t)
  const figures = useMemo<Figure[]>(() => {
    const out: Figure[] = []
    // Stops round the desk that miss furniture and everyone standing or seated (spots.pawnSpots), not an even ring
    // that dropped pawns inside a character (QA).
    const spots = pawnSpots(target, count, CELL, (p) => isFreeFloor(layout, p))
    for (let i = 0; i < count; i++) {
      const spot = spots[i]!
      out.push({
        path: [layout.door.outside, ...pathFromDoor(spot, layout)],
        // 0.4 s apart at WALK_SPEED ≈ 1 u: the figures walk in single file instead of merging in the doorway.
        delay: i * 0.4,
        color: new THREE.Color(CONFETTI_COLORS[i % CONFETTI_COLORS.length]!),
      })
    }
    return out
  }, [count, target, layout])
  const refs = useRef<(THREE.Group | null)[]>([])
  const body = useMemo(() => new THREE.CapsuleGeometry(0.13, 0.32, 4, 8), [])
  const head = useMemo(() => new THREE.SphereGeometry(0.12, 10, 8), [])
  const headMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f1c9a5', roughness: 0.8 }), [])
  const mats = useMemo(() => figures.map((f) => new THREE.MeshStandardMaterial({ color: f.color, roughness: 0.7 })), [figures])
  // Built per wave: freed when the wave ends, so a long run's celebrations do not pile up on the GPU (F5).
  useEffect(() => () => [body, head, headMat].forEach((r) => r.dispose()), [body, head, headMat])
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats])
  const lengths = useMemo(
    () =>
      figures.map((f) => {
        const segs: number[] = []
        for (let i = 1; i < f.path.length; i++) segs.push(Math.hypot(f.path[i]![0] - f.path[i - 1]![0], f.path[i]![1] - f.path[i - 1]![1]))
        return segs
      }),
    [figures],
  )

  useFrame(() => {
    const t = sceneTime.t - started.current
    figures.forEach((f, i) => {
      const g = refs.current[i]
      if (!g) return
      const segs = lengths[i]!
      const total = segs.reduce((a, b) => a + b, 0)
      const walked = Math.max(0, t - f.delay) * WALK_SPEED
      if (t < f.delay) {
        g.visible = false
        return
      }
      g.visible = true
      let d = Math.min(walked, total)
      let k = 0
      while (k < segs.length - 1 && d > segs[k]!) d -= segs[k++]!
      const a = f.path[k]!
      const b = f.path[k + 1] ?? a
      const u = segs[k]! > 0 ? Math.min(1, d / segs[k]!) : 1
      g.position.set(a[0] + (b[0] - a[0]) * u, 0, a[1] + (b[1] - a[1]) * u)
      const moving = walked < total
      if (moving) {
        g.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1])
        g.position.y = Math.abs(Math.sin(t * 12 + i)) * 0.05
      }
      // Linger, then shrink away (they have "joined" the product).
      const after = (walked - total) / WALK_SPEED
      const fade = moving ? 1 : Math.max(0, 1 - Math.max(0, after - FIGURE_LINGER) / 0.5)
      // Grow in over the first steps through the door (walker.doorScale's threshold), never blink in on the door tile.
      const door = Math.min(1, Math.max(0, t - f.delay) * WALK_SPEED / DOOR_FADE)
      g.scale.setScalar(fade * (0.85 + 0.15 * door) * Math.min(1, door * 2))
      if (fade <= 0) g.visible = false
    })
  })

  return (
    <group>
      {figures.map((_, i) => (
        <group key={i} ref={(el) => void (refs.current[i] = el)} visible={false}>
          <mesh geometry={body} material={mats[i]} position={[0, 0.3, 0]} castShadow />
          <mesh geometry={head} material={headMat} position={[0, 0.66, 0]} castShadow />
        </group>
      ))}
    </group>
  )
}
