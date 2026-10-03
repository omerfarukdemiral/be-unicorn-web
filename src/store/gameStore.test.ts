// Integration: store ⇄ engine ⇄ content. M2/M3 chain: hire → desk → sit & work → project → users; 10 min in the garage.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CONCEPTS, CONTENT, FURNITURE, NPC_TEXT, TEASERS } from '../content'
import { balance, createGame } from '../engine'
import { promoteConcept } from '../engine/concepts'
import { winRun } from '../engine/endgame'
import { pushStageReport } from '../engine/round'
import { CONCEPT_IDS, FIXED_STEP_DAYS, FOUNDER_SLOT_ID, INITIAL_WIDGETS, SECONDS_PER_DAY } from '../engine/types'
import type { GameEvent, GameState, HorizonItem, HudWidget, StageIndex, StageReport } from '../engine/types'
import { castName, npcLabel, speakerName } from '../ui/bubbles/speaker'
import { horizonItemText, horizonKindOf } from '../ui/Horizon'
import { t } from '../ui/i18n'
import { admit, dailyBudget } from '../ui/layout/stripRules'
import { rivalPassedItems } from '../ui/layout/NotificationStrip'
import { NotebookCard } from '../ui/NotebookCard'
import { MoveSceneOverlay, VictoryOverlay } from '../ui/overlays/Overlays'
import { JournalPanel } from '../ui/panels/JournalPanel'
import { autoPin, effectivePins, PIN_MAX, pinEvictee, unseenMetrics } from './metricPins'
import { CODEX_KEY, readCodex, readUiSave, UI_KEY, writeCodex } from './save'
import {
  achievementsBadge,
  blockingOverlay,
  codexAfter,
  codexCount,
  effectiveSpeed,
  hasImportantMoment,
  hasInterrupt,
  IMPORTANT_EVENT_KINDS,
  offerWaiting,
  panelSelection,
  pauseReasonsOf,
  PAYDAY_SLOW_RUNWAY_MONTHS,
  useGameStore,
  waitingConcepts,
} from './gameStore'
import type { Overlay } from './types'

const store = () => useGameStore.getState()

/** Plays `seconds` of real time at the current speed in 60 fps frames; the "player" opens concepts from the badge. */
function play(seconds: number, onDay?: (day: number) => void) {
  const frames = Math.round(seconds * 60)
  let lastDay = -1
  for (let i = 0; i < frames; i++) {
    store().tick(1 / 60)
    const s = store().state
    if (s.gameOver) return
    for (const id of waitingConcepts(s)) store().dispatch({ type: 'openConcept', conceptId: id })
    const day = Math.floor(s.time.day)
    if (day !== lastDay) {
      lastDay = day
      onDay?.(day)
    }
  }
}

describe('gameStore (engine wired)', () => {
  beforeEach(() => {
    store().newGame({ seed: 7, founderXp: 0, runIndex: 0 })
    store().dispatch({ type: 'setSpeed', speed: 1 }) // runs start paused: press Başlat
  })

  it('starts a real engine game in the garage', () => {
    const s = store().state
    expect(s.stage).toBe(0)
    expect(s.candidates.length).toBeGreaterThan(0)
    expect(s.office.slots.some((x) => x.id === FOUNDER_SLOT_ID)).toBe(true)
  })

  it('invalid actions keep the state and set ui.lastError', () => {
    const before = store().state
    const res = store().dispatch({ type: 'placeItem', itemId: 'nope', slotId: 'nope' })
    expect(res.ok).toBe(false)
    expect(store().state).toBe(before)
    expect(store().ui.lastError?.code).toBe(res.error)
  })

  it('tick advances in fixed steps scaled by speed and pauses at 0', () => {
    store().tick(SECONDS_PER_DAY) // 1 day @1x
    expect(store().state.time.day).toBeCloseTo(1, 6)
    store().dispatch({ type: 'setSpeed', speed: 4 })
    store().tick(SECONDS_PER_DAY / 2) // 2 days @4x
    expect(store().state.time.day).toBeCloseTo(3, 6)
    store().tick((FIXED_STEP_DAYS * SECONDS_PER_DAY) / 8) // half a chunk: carried, not stepped
    expect(store().state.time.day).toBeCloseTo(3, 6)
    store().tick((FIXED_STEP_DAYS * SECONDS_PER_DAY) / 8)
    expect(store().state.time.day).toBeCloseTo(3 + FIXED_STEP_DAYS, 6)
    store().dispatch({ type: 'setSpeed', speed: 0 })
    const s = store().state
    store().tick(5)
    expect(store().state).toBe(s)
  })

  it('hire → place desk → seated employee works on a project and users arrive', () => {
    const desk = FURNITURE.find((f) => f.slotType === 'desk' && f.stageUnlock === 0)
    expect(desk).toBeDefined()
    const slot = store().state.office.slots.find((x) => x.type === 'desk' && x.id !== FOUNDER_SLOT_ID && !x.itemId)!
    expect(store().dispatch({ type: 'placeItem', itemId: desk!.id, slotId: slot.id }).ok).toBe(true)

    const eng = store().state.candidates.find((c) => c.dept === 'eng') ?? store().state.candidates[0]!
    expect(store().dispatch({ type: 'hire', candidateId: eng.id }).ok).toBe(true)
    const emp = store().state.employees[0]!
    expect(emp.deskSlotId).toBe(slot.id)
    expect(store().state.office.slots.find((x) => x.id === slot.id)?.occupantId).toBe(emp.id)

    expect(store().dispatch({ type: 'startProject', category: 'web', name: 'Pusula' }).ok).toBe(true)
    const project = store().state.projects[0]!
    expect(project.name).toBe('Pusula')
    store().dispatch({ type: 'assign', employeeId: emp.id, projectId: project.id })
    store().dispatch({ type: 'founderAction', kind: 'findUsers' })

    play(60)
    const s = store().state
    expect(s.gameOver).toBeUndefined()
    expect(s.projects[0]!.maturity).toBeGreaterThan(project.maturity)
    expect(s.stats.users).toBeGreaterThan(0)
    expect(s.activity.some((a) => a.kind === 'hired')).toBe(true)
  })

  it('a casual garage player survives 10 minutes, learns concepts, and the HUD grows', () => {
    const startWidgets = store().state.unlockedWidgets.length
    const desk = FURNITURE.find((f) => f.slotType === 'desk' && f.stageUnlock === 0)!
    const free = () => store().state.office.slots.find((x) => x.type === 'desk' && x.id !== FOUNDER_SLOT_ID && !x.itemId)
    const s0 = free()!
    store().dispatch({ type: 'placeItem', itemId: desk.id, slotId: s0.id })
    const cand = store().state.candidates.find((c) => c.dept === 'eng') ?? store().state.candidates[0]!
    store().dispatch({ type: 'hire', candidateId: cand.id })
    store().dispatch({ type: 'startProject', category: 'web', name: 'Pusula' })
    const pid = store().state.projects[0]!.id
    store().dispatch({ type: 'assign', employeeId: store().state.employees[0]!.id, projectId: pid })

    let learnedAt5 = 0
    play(600, (day) => {
      const st = store().state
      // Keep the founder busy like a player would.
      if (!st.founder.currentAction) {
        const kind = st.projects.some((p) => p.launched) && day % 2 === 0 ? 'talkToUsers' : 'findUsers'
        store().dispatch({ type: 'founderAction', kind, targetId: pid })
      }
      // Answer decision cards with the first option.
      const card = st.decisions.active
      if (card) store().dispatch({ type: 'answerDecision', cardId: card.cardId, optionIndex: 0 })
      if (day === 150) learnedAt5 = st.concepts.learned.length
    })
    const s = store().state
    expect(s.gameOver).toBeUndefined()
    expect(s.time.day).toBeGreaterThan(290)
    expect(learnedAt5).toBeGreaterThanOrEqual(3)
    expect(s.concepts.learned).toContain('runway')
    expect(s.unlockedWidgets.length).toBeGreaterThan(startWidgets)
    expect(store().exportReplay().actions.length).toBeGreaterThan(5)
  })
})

describe('single panel (ui)', () => {
  beforeEach(() => store().newGame({ seed: 7, founderXp: 0, runIndex: 0 }))

  it('dock tabs replace each other and toggle closed', () => {
    store().togglePanel('shop')
    expect(store().ui.panel).toEqual({ kind: 'shop' })
    store().togglePanel('journal')
    expect(store().ui.panel).toEqual({ kind: 'journal' })
    expect(store().ui.panelBack).toBeNull()
    store().togglePanel('journal')
    expect(store().ui.panel).toBeNull()
  })

  it('an empty slot opens the shop targeted at it; a filled slot opens its detail with back', () => {
    const slot = store().state.office.slots.find((x) => x.ring === 1 && !x.itemId)!
    store().togglePanel('team')
    store().select({ kind: 'slot', id: slot.id })
    expect(store().ui.panel).toEqual({ kind: 'shop', slotTarget: slot.id })
    expect(panelSelection(store().ui.panel)).toEqual({ kind: 'slot', id: slot.id })
    expect(store().ui.panelBack).toEqual({ kind: 'team' })
    store().panelGoBack()
    expect(store().ui.panel).toEqual({ kind: 'team' })

    const desk = FURNITURE.find((f) => f.slotType === slot.type && f.stageUnlock === 0 && f.size === 1)!
    expect(store().dispatch({ type: 'placeItem', itemId: desk.id }).ok).toBe(true)
    const filled = store().state.office.slots.find((x) => x.itemId === desk.id)!
    store().select({ kind: 'slot', id: filled.id })
    expect(store().ui.panel).toEqual({ kind: 'detail', selection: { kind: 'slot', id: filled.id } })
    // Empty floor acts like back: the Ekip tab it came from stays open; from a root detail it closes.
    store().select(null)
    expect(store().ui.panel).toEqual({ kind: 'team' })
    store().closePanel()
    store().select({ kind: 'slot', id: filled.id })
    store().select(null)
    expect(store().ui.panel).toBeNull()
  })

  const basic = (type: string) => FURNITURE.find((f) => f.slotType === type && f.stageUnlock === 0 && f.size === 1)!

  it('a targeted buy (slotId) fills exactly the tapped slot', () => {
    const office = store().state.office
    // Pick the ring-1 desk slot farthest from the auto choice so the two differ.
    const target = office.slots.filter((x) => x.ring === 1 && x.type === 'desk' && !x.itemId).at(-1)!
    store().select({ kind: 'slot', id: target.id })
    expect(store().ui.panel).toEqual({ kind: 'shop', slotTarget: target.id })
    expect(store().dispatch({ type: 'placeItem', itemId: basic('desk').id, slotId: target.id }).ok).toBe(true)
    expect(store().state.office.slots.find((x) => x.id === target.id)?.itemId).toBe(basic('desk').id)
  })

  it('selling the item of an open slot detail switches to the shop targeted at that slot', () => {
    expect(store().dispatch({ type: 'placeItem', itemId: basic('desk').id }).ok).toBe(true)
    const slot = store().state.office.slots.find((x) => x.itemId === basic('desk').id)!
    store().togglePanel('shop')
    store().select({ kind: 'slot', id: slot.id })
    expect(store().dispatch({ type: 'sellItem', slotId: slot.id }).ok).toBe(true)
    expect(store().ui.panel).toEqual({ kind: 'shop', slotTarget: slot.id })
    // History is kept: back still returns to the plain shop.
    expect(store().ui.panelBack).toEqual({ kind: 'shop' })
  })

  it('moving the item of an open slot detail follows it to the new slot', () => {
    expect(store().dispatch({ type: 'placeItem', itemId: basic('desk').id }).ok).toBe(true)
    const from = store().state.office.slots.find((x) => x.itemId === basic('desk').id)!
    const to = store().state.office.slots.find((x) => x.ring === 1 && x.type === 'desk' && !x.itemId)!
    store().select({ kind: 'slot', id: from.id })
    store().setPlacing({ kind: 'move', fromSlotId: from.id })
    expect(store().dispatch({ type: 'moveItem', fromSlotId: from.id, toSlotId: to.id }).ok).toBe(true)
    expect(store().ui.panel).toEqual({ kind: 'detail', selection: { kind: 'slot', id: to.id } })
  })
})

describe('time: paused start and focus pauses', () => {
  beforeEach(() => store().newGame({ seed: 7, founderXp: 0, runIndex: 0 }))

  const speedSets = () => store().exportReplay().actions.filter((a) => a.action.type === 'setSpeed')
  /** Puts a real decision card on screen (engine picks one; forcing it keeps the test independent of timing). */
  function withDecision(): string {
    const st = store().state
    const cardId = st.decisions.active?.cardId ?? 'remote-vs-office'
    if (!st.decisions.active) useGameStore.setState({ state: { ...st, decisions: { ...st.decisions, active: { cardId, shownDay: st.time.day } } } })
    return cardId
  }

  it('a new game starts paused, not started; time does not flow until Başlat', () => {
    expect(store().state.time.speed).toBe(0)
    expect(store().ui.runStarted).toBe(false)
    store().tick(SECONDS_PER_DAY * 3)
    expect(store().state.time.day).toBe(0)
    store().dispatch({ type: 'setSpeed', speed: 1 })
    expect(store().ui.runStarted).toBe(true)
    store().tick(SECONDS_PER_DAY)
    expect(store().state.time.day).toBeCloseTo(1, 6)
  })

  it('continue (load) starts paused too', () => {
    const mem = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) })
    store().dispatch({ type: 'setSpeed', speed: 2 })
    store().tick(SECONDS_PER_DAY)
    store().save()
    expect(store().load()).toBe(true)
    expect(store().state.time.speed).toBe(0)
    expect(store().ui.runStarted).toBe(false)
    vi.unstubAllGlobals()
  })

  it('opening a decision card pauses; answering / closing resumes the previous speed', () => {
    store().dispatch({ type: 'setSpeed', speed: 2 })
    const cardId = withDecision()
    store().openPanel({ kind: 'decision', cardId })
    expect(store().ui.pauseReasons).toEqual(['decision'])
    expect(effectiveSpeed(store())).toBe(0)
    const day = store().state.time.day
    store().tick(SECONDS_PER_DAY * 2)
    expect(store().state.time.day).toBe(day)
    // The player's speed is untouched (saves keep it).
    expect(store().state.time.speed).toBe(2)
    // Answered → the reflection shows and time flows again at 2×.
    store().openPanel({ kind: 'decision', cardId, answered: 0 }, { replace: true })
    expect(store().ui.pauseReasons).toEqual([])
    expect(effectiveSpeed(store())).toBe(2)
    store().tick(SECONDS_PER_DAY / 2)
    expect(store().state.time.day).toBeCloseTo(day + 1, 6)
    // Plain close also resumes.
    store().openPanel({ kind: 'decision', cardId })
    expect(effectiveSpeed(store())).toBe(0)
    store().closePanel()
    expect(effectiveSpeed(store())).toBe(2)
  })

  it('a Defter (concept) card pauses; plain panels (shop, team, growth) do not', () => {
    store().dispatch({ type: 'setSpeed', speed: 1 })
    store().openPanel({ kind: 'journal', conceptId: 'runway' })
    expect(store().ui.pauseReasons).toEqual(['concept'])
    store().togglePanel('shop')
    expect(store().ui.pauseReasons).toEqual([])
    for (const tab of ['team', 'projects', 'growth', 'journal'] as const) {
      store().togglePanel(tab)
      expect(effectiveSpeed(store())).toBe(1)
    }
  })

  it('a blocking modal pauses through the same mechanism', () => {
    store().dispatch({ type: 'setSpeed', speed: 4 })
    store().openOverlay({ kind: 'moveScene' })
    expect(store().ui.pauseReasons).toEqual(['modal'])
    expect(effectiveSpeed(store())).toBe(0)
    store().closeOverlay()
    // "Yeni ofise geç": the new office opens paused with the Başlat call (docs/CORE_LOOP.md §3.2 rule 1).
    expect(store().ui.pauseReasons).toEqual([])
    expect(store().state.time.speed).toBe(0)
    expect(store().ui.runStarted).toBe(false)
    expect(effectiveSpeed(store())).toBe(0)
    store().dispatch({ type: 'setSpeed', speed: 1 })
    expect(store().ui.runStarted).toBe(true)
    expect(effectiveSpeed(store())).toBe(1)
  })

  it('a manual pause survives the focus pause: closing the card keeps it paused', () => {
    store().dispatch({ type: 'setSpeed', speed: 1 })
    const cardId = withDecision()
    store().openPanel({ kind: 'decision', cardId })
    store().dispatch({ type: 'setSpeed', speed: 0 }) // player pauses while reading
    store().closePanel()
    expect(store().ui.pauseReasons).toEqual([])
    expect(effectiveSpeed(store())).toBe(0)
  })

  it('focus pauses are never written to the replay log as setSpeed', () => {
    store().dispatch({ type: 'setSpeed', speed: 1 })
    expect(speedSets()).toHaveLength(1)
    const cardId = withDecision()
    store().openPanel({ kind: 'decision', cardId })
    store().closePanel()
    store().openPanel({ kind: 'journal', conceptId: 'runway' })
    store().closePanel()
    store().openOverlay({ kind: 'moveScene' })
    store().closeOverlay()
    // The settle-in pause after a move is not a player choice either: still one setSpeed in the log.
    expect(speedSets()).toHaveLength(1)
    expect(store().state.time.speed).toBe(0)
  })
})

describe('focus (CORE_LOOP phase 0)', () => {
  beforeEach(() => store().newGame({ seed: 7, founderXp: 0, runIndex: 0 }))

  function withDecision(): string {
    const st = store().state
    const cardId = st.decisions.active?.cardId ?? 'remote-vs-office'
    if (!st.decisions.active) useGameStore.setState({ state: { ...st, decisions: { ...st.decisions, active: { cardId, shownDay: st.time.day } } } })
    return cardId
  }
  /** Puts a triggered concept bubble on screen at the current day. */
  /** The engine's own promotion: the concept becomes active and its speaker walks in as a concept visitor. */
  function withConcept(id = 'runway' as const): string {
    const st = structuredClone(store().state)
    st.concepts.triggered.push(id)
    st.concepts.queue = [id]
    st.concepts.active = undefined
    promoteConcept(st, CONCEPTS, true)
    useGameStore.setState({ state: st })
    const v = st.visitors.find((x) => x.purpose === 'concept' && x.refId === id)
    if (!v) throw new Error('no concept visitor')
    return v.id
  }

  it('the expanded scene decision bubble pauses; collapsing it resumes the previous speed', () => {
    store().dispatch({ type: 'setSpeed', speed: 2 })
    withDecision()
    store().setDecisionExpanded(true)
    expect(store().ui.pauseReasons).toEqual(['decision'])
    expect(effectiveSpeed(store())).toBe(0)
    const day = store().state.time.day
    store().tick(SECONDS_PER_DAY * 3)
    expect(store().state.time.day).toBe(day)
    expect(store().state.time.speed).toBe(2) // never written as setSpeed
    store().setDecisionExpanded(false)
    expect(store().ui.pauseReasons).toEqual([])
    expect(effectiveSpeed(store())).toBe(2)
  })

  it('expanded bubble + the same card in the panel count as one decision pause', () => {
    store().dispatch({ type: 'setSpeed', speed: 1 })
    const cardId = withDecision()
    store().setDecisionExpanded(true)
    store().openPanel({ kind: 'decision', cardId })
    expect(store().ui.pauseReasons).toEqual(['decision'])
  })

  it('answering the card ends the expanded-bubble pause', () => {
    store().dispatch({ type: 'setSpeed', speed: 1 })
    const cardId = withDecision()
    store().setDecisionExpanded(true)
    expect(store().dispatch({ type: 'answerDecision', cardId, optionIndex: 0 }).ok).toBe(true)
    expect(store().ui.decisionExpanded).toBe(false)
    expect(effectiveSpeed(store())).toBe(1)
  })

  it('a new game clears the expanded flag and keeps the slow-on-moments preference', () => {
    withDecision()
    store().setDecisionExpanded(true)
    store().setSlowOnMoments(false)
    store().newGame({ seed: 8, founderXp: 0, runIndex: 0 })
    expect(store().ui.decisionExpanded).toBe(false)
    expect(store().ui.pauseReasons).toEqual([])
    expect(store().ui.slowOnMoments).toBe(false)
    store().setSlowOnMoments(true)
  })

  it('a concept goes straight to the Kazanımlar badge: no scene bubble, no pause; only the open card pauses', () => {
    const vid = withConcept()
    expect(achievementsBadge(store().state, [])).toBe(1)
    // Paused (start): nothing happens to it while time is still.
    store().tick(SECONDS_PER_DAY * 5)
    expect(store().state.concepts.active?.id).toBe('runway')
    store().dispatch({ type: 'setSpeed', speed: 1 })
    store().tick(SECONDS_PER_DAY)
    // Time keeps flowing; the visitor stands silently and the badge already counts the concept.
    expect(store().state.visitors.some((v) => v.id === vid)).toBe(true)
    expect(waitingConcepts(store().state)).toEqual(['runway'])
    expect(achievementsBadge(store().state, [])).toBe(1)
    expect(store().ui.pauseReasons).toEqual([])
    expect(effectiveSpeed(store())).toBe(1)
    // Once the visitor's stay is over the concept moves to the shelf (still on the badge).
    for (let d = 0; d < balance.CONCEPT_VISITOR_DAYS + 2; d++) store().tick(SECONDS_PER_DAY)
    expect(store().state.visitors.some((v) => v.id === vid)).toBe(false)
    expect(store().state.concepts.active?.id).not.toBe('runway')
    expect(store().state.concepts.minimized).toContain('runway')
    expect(waitingConcepts(store().state)).toContain('runway')
    // Recorded like any action: a replay reproduces it.
    expect(store().exportReplay().actions.some((a) => a.action.type === 'minimizeConcept')).toBe(true)
    // The Kazanımlar list alone never pauses; the card itself does, and only while open.
    store().openPanel({ kind: 'journal' }, { root: true })
    expect(store().ui.pauseReasons).toEqual([])
    store().openPanel({ kind: 'journal', conceptId: 'runway' })
    expect(store().ui.pauseReasons).toEqual(['concept'])
    store().openPanel({ kind: 'journal' }, { replace: true })
    expect(store().ui.pauseReasons).toEqual([])
    expect(effectiveSpeed(store())).toBe(1)
  })

  it('tapping the silent visitor who brought a concept opens its card (learned) and pauses while it is open', () => {
    const vid = withConcept()
    store().dispatch({ type: 'setSpeed', speed: 1 })
    // A few days at 1×: the visitor is still there to be tapped.
    store().tick(SECONDS_PER_DAY * 3)
    expect(store().state.visitors.some((v) => v.id === vid)).toBe(true)
    expect(store().ui.pauseReasons).toEqual([])
    store().select({ kind: 'visitor', id: vid })
    expect(store().ui.panel).toEqual({ kind: 'journal', conceptId: 'runway' })
    expect(store().state.concepts.learned).toContain('runway')
    expect(store().ui.pauseReasons).toEqual(['concept'])
    expect(achievementsBadge(store().state, [])).toBe(0)
    // Once learned the visitor is an ordinary one: tapping shows their detail.
    store().select({ kind: 'visitor', id: vid })
    expect(store().ui.panel?.kind).toBe('detail')
  })

  it('goals count on the badge until Kazanımlar marks them seen', () => {
    const st = store().state
    useGameStore.setState({ state: { ...st, goalsDone: ['g1', 'g2'] } })
    expect(achievementsBadge(store().state, store().ui.seenGoals)).toBe(2)
    store().markGoalsSeen()
    expect(store().ui.seenGoals).toEqual(['g1', 'g2'])
    expect(achievementsBadge(store().state, store().ui.seenGoals)).toBe(0)
    useGameStore.setState((x) => ({ state: { ...x.state, goalsDone: ['g1', 'g2', 'g3'] } }))
    expect(achievementsBadge(store().state, store().ui.seenGoals)).toBe(1)
    // A new run starts with nothing seen.
    store().newGame({ seed: 7, founderXp: 0, runIndex: 0 })
    expect(store().ui.seenGoals).toEqual([])
  })

  it('at 4× an important moment slows the run to 1× (not a pause); 2× is left alone', () => {
    store().dispatch({ type: 'setSpeed', speed: 4 })
    // Run until the engine shows a decision card (an important moment).
    for (let i = 0; i < 400 && !store().state.decisions.active; i++) store().tick(SECONDS_PER_DAY / 8)
    expect(store().state.decisions.active).toBeDefined()
    expect(store().state.time.speed).toBe(1)
    expect(effectiveSpeed(store())).toBe(1)
    expect(store().ui.slowdownAt).not.toBeNull()
    const sets = store().exportReplay().actions.filter((a) => a.action.type === 'setSpeed')
    expect(sets.at(-1)?.action).toEqual({ type: 'setSpeed', speed: 1 })

    // Same moment at 2×: no change.
    store().newGame({ seed: 7, founderXp: 0, runIndex: 0 })
    store().dispatch({ type: 'setSpeed', speed: 2 })
    for (let i = 0; i < 400 && !store().state.decisions.active; i++) store().tick(SECONDS_PER_DAY / 8)
    expect(store().state.decisions.active).toBeDefined()
    expect(store().state.time.speed).toBe(2)
  })

  it('the slowdown can be turned off', () => {
    store().setSlowOnMoments(false)
    store().dispatch({ type: 'setSpeed', speed: 4 })
    for (let i = 0; i < 400 && !store().state.decisions.active; i++) store().tick(SECONDS_PER_DAY / 8)
    expect(store().state.decisions.active).toBeDefined()
    expect(store().state.time.speed).toBe(4)
    store().setSlowOnMoments(true)
  })
})

describe('core loop phase 1 (store side)', () => {
  const withEvent = (s: GameState, kind: GameEvent['kind'], runway: number | null): GameState => ({
    ...s,
    finance: { ...s.finance, runway },
    events: [...s.events, { id: s.nextId + 100, day: s.time.day, kind }],
  })

  it('a release, or a payday that leaves < 3 months of runway, is an important moment (4× → 1×)', () => {
    store().newGame({ seed: 7, founderXp: 0, runIndex: 0 })
    const s = store().state
    expect(hasImportantMoment(s, withEvent(s, 'release', 12))).toBe(true)
    expect(hasImportantMoment(s, withEvent(s, 'payday', PAYDAY_SLOW_RUNWAY_MONTHS - 0.5))).toBe(true)
    expect(hasImportantMoment(s, withEvent(s, 'payday', 8))).toBe(false)
    expect(hasImportantMoment(s, withEvent(s, 'payday', null))).toBe(false)
    expect(hasImportantMoment(s, withEvent(s, 'hired', 1))).toBe(false)
    // Phase 3: a missed payroll (bankruptcy clock starts) is a moment too.
    expect(hasImportantMoment(s, withEvent(s, 'payrollMissed', 1))).toBe(true)
  })

  it('at 4× a tight payday slows the run to 1×', () => {
    store().newGame({ seed: 7, founderXp: 0, runIndex: 0 })
    store().setSlowOnMoments(true)
    // Almost no cash, half a day before payday: day 30 leaves well under 3 months of runway.
    useGameStore.setState((st) => ({ state: { ...st.state, time: { ...st.state.time, day: 29.5 }, stats: { ...st.state.stats, cash: 400 } } }))
    store().dispatch({ type: 'setSpeed', speed: 4 })
    for (let i = 0; i < 40 && !store().state.finance.lastReceipt; i++) store().tick(SECONDS_PER_DAY / 8)
    expect(store().state.finance.lastReceipt?.day).toBe(30)
    expect(store().state.time.speed).toBe(1)
  })

  it('derived carries the next step and the horizon for the HUD', () => {
    store().newGame({ seed: 7, founderXp: 0, runIndex: 0 })
    const d = store().state.derived
    expect(d.nextStep?.id).toBe('idea')
    expect(d.horizon?.[0]?.kind).toBe('payday')
    expect(d.horizon?.[0]?.day).toBe(30)
  })
})

describe('core loop phase 2: round offer / weekly pitch (store side)', () => {
  /** A running round, `acc` days into its current week; `pitchDue` set = this week's pitch waits. */
  const withRound = (s: GameState, pitchDue: number | undefined, acc = 0): GameState => ({
    ...s,
    flags: { ...s.flags, roundWeekAcc: acc },
    round: {
      active: true,
      targetStage: 1,
      startedDay: s.time.day,
      weeksTotal: 6,
      weeksLeft: 4,
      offer: { amount: 150_000, equity: 0.1, preMoney: 1_350_000 },
      baseValuation: 300_000,
      baseAmount: 150_000,
      targetValuation: 500_000,
      pitchFactor: 1,
      pitches: [],
      ...(pitchDue !== undefined ? { pitchDue } : {}),
    },
  })

  beforeEach(() => {
    store().newGame({ seed: 7, founderXp: 0, runIndex: 0 })
    store().dispatch({ type: 'setSpeed', speed: 2 })
  })

  it('a due pitch read in Büyüme › Tur is the `offer` pause; the plain Büyüme tab is not', () => {
    useGameStore.setState((st) => ({ state: withRound(st.state, 2) }))
    expect(offerWaiting(store().state)).toBe(true)
    store().openPanel({ kind: 'growth' }, { root: true })
    expect(store().ui.pauseReasons).toEqual([])
    store().openPanel({ kind: 'growth', section: 'round' }, { root: true })
    expect(store().ui.pauseReasons).toEqual(['offer'])
    expect(effectiveSpeed(store())).toBe(0)
    // Picking the pitch ends the pause: back to the player's 2×.
    const r = store().dispatch({ type: 'roundPitch', pitch: 'coinvestor' })
    expect(r.ok).toBe(true)
    expect(store().ui.pauseReasons).toEqual([])
    expect(effectiveSpeed(store())).toBe(2)
    expect(store().exportReplay().actions.some((a) => a.action.type === 'setSpeed' && a.action.speed === 0)).toBe(false)
  })

  it('a pitch falling due while the Tur section is open pauses at once', () => {
    useGameStore.setState((st) => ({ state: withRound(st.state, undefined, 6.9) }))
    store().openPanel({ kind: 'growth', section: 'round' }, { root: true })
    expect(store().ui.pauseReasons).toEqual([])
    for (let i = 0; i < 20 && store().state.round?.pitchDue === undefined; i++) store().tick(SECONDS_PER_DAY / 8)
    expect(store().state.round?.pitchDue).toBe(3)
    expect(store().ui.pauseReasons).toEqual(['offer'])
    const day = store().state.time.day
    store().tick(1)
    expect(store().state.time.day).toBe(day)
  })

  it('the open window (size choice) counts as an offer; pauseReasonsOf needs the state for it', () => {
    const s = store().state
    const open: GameState = { ...s, derived: { ...s.derived, canStartRound: true } }
    const ui = { overlay: null, panel: { kind: 'growth' as const, section: 'round' as const } }
    expect(pauseReasonsOf(ui, open)).toEqual(['offer'])
    expect(pauseReasonsOf(ui, s)).toEqual([])
    expect(pauseReasonsOf(ui)).toEqual([])
  })

  it('the round window opening is an important moment (4× → 1×); weekly beats are not', () => {
    const s = store().state
    const ev = (kind: GameEvent['kind']): GameState => ({ ...s, events: [...s.events, { id: s.nextId + 100, day: s.time.day, kind }] })
    expect(hasImportantMoment(s, ev('roundWindow'))).toBe(true)
    expect(hasImportantMoment(s, ev('roundWeek'))).toBe(false)
  })
})

describe('review fixes (store side)', () => {
  beforeEach(() => store().newGame({ seed: 7, founderXp: 0, runIndex: 0 }))
  const ev = (s: GameState, kind: GameEvent['kind'], extra: Partial<GameEvent> = {}): GameEvent => ({ id: s.nextId + 100, day: s.time.day, kind, ...extra })

  it('4× slows on a tight payday only when runway crosses below 3 months, not every tight month', () => {
    const s = store().state
    const receipt = (before: number | null, after: number | null): GameState => ({
      ...s,
      finance: { ...s.finance, runway: after, lastReceipt: { month: 1, day: 60, revenue: 0, salaries: 0, rent: 0, infra: 0, ads: 0, paid: 0, net: 0, cashAfter: 0, runwayBefore: before, runwayAfter: after, mom: 0, multiple: 0, mrr: 0, users: 0 } },
      events: [...s.events, ev(s, 'payday')],
    })
    expect(hasImportantMoment(s, receipt(4, 2.5))).toBe(true)
    expect(hasImportantMoment(s, receipt(null, 2.5))).toBe(true)
    expect(hasImportantMoment(s, receipt(2.5, 2))).toBe(false)
    expect(hasImportantMoment(s, receipt(8, 6))).toBe(false)
  })

  it('4× slows for every decision card (not only the stage\'s first), and for versions but not updates after 1.0', () => {
    const s = store().state
    const card = (history: GameState['decisions']['history']): GameState => ({ ...s, decisions: { ...s.decisions, history }, events: [...s.events, ev(s, 'decisionShown', { refId: 'x' })] })
    expect(hasImportantMoment(s, card([]))).toBe(true)
    expect(hasImportantMoment(s, card([{ cardId: 'early-sidegig', optionIndex: 0, day: s.time.day }]))).toBe(true)
    const rel = (update?: number): GameState => ({
      ...s,
      releases: [{ id: 'rel-x', day: 0, projectId: 'p', projectName: 'P', level: 5, users: 1, mrr: 0, ...(update !== undefined ? { update } : {}) }],
      events: [...s.events, ev(s, 'release', { refId: 'rel-x', value: 5 })],
    })
    expect(hasImportantMoment(s, rel())).toBe(true)
    expect(hasImportantMoment(s, rel(2))).toBe(false)
  })

  it('the HUD layer never blocks: payday (month receipt) and a release add no pause reason and keep the speed', () => {
    store().dispatch({ type: 'startProject', category: 'web' })
    store().dispatch({ type: 'setSpeed', speed: 1 })
    // Half a day before payday, and a project about to pass the MVP threshold.
    useGameStore.setState((st) => ({
      state: { ...st.state, time: { ...st.state.time, day: 29.5 }, projects: st.state.projects.map((p) => ({ ...p, maturity: 0.25, releaseLevel: 0 })) },
    }))
    for (let i = 0; i < 40 && !store().state.finance.lastReceipt; i++) store().tick(SECONDS_PER_DAY / 8)
    const s = store().state
    expect(s.finance.lastReceipt?.day).toBe(30)
    expect(s.events.some((e) => e.kind === 'release')).toBe(true)
    expect(store().ui.pauseReasons).toEqual([])
    expect(store().ui.panel).toBeNull()
    expect(s.time.speed).toBe(1)
    expect(effectiveSpeed(store())).toBe(1)
  })

  it('a move (Yeni ofise geç) opens the new office paused with the Başlat call', () => {
    store().dispatch({ type: 'setSpeed', speed: 2 })
    store().openOverlay({ kind: 'moveScene' })
    store().closeOverlay()
    expect(store().state.time.speed).toBe(0)
    expect(store().ui.runStarted).toBe(false)
    // Other overlays keep the player's speed.
    store().dispatch({ type: 'setSpeed', speed: 2 })
    store().openOverlay({ kind: 'victory' })
    store().closeOverlay()
    expect(store().state.time.speed).toBe(2)
  })
})

describe('Metrikler: top-bar pins (docs/LAYOUT.md §5.2)', () => {
  /** In-memory localStorage (node has none): the UI profile round-trips through it. */
  function memoryStorage(): Storage {
    const m = new Map<string, string>()
    return {
      get length() {
        return m.size
      },
      clear: () => m.clear(),
      getItem: (k) => m.get(k) ?? null,
      key: (i) => [...m.keys()][i] ?? null,
      removeItem: (k) => void m.delete(k),
      setItem: (k, v) => void m.set(k, String(v)),
    }
  }

  /** Learns the concept that opens `widget` (triggers it first, then opens its card like the player would). */
  function learnWidget(widget: HudWidget) {
    const c = CONCEPTS.find((x) => x.unlocks === widget || (Array.isArray(x.unlocks) && x.unlocks.includes(widget)))
    if (!c) throw new Error(`no concept unlocks ${widget}`)
    useGameStore.setState((st) => ({ state: { ...st.state, concepts: { ...st.state.concepts, triggered: [...st.state.concepts.triggered, c.id] } } }))
    expect(store().dispatch({ type: 'openConcept', conceptId: c.id }).ok).toBe(true)
    expect(store().state.unlockedWidgets).toContain(widget)
  }

  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
    useGameStore.setState((st) => ({ ui: { ...st.ui, pinnedMetrics: [], pinTouched: false, seenMetrics: [] } }))
    store().newGame({ seed: 11, founderXp: 0, runIndex: 0 })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('pins at most two; the third evicts the oldest; pinning by hand sets pinTouched', () => {
    store().pinMetric('burnBreakdown')
    store().pinMetric('profitProjection')
    expect(store().ui.pinnedMetrics).toEqual(['burnBreakdown', 'profitProjection'])
    expect(store().ui.pinTouched).toBe(true)
    store().pinMetric('arpu')
    expect(store().ui.pinnedMetrics).toEqual(['profitProjection', 'arpu'])
    // Already pinned: no-op (order kept).
    store().pinMetric('profitProjection')
    expect(store().ui.pinnedMetrics).toEqual(['profitProjection', 'arpu'])
    store().unpinMetric('profitProjection')
    expect(store().ui.pinnedMetrics).toEqual(['arpu'])
    expect(PIN_MAX).toBe(2)
  })

  it('top-bar gauges and badges cannot be pinned; a merged gauge pins its card', () => {
    store().pinMetric('runway')
    store().pinMetric('cash')
    store().pinMetric('cultureBadge')
    store().pinMetric('roundTimer')
    expect(store().ui.pinnedMetrics).toEqual([])
    expect(store().ui.pinTouched).toBe(false)
    store().pinMetric('churn')
    store().pinMetric('equity')
    expect(store().ui.pinnedMetrics).toEqual(['retention', 'capTable'])
  })

  it('a newly learned gauge fills a free slot automatically until the player pins by hand', () => {
    learnWidget('runway') // top-bar gauge: never auto-pinned
    expect(store().ui.pinnedMetrics).toEqual([])
    learnWidget('burnBreakdown')
    expect(store().ui.pinnedMetrics).toEqual(['burnBreakdown'])
    learnWidget('retention')
    expect(store().ui.pinnedMetrics).toEqual(['burnBreakdown', 'retention'])
    // Slots full: a third one waits in Metrikler.
    learnWidget('profitProjection')
    expect(store().ui.pinnedMetrics).toEqual(['burnBreakdown', 'retention'])
    // Hand-picked from now on: freeing a slot does not refill it.
    store().unpinMetric('retention')
    learnWidget('arpu')
    expect(store().ui.pinnedMetrics).toEqual(['burnBreakdown'])
  })

  it('new gauges count as unseen until Metrikler marks them seen', () => {
    expect(unseenMetrics(store().state.unlockedWidgets, store().ui.seenMetrics)).toEqual([])
    learnWidget('burnBreakdown')
    learnWidget('churn') // shown on the Tutunma card
    expect(unseenMetrics(store().state.unlockedWidgets, store().ui.seenMetrics).sort()).toEqual(['burnBreakdown', 'retention'])
    store().markMetricsSeen(['burnBreakdown', 'churn'])
    expect(unseenMetrics(store().state.unlockedWidgets, store().ui.seenMetrics)).toEqual([])
  })

  it('pins persist in be-unicorn:ui and survive a new game (locked pins keep their place, invisible)', () => {
    learnWidget('burnBreakdown')
    store().pinMetric('ltvCac')
    expect(JSON.parse(localStorage.getItem(UI_KEY) ?? '{}')).toMatchObject({ v: 1, pinnedMetrics: ['burnBreakdown', 'ltvCac'], pinTouched: true })
    store().newGame({ seed: 12, founderXp: 0, runIndex: 1 })
    expect(store().ui.pinnedMetrics).toEqual(['burnBreakdown', 'ltvCac'])
    expect(store().ui.pinTouched).toBe(true)
    // A new run: nothing is unlocked yet, so nothing is drawn; every gauge is new again.
    expect(effectivePins(store().ui.pinnedMetrics, store().state.unlockedWidgets)).toEqual([])
    expect(store().ui.seenMetrics).toEqual([...INITIAL_WIDGETS])
    // Reload: the profile is read back, unknown ids are dropped.
    localStorage.setItem(UI_KEY, JSON.stringify({ v: 1, pinnedMetrics: ['arpu', 'nope'], seenMetrics: ['cash'], pinTouched: false }))
    expect(readUiSave()).toEqual({ pinnedMetrics: ['arpu'], seenMetrics: ['cash'], pinTouched: false })
  })

  it('continue (load) takes the pins from the profile; an old profile without seenMetrics counts the save as seen', () => {
    learnWidget('burnBreakdown')
    store().save()
    localStorage.setItem(UI_KEY, JSON.stringify({ v: 1, pinnedMetrics: ['profitProjection'], pinTouched: true }))
    expect(store().load()).toBe(true)
    expect(store().ui.pinnedMetrics).toEqual(['profitProjection'])
    expect(store().ui.pinTouched).toBe(true)
    expect(store().ui.seenMetrics).toEqual(store().state.unlockedWidgets)
    expect(unseenMetrics(store().state.unlockedWidgets, store().ui.seenMetrics)).toEqual([])
  })

  it('auto-pin replaces a pin that is locked in this run instead of growing past PIN_MAX', () => {
    expect(autoPin(['arpu', 'ltvCac'], ['burnBreakdown'], ['cash', 'burnBreakdown'])).toEqual(['ltvCac', 'burnBreakdown'])
    expect(autoPin(['arpu', 'ltvCac'], ['burnBreakdown'], ['cash', 'arpu', 'ltvCac', 'burnBreakdown'])).toEqual(['arpu', 'ltvCac'])
  })

  it('pinning by hand over PIN_MAX drops a pin locked in this run first, not the visible oldest one', () => {
    learnWidget('retention')
    // Saved pins from an earlier run: retention (visible now) + arpu (locked in this run, invisible).
    useGameStore.setState((st) => ({ ui: { ...st.ui, pinnedMetrics: ['retention', 'arpu'], pinTouched: true } }))
    expect(pinEvictee(store().ui.pinnedMetrics, 'ltvCac', store().state.unlockedWidgets)).toBeNull()
    store().pinMetric('ltvCac')
    expect(store().ui.pinnedMetrics).toEqual(['retention', 'ltvCac'])
    // Both visible now: the next pin names and drops the oldest.
    learnWidget('ltvCac')
    expect(pinEvictee(store().ui.pinnedMetrics, 'burnBreakdown', store().state.unlockedWidgets)).toBe('retention')
    store().pinMetric('burnBreakdown')
    expect(store().ui.pinnedMetrics).toEqual(['ltvCac', 'burnBreakdown'])
  })

  it('loading a mid-game save without pin prefs fills the empty slots with the defaults', () => {
    learnWidget('burnBreakdown')
    store().save()
    localStorage.removeItem(UI_KEY)
    useGameStore.setState((st) => ({ ui: { ...st.ui, pinnedMetrics: [], pinTouched: false } }))
    expect(store().load()).toBe(true)
    expect(store().ui.pinnedMetrics[0]).toBe('burnBreakdown')
    expect(store().ui.pinTouched).toBe(false)
    // A player who picked pins by hand keeps them as they are.
    localStorage.setItem(UI_KEY, JSON.stringify({ v: 1, pinnedMetrics: [], pinTouched: true }))
    expect(store().load()).toBe(true)
    expect(store().ui.pinnedMetrics).toEqual([])
  })

  it('Metrikler is a plain tab: it never pauses', () => {
    store().togglePanel('metrics')
    expect(store().ui.panel).toEqual({ kind: 'metrics' })
    expect(store().ui.pauseReasons).toEqual([])
    store().openPanel({ kind: 'metrics', focus: 'burnBreakdown' }, { root: true })
    expect(store().ui.pauseReasons).toEqual([])
    store().togglePanel('metrics')
    expect(store().ui.panel).toBeNull()
  })
})

describe('center screens (docs/GAMEPLAY_V2.md §14.3)', () => {
  beforeEach(() => {
    store().newGame({ seed: 7, founderXp: 0, runIndex: 0 })
    store().dispatch({ type: 'setSpeed', speed: 1 })
  })
  afterEach(() => store().closeOverlay())

  const withEvent = (kind: string): GameState => {
    const s = store().state
    return { ...s, events: [...s.events, { id: s.nextId + 100, day: s.time.day, kind: kind as GameEvent['kind'] }] }
  }

  it('center overlays never pause; moveScene still does', () => {
    for (const o of [{ kind: 'stats' }, { kind: 'stats', tab: 'team' }, { kind: 'lawbook' }, { kind: 'market' }] as Overlay[]) {
      store().openOverlay(o)
      expect(store().ui.pauseReasons).toEqual([])
      expect(blockingOverlay(store().ui)).toBeNull()
      expect(effectiveSpeed(store())).toBe(1)
      expect(pauseReasonsOf({ overlay: o, panel: null })).toEqual([])
    }
    store().openOverlay({ kind: 'moveScene' })
    expect(store().ui.pauseReasons).toEqual(['modal'])
    expect(blockingOverlay(store().ui)).toEqual({ kind: 'moveScene' })
  })

  it('openOverlay(stats) then tick: the day moves on', () => {
    store().openOverlay({ kind: 'stats' })
    const day = store().state.time.day
    store().tick(SECONDS_PER_DAY)
    expect(store().state.time.day).toBeCloseTo(day + 1, 6)
    expect(store().ui.overlay).toEqual({ kind: 'stats' })
  })

  it('one surface: a center screen closes the panel, a panel closes the center screen', () => {
    store().togglePanel('team')
    store().openOverlay({ kind: 'stats' })
    expect(store().ui.panel).toBeNull()
    store().openPanel({ kind: 'growth' })
    expect(store().ui.overlay).toBeNull()
    expect(store().ui.panel).toEqual({ kind: 'growth' })
    // A blocking modal keeps the panel under its backdrop, and a panel does not close the modal.
    store().openOverlay({ kind: 'victory' })
    expect(store().ui.panel).toEqual({ kind: 'growth' })
    store().openPanel({ kind: 'team' })
    expect(store().ui.overlay).toEqual({ kind: 'victory' })
  })

  it('toggleCenter opens, again closes; it never replaces a blocking modal', () => {
    store().toggleCenter('stats')
    expect(store().ui.overlay).toEqual({ kind: 'stats' })
    store().toggleCenter('stats')
    expect(store().ui.overlay).toBeNull()
    store().openOverlay({ kind: 'postMortem' })
    store().toggleCenter('stats')
    expect(store().ui.overlay).toEqual({ kind: 'postMortem' })
  })

  it('toggleCenter lawbook / market (Y / H): opens, switches, again closes', () => {
    store().toggleCenter('lawbook')
    expect(store().ui.overlay).toEqual({ kind: 'lawbook' })
    store().toggleCenter('market')
    expect(store().ui.overlay).toEqual({ kind: 'market' })
    store().toggleCenter('market')
    expect(store().ui.overlay).toBeNull()
  })

  it('stats open + decisionShown: the screen closes, 4× drops to 1×, the tick goes on', () => {
    store().dispatch({ type: 'setSpeed', speed: 4 })
    store().openOverlay({ kind: 'stats' })
    for (let i = 0; i < 400 && !store().state.decisions.active; i++) store().tick(SECONDS_PER_DAY / 8)
    expect(store().state.decisions.active).toBeDefined()
    expect(store().ui.overlay).toBeNull()
    expect(store().state.time.speed).toBe(1)
    const day = store().state.time.day
    store().tick(SECONDS_PER_DAY)
    expect(store().state.time.day).toBeGreaterThan(day)
  })

  it('interrupting events: cards, the round window, cash tension (real engine kinds); not a hire or a release', () => {
    const s = store().state
    for (const k of ['decisionShown', 'roundWindow', 'payrollMissed', 'paydayShort', 'crisis', 'roundFailed', 'loanCalled']) {
      expect(hasInterrupt(s, withEvent(k)), k).toBe(true)
      expect(hasImportantMoment(s, withEvent(k)), k).toBe(true)
    }
    for (const k of ['hired', 'release', 'payday', 'goalDone', 'conceptQueued']) expect(hasInterrupt(s, withEvent(k)), k).toBe(false)
    // A crisis showing what it is slows 4× down but does not close the screen.
    expect(hasImportantMoment(s, withEvent('crisisRevealed'))).toBe(true)
    expect(hasInterrupt(s, withEvent('crisisRevealed'))).toBe(false)
    expect(IMPORTANT_EVENT_KINDS.has('paydayShort')).toBe(true)
  })
})

describe('payday desk (docs/GAMEPLAY_V2.md §6.1, §3 md.6)', () => {
  beforeEach(() => {
    store().newGame({ seed: 7, founderXp: 0, runIndex: 0 })
    store().dispatch({ type: 'setSpeed', speed: 1 })
  })
  afterEach(() => store().closeOverlay())

  /** The store's run with a month waiting on the desk (the engine's own short payday, see money.test). */
  function withDesk(): GameState {
    const s = store().state
    const ledger = { revenue: 0, salaries: 0, rent: 300, infra: 20, ads: 0, founder: 1_200 }
    const state: GameState = { ...s, stats: { ...s.stats, cash: 500 }, finance: { ...s.finance, pendingPayday: { day: Math.floor(s.time.day), ledger, deferredBefore: 0 } } }
    useGameStore.setState({ state })
    return state
  }
  const desk: Overlay = { kind: 'payday' }

  it('pendingPayday + the desk open → the `payday` pause (not `modal`), and the day stands still', () => {
    const state = withDesk()
    store().openOverlay(desk)
    expect(store().ui.pauseReasons).toEqual(['payday'])
    expect(pauseReasonsOf({ overlay: desk, panel: null }, state)).toEqual(['payday'])
    expect(blockingOverlay(store().ui)).toBeNull()
    expect(effectiveSpeed(store())).toBe(0)
    const day = store().state.time.day
    store().tick(SECONDS_PER_DAY)
    expect(store().state.time.day).toBe(day)
    // A center screen does not replace the desk.
    store().toggleCenter('stats')
    expect(store().ui.overlay).toEqual(desk)
  })

  it('"Sonra": the desk closed → no pause, the tick moves the day on (the 3-day countdown runs)', () => {
    const state = withDesk()
    store().openOverlay(desk)
    store().closeOverlay()
    expect(store().ui.pauseReasons).toEqual([])
    expect(pauseReasonsOf({ overlay: null, panel: null }, state)).toEqual([])
    const day = store().state.time.day
    store().tick(SECONDS_PER_DAY)
    expect(store().state.time.day).toBeCloseTo(day + 1, 6)
    expect(store().state.finance.pendingPayday).toBeDefined()
    // The desk open with nothing waiting on it holds nothing.
    expect(pauseReasonsOf({ overlay: desk, panel: null }, { ...state, finance: { ...state.finance, pendingPayday: undefined } })).toEqual([])
  })

  it('resolvePayday: the month closes, the desk with it, the pause ends', () => {
    withDesk()
    store().openOverlay(desk)
    const res = store().dispatch({ type: 'resolvePayday', choice: { salaries: 'full', rent: 'pay', infra: 'pay', ads: 'pay', founder: 'skip' } })
    expect(res.ok).toBe(true)
    expect(store().state.finance.pendingPayday).toBeUndefined()
    expect(store().ui.overlay).toBeNull()
    expect(store().ui.pauseReasons).toEqual([])
    expect(effectiveSpeed(store())).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Curiosity surfaces and overlays (docs/GAMEPLAY_V2.md §9.4, §10.6): Keşif record, rival line, cast, report cards
// ---------------------------------------------------------------------------

/** Words a player reads in rendered markup: tokens with two letters or more (numbers and signs are not words). */
function visibleWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ')
  return text.split(/\s+/).filter((w) => /\p{L}{2,}/u.test(w)).length
}

/**
 * Server render of the store's CURRENT state: zustand's server snapshot reads the initial state object, so its state
 * and ui are swapped in for the render and put back after.
 */
function ssr(el: Parameters<typeof renderToStaticMarkup>[0]): string {
  const initial = useGameStore.getInitialState()
  const keep = { state: initial.state, ui: initial.ui }
  Object.assign(initial, { state: store().state, ui: store().ui })
  try {
    return renderToStaticMarkup(el)
  } finally {
    Object.assign(initial, keep)
  }
}

const throwingStorage = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
  removeItem: () => {
    throw new Error('blocked')
  },
}

describe('Keşif record (be-unicorn:codex, §9.2)', () => {
  beforeEach(() => {
    store().newGame({ seed: 7, founderXp: 0, runIndex: 0 })
  })
  afterEach(() => vi.unstubAllGlobals())

  const shown = (s: GameState, refId: string): GameState => {
    const id = (s.events[s.events.length - 1]?.id ?? 0) + 1
    return { ...s, events: [...s.events, { id, day: s.time.day, kind: 'decisionShown', refId }] }
  }

  it('a card shown is seen once; a thread is done only on its last step', () => {
    const s = store().state
    const empty = { seenCards: [], threadsDone: [] }
    const a = codexAfter(empty, s, shown(s, 'mentor-coffee'))
    expect(a).toEqual({ seenCards: ['mentor-coffee'], threadsDone: [] })
    expect(codexAfter(a, s, shown(s, 'mentor-coffee'))).toBe(a)
    const b = codexAfter(a, s, shown(s, 'mentor-your-way'))
    expect(b.threadsDone).toEqual(['mentor'])
    // Nothing new: the same object (no write, no render).
    expect(codexAfter(b, s, s)).toBe(b)
    expect(codexCount(b)).toEqual({ n: 2, total: CONTENT.decisions.filter((d) => d.thread || d.secret).length })
  })

  it('a throwing localStorage never breaks reading, writing, ticking or the Keşif render', () => {
    vi.stubGlobal('localStorage', throwingStorage)
    expect(readCodex()).toEqual({ seenCards: [], threadsDone: [] })
    expect(() => writeCodex({ seenCards: ['x'], threadsDone: [] })).not.toThrow()
    expect(() => store().newGame({ seed: 7, founderXp: 0, runIndex: 0 })).not.toThrow()
    store().dispatch({ type: 'setSpeed', speed: 4 })
    // Through days of play (cards come, afterStep writes the record into the blocked storage).
    expect(() => play(240)).not.toThrow()
    const html = ssr(createElement(JournalPanel))
    expect(html).toContain(t('achv.discovery'))
    expect(html).toContain(t('codex.count', codexCount(store().ui.codex)))
  })

  it('codex lives outside keptUi: a new run reads it back from storage', () => {
    const mem = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) })
    writeCodex({ seenCards: ['mentor-coffee'], threadsDone: [] })
    expect(mem.has(CODEX_KEY)).toBe(true)
    store().newGame({ seed: 8, founderXp: 0, runIndex: 1 })
    expect(store().ui.codex.seenCards).toEqual(['mentor-coffee'])
  })
})

describe('strip: the one rival line (§9.4, D9)', () => {
  it('rivalPassed is one P2 line per rival, de-duplicated for 30 days by the daily budget', () => {
    const rivals = [{ id: 'r1', name: 'Nova', bornDay: 0, strength: 0.5, share: 0.1, mrr: 0, valuation: 1, momentum: 0 as const }]
    const ev = (id: number, day: number): GameEvent => ({ id, day, kind: 'rivalPassed', refId: 'r1', value: 1 })
    const [first] = rivalPassedItems([ev(1, 100), { id: 2, day: 100, kind: 'rivalBorn', refId: 'r1' }], { rivals })
    expect(first).toMatchObject({ kind: 'activity', rival: 'Nova', dedupeKey: 'rivalPassed:r1' })
    expect(rivalPassedItems([{ id: 3, day: 1, kind: 'decisionShown', refId: 'mentor-coffee' }], { rivals })).toEqual([])
    let b = dailyBudget(100)
    let v: string
    ;[v, b] = admit(b, first!, 100)
    expect(v).toBe('show')
    expect(admit(b, rivalPassedItems([ev(4, 110)], { rivals })[0]!, 110)[0]).toBe('skip')
    expect(admit(b, rivalPassedItems([ev(5, 130)], { rivals })[0]!, 130)[0]).toBe('show')
  })

  it('no achievement, goal or thread step text reaches the strip (grep)', () => {
    const files = import.meta.glob<string>(['../ui/layout/NotificationStrip.tsx', '../ui/Moments.tsx', '../ui/momentRules.ts'], { query: '?raw', import: 'default', eager: true })
    expect(Object.keys(files)).toHaveLength(3)
    for (const [f, src] of Object.entries(files)) expect(src, f).not.toMatch(/goalDone|threadStep|'achv\.|'codex\.|'goals?\.|conceptQueued/)
  })
})

describe('cast and horizon (§9.1, §5.1)', () => {
  it('bubble speakers use state.cast; the same seed gives the same names', () => {
    const a = createGame({ seed: 11, founderXp: 0, runIndex: 0 })
    const b = createGame({ seed: 11, founderXp: 0, runIndex: 0 })
    expect(a.cast).toEqual(b.cast)
    const cast = { ...a.cast!, mentor: 'Suna' }
    const s: GameState = { ...a, cast, visitors: [{ id: 'v1', role: 'mentor', purpose: 'decision', arriveDay: 0, leaveDay: 9 }] }
    expect(speakerName(s, 'v1')).toBe('Suna')
    expect(speakerName(s, 'mentor')).toBe('Suna')
    expect(castName(s, 'investor')).toBe(a.cast!.investor)
    expect(npcLabel('mentor', cast)).toBe(`Suna · ${NPC_TEXT.mentor.title}`)
    // An older save without a cast falls back to the role's default name.
    expect(castName({}, 'mentor')).toBe(NPC_TEXT.mentor.name)
  })

  it('a crisis is "? · 58g" until the reveal, then its own icon and name (≤ 6 words)', () => {
    const hidden: HorizonItem = { kind: 'crisis', day: 58, hidden: true }
    expect(horizonItemText(hidden, 58, true)).toBe(`${t('horizon.crisisHidden')} · 58g`)
    const shown: HorizonItem = { kind: 'crisis', day: 30, hidden: false, crisisId: 'cac-war' }
    expect(horizonKindOf(shown).icon).toBe('megaphone')
    const text = horizonItemText(shown, 30, true)
    expect(text).toContain(t('crisis.cac-war'))
    expect(text.split(/\s+/).length).toBeLessThanOrEqual(6)
  })
})

describe('overlays and the Defter card (§10.6)', () => {
  beforeEach(() => {
    store().newGame({ seed: 7, founderXp: 0, runIndex: 0 })
  })

  const report = (stage: StageIndex): StageReport => ({ stage, days: 60 + stage * 40, roundsClosed: stage, goalsDone: 1, threadSteps: 1, rivalRatio: 0, minRunway: 4.2 })

  it('NotebookCard shows at most 20 words when it opens (every concept, numbers and unlock pill in)', () => {
    const s = store().state
    useGameStore.setState({ state: { ...s, concepts: { ...s.concepts, triggered: [...CONCEPT_IDS] } } })
    for (const c of CONCEPTS) {
      const html = ssr(createElement(NotebookCard, { conceptId: c.id, onClose: () => {} }))
      expect(visibleWords(html), c.id).toBeLessThanOrEqual(20)
      expect((html.match(/<p[\s>]/g) ?? []).length, c.id).toBeLessThanOrEqual(1)
    }
  })

  it('MoveScene: no paragraph, the teaser ≤ 6 words, the report numbers of the stage just left', () => {
    const s = store().state
    useGameStore.setState({ state: { ...s, stage: 2, stageReports: [report(0), report(1)] } })
    const html = ssr(createElement(MoveSceneOverlay, { onClose: () => {} }))
    expect(html).not.toMatch(/<p[\s>]/)
    expect(html).toContain(TEASERS[2])
    expect(TEASERS[2].split(/\s+/).length).toBeLessThanOrEqual(6)
    expect(html).toContain('100')
  })

  it('Victory: 7 karne rows (the engine\'s 6 reports + Unicorn), the archetype and the Keşif count', () => {
    // The real path: a report per stage left (closeRound's pushStageReport), the Series C one written by winRun.
    const s = structuredClone(store().state)
    for (const stage of [0, 1, 2, 3, 4] as StageIndex[]) {
      s.stage = stage
      s.stageStart = { stage, day: s.time.day, users: 0, team: 1, releases: 0, mrr: 0, projects: 0 }
      s.time.day += 60
      pushStageReport(s, CONTENT)
    }
    s.stage = 5
    s.stageStart = { stage: 5, day: s.time.day, users: 0, team: 1, releases: 0, mrr: 0, projects: 0 }
    s.time.day += 90
    winRun(s, CONTENT)
    expect(s.stageReports?.map((r) => r.stage)).toEqual([0, 1, 2, 3, 4, 5])
    useGameStore.setState({ state: { ...s, archetype: 'niche' } })
    const html = ssr(createElement(VictoryOverlay))
    expect(html).toContain('data-report-rows="7"')
    expect((html.match(/<li[\s>]/g) ?? []).length).toBe(7)
    expect(html).toContain(t('archetype.niche'))
    expect(html).toContain(t('codex.count', codexCount(store().ui.codex)))
    expect((html.match(/<p[\s>]/g) ?? []).length).toBeLessThanOrEqual(1)
  })
})
