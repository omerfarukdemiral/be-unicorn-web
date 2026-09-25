// New run: garage office, founder desk at the center, XP start-cash bonus (PLAN §5.10).
import * as B from './balance'
import { recomputeDerived } from './derive'
import { startCash } from './economy'
import { buildOffice } from './office'
import { fillCandidates } from './people'
import { Rng, createRngState } from './rng'
import { COMPANY_NAME_MAX, COMPANY_NAME_MIN, DEFAULT_COMPANY_NAME, DEPTS, INITIAL_WIDGETS, SAVE_VERSION, type Dept, type GameState, type NewGameOptions } from './types'
import { stageBaseline, type EngineContent } from './util'

function perDept(v: number): Record<Dept, number> {
  const o = {} as Record<Dept, number>
  for (const d of DEPTS) o[d] = v
  return o
}

/** Normalizes a company name: trims, collapses whitespace, caps the length; too short → the default. */
export function cleanCompanyName(raw: string | undefined): string {
  const v = Array.from((raw ?? '').replace(/\s+/g, ' ').trim()).slice(0, COMPANY_NAME_MAX).join('').trim()
  return Array.from(v).length >= COMPANY_NAME_MIN ? v : DEFAULT_COMPANY_NAME
}

export function createGame(opts: NewGameOptions, content: EngineContent): GameState {
  const xp = Math.max(0, opts.founderXp ?? 0)
  const s: GameState = {
    meta: { saveVersion: SAVE_VERSION, founderXp: xp, runIndex: opts.runIndex ?? 0, companyName: cleanCompanyName(opts.companyName) },
    rng: createRngState(opts.seed),
    time: { day: 0, month: 0, speed: 0 }, // starts paused: the player presses Başlat (sim steps directly)
    stage: 0,
    stats: { cash: Math.round(startCash(xp)), users: 0, morale: B.START_MORALE, reputation: B.START_REPUTATION, arpu: 0, churn: B.CHURN_BASE, equity: 1 },
    finance: {
      mrr: 0,
      burn: 0,
      burnBreakdown: { salaries: 0, rent: 0, infra: 0, ads: 0 },
      net: 0,
      runway: null,
      valuation: 0,
      mrrHistory: [],
      usersHistory: [],
      negativeCashDays: 0,
      adBudget: 0,
      priceMultiplier: 1,
      enterpriseCustomers: [],
      debt: 0,
      ledger: { revenue: 0, salaries: 0, rent: 0, infra: 0, ads: 0 },
    },
    derived: {
      teamSize: 0,
      deptCounts: perDept(0),
      deptOutput: perDept(0),
      avgMaturity: 0,
      capacity: B.CAPACITY_MIN,
      overload: 0,
      coordination: 1,
      moraleTarget: B.MORALE_BASE_TARGET,
      cac: B.CAC_BASE,
      ltv: 0,
      ltvCac: null,
      momGrowth: 0,
      valuationMultiple: B.MULTIPLE_BASE,
      channels: { organic: 0, paid: 0, manual: 0, enterprise: 0 },
      stageProgress: 0,
      canStartRound: false,
    },
    office: buildOffice(0),
    employees: [],
    candidates: [],
    projects: [],
    founder: { energy: B.ENERGY_MAX, cooldowns: {}, lowEnergyDays: 0 },
    concepts: { triggered: [], learned: [], queue: [], minimized: [] },
    decisions: { queue: [], history: [], pending: [], lastCardDay: 0 },
    modifiers: [],
    techDebt: 0,
    unlockedWidgets: [...INITIAL_WIDGETS],
    unlockedTools: [],
    visitors: [],
    bubbles: [],
    milestones: [],
    counters: {},
    flags: {},
    activity: [],
    events: [],
    nextId: 1,
    releases: [],
    goalsDone: [],
  }
  const rng = new Rng(s.rng)
  fillCandidates(s, content, rng, true)
  s.rng = rng.snapshot()
  recomputeDerived(s, content)
  s.stageStart = stageBaseline(s)
  return s
}
