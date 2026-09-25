// Dev mock: a rich Pre-seed state + a tiny local reducer so every UI piece can be exercised
// before/without the engine (`?mock` in the URL, or <GameUI mock />). Never used in production play.
import {
  DEPTS,
  FOUNDER_SLOT_ID,
  HUD_WIDGETS,
  SAVE_VERSION,
  TOOL_IDS,
  type Action,
  type ActionResult,
  type Dept,
  type GameState,
  type Slot,
} from '../engine/types'
import { CONCEPTS, DECISIONS, FURNITURE, OFFICE_LINES } from '../content'
import { useGameStore } from '../store/gameStore'

function perDept(v: number): Record<Dept, number> {
  const o = {} as Record<Dept, number>
  for (const d of DEPTS) o[d] = v
  return o
}

export function mockRequested(): boolean {
  try {
    return import.meta.env.DEV && new URLSearchParams(window.location.search).has('mock')
  } catch {
    return false
  }
}

export function createMockState(): GameState {
  const desk = FURNITURE.find((f) => f.slotType === 'desk')?.id ?? 'desk-basic'
  const common = FURNITURE.find((f) => f.slotType === 'common')?.id
  const slots: Slot[] = [
    { id: FOUNDER_SLOT_ID, ring: 0, type: 'desk', pos: { x: 0, z: 0 }, rotation: 0, itemId: desk },
    { id: 'r1-s0', ring: 1, type: 'desk', pos: { x: -1, z: -1 }, rotation: 0, itemId: desk, occupantId: 'e1' },
    { id: 'r1-s1', ring: 1, type: 'desk', pos: { x: 1, z: -1 }, rotation: 0, itemId: desk, occupantId: 'e2' },
    { id: 'r1-s2', ring: 1, type: 'desk', pos: { x: -1, z: 1 }, rotation: 2, itemId: desk, occupantId: 'e3' },
    { id: 'r1-s3', ring: 1, type: 'desk', pos: { x: 1, z: 1 }, rotation: 2, itemId: desk },
    { id: 'r2-s0', ring: 2, type: 'common', pos: { x: 0, z: -2 }, rotation: 0, itemId: common },
    { id: 'r2-s1', ring: 2, type: 'desk', pos: { x: -2, z: 0 }, rotation: 1 },
    { id: 'r2-s2', ring: 2, type: 'desk', pos: { x: 2, z: 0 }, rotation: 3 },
  ]
  const concept = CONCEPTS.find((c) => c.id === 'dilution') ?? CONCEPTS[0]
  const decision = DECISIONS[0]
  const line = OFFICE_LINES[0]
  return {
    meta: { saveVersion: SAVE_VERSION, founderXp: 1.5, runIndex: 1 , companyName: 'Helio Studio' },
    rng: { seed: 7, state: 7 },
    time: { day: 74.5, month: 2, speed: 1 },
    stage: 1,
    stats: { cash: 38_400, users: 642, morale: 58, reputation: 31, arpu: 4.6, churn: 0.072, equity: 0.9 },
    finance: {
      mrr: 2_950,
      burn: 9_800,
      burnBreakdown: { salaries: 7_500, rent: 1_900, infra: 60, ads: 340 },
      net: -6_850,
      runway: 5.6,
      valuation: 412_000,
      mrrHistory: [0, 600, 1_700, 2_950],
      usersHistory: [0, 120, 390, 642],
      negativeCashDays: 0,
      adBudget: 500,
      priceMultiplier: 1,
      enterpriseCustomers: [{ id: 'c1', name: 'Anadolu Lojistik', mrr: 900, sinceDay: 60 }],
      debt: 0,
    },
    derived: {
      teamSize: 4,
      deptCounts: { eng: 2, product: 1, marketing: 1, sales: 0, ops: 0 },
      deptOutput: perDept(1),
      avgMaturity: 0.34,
      capacity: 3_000,
      overload: 0,
      coordination: 1,
      moraleTarget: 62,
      cac: 10.4,
      ltv: 52,
      ltvCac: 2.4,
      momGrowth: 0.18,
      valuationMultiple: 12,
      channels: { organic: 140, paid: 48, manual: 12, enterprise: 1 },
      stageProgress: 0.82,
      canStartRound: true,
    },
    office: {
      stage: 1,
      rings: [
        { index: 1, unlocked: true, openCost: 0, rentPerMonth: 0 },
        { index: 2, unlocked: false, openCost: 12_000, rentPerMonth: 900 },
      ],
      slots,
    },
    employees: [
      { id: 'e1', name: 'Mira Aydın', dept: 'eng', quality: 1.2, salary: 3_000, status: 'working', statusSinceDay: 20, hiredDay: 12, deskSlotId: 'r1-s0', projectId: 'p1', morale: 66 },
      { id: 'e2', name: 'Kerem Taş', dept: 'eng', quality: 0.9, salary: 2_700, status: 'tired', statusSinceDay: 70, hiredDay: 30, deskSlotId: 'r1-s1', projectId: 'p1', morale: 38 },
      { id: 'e3', name: 'Deniz Kaya', dept: 'product', quality: 1.0, salary: 2_400, status: 'leaving', statusSinceDay: 73, hiredDay: 41, deskSlotId: 'r1-s2', morale: 24, leaveDay: 76.5 },
      { id: 'e4', name: 'Selin Ak', dept: 'marketing', quality: 1.1, salary: 2_200, status: 'onboarding', statusSinceDay: 73, hiredDay: 73, morale: 70 },
    ],
    candidates: [
      { id: 'c-1', name: 'Arda Yıldız', dept: 'eng', quality: 1.3, salary: 3_300, expiresDay: 82 },
      { id: 'c-2', name: 'Ece Demir', dept: 'sales', quality: 0.8, salary: 2_100, expiresDay: 79 },
      { id: 'c-3', name: 'Bora Çelik', dept: 'ops', quality: 1.0, salary: 2_000, expiresDay: 85 },
      { id: 'c-4', name: 'Zeynep Er', dept: 'product', quality: 1.4, salary: 2_900, expiresDay: 77 },
    ],
    projects: [
      { id: 'p1', name: 'Cep Asistan', category: 'mobile', size: 1, maturity: 0.46, launched: true, launchedDay: 40, createdDay: 5, assignedIds: ['e1', 'e2'] },
      { id: 'p2', name: 'Pazar Köprüsü', category: 'marketplace', size: 1.5, maturity: 0.12, launched: false, createdDay: 60, assignedIds: [] },
    ],
    founder: { energy: 44, cooldowns: { findUsers: 76, talkToUsers: 75.5 }, lowEnergyDays: 0, currentAction: { kind: 'investorCoffee', startDay: 74, endDay: 75.2 } },
    concepts: {
      triggered: ['runway', 'burn', 'dont-scale', 'pmf', 'dilution', 'hire-bar'],
      learned: ['runway', 'burn', 'dont-scale', 'pmf'],
      queue: [],
      active: concept ? { id: concept.id, shownDay: 74 } : undefined,
      minimized: ['hire-bar'],
    },
    decisions: {
      active: decision ? { cardId: decision.id, shownDay: 74 } : undefined,
      queue: [],
      history: [],
      pending: [],
      lastCardDay: 74,
    },
    modifiers: [],
    techDebt: 18,
    unlockedWidgets: [...HUD_WIDGETS],
    unlockedTools: [...TOOL_IDS],
    visitors: [],
    bubbles: line ? [{ id: 'b1', lineId: line.id, speakerId: 'e1', day: 74.4, untilDay: 1e9 }] : [],
    milestones: ['users100', 'firstMrr', 'firstLaunch'],
    archetype: 'niche',
    counters: {},
    flags: {},
    activity: [
      { id: 1, day: 60, kind: 'projectStarted', params: { project: 'Pazar Köprüsü' } },
      { id: 2, day: 73, kind: 'hired', params: { name: 'Selin Ak' } },
      { id: 3, day: 73.2, kind: 'resignWarning', params: { name: 'Deniz Kaya' } },
      { id: 4, day: 74, kind: 'founderActionStarted', params: { action: 'investorCoffee' } },
    ],
    events: [],
    nextId: 100,
  }
}

function ok(state: GameState): ActionResult {
  return { state, ok: true }
}

/** Minimal local reducer: enough to click through the UI. */
export function mockReduce(prev: GameState, a: Action): ActionResult {
  const s = structuredClone(prev)
  switch (a.type) {
    case 'setSpeed':
      s.time.speed = a.speed
      return ok(s)
    case 'openConcept':
      if (!s.concepts.learned.includes(a.conceptId)) s.concepts.learned.push(a.conceptId)
      s.concepts.minimized = s.concepts.minimized.filter((c) => c !== a.conceptId)
      if (s.concepts.active?.id === a.conceptId) s.concepts.active = undefined
      return ok(s)
    case 'minimizeConcept':
      if (!s.concepts.minimized.includes(a.conceptId)) s.concepts.minimized.push(a.conceptId)
      if (s.concepts.active?.id === a.conceptId) s.concepts.active = undefined
      return ok(s)
    case 'answerDecision':
      s.decisions.lastAnswer = { cardId: a.cardId, optionIndex: a.optionIndex, day: s.time.day }
      s.decisions.history.push(s.decisions.lastAnswer)
      s.decisions.active = undefined
      return ok(s)
    case 'hire': {
      const c = s.candidates.find((x) => x.id === a.candidateId)
      if (!c) return { state: prev, ok: false, error: 'notFound' }
      s.candidates = s.candidates.filter((x) => x.id !== c.id)
      s.employees.push({ id: `e${s.nextId++}`, name: c.name, dept: c.dept, quality: c.quality, salary: c.salary, status: 'onboarding', statusSinceDay: s.time.day, hiredDay: s.time.day, morale: 70 })
      s.activity.push({ id: s.nextId++, day: s.time.day, kind: 'hired', params: { name: c.name } })
      return ok(s)
    }
    case 'fire':
      s.employees = s.employees.filter((e) => e.id !== a.employeeId)
      return ok(s)
    case 'respondResignation': {
      const e = s.employees.find((x) => x.id === a.employeeId)
      if (!e) return { state: prev, ok: false, error: 'notFound' }
      if (a.response === 'letGo') s.employees = s.employees.filter((x) => x.id !== e.id)
      else {
        e.status = 'working'
        e.morale = 55
        delete e.leaveDay
      }
      return ok(s)
    }
    case 'assign': {
      const e = s.employees.find((x) => x.id === a.employeeId)
      if (!e) return { state: prev, ok: false, error: 'notFound' }
      for (const p of s.projects) p.assignedIds = p.assignedIds.filter((id) => id !== e.id)
      e.projectId = a.projectId ?? undefined
      if (a.projectId) s.projects.find((p) => p.id === a.projectId)?.assignedIds.push(e.id)
      return ok(s)
    }
    case 'startProject':
      s.projects.push({ id: `p${s.nextId++}`, name: `${a.category.toUpperCase()} ${s.projects.length + 1}`, category: a.category, size: 1, maturity: 0, launched: false, createdDay: s.time.day, assignedIds: [] })
      return ok(s)
    case 'setPrice':
      s.finance.priceMultiplier = a.multiplier
      return ok(s)
    case 'setAdBudget':
      s.finance.adBudget = a.amount
      return ok(s)
    case 'openRing': {
      const r = s.office.rings.find((x) => x.index === a.ring)
      if (!r) return { state: prev, ok: false, error: 'notFound' }
      if (s.stats.cash < r.openCost) return { state: prev, ok: false, error: 'insufficientCash' }
      r.unlocked = true
      s.stats.cash -= r.openCost
      return ok(s)
    }
    case 'founderAction':
      if (s.founder.currentAction && s.founder.currentAction.endDay > s.time.day) return { state: prev, ok: false, error: 'founderBusy' }
      s.founder.currentAction = { kind: a.kind, startDay: s.time.day, endDay: s.time.day + 1 }
      s.founder.cooldowns[a.kind] = s.time.day + 3
      s.founder.energy = Math.max(0, s.founder.energy - 10)
      return ok(s)
    case 'startRound':
      s.round = { active: true, targetStage: 2, startedDay: s.time.day, weeksTotal: 6, weeksLeft: 6, offer: { amount: 150_000, equity: 0.1, preMoney: 1_350_000 }, baseValuation: s.finance.valuation }
      s.derived.canStartRound = false
      return ok(s)
    default:
      return { state: prev, ok: false, error: 'engineNotConnected' }
  }
}

/** Swaps the store's state and dispatch for the mock pair (dev only). */
export function installMock(): void {
  useGameStore.setState((st) => ({
    state: createMockState(),
    dispatch(action: Action) {
      const res = mockReduce(useGameStore.getState().state, action)
      if (res.ok) useGameStore.setState({ state: res.state })
      else useGameStore.setState({ ui: { ...useGameStore.getState().ui, lastError: { code: res.error ?? 'invalid', at: performance.now() } } })
      return res
    },
    ui: { ...st.ui },
  }))
}
