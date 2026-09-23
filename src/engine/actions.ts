// applyAction(state, action): pure. Invalid actions return ok:false + error code and the untouched input state.
import * as B from './balance'
import { learnConcept, minimizeConcept } from './concepts'
import { answerDecision } from './decisions'
import { recomputeDerived } from './derive'
import { applyMorale, unlockTool } from './effects'
import { startFounderAction } from './founder'
import { anchorOf, findPartnerSlot, findSlot, firstFreeDesk, isFreeDesk, isRingUnlocked, nextLockedRing, onlyEmptyDeskSlots } from './office'
import { fillCandidates, hireCandidate, refreshCost, removeEmployee } from './people'
import { Rng } from './rng'
import { startRound } from './round'
import {
  FOUNDER_ACTIONS,
  FOUNDER_SLOT_ID,
  PROJECT_CATEGORIES,
  type Action,
  type ActionErrorCode,
  type ActionOf,
  type ActionResult,
  type GameState,
  type Slot,
} from './types'
import { clone, furnitureById, incCounter, newId, pushActivity, pushEvent, type EngineContent } from './util'

export type { Action, ActionType, ActionOf, TimedAction, ActionResult, ActionErrorCode } from './types'

/** Actions still allowed after game over (UI housekeeping). */
const AFTER_GAME_OVER = new Set<Action['type']>(['setSpeed', 'openConcept', 'minimizeConcept'])

type Ctx = { s: GameState; content: EngineContent; rng: Rng }
/** Handler: mutate ctx.s and return null, or return an error code (the clone is discarded). */
type Handler<T extends Action['type']> = (ctx: Ctx, a: ActionOf<T>) => ActionErrorCode | null

export function applyAction(state: GameState, action: Action, content: EngineContent): ActionResult {
  if (state.gameOver && !AFTER_GAME_OVER.has(action.type)) return { state, ok: false, error: 'gameOver' }
  const handler = HANDLERS[action.type] as Handler<Action['type']> | undefined
  if (!handler) return { state, ok: false, error: 'invalid' }
  const s = clone(state)
  const rng = new Rng(s.rng)
  const err = handler({ s, content, rng }, action)
  if (err) return { state, ok: false, error: err }
  s.rng = rng.snapshot()
  recomputeDerived(s, content)
  return { state: s, ok: true }
}

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

const hire: Handler<'hire'> = ({ s }, a) => {
  const c = s.candidates.find((x) => x.id === a.candidateId)
  if (!c) return 'notFound'
  let slot: Slot | undefined
  if (a.deskSlotId !== undefined) {
    slot = findSlot(s.office, a.deskSlotId)
    const err = deskError(s, slot)
    if (err) return err
  } else {
    slot = firstFreeDesk(s.office)
    if (!slot) return onlyEmptyDeskSlots(s.office) ? 'noDesk' : 'noFreeSlot'
  }
  hireCandidate(s, c, slot?.id)
  return null
}

function deskError(s: GameState, slot: Slot | undefined): ActionErrorCode | null {
  if (!slot) return 'notFound'
  if (slot.type !== 'desk') return 'wrongSlotType'
  if (!isRingUnlocked(s.office, slot.ring)) return 'slotLocked'
  if (!isFreeDesk(s.office, slot)) return 'slotOccupied'
  if (slot.itemId === undefined) return 'noDesk'
  return null
}

const fire: Handler<'fire'> = ({ s }, a) => {
  const e = removeEmployee(s, a.employeeId)
  if (!e) return 'notFound'
  s.stats.cash -= e.salary * B.SEVERANCE_MONTHS
  applyMorale(s, B.FIRE_TEAM_MORALE)
  incCounter(s, 'fires')
  pushActivity(s, 'fired', { name: e.name, id: e.id })
  pushEvent(s, { kind: 'fired', refId: e.id })
  return null
}

const assignDesk: Handler<'assignDesk'> = ({ s }, a) => {
  const e = s.employees.find((x) => x.id === a.employeeId)
  if (!e) return 'notFound'
  if (a.slotId !== null && a.slotId === e.deskSlotId) return null
  let target: Slot | undefined
  if (a.slotId !== null) {
    target = findSlot(s.office, a.slotId)
    const err = deskError(s, target)
    if (err) return err
  }
  for (const slot of s.office.slots) if (slot.occupantId === e.id) delete slot.occupantId
  if (target) {
    target.occupantId = e.id
    e.deskSlotId = target.id
  } else {
    delete e.deskSlotId
  }
  return null
}

const respondResignation: Handler<'respondResignation'> = ({ s }, a) => {
  const e = s.employees.find((x) => x.id === a.employeeId)
  if (!e) return 'notFound'
  if (e.status !== 'leaving') return 'invalid'
  if (a.response === 'letGo') {
    removeEmployee(s, e.id)
    incCounter(s, 'resignations')
    pushActivity(s, 'resigned', { name: e.name, id: e.id })
    pushEvent(s, { kind: 'resigned', refId: e.id })
    return null
  }
  if (a.response === 'talk') {
    if (s.founder.energy < B.TALK_ENERGY) return 'noEnergy'
    s.founder.energy -= B.TALK_ENERGY
    e.morale = Math.min(100, e.morale + B.TALK_MORALE)
  } else {
    e.salary = Math.round(e.salary * B.RAISE_FACTOR)
    e.morale = Math.min(100, e.morale + B.RAISE_MORALE)
  }
  e.status = 'working'
  e.statusSinceDay = s.time.day
  delete e.leaveDay
  s.flags[`retained:${e.id}`] = s.time.day + B.RETAIN_GRACE_DAYS
  pushActivity(s, 'retained', { name: e.name, id: e.id, response: a.response })
  return null
}

const refreshCandidates: Handler<'refreshCandidates'> = ({ s, content, rng }) => {
  const cost = refreshCost(s)
  if (s.stats.cash < cost) return 'insufficientCash'
  s.stats.cash -= cost
  s.candidates = []
  fillCandidates(s, content, rng)
  return null
}

// ---------------------------------------------------------------------------
// Office
// ---------------------------------------------------------------------------

const placeItem: Handler<'placeItem'> = ({ s, content }, a) => {
  const item = furnitureById(content, a.itemId)
  if (!item) return 'notFound'
  if (item.stageUnlock > s.stage) return 'notUnlocked'
  const slot = findSlot(s.office, a.slotId)
  if (!slot) return 'notFound'
  if (slot.id === FOUNDER_SLOT_ID) return 'invalid'
  if (!isRingUnlocked(s.office, slot.ring)) return 'slotLocked'
  if (slot.type !== item.slotType) return 'wrongSlotType'
  if (slot.itemId !== undefined || slot.spanOf !== undefined) return 'slotOccupied'
  const partner = item.size === 2 ? findPartnerSlot(s.office, slot) : undefined
  if (item.size === 2 && !partner) return 'noFreeSlot'
  if (s.stats.cash < item.price) return 'insufficientCash'
  s.stats.cash -= item.price
  slot.itemId = item.id
  if (partner) {
    partner.itemId = item.id
    partner.spanOf = slot.id
  }
  if (item.effects.reputation !== undefined) s.stats.reputation = Math.min(100, s.stats.reputation + item.effects.reputation)
  if (item.effects.enablesTool) unlockTool(s, item.effects.enablesTool)
  pushActivity(s, 'itemPlaced', { item: item.id, slot: slot.id })
  pushEvent(s, { kind: 'itemPlaced', refId: slot.id })
  return null
}

function clearItem(s: GameState, anchor: Slot): void {
  for (const x of s.office.slots) {
    if (x.spanOf === anchor.id) {
      delete x.itemId
      delete x.spanOf
    }
  }
  delete anchor.itemId
}

const sellItem: Handler<'sellItem'> = ({ s, content }, a) => {
  const slot = findSlot(s.office, a.slotId)
  if (!slot) return 'notFound'
  const anchor = anchorOf(s.office, slot)
  const item = furnitureById(content, anchor.itemId)
  if (!item) return 'notFound'
  s.stats.cash += item.price * B.SELL_REFUND
  // Selling a desk leaves its occupant without a seat until they get a new desk.
  if (anchor.occupantId !== undefined && item.slotType === 'desk') {
    const e = s.employees.find((x) => x.id === anchor.occupantId)
    if (e) delete e.deskSlotId
    delete anchor.occupantId
  }
  clearItem(s, anchor)
  pushActivity(s, 'itemSold', { item: item.id, slot: anchor.id })
  pushEvent(s, { kind: 'itemSold', refId: anchor.id })
  return null
}

const moveItem: Handler<'moveItem'> = ({ s, content }, a) => {
  const fromSlot = findSlot(s.office, a.fromSlotId)
  if (!fromSlot) return 'notFound'
  const from = anchorOf(s.office, fromSlot)
  const item = furnitureById(content, from.itemId)
  if (!item) return 'notFound'
  const to = findSlot(s.office, a.toSlotId)
  if (!to) return 'notFound'
  if (to.id === from.id) return null
  if (to.id === FOUNDER_SLOT_ID) return 'invalid'
  if (!isRingUnlocked(s.office, to.ring)) return 'slotLocked'
  if (to.type !== item.slotType) return 'wrongSlotType'
  const ownIds = s.office.slots.filter((x) => x.id === from.id || x.spanOf === from.id).map((x) => x.id)
  if ((to.itemId !== undefined && !ownIds.includes(to.id)) || (to.occupantId !== undefined && to.occupantId !== from.occupantId)) return 'slotOccupied'
  const partner = item.size === 2 ? findPartnerSlot(s.office, to, ownIds) : undefined
  if (item.size === 2 && !partner) return 'noFreeSlot'
  const occupant = from.occupantId
  clearItem(s, from)
  to.itemId = item.id
  if (partner) {
    partner.itemId = item.id
    partner.spanOf = to.id
  }
  // A seated employee moves with their desk.
  if (occupant !== undefined && item.slotType === 'desk') {
    delete from.occupantId
    to.occupantId = occupant
    const e = s.employees.find((x) => x.id === occupant)
    if (e) e.deskSlotId = to.id
  }
  pushActivity(s, 'itemMoved', { item: item.id, from: from.id, to: to.id })
  pushEvent(s, { kind: 'itemMoved', refId: to.id })
  return null
}

const upgradeItem: Handler<'upgradeItem'> = ({ s, content }, a) => {
  const slot = findSlot(s.office, a.slotId)
  if (!slot) return 'notFound'
  const anchor = anchorOf(s.office, slot)
  const cur = furnitureById(content, anchor.itemId)
  const next = furnitureById(content, a.toItemId)
  if (!cur || !next) return 'notFound'
  if (cur.upgradesTo !== next.id || cur.size !== next.size || cur.slotType !== next.slotType) return 'invalid'
  if (next.stageUnlock > s.stage) return 'notUnlocked'
  const cost = Math.max(0, next.price - cur.price * B.SELL_REFUND)
  if (s.stats.cash < cost) return 'insufficientCash'
  s.stats.cash -= cost
  for (const x of s.office.slots) if (x.id === anchor.id || x.spanOf === anchor.id) x.itemId = next.id
  if (next.effects.enablesTool) unlockTool(s, next.effects.enablesTool)
  pushActivity(s, 'itemPlaced', { item: next.id, slot: anchor.id })
  pushEvent(s, { kind: 'itemPlaced', refId: anchor.id })
  return null
}

const openRing: Handler<'openRing'> = ({ s }, a) => {
  const ring = s.office.rings.find((r) => r.index === a.ring)
  if (!ring) return 'notFound'
  if (ring.unlocked) return 'invalid'
  if (nextLockedRing(s.office) !== ring.index) return 'ringOrder'
  if (s.stats.cash < ring.openCost) return 'insufficientCash'
  s.stats.cash -= ring.openCost
  ring.unlocked = true
  pushActivity(s, 'ringOpened', { ring: ring.index })
  pushEvent(s, { kind: 'ringOpened', value: ring.index })
  return null
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

const startProject: Handler<'startProject'> = ({ s }, a) => {
  if (!PROJECT_CATEGORIES.includes(a.category)) return 'invalid'
  const n = (s.counters.projectsStarted ?? 0) + 1
  const p = {
    id: newId(s, 'p'),
    name: a.name?.trim() || `${a.category}-${n}`,
    category: a.category,
    size: B.PROJECT_SIZE[a.category],
    maturity: 0,
    launched: false,
    createdDay: s.time.day,
    assignedIds: [] as string[],
  }
  // Idle builders join the new project.
  for (const e of s.employees) {
    if ((e.dept === 'eng' || e.dept === 'product') && e.projectId === undefined) {
      e.projectId = p.id
      p.assignedIds.push(e.id)
    }
  }
  s.projects.push(p)
  incCounter(s, 'projectsStarted')
  s.flags['lastProjectDay'] = s.time.day
  pushActivity(s, 'projectStarted', { project: p.name, id: p.id, category: p.category })
  return null
}

const assign: Handler<'assign'> = ({ s }, a) => {
  const e = s.employees.find((x) => x.id === a.employeeId)
  if (!e) return 'notFound'
  const target = a.projectId === null ? undefined : s.projects.find((p) => p.id === a.projectId)
  if (a.projectId !== null && !target) return 'notFound'
  for (const p of s.projects) p.assignedIds = p.assignedIds.filter((x) => x !== e.id)
  if (target) {
    target.assignedIds.push(e.id)
    e.projectId = target.id
  } else {
    delete e.projectId
  }
  return null
}

// ---------------------------------------------------------------------------
// Founder, controls, growth
// ---------------------------------------------------------------------------

const founderAction: Handler<'founderAction'> = ({ s }, a) => {
  if (!FOUNDER_ACTIONS.includes(a.kind)) return 'invalid'
  return startFounderAction(s, a.kind, a.targetId)
}

const setSpeed: Handler<'setSpeed'> = ({ s }, a) => {
  if (![0, 1, 2, 4].includes(a.speed)) return 'invalid'
  s.time.speed = a.speed
  return null
}

const setAdBudget: Handler<'setAdBudget'> = ({ s }, a) => {
  if (!s.unlockedTools.includes('adBudget')) return 'notUnlocked'
  if (!Number.isFinite(a.amount) || a.amount < 0 || a.amount > B.AD_BUDGET_MAX) return 'invalid'
  s.finance.adBudget = Math.round(a.amount)
  if (a.amount > 0) s.flags['adBudgetOpened'] = true
  return null
}

const setPrice: Handler<'setPrice'> = ({ s }, a) => {
  if (!s.unlockedTools.includes('priceControl')) return 'notUnlocked'
  if (!Number.isFinite(a.multiplier) || a.multiplier < B.PRICE_MIN || a.multiplier > B.PRICE_MAX) return 'invalid'
  if (a.multiplier > s.finance.priceMultiplier) s.finance.priceChangeDay = s.time.day
  s.finance.priceMultiplier = a.multiplier
  return null
}

// ---------------------------------------------------------------------------
// Teaching, decisions, bubbles, rounds
// ---------------------------------------------------------------------------

const openConcept: Handler<'openConcept'> = ({ s, content }, a) => (learnConcept(s, content.concepts, a.conceptId) ? null : 'notFound')

const minimizeConceptH: Handler<'minimizeConcept'> = ({ s, content }, a) => (minimizeConcept(s, content.concepts, a.conceptId) ? null : 'notFound')

const answerDecisionH: Handler<'answerDecision'> = ({ s, content }, a) => answerDecision(s, content, a.cardId, a.optionIndex)

const startRoundH: Handler<'startRound'> = ({ s, rng }) => startRound(s, rng)

const HANDLERS: { [K in Action['type']]: Handler<K> } = {
  hire,
  fire,
  assignDesk,
  respondResignation,
  refreshCandidates,
  placeItem,
  sellItem,
  moveItem,
  upgradeItem,
  openRing,
  startProject,
  assign,
  founderAction,
  setSpeed,
  setAdBudget,
  setPrice,
  openConcept,
  minimizeConcept: minimizeConceptH,
  answerDecision: answerDecisionH,
  startRound: startRoundH,
}
