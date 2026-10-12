// Effort-load probe (E0, measurement only): per builder load = demand / max(0.5, supply) clamped [0, 2], read from bot runs
// without changing state. demand = PROJECT_SIZE × DEMAND_PER_SIZE × (1 + DEMAND_STAGE_GROWTH × stage), × 0.6 once finished;
// supply = non-founder builders on the project (working 1, onboarding 0.5) + 0.5 if the founder works on it (derive.ts founderProject).
// `npx tsx sim/effortProbe.ts [kind ...] [--seeds 24] [--days 4500]`; default kinds vcRocket bootstrap careless.
import { CONTENT } from '../src/content/index'
import * as B from '../src/engine/balance'
import { playBot, type BotKind } from './bots'

const DEMAND_PER_SIZE = 0.3
const DEMAND_STAGE_GROWTH = 0.25
const FINISHED_FACTOR = 0.6
const args = process.argv.slice(2)
const opt = (name: string, def: number) => { const i = args.indexOf(name); return i >= 0 ? Number(args[i + 1]) : def }
const seeds = opt('--seeds', 24)
const days = opt('--days', 4500)
const skip = new Set<number>()
args.forEach((a, i) => { if (a.startsWith('--')) { skip.add(i); skip.add(i + 1) } })
const kinds = (args.filter((_, i) => !skip.has(i)) as BotKind[])
if (!kinds.length) kinds.push('vcRocket', 'bootstrap', 'careless')

const q = (a: number[], f: number) => { if (!a.length) return '-'; const b = [...a].sort((x, y) => x - y); return b[Math.floor(f * (b.length - 1))]!.toFixed(2) }
const share = (a: number[], test: (x: number) => boolean) => (a.length ? (a.filter(test).length / a.length).toFixed(2) : '-')

for (const kind of kinds) {
  const act: Record<number, number[]> = {}
  const fin: Record<number, number[]> = {}
  const reached: number[] = []
  for (let seed = 1; seed <= seeds; seed++) {
    let last = -1
    const r = playBot(kind, seed, CONTENT, days, (s) => {
      const d = Math.floor(s.time.day)
      if (d === last) return
      last = d
      const active = s.projects.filter((p) => p.maturity < 1)
      const fp = s.founder.currentAction ? undefined : (active[0] ?? s.projects[0])
      for (const p of s.projects) {
        let sup = 0
        let n = 0
        for (const id of p.assignedIds) {
          const e = s.employees.find((x) => x.id === id)
          if (!e) continue
          n++
          sup += e.status === 'onboarding' ? 0.5 : 1
        }
        if (p === fp) sup += 0.5
        if (!n && p !== fp) continue
        const done = p.maturity >= 1
        const dem = B.PROJECT_SIZE[p.category] * DEMAND_PER_SIZE * (1 + DEMAND_STAGE_GROWTH * s.stage) * (done ? FINISHED_FACTOR : 1)
        const load = Math.max(0, Math.min(2, dem / Math.max(0.5, sup)))
        ;((done ? fin : act)[s.stage] ??= []).push(load)
      }
    })
    reached.push(r.stageDays.filter((x) => x !== null).length - 1)
  }
  const hist = reached.reduce<Record<number, number>>((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {})
  console.log(`\n${kind}  (${seeds} seeds x ${days} days)  stage reached (count of seeds): ${JSON.stringify(hist)}`)
  console.log('stage | active n p10 p50 p90 <0.7 >1.5 | finished n p10 p50 p90 <0.7 >1.5')
  for (const st of [...new Set([...Object.keys(act), ...Object.keys(fin)])].map(Number).sort((a, b) => a - b)) {
    const a = act[st] ?? []
    const f = fin[st] ?? []
    console.log(
      `${st} | ${a.length} ${q(a, 0.1)} ${q(a, 0.5)} ${q(a, 0.9)} ${share(a, (x) => x < 0.7)} ${share(a, (x) => x > 1.5)}` +
        ` | ${f.length} ${q(f, 0.1)} ${q(f, 0.5)} ${q(f, 0.9)} ${share(f, (x) => x < 0.7)} ${share(f, (x) => x > 1.5)}`,
    )
  }
}
