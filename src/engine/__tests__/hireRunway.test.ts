// N1 (playtest: taking every garage hire missed payday): the guidance asks for one hire, and only while the cheapest
// hire leaves HIRE_RUNWAY_MIN months; a player who skips the hires that would leave less keeps paying payroll.
import { describe, expect, it } from 'vitest'
import { CONTENT } from '../../content/index'
import * as B from '../balance'
import { createEngine } from '../index'
import { nextStep } from '../loopSelectors'
import type { Action, GameState } from '../types'

const api = createEngine(CONTENT)

describe('hire runway (N1)', () => {
  it('derived.hireRunway: the runway after the cheapest hire; the hire step needs HIRE_RUNWAY_MIN of it', () => {
    const s = api.applyAction(api.createGame({ seed: 1 }), { type: 'startProject', category: 'web' }).state
    expect(s.derived.hireRunway).toBeGreaterThan(B.HIRE_RUNWAY_MIN)
    expect(s.derived.hireRunway!).toBeLessThan(s.finance.runway!)
    expect(nextStep(s).id).toBe('hire')
    const thin: GameState = { ...s, derived: { ...s.derived, hireRunway: B.HIRE_RUNWAY_MIN - 0.5 } }
    expect(nextStep(thin).id).toBe('launch')
  })

  it('one hire and the step is gone; a second would already leave under the bar soon after', () => {
    let s = api.applyAction(api.createGame({ seed: 3 }), { type: 'startProject', category: 'web' }).state
    s = api.applyAction(s, { type: 'hire', candidateId: s.candidates[0]!.id, autoDesk: true }).state
    expect(nextStep(s).id).not.toBe('hire')
    s = api.step(s, 20)
    expect(s.derived.hireRunway!).toBeLessThan(B.HIRE_RUNWAY_MIN + 1)
  })

  it('a garage player who takes only the hires that leave ≥ HIRE_RUNWAY_MIN months never misses payroll', () => {
    for (const seed of [1, 2]) {
      let s = api.createGame({ seed })
      const act = (a: Action) => {
        const r = api.applyAction(s, a)
        if (r.ok) s = r.state
      }
      act({ type: 'startProject', category: 'web' })
      let minCash = Infinity
      while (s.stage === 0 && s.time.day < 320 && !s.gameOver) {
        const step = s.derived.nextStep?.id
        if (step === 'users' && s.founder.focus !== 'users') act({ type: 'setFounderFocus', focus: 'users' })
        if (step === 'round') act({ type: 'startRound' })
        if (s.decisions.active) act({ type: 'answerDecision', cardId: s.decisions.active.cardId, optionIndex: 0 })
        act({ type: 'founderAction', kind: 'salesCall' })
        const cheapest = [...s.candidates].sort((a, b) => a.salary - b.salary)[0]
        if (cheapest && Math.floor(s.time.day) % 10 === 0 && (s.derived.hireRunway ?? 99) >= B.HIRE_RUNWAY_MIN) act({ type: 'hire', candidateId: cheapest.id, autoDesk: true })
        s = api.step(s, 1)
        minCash = Math.min(minCash, s.stats.cash)
        expect(s.finance.payrollMissed ?? false, `seed ${seed} day ${Math.floor(s.time.day)}`).toBeFalsy()
      }
      expect(minCash).toBeGreaterThan(0)
      expect(s.stage).toBe(1)
    }
  })
})
