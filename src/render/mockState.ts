// Self-contained mock GameState so the scene renders without the engine or store.
// Layout here is illustrative only; the engine owns real slot layouts.
import {
  DEPTS,
  FOUNDER_SLOT_ID,
  INITIAL_WIDGETS,
  SAVE_VERSION,
  type ConceptId,
  type Dept,
  type Employee,
  type EmployeeStatus,
  type GameState,
  type RingState,
  type Slot,
  type SlotType,
  type StageIndex,
  type Visitor,
} from '../engine/types'

function perDept(value: number): Record<Dept, number> {
  const out = {} as Record<Dept, number>
  for (const d of DEPTS) out[d] = value
  return out
}

const RING_COUNT = [1, 2, 3, 4, 5, 6, 3] as const

function mockSlots(stage: StageIndex): Slot[] {
  const slots: Slot[] = [{ id: FOUNDER_SLOT_ID, ring: 0, type: 'desk', pos: { x: 0, z: 0 }, rotation: 0 }]
  const rings = RING_COUNT[stage]
  let n = 0
  const add = (ring: number, type: SlotType, x: number, z: number, extra: Partial<Slot> = {}): Slot => {
    const rotation = (z < 0 ? 0 : z > 0 ? 2 : x < 0 ? 1 : 3) as Slot['rotation']
    const s: Slot = { id: `r${ring}-s${n++}`, ring, type, pos: { x, z }, rotation, ...extra }
    slots.push(s)
    return s
  }
  // Ring 1: four diagonal desks around the founder (matches the garage bootstrap).
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) add(1, 'desk', x, z)
  for (let r = 2; r <= rings; r++) {
    const used = new Set<string>()
    // Room pair on the left side from ring 3.
    if (r >= 3) {
      const a = add(r, 'room', -r, -1)
      add(r, 'room', -r, 0, { spanOf: a.id })
      used.add(`${-r},-1`).add(`${-r},0`)
    }
    for (let x = -r; x <= r; x++) {
      for (let z = -r; z <= r; z++) {
        if (Math.max(Math.abs(x), Math.abs(z)) !== r || (x + z) % 2 !== 0) continue
        if (used.has(`${x},${z}`)) continue
        let type: SlotType = 'desk'
        if (x === 0) type = 'common'
        if (r >= 5 && z === r && x === 0) type = 'special'
        add(r, type, x, z)
      }
    }
  }
  return slots
}

const DESK_ITEMS = ['desk-basic', 'desk-ergo', 'desk-dual'] as const
const COMMON_ITEMS = ['coffee-corner', 'plant-big', 'sofa-lounge', 'game-corner'] as const
const STATUSES: EmployeeStatus[] = ['working', 'working', 'working', 'tired', 'working', 'break', 'onboarding', 'burnout', 'working', 'leaving']

export function createMockState(stage: StageIndex = 1, seed = 7): GameState {
  const slots = mockSlots(stage)
  const ringCount = RING_COUNT[stage]
  const rings: RingState[] = []
  for (let r = 1; r <= ringCount; r++) {
    rings.push({ index: r, unlocked: stage === 0 || r < ringCount, openCost: 5000 * r * r, rentPerMonth: 400 * r })
  }
  const unlocked = (ring: number) => ring === 0 || rings.find((x) => x.index === ring)?.unlocked === true

  // Furnish unlocked slots.
  let di = 0
  let ci = 0
  for (const s of slots) {
    if (!unlocked(s.ring) || s.id === FOUNDER_SLOT_ID) {
      if (s.id === FOUNDER_SLOT_ID) s.itemId = 'desk-dual'
      continue
    }
    if (s.type === 'desk') s.itemId = DESK_ITEMS[Math.min(2, Math.floor(di++ / 3) % 3)]
    else if (s.type === 'common') s.itemId = COMMON_ITEMS[ci++ % COMMON_ITEMS.length]
    else if (s.type === 'special') s.itemId = 'demo-stage'
  }
  const roomAnchors = slots.filter((s) => s.type === 'room' && !s.spanOf && unlocked(s.ring))
  roomAnchors.forEach((a, i) => {
    const id = i === 0 ? 'meeting-room' : i === 1 ? 'bookshelf-library' : 'server-room'
    a.itemId = id
    const sec = slots.find((s) => s.spanOf === a.id)
    if (sec) sec.itemId = id
  })
  if (stage >= 1 && roomAnchors.length === 0) {
    const c = slots.find((s) => s.type === 'common' && s.itemId)
    if (c) c.itemId = 'bookshelf'
  }

  // Seat employees at furnished desks.
  const employees: Employee[] = []
  const desks = slots.filter((s) => s.type === 'desk' && s.itemId && s.id !== FOUNDER_SLOT_ID)
  const names = ['Mira', 'Deniz', 'Ece', 'Kaan', 'Ada', 'Bora', 'Selin', 'Emre', 'Zeynep', 'Can', 'Nil', 'Arda']
  desks.forEach((d, i) => {
    const status = stage === 0 ? 'working' : (STATUSES[i % STATUSES.length] ?? 'working')
    const id = `e${i + 1}`
    d.occupantId = id
    employees.push({
      id,
      name: names[i % names.length] ?? `P${i + 1}`,
      dept: DEPTS[i % DEPTS.length] ?? 'eng',
      quality: 1,
      salary: 3000,
      status,
      statusSinceDay: 20,
      hiredDay: 5,
      deskSlotId: d.id,
      morale: status === 'burnout' ? 20 : status === 'tired' ? 35 : 70,
      leaveDay: status === 'leaving' ? 45 : undefined,
    })
  })
  const shown = stage === 0 ? employees.slice(0, 2) : employees
  for (const s of slots) if (s.occupantId && !shown.some((e) => e.id === s.occupantId)) delete s.occupantId

  const visitors: Visitor[] =
    stage >= 1
      ? [{ id: 'v1', role: 'investor', purpose: 'decision', targetSlotId: FOUNDER_SLOT_ID, arriveDay: 40, leaveDay: 60, refId: 'angel-1' }]
      : []

  const learned: ConceptId[] = ['runway', 'burn', 'dont-scale', 'pmf', 'focus', 'dilution', 'safe', 'churn'].slice(0, 2 + stage * 2) as ConceptId[]

  return {
    meta: { saveVersion: SAVE_VERSION, founderXp: 0, runIndex: 0 },
    rng: { seed, state: seed },
    time: { day: 42, month: 1, speed: 1 },
    stage,
    stats: { cash: 120_000, users: 800, morale: 64, reputation: 30, arpu: 5, churn: 0.05, equity: 0.9 },
    finance: {
      mrr: 4000, burn: 9000, burnBreakdown: { salaries: 7000, rent: 1500, infra: 500, ads: 0 }, net: -5000, runway: 24,
      valuation: 400_000, mrrHistory: [0, 2000], usersHistory: [0, 400], negativeCashDays: 0, adBudget: 0,
      priceMultiplier: 1, enterpriseCustomers: [], debt: 0,
    },
    derived: {
      teamSize: shown.length, deptCounts: perDept(1), deptOutput: perDept(1), avgMaturity: 0.35, capacity: 1500,
      overload: stage >= 2 ? 0.2 : 0, coordination: 1, moraleTarget: 64, cac: 8, ltv: 80, ltvCac: null, momGrowth: 0.12,
      valuationMultiple: 8, channels: { organic: 30, paid: 0, manual: 5, enterprise: 0 }, stageProgress: 0.6, canStartRound: false,
    },
    office: { stage, rings, slots },
    employees: shown,
    candidates: [],
    projects: [{ id: 'p1', name: 'MVP', category: 'mobile', size: 1, maturity: 0.35, launched: true, createdDay: 1, assignedIds: shown.map((e) => e.id) }],
    founder: { energy: 70, cooldowns: {}, lowEnergyDays: 0 },
    concepts: { triggered: learned, learned, queue: [], active: { id: 'runway', shownDay: 41 }, minimized: stage >= 1 ? ['hire-bar'] : [] },
    decisions: {
      queue: [], history: [], pending: [], lastCardDay: 0,
      active: stage >= 1 ? { cardId: 'angel-1', shownDay: 41, visitorId: 'v1' } : undefined,
    },
    modifiers: [],
    techDebt: 0,
    unlockedWidgets: [...INITIAL_WIDGETS],
    unlockedTools: [],
    visitors,
    bubbles: shown[0] ? [{ id: 'b1', lineId: 'mock-line', speakerId: shown[0].id, day: 41.5, untilDay: 1e9 }] : [],
    milestones: [],
    counters: {},
    flags: {},
    activity: [],
    events: [],
    nextId: 100,
  }
}
