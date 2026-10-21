// Delegated hiring (2026-10-21, owner: "şirket büyüyünce onlarla ben uğraşmayayım. 300 milyon değerleme var, mühendis
// işe alıyorum"). Garage → Seed the player hires one by one. From Series A (STAFFING_FROM_STAGE) each department's
// lead hires toward the headcount target the player sets (setHireTarget): once a week, up to STAFF_BATCH_MAX a
// department, the best of STAFF_POOL candidates at its market salary, a desk bought by the team when none stands free,
// and only within the cash guard (no payday at risk, HIRE_RUNWAY_MIN months left after the hire). One notice a pass
// says who joined ("Ekip liderleri işe aldı: Geliştirme +2"). A target under today's headcount fires nobody.
import * as B from './balance'
import { seatFor } from './actions'
import { recomputeDerived } from './derive'
import { cashSafe, policyCost, previewSpend } from './loopSelectors'
import { hiresList, noticeText, pushNotice } from './notices'
import { hireCandidate, makeCandidate } from './people'
import type { Rng } from './rng'
import { DEPTS, type Dept, type GameState, type StaffingBlock, type StaffingView } from './types'
import { headcount, staffingOf, type EngineContent } from './util'
import * as E from './economy'

/** A department's market salary today (a mid-quality hire). */
export function marketSalary(s: GameState, dept: Dept): number {
  return Math.round(E.salary(B.BASE_SALARY[dept], s.stage))
}

/** The cash guard of one more hire at `salary` (desk included): the payday safe and HIRE_RUNWAY_MIN months after it. */
function hireFitsCash(s: GameState, salary: number, deskCost: number): boolean {
  const burn = policyCost(s, 'salary', salary)
  if (!cashSafe(s, deskCost, burn)) return false
  const after = previewSpend(s, { cashDelta: -deskCost, burnDelta: burn }).runwayAfter
  return after === null || after >= B.HIRE_RUNWAY_MIN
}

/** What holds a department's next hire now (null: nothing, or at target). Reads derived.hireDeskCost. */
function blockOf(s: GameState, dept: Dept, count: number, target: number): StaffingBlock {
  if (target <= count) return null
  const desk = s.derived.hireDeskCost
  if (desk === null || desk === undefined) return 'desk'
  return hireFitsCash(s, marketSalary(s, dept), desk) ? null : 'cash'
}

/** Derived view from Series A (no state written: an older save's missing targets read as today's headcount). */
export function staffingView(s: GameState): StaffingView | undefined {
  if (s.stage < B.STAFFING_FROM_STAGE) return undefined
  const now = headcount(s)
  const depts = {} as StaffingView['depts']
  for (const d of DEPTS) {
    const target = s.staffing?.targets[d] ?? now[d]
    depts[d] = { count: now[d], target, blocked: blockOf(s, d, now[d], target) }
  }
  const day = Math.floor(s.time.day)
  return { depts, nextDay: day + (B.STAFF_PASS_DAYS - (day % B.STAFF_PASS_DAYS)) }
}

/** One seat in `dept`: the best of a small pool, if the cash guard and a desk allow. */
function hireOne(s: GameState, content: EngineContent, rng: Rng, dept: Dept): boolean {
  recomputeDerived(s, content)
  const desk = s.derived.hireDeskCost
  if (desk === null || desk === undefined) return false
  const pool = Array.from({ length: B.STAFF_POOL }, () => makeCandidate(s, content, rng, dept))
  const best = pool.sort((a, b) => b.quality - a.quality)[0]!
  if (!hireFitsCash(s, best.salary, desk)) return false
  const seat = seatFor(s, content, dept, true)
  if (typeof seat === 'string') return false
  hireCandidate(s, best, seat.id)
  return true
}

/** Daily (tick.ts): on pass days, the leads fill the gaps toward the targets, the widest gap first, a seat at a time. */
export function dailyStaffing(s: GameState, content: EngineContent, rng: Rng, day: number): void {
  if (s.stage < B.STAFFING_FROM_STAGE || s.gameOver || day % B.STAFF_PASS_DAYS !== 0) return
  const st = staffingOf(s)
  const hires: Partial<Record<Dept, number>> = {}
  let total = 0
  for (let pass = 0; pass < B.STAFF_BATCH_MAX; pass++) {
    const now = headcount(s)
    const gap = (d: Dept) => (st.targets[d] ?? now[d]) - now[d]
    const open = DEPTS.filter((d) => gap(d) > 0).sort((a, b) => gap(b) - gap(a))
    let any = false
    for (const d of open) {
      if (!hireOne(s, content, rng, d)) continue
      hires[d] = (hires[d] ?? 0) + 1
      total++
      any = true
    }
    if (!any) break
  }
  if (total === 0) return
  recomputeDerived(s, content)
  pushNotice(s, { kind: 'teamHired', tone: 'good', hires, text: noticeText('teamHired', { list: hiresList(hires) }) })
}
