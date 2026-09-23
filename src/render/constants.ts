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

/** True on touch-first or small devices; used to pick cheaper shadows. */
export function detectLowPower(): boolean {
  if (typeof window === 'undefined') return false
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
  const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 8) : 8
  return coarse || cores <= 4
}
