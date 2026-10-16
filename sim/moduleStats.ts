// B2 module pick concentration: how often each module sits on a finished project. Pure (no engine run), so the report and
// sim/__tests__/moduleDiversity.test.ts share it.
import { MODULES } from '../src/engine/modules'

/** The part of a BotRun this reads: each launched project at run end, its modules in install order. */
export interface ModuleRunLike {
  projectsEnd: readonly { category: string; ids: readonly string[] }[]
}

export interface CategoryConcentration {
  category: string
  /** Projects of this category over all runs. */
  projects: number
  /** Share of those projects holding each module at run end (only modules seen at least once). */
  share: Record<string, number>
  /** Modules on more than CONCENTRATION_MAX of the category's projects. */
  over: string[]
  /** Distinct first-three picks (install order, sorted inside) over the category's projects. */
  firstThreeSets: number
}

export interface ModuleConcentration {
  categories: CategoryConcentration[]
  /** Modules on at least one project, of MODULES.length. */
  used: number
  unused: string[]
  /** Share of runs that hold each module on any project (information only: each archetype's categories are fixed). */
  perRun: Record<string, number>
}

/** The B2 bar: no module on more than this share of a category's projects. */
export const CONCENTRATION_MAX = 0.8
/** The B2 bar: at least this many modules used somewhere. */
export const MODULES_USED_MIN = 40

export function moduleConcentration(runs: readonly ModuleRunLike[]): ModuleConcentration {
  const byCat = new Map<string, (readonly string[])[]>()
  const perRunCount = new Map<string, number>()
  const used = new Set<string>()
  for (const r of runs) {
    const inRun = new Set<string>()
    for (const p of r.projectsEnd) {
      byCat.set(p.category, [...(byCat.get(p.category) ?? []), p.ids])
      for (const id of p.ids) {
        inRun.add(id)
        used.add(id)
      }
    }
    for (const id of inRun) perRunCount.set(id, (perRunCount.get(id) ?? 0) + 1)
  }
  const categories = [...byCat].map(([category, projs]): CategoryConcentration => {
    const count = new Map<string, number>()
    for (const ids of projs) for (const id of new Set(ids)) count.set(id, (count.get(id) ?? 0) + 1)
    const share = Object.fromEntries([...count].sort((a, b) => b[1] - a[1]).map(([id, n]) => [id, n / projs.length]))
    const over = Object.entries(share).filter(([, v]) => v > CONCENTRATION_MAX).map(([id]) => id)
    const firstThreeSets = new Set(projs.filter((ids) => ids.length >= 3).map((ids) => [...ids.slice(0, 3)].sort().join(','))).size
    return { category, projects: projs.length, share, over, firstThreeSets }
  })
  const perRun = Object.fromEntries([...perRunCount].map(([id, n]) => [id, runs.length ? n / runs.length : 0]))
  return { categories, used: used.size, unused: MODULES.filter((d) => !used.has(d.id)).map((d) => d.id), perRun }
}

/** The part of a single-category BotRun the plan measure reads: its category, the plan's builds by id, and every build. */
export interface PlanRunLike {
  category: string
  planIds: Readonly<Record<string, number>>
  fillBuilt: number
  built: number
}

export interface CategoryPlanConcentration {
  category: string
  runs: number
  /** Builds the plan chose (by the card's estimate), of all builds; the rest came from the slot filler's weighted draw. */
  planShare: number
  /** Runs with at least one plan build. */
  planRuns: number
  /** Share of those runs whose plan built each module, highest first. */
  share: Record<string, number>
  over: string[]
}

/**
 * B2 review: the concentration a player who picks by the card's number would face. The project measure above mixes
 * the plan's picks with the filler's seeded draw (~80% of builds), so it cannot tell whether picking by the estimate
 * still converges on one set; this one counts only the plan's picks. Single-category runs: one category per run.
 */
export function planConcentration(runs: readonly PlanRunLike[]): CategoryPlanConcentration[] {
  const byCat = new Map<string, PlanRunLike[]>()
  for (const r of runs) byCat.set(r.category, [...(byCat.get(r.category) ?? []), r])
  return [...byCat].map(([category, rs]) => {
    const built = rs.reduce((a, r) => a + r.built, 0)
    const fill = rs.reduce((a, r) => a + r.fillBuilt, 0)
    const withPlan = rs.filter((r) => Object.keys(r.planIds).length > 0)
    const count = new Map<string, number>()
    for (const r of withPlan) for (const id of Object.keys(r.planIds)) count.set(id, (count.get(id) ?? 0) + 1)
    const share = Object.fromEntries([...count].sort((a, b) => b[1] - a[1]).map(([id, n]) => [id, n / withPlan.length]))
    const over = Object.entries(share).filter(([, v]) => v > CONCENTRATION_MAX).map(([id]) => id)
    return { category, runs: rs.length, planShare: built ? (built - fill) / built : 0, planRuns: withPlan.length, share, over }
  })
}
