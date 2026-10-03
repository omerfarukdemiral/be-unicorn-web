// Earliest believable day per stage for the leaderboard (DECISIONS #20): the fastest of 160 real-engine bot runs
// (4 archetypes × 2 decision policies × 20 seeds), turned into MIN_DAY_FOR_STAGE by src/net/stageRules.ts minDayTable
// (~65%). `npx tsx sim/minStageDays.ts`: prints the measurement, the table it implies and whether stageRules.ts matches.
import { CONTENT } from '../src/content/index'
import { ARCHETYPES } from '../src/engine/index'
import { MEASURED_FASTEST_DAYS, MIN_DAY_FOR_STAGE, minDayTable } from '../src/net/stageRules'
import { playBot, type DecisionPolicy } from './bots'
const mins: number[] = [0, Infinity, Infinity, Infinity, Infinity, Infinity, Infinity]
const inStage: number[] = [Infinity, Infinity, Infinity, Infinity, Infinity, Infinity]
let n = 0
for (const a of ARCHETYPES) for (const pol of ['best', 'first'] as DecisionPolicy[]) for (let seed = 1; seed <= 20; seed++) {
  const r = playBot(a, seed, CONTENT, 3000, undefined, pol)
  n++
  r.stageDays.forEach((d, i) => { if (d !== null && i > 0) mins[i] = Math.min(mins[i]!, d) })
  for (let i = 0; i < 6; i++) { const a0 = r.stageDays[i], b = r.stageDays[i + 1]; if (a0 != null && b != null) inStage[i] = Math.min(inStage[i]!, b - a0) }
}
const table = minDayTable(mins)
const same = (x: readonly number[], y: readonly number[]) => x.length === y.length && x.every((v, i) => v === y[i])
console.log(n, 'runs'); console.log('min day per stage', mins); console.log('min in-stage', inStage)
console.log('MIN_DAY_FOR_STAGE (ölçülen)', table)
console.log('stageRules.ts MEASURED_FASTEST_DAYS birebir:', same(mins, MEASURED_FASTEST_DAYS) ? 'EVET' : `HAYIR (${MEASURED_FASTEST_DAYS.join(' / ')})`)
console.log('stageRules.ts MIN_DAY_FOR_STAGE birebir:', same(table, MIN_DAY_FOR_STAGE) ? 'EVET' : `HAYIR (${MIN_DAY_FOR_STAGE.join(' / ')})`)
