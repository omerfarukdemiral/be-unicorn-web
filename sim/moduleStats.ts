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
