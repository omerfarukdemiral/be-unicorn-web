// First-run hints (P5): the first time each of the five main HUD numbers moves meaningfully, its tooltip opens by
// itself for HINT_MS, once, then never again (localStorage 'be-unicorn:hints'). That is the whole tutorial: no modal.
// One hint at a time, HINT_GAP_MS apart, never over a source float; a tip not on screen (the phone hides energy behind a sheet) waits its turn.
import { freeCash } from '../engine/loopSelectors'
import type { GameState } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import { hintTip, tipOpen } from './Tip'
import { floatShowing } from './sourceFloats'

export const HINT_IDS = ['cash', 'users', 'energy', 'morale', 'runway'] as const
export type HintId = (typeof HINT_IDS)[number]
export const HINT_MS = 3000
const HINT_GAP_MS = 4500
const KEY = 'be-unicorn:hints'

/** The run's numbers when time first ran (what "moved" is measured against). */
export interface HintBase {
  cash: number
  users: number
  energy: number
  morale: number
  runway: boolean
}

export function hintBase(s: GameState): HintBase {
  return { cash: freeCash(s), users: s.stats.users, energy: s.founder.energy, morale: s.stats.morale, runway: s.unlockedWidgets.includes('runway') }
}

/** True once `id`'s number has moved enough since `base` to be worth explaining (pure). */
export function hintDue(id: HintId, base: HintBase, s: GameState): boolean {
  switch (id) {
    case 'cash':
      return Math.abs(freeCash(s) - base.cash) >= Math.max(500, 0.05 * Math.abs(base.cash))
    case 'users':
      return s.stats.users - base.users >= 1
    case 'energy':
      return base.energy - (s.founder.energy) >= 10
    case 'morale':
      return Math.abs(s.stats.morale - base.morale) >= 5
    case 'runway':
      return !base.runway && s.unlockedWidgets.includes('runway')
  }
}

function readSeen(): Set<string> {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function writeSeen(seen: Set<string>): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify([...seen]))
  } catch {
    // Storage full or blocked: the hint may show again next run, play never breaks on it.
  }
}

if (typeof window !== 'undefined') {
  const seen = readSeen()
  let base: HintBase | null = null
  let generation = -1
  let lastShown = 0
  useGameStore.subscribe((st) => {
    if (seen.size >= HINT_IDS.length) return
    if (st.ui.generation !== generation) {
      generation = st.ui.generation
      base = null
    }
    if (!st.ui.runStarted || st.state.gameOver) return
    if (!base) base = hintBase(st.state)
    // Never over an open decision, panel bubble or another tip: the player is reading something else.
    if (st.ui.pauseReasons.length > 0 || tipOpen() || floatShowing()) return
    const now = performance.now()
    if (now - lastShown < HINT_GAP_MS) return
    for (const id of HINT_IDS) {
      if (seen.has(id) || !hintDue(id, base, st.state)) continue
      if (!hintTip(id, HINT_MS)) continue
      seen.add(id)
      writeSeen(seen)
      lastShown = now
      return
    }
  })
}
