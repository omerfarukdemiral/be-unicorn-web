// Day-by-day trace of one bot run for balance debugging. `npx tsx sim/trace.ts <bot> [seed] [everyDays] [maxDays]`
import { CONTENT } from '../src/content/index'
import { playBot, type BotKind } from './bots'

const kind = (process.argv[2] ?? 'platform') as BotKind
const seed = Number(process.argv[3] ?? 1)
const every = Number(process.argv[4] ?? 30)
const maxDays = Number(process.argv[5] ?? 4500)

const r = playBot(kind, seed, CONTENT, maxDays, (s) => {
  const day = Math.round(s.time.day)
  if (day % every !== 0) return
  const f = s.finance
  const d = s.derived
  const ent = f.enterpriseCustomers.reduce((a, c) => a + c.mrr, 0)
  console.log(
    `d${day} st${s.stage} cash ${Math.round(s.stats.cash)} users ${Math.round(s.stats.users)} team ${d.teamSize} ${JSON.stringify(d.deptCounts)}` +
      ` mrr ${Math.round(f.mrr)} burn ${Math.round(f.burn)} val ${Math.round(f.valuation)} prog ${d.stageProgress.toFixed(2)}` +
      ` churn ${(s.stats.churn * 100).toFixed(1)}% cap ${Math.round(d.capacity)} mom ${d.momGrowth.toFixed(2)} mult ${d.valuationMultiple.toFixed(1)}` +
      ` ad ${f.adBudget} morale ${Math.round(s.stats.morale)} arpu ${s.stats.arpu.toFixed(1)} ent ${f.enterpriseCustomers.length}:${Math.round(ent)}` +
      ` proj ${s.projects.map((p) => p.maturity.toFixed(2)).join(',')} round ${s.round?.active ? s.round.weeksLeft : '-'}`,
  )
})
console.log(r)
