// Guidance as objects (docs/GAMEPLAY_V2.md §11, D8): at most two targets, only open levers after the garage; the step chip
// carries no panel button and every bubble has one reading line at most (source grep, node environment).
import { describe, expect, it } from 'vitest'
import { applyAction, createEngine, createGame, type GameState } from '../engine'
import { CONTENT } from '../content/index'
import { playBot } from '../../sim/bots'
import { NEXT_STEP_IDS, type ActionErrorCode, type NextStepId } from '../engine/types'
import { deskNeeded, dropDeskError, ghostDeskSlot, shopSlotTarget, GUIDANCE_MAX, guidanceTargets, guidedGoal, guidedSlot, guidedTab } from './guidance'

function withStep(id: NextStepId, stage = 0, progress?: number): GameState {
  const s = createGame({ seed: 11 })
  s.stage = stage as GameState['stage']
  s.derived.nextStep = { id, index: 1, total: 8, ...(progress !== undefined ? { progress } : {}) }
  return s
}

/** Past the garage with nothing to suggest: one fresh project, no users, a find that no longer pays. */
function busy(stage = 1): GameState {
  const s = applyAction(createGame({ seed: 11 }), { type: 'startProject', category: 'web' }).state
  s.stage = stage as GameState['stage']
  s.stats.users = 0
  s.derived.findUsers = { min: 0, max: 1, fullLeft: 0, factor: 0.06, reasons: ['circle'] }
  return s
}

/** An eng hire sitting on no project (as after every project reached 1.0). */
function withIdleEng(s: GameState): GameState {
  s.employees.push({ ...structuredClone(createGame({ seed: 2 }).candidates.find((c) => c.dept === 'eng') ?? createGame({ seed: 2 }).candidates[0]!), dept: 'eng', status: 'working', statusSinceDay: 0, hiredDay: 0, morale: 70 } as unknown as GameState['employees'][number])
  return s
}

const SOURCES = import.meta.glob<string>(['./NextStepChip.tsx', './bubbles/*.tsx'], { query: '?raw', import: 'default', eager: true })
const src = (rel: string): string => SOURCES[rel] ?? ''

describe('guidanceTargets', () => {
  it('lights at most two objects for every step', () => {
    for (const id of NEXT_STEP_IDS) {
      const g = guidanceTargets(withStep(id))
      expect(g.length, id).toBeLessThanOrEqual(GUIDANCE_MAX)
      expect(g.length, id).toBeGreaterThan(0)
    }
  })

  it('is empty after the garage when no lever is open, and once the run is over', () => {
    for (const id of NEXT_STEP_IDS) {
      const s = busy(1)
      s.derived.nextStep = { id, index: 1, total: 8 }
      expect(guidanceTargets(s), id).toEqual([])
      expect(guidanceTargets(busy(4)), id).toEqual([])
    }
    const over = withStep('desk')
    over.gameOver = { kind: 'bankrupt', day: 1 } as unknown as GameState['gameOver']
    expect(guidanceTargets(over)).toEqual([])
    const overIdle = withIdleEng(busy(2))
    overIdle.gameOver = { kind: 'bankrupt', day: 1 } as unknown as GameState['gameOver']
    expect(guidanceTargets(overIdle)).toEqual([])
  })

  it('lights the open levers after the garage (playtest LD1, LD3)', () => {
    // Idle builder → Projeler, at any stage.
    expect(guidanceTargets(withIdleEng(busy(1)))).toEqual([{ kind: 'dock', tab: 'projects' }])
    expect(guidedTab(withIdleEng(busy(3)))).toBe('projects')
    expect(guidedTab(withIdleEng(withStep('users')))).toBe('projects')
    // Users coming in with no marketer → Ekip, only while the pool has one to hire.
    const noMkt = busy(1)
    noMkt.stats.users = 40
    const pool = noMkt.candidates
    noMkt.candidates = pool.filter((c) => c.dept !== 'marketing')
    expect(guidanceTargets(noMkt)).toEqual([])
    noMkt.candidates = [...noMkt.candidates, { ...pool[0]!, id: 'c-mkt', dept: 'marketing' }]
    expect(guidanceTargets(noMkt)).toEqual([{ kind: 'dock', tab: 'team' }])
    noMkt.derived.deptCounts = { ...noMkt.derived.deptCounts, marketing: 1 }
    expect(guidanceTargets(noMkt)).toEqual([])
    // A find that still pays breathes; a 6% one does not.
    const find = busy(1)
    find.derived.findUsers = { ...find.derived.findUsers!, factor: 1 }
    expect(guidedSlot(find)).toBe('findUsers')
    expect(guidedSlot(busy(1))).toBeNull()
    // The round pop-in owns a ready or running round.
    find.derived.canStartRound = true
    expect(guidanceTargets(find)).toEqual([])
    find.derived.canStartRound = false
    find.round = { active: true } as unknown as GameState['round']
    expect(guidanceTargets(find)).toEqual([])
    // Idle builders do not breathe over the round moment either, nor over the garage's round / desk steps.
    const idleRound = withIdleEng(busy(2))
    idleRound.derived.canStartRound = true
    expect(guidanceTargets(idleRound)).toEqual([])
    expect(guidedTab(withIdleEng(withStep('round')))).toBe('growth')
    expect(guidedTab(withIdleEng(withStep('desk')))).toBe('shop')
  })

  it('drops the Bul slot in the garage once a find returns little', () => {
    const s = withStep('traction')
    s.derived.findUsers = { min: 0, max: 1, fullLeft: 0, factor: 0.06, reasons: ['circle'] }
    expect(guidanceTargets(s)).toEqual([{ kind: 'dock', tab: 'projects' }])
    s.derived.nextStep = { id: 'users', index: 1, total: 8, progress: 0.5 }
    expect(guidedSlot(s)).toBeNull()
    expect(guidedGoal(s, 'users')).toBe(0.5)
  })

  it('stays within the budget along a played garage', () => {
    const seen = new Set<NextStepId>()
    playBot('bootstrap', 5, CONTENT, 400, (s) => {
      if (s.stage > 0) return
      if (s.derived.nextStep) seen.add(s.derived.nextStep.id)
      expect(guidanceTargets(s).length).toBeLessThanOrEqual(GUIDANCE_MAX)
    })
    // The chain actually moves: past the idea, a desk and a hire.
    expect(seen.size).toBeGreaterThanOrEqual(3)
  })

  it('maps steps to the Dock, the Bul slot and the users goal notch', () => {
    expect(guidedTab(withStep('idea'))).toBe('projects')
    expect(guidedTab(withStep('desk'))).toBe('shop')
    expect(guidedTab(withStep('hire'))).toBe('team')
    expect(guidedTab(withStep('round'))).toBe('growth')
    expect(guidedSlot(withStep('findUsers'))).toBe('findUsers')
    expect(guidedGoal(withStep('users', 0, 0.4), 'users')).toBe(0.4)
    expect(guidedGoal(withStep('users', 0, 3), 'users')).toBe(1)
    expect(guidedGoal(withStep('desk'), 'users')).toBeNull()
    expect(guidedGoal(withStep('users', 1, 0.4), 'users')).toBeNull()
  })

  it('points a bounced hire at the shop while no desk is free', () => {
    const s = createGame({ seed: 3 })
    const err = (code: ActionErrorCode, at = 1) => ({ code, at })
    expect(deskNeeded(s, err('insufficientCash'))).toBe(false)
    expect(deskNeeded(s, null)).toBe(false)
    // A fresh garage has an empty desk slot and no desk on it.
    expect(deskNeeded(s, err('noDesk'))).toBe(true)
    expect(ghostDeskSlot(s)?.type).toBe('desk')
    expect(shopSlotTarget(s, err('noDesk'))).toBe(ghostDeskSlot(s)?.id)
  })

  it('drops the badge once a desk was free, even when that desk fills again', () => {
    const api = createEngine(CONTENT)
    let s = api.createGame({ seed: 1 })
    const bounced = api.applyAction(s, { type: 'hire', candidateId: s.candidates[0]!.id })
    expect(bounced.error).toBe('noDesk')
    const e = { code: bounced.error!, at: 42 }
    let dropped = dropDeskError(0, s, e)
    expect(deskNeeded(s, e, dropped)).toBe(true)
    s = api.applyAction(s, { type: 'placeItem', itemId: 'desk-basic', slotId: 'r1-s1' }).state
    dropped = dropDeskError(dropped, s, e)
    expect(deskNeeded(s, e, dropped)).toBe(false)
    s = api.applyAction(s, { type: 'hire', candidateId: s.candidates[0]!.id }).state
    dropped = dropDeskError(dropped, s, e)
    // Every desk is taken again, but no new error: the badge stays off and Mağaza toggles plainly.
    expect(deskNeeded(s, e, dropped)).toBe(false)
    // A fresh bounce lights it again.
    expect(deskNeeded(s, { code: 'noDesk', at: 43 }, dropped)).toBe(true)
  })

  it('opens the shop on the empty desk slot during the desk step', () => {
    const s = withStep('desk')
    s.derived.nextStep = { ...s.derived.nextStep!, slotId: 'r1-s0' }
    expect(shopSlotTarget(s, null)).toBe('r1-s0')
    expect(shopSlotTarget(withStep('hire'), null)).toBeUndefined()
  })
})

describe('guidance surfaces (source)', () => {
  it('the step chip has no panel button', () => {
    const chip = src('./NextStepChip.tsx')
    expect(chip).toMatch(/NextStepChip/)
    expect(chip).not.toMatch(/step\.go\./)
    expect(chip).not.toMatch(/chevronRight/)
  })

  it('every bubble carries one <p> at most', () => {
    for (const f of ['./bubbles/DecisionBubble.tsx', './bubbles/worldBubble.tsx', './bubbles/shell.tsx']) {
      expect(src(f), f).not.toBe('')
      expect((src(f).match(/<p[\s>]/g) ?? []).length, f).toBeLessThanOrEqual(1)
    }
  })
})
