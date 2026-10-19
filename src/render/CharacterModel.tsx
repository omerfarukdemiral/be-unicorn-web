// Low-poly person: body + head + limbs, department colour, small accessories.
// World units, feet at y=0, facing +z. Animated by Character/Npc through the `rig` object.
import { useFrame } from '@react-three/fiber'
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type * as THREE from 'three'
import type { EmployeeStatus } from '../engine/types'
import { bakeSkinned } from './bake'
import { REAL_LOOK } from './look'
import { GEO, boxPart, capsuleGeo, glowMat, mat, torsoGeo, torusGeo } from './resources'
import { STATUS_COLORS } from './palette'
import { damp } from './constants'
import { sceneTime } from './sceneRegistry'

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
const SHOE = '#2a2624'

// Realistic look parts (look.ts): rounded limbs, shoes, a neck, a face with brows, nose and ears, hair that covers the
// back of the head. Same rig groups and pivots as the classic model, so every animation drives them unchanged.

/** Hangs from the hip pivot: one rounded leg and a shoe pointing forward. */
function RealLeg({ legs }: { legs: string }) {
  return (
    <>
      <mesh geometry={capsuleGeo(0.052, 0.2)} material={mat(legs, 'fabric')} position={[0, -0.13, 0]} />
      <mesh geometry={GEO.sphereSmooth} material={mat(SHOE)} scale={[0.1, 0.065, 0.17]} position={[0, -0.28, 0.025]} />
    </>
  )
}

/** Hangs from the shoulder pivot: a sleeve and a hand. */
function RealArm({ body, skin }: { body: string; skin: string }) {
  return (
    <>
      <mesh geometry={capsuleGeo(0.045, 0.17)} material={mat(body, 'fabric')} position={[0, -0.12, 0]} />
      <mesh geometry={GEO.sphereSmooth} material={mat(skin, 'skin')} scale={[0.075, 0.085, 0.07]} position={[0, -0.27, 0]} />
    </>
  )
}

/** Head pivot at its centre; the face looks down +z. */
function RealHead({ skin, hair, hairStyle }: { skin: string; hair: string; hairStyle: number }) {
  const s = mat(skin, 'skin')
  const h = mat(hair, 'hair')
  const lock = boxPart([0.26, 0.22, 0.08])
  return (
    <>
      <mesh geometry={GEO.sphereSmooth} material={s} scale={[0.27, 0.31, 0.28]} castShadow />
      {[-1, 1].map((x) => (
        <group key={x}>
          <mesh geometry={GEO.sphereSmooth} material={mat(EYE)} scale={[0.03, 0.036, 0.02]} position={[x * 0.055, 0.015, 0.128]} />
          <mesh geometry={GEO.box} material={hairStyle === 3 ? mat('#6b5a4c') : h} scale={[0.055, 0.012, 0.014]} position={[x * 0.056, 0.058, 0.127]} rotation={[0, 0, x * -0.12]} />
          <mesh geometry={GEO.sphereSmooth} material={s} scale={[0.04, 0.065, 0.03]} position={[x * 0.135, 0, -0.005]} />
        </group>
      ))}
      <mesh geometry={GEO.sphereSmooth} material={s} scale={[0.035, 0.05, 0.045]} position={[0, -0.022, 0.142]} />
      {hairStyle !== 3 && (
        <>
          <mesh geometry={GEO.dome} material={h} scale={[0.3, 0.3, 0.31]} position={[0, 0.025, -0.008]} rotation={[-0.28, 0, 0]} />
          <mesh geometry={GEO.sphereSmooth} material={h} scale={[0.285, 0.27, 0.27]} position={[0, 0.0, -0.03]} />
        </>
      )}
      {hairStyle === 1 && <mesh geometry={lock.geometry} material={h} position={[0, -0.08, -0.105]} />}
      {hairStyle === 2 && <mesh geometry={GEO.sphereSmooth} material={h} scale={[0.12, 0.12, 0.12]} position={[0, 0.15, -0.09]} />}
    </>
  )
}

export const CharacterModel = memo(function CharacterModel({ look, rig }: { look: CharacterLook; rig?: Rig }) {
  const own = useRef<Rig | null>(null)
  const r = rig ?? (own.current ??= createRig())
  const legs = look.legs ?? '#5b5866'
  const acc = look.accessories
  // One skinned draw call per person instead of ~14 meshes: every part rides on its rig group (bake.ts). The cup
  // toggles its own visibility, so it stays out of the bake.
  const root = useRef<THREE.Group>(null)
  const lookKey = JSON.stringify(look)
  useLayoutEffect(() => {
    const g = root.current
    if (!g) return
    const bones = [g, r.legL, r.legR, r.body, r.armL, r.armR, r.head].filter((b): b is THREE.Group => !!b)
    return bakeSkinned(g, bones, { shadow: 'all' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookKey, r])
  return (
    <group ref={root} scale={look.scale ?? 1}>
      <group ref={(o) => void (r.legL = o)} position={[-0.08, 0.3, 0]}>
        {REAL_LOOK ? <RealLeg legs={legs} /> : <mesh geometry={GEO.box} material={mat(legs)} scale={[0.1, 0.3, 0.11]} position={[0, -0.15, 0]} />}
      </group>
      <group ref={(o) => void (r.legR = o)} position={[0.08, 0.3, 0]}>
        {REAL_LOOK ? <RealLeg legs={legs} /> : <mesh geometry={GEO.box} material={mat(legs)} scale={[0.1, 0.3, 0.11]} position={[0, -0.15, 0]} />}
      </group>
      <group ref={(o) => void (r.body = o)}>
        {REAL_LOOK ? (
          <>
            <mesh geometry={torsoGeo()} material={mat(look.body, 'fabric')} scale={[1, 1, 0.72]} castShadow />
            <mesh geometry={GEO.cylSmooth} material={mat(legs, 'fabric')} scale={[0.3, 0.07, 0.22]} position={[0, 0.315, 0]} />
            <mesh geometry={GEO.cylSmooth} material={mat(look.skin, 'skin')} scale={[0.09, 0.1, 0.09]} position={[0, 0.71, 0]} />
          </>
        ) : (
          <mesh geometry={GEO.cyl} material={mat(look.body)} scale={[0.36, 0.36, 0.26]} position={[0, 0.48, 0]} castShadow />
        )}
        {acc.includes('tie') && <mesh geometry={GEO.box} material={mat('#e8c46a')} scale={[0.05, 0.22, 0.02]} position={[0, 0.5, 0.13]} />}
        <group ref={(o) => void (r.armL = o)} position={[-0.22, 0.63, 0]}>
          {REAL_LOOK ? <RealArm body={look.body} skin={look.skin} /> : (
            <>
              <mesh geometry={GEO.box} material={mat(look.body)} scale={[0.08, 0.28, 0.09]} position={[0, -0.13, 0]} />
              <mesh geometry={GEO.sphere} material={mat(look.skin)} scale={[0.08, 0.08, 0.08]} position={[0, -0.28, 0]} />
            </>
          )}
          {acc.includes('briefcase') && <mesh geometry={GEO.box} material={mat('#6b4a33')} scale={[0.2, 0.14, 0.06]} position={[0, -0.36, 0]} />}
        </group>
        <group ref={(o) => void (r.armR = o)} position={[0.22, 0.63, 0]}>
          {REAL_LOOK ? <RealArm body={look.body} skin={look.skin} /> : (
            <>
              <mesh geometry={GEO.box} material={mat(look.body)} scale={[0.08, 0.28, 0.09]} position={[0, -0.13, 0]} />
              <mesh geometry={GEO.sphere} material={mat(look.skin)} scale={[0.08, 0.08, 0.08]} position={[0, -0.28, 0]} />
            </>
          )}
          <group ref={(o) => void (r.cup = o)} position={[0, -0.3, 0.05]} visible={false} userData={{ noBake: true }}>
            <mesh geometry={GEO.cyl} material={mat('#fbf8f2')} scale={[0.07, 0.09, 0.07]} />
            <mesh geometry={GEO.cyl} material={mat('#7a5230')} scale={[0.06, 0.01, 0.06]} position={[0, 0.045, 0]} />
          </group>
          {acc.includes('notebook') && <mesh geometry={GEO.box} material={mat('#fbf8f2')} scale={[0.12, 0.16, 0.03]} position={[0, -0.32, 0.05]} />}
          {acc.includes('camera') && <mesh geometry={GEO.box} material={mat('#2b2a33')} scale={[0.14, 0.1, 0.1]} position={[0, -0.32, 0.06]} />}
        </group>
        <group ref={(o) => void (r.head = o)} position={[0, REAL_LOOK ? 0.83 : 0.84, 0]} scale={REAL_LOOK ? 0.86 : 1}>
          {REAL_LOOK ? (
            <RealHead skin={look.skin} hair={look.hair} hairStyle={look.hairStyle} />
          ) : (
            <>
              <mesh geometry={GEO.sphere} material={mat(look.skin)} scale={[0.3, 0.3, 0.3]} castShadow />
              <mesh geometry={GEO.sphere} material={mat(EYE)} scale={[0.04, 0.05, 0.03]} position={[-0.06, 0.02, 0.135]} />
              <mesh geometry={GEO.sphere} material={mat(EYE)} scale={[0.04, 0.05, 0.03]} position={[0.06, 0.02, 0.135]} />
              {look.hairStyle !== 3 && (
                <mesh geometry={GEO.dome} material={mat(look.hair, 'hair')} scale={[0.33, 0.3, 0.33]} position={[0, 0.02, -0.01]} rotation={[-0.25, 0, 0]} />
              )}
              {look.hairStyle === 1 && <mesh geometry={GEO.box} material={mat(look.hair, 'hair')} scale={[0.3, 0.26, 0.1]} position={[0, -0.08, -0.12]} />}
              {look.hairStyle === 2 && <mesh geometry={GEO.sphere} material={mat(look.hair, 'hair')} scale={[0.13, 0.13, 0.13]} position={[0, 0.17, -0.08]} />}
            </>
          )}
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

/** Amber "…" over a builder with nothing to build (playtest LD1). */
const IDLE_COLOR = '#f2b544'

type IconStatus = EmployeeStatus | 'rest' | 'busy' | 'idle' | 'none'

/** The "…" idle marker waits this long before showing (a builder between tasks is not news). */
export const IDLE_ICON_DELAY_MS = 1500

/**
 * Floating status icon above the head (PLAN §7.2). Stays mounted: it grows in (damped, 12/s) when a
 * status appears and shrinks out before unmounting when it clears, instead of blinking.
 */
export function StatusIcon({ status: want, y = 1.2 }: { status: IconStatus; y?: number }) {
  const g = useRef<THREE.Group>(null)
  const on = want !== 'working' && want !== 'none'
  // What is drawn: the live status, or the last one while it shrinks away.
  const [shown, setShown] = useState<IconStatus | null>(on ? want : null)
  if (on && shown !== want) setShown(want)
  const since = useRef(performance.now())
  const prev = useRef(want)
  useEffect(() => {
    if (prev.current !== want) since.current = performance.now()
    prev.current = want
  }, [want])
  const k = useRef(on && want !== 'idle' ? 1 : 0)
  const latest = useRef({ on, want, shown })
  latest.current = { on, want, shown }
  useFrame((_, rawDt) => {
    const o = g.current
    if (!o) return
    const l = latest.current
    const target = l.on && (l.want !== 'idle' || performance.now() - since.current > IDLE_ICON_DELAY_MS) ? 1 : 0
    k.current = damp(k.current, target, 12, Math.min(rawDt, 0.1))
    o.scale.setScalar(Math.max(0.001, k.current))
    o.visible = k.current > 0.01
    if (!l.on && k.current < 0.01 && l.shown !== null) setShown(null)
    // Bob / spin on scene time: a held world holds the icons too.
    const t = sceneTime.t
    o.position.y = y + Math.sin(t * 2.4) * 0.03
    o.rotation.y = t * 0.8
  })
  if (shown === null || shown === 'working' || shown === 'none') return null
  const status = shown
  const color = status === 'rest' ? '#9cc9f5' : status === 'busy' ? '#c9a7f5' : status === 'idle' ? IDLE_COLOR : STATUS_COLORS[status]
  const s0 = Math.max(0.001, k.current)
  return (
    <group ref={g} position={[0, y, 0]} scale={s0} visible={k.current > 0.01}>
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
      {status === 'idle' &&
        [-0.08, 0, 0.08].map((x) => <mesh key={x} geometry={GEO.sphere} material={glowMat(color, 0.4)} scale={[0.045, 0.045, 0.045]} position={[x, 0, 0]} />)}
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
