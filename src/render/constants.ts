// Render-only constants and tiny pure helpers.
import type { GridPos } from '../engine/types'

/** World units per grid cell. */
export const CELL = 1.5
export const WALL_HEIGHT = 2.2
export const WALL_THICKNESS = 0.18
/** Character walking speed, world units per real second at 1x. */
export const WALK_SPEED = 1.6
/** Real milliseconds before an unclicked concept bubble shrinks (PLAN §6.1). */
export const CONCEPT_MINIMIZE_MS = 20_000
/** Ortho zoom multipliers for ZoomLevel 0/1/2 relative to the "fit office" zoom. */
export const ZOOM_FACTORS = [0.72, 1, 1.65] as const
/** Isometric camera direction (from target). */
export const CAMERA_DIR: [number, number, number] = [1, 1.05, 1]

/** Cell → world: one cell is one CELL square (and one floor tile), centred on the founder desk's cell. */
export function gridToWorld(p: GridPos): [number, number] {
  return [p.x * CELL, p.z * CELL]
}

export function yawOf(rotation: number): number {
  return -rotation * (Math.PI / 2)
}

/** Rotate a local (x,z) offset by a slot rotation. */
export function rotateXZ(x: number, z: number, rotation: number): [number, number] {
  const a = yawOf(rotation)
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [x * c + z * s, -x * s + z * c]
}

/** Stable 32-bit string hash (visual variety only, not game logic). */
export function hashString(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Deterministic 0..1 from a string + salt. */
export function hash01(str: string, salt = 0): number {
  return (hashString(`${str}#${salt}`) % 10_000) / 10_000
}

export function pick<T>(list: readonly T[], str: string, salt = 0): T {
  return list[hashString(`${str}#${salt}`) % list.length]!
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt))
}

export interface PowerEnv {
  /** matchMedia('(pointer: coarse)'). */
  coarse: boolean
  /** navigator.hardwareConcurrency (undefined: unknown). */
  cores?: number
  /** navigator.deviceMemory in GB (Chromium only; undefined: unknown). */
  memory?: number
}

/**
 * Cheaper rendering (renderBudget: DPR clamp, no antialias, no shadow map, thinner street traffic). Few cores always;
 * a touch device only when it also reports little memory or few cores: a recent 6-core phone keeps the full look and
 * PerformanceMonitor drops it to lowPower if the frame rate says otherwise.
 */
export function lowPowerFrom({ coarse, cores = 8, memory = 8 }: PowerEnv): boolean {
  return cores <= 4 || (coarse && memory <= 4)
}

export function detectLowPower(): boolean {
  if (typeof window === 'undefined') return false
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { deviceMemory?: number }) : undefined
  return lowPowerFrom({ coarse: window.matchMedia?.('(pointer: coarse)').matches ?? false, cores: nav?.hardwareConcurrency, memory: nav?.deviceMemory })
}

export interface RenderBudget {
  /** Device pixel ratio range for the canvas. */
  dpr: [number, number]
  antialias: boolean
  /** The sun casts a shadow map (the whole scene is drawn a second time into it). */
  shadows: boolean
  shadowMapSize: number
  /** Street cars and walkers: all, every other one, or none. */
  traffic: 'full' | 'thin' | 'none'
}

/**
 * What the scene may spend. Full power keeps the whole look; lowPower is the real fallback: no shadow pass (about a
 * fifth of the draw calls), a lower DPR, no MSAA, and the street traffic thinned (none from stage 4, where the street
 * is backdrop). The office, people, desks and bubbles are never cut.
 */
export function renderBudget(lowPower: boolean, stage: number): RenderBudget {
  if (!lowPower) return { dpr: [1, 2], antialias: true, shadows: true, shadowMapSize: 2048, traffic: 'full' }
  return { dpr: [1, 1.5], antialias: false, shadows: false, shadowMapSize: 1024, traffic: stage >= 4 ? 'none' : 'thin' }
}
