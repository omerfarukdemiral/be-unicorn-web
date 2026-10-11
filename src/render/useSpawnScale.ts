// Spawn / despawn scale for scene objects: placed furniture, status icons, characters after a stage
// move. Scale only (materials are shared caches, so never opacity). Runs on real time so a held
// world (open bubble, shop) still shows what was just bought growing in.
import { useFrame } from '@react-three/fiber'
import { useRef, useState, type RefObject } from 'react'
import type * as THREE from 'three'

export const SPAWN_MS = 250
export const DESPAWN_MS = 200
/** Never exactly 0: a zero scale makes a singular matrix (shadows / raycasts). */
export const MIN_SCALE = 0.001

/** easeOutBack: overshoots a little and settles at 1 (a small "plop"). */
export function easeOutBack(k: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  const x = Math.min(1, Math.max(0, k)) - 1
  return 1 + c3 * x * x * x + c1 * x * x
}

/** Scale `elapsedMs` into a spawn: MIN_SCALE → 1 over SPAWN_MS (easeOutBack). */
export function spawnCurve(elapsedMs: number): number {
  if (elapsedMs >= SPAWN_MS) return 1
  return Math.max(MIN_SCALE, easeOutBack(elapsedMs / SPAWN_MS))
}

/** Scale `elapsedMs` into a despawn: 1 → MIN_SCALE over DESPAWN_MS (ease-in). */
export function despawnCurve(elapsedMs: number): number {
  const k = Math.min(1, Math.max(0, elapsedMs / DESPAWN_MS))
  return Math.max(MIN_SCALE, 1 - k * k)
}

export interface SpawnScaleOptions {
  /** Grow in on mount. False on the first mount of a layer (a loaded office does not plop in piece by piece). */
  spawn: boolean
  /** Shrink out now; onExited fires once it reaches MIN_SCALE. */
  exiting?: boolean
  onExited?: () => void
  /** Scale the object rests at (default 1). */
  base?: number
}

/**
 * Drives `ref`'s uniform scale. Returns the scale to pass as the JSX `scale` prop on mount, so the
 * first frame is already small (no full-size flash before useFrame runs). The value is stable, so
 * re-renders never reset the animation.
 */
export function useSpawnScale(ref: RefObject<THREE.Object3D | null>, opts: SpawnScaleOptions): number {
  const base = opts.base ?? 1
  const [initial] = useState(() => (opts.spawn ? MIN_SCALE : base))
  const born = useRef(opts.spawn ? -1 : -2)
  const leftAt = useRef(-1)
  const done = useRef(false)
  const latest = useRef(opts)
  latest.current = opts
  useFrame(() => {
    const o = ref.current
    if (!o || done.current) return
    const now = performance.now()
    const p = latest.current
    const b = p.base ?? 1
    if (p.exiting) {
      if (leftAt.current < 0) leftAt.current = now
      const s = despawnCurve(now - leftAt.current) * b
      o.scale.setScalar(s)
      if (now - leftAt.current >= DESPAWN_MS) {
        done.current = true
        p.onExited?.()
      }
      return
    }
    // An exit called off half way grows back in.
    if (leftAt.current >= 0) {
      leftAt.current = -1
      born.current = now
    }
    if (born.current === -2) return
    if (born.current === -1) born.current = now
    const e = now - born.current
    o.scale.setScalar(spawnCurve(e) * b)
    if (e >= SPAWN_MS) born.current = -2
  })
  return initial
}
