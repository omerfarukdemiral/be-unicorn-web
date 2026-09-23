// The single tick: step(state, dtDays). Game and sim call the same function (PLAN §8.3).
// Internally sub-steps in FIXED_STEP_DAYS chunks so the result does not depend on how callers batch dt.
import type { OfficeLineTrigger } from '../content/index'
import * as B from './balance'
import * as E from './economy'
import { evaluateConcepts } from './concepts'
import { applyDueEffects, maybeShowDecision } from './decisions'
import { recomputeDerived, type Outputs } from './derive'
import { dailyEndgame } from './endgame'
import { completeFounderAction, dailyFounder, regenEnergy } from './founder'
import { dailyPeople, driftMorale, fillCandidates } from './people'
import { Rng } from './rng'
import { progressRound } from './round'
import { DAYS_PER_MONTH, DAYS_PER_WEEK, FIXED_STEP_DAYS, type GameEventKind, type GameState } from './types'
import { clone, modifierMult, pushActivity, pushEvent, type EngineContent } from './util'
import { checkMilestones, dailyVisitors, detectArchetype, expireBubbles, idleLine, monthEnd, sayLine, updateRivalPressure } from './world'

const EVENT_LINE: Partial<Record<GameEventKind, OfficeLineTrigger>> = {
  hired: 'hire',
  fired: 'fire',
  resigned: 'resign',
  milestone: 'milestone',
  projectLaunched: 'launch',
  roundStarted: 'roundStarted',
  roundClosed: 'roundClosed',
  stageUp: 'stageUp',
}

export function step(state: GameState, dtDays: number, content: EngineContent): GameState {
  if (state.gameOver || !(dtDays > 0)) return state
  const s = clone(state)
  const rng = new Rng(s.rng)
  let remaining = dtDays
  while (remaining > 1e-9 && !s.gameOver) {
    const dt = Math.min(FIXED_STEP_DAYS, remaining)
    remaining -= dt
    advance(s, content, rng, dt)
  }
  s.rng = rng.snapshot()
  recomputeDerived(s, content)
  return s
}

function advance(s: GameState, content: EngineContent, rng: Rng, dt: number): void {
  const o = recomputeDerived(s, content)
  const prevDay = s.time.day
  s.time.day = prevDay + dt
  s.time.month = Math.floor(s.time.day / DAYS_PER_MONTH)

  // Monthly values flow daily, pro rata.
  const inflow = ((s.derived.channels.organic + s.derived.channels.paid) / DAYS_PER_MONTH) * dt
  const lost = ((s.stats.users * s.stats.churn) / DAYS_PER_MONTH) * dt
  s.stats.users = Math.max(0, s.stats.users + inflow - lost)
  s.stats.cash += (s.finance.net / DAYS_PER_MONTH) * dt

  progressProjects(s, o, dt)
  driftMorale(s, content, o, dt)
  regenEnergy(s, dt)
  progressRound(s, content, dt, modifierMult(s, 'roundSpeed'))
  const run = s.founder.currentAction
  if (run && run.endDay <= s.time.day) completeFounderAction(s, rng)
  expireBubbles(s)

  for (let d = Math.floor(prevDay) + 1; d <= Math.floor(s.time.day); d++) {
    daily(s, content, rng, d)
    if (s.gameOver) return
  }
}

/** §5.3: assigned builders (+ idle founder) raise maturity; parallel projects & tech debt slow it. */
export function progressProjects(s: GameState, o: Outputs, dt: number): void {
  const active = s.projects.filter((p) => p.maturity < 1)
  if (!active.length) return
  const speed =
    E.parallelProjectSpeed(active.length, s.stage) *
    Math.max(B.TECH_DEBT_MIN_SPEED, 1 - B.TECH_DEBT_PER_POINT * s.techDebt) *
    (1 + o.fx.maturityBonus)
  const founderProject = s.founder.currentAction ? undefined : active[0]
  for (const p of active) {
    let eng = p === founderProject ? B.FOUNDER_PROJECT_OUTPUT : 0
    let prod = 0
    for (const id of p.assignedIds) {
      const e = s.employees.find((x) => x.id === id)
      if (!e) continue
      if (e.dept === 'eng') eng += o.perEmployee[id] ?? 0
      else if (e.dept === 'product') prod += o.perEmployee[id] ?? 0
    }
    p.maturity = Math.min(1, p.maturity + (E.maturityPerMonth(eng, prod, speed, p.size) / DAYS_PER_MONTH) * dt)
    if (!p.launched && E.isLaunched(p.maturity)) {
      p.launched = true
      p.launchedDay = s.time.day
      pushActivity(s, 'projectLaunched', { project: p.name, id: p.id })
      pushEvent(s, { kind: 'projectLaunched', refId: p.id })
    }
  }
}

function daily(s: GameState, content: EngineContent, rng: Rng, day: number): void {
  recomputeDerived(s, content)
  dailyEndgame(s, content)
  if (s.gameOver) return
  dailyPeople(s, content)
  dailyFounder(s)
  s.modifiers = s.modifiers.filter((m) => m.untilDay > s.time.day)
  s.candidates = s.candidates.filter((c) => c.expiresDay > s.time.day)
  if (day % DAYS_PER_WEEK === 0) fillCandidates(s, content, rng)
  applyDueEffects(s, content)
  checkMilestones(s)
  if (day % DAYS_PER_MONTH === 0) monthEnd(s)
  updateRivalPressure(s)
  detectArchetype(s)
  recomputeDerived(s, content)
  evaluateConcepts(s, content.concepts)
  if (s.round?.active && s.stats.cash < 0 && !s.decisions.history.some((h) => h.cardId === B.BRIDGE_CARD_ID) && !s.decisions.queue.includes(B.BRIDGE_CARD_ID) && s.decisions.active?.cardId !== B.BRIDGE_CARD_ID && content.decisions.some((c) => c.id === B.BRIDGE_CARD_ID)) {
    s.decisions.queue.push(B.BRIDGE_CARD_ID)
  }
  maybeShowDecision(s, content, rng)
  dailyVisitors(s, rng)
  eventLines(s, content, rng)
}

/** One ambient line per day reacting to the newest notable event, else a situational idle line. */
function eventLines(s: GameState, content: EngineContent, rng: Rng): void {
  const last = Number(s.flags['lineEventId'] ?? 0)
  const fresh = s.events.filter((e) => e.id > last)
  s.flags['lineEventId'] = s.events[s.events.length - 1]?.id ?? last
  for (let i = fresh.length - 1; i >= 0; i--) {
    const ev = fresh[i]!
    if (ev.kind === 'decisionAnswered') {
      const card = content.decisions.find((c) => c.id === ev.refId)
      if (card?.category === 'crisis' && sayLine(s, content, rng, 'crisisResolved')) return
      continue
    }
    const trig = EVENT_LINE[ev.kind]
    if (trig && sayLine(s, content, rng, trig, ev.milestone)) return
  }
  idleLine(s, content, rng)
}
