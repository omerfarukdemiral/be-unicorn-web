// Effort crises slow time (E1 round 3): burnout and every resignation notice drop 2× / 4× to 1× and hold it until the
// person is answered, gone, or SLOWDOWN_MS of wall time pass (round 6: never waiting on a tap); the player's own speed
// comes back, and a manual setSpeed wins.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as B from '../engine/balance'
import { SECONDS_PER_DAY, type Employee, type GameState } from '../engine/types'
import { useGameStore } from './gameStore'

const store = () => useGameStore.getState()

/** A Pre-seed run with one engineer about to show as burnt out on the next day, at `speed`. */
function burntRun(speed: 1 | 2 | 4): void {
  store().newGame({ seed: 7, founderXp: 0, runIndex: 0 })
  const s = store().state
  const p = { id: 'p1', name: 'P', category: 'web' as const, size: 10, maturity: 0.3, launched: true, releaseLevel: 1, createdDay: 0, assignedIds: ['e9'] }
  const e: Employee = { id: 'e9', name: 'Ada', dept: 'eng', quality: 1, salary: 3000, status: 'working', statusSinceDay: 0, hiredDay: -100, morale: 70, fatigue: 92, loadAvg: 2, projectId: 'p1' }
  useGameStore.setState({ state: { ...s, stage: 1, projects: [p], employees: [e], candidates: [], decisions: { ...s.decisions, active: undefined } } as GameState })
  store().dispatch({ type: 'setSpeed', speed })
}

const run = (until: () => boolean, max = 600) => {
  for (let i = 0; i < max && !until(); i++) store().tick(SECONDS_PER_DAY / 8)
}
const eng = () => store().state.employees.find((x) => x.id === 'e9')

describe('effort crisis hold', () => {
  // A fake wall clock: 100 ms per read (the hold is wall time, round 6).
  let clock = 0
  beforeEach(() => {
    store().setSlowOnMoments(true)
    vi.spyOn(performance, 'now').mockImplementation(() => (clock += 100))
  })
  afterEach(() => vi.restoreAllMocks())

  it('burnout at 4× drops to 1× and the answered person gives the 4× back', () => {
    burntRun(4)
    run(() => store().ui.effortHold !== null)
    expect(store().ui.effortHold).toMatchObject({ prevSpeed: 4, employeeIds: ['e9'] })
    expect(store().state.time.speed).toBe(1)
    // Still burnt out: time stays at 1× well past the old 3-day window.
    const day = store().state.time.day
    run(() => store().state.time.day > day + 4, 400)
    expect(store().state.time.speed).toBe(1)
    // Rested (leave / calm worked): the hold ends and 4× returns.
    useGameStore.setState((x) => ({ state: { ...x.state, employees: x.state.employees.map((e) => ({ ...e, fatigue: 10, loadAvg: 1, status: 'working' as const, burnoutDays: 0 })) } }))
    run(() => store().ui.effortHold === null, 40)
    expect(store().ui.effortHold).toBeNull()
    expect(store().state.time.speed).toBe(4)
  })

  it('a burnout at 2× holds and restores 2×', () => {
    burntRun(2)
    run(() => store().ui.effortHold !== null)
    expect(store().ui.effortHold?.prevSpeed).toBe(2)
    expect(store().state.time.speed).toBe(1)
  })

  it('gone people end the hold; so does the hold window', () => {
    burntRun(4)
    run(() => store().ui.effortHold !== null)
    useGameStore.setState((x) => ({ state: { ...x.state, employees: [] } }))
    run(() => store().ui.effortHold === null, 40)
    expect(store().state.time.speed).toBe(4)
    burntRun(4)
    run(() => store().ui.effortHold !== null)
    expect(store().ui.effortHold!.untilDay - store().state.time.day).toBeLessThanOrEqual(B.EFFORT_HOLD_DAYS)
  })

  it('a manual setSpeed clears the hold: the player wins', () => {
    burntRun(4)
    run(() => store().ui.effortHold !== null)
    store().dispatch({ type: 'setSpeed', speed: 2 })
    expect(store().ui.effortHold).toBeNull()
    // Rested, so no fresh crisis (a new notice would start a new hold, and its card keeps the 1×).
    useGameStore.setState((x) => ({ state: { ...x.state, employees: x.state.employees.map((e) => ({ ...e, fatigue: 10, loadAvg: 1, status: 'working' as const, burnoutDays: 0 })) } }))
    const day = store().state.time.day
    run(() => store().state.time.day > day + 20, 800)
    // A card that came meanwhile holds 1× (P5) and hands the player's 2× back.
    expect(store().state.time.speed === 2 || store().ui.decisionSlow === 2).toBe(true)
  })

  it('a resignation notice (any cause) holds too, for the person on notice', () => {
    burntRun(4)
    useGameStore.setState((x) => ({ state: { ...x.state, employees: x.state.employees.map((e) => ({ ...e, fatigue: 50, loadAvg: 1, morale: 5 })) } }))
    run(() => store().ui.effortHold !== null)
    expect(eng()?.status).toBe('leaving')
    expect(store().ui.effortHold).toMatchObject({ prevSpeed: 4, employeeIds: ['e9'] })
    expect(store().state.time.speed).toBe(1)
  })

  it('P5: a payday desk waiting is a decision: the hold hands its 4× over and 1× stays until the desk closes', () => {
    burntRun(4)
    run(() => store().ui.effortHold !== null)
    useGameStore.setState((x) => ({
      state: { ...x.state, finance: { ...x.state.finance, pendingPayday: { day: x.state.time.day, ledger: { salaries: 0, rent: 0, infra: 0, ads: 0 }, deferredBefore: 0 } as never }, employees: x.state.employees.map((e) => ({ ...e, fatigue: 10, loadAvg: 1, status: 'working' as const, burnoutDays: 0 })) },
    }))
    run(() => store().ui.effortHold === null, 40)
    expect(store().ui.effortHold).toBeNull()
    expect(store().state.time.speed).toBe(1)
    expect(store().ui.decisionSlow).toBe(4)
  })

  it('a card arriving during the hold takes it over (P5: 1× until answered); an expanded one stops ticks', () => {
    burntRun(4)
    run(() => store().ui.effortHold !== null)
    const untilDay = store().ui.effortHold!.untilDay
    useGameStore.setState((x) => ({ state: { ...x.state, decisions: { ...x.state.decisions, active: { cardId: 'remote-vs-office', shownDay: x.state.time.day } } } }))
    // Expanded: a focus pause, the world does not move.
    store().setDecisionExpanded(true)
    const day = store().state.time.day
    for (let i = 0; i < 20; i++) store().tick(SECONDS_PER_DAY / 8)
    expect(store().state.time.day).toBe(day)
    // Collapsed and never answered: the card owns the 1× now and gives the 4× back once it closes.
    store().setDecisionExpanded(false)
    expect(store().ui.effortHold).toBeNull()
    expect(store().ui.decisionSlow).toBe(4)
    expect(store().state.time.speed).toBe(1)
    expect(untilDay).toBeGreaterThan(0)
    useGameStore.setState((x) => ({ state: { ...x.state, decisions: { ...x.state.decisions, active: undefined } } }))
    expect(store().state.time.speed).toBe(4)
  })

  it('1× needs no hold, and "Önemli anda yavaşla" off leaves the speed alone', () => {
    burntRun(1)
    run(() => (eng()?.burnoutDays ?? 0) > 0)
    expect(store().ui.effortHold).toBeNull()
    store().setSlowOnMoments(false)
    burntRun(4)
    run(() => (eng()?.burnoutDays ?? 0) > 0)
    expect(store().state.time.speed).toBe(4)
    expect(store().ui.effortHold).toBeNull()
  })
})
