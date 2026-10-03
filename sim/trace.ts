// Day-by-day trace of one bot run for balance debugging. `npx tsx sim/trace.ts <bot> [seed] [everyDays] [maxDays]`
// GAMEPLAY V2 §15: besides the snapshot line it prints every decision-bearing event (loan, round, crisis, payday desk,
// card answers, policies, market, board) as it happens, the bad decisions playBot books (← lines, the same list the
// run report reads), and on a bankrupt / teamLost end those of the last DEATH_TRACE_DAYS — every good-bot death must
// show one (§16 Faz I iz kriteri).
import { CONTENT } from '../src/content/index'
import type { GameEventKind } from '../src/engine/index'
import { DEATH_TRACE_DAYS, playBot, type BotKind } from './bots'

const kind = (process.argv[2] ?? 'platform') as BotKind
const seed = Number(process.argv[3] ?? 1)
const every = Number(process.argv[4] ?? 30)
const maxDays = Number(process.argv[5] ?? 4500)

/** Events printed as they happen: the decisions and the tests the run went through (§15 olay taraması). */
const TRACED: ReadonlySet<GameEventKind> = new Set<GameEventKind>([
  'roundStarted', 'roundClosed', 'roundFailed', 'stageUp', 'crisisRevealed', 'crisis', 'paydayShort', 'paydayResolved',
  'paydayAutoResolved', 'payrollMissed', 'loanTaken', 'loanWarning', 'loanCalled', 'loanRepaid', 'eviction', 'policyAdopted',
  'segmentOpened', 'rivalAcquired', 'rivalPassed', 'boardHit', 'boardMissed', 'renewalDue', 'contractRenewed',
  'decisionAnswered', 'decisionDefaulted', 'gameOver',
])

let seenId = 0
let answered = 0
let badSeen = 0

const r = playBot(kind, seed, CONTENT, maxDays, (s, badDecisions) => {
  const f = s.finance
  const d = s.derived
  for (const e of s.events) {
    if (e.id <= seenId) continue
    seenId = e.id
    if (!TRACED.has(e.kind)) continue
    const ref = e.refId ? ` ${e.refId}` : ''
    const val = e.value !== undefined ? ` ${Math.round(e.value * 100) / 100}` : ''
    console.log(`  · d${Math.round(e.day)} ${e.kind}${ref}${val}`)
  }
  for (const b of badDecisions.slice(badSeen)) console.log(`  ← d${Math.round(b.day)} ${b.what}`)
  badSeen = badDecisions.length
  // History answers carry the option index (events only keep the last ~64): print any the ring buffer dropped.
  for (const h of s.decisions.history.slice(answered)) {
    if (!s.events.some((e) => e.day === h.day && e.refId === h.cardId)) console.log(`  · d${Math.round(h.day)} kart ${h.cardId} #${h.optionIndex}`)
  }
  answered = s.decisions.history.length
  const day = Math.round(s.time.day)
  if (day % every !== 0) return
  const ent = f.enterpriseCustomers.reduce((a, c) => a + c.mrr, 0)
  console.log(
    `d${day} st${s.stage} cash ${Math.round(s.stats.cash)} users ${Math.round(s.stats.users)} team ${d.teamSize} ${JSON.stringify(d.deptCounts)}` +
      ` mrr ${Math.round(f.mrr)} burn ${Math.round(f.burn)} runway ${(f.runway ?? 99).toFixed(1)} val ${Math.round(f.valuation)} prog ${d.stageProgress.toFixed(2)}` +
      ` churn ${(s.stats.churn * 100).toFixed(1)}% cap ${Math.round(d.capacity)} mom ${d.momGrowth.toFixed(2)} mult ${d.valuationMultiple.toFixed(1)}` +
      ` ad ${f.adBudget} morale ${Math.round(s.stats.morale)} arpu ${s.stats.arpu.toFixed(1)} ent ${f.enterpriseCustomers.length}:${Math.round(ent)}` +
      ` debt ${Math.round(f.loan?.balance ?? 0)} deferred ${Math.round(f.deferred ?? 0)} moves ${s.founder.moves?.left ?? '-'}` +
      ` proj ${s.projects.map((p) => p.maturity.toFixed(2)).join(',')} round ${s.round?.active ? s.round.weeksLeft : '-'}`,
  )
})
const { gaps5: _g5, gapsAll: _ga, paydayRunway: _pr, crises: _cr, badDecisions: _bd, ...summary } = r
console.log(JSON.stringify(summary))
if (r.end === 'bankrupt' || r.end === 'teamLost') {
  const bad = r.badDecisions.filter((b) => b.day >= r.endDay - DEATH_TRACE_DAYS)
  console.log(`\nÖlüm d${r.endDay}: son ${DEATH_TRACE_DAYS} günde kötü karar ${bad.length}`)
  for (const b of bad) console.log(`  ← d${Math.round(b.day)} ${b.what}`)
  if (!bad.length) console.log('  (yok: denge değil bot politikası düzeltilir, GAMEPLAY V2 §15)')
}
