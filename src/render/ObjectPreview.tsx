// Close-up turntable of the selected object for the UI detail panel (PLAN §7.4). Own small <Canvas>.
import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, type ReactNode } from 'react'
import { NeutralToneMapping } from 'three'
import type * as THREE from 'three'
import type { GameState, ProjectCategory } from '../engine/types'
import type { Selection } from '../store/types'
import { CELL } from './constants'
import { FOUNDER_LOOK, employeeLook } from './Character'
import { CharacterModel } from './CharacterModel'
import { FurnitureModel, useBookColors } from './Furniture'
import { resolveFurniture } from './furnitureCatalog'
import { npcLook } from './Npc'
import { PASTEL, SLOT_COLORS } from './palette'
import { GEO, glowMat, mat } from './resources'
import { RenderStateProvider, useGS } from './source'

function Turntable({ children, height }: { children: ReactNode; height: number }) {
  const g = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * 0.6
  })
  return (
    <group ref={g} position={[0, -height / 2, 0]}>
      {children}
    </group>
  )
}

/** Head-and-shoulders framing for people: scaled up, facing the camera, with a gentle sway. */
function Portrait({ children }: { children: ReactNode }) {
  const g = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    // Camera sits on the +x/+z diagonal; π/4 turns the face toward it.
    if (g.current) g.current.rotation.y = Math.PI / 4 + Math.sin(clock.elapsedTime * 0.8) * 0.35
  })
  return (
    <group ref={g} scale={2.3} position={[0, -0.72 * 2.3, 0]}>
      {children}
    </group>
  )
}

function ProjectModel({ category }: { category: ProjectCategory }) {
  switch (category) {
    case 'mobile':
      return (
        <group position={[0, 0.6, 0]}>
          <mesh geometry={GEO.box} material={mat('#3e3c48')} scale={[0.5, 0.95, 0.06]} />
          <mesh geometry={GEO.box} material={glowMat(PASTEL.sky, 0.5)} scale={[0.44, 0.82, 0.01]} position={[0, 0.02, 0.035]} />
        </group>
      )
    case 'web':
      return (
        <group position={[0, 0.6, 0]}>
          <mesh geometry={GEO.box} material={mat('#e8e6ef')} scale={[1.1, 0.75, 0.06]} />
          <mesh geometry={GEO.box} material={mat(PASTEL.lilac)} scale={[1.1, 0.12, 0.07]} position={[0, 0.32, 0]} />
          <mesh geometry={GEO.box} material={glowMat(PASTEL.mint, 0.3)} scale={[0.9, 0.45, 0.01]} position={[0, -0.05, 0.035]} />
        </group>
      )
    case 'ai':
      return (
        <group position={[0, 0.6, 0]}>
          <mesh geometry={GEO.sphere} material={mat(PASTEL.rose)} scale={[0.8, 0.7, 0.7]} />
          <mesh geometry={GEO.sphere} material={glowMat(PASTEL.lemon, 0.6)} scale={[0.2, 0.2, 0.2]} position={[0.2, 0.2, 0.3]} />
          <mesh geometry={GEO.sphere} material={glowMat(PASTEL.sky, 0.6)} scale={[0.18, 0.18, 0.18]} position={[-0.22, 0.1, 0.3]} />
        </group>
      )
    case 'api':
      return (
        <group position={[0, 0.5, 0]}>
          <mesh geometry={GEO.box} material={mat(PASTEL.mint)} scale={[0.6, 0.5, 0.4]} />
          <mesh geometry={GEO.box} material={mat('#8c8c96')} scale={[0.08, 0.3, 0.08]} position={[-0.14, 0.4, 0]} />
          <mesh geometry={GEO.box} material={mat('#8c8c96')} scale={[0.08, 0.3, 0.08]} position={[0.14, 0.4, 0]} />
        </group>
      )
    case 'game':
      return (
        <group position={[0, 0.5, 0]}>
          <mesh geometry={GEO.box} material={mat(PASTEL.peach)} scale={[1, 0.4, 0.4]} />
          <mesh geometry={GEO.cyl} material={mat('#3e3c48')} scale={[0.14, 0.1, 0.14]} position={[-0.28, 0.22, 0]} />
          <mesh geometry={GEO.sphere} material={mat(PASTEL.rose)} scale={[0.1, 0.1, 0.1]} position={[0.26, 0.22, 0.05]} />
          <mesh geometry={GEO.sphere} material={mat(PASTEL.sky)} scale={[0.1, 0.1, 0.1]} position={[0.36, 0.22, -0.05]} />
        </group>
      )
    default:
      return (
        <group position={[0, 0.3, 0]}>
          <mesh geometry={GEO.box} material={mat('#e9d6b8')} scale={[1, 0.5, 0.6]} />
          {[-0.36, -0.12, 0.12, 0.36].map((x, i) => (
            <mesh key={x} geometry={GEO.box} material={mat(i % 2 ? PASTEL.rose : PASTEL.cream50)} scale={[0.24, 0.1, 0.7]} position={[x, 0.7, 0]} />
          ))}
          <mesh geometry={GEO.box} material={mat('#c79a6b')} scale={[0.05, 0.5, 0.05]} position={[-0.48, 0.45, 0.3]} />
          <mesh geometry={GEO.box} material={mat('#c79a6b')} scale={[0.05, 0.5, 0.05]} position={[0.48, 0.45, 0.3]} />
        </group>
      )
  }
}

const selectForPreview = (s: GameState) => [s.office.slots, s.employees, s.visitors, s.projects] as const

function PreviewContent({ target }: { target: Selection }) {
  const [slots, employees, visitors, projects] = useGS(selectForPreview)
  const books = useBookColors()
  let body: ReactNode = null
  let person: ReactNode = null
  let height = 1.1
  switch (target.kind) {
    case 'slot': {
      const slot = slots.find((s) => s.id === target.id)
      if (slot?.itemId) {
        const r = resolveFurniture(slot.itemId, slot.type)
        const span = r.size === 2
        body = (
          <group scale={span ? 0.5 : 0.8}>
            <FurnitureModel resolved={r} span={span} books={books} />
          </group>
        )
        height = span ? 0.7 : 1
      } else if (slot) {
        body = <mesh geometry={GEO.frame} material={mat(SLOT_COLORS[slot.type])} scale={[CELL, 1, CELL]} />
        height = 0.2
      }
      break
    }
    case 'employee': {
      const e = employees.find((x) => x.id === target.id)
      if (e) person = <CharacterModel look={employeeLook(e.id, e.dept)} />
      break
    }
    case 'founder':
      person = <CharacterModel look={FOUNDER_LOOK} />
      break
    case 'visitor': {
      const v = visitors.find((x) => x.id === target.id)
      if (v) person = <CharacterModel look={npcLook(v.id, v.role)} />
      break
    }
    case 'project': {
      const p = projects.find((x) => x.id === target.id)
      body = <ProjectModel category={p?.category ?? 'web'} />
      height = 1.2
      break
    }
  }
  return (
    <>
      <hemisphereLight args={['#fff6ea', '#d9cfc2', 1.5]} />
      <directionalLight position={[3, 5, 4]} intensity={1.4} color="#fff1dc" />
      {person ? (
        <Portrait>{person}</Portrait>
      ) : (
        <Turntable height={height}>
          <mesh geometry={GEO.disc} material={mat(PASTEL.cream200)} scale={[1.8, 1, 1.8]} position={[0, -0.005, 0]} />
          {body}
        </Turntable>
      )}
    </>
  )
}

export interface ObjectPreviewProps {
  target: Selection
  className?: string
  /** Optional mock state (render without the store). */
  mockState?: GameState | null
}

export function ObjectPreview({ target, className, mockState }: ObjectPreviewProps) {
  return (
    <div className={className ?? 'h-full w-full'}>
      <Canvas dpr={[1, 2]} camera={{ position: [2.2, 1.6, 2.2], fov: 32, near: 0.1, far: 50 }} gl={{ antialias: true, alpha: true }} onCreated={({ gl }) => { gl.toneMapping = NeutralToneMapping }}>
        <RenderStateProvider state={mockState}>
          <PreviewContent target={target} />
        </RenderStateProvider>
      </Canvas>
    </div>
  )
}
