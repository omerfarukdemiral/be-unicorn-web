// Default project names (fix round F8): a project started without a typed name takes a readable one from the content
// list (content/names.ts › PROJECT_NAMES), never a "marketplace-1" slug. Deterministic per run: the seed picks where in
// the list the run starts, the project count walks it. No rng draw, so a bot run's numbers do not move.
import { PROJECT_NAMES } from '../content/names'
import { nameKey } from './names'
import { PROJECT_CATEGORIES, type GameState } from './types'

/** Coprime with the list length (30): neighbours in the list ("Poyraz", "Lodos Pay") do not come in a row. */
const STEP = 7

/** The seed's starting index in the list (an integer hash: seeds 1, 2, 3 land far apart). */
function offsetOf(seed: number): number {
  let h = (seed ^ 0x9e3779b9) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0
  h = (h ^ (h >>> 16)) >>> 0
  return h % PROJECT_NAMES.length
}

/** The `n`th (1-based) project's default name in a run of `seed`, unique against `used` (case / Turkish i folded). */
export function defaultProjectName(seed: number, n: number, used: readonly string[]): string {
  const taken = new Set(used.map(nameKey))
  const len = PROJECT_NAMES.length
  const start = offsetOf(seed) + (n - 1) * STEP
  for (let i = 0; i < len; i++) {
    const name = PROJECT_NAMES[(start + i * STEP) % len]!
    if (!taken.has(nameKey(name))) return name
  }
  // Every name taken (30+ projects): the run's first pick with a number.
  const base = PROJECT_NAMES[start % len]!
  for (let k = 2; ; k++) if (!taken.has(nameKey(`${base} ${k}`))) return `${base} ${k}`
}

/** The next project's default name in this state. */
export function nextProjectName(s: Pick<GameState, 'rng' | 'counters' | 'projects'>): string {
  return defaultProjectName(s.rng.seed, (s.counters.projectsStarted ?? s.projects.length) + 1, s.projects.map((p) => p.name))
}

const SLUG = new RegExp(`^(${PROJECT_CATEGORIES.join('|')})-\\d+$`)

/** An unnamed project's old engine name ("marketplace-1", "api-2"). */
export function isSlugName(name: string): boolean {
  return SLUG.test(name)
}

/**
 * Old saves: slug-named projects get their readable name, and the release log and activity feed follow (a release
 * toast or a feed row must not still say "api-2"). Returns how many projects were renamed.
 */
export function renameSlugProjects(s: Pick<GameState, 'rng' | 'projects'> & Partial<Pick<GameState, 'releases' | 'activity'>>): number {
  const renamed = new Map<string, string>()
  s.projects.forEach((p, i) => {
    if (typeof p.name !== 'string' || !isSlugName(p.name)) return
    const name = defaultProjectName(s.rng.seed, i + 1, s.projects.map((x) => x.name))
    renamed.set(p.name, name)
    p.name = name
  })
  if (!renamed.size) return 0
  for (const r of s.releases ?? []) {
    const name = renamed.get(r.projectName)
    if (name) r.projectName = name
  }
  for (const a of s.activity ?? []) {
    if (!a.params) continue
    for (const [k, v] of Object.entries(a.params)) {
      const name = typeof v === 'string' ? renamed.get(v) : undefined
      if (name) a.params[k] = name
    }
  }
  return renamed.size
}
