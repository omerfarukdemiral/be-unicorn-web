// Temporary garage state so render/ui lanes can run before the engine is wired.
// Integrate lane replaces its use with engine.createGame().
import { DEPTS, FOUNDER_SLOT_ID, INITIAL_WIDGETS, SAVE_VERSION, type Dept, type GameState, type Slot } from '../engine/types'
import { createRngState } from '../engine/rng'

function perDept(value: number): Record<Dept, number> {
  const out = {} as Record<Dept, number>
  for (const d of DEPTS) out[d] = value
  return out
}

export function createBootstrapState(seed = 1): GameState {
  const slots: Slot[] = [
    { id: FOUNDER_SLOT_ID, ring: 0, type: 'desk', pos: { x: 0, z: 0 }, rotation: 0 },
    { id: 'r1-s0', ring: 1, type: 'desk', pos: { x: -1, z: -1 }, rotation: 0 },
    { id: 'r1-s1', ring: 1, type: 'desk', pos: { x: 1, z: -1 }, rotation: 0 },
    { id: 'r1-s2', ring: 1, type: 'desk', pos: { x: -1, z: 1 }, rotation: 2 },
    { id: 'r1-s3', ring: 1, type: 'desk', pos: { x: 1, z: 1 }, rotation: 2 },
  ]
  return {
    meta: { saveVersion: SAVE_VERSION, founderXp: 0, runIndex: 0 },
    rng: createRngState(seed),
    time: { day: 0, month: 0, speed: 1 },
    stage: 0,
    stats: { cash: 25_000, users: 0, morale: 70, reputation: 10, arpu: 0, churn: 0.06, equity: 1 },
    finance: {
      mrr: 0, burn: 800, burnBreakdown: { salaries: 0, rent: 800, infra: 0, ads: 0 }, net: -800, runway: 25_000 / 800,
      valuation: 0, mrrHistory: [], usersHistory: [], negativeCashDays: 0, adBudget: 0, priceMultiplier: 1,
      enterpriseCustomers: [], debt: 0,
    },
    derived: {
      teamSize: 0, deptCounts: perDept(0), deptOutput: perDept(0), avgMaturity: 0, capacity: 50, overload: 0,
      coordination: 1, moraleTarget: 60, cac: 8, ltv: 0, ltvCac: null, momGrowth: 0, valuationMultiple: 6,
      channels: { organic: 0, paid: 0, manual: 0, enterprise: 0 }, stageProgress: 0, canStartRound: false,
    },
    office: { stage: 0, rings: [{ index: 1, unlocked: true, openCost: 0, rentPerMonth: 0 }], slots },
    employees: [],
    candidates: [],
    projects: [],
    founder: { energy: 100, cooldowns: {}, lowEnergyDays: 0 },
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
  }
}
