// Office shell: ground, floor, walls, door, rings (locked = dark & dusty, opening = renovation),
// and stage-specific decor (garage → coworking → … → campus). Parametric on the layout.
import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { StageIndex } from '../engine/types'
import { CELL, WALL_HEIGHT, WALL_THICKNESS, hash01 } from './constants'
import type { Box, OfficeLayout, RingBand } from './layout'
import { PASTEL, stagePalette, type StagePalette } from './palette'
import { GEO, glassMat, glowMat, mat } from './resources'
import { mood, useLayout } from './sceneRegistry'

type V3 = [number, number, number]

function B({ s, p, c, r, shadow = true }: { s: V3; p: V3; c: string; r?: V3; shadow?: boolean }) {
  return <mesh geometry={GEO.box} material={mat(c)} scale={s} position={p} rotation={r} castShadow={shadow} receiveShadow />
}

// ---------------------------------------------------------------------------
// Floor
// ---------------------------------------------------------------------------

/** Plank / slab lines as one instanced mesh: `width` thick, one every `pitch`. */
function Stripes({ bounds, color, along, width, pitch }: { bounds: Box; color: string; along: 'x' | 'z'; width: number; pitch: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const w = bounds.maxX - bounds.minX
  const d = bounds.maxZ - bounds.minZ
  const count = Math.max(1, Math.floor((along === 'x' ? d : w) / pitch))
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    for (let i = 0; i < count; i++) {
      if (along === 'x') {
        o.position.set((bounds.minX + bounds.maxX) / 2, 0.002, bounds.minZ + pitch * (i + 0.5))
        o.scale.set(w, 1, width)
      } else {
        o.position.set(bounds.minX + pitch * (i + 0.5), 0.002, (bounds.minZ + bounds.maxZ) / 2)
        o.scale.set(width, 1, d)
      }
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  }, [bounds, count, along, width, pitch, w, d])
  return <instancedMesh key={count} ref={ref} args={[GEO.plane, mat(color), count]} receiveShadow />
}

function Floor({ layout, pal }: { layout: OfficeLayout; pal: StagePalette }) {
  const b = layout.bounds
  const w = b.maxX - b.minX
  const d = b.maxZ - b.minZ
  const stage = layout.stage
  return (
    <group>
      <mesh geometry={GEO.plane} material={mat(pal.ground)} scale={[200, 1, 200]} position={[0, -0.09, 0]} receiveShadow />
      <B s={[w, 0.08, d]} p={[(b.minX + b.maxX) / 2, -0.04, (b.minZ + b.maxZ) / 2]} c={pal.floor} shadow={false} />
      {stage === 0 ? (
        <>
          <Stripes bounds={b} color={pal.floorAlt} along="x" width={0.03} pitch={CELL} />
          <Stripes bounds={b} color={pal.floorAlt} along="z" width={0.03} pitch={CELL} />
          {/* oil stain */}
          <mesh geometry={GEO.disc} material={mat('#a09d97')} scale={[0.9, 1, 0.6]} position={[b.minX + w * 0.28, 0.003, b.maxZ - d * 0.22]} />
        </>
      ) : (
        <Stripes bounds={b} color={pal.floorAlt} along={stage % 2 === 0 ? 'x' : 'z'} width={0.2} pitch={0.4} />
      )}
      {stage >= 2 && stage <= 5 && (
        <mesh geometry={GEO.plane} material={mat(stage === 2 ? PASTEL.lilac : stage === 3 ? PASTEL.sky : stage === 4 ? PASTEL.peach : PASTEL.mint)} scale={[CELL * 2.2, 1, CELL * 2.2]} position={[0, 0.004, 0]} receiveShadow />
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Walls & door
// ---------------------------------------------------------------------------

function Windows({ from, to, fixed, axis, pal, tall }: { from: number; to: number; fixed: number; axis: 'x' | 'z'; pal: StagePalette; tall?: boolean }) {
  const len = to - from
  const n = Math.max(1, Math.floor(len / (CELL * 1.6)))
  const h = tall ? WALL_HEIGHT * 0.8 : 0.7
  const y = tall ? WALL_HEIGHT * 0.48 : 1.3
  const items = []
  for (let i = 0; i < n; i++) {
    const c = from + (len / n) * (i + 0.5)
    const wlen = tall ? (len / n) * 0.9 : Math.min(CELL * 1.1, (len / n) * 0.7)
    const pos: V3 = axis === 'x' ? [c, y, fixed] : [fixed, y, c]
    const size: V3 = axis === 'x' ? [wlen, h, WALL_THICKNESS * 1.3] : [WALL_THICKNESS * 1.3, h, wlen]
    const frame: V3 = axis === 'x' ? [wlen + 0.08, h + 0.08, WALL_THICKNESS * 1.1] : [WALL_THICKNESS * 1.1, h + 0.08, wlen + 0.08]
    items.push(
      <group key={i}>
        <B s={frame} p={pos} c={pal.wallTrim} shadow={false} />
        <mesh geometry={GEO.box} material={glassMat('#d8eef8', 0.85)} scale={size} position={pos} />
      </group>,
    )
  }
  return <>{items}</>
}

function Walls({ layout, pal }: { layout: OfficeLayout; pal: StagePalette }) {
  const b = layout.bounds
  const t = WALL_THICKNESS
  const H = layout.stage === 5 ? WALL_HEIGHT * 1.15 : WALL_HEIGHT
  const door = layout.door
  const dl = door.pos[0] - door.width / 2
  const dr = door.pos[0] + door.width / 2
  const backZ = b.minZ - t / 2
  const leftX = b.minX - t / 2
  const glassy = layout.stage === 5
  const wallC = pal.wall
  return (
    <group>
      {/* back wall (−z) with door gap */}
      {glassy ? (
        <>
          <mesh geometry={GEO.box} material={glassMat('#cfe8f5', 0.45)} scale={[dl - b.minX + t, H, t]} position={[(b.minX - t + dl) / 2, H / 2, backZ]} />
          <mesh geometry={GEO.box} material={glassMat('#cfe8f5', 0.45)} scale={[b.maxX - dr, H, t]} position={[(dr + b.maxX) / 2, H / 2, backZ]} />
        </>
      ) : (
        <>
          <B s={[dl - b.minX + t, H, t]} p={[(b.minX - t + dl) / 2, H / 2, backZ]} c={wallC} />
          <B s={[b.maxX - dr, H, t]} p={[(dr + b.maxX) / 2, H / 2, backZ]} c={wallC} />
        </>
      )}
      <B s={[door.width, H - 1.35, t]} p={[door.pos[0], 1.35 + (H - 1.35) / 2, backZ]} c={wallC} />
      <B s={[b.maxX - b.minX + t, 0.08, t + 0.04]} p={[(b.minX + b.maxX - t) / 2, H, backZ]} c={pal.wallTrim} shadow={false} />
      {/* left wall (−x) */}
      {glassy ? (
        <mesh geometry={GEO.box} material={glassMat('#cfe8f5', 0.45)} scale={[t, H, b.maxZ - b.minZ]} position={[leftX, H / 2, (b.minZ + b.maxZ) / 2]} />
      ) : (
        <B s={[t, H, b.maxZ - b.minZ]} p={[leftX, H / 2, (b.minZ + b.maxZ) / 2]} c={wallC} />
      )}
      <B s={[t + 0.04, 0.08, b.maxZ - b.minZ]} p={[leftX, H, (b.minZ + b.maxZ) / 2]} c={pal.wallTrim} shadow={false} />
      {/* skirting on the open front sides */}
      <B s={[b.maxX - b.minX, 0.1, 0.06]} p={[(b.minX + b.maxX) / 2, 0.05, b.maxZ + 0.03]} c={pal.wallTrim} shadow={false} />
      <B s={[0.06, 0.1, b.maxZ - b.minZ]} p={[b.maxX + 0.03, 0.05, (b.minZ + b.maxZ) / 2]} c={pal.wallTrim} shadow={false} />
      {/* door frame + open leaf */}
      <B s={[0.07, 1.4, t + 0.06]} p={[dl - 0.035, 0.7, backZ]} c={pal.wallTrim} />
      <B s={[0.07, 1.4, t + 0.06]} p={[dr + 0.035, 0.7, backZ]} c={pal.wallTrim} />
      <B s={[door.width + 0.14, 0.07, t + 0.06]} p={[door.pos[0], 1.38, backZ]} c={pal.wallTrim} />
      <group position={[dl, 0, backZ + t / 2]} rotation={[0, -1.1, 0]}>
        <B s={[door.width * 0.95, 1.32, 0.05]} p={[door.width * 0.475, 0.66, 0]} c={pal.accent} />
        <B s={[0.04, 0.04, 0.08]} p={[door.width * 0.85, 0.65, 0.04]} c="#e8c46a" shadow={false} />
      </group>
      {/* doormat outside-in */}
      <mesh geometry={GEO.plane} material={mat('#a07a5a')} scale={[door.width * 0.9, 1, 0.45]} position={[door.pos[0], 0.005, b.minZ + 0.3]} />
      {layout.stage >= 1 && layout.stage <= 4 && <Windows from={b.minZ + CELL * 0.4} to={b.maxZ - CELL * 0.4} fixed={leftX} axis="z" pal={pal} />}
      {layout.stage >= 2 && layout.stage <= 4 && <Windows from={b.minX + CELL * 0.4} to={dl - CELL * 0.4} fixed={backZ} axis="x" pal={pal} />}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Stage decor
// ---------------------------------------------------------------------------

function GarageDecor({ layout, pal }: { layout: OfficeLayout; pal: StagePalette }) {
  const b = layout.bounds
  const d = b.maxZ - b.minZ
  const doorW = Math.min(d * 0.7, CELL * 2.6)
  const cz = (b.minZ + b.maxZ) / 2 + d * 0.08
  const x = b.minX + 0.02
  const slats = []
  for (let i = 0; i < 9; i++) slats.push(<B key={i} s={[0.05, 0.16, doorW]} p={[x + 0.02, 0.15 + i * 0.19, cz]} c={i % 2 ? pal.accent : '#a6b8ca'} shadow={false} />)
  return (
    <group>
      {/* roll-up garage door on the left wall */}
      <B s={[0.08, 1.85, doorW + 0.16]} p={[x - 0.01, 0.92, cz]} c="#7d8a99" shadow={false} />
      {slats}
      {/* metal shelf with boxes along the back wall */}
      <group position={[b.minX + CELL * 0.8, 0, b.minZ + 0.28]}>
        <B s={[0.05, 1.3, 0.05]} p={[-0.55, 0.65, -0.12]} c="#8c8c96" />
        <B s={[0.05, 1.3, 0.05]} p={[0.55, 0.65, -0.12]} c="#8c8c96" />
        <B s={[0.05, 1.3, 0.05]} p={[-0.55, 0.65, 0.12]} c="#8c8c96" />
        <B s={[0.05, 1.3, 0.05]} p={[0.55, 0.65, 0.12]} c="#8c8c96" />
        {[0.3, 0.75, 1.2].map((y) => (
          <B key={y} s={[1.15, 0.03, 0.3]} p={[0, y, 0]} c="#a9a59e" />
        ))}
        <B s={[0.3, 0.22, 0.24]} p={[-0.3, 0.43, 0]} c="#c9a27a" />
        <B s={[0.24, 0.18, 0.2]} p={[0.05, 0.41, 0]} c="#d8b58a" />
        <B s={[0.36, 0.26, 0.24]} p={[0.2, 0.9, 0]} c="#c9a27a" />
        <B s={[0.2, 0.3, 0.12]} p={[-0.3, 1.36, 0]} c="#e57f7f" />
      </group>
      {/* hanging bulb */}
      <group position={[0, 2.05, 0]}>
        <B s={[0.01, 0.35, 0.01]} p={[0, 0.17, 0]} c="#2b2a33" shadow={false} />
        <mesh geometry={GEO.sphere} material={glowMat('#fff2c4', 1.2)} scale={[0.14, 0.16, 0.14]} />
      </group>
      {/* bicycle-ish tyres leaning on the wall */}
      <mesh geometry={GEO.cyl} material={mat('#3e3c48')} scale={[0.5, 0.06, 0.5]} rotation={[Math.PI / 2, 0, 0.1]} position={[b.maxX - CELL * 0.35, 0.26, b.minZ + 0.1]} castShadow />
    </group>
  )
}

function CoworkingDecor({ layout, pal }: { layout: OfficeLayout; pal: StagePalette }) {
  const b = layout.bounds
  const plants: V3[] = [
    [b.minX + 0.3, 0, b.maxZ - 0.3],
    [b.minX + 0.3, 0, b.minZ + 0.3],
    [b.maxX - 0.3, 0, b.maxZ - 0.3],
  ]
  return (
    <group>
      {plants.map((p, i) => (
        <group key={i} position={p}>
          <mesh geometry={GEO.cyl} material={mat('#e7b48a')} scale={[0.26, 0.26, 0.26]} position={[0, 0.13, 0]} castShadow />
          <mesh geometry={GEO.sphere} material={mat('#8fcf8a')} scale={[0.4, 0.5, 0.4]} position={[0, 0.5, 0]} castShadow />
        </group>
      ))}
      {/* striped banner on the back wall */}
      {[0, 1, 2, 3].map((i) => (
        <B key={i} s={[0.28, 0.5, 0.03]} p={[b.minX + CELL * 0.6 + i * 0.3, 1.55, b.minZ + 0.02]} c={[PASTEL.mint, PASTEL.lemon, PASTEL.rose, PASTEL.sky][i]!} shadow={false} />
      ))}
      <B s={[0.03, 0.6, 1.2]} p={[b.minX + 0.03, 1.5, (b.minZ + b.maxZ) / 2 + CELL]} c={pal.accent} shadow={false} />
    </group>
  )
}

function Columns({ layout, pal }: { layout: OfficeLayout; pal: StagePalette }) {
  const b = layout.bounds
  const cols: [number, number][] = []
  const step = CELL * 3
  for (let x = b.minX + step; x < b.maxX - CELL; x += step)
    for (let z = b.minZ + step; z < b.maxZ - CELL; z += step) if (Math.hypot(x, z) > CELL * 1.5) cols.push([x + CELL * 0.5, z + CELL * 0.5])
  return (
    <group>
      {cols.map(([x, z], i) => (
        <B key={i} s={[0.22, WALL_HEIGHT, 0.22]} p={[x, WALL_HEIGHT / 2, z]} c={pal.wallTrim} />
      ))}
    </group>
  )
}

function Stairs({ layout, pal }: { layout: OfficeLayout; pal: StagePalette }) {
  const b = layout.bounds
  const steps = []
  for (let i = 0; i < 8; i++) steps.push(<B key={i} s={[0.8, 0.2 * (i + 1), 0.28]} p={[b.minX + 0.5, 0.1 * (i + 1), b.minZ + 0.4 + i * 0.28]} c={i % 2 ? pal.floorAlt : pal.floor} />)
  return (
    <group>
      {steps}
      <B s={[0.9, 0.08, 2.4]} p={[b.minX + 0.5, 1.64, b.minZ + 1.2 + 2.1]} c={pal.floor} />
      <B s={[0.04, 0.5, 4.6]} p={[b.minX + 0.92, 1.9, b.minZ + 2.3]} c={pal.wallTrim} />
    </group>
  )
}

function ElevatorDecor({ layout, pal }: { layout: OfficeLayout; pal: StagePalette }) {
  const b = layout.bounds
  return (
    <group position={[b.minX + CELL * 1.2, 0, b.minZ + 0.05]}>
      <B s={[1.1, 1.6, 0.06]} p={[0, 0.8, 0]} c="#c8ccd4" />
      <B s={[0.02, 1.5, 0.08]} p={[0, 0.75, 0.01]} c="#8c8c96" shadow={false} />
      <mesh geometry={GEO.sphere} material={glowMat(pal.accent, 0.8)} scale={[0.07, 0.07, 0.07]} position={[0.7, 1.0, 0.04]} />
    </group>
  )
}

function CampusDecor({ layout }: { layout: OfficeLayout }) {
  const b = layout.bounds
  const trees: V3[] = []
  const r = layout.radius + CELL * 1.2
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + hash01('tree', i) * 0.3
    const rr = r + hash01('tree', i + 20) * CELL * 1.5
    trees.push([Math.cos(a) * rr + layout.center[0], 0, Math.sin(a) * rr + layout.center[1]])
  }
  return (
    <group>
      {trees.map((p, i) => (
        <group key={i} position={p} scale={0.8 + hash01('tree', i + 40) * 0.6}>
          <mesh geometry={GEO.cyl} material={mat('#9a6b44')} scale={[0.16, 0.6, 0.16]} position={[0, 0.3, 0]} castShadow />
          <mesh geometry={GEO.cone} material={mat(i % 3 ? '#7cc47a' : '#9fd98b')} scale={[0.8, 1.1, 0.8]} position={[0, 1.1, 0]} castShadow />
        </group>
      ))}
      {/* unicorn statue */}
      <group position={[b.maxX + CELL * 0.8, 0, b.maxZ + CELL * 0.8]}>
        <B s={[0.8, 0.3, 0.8]} p={[0, 0.15, 0]} c="#fbf8f2" />
        <mesh geometry={GEO.sphere} material={mat('#fbf1f8')} scale={[0.5, 0.4, 0.8]} position={[0, 0.6, 0]} castShadow />
        <mesh geometry={GEO.sphere} material={mat('#fbf1f8')} scale={[0.3, 0.32, 0.36]} position={[0, 0.9, 0.35]} castShadow />
        <mesh geometry={GEO.cone} material={glowMat('#f7e08a', 0.5)} scale={[0.08, 0.3, 0.08]} position={[0, 1.15, 0.45]} rotation={[0.5, 0, 0]} />
        <mesh geometry={GEO.sphere} material={mat('#c9a7f5')} scale={[0.14, 0.3, 0.3]} position={[0, 0.95, 0.12]} />
      </group>
    </group>
  )
}

function StageDecor({ layout, pal }: { layout: OfficeLayout; pal: StagePalette }) {
  switch (layout.stage) {
    case 0:
      return <GarageDecor layout={layout} pal={pal} />
    case 1:
      return <CoworkingDecor layout={layout} pal={pal} />
    case 2:
      return <CoworkingDecor layout={layout} pal={pal} />
    case 3:
      return <Columns layout={layout} pal={pal} />
    case 4:
      return (
        <>
          <Columns layout={layout} pal={pal} />
          <Stairs layout={layout} pal={pal} />
        </>
      )
    case 5:
      return (
        <>
          <Columns layout={layout} pal={pal} />
          <ElevatorDecor layout={layout} pal={pal} />
        </>
      )
    default:
      return <CampusDecor layout={layout} />
  }
}

// ---------------------------------------------------------------------------
// Rings: locked = dark + dust, opening = renovation (brighten + rising sparks)
// ---------------------------------------------------------------------------

const RENOVATE_MS = 1800

function Dust({ rects, count, color, rising }: { rects: Box[]; count: number; color: string; rising?: { start: number } }) {
  const base = useMemo(() => {
    const arr = new Float32Array(count * 3)
    const area = rects.reduce((a, r) => a + (r.maxX - r.minX) * (r.maxZ - r.minZ), 0) || 1
    let i = 0
    for (const r of rects) {
      const n = Math.round((count * ((r.maxX - r.minX) * (r.maxZ - r.minZ))) / area)
      for (let k = 0; k < n && i < count; k++, i++) {
        arr[i * 3] = r.minX + (r.maxX - r.minX) * hash01(`d${r.minX}`, k * 3 + 1)
        arr[i * 3 + 1] = 0.05 + 0.9 * hash01(`d${r.minZ}`, k * 3 + 2)
        arr[i * 3 + 2] = r.minZ + (r.maxZ - r.minZ) * hash01(`d${r.maxX}`, k * 3 + 3)
      }
    }
    return arr.subarray(0, i * 3)
  }, [rects, count])
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(base), 3))
    return g
  }, [base])
  const material = useMemo(() => new THREE.PointsMaterial({ color, size: rising ? 5 : 3, sizeAttenuation: false, transparent: true, opacity: 0.7, depthWrite: false }), [color, rising])
  useFrame(({ clock }) => {
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    const a = pos.array as Float32Array
    const t = clock.elapsedTime
    const prog = rising ? Math.min(1, (performance.now() - rising.start) / RENOVATE_MS) : 0
    for (let i = 0; i < a.length; i += 3) {
      const ph = i * 0.37
      a[i] = base[i]! + Math.sin(t * 0.4 + ph) * 0.06
      a[i + 1] = rising ? base[i + 1]! * 0.4 + prog * (1.2 + (i % 7) * 0.2) : base[i + 1]! + Math.sin(t * 0.6 + ph * 1.3) * 0.08
      a[i + 2] = base[i + 2]! + Math.cos(t * 0.35 + ph) * 0.06
    }
    pos.needsUpdate = true
    if (rising) material.opacity = 0.9 * (1 - prog)
  })
  return <points geometry={geo} material={material} />
}

function Clutter({ rects, color }: { rects: Box[]; color: string }) {
  return (
    <>
      {rects.map((r, i) => {
        const w = r.maxX - r.minX
        const d = r.maxZ - r.minZ
        if (w < 0.8 || d < 0.8) return null
        const x = r.minX + w * (0.2 + 0.6 * hash01('c', i))
        const z = r.minZ + d * (0.2 + 0.6 * hash01('c', i + 9))
        return (
          <group key={i} position={[x, 0, z]} rotation={[0, hash01('c', i + 3) * 1.5, 0]}>
            <B s={[0.4, 0.3, 0.34]} p={[0, 0.15, 0]} c={color} />
            <B s={[0.3, 0.22, 0.26]} p={[0.1, 0.41, 0.02]} c={color} />
            <mesh geometry={GEO.sphere} material={mat('#d8d2c8')} scale={[0.6, 0.35, 0.5]} position={[-0.5, 0.15, 0.1]} castShadow />
          </group>
        )
      })}
    </>
  )
}

function RingBandView({ band }: { band: RingBand }) {
  const wasLocked = useRef(!band.unlocked)
  const [renovating, setRenovating] = useState<{ start: number } | null>(null)

  // Locked → unlocked transition starts the renovation animation (covers ringOpened events too).
  useEffect(() => {
    if (wasLocked.current && band.unlocked) {
      const start = performance.now()
      mood.renovateUntil = start + RENOVATE_MS
      setRenovating({ start })
    }
    wasLocked.current = !band.unlocked
  }, [band.unlocked])
  const overlayMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#2d2b36', transparent: true, opacity: 0.55, depthWrite: false }), [])
  const flashMat = useMemo(() => new THREE.MeshBasicMaterial({ color: PASTEL.lemon, transparent: true, opacity: 0, depthWrite: false }), [])


  useFrame(() => {
    if (!renovating) {
      overlayMat.opacity = band.unlocked ? 0 : 0.55
      return
    }
    const k = Math.min(1, (performance.now() - renovating.start) / RENOVATE_MS)
    overlayMat.opacity = 0.55 * (1 - k)
    flashMat.opacity = Math.sin(k * Math.PI) * 0.45
    if (k >= 1) setRenovating(null)
  })

  const showOverlay = !band.unlocked || renovating
  if (!showOverlay || band.ring === 0) return null
  return (
    <group>
      {band.rects.map((r, i) => (
        <group key={i}>
          <mesh geometry={GEO.plane} material={overlayMat} scale={[r.maxX - r.minX, 1, r.maxZ - r.minZ]} position={[(r.minX + r.maxX) / 2, 0.03, (r.minZ + r.maxZ) / 2]} renderOrder={3} />
          {renovating && (
            <mesh geometry={GEO.plane} material={flashMat} scale={[r.maxX - r.minX, 1, r.maxZ - r.minZ]} position={[(r.minX + r.maxX) / 2, 0.04, (r.minZ + r.maxZ) / 2]} renderOrder={4} />
          )}
        </group>
      ))}
      {!band.unlocked && <Clutter rects={band.rects} color="#b89b78" />}
      {!band.unlocked && <Dust rects={band.rects} count={Math.min(260, band.rects.length * 50)} color="#d9d2c4" />}
      {renovating && <Dust rects={band.rects} count={160} color={PASTEL.lemon} rising={renovating} />}
    </group>
  )
}

/** Yellow tape on the border between the open office and the first locked ring. */
function LockTape({ box }: { box: Box }) {
  const b = box
  const w = b.maxX - b.minX
  const d = b.maxZ - b.minZ
  const cx = (b.minX + b.maxX) / 2
  const cz = (b.minZ + b.maxZ) / 2
  return (
    <group>
      <B s={[w, 0.012, 0.05]} p={[cx, 0.035, b.maxZ]} c={PASTEL.lemon} shadow={false} />
      <B s={[w, 0.012, 0.05]} p={[cx, 0.035, b.minZ]} c={PASTEL.lemon} shadow={false} />
      <B s={[0.05, 0.012, d]} p={[b.maxX, 0.035, cz]} c={PASTEL.lemon} shadow={false} />
      <B s={[0.05, 0.012, d]} p={[b.minX, 0.035, cz]} c={PASTEL.lemon} shadow={false} />
    </group>
  )
}

// ---------------------------------------------------------------------------

export function Office() {
  const layout = useLayout()
  const pal = stagePalette(layout.stage as StageIndex)
  const lockedIdx = layout.bands.findIndex((b) => !b.unlocked)
  const tapeBox = lockedIdx > 0 ? layout.bands[lockedIdx - 1]!.box : null
  return (
    <group>
      <Floor layout={layout} pal={pal} />
      {layout.stage !== 6 && <Walls layout={layout} pal={pal} />}
      <StageDecor layout={layout} pal={pal} />
      {layout.bands.map((band) => (
        <RingBandView key={`${layout.stage}:${band.ring}`} band={band} />
      ))}
      {tapeBox && <LockTape box={tapeBox} />}
    </group>
  )
}
