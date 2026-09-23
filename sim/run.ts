// Balance simulator (PLAN §8.3): 4 archetype bots on the real engine + content. `npm run sim [runsPerBot]`
import { CONTENT } from '../src/content/index'
import { ARCHETYPES, SECONDS_PER_DAY } from '../src/engine/index'
import { BOTS, playBot, type BotRun } from './bots'

const runs = Math.max(1, Number(process.argv[2] ?? 8))
const STAGE_NAMES = ['Garaj', 'Pre-seed', 'Seed', 'A', 'B', 'C', 'Unicorn']
const minutes = (days: number): string => ((days * SECONDS_PER_DAY) / 60).toFixed(1)

function median(xs: number[]): number | null {
  if (!xs.length) return null
  const a = [...xs].sort((x, y) => x - y)
  return a[Math.floor(a.length / 2)]!
}

console.log(`Be Unicorn sim — ${runs} runs/bot, 1 day = ${SECONDS_PER_DAY}s @1x\n`)
const all: BotRun[] = []
for (const arch of ARCHETYPES) {
  const results: BotRun[] = []
  for (let seed = 1; seed <= runs; seed++) results.push(playBot(BOTS[arch], seed, CONTENT))
  all.push(...results)
  const reach = STAGE_NAMES.map((name, i) => {
    const days = results.map((r) => r.stageDays[i]).filter((d): d is number => d !== null && d !== undefined)
    const m = median(days)
    return `${name}:${m === null ? '—' : `${minutes(m)}m`}(${days.length}/${runs})`
  })
  const ends = results.reduce<Record<string, number>>((acc, r) => ((acc[r.end] = (acc[r.end] ?? 0) + 1), acc), {})
  const c5 = median(results.map((r) => r.conceptsBy5Min))
  const c10 = median(results.map((r) => r.conceptsBy10Min))
  console.log(`${arch.padEnd(9)} ${reach.join('  ')}`)
  console.log(`${''.padEnd(9)} end ${JSON.stringify(ends)}  concepts@5m ${c5}  @10m ${c10}  equity~${(median(results.map((r) => r.equity))! * 100).toFixed(0)}%\n`)
}
const bankrupt = all.filter((r) => r.end === 'bankrupt' || r.end === 'teamLost').length
console.log(`bankrupt rate ${((bankrupt / all.length) * 100).toFixed(0)}%  (${bankrupt}/${all.length})`)
