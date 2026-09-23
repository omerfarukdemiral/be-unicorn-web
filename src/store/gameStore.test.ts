// Integration: store ⇄ engine ⇄ content. M2/M3 chain: hire → desk → sit & work → project → users; 10 min in the garage.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FURNITURE } from '../content'
import { FIXED_STEP_DAYS, FOUNDER_SLOT_ID, SECONDS_PER_DAY } from '../engine/types'
import { CONCEPT_MINIMIZE_DAYS, effectiveSpeed, panelSelection, useGameStore } from './gameStore'

const store = () => useGameStore.getState()

/** Plays `seconds` of real time at the current speed in 60 fps frames; the "player" opens concept bubbles. */
function play(seconds: number, onDay?: (day: number) => void) {
  const frames = Math.round(seconds * 60)
  let lastDay = -1
  for (let i = 0; i < frames; i++) {
    store().tick(1 / 60)
    const s = store().state
    if (s.gameOver) return
    const active = s.concepts.active
    if (active) store().dispatch({ type: 'openConcept', conceptId: active.id })
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
    expect(effectiveSpeed(store())).toBe(4)
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
    expect(speedSets()).toHaveLength(1)
    expect(store().state.time.speed).toBe(1)
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
  function withConcept(id = 'runway' as const): void {
    const st = store().state
    useGameStore.setState({
      state: { ...st, concepts: { ...st.concepts, triggered: [...st.concepts.triggered, id], queue: [], active: { id, shownDay: st.time.day } } },
    })
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

  it('an unclicked concept bubble shrinks after CONCEPT_MINIMIZE_DAYS of game time, never while still', () => {
    withConcept()
    // Paused (start): real seconds pass, the bubble stays.
    store().tick(SECONDS_PER_DAY * (CONCEPT_MINIMIZE_DAYS + 5))
    expect(store().state.concepts.active?.id).toBe('runway')
    // Flowing at 1×: just before the limit it is still up, after it it is an icon.
    store().dispatch({ type: 'setSpeed', speed: 1 })
    for (let i = 0; i < (CONCEPT_MINIMIZE_DAYS - 1) * 4; i++) store().tick(SECONDS_PER_DAY / 4)
    expect(store().state.concepts.active?.id).toBe('runway')
    // A Defter card open elsewhere holds time: no shrinking while reading.
    store().openPanel({ kind: 'journal', conceptId: 'burn' })
    store().tick(SECONDS_PER_DAY * 5)
    expect(store().state.concepts.active?.id).toBe('runway')
    store().closePanel()
    for (let i = 0; i < 8; i++) store().tick(SECONDS_PER_DAY / 4)
    expect(store().state.concepts.active).toBeUndefined()
    expect(store().state.concepts.minimized).toContain('runway')
    // Recorded like any action: a replay reproduces it.
    expect(store().exportReplay().actions.some((a) => a.action.type === 'minimizeConcept')).toBe(true)
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
