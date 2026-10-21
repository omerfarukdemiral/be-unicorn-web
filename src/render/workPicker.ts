// Work floats (round "Clarity & pace" P5): who did what, and what it gave. Now and then one person shows a small
// dept icon + their name + the effect of the team's recent work over their head ("Ayşe +%3 proje", "Can +$12K gelir").
// Pure picker here, drawn by WorkFloats.tsx. The effect is accrued from the engine's own daily rates in game days
// (so 1× / 2× / 4× and the slower 1× all stay honest); the floats are paced in real seconds by the scene.
//   eng / product: the project's maturity (or the next update / module build after 1.0), shown on one of its builders;
//   marketing: organic users (derived.channels.organic);
//   sales: the part of the MRR the sales team's ARPU lift brings (ARPU × (1 + min(MAX, sales × PER)));
//   ops: users kept, i.e. the churn the ops team takes off (CHURN_OPS_PER, capped at CHURN_OPS_MAX).
// Tiny amounts never show: each kind waits until its pile is worth a line.
import * as B from '../engine/balance'
import { founderProject, isBuilder } from '../engine/effort'
import { moduleDef, moduleWork, updateSize } from '../engine/modules'
import { DAYS_PER_MONTH, type Dept, type GameState, type Project } from '../engine/types'
import { formatCompact } from '../content/format'

export type WorkKind = 'project' | 'version' | 'module' | 'users' | 'cash' | 'kept'

export interface WorkPick {
  personId: string
  dept: Dept
  kind: WorkKind
  /** The effect line, without the person's name: "+%3 proje", "+$12K gelir", "+40 kullanıcı", "18 kullanıcı tuttu". */
  text: string
}

/** A gap longer than this (days) is a loaded save or a snapshot, not time worked: the piles restart. */
const MAX_GAP_DAYS = 20
/** Project work shows from this many percent points (maturity) or percent of the next update / module. */
export const MIN_PROJECT_PCT = 1
export const MIN_STEP_PCT = 5
/** Users / kept users show from max(MIN_USERS, users × MIN_USERS_SHARE); money from max(MIN_CASH, MRR × MIN_CASH_SHARE). */
export const MIN_USERS = 2
export const MIN_USERS_SHARE = 0.001
export const MIN_CASH = 100
export const MIN_CASH_SHARE = 0.01

type Lane = 'build' | 'sales' | 'marketing' | 'ops'
const LANES: readonly Lane[] = ['build', 'sales', 'marketing', 'ops']
const LANE_DEPT: Record<Exclude<Lane, 'build'>, Dept> = { sales: 'sales', marketing: 'marketing', ops: 'ops' }

/** The founder's speaker id (sceneRegistry). */
export const FOUNDER = 'founder'

const pct = (x: number) => `+%${Math.round(x)}`

export class WorkFloatPicker {
  private lastDay: number | null = null
  private project = new Map<string, number>()
  private users = 0
  private cash = 0
  private kept = 0
  private lane = 0
  private projectTurn = 0
  private people = new Map<string, number>()

  /** Adds the work done since the last call (game days × the engine's rates). */
  accrue(s: GameState): void {
    const day = s.time.day
    const last = this.lastDay
    this.lastDay = day
    if (last === null || day < last || day - last > MAX_GAP_DAYS) {
      this.project.clear()
      this.users = this.cash = this.kept = 0
      return
    }
    const dd = day - last
    if (dd <= 0) return
    const d = s.derived
    for (const [id, r] of Object.entries(d.maturityPerDay ?? {})) if (r > 0) this.project.set(id, (this.project.get(id) ?? 0) + r * dd)
    const perDay = dd / DAYS_PER_MONTH
    this.users += Math.max(0, d.channels?.organic ?? 0) * perDay
    const sales = d.deptOutput?.sales ?? 0
    const lift = Math.min(B.ARPU_SALES_MAX, sales * B.ARPU_SALES_PER)
    this.cash += Math.max(0, s.finance.mrr) * (lift / (1 + lift)) * perDay
    const off = Math.min(B.CHURN_OPS_MAX, (d.deptOutput?.ops ?? 0) * B.CHURN_OPS_PER)
    const churn = Math.max(0, s.stats.churn ?? 0)
    if (off > 0 && off < 1) this.kept += Math.max(0, s.stats.users) * (churn / (1 - off) - churn) * perDay
  }

  /**
   * The next float, or null when nothing is worth a line. Lanes take turns (build, sales, marketing, ops), people take
   * turns inside a lane; `canShow` says who can carry a float now (seated, on screen). A shown pile starts again.
   */
  pick(s: GameState, canShow: (personId: string) => boolean): WorkPick | null {
    for (let i = 0; i < LANES.length; i++) {
      const lane = LANES[(this.lane + i) % LANES.length]!
      const got = lane === 'build' ? this.pickBuild(s, canShow) : this.pickDept(s, lane, canShow)
      if (got) {
        this.lane = (this.lane + i + 1) % LANES.length
        return got
      }
    }
    return null
  }

  private person(key: string, ids: readonly string[], canShow: (id: string) => boolean): string | null {
    const ok = ids.filter(canShow)
    if (!ok.length) return null
    const n = this.people.get(key) ?? 0
    this.people.set(key, n + 1)
    return ok[n % ok.length]!
  }

  private pickBuild(s: GameState, canShow: (id: string) => boolean): WorkPick | null {
    const list = s.projects
    for (let i = 0; i < list.length; i++) {
      const p = list[(this.projectTurn + i) % list.length]!
      const gain = this.project.get(p.id) ?? 0
      const shown = projectLine(p, gain, s.time.day)
      if (!shown) continue
      const builders = p.assignedIds.filter((id) => {
        const e = s.employees.find((x) => x.id === id)
        return !!e && isBuilder(e) && e.status !== 'onboarding'
      })
      // The idle founder builds too (the garage's main builder): theirs when no builder can carry it.
      const who = this.person(`p:${p.id}`, builders, canShow) ?? (founderProject(s)?.id === p.id && canShow(FOUNDER) ? FOUNDER : null)
      if (!who) continue
      const dept = s.employees.find((x) => x.id === who)?.dept ?? 'product'
      this.project.set(p.id, 0)
      this.projectTurn = (this.projectTurn + i + 1) % list.length
      return { personId: who, dept, kind: shown.kind, text: shown.text }
    }
    return null
  }

  private pickDept(s: GameState, lane: Exclude<Lane, 'build'>, canShow: (id: string) => boolean): WorkPick | null {
    const dept = LANE_DEPT[lane]
    const users = Math.max(0, s.stats.users)
    let kind: WorkKind
    let text: string
    if (lane === 'marketing') {
      if (this.users < Math.max(MIN_USERS, users * MIN_USERS_SHARE)) return null
      kind = 'users'
      text = `+${formatCompact(Math.round(this.users))} kullanıcı`
    } else if (lane === 'ops') {
      if (this.kept < Math.max(MIN_USERS, users * MIN_USERS_SHARE)) return null
      kind = 'kept'
      text = `${formatCompact(Math.round(this.kept))} kullanıcı tuttu`
    } else {
      if (this.cash < Math.max(MIN_CASH, s.finance.mrr * MIN_CASH_SHARE)) return null
      kind = 'cash'
      text = `+$${formatCompact(Math.round(this.cash))} gelir`
    }
    const ids = s.employees.filter((e) => e.dept === dept && e.status !== 'onboarding' && !!e.deskSlotId).map((e) => e.id)
    const who = this.person(`d:${dept}`, ids, canShow)
    if (!who) return null
    if (lane === 'marketing') this.users = 0
    else if (lane === 'ops') this.kept = 0
    else this.cash = 0
    return { personId: who, dept, kind, text }
  }
}

/** What a project's piled-up work reads as, or null while it is too small. */
export function projectLine(p: Project, gain: number, day: number): { kind: WorkKind; text: string } | null {
  if (gain <= 0) return null
  if (p.maturity < 1) {
    const v = gain * 100
    return v >= MIN_PROJECT_PCT ? { kind: 'project', text: `${pct(v)} proje` } : null
  }
  if (p.build) {
    const def = moduleDef(p.build.id)
    const work = def ? moduleWork(p, def, !!p.build.refresh) : 0
    const v = work > 0 ? (gain / work) * 100 : 0
    return v >= MIN_STEP_PCT ? { kind: 'module', text: `${pct(Math.min(100, v))} modül` } : null
  }
  const size = updateSize(p, day)
  const v = size > 0 ? (gain / size) * 100 : 0
  return v >= MIN_STEP_PCT ? { kind: 'version', text: `${pct(Math.min(100, v))} sürüm` } : null
}
