// Minimal GameState for content tests (independent of the engine's createGame).
import type { Dept, GameState } from '../../engine/types'

const perDept = (v: number): Record<Dept, number> => ({ eng: v, product: v, marketing: v, sales: v, ops: v })

export function makeState(patch: (s: GameState) => void = () => {}): GameState {
  const s: GameState = {
    meta: { saveVersion: 1, founderXp: 0, runIndex: 0 , companyName: 'Helio Studio' },
    rng: { seed: 1, state: 1 },
    time: { day: 0, month: 0, speed: 1 },
    stage: 0,
    stats: { cash: 25_000, users: 0, morale: 70, reputation: 10, arpu: 0, churn: 0.06, equity: 1 },
    finance: {
      mrr: 0, burn: 800, burnBreakdown: { salaries: 0, rent: 800, infra: 0, ads: 0 }, net: -800, runway: 31.25,
      valuation: 0, mrrHistory: [], usersHistory: [], negativeCashDays: 0, adBudget: 0, priceMultiplier: 1,
      enterpriseCustomers: [], debt: 0,
    },
    derived: {
      teamSize: 0, deptCounts: perDept(0), deptOutput: perDept(0), avgMaturity: 0, capacity: 50, overload: 0,
      coordination: 1, moraleTarget: 60, cac: 8, ltv: 0, ltvCac: null, momGrowth: 0, valuationMultiple: 6,
      channels: { organic: 0, paid: 0, manual: 0, enterprise: 0 }, stageProgress: 0, canStartRound: false,
    },
    office: { stage: 0, rings: [{ index: 1, unlocked: true, openCost: 0, rentPerMonth: 0 }], slots: [] },
    employees: [],
    candidates: [],
    projects: [],
    founder: { energy: 100, cooldowns: {}, lowEnergyDays: 0 },
    concepts: { triggered: [], learned: [], queue: [], minimized: [] },
    decisions: { queue: [], history: [], pending: [], lastCardDay: 0 },
    modifiers: [],
    techDebt: 0,
    unlockedWidgets: ['cash', 'users', 'morale'],
    unlockedTools: [],
    visitors: [],
    bubbles: [],
    milestones: [],
    counters: {},
    flags: {},
    activity: [],
    events: [],
    nextId: 1,
  }
  patch(s)
  return s
}

/** A busier mid-game state with large numbers (for worst-case text length). */
export function makeBusyState(): GameState {
  return makeState((s) => {
    s.time = { day: 845.5, month: 28, speed: 2 }
    s.stage = 4
    s.stats = { cash: 12_345_678, users: 1_234_567, morale: 42, reputation: 66, arpu: 7.4, churn: 0.083, equity: 0.31 }
    s.finance.mrr = 2_400_000
    s.finance.burn = 3_100_000
    s.finance.net = -700_000
    s.finance.runway = 17.6
    s.finance.burnBreakdown = { salaries: 2_000_000, rent: 400_000, infra: 200_000, ads: 500_000 }
    s.finance.adBudget = 500_000
    s.finance.enterpriseCustomers = [{ id: 'c1', name: 'Boğaz Holding', mrr: 900_000, sinceDay: 700 }]
    s.derived.teamSize = 38
    s.derived.avgMaturity = 0.63
    s.derived.cac = 41.2
    s.derived.ltv = 88.9
    s.derived.ltvCac = 2.16
    s.derived.momGrowth = 0.012
    s.derived.channels = { organic: 1000, paid: 9000, manual: 0, enterprise: 10 }
    s.counters = { hires: 45, manualFinds: 12, crunches: 4, lowGrowthMonths: 3 }
    s.founder.lowEnergyDays = 7
    s.techDebt = 37
    s.round = {
      active: true, targetStage: 5, startedDay: 830, weeksTotal: 8, weeksLeft: 6,
      offer: { amount: 150_000_000, equity: 0.12, preMoney: 1_100_000_000 }, baseValuation: 1_100_000_000,
    }
    s.projects = [
      { id: 'p1', name: 'Pusula', category: 'web', size: 1, maturity: 0.8, launched: true, createdDay: 5, assignedIds: [] },
      { id: 'p2', name: 'Kovan', category: 'ai', size: 2, maturity: 0.1, launched: false, createdDay: 845, assignedIds: [] },
    ]
    s.employees = [
      { id: 'e1', name: 'Kıvanç', dept: 'eng', quality: 1.4, salary: 9000, status: 'working', statusSinceDay: 0, hiredDay: 3, morale: 40, star: true },
    ]
    s.decisions.history = [{ cardId: 'angel-1', optionIndex: 0, day: 100 }]
    s.archetype = 'vcRocket'
    s.gameOver = { kind: 'bankrupt', day: 845, reasons: [], xpEarned: 2 }
    s.flags = { rivalPressure: 0.5, rushedProject: true, starHire: true, firstHireDay: 3 }
    s.unlockedTools = ['enterpriseSales']
    s.concepts.learned = ['runway', 'burn']
  })
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/** Counts sentence terminators (., !, ?) that end a sentence. */
export function sentenceCount(text: string): number {
  return (text.trim().match(/[.!?…]+(?=\s|$)/g) ?? []).length
}
