// applyAction(state, action): pure. Invalid actions return ok:false + error code and the untouched input state.
import type { FurnitureItem } from '../content/index'
import * as B from './balance'
import { learnConcept, minimizeConcept } from './concepts'
import { answerDecision } from './decisions'
import { recomputeDerived } from './derive'
import { applyEffects, applyMorale, unlockTool } from './effects'
import { buildersOf, effortOn, hasOpenWork, isBuilder, isSprinting, onLeave } from './effort'
import { actionEnergy, movesError, renewContract, renewError, spendMoves, startFounderAction } from './founder'
import { checkSale } from './endgame'
import { anchorOf, autoDeskItem, findPartnerSlot, findSlot, isFreeDesk, isRingUnlocked, nextLockedRing, onlyEmptyDeskSlots, placementSpec, syncSeats } from './office'
import { applySnapshot, autoPlace, previewSnapshot, cellKey, coveredCells, dropEmptyFreeSlots, autoSeat, liftItem, putItem, refusalError, storeDecor, typeCaps, typeUse, validateLayout } from './layout'
import { SAVED_LAYOUT_MAX, captureLayout, cleanLayoutName } from './layoutPlans'
import { fillCandidates, hireCandidate, layoff, refreshCost, removeEmployee } from './people'
import { isModuleId, moduleCost, moduleDef, moduleError, modulePromptFlag, moduleStaleFlag, projectVersion } from './modules'
import { checkName, nameKey } from './names'
import { Rng } from './rng'
import { isPaydayChoice, resolvePayday, starsOfStage } from './loop'
import { idleBuilders, upgradeCost } from './loopSelectors'
import { roundPitch, startRound } from './round'
import {
  FOUNDER_ACTIONS,
  FOUNDER_SLOT_ID,
  PACES,
  POLICY_IDS,
  PROJECT_CATEGORIES,
  RENEW_OFFERS,
  type Action,
  type ActionErrorCode,
  type ActionOf,
  type ActionResult,
  DEPTS,
  type Dept,
  type Employee,
  type GameState,
  type PolicyId,
  type Slot,
} from './types'
import { clone, furnitureById, incCounter, newId, payLaterOpen, policiesOf, policyMult, pushActivity, pushEvent, type EngineContent } from './util'
import { acquireError, acquireRival, openSegment, segmentError } from './world'

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

const hire: Handler<'hire'> = ({ s, content }, a) => {
  const c = s.candidates.find((x) => x.id === a.candidateId)
  if (!c) return 'notFound'
  let slot: Slot | undefined
  if (a.deskSlotId !== undefined) {
    slot = findSlot(s.office, a.deskSlotId)
    const err = deskError(s, slot)
    if (err) return err
  } else {
    // Grid §3/§5: a free desk by the hire's team (a spare ring desk may be carried there first); else any free desk.
    slot = autoSeat(s.office, c.dept)
    if (!slot && a.autoDesk) {
      // F6: refusing here sent the player to the shop, the desk got bought and the hire was never retried
      // ("para gidiyor, kişi gelmiyor"). The panel's hire now buys the desk too, auto placed by the hire's team
      // (grid §3, desk cap included); any failure costs nothing (clone).
      const item = autoDeskItem(s, content)
      const place = item && autoPlace(s.office, placementSpec(item), { team: c.dept })
      if (!item || !place) return 'noFreeSlot'
      if (s.stats.cash < item.price) return 'insufficientCash'
      storeDecor(s.office, place.bumped)
      slot = putItem(s.office, place, item.id, placementSpec(item))
      boughtOn(s, item, slot)
    }
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

const fire: Handler<'fire'> = ({ s, content }, a) => {
  const e = removeEmployee(s, a.employeeId)
  if (!e) return 'notFound'
  // layoff-round (§7.2): once signed, nobody gets severance again.
  s.stats.cash -= e.salary * B.SEVERANCE_MONTHS * policyMult(s, content, 'severance')
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
    // GAMEPLAY V2 §7.1: from Pre-seed on energy is a health gauge, the talk costs a move instead.
    const energy = actionEnergy(s, B.TALK_ENERGY)
    if (s.founder.energy < energy) return 'noEnergy'
    const moves = movesError(s, B.MOVE_COST.talkResignation)
    if (moves) return moves
    s.founder.energy -= energy
    spendMoves(s, B.MOVE_COST.talkResignation)
    e.morale = Math.min(100, e.morale + B.TALK_MORALE)
  } else {
    e.salary = Math.round(e.salary * B.RAISE_FACTOR)
    e.morale = Math.min(100, e.morale + B.RAISE_MORALE)
  }
  // E1: a burnt-out person stays on a calmer pace with some fatigue off; a bored one only buys time (the fix is work).
  if (e.leaveCause === 'burnout') {
    e.pace = 'calm'
    delete e.autoCalm
    e.fatigue = Math.max(0, (e.fatigue ?? 0) + B.RETAIN_BURNOUT_FATIGUE)
    e.burnoutDays = 0
  } else if (e.leaveCause === 'bored') {
    e.boredDays = B.BORED_RETAIN_DAYS
  }
  delete e.leaveCause
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
// Effort (E1, from Pre-seed): pace, sprint, leave, lead, ack. No moves.
// ---------------------------------------------------------------------------

const setPace: Handler<'setPace'> = ({ s }, a) => {
  const e = s.employees.find((x) => x.id === a.employeeId)
  if (!e) return 'notFound'
  if (!effortOn(s)) return 'notUnlocked'
  if (!(PACES as readonly string[]).includes(a.pace) || e.status === 'leaving') return 'invalid'
  e.pace = a.pace
  delete e.autoCalm
  return null
}

/**
 * A SPRINT_DAYS push on a project with work left (unfinished or a module build open): its non-calm builders work
 * × SPRINT_OUTPUT and tire SPRINT_FATIGUE a day; SPRINT_COOLDOWN_DAYS before the next; from TECH_DEBT_MIN_STAGE debt per
 * engineer. on:false ends it early (the cooldown stays). Never counts as a crunch (counters.crunches).
 */
const sprint: Handler<'sprint'> = ({ s }, a) => {
  const p = s.projects.find((x) => x.id === a.projectId)
  if (!p) return 'notFound'
  if (!effortOn(s)) return 'notUnlocked'
  const day = s.time.day
  if (!a.on) {
    if (!isSprinting(p, day)) return 'invalid'
    p.sprintUntil = day
    return null
  }
  const builders = buildersOf(s, p)
  if (!hasOpenWork(p) || builders.length === 0 || isSprinting(p, day)) return 'invalid'
  if (day < (p.sprintReadyDay ?? -Infinity)) return 'cooldown'
  // Whole days: the sprint (and below the leave) covers exactly SPRINT_DAYS daily ticks, whatever the hour it starts.
  p.sprintUntil = Math.floor(day) + B.SPRINT_DAYS + 1
  p.sprintReadyDay = p.sprintUntil + B.SPRINT_COOLDOWN_DAYS
  if (s.stage >= B.TECH_DEBT_MIN_STAGE) s.techDebt += B.SPRINT_DEBT_PER_ENG * builders.filter((e) => e.dept === 'eng').length
  pushActivity(s, 'sprintStarted', { project: p.name, id: p.id })
  return null
}

/** LEAVE_DAYS off (status 'break'): no output, out of the project's supply, fatigue − LEAVE_RECOVERY_PER_DAY a day. */
const giveLeave: Handler<'giveLeave'> = ({ s }, a) => {
  const e = s.employees.find((x) => x.id === a.employeeId)
  if (!e) return 'notFound'
  if (!effortOn(s)) return 'notUnlocked'
  const day = s.time.day
  if (e.status === 'leaving' || e.status === 'onboarding' || onLeave(e, day)) return 'invalid'
  if (day < (e.leaveReadyDay ?? -Infinity)) return 'cooldown'
  e.offUntil = Math.floor(day) + B.LEAVE_DAYS + 1
  e.leaveReadyDay = day + B.LEAVE_COOLDOWN_DAYS
  e.burnoutDays = 0
  delete e.ackDay
  e.status = 'break'
  e.statusSinceDay = day
  return null
}

/** The old lead steps down with DEMOTE_MORALE (the raise stays). */
function demote(s: GameState, id: string | undefined): void {
  const old = id !== undefined ? s.employees.find((x) => x.id === id) : undefined
  if (old) old.morale = Math.max(0, Math.min(100, old.morale + B.DEMOTE_MORALE))
}

/**
 * From Seed, optional: any builder of a project with LEAD_MIN_TEAM+ builders leads it. The first promotion ever pays
 * × LEAD_SALARY_FACTOR for good; the lead makes × LEAD_OWN_OUTPUT, the members tire less, bore less and get calmed.
 */
const setLead: Handler<'setLead'> = ({ s }, a) => {
  if (s.stage < B.LEAD_MIN_STAGE) return 'notUnlocked'
  const p = s.projects.find((x) => x.id === a.projectId)
  if (!p) return 'notFound'
  if (a.employeeId === null) {
    if (p.leadId === undefined) return null
    demote(s, p.leadId)
    delete p.leadId
    return null
  }
  const e: Employee | undefined = s.employees.find((x) => x.id === a.employeeId)
  if (!e) return 'notFound'
  if (!p.assignedIds.includes(e.id) || !isBuilder(e) || e.status === 'onboarding' || e.status === 'leaving') return 'invalid'
  if (buildersOf(s, p).length < B.LEAD_MIN_TEAM) return 'invalid'
  if (p.leadId === e.id) return null
  demote(s, p.leadId)
  p.leadId = e.id
  if (!e.wasLead) {
    e.salary = Math.round(e.salary * B.LEAD_SALARY_FACTOR)
    e.wasLead = true
  }
  pushActivity(s, 'leadSet', { name: e.name, id: e.id, project: p.name })
  return null
}

/** Silences someone's tired / bored bubble for STAFF_ACK_DAYS (burnout and leaving still ask). */
const ackStaff: Handler<'ackStaff'> = ({ s }, a) => {
  const e = s.employees.find((x) => x.id === a.employeeId)
  if (!e) return 'notFound'
  e.ackDay = s.time.day
  return null
}

// ---------------------------------------------------------------------------
// Office
// ---------------------------------------------------------------------------

/** The dept a desk item works for (its deptBonus): the desk's team label. */
function deskTeam(item: FurnitureItem): Dept | undefined {
  const bonus = item.slotType === 'desk' ? item.effects.deptBonus : undefined
  return bonus ? DEPTS.find((d) => (bonus[d] ?? 0) > 0) : undefined
}

const placeItem: Handler<'placeItem'> = ({ s, content }, a) => {
  const item = furnitureById(content, a.itemId)
  if (!item) return 'notFound'
  if (item.stageUnlock > s.stage) return 'notUnlocked'
  const spec = placementSpec(item)
  const team = deskTeam(item)
  let slot: Slot
  if (a.slotId !== undefined) {
    const at = findSlot(s.office, a.slotId)
    if (!at) return 'notFound'
    if (at.id === FOUNDER_SLOT_ID) return 'invalid'
    if (!isRingUnlocked(s.office, at.ring)) return 'slotLocked'
    if (at.type !== item.slotType) return 'wrongSlotType'
    const covered = coveredCells(s.office)
    if (at.itemId !== undefined || at.spanOf !== undefined || covered.has(cellKey(at.pos.x, at.pos.z))) return 'slotOccupied'
    const partner = item.size === 2 ? findPartnerSlot(s.office, at) : undefined
    if (item.size === 2 && (!partner || covered.has(cellKey(partner.pos.x, partner.pos.z)))) return 'noFreeSlot'
    if (typeUse(s.office)[spec.slotType] + spec.size > typeCaps(s.office)[spec.slotType]) return 'officeFull'
    if (s.stats.cash < item.price) return 'insufficientCash'
    at.itemId = item.id
    if (partner) {
      partner.itemId = item.id
      partner.spanOf = at.id
    }
    const check = validateLayout(s.office)
    if (!check.ok) return refusalError(check.reason!)
    slot = at
  } else {
    // No slot given: buy → auto place (grid §3: today's nearest-the-center slot, a dept desk near its team).
    const place = autoPlace(s.office, spec, team !== undefined ? { team } : {})
    if (!place) return 'noFreeSlot'
    if (s.stats.cash < item.price) return 'insufficientCash'
    storeDecor(s.office, place.bumped)
    slot = putItem(s.office, place, item.id, spec)
  }
  boughtOn(s, item, slot)
  return null
}

/**
 * The bill and the effects of an item just written onto `slot` (placeItem and the F6 auto-desk hire share it, so
 * the scene's furniture pop fires for both): cash, the desk's team label, reputation, tools, the activity line.
 */
function boughtOn(s: GameState, item: FurnitureItem, slot: Slot): void {
  s.stats.cash -= item.price
  const team = deskTeam(item)
  if (team !== undefined && slot.team === undefined) slot.team = team
  if (item.effects.reputation !== undefined) s.stats.reputation = Math.min(100, s.stats.reputation + item.effects.reputation)
  if (item.effects.enablesTool) unlockTool(s, item.effects.enablesTool)
  pushActivity(s, 'itemPlaced', { item: item.id, slot: slot.id })
  pushEvent(s, { kind: 'itemPlaced', refId: slot.id })
}

/** Empties an item's slots, team label included (a canonical slot gets its rotation back, free slots go). */
function clearItem(s: GameState, anchor: Slot): void {
  liftItem(s.office, s.office.slots.filter((x) => x.id === anchor.id || x.spanOf === anchor.id))
  dropEmptyFreeSlots(s.office)
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
  // Free grid (PC edit mode): any valid cell, through the same path as a committed layout.
  if (a.toCell !== undefined) {
    const res = applySnapshot(s.office, { slots: { [from.id]: a.toCell }, decor: s.office.decor ?? [] })
    if ('error' in res) return res.error
    s.office = res.office
    syncSeats(s)
    const to = s.office.slots.find((x) => x.pos.x === a.toCell!.x && x.pos.z === a.toCell!.z && x.itemId === item.id && x.spanOf === undefined)
    pushActivity(s, 'itemMoved', { item: item.id, from: from.id, to: to?.id ?? from.id })
    pushEvent(s, { kind: 'itemMoved', refId: to?.id ?? from.id })
    return null
  }
  if (a.toSlotId === undefined) return 'invalid'
  const to = findSlot(s.office, a.toSlotId)
  if (!to) return 'notFound'
  if (to.id === from.id) return null
  if (to.id === FOUNDER_SLOT_ID) return 'invalid'
  if (!isRingUnlocked(s.office, to.ring)) return 'slotLocked'
  if (to.type !== item.slotType) return 'wrongSlotType'
  const ownIds = s.office.slots.filter((x) => x.id === from.id || x.spanOf === from.id).map((x) => x.id)
  if ((to.itemId !== undefined && !ownIds.includes(to.id)) || (to.occupantId !== undefined && to.occupantId !== from.occupantId)) return 'slotOccupied'
  // A canonical slot under a moved piece or decor is hidden.
  const ownCells = new Set(s.office.slots.filter((x) => ownIds.includes(x.id)).map((x) => cellKey(x.pos.x, x.pos.z)))
  const covered = coveredCells(s.office)
  const hidden = (x: Slot) => covered.has(cellKey(x.pos.x, x.pos.z)) && !ownCells.has(cellKey(x.pos.x, x.pos.z))
  if (hidden(to)) return 'slotOccupied'
  const partner = item.size === 2 ? findPartnerSlot(s.office, to, ownIds) : undefined
  if (item.size === 2 && (!partner || hidden(partner))) return 'noFreeSlot'
  const occupant = from.occupantId
  const team = from.team
  clearItem(s, from)
  if (team !== undefined) to.team = team
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
  const check = validateLayout(s.office)
  if (!check.ok) return refusalError(check.reason!)
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
  const cost = upgradeCost(cur, next)
  if (s.stats.cash < cost) return 'insufficientCash'
  s.stats.cash -= cost
  for (const x of s.office.slots) if (x.id === anchor.id || x.spanOf === anchor.id) x.itemId = next.id
  if (next.effects.enablesTool) unlockTool(s, next.effects.enablesTool)
  pushActivity(s, 'itemPlaced', { item: next.id, slot: anchor.id })
  pushEvent(s, { kind: 'itemPlaced', refId: anchor.id })
  return null
}

/** Commits an edited layout (grid §4): one validated, atomic step; seats follow their desks. */
const applyLayout: Handler<'applyLayout'> = ({ s, content }, a) => {
  const res = applySnapshot(s.office, a.draft)
  if ('error' in res) return res.error
  // New decor and items bought in the draft are paid on Bitti, all at once (moving is free); short of cash, nothing changes.
  const items = res.bought.map((b) => ({ b, item: furnitureById(content, b.itemId) }))
  if (items.some((x) => !x.item)) return 'notFound'
  if (res.cost + items.reduce((n, x) => n + x.item!.price, 0) > s.stats.cash) return 'insufficientCash'
  s.stats.cash -= res.cost
  s.office = res.office
  // Each bought item as if bought in the shop: its price, its team label, reputation, tools, the activity line.
  for (const { b, item } of items) boughtOn(s, item!, findSlot(s.office, b.slotId)!)
  syncSeats(s)
  return null
}

/** Saves the edit draft as a named layout (grid step 6): free, outside the draft, so Vazgeç keeps it. */
const saveLayout: Handler<'saveLayout'> = ({ s }, a) => {
  const name = cleanLayoutName(a.name ?? '')
  if (!name) return 'invalid'
  const res = previewSnapshot(s.office, a.draft)
  if ('error' in res) return res.error
  if (!res.check.ok) return refusalError(res.check.reason!)
  const saved = (s.office.saved ??= [])
  const layout = captureLayout(res.office, name)
  if (a.replace !== undefined) {
    if (!Number.isInteger(a.replace) || !saved[a.replace]) return 'notFound'
    saved[a.replace] = layout
    return null
  }
  if (saved.length >= SAVED_LAYOUT_MAX) return 'officeFull'
  saved.push(layout)
  return null
}

const deleteLayout: Handler<'deleteLayout'> = ({ s }, a) => {
  const saved = s.office.saved ?? []
  if (!Number.isInteger(a.index) || !saved[a.index]) return 'notFound'
  saved.splice(a.index, 1)
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
    releaseLevel: 0,
    createdDay: s.time.day,
    assignedIds: [] as string[],
  }
  // Builders on no project (onboarding hires too) join the new one; finished projects keep theirs for updates.
  for (const id of idleBuilders(s, true)) {
    const e = s.employees.find((x) => x.id === id)!
    e.projectId = p.id
    p.assignedIds.push(e.id)
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
  for (const p of s.projects) {
    p.assignedIds = p.assignedIds.filter((x) => x !== e.id)
    // A lead who leaves the project leaves the lead behind (E1).
    if (p.leadId === e.id && p !== target) delete p.leadId
  }
  if (target) {
    target.assignedIds.push(e.id)
    e.projectId = target.id
  } else {
    delete e.projectId
  }
  return null
}

/**
 * Starts a module (W2a) on a live, finished project: its cash now and one move (MODULE_ENERGY in the garage); the
 * project's builders then fill the build instead of the next update (tick.progressProjects), one build at a time.
 */
const buildModule: Handler<'buildModule'> = ({ s }, a) => startModule(s, a.projectId, a.moduleId, false)

/** Rebuilds an installed module for MODULE_REFRESH_SHARE of its cash and work: its staleness starts over; no slot needed. */
const refreshModule: Handler<'refreshModule'> = ({ s }, a) => startModule(s, a.projectId, a.moduleId, true)

function startModule(s: GameState, projectId: string, moduleId: string, refresh: boolean): ActionErrorCode | null {
  const p = s.projects.find((x) => x.id === projectId)
  if (!p) return 'notFound'
  if (!isModuleId(moduleId)) return refresh ? 'notFound' : 'invalid'
  const err = moduleError(s, p, moduleId, refresh)
  if (err) return err
  const def = moduleDef(moduleId)!
  s.stats.cash -= moduleCost(s, def, refresh)
  s.founder.energy -= actionEnergy(s, B.MODULE_ENERGY)
  spendMoves(s, refresh ? B.MOVE_COST.refreshModule : B.MOVE_COST.buildModule)
  p.build = { id: moduleId, progress: 0, startDay: s.time.day, ...(refresh ? { refresh: true as const } : {}) }
  // The desk bubble asks once per version (a new module; MV2a, was per stage) and once per age of an installed one:
  // any build answers it.
  const installed = p.modules?.find((m) => m.id === moduleId)
  if (refresh && installed) s.flags[moduleStaleFlag(p.id, moduleId)] = installed.day
  else s.flags[modulePromptFlag(p.id)] = projectVersion(p)
  pushActivity(s, 'moduleStarted', { project: p.name, id: p.id, module: moduleId, refresh: refresh ? 1 : 0 })
  return null
}

/** Drops the running build: its progress is lost, nothing comes back (cash or move). */
const cancelModule: Handler<'cancelModule'> = ({ s }, a) => {
  const p = s.projects.find((x) => x.id === a.projectId)
  if (!p?.build) return 'notFound'
  delete p.build
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

/** W3: the one ad budget promotes this launched product (null = the whole company). A change starts the CAC warm-up; no move. */
const setAdFocus: Handler<'setAdFocus'> = ({ s }, a) => {
  if (!s.unlockedTools.includes('adBudget')) return 'notUnlocked'
  const p = a.projectId === null ? undefined : s.projects.find((x) => x.id === a.projectId)
  if (a.projectId !== null) {
    if (!p) return 'notFound'
    if (!p.launched) return 'notUnlocked'
  }
  if ((s.finance.adFocus ?? null) === a.projectId) return null
  if (p) s.finance.adFocus = p.id
  else delete s.finance.adFocus
  s.finance.adFocusDay = s.time.day
  pushActivity(s, 'adFocusChanged', { project: p?.name ?? 'Şirket', id: p?.id ?? '' })
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

/** An answer can sell the company (acquisition-offer, GAMEPLAY V2 §8.2): the run ends with the click. */
const answerDecisionH: Handler<'answerDecision'> = ({ s, content }, a) => {
  const err = answerDecision(s, content, a.cardId, a.optionIndex)
  if (err) return err
  checkSale(s)
  return null
}

const startRoundH: Handler<'startRound'> = ({ s, rng, content }, a) => startRound(s, rng, starsOfStage(s, content, s.stage), a.size ?? 'target', a.down === true)

const roundPitchH: Handler<'roundPitch'> = ({ s, rng }, a) => roundPitch(s, a.pitch, rng)

/** GAMEPLAY V2 §6.1: the payday desk's answer; nothing waits on the desk → notFound. */
const resolvePaydayH: Handler<'resolvePayday'> = ({ s, content }, a) => {
  if (!s.finance.pendingPayday) return 'notFound'
  if (!isPaydayChoice(a.choice)) return 'invalid'
  resolvePayday(s, content, a.choice)
  pushEvent(s, { kind: 'paydayResolved', value: s.finance.deferred ?? 0 })
  return null
}

// ---------------------------------------------------------------------------
// Company policies (GAMEPLAY V2 §7.2)
// ---------------------------------------------------------------------------

/**
 * Why a policy cannot be signed now, or null: 'invalid' (unknown, already signed, or closed by a signed one),
 * 'notUnlocked' (before POLICY_MIN_STAGE, its lock holds, or a payLater one with no round ahead), 'cooldown' (POLICY_SIGN_COOLDOWN_DAYS since the last),
 * 'noMoves' (one move, §7.1). Pure: the lawbook's button and the action use the same answer.
 */
export function policyError(s: GameState, content: EngineContent, id: PolicyId): ActionErrorCode | null {
  const policy = (POLICY_IDS as readonly string[]).includes(id) ? content.policies?.find((p) => p.id === id) : undefined
  if (!policy) return 'invalid'
  const adopted = s.policies?.adopted ?? []
  if (adopted.includes(id) || policy.excludes?.some((x) => adopted.includes(x))) return 'invalid'
  if (content.policies?.some((p) => adopted.includes(p.id) && p.excludes?.includes(id))) return 'invalid'
  if (s.stage < B.POLICY_MIN_STAGE || (policy.effect.payLater && !payLaterOpen(s))) return 'notUnlocked'
  let open = false
  try {
    open = policy.unlock(s) === true
  } catch {
    open = false
  }
  if (!open) return 'notUnlocked'
  if (s.time.day < (s.policies?.lastSignedDay ?? B.POLICY_NEVER_SIGNED) + B.POLICY_SIGN_COOLDOWN_DAYS) return 'cooldown'
  return movesError(s, B.MOVE_COST.adoptPolicy)
}

/**
 * Signs a policy, for good: it joins the multipliers at once (derive), a survival one marks every later round's equity
 * and the radar's team axis; layoff-round lets its share of the team go, onSign effects land, flagDay is stamped.
 */
const adoptPolicyH: Handler<'adoptPolicy'> = ({ s, content }, a) => {
  const err = policyError(s, content, a.policyId)
  if (err) return err
  const policy = content.policies!.find((p) => p.id === a.policyId)!
  const book = policiesOf(s)
  book.adopted.push(policy.id)
  book.lastSignedDay = s.time.day
  if (policy.tree === 'survival') book.survival = (book.survival ?? 0) + 1
  spendMoves(s, B.MOVE_COST.adoptPolicy)
  const fx = policy.effect
  if (fx.flagDay) s.flags[fx.flagDay] = Math.floor(s.time.day)
  if (fx.layoff) layoff(s, content, fx.layoff)
  if (fx.onSign) applyEffects(s, content, fx.onSign, `policy:${policy.id}`)
  pushEvent(s, { kind: 'policyAdopted', refId: policy.id })
  return null
}

// ---------------------------------------------------------------------------
// Market (GAMEPLAY V2 §8.1–8.2)
// ---------------------------------------------------------------------------

/** Opens a segment: its cost now, one move, upkeep monthly; it ramps into the TAM over MARKET_RAMP_DAYS. */
const openSegmentH: Handler<'openSegment'> = ({ s }, a) => {
  const err = segmentError(s, a.id)
  if (err) return err
  openSegment(s, a.id)
  return null
}

/** Buys a rival (Series B on): its price now, two moves; its users come over, the merger costs debt and morale. */
const acquireRivalH: Handler<'acquireRival'> = ({ s }, a) => {
  if (typeof a.id !== 'string') return 'invalid'
  const err = acquireError(s, a.id)
  if (err) return err
  acquireRival(s, a.id)
  return null
}

// ---------------------------------------------------------------------------
// Contract renewal (GAMEPLAY V2 §8.4)
// ---------------------------------------------------------------------------

/** Answers a contract's renewal: one move; 'hold' is a chance at more, 'discount' a sure thing for less. */
const renewContractH: Handler<'renewContract'> = ({ s, rng }, a) => {
  if (typeof a.id !== 'string' || !(RENEW_OFFERS as readonly string[]).includes(a.offer)) return 'invalid'
  const err = renewError(s, a.id)
  if (err) return err
  renewContract(s, a.id, a.offer, rng)
  return null
}

/** Renames a project: free and any time, no moves. Cleaned (spaces, URL/profanity rules of the company name), capped, unique. */
const renameProject: Handler<'renameProject'> = ({ s }, a) => {
  const p = s.projects.find((x) => x.id === a.projectId)
  if (!p) return 'notFound'
  if (typeof a.name !== 'string') return 'invalid'
  const name = Array.from(a.name.replace(/\s+/g, ' ').trim()).slice(0, B.PROJECT_NAME_MAX).join('').trim()
  if (!checkName(name, B.PROJECT_NAME_MIN, B.PROJECT_NAME_MAX).ok) return 'invalid'
  if (s.projects.some((x) => x.id !== p.id && nameKey(x.name) === nameKey(name))) return 'invalid'
  if (name === p.name) return null
  pushActivity(s, 'projectRenamed', { from: p.name, to: name })
  p.name = name
  return null
}

const HANDLERS: { [K in Action['type']]: Handler<K> } = {
  hire,
  fire,
  renameProject,
  assignDesk,
  respondResignation,
  refreshCandidates,
  setPace,
  sprint,
  giveLeave,
  setLead,
  ackStaff,
  placeItem,
  sellItem,
  moveItem,
  applyLayout,
  saveLayout,
  deleteLayout,
  upgradeItem,
  openRing,
  startProject,
  assign,
  buildModule,
  refreshModule,
  cancelModule,
  founderAction,
  setSpeed,
  setAdBudget,
  setAdFocus,
  setPrice,
  openConcept,
  minimizeConcept: minimizeConceptH,
  answerDecision: answerDecisionH,
  startRound: startRoundH,
  roundPitch: roundPitchH,
  resolvePayday: resolvePaydayH,
  adoptPolicy: adoptPolicyH,
  openSegment: openSegmentH,
  acquireRival: acquireRivalH,
  renewContract: renewContractH,
}
