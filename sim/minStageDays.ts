import { CONTENT } from '../src/content/index'
import { ARCHETYPES } from '../src/engine/index'
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
console.log(n, 'runs'); console.log('min day per stage', mins); console.log('min in-stage', inStage)
