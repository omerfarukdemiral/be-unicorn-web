// Guided naive player (fix round 3, NEW-1/NEW-2): a new player who only does what the game points at.
// - follows the next-step chip (state.derived.nextStep, and its concrete move when there is one: stepAction),
// - sets the "users" focus once at the start (the tester's first click),
// - takes a hire offer now and then, but never a red one (runway after < HIRE_RUNWAY_MIN),
// - answers every bubble with its first option (cards, meetings, resignations), opens concept cards,
// - leaves the payday desk to its default.
// Usage: npx tsx sim/naive.ts [--seeds 12] [--days 1200] [--trace <seed>] [--solo 1]
// Prints per seed: Pre-seed / Seed / A days, missed paydays in the garage, min cash, game over.
import { CONTENT } from '../src/content/index'
import { balance, createEngine, MEETING_PITCHES, stepAction, type Action, type GameState } from '../src/engine/index'
import { autoPaydayChoice } from '../src/engine/loop'

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? Number(process.argv[i + 1]) : fallback
}
const SEEDS = arg('seeds', 12)
const FROM = arg('from', 1)
const DAYS = arg('days', 1200)
const TRACE = arg('trace', 0)
/** NEW-2: the founder who never hires. */
const SOLO = arg('solo', 0) === 1
/** Days between two looks at the Ekip offers (the tester opened Ekip every ~20 loop turns). */
const HIRE_LOOK_DAYS = 40

export interface NaiveRun {
  seed: number
  stageDays: (number | null)[]
  garageMissed: number
  minCash: number
  over: string | null
  hires: number
  moves: Record<string, number>
}

export function playNaive(seed: number, maxDays = DAYS, solo = SOLO, trace = false): NaiveRun {
  const api = createEngine(CONTENT)
  let s: GameState = api.createGame({ seed })
  const act = (a: Action): boolean => {
    const r = api.applyAction(s, a)
    if (r.ok) s = r.state
    return r.ok
  }
  const stageDays: (number | null)[] = [0, null, null, null, null, null, null]
  let garageMissed = 0
  let minCash = Infinity
  let hires = 0
  let lastLook = 0
  const moves: Record<string, number> = {}
  let seen = 0
  act({ type: 'setFounderFocus', focus: 'users' })
  while (!s.gameOver && s.time.day < maxDays && s.stage < 3) {
    // Bubbles: concept cards, the decision card, a meeting, a leaver: the first option each.
    for (let i = 0; i < 5 && s.concepts.active; i++) if (!act({ type: 'openConcept', conceptId: s.concepts.active.id })) break
    if (s.finance.pendingPayday) act({ type: 'resolvePayday', choice: autoPaydayChoice(s) })
    if (s.decisions.active) act({ type: 'answerDecision', cardId: s.decisions.active.cardId, optionIndex: 0 })
    if (s.round?.active && s.round.pitchDue !== undefined && s.round.meeting) act({ type: 'roundPitch', pitch: MEETING_PITCHES[s.round.meeting][0] })
    for (const e of s.employees) if (e.status === 'leaving') act({ type: 'respondResignation', employeeId: e.id, response: 'talk' })
    // The chip: its concrete move when it names one, else the step's own verb.
    const step = s.derived.nextStep
    const a = step ? stepAction(s, step) : null
    if (a && !(solo && a.type === 'hire') && act(a)) moves[a.type === 'founderAction' ? a.kind : a.type] = (moves[a.type === 'founderAction' ? a.kind : a.type] ?? 0) + 1
    if (step?.id === 'idea') act({ type: 'startProject', category: 'web' })
    if (step?.id === 'round' || s.derived.canStartRound) act({ type: 'startRound' })
    // Ekip now and then: the cheapest offer that is not red.
    if (!solo && s.time.day - lastLook >= HIRE_LOOK_DAYS) {
      lastLook = s.time.day
      const c = [...s.candidates].sort((x, y) => x.salary - y.salary)[0]
      const rw = s.derived.hireRunway
      if (c && (rw === null || (rw !== undefined && rw >= balance.HIRE_RUNWAY_MIN)) && act({ type: 'hire', candidateId: c.id, autoDesk: true })) hires++
    }
    const stage = s.stage
    s = api.step(s, 0.5)
    if (s.stage !== stage) stageDays[s.stage] = Math.floor(s.time.day)
    minCash = Math.min(minCash, s.stats.cash)
    for (const e of s.events) if (e.id > seen && e.kind === 'payrollMissed' && s.stage === 0) garageMissed++
    seen = s.events[s.events.length - 1]?.id ?? seen
    if (trace && Math.floor(s.time.day) % 15 === 0 && s.time.day % 1 < 0.5) {
      console.log(`  d${Math.floor(s.time.day)} st${s.stage} step ${step?.id}${(step as { move?: string } | undefined)?.move ? '/' + (step as { move?: string }).move : ''} cash ${Math.round(s.stats.cash)} rw ${s.finance.runway?.toFixed(1)} users ${Math.round(s.stats.users)} mrr ${Math.round(s.finance.mrr)} val ${Math.round(s.finance.valuation)} team ${s.employees.map((e) => e.dept[0]).join("")} mom ${(s.derived.momAvg ?? 0).toFixed(3)} mult ${s.derived.valuationMultiple?.toFixed(1)} churn ${s.stats.churn.toFixed(3)} ads ${s.finance.adBudget} mat ${s.projects.map((p) => p.maturity.toFixed(2)).join("/")} round ${s.round?.active ? s.round.weeksLeft : '-'}`)
    }
  }
  return { seed, stageDays, garageMissed, minCash, over: s.gameOver ? `${s.gameOver.kind}@${s.gameOver.day}` : null, hires, moves }
}

if (process.argv[1]?.endsWith('naive.ts')) {
  const runs: NaiveRun[] = []
  for (let seed = FROM; seed <= SEEDS; seed++) {
    const r = playNaive(seed, DAYS, SOLO, TRACE === seed)
    runs.push(r)
    console.log(`seed ${seed}: pre g${r.stageDays[1] ?? '—'} seed g${r.stageDays[2] ?? '—'} A g${r.stageDays[3] ?? '—'} · hires ${r.hires} · garage missed paydays ${r.garageMissed} · min cash ${Math.round(r.minCash)} · ${r.over ?? 'alive'} · moves ${JSON.stringify(r.moves)}`)
  }
  const pre = runs.map((r) => r.stageDays[1]).filter((d): d is number => d !== null).sort((a, b) => a - b)
  console.log(`Pre-seed median g${pre.length ? pre[Math.floor(pre.length / 2)] : '—'} (${pre.length}/${runs.length}) · garage missed paydays ${runs.reduce((a, r) => a + r.garageMissed, 0)} · game over before A ${runs.filter((r) => r.over).length}`)
}
