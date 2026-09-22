// Deterministic seeded RNG (mulberry32). Pure: state lives in GameState.rng.
import type { RngState } from './types'

/** FNV-1a string hash → uint32 seed. */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function createRngState(seed: number): RngState {
  const s = seed >>> 0
  return { seed: s, state: s }
}

/** One mulberry32 draw: returns a float in [0,1) and the next state. */
export function rngNext(rng: RngState): { value: number; rng: RngState } {
  const state = (rng.state + 0x6d2b79f5) >>> 0
  let t = state
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return { value, rng: { seed: rng.seed, state } }
}

/**
 * Mutable cursor for use inside one engine step:
 *   const r = new Rng(state.rng); ...; next.rng = r.snapshot()
 */
export class Rng {
  private current: RngState

  constructor(state: RngState) {
    this.current = { seed: state.seed, state: state.state }
  }

  /** Float in [0,1). */
  next(): number {
    const { value, rng } = rngNext(this.current)
    this.current = rng
    return value
  }

  /** Float in [min,max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next()
  }

  /** Integer in [min,max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1))
  }

  chance(p: number): boolean {
    return this.next() < p
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: empty list')
    return items[Math.floor(this.next() * items.length)] as T
  }

  /** Weighted pick; weights ≤ 0 are skipped. */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T | undefined {
    let total = 0
    for (const it of items) total += Math.max(0, weight(it))
    if (total <= 0) return undefined
    let roll = this.next() * total
    for (const it of items) {
      roll -= Math.max(0, weight(it))
      if (roll < 0) return it
    }
    return items[items.length - 1]
  }

  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice()
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1))
      const tmp = out[i] as T
      out[i] = out[j] as T
      out[j] = tmp
    }
    return out
  }

  snapshot(): RngState {
    return { seed: this.current.seed, state: this.current.state }
  }
}
