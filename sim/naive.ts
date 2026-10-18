// Guided naive player (fix round 3, NEW-1/NEW-2): a new player who only does what the game points at.
// - follows the next-step chip (state.derived.nextStep, and its concrete move when there is one: stepAction),
// - sets the "users" focus once at the start (the tester's first click),
// - takes a hire offer now and then, but never a red one (runway after < HIRE_RUNWAY_MIN),
// - answers every bubble with its first option (cards, meetings, resignations), opens concept cards,
// - leaves the payday desk to its default.
// Usage: npx tsx sim/naive.ts [--seeds 12] [--days 1200] [--trace <seed>] [--solo 1]
// Prints per seed: Pre-seed / Seed / A days, missed paydays in the garage, min cash, game over.
import { CONTENT } from '../src/content/index'
import { balance, CONFIRM_MOVES, createEngine, MEETING_PITCHES, moveKey, staffAttention, stepAction, type Action, type GameState } from '../src/engine/index'
import { autoPaydayChoice } from '../src/engine/loop'
import { Rng, createRngState } from '../src/engine/rng'
import { busiestOpen, hireIsRed } from '../src/engine/loopSelectors'
import { moduleAsk } from '../src/engine/modules'
import { firstFreeDesk } from '../src/engine/office'

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? Number(process.argv[i + 1]) : fallback
}
const SEEDS = arg('seeds', 12)
const FROM = arg('from', 1)
const DAYS = arg('days', 1200)
const TRACE = arg('trace', 0)
const TRACE_EVERY = arg('every', 15)
const TRACE_FROM = arg('tfrom', 0)
/** NEW-2: the founder who never hires. */
const SOLO = arg('solo', 0) === 1
/** Share of bubbles (cards, leavers) the player never answers (--miss 0.33). */
const MISS = Number(process.argv[process.argv.indexOf("--miss") + 1] ?? 0) * (process.argv.includes("--miss") ? 1 : 0) || 0.33
/** Chip verbs that spend (round 6: none while cash is negative). */
const SPEND: ReadonlySet<string> = new Set(['hire', 'openRing', 'buildModule', 'setAdBudget'])
/** Stop at this stage (3 = Series A; --until 4 runs on to Series B). */
const UNTIL = arg('until', 3)
/** --decline 1|2 (see the loop): declines big moves a big move (law, rival, product, segment, server room, section, hire, cut): snoozes it. */
const DECLINE = arg('decline', 0)
/** Days between two taps on an unchanged chip. */
const TAP_EVERY_DAYS = arg('tap', 30)
/** First product: the idea bubble's first option (Mobil); --web 1 for the earlier probes. */
const CATEGORY = arg('web', 0) === 1 ? 'web' : 'mobile'
/** --look 1: also opens Ekip now and then and takes the cheapest non-red offer (round 3's tester; the guided tester of round 5 only taps the chip). */
const LOOK = arg('look', 0) === 1
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

export function playNaive(seed: number, maxDays = DAYS, solo = SOLO, trace = false, until = UNTIL): NaiveRun {
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
  const missRng = new Rng(createRngState(seed * 104729 + 7))
  const decided = new Set<string>()
  const seenLeavers = new Set<string>()
  const declined = new Set<string>()
  let lastChip = ''
  let lastTap = -Infinity
  act({ type: 'setFounderFocus', focus: 'users' })
  while (!s.gameOver && s.time.day < maxDays && s.stage < until) {
    // Bubbles: concept cards, the decision card, a meeting, a leaver: the first option each.
    for (let i = 0; i < 5 && s.concepts.active; i++) if (!act({ type: 'openConcept', conceptId: s.concepts.active.id })) break
    if (s.finance.pendingPayday) act({ type: 'resolvePayday', choice: autoPaydayChoice(s) })
    // The playtests left about a third of the bubbles unanswered (closed, or the pill gone before the tap): those cards
    // run out to their default and those leavers walk. One draw per bubble.
    const card = s.decisions.active
    if (card && !decided.has(card.cardId + card.shownDay)) {
      decided.add(card.cardId + card.shownDay)
      if (!(missRng.next() < MISS)) act({ type: 'answerDecision', cardId: card.cardId, optionIndex: 0 })
    }
    if (s.round?.active && s.round.pitchDue !== undefined && s.round.meeting) act({ type: 'roundPitch', pitch: MEETING_PITCHES[s.round.meeting][0] })
    // The leaver bubble's first row is "Zam yap" (the playtest's tap every time), the tired / burnt-out one's "Yavaşlat".
    for (const e of s.employees) {
      if (e.status !== 'leaving' || seenLeavers.has(e.id + ':' + e.leaveDay)) continue
      seenLeavers.add(e.id + ':' + e.leaveDay)
      if (missRng.next() < MISS) continue
      // StaffBubble rows: a bored leaver sees the busiest projects first, everyone else "Zam yap".
      const p = e.leaveCause === 'bored' ? busiestOpen(s, e.projectId) : undefined
      act(p ? { type: 'assign', employeeId: e.id, projectId: p.id } : { type: 'respondResignation', employeeId: e.id, response: 'raise' })
    }
    for (const [id, need] of staffAttention(s)) if ((need === 'tired' || need === 'burnout') && s.employees.find((e) => e.id === id)?.pace !== 'calm') act({ type: 'setPace', employeeId: id, pace: 'calm' })
    // Desk bubbles (render/WorldBubbles deskTopics): a free desk and a non-red offer asks "N aday bekliyor" (first
    // non-red row: hired); a finished product with room asks for its module (first row: "Ekle").
    if (!solo && firstFreeDesk(s.office) !== undefined) {
      const c = s.candidates.find((x) => !hireIsRed(s, x.salary))
      if (c && act({ type: 'hire', candidateId: c.id })) hires++
    }
    const ask = moduleAsk(s)
    if (ask) act(ask.stale ? { type: 'refreshModule', projectId: ask.projectId, moduleId: ask.moduleId } : { type: 'buildModule', projectId: ask.projectId, moduleId: ask.moduleId })
    // The chip: its concrete move when it names one, else the step's own verb.
    const step = s.derived.nextStep
    // The tester taps the chip when its line changes, else about once a month (one look per ~8 loop turns).
    const chipKey = `${step?.id}/${step?.move ?? ''}`
    const tap = chipKey !== lastChip || s.time.day - lastTap >= TAP_EVERY_DAYS
    // --decline: the player opens a big move's place and leaves without confirming (the UI reports snoozeMove).
    // 1 = every item the first time it is offered (it is taken when it comes back); 2 = never the non-hire ones
    // (law, rival, product, segment, server room, section), hires and cuts as offered.
    const big = step?.move !== undefined && CONFIRM_MOVES.has(step.move)
    const key = big ? moveKey(s, step!.move!) : ''
    const declines =
      big && ((DECLINE === 1 && !declined.has(key)) || (DECLINE === 2 && !['hireEng', 'hireMarketing', 'hireGrowth', 'cutBurn'].includes(step!.move!)))
    if (declines && tap) declined.add(key)
    const a = step && tap ? (declines ? ({ type: 'snoozeMove', move: step.move! } as Action) : stepAction(s, step)) : null
    if (tap) {
      lastChip = chipKey
      lastTap = s.time.day
    }
    if (a && SPEND.has(a.type) && s.stats.cash < 0) moves.spendWhileNegative = (moves.spendWhileNegative ?? 0) + 1
    if (a && !(solo && a.type === 'hire') && act(a)) moves[a.type === 'founderAction' ? a.kind : a.type] = (moves[a.type === 'founderAction' ? a.kind : a.type] ?? 0) + 1
    // The idea bubble lists Mobil first.
    if (step?.id === 'idea') act({ type: 'startProject', category: CATEGORY })
    // The round bubble lists Küçük first: the first option is the small round.
    if (step?.id === 'round' || s.derived.canStartRound) act({ type: 'startRound', size: 'small' })
    // Ekip now and then: the cheapest offer that is not red.
    if (!solo && LOOK && s.time.day - lastLook >= HIRE_LOOK_DAYS) {
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
    for (const e of s.events) if (e.id > seen && e.kind === 'payrollMissed') moves.payrollMissed = (moves.payrollMissed ?? 0) + 1
    if (s.stage >= 1 && !s.derived.nextStep?.move) moves.noChipDays = (moves.noChipDays ?? 0) + 0.5
    if (s.stage === 5 && s.derived.nextStep?.move) moves[`C:${s.derived.nextStep.move}`] = (moves[`C:${s.derived.nextStep.move}`] ?? 0) + 0.5
    for (const e of s.events) if (e.id > seen && e.kind === 'resigned' && s.stage < 3) moves.resigned = (moves.resigned ?? 0) + 1
    for (const e of s.employees) if (e.status === 'leaving' && e.leaveCause) moves[`leave:${e.leaveCause}`] = (moves[`leave:${e.leaveCause}`] ?? 0) + 0.5
    seen = s.events[s.events.length - 1]?.id ?? seen
    if (trace && Math.floor(s.time.day) % TRACE_EVERY === 0 && s.time.day % 1 < 0.5 && s.time.day >= TRACE_FROM) {
      console.log(`  d${Math.floor(s.time.day)} st${s.stage} step ${step?.id}${(step as { move?: string } | undefined)?.move ? '/' + (step as { move?: string }).move : ''} cash ${Math.round(s.stats.cash)} rw ${s.finance.runway?.toFixed(1)} users ${Math.round(s.stats.users)} mrr ${Math.round(s.finance.mrr)} val ${Math.round(s.finance.valuation)} team ${s.employees.map((e) => e.dept[0]).join("")} morale ${Math.round(s.stats.morale)} mom ${(s.derived.momAvg ?? 0).toFixed(3)} mult ${s.derived.valuationMultiple?.toFixed(1)} churn ${s.stats.churn.toFixed(3)} pen ${(s.derived.penetration ?? 0).toFixed(2)} tam ${Math.round(s.derived.tam ?? 0)} ltv ${s.derived.ltvCac?.toFixed(1)} proj ${s.projects.length} mods ${s.projects.map((p) => (p.modules ?? []).length).join("/")} seg ${(s.market?.segments ?? []).length} debt ${Math.round(s.techDebt)} ovl ${s.derived.overload.toFixed(2)} netK ${Math.round(s.finance.net / 1000)} ads ${s.finance.adBudget} mat ${s.projects.map((p) => p.maturity.toFixed(2)).join("/")} round ${s.round?.active ? s.round.weeksLeft : '-'}`)
    }
  }
  return { seed, stageDays, garageMissed, minCash, over: s.gameOver ? `${s.gameOver.kind}@${s.gameOver.day}` : null, hires, moves }
}

if (process.argv[1]?.endsWith('naive.ts')) {
  const runs: NaiveRun[] = []
  for (let seed = FROM; seed <= SEEDS; seed++) {
    const r = playNaive(seed, DAYS, SOLO, TRACE === seed)
    runs.push(r)
    console.log(`seed ${seed}: pre g${r.stageDays[1] ?? '—'} seed g${r.stageDays[2] ?? '—'} A g${r.stageDays[3] ?? '—'} B g${r.stageDays[4] ?? '—'} C g${r.stageDays[5] ?? '—'} U g${r.stageDays[6] ?? '—'} · hires ${r.hires} · garage missed paydays ${r.garageMissed} · min cash ${Math.round(r.minCash)} · ${r.over ?? 'alive'} · moves ${JSON.stringify(r.moves)}`)
  }
  const pre = runs.map((r) => r.stageDays[1]).filter((d): d is number => d !== null).sort((a, b) => a - b)
  const seedD = runs.map((r) => r.stageDays[2]).filter((d): d is number => d !== null).sort((a, b) => a - b)
  const bD = runs.map((r) => r.stageDays[4]).filter((d): d is number => d !== null).sort((a, b) => a - b)
  if (UNTIL > 3) console.log(`Series B ${bD.length}/${runs.length} · median g${bD.length ? bD[Math.floor(bD.length / 2)] : '—'}`)
  console.log(`Seed median g${seedD.length ? seedD[Math.floor(seedD.length / 2)] : '—'} (${seedD.length}/${runs.length}) · Series A ${runs.filter((r) => r.stageDays[3] !== null).length}/${runs.length}`)
  console.log(`Pre-seed median g${pre.length ? pre[Math.floor(pre.length / 2)] : '—'} (${pre.length}/${runs.length}) · garage missed paydays ${runs.reduce((a, r) => a + r.garageMissed, 0)} · game over before A ${runs.filter((r) => r.over).length}`)
}
