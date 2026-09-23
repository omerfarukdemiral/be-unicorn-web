// Low-poly person: body + head + limbs, department colour, small accessories.
// World units, feet at y=0, facing +z. Animated by Character/Npc through the `rig` object.
import { useFrame } from '@react-three/fiber'
import { memo, useRef } from 'react'
import type * as THREE from 'three'
import type { EmployeeStatus } from '../engine/types'
import { GEO, glowMat, mat, torusGeo } from './resources'
import { STATUS_COLORS } from './palette'

export type Accessory = 'none' | 'headphones' | 'glasses' | 'cap' | 'tie' | 'horn' | 'briefcase' | 'notebook' | 'camera'

export interface Rig {
  body: THREE.Group | null
  head: THREE.Group | null
  armL: THREE.Group | null
  armR: THREE.Group | null
  legL: THREE.Group | null
  legR: THREE.Group | null
  /** Hand-held prop (coffee cup) toggled by animation. */
  cup: THREE.Object3D | null
}

export function createRig(): Rig {
  return { body: null, head: null, armL: null, armR: null, legL: null, legR: null, cup: null }
}

export interface CharacterLook {
  body: string
  skin: string
  hair: string
  /** 0 short, 1 long, 2 bun, 3 bald-ish. */
  hairStyle: number
  accessories: Accessory[]
  /** Pants colour. */
  legs?: string
  scale?: number
}

const EYE = '#2b2a33'

export const CharacterModel = memo(function CharacterModel({ look, rig }: { look: CharacterLook; rig?: Rig }) {
  const r = rig ?? createRig()
  const legs = look.legs ?? '#5b5866'
  const acc = look.accessories
  return (
    <group scale={look.scale ?? 1}>
      <group ref={(o) => void (r.legL = o)} position={[-0.08, 0.3, 0]}>
        <mesh geometry={GEO.box} material={mat(legs)} scale={[0.1, 0.3, 0.11]} position={[0, -0.15, 0]} />
      </group>
      <group ref={(o) => void (r.legR = o)} position={[0.08, 0.3, 0]}>
        <mesh geometry={GEO.box} material={mat(legs)} scale={[0.1, 0.3, 0.11]} position={[0, -0.15, 0]} />
      </group>
      <group ref={(o) => void (r.body = o)}>
        <mesh geometry={GEO.cyl} material={mat(look.body)} scale={[0.36, 0.36, 0.26]} position={[0, 0.48, 0]} castShadow />
        {acc.includes('tie') && <mesh geometry={GEO.box} material={mat('#e8c46a')} scale={[0.05, 0.22, 0.02]} position={[0, 0.5, 0.13]} />}
        <group ref={(o) => void (r.armL = o)} position={[-0.22, 0.63, 0]}>
          <mesh geometry={GEO.box} material={mat(look.body)} scale={[0.08, 0.28, 0.09]} position={[0, -0.13, 0]} />
          <mesh geometry={GEO.sphere} material={mat(look.skin)} scale={[0.08, 0.08, 0.08]} position={[0, -0.28, 0]} />
          {acc.includes('briefcase') && <mesh geometry={GEO.box} material={mat('#6b4a33')} scale={[0.2, 0.14, 0.06]} position={[0, -0.36, 0]} />}
        </group>
        <group ref={(o) => void (r.armR = o)} position={[0.22, 0.63, 0]}>
          <mesh geometry={GEO.box} material={mat(look.body)} scale={[0.08, 0.28, 0.09]} position={[0, -0.13, 0]} />
          <mesh geometry={GEO.sphere} material={mat(look.skin)} scale={[0.08, 0.08, 0.08]} position={[0, -0.28, 0]} />
          <group ref={(o) => void (r.cup = o)} position={[0, -0.3, 0.05]} visible={false}>
            <mesh geometry={GEO.cyl} material={mat('#fbf8f2')} scale={[0.07, 0.09, 0.07]} />
            <mesh geometry={GEO.cyl} material={mat('#7a5230')} scale={[0.06, 0.01, 0.06]} position={[0, 0.045, 0]} />
          </group>
          {acc.includes('notebook') && <mesh geometry={GEO.box} material={mat('#fbf8f2')} scale={[0.12, 0.16, 0.03]} position={[0, -0.32, 0.05]} />}
          {acc.includes('camera') && <mesh geometry={GEO.box} material={mat('#2b2a33')} scale={[0.14, 0.1, 0.1]} position={[0, -0.32, 0.06]} />}
        </group>
        <group ref={(o) => void (r.head = o)} position={[0, 0.84, 0]}>
          <mesh geometry={GEO.sphere} material={mat(look.skin)} scale={[0.3, 0.3, 0.3]} castShadow />
          <mesh geometry={GEO.sphere} material={mat(EYE)} scale={[0.04, 0.05, 0.03]} position={[-0.06, 0.02, 0.135]} />
          <mesh geometry={GEO.sphere} material={mat(EYE)} scale={[0.04, 0.05, 0.03]} position={[0.06, 0.02, 0.135]} />
          {look.hairStyle !== 3 && (
            <mesh geometry={GEO.dome} material={mat(look.hair)} scale={[0.33, 0.3, 0.33]} position={[0, 0.02, -0.01]} rotation={[-0.25, 0, 0]} />
          )}
          {look.hairStyle === 1 && <mesh geometry={GEO.box} material={mat(look.hair)} scale={[0.3, 0.26, 0.1]} position={[0, -0.08, -0.12]} />}
          {look.hairStyle === 2 && <mesh geometry={GEO.sphere} material={mat(look.hair)} scale={[0.13, 0.13, 0.13]} position={[0, 0.17, -0.08]} />}
          {acc.includes('headphones') && (
            <>
              <mesh geometry={torusGeo(0.17, 0.02)} material={mat('#3e3c48')} position={[0, 0.02, 0]} />
              <mesh geometry={GEO.cyl} material={mat('#3e3c48')} scale={[0.09, 0.05, 0.09]} position={[-0.16, 0, 0]} rotation={[0, 0, Math.PI / 2]} />
              <mesh geometry={GEO.cyl} material={mat('#3e3c48')} scale={[0.09, 0.05, 0.09]} position={[0.16, 0, 0]} rotation={[0, 0, Math.PI / 2]} />
            </>
          )}
          {acc.includes('glasses') && (
            <>
              <mesh geometry={torusGeo(0.045, 0.01)} material={mat('#2b2a33')} position={[-0.06, 0.02, 0.15]} />
              <mesh geometry={torusGeo(0.045, 0.01)} material={mat('#2b2a33')} position={[0.06, 0.02, 0.15]} />
            </>
          )}
          {acc.includes('cap') && (
            <>
              <mesh geometry={GEO.dome} material={mat(look.body)} scale={[0.33, 0.24, 0.33]} position={[0, 0.05, 0]} />
              <mesh geometry={GEO.box} material={mat(look.body)} scale={[0.2, 0.02, 0.14]} position={[0, 0.07, 0.19]} />
            </>
          )}
          {acc.includes('horn') && (
            <mesh geometry={GEO.cone} material={glowMat('#f7e08a', 0.35)} scale={[0.07, 0.17, 0.07]} position={[0, 0.2, 0.09]} rotation={[0.45, 0, 0]} />
          )}
        </group>
      </group>
    </group>
  )
})

/** Floating status icon above the head (PLAN §7.2). */
export function StatusIcon({ status, y = 1.2 }: { status: EmployeeStatus | 'rest' | 'busy' | 'none'; y?: number }) {
  const g = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!g.current) return
    const t = clock.elapsedTime
    g.current.position.y = y + Math.sin(t * 2.4) * 0.03
    g.current.rotation.y = t * 0.8
  })
  if (status === 'working' || status === 'none') return null
  const color = status === 'rest' ? '#9cc9f5' : status === 'busy' ? '#c9a7f5' : STATUS_COLORS[status]
  return (
    <group ref={g} position={[0, y, 0]}>
      {status === 'burnout' && (
        <>
          <mesh geometry={GEO.sphere} material={mat('#8d8a99')} scale={[0.2, 0.14, 0.16]} position={[-0.08, 0.05, 0]} />
          <mesh geometry={GEO.sphere} material={mat('#8d8a99')} scale={[0.22, 0.18, 0.18]} position={[0.06, 0.08, 0]} />
          <mesh geometry={GEO.sphere} material={mat('#9e9aab')} scale={[0.16, 0.12, 0.14]} position={[0.16, 0.03, 0]} />
          <mesh geometry={GEO.box} material={mat('#9cc9f5')} scale={[0.02, 0.07, 0.02]} position={[-0.04, -0.07, 0]} />
          <mesh geometry={GEO.box} material={mat('#9cc9f5')} scale={[0.02, 0.07, 0.02]} position={[0.08, -0.09, 0]} />
        </>
      )}
      {status === 'tired' && (
        <>
          <mesh geometry={GEO.sphere} material={mat(color)} scale={[0.09, 0.11, 0.09]} />
          <mesh geometry={GEO.cone} material={mat(color)} scale={[0.08, 0.08, 0.08]} position={[0, 0.07, 0]} />
        </>
      )}
      {status === 'leaving' && (
        <>
          <mesh geometry={GEO.box} material={glowMat(color, 0.4)} scale={[0.05, 0.14, 0.05]} position={[0, 0.06, 0]} />
          <mesh geometry={GEO.sphere} material={glowMat(color, 0.4)} scale={[0.06, 0.06, 0.06]} position={[0, -0.06, 0]} />
        </>
      )}
      {status === 'onboarding' && <mesh geometry={GEO.star} material={glowMat(color, 0.4)} scale={[0.26, 0.26, 0.26]} rotation={[Math.PI / 2, 0, 0]} />}
      {status === 'break' && (
        <>
          <mesh geometry={GEO.cyl} material={mat('#fbf8f2')} scale={[0.1, 0.1, 0.1]} />
          <mesh geometry={torusGeo(0.03, 0.01)} material={mat('#fbf8f2')} position={[0.06, 0, 0]} />
        </>
      )}
      {(status === 'rest' || status === 'busy') && (
        <>
          <mesh geometry={GEO.box} material={glowMat(color, 0.4)} scale={[0.12, 0.025, 0.025]} position={[0, 0.05, 0]} />
          <mesh geometry={GEO.box} material={glowMat(color, 0.4)} scale={[0.025, 0.12, 0.025]} rotation={[0, 0, 0.75]} />
          <mesh geometry={GEO.box} material={glowMat(color, 0.4)} scale={[0.12, 0.025, 0.025]} position={[0, -0.05, 0]} />
        </>
      )}
    </group>
  )
}
