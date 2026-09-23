// M0 "done" check: a scripted console run Garage → Pre-seed using only step/applyAction.
// Run: npx tsx -e "import('./src/engine/devPlay.ts').then(m => m.printDevPlay())"
import { CONTENT } from '../content/index'
import { createEngine } from './index'
import type { Action, EngineApi, GameState } from './types'
import type { EngineContent } from './util'

export interface DevPlayResult {
  state: GameState
  reachedStage: number
  day: number
  actions: number
  log: string[]
}

export interface DevPlayOptions {
  seed?: number
  maxDays?: number
  targetStage?: number
  content?: EngineContent
}

const money = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`

export function runDevPlay(opts: DevPlayOptions = {}): DevPlayResult {
  const api: EngineApi = createEngine(opts.content ?? CONTENT)
  const maxDays = opts.maxDays ?? 540
  const targetStage = opts.targetStage ?? 1
  let s = api.createGame({ seed: opts.seed ?? 1 })
  const log: string[] = []
  let actions = 0

  const act = (a: Action): boolean => {
    const r = api.applyAction(s, a)
    if (r.ok) {
      s = r.state
      actions++
      if (a.type !== 'founderAction' && a.type !== 'openConcept') log.push(`d${Math.floor(s.time.day)} ${a.type} ${JSON.stringify(a).slice(0, 80)}`)
    }
    return r.ok
  }

  const hireDept = (dept: string): boolean => {
    const c = s.candidates.filter((x) => x.dept === dept).sort((a, b) => b.quality - a.quality)[0]
    return c ? act({ type: 'hire', candidateId: c.id }) : false
  }

  act({ type: 'startProject', category: 'web' })
  hireDept('eng')
  hireDept('marketing')

  while (s.time.day < maxDays && s.stage < targetStage && !s.gameOver) {
    // Learn concepts, answer cards (prefer the cash-friendliest option).
    if (s.concepts.active) act({ type: 'openConcept', conceptId: s.concepts.active.id })
    const card = s.decisions.active && (opts.content ?? CONTENT).decisions.find((c) => c.id === s.decisions.active?.cardId)
    if (card) {
      let best = 0
      let bestScore = -Infinity
      card.options.forEach((o, i) => {
        const fx = o.effects
        const score = (fx.cash ?? 0) + (fx.cashPercent ?? 0) * s.stats.cash + (fx.users ?? 0) * 50 + (fx.morale ?? 0) * 100 - (fx.equity ?? 0) * -1e6
        if (score > bestScore) {
          bestScore = score
          best = i
        }
      })
      act({ type: 'answerDecision', cardId: card.id, optionIndex: best })
    }
    for (const e of s.employees) if (e.status === 'leaving') act({ type: 'respondResignation', employeeId: e.id, response: 'talk' }) || act({ type: 'respondResignation', employeeId: e.id, response: 'raise' })

    // Grow the team once the product is live and runway allows.
    const runway = s.finance.runway ?? 99
    if (s.projects.some((p) => p.launched) && s.employees.length < 4 && runway > 5) {
      if (!s.employees.some((e) => e.dept === 'product')) hireDept('product')
      else hireDept('eng') || hireDept('ops') || hireDept('sales')
    }

    // Founder: hustle for users, rest when tired, talk to users now and then.
    if (!s.founder.currentAction) {
      if (s.founder.energy < 20) act({ type: 'founderAction', kind: 'rest' })
      else act({ type: 'founderAction', kind: 'findUsers' }) || act({ type: 'founderAction', kind: 'talkToUsers' })
    }

    if (s.derived.canStartRound && act({ type: 'startRound' })) log.push(`d${Math.floor(s.time.day)} round started (${s.round?.weeksTotal} weeks), valuation ${money(s.finance.valuation)}`)

    s = api.step(s, 1)
    if (Math.floor(s.time.day) % 30 === 0) {
      log.push(
        `m${s.time.month} cash ${money(s.stats.cash)} users ${Math.round(s.stats.users)} mrr ${money(s.finance.mrr)} burn ${money(s.finance.burn)} val ${money(s.finance.valuation)} team ${s.employees.length} morale ${Math.round(s.stats.morale)}`,
      )
    }
  }
  log.push(`end d${Math.floor(s.time.day)} stage ${s.stage} ${s.gameOver ? `gameOver:${s.gameOver.kind}` : ''} learned ${s.concepts.learned.length}`)
  return { state: s, reachedStage: s.stage, day: s.time.day, actions, log }
}

export function printDevPlay(opts: DevPlayOptions = {}): DevPlayResult {
  const r = runDevPlay(opts)
  for (const line of r.log) console.log(line)
  return r
}
