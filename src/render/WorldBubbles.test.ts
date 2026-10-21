import { describe, expect, it } from 'vitest'
import { DECISIONS } from '../content'
import { createGame } from '../engine'
import { company } from '../engine/__tests__/moduleFixtures'
import { modulePromptFlag, projectVersion } from '../engine/modules'
import type { Employee, GameState, PendingPayday, RenewalView, RoundState } from '../engine/types'
import {
  BubbleTimeline,
  AMBIENT_GAP_MS,
  DECISION_DELAY_MS,
  EXIT_MS,
  IDLE_DELAY_MS,
  IDLE_LINGER_MS,
  IDLE_SHOW_MS,
  IDLE_SNOOZE_MS,
  ARRIVE_MAX_MS,
  MAX_ACTIONABLE,
  MAX_IDLE,
  MAX_TIRED_BORED,
  capBubbles,
  REFLECTION_MS,
  routeBubbles,
  routeCandidates,
  type RoutedLine,
} from './WorldBubbles'

const cardBy = (speaker: string) => DECISIONS.find((d) => d.speaker === speaker)!.id

function game(): GameState {
  const s = createGame({ seed: 3, founderXp: 0, runIndex: 0 })
  s.bubbles = []
  s.visitors = []
  s.employees = []
  s.candidates = []
  s.decisions.active = undefined
  s.decisions.lastAnswer = undefined
  s.finance.pendingPayday = undefined
  s.round = undefined
  s.derived = { ...s.derived, canStartRound: false, renewals: [], nextStep: undefined }
  return s
}

function withDecision(s: GameState, speaker: string, visitorId = 'v1'): string {
  const cardId = cardBy(speaker)
  s.visitors.push({ id: visitorId, role: DECISIONS.find((d) => d.id === cardId)!.speaker, purpose: 'decision', targetSlotId: 'founder', arriveDay: 0, leaveDay: 30, refId: cardId })
  s.decisions.active = { cardId, shownDay: 0, visitorId }
  return cardId
}

const emp = (id: string, over: Partial<Employee> = {}): Employee => ({ id, name: id, dept: 'eng', status: 'working', ...over }) as Employee

function withPitch(s: GameState, visitor: boolean): void {
  s.round = { active: true, pitchDue: 1 } as RoundState
  if (visitor) s.visitors.push({ id: 'vr', role: 'investor', purpose: 'round', targetSlotId: 'founder', arriveDay: 0, leaveDay: 30, refId: 'round-2' })
}

const keys = (ls: readonly RoutedLine[]) => ls.map((l) => l.key)
const open = (s: GameState, bubbleOpen: string | null = null) => routeBubbles(s, { bubbleOpen })

describe('routeBubbles: who asks', () => {
  it('an investor card is asked by its visitor', () => {
    const s = game()
    const cardId = withDecision(s, 'investor')
    expect(open(s)).toEqual([expect.objectContaining({ kind: 'decision', key: `decision:${cardId}`, speakerId: 'v1' })])
  })

  it('a cofounder card is the founder’s own call: asked at the desk while the visitor stands by', () => {
    const s = game()
    const cardId = withDecision(s, 'cofounder')
    expect(open(s)[0]).toMatchObject({ key: `decision:${cardId}`, speakerId: 'desk' })
  })

  it('an investor card whose visitor already left moves to the desk', () => {
    const s = game()
    withDecision(s, 'investor')
    s.visitors = []
    expect(open(s)[0]!.speakerId).toBe('desk')
  })

  it('the weekly pitch sits on the round investor, or on the desk without one', () => {
    const s = game()
    withPitch(s, true)
    expect(open(s)).toEqual([expect.objectContaining({ kind: 'visitor', key: 'visitor:pitch:vr', speakerId: 'vr', ref: 'pitch', extra: 'vr' })])
    const t = game()
    withPitch(t, false)
    expect(open(t)).toEqual([expect.objectContaining({ kind: 'desk', key: 'desk:pitch', speakerId: 'desk' })])
  })

  it('a renewal key carries the contract id', () => {
    const s = game()
    s.derived.renewals = [{ id: 'c7', name: 'Acme' } as RenewalView]
    expect(open(s)).toEqual([expect.objectContaining({ kind: 'desk', key: 'desk:renewal:c7', ref: 'renewal', extra: 'c7' })])
  })

  it('the desk asks one topic at a time in priority order; the open one wins', () => {
    const s = game()
    s.finance.pendingPayday = { day: 30 } as PendingPayday
    s.derived.renewals = [{ id: 'c7', name: 'Acme' } as RenewalView]
    s.derived.nextStep = { id: 'idea', index: 1, total: 5 }
    expect(keys(open(s))).toEqual(['desk:payday'])
    expect(keys(open(s, 'desk:renewal:c7'))).toEqual(['desk:renewal:c7'])
  })

  it('founder actions exist only while open', () => {
    const s = game()
    expect(open(s)).toEqual([])
    expect(keys(open(s, 'desk:actions'))).toEqual(['desk:actions'])
  })

  it('hiring asks at the desk while someone waits and a desk stands free', () => {
    const s = game()
    s.candidates = [{ id: 'c1' } as GameState['candidates'][number]]
    for (const x of s.office.slots) if (x.type === 'desk' && x.id !== 'founder') x.itemId = undefined
    expect(open(s)).toEqual([])
    const free = s.office.slots.find((x) => x.type === 'desk' && x.id !== 'founder' && x.ring === 1 && x.occupantId === undefined)!
    free.itemId = 'desk-basic'
    expect(keys(open(s))).toEqual(['desk:hire'])
    s.candidates = []
    expect(open(s)).toEqual([])
  })

  it('NEW-4: hiring does not ask when every offer is in the red, nor after the run ended', () => {
    const s = game()
    for (const x of s.office.slots) if (x.type === 'desk' && x.id !== 'founder' && x.ring === 1 && x.occupantId === undefined) x.itemId = 'desk-basic'
    s.candidates = [{ id: 'c1', salary: 2_000 } as GameState['candidates'][number]]
    expect(keys(open(s))).toEqual(['desk:hire'])
    s.stats.cash = 500
    expect(open(s)).toEqual([])
    s.stats.cash = 1_000_000
    s.gameOver = { kind: 'bankrupt' } as GameState['gameOver']
    expect(open(s)).toEqual([])
    expect(routeBubbles(s, { bubbleOpen: null })).toEqual([])
  })

  it('round window and first project are desk topics', () => {
    const s = game()
    s.derived.canStartRound = true
    expect(keys(open(s))).toEqual(['desk:round'])
    s.derived.canStartRound = false
    s.derived.nextStep = { id: 'idea', index: 1, total: 5 }
    expect(keys(open(s))).toEqual(['desk:project'])
  })

  it('the down round asks at the desk once its retry wait is over, window or not', () => {
    const s = game()
    s.derived.canStartRound = false
    s.derived.round = { ...s.derived.round!, downRound: true, retryIn: 5 }
    expect(keys(open(s))).toEqual([])
    s.derived.round = { ...s.derived.round, retryIn: undefined }
    expect(keys(open(s))).toEqual(['desk:round'])
  })

  it('every desk topic is a candidate; the cap keeps one per desk', () => {
    const s = game()
    s.derived.canStartRound = true
    s.derived.nextStep = { id: 'idea', index: 1, total: 5 }
    expect(keys(routeCandidates(s, { bubbleOpen: null }).filter((l) => l.kind === 'desk'))).toEqual(['desk:round', 'desk:project'])
    expect(keys(open(s))).toEqual(['desk:round'])
  })
})

describe('routeBubbles: caps', () => {
  it(`shows at most ${MAX_ACTIONABLE} actionable bubbles: decision > visitor > leaving (pinned) > desk > idle`, () => {
    const s = game()
    withDecision(s, 'investor')
    withPitch(s, true)
    s.finance.pendingPayday = { day: 30 } as PendingPayday
    s.employees = [emp('e2'), emp('e1', { status: 'leaving' })]
    // Fix round 5: two at once. The person walking out is pinned; the pitch and the payday queue.
    expect(keys(open(s))).toEqual([`decision:${cardBy('investor')}`, 'staff:e1'])
    // The decision answered: the pitch asks next, the payday still waits.
    s.decisions.active = undefined
    expect(keys(open(s))).toEqual(['visitor:pitch:vr', 'staff:e1'])
    s.employees = [emp('e2')]
    expect(keys(open(s))).toEqual(['visitor:pitch:vr', 'desk:payday'])
  })

  it('a decision asked at the desk hides the desk topic (one bubble per anchor)', () => {
    const s = game()
    withDecision(s, 'cofounder')
    s.finance.pendingPayday = { day: 30 } as PendingPayday
    s.employees = [emp('e1')]
    expect(keys(open(s))).toEqual([`decision:${cardBy('cofounder')}`, 'staff:e1'])
  })

  it('the open bubble is never capped away', () => {
    const s = game()
    withDecision(s, 'investor')
    withPitch(s, true)
    s.finance.pendingPayday = { day: 30 } as PendingPayday
    s.employees = [emp('e1')]
    expect(keys(open(s, 'staff:e1'))).toEqual(['staff:e1', `decision:${cardBy('investor')}`])
  })

  it('reflection and ambient lines only fill free slots, one ambient line at a time', () => {
    const s = game()
    withDecision(s, 'investor')
    withPitch(s, true)
    s.finance.pendingPayday = { day: 30 } as PendingPayday
    s.decisions.lastAnswer = { cardId: cardBy('cofounder'), optionIndex: 1, day: 3 }
    s.bubbles = [{ id: 'b1', lineId: 'x', speakerId: 'founder', day: 0, untilDay: 1 }]
    // Two asks fill the scene: no reflection, no ambient line.
    expect(open(s).filter((l) => l.kind === 'reflection' || l.kind === 'ambient')).toHaveLength(0)
    s.decisions.active = undefined
    s.round = undefined
    s.visitors = []
    s.finance.pendingPayday = undefined
    s.bubbles.push({ id: 'b2', lineId: 'y', speakerId: 'e9', day: 0, untilDay: 1 })
    const ls = open(s)
    expect(ls).toHaveLength(2)
    expect(ls.find((l) => l.kind === 'reflection')).toMatchObject({ key: `reflection:${cardBy('cofounder')}`, speakerId: 'desk', extra: '1' })
    expect(ls.filter((l) => l.kind === 'ambient').map((l) => l.key)).toEqual(['amb:b1'])
  })

  it(`idle builders ask ${MAX_IDLE} at a time; an open one still shows`, () => {
    const s = game()
    s.employees = [emp('e1'), emp('e2'), emp('e3')]
    expect(keys(open(s))).toEqual(['staff:e1'])
    expect(keys(open(s, 'staff:e3'))).toEqual(['staff:e3'])
    s.employees.push(emp('e4', { status: 'leaving' }))
    expect(keys(open(s))).toEqual(['staff:e4', 'staff:e1'])
  })

  it('staff needs: leaving first, each group by id', () => {
    const s = game()
    s.employees = [emp('e10'), emp('e9'), emp('e3', { status: 'leaving' }), emp('e2', { dept: 'sales' })]
    expect(keys(routeCandidates(s, { bubbleOpen: null }))).toEqual(['staff:e3', 'staff:e9', 'staff:e10'])
  })
})

describe('BubbleTimeline', () => {
  const L = (kind: RoutedLine['kind'], key: string, ref = '', speakerId = key, stamp?: string): RoutedLine => ({ kind, key, speakerId, ref, stamp })
  const shown = (r: { lines: { key: string; exiting?: boolean }[] }) => r.lines.filter((l) => !l.exiting).map((l) => l.key)

  it('delays a decision and an idle builder; a leaving employee and the desk ask at once', () => {
    const tl = new BubbleTimeline()
    const c = [L('decision', 'decision:x', 'x', 'desk2'), L('desk', 'desk:payday', 'payday', 'desk'), L('staff', 'staff:e1', 'leaving', 'e1'), L('staff', 'staff:e2', 'idle', 'e2')]
    const r0 = tl.step(c, null, 0)
    expect(shown(r0)).toEqual(['staff:e1', 'desk:payday'])
    expect(r0.nextAt).toBe(DECISION_DELAY_MS)
    // Fix round 5: the decision takes a slot, the payday queues behind the pinned leaver.
    expect(shown(tl.step(c, null, DECISION_DELAY_MS))).toEqual(['decision:x', 'staff:e1'])
    // Idle comes later and the cap (2) is already full.
    expect(shown(tl.step(c, null, IDLE_DELAY_MS))).toEqual(['decision:x', 'staff:e1'])
  })

  it('a round pill nobody opens steps back so the next desk topic can ask', () => {
    const tl = new BubbleTimeline()
    const c = [L('desk', 'desk:round', 'round', 'desk'), L('desk', 'desk:hire', 'hire', 'desk')]
    expect(shown(tl.step(c, null, 0))).toEqual(['desk:round'])
    expect(shown(tl.step(c, null, IDLE_SHOW_MS))).toEqual(['desk:hire'])
    expect(shown(tl.step(c, null, IDLE_SHOW_MS + IDLE_SNOOZE_MS))).toEqual(['desk:round'])
  })

  it('office lines keep a gap: a new one in the gap stays unsaid, the next after it speaks (P5)', () => {
    const tl = new BubbleTimeline()
    expect(shown(tl.step([L('ambient', 'amb:1', 'b1', 'e1')], null, 0))).toEqual(['amb:1'])
    expect(shown(tl.step([L('ambient', 'amb:1', 'b1', 'e1'), L('ambient', 'amb:2', 'b2', 'e2')], null, 1000))).toEqual(['amb:1'])
    const r = tl.step([L('ambient', 'amb:2', 'b2', 'e2')], null, 2000)
    expect(shown(r)).toEqual([])
    expect(r.nextAt).toBe(AMBIENT_GAP_MS)
    expect(shown(tl.step([L('ambient', 'amb:2', 'b2', 'e2')], null, AMBIENT_GAP_MS))).toEqual(['amb:2'])
  })

  it('the open bubble skips its delay', () => {
    const tl = new BubbleTimeline()
    expect(shown(tl.step([L('staff', 'staff:e2', 'idle', 'e2')], 'staff:e2', 0))).toEqual(['staff:e2'])
  })

  it('an idle builder lingers after the need clears on its own, but not after the player resolved it', () => {
    const tl = new BubbleTimeline()
    const idle = [L('staff', 'staff:e2', 'idle', 'e2')]
    tl.step(idle, null, 0)
    expect(shown(tl.step(idle, null, IDLE_DELAY_MS))).toEqual(['staff:e2'])
    const r = tl.step([], null, 1000)
    expect(shown(r)).toEqual(['staff:e2'])
    expect(r.nextAt).toBe(1000 + IDLE_LINGER_MS)
    expect(shown(tl.step(idle, null, 1500))).toEqual(['staff:e2']) // came back: no flicker
    const gone = tl.step([], null, 1600 + IDLE_LINGER_MS)
    expect(shown(gone)).toEqual(['staff:e2'])
    expect(shown(tl.step([], null, 1600 + 2 * IDLE_LINGER_MS))).toEqual([])

    const t2 = new BubbleTimeline()
    t2.step(idle, null, 0)
    t2.step(idle, 'staff:e2', IDLE_DELAY_MS)
    const after = t2.step([], null, 1000)
    expect(shown(after)).toEqual([])
    expect(after.lines).toEqual([expect.objectContaining({ key: 'staff:e2', exiting: true })])
  })

  it('keeps a removed bubble mounted as exiting for EXIT_MS, then drops it', () => {
    const tl = new BubbleTimeline()
    tl.step([L('desk', 'desk:payday', 'payday', 'desk')], null, 0)
    const r = tl.step([], null, 100)
    expect(r.lines).toEqual([expect.objectContaining({ key: 'desk:payday', exiting: true })])
    expect(r.nextAt).toBe(100 + EXIT_MS)
    expect(tl.step([], null, 100 + EXIT_MS).lines).toEqual([])
  })

  it('a pill above someone walking in waits until they stand still, then stays while they walk again', () => {
    const tl = new BubbleTimeline()
    const c = [L('visitor', 'visitor:pitch:v1', 'pitch', 'v1')]
    let walking = true
    const step = (t: number) => tl.step(c, null, t, () => true, () => walking)
    const r0 = step(0)
    expect(shown(r0)).toEqual([])
    expect(r0.nextAt).not.toBeNull()
    walking = false
    expect(shown(step(300))).toEqual(['visitor:pitch:v1'])
    walking = true
    expect(shown(step(600))).toEqual(['visitor:pitch:v1'])
    // Never longer than ARRIVE_MAX_MS, and the desk never waits.
    const t2 = new BubbleTimeline()
    const w = () => true
    expect(shown(t2.step(c, null, 0, () => true, w))).toEqual([])
    expect(shown(t2.step(c, null, ARRIVE_MAX_MS, () => true, w))).toEqual(['visitor:pitch:v1'])
    expect(shown(new BubbleTimeline().step([L('desk', 'desk:payday', 'payday', 'desk')], null, 0, () => true, w))).toEqual(['desk:payday'])
  })

  it('a decision asks above its visitor at the door after its short delay, walking or not (manual pause included)', () => {
    const tl = new BubbleTimeline()
    const c = [L('decision', 'decision:x', 'x', 'v1')]
    const walking = () => true
    expect(shown(tl.step(c, null, 0, () => true, walking))).toEqual([])
    expect(shown(tl.step(c, null, DECISION_DELAY_MS, () => true, walking))).toEqual(['decision:x'])
  })

  it('a reflection never takes the place of an actionable bubble: payday at the same desk asks at once', () => {
    const tl = new BubbleTimeline()
    tl.step([], null, 0)
    const c = [L('desk', 'desk:payday', 'payday', 'desk'), L('reflection', 'reflection:a', 'a', 'desk', '0@5')]
    expect(shown(tl.step(c, null, 10))).toEqual(['desk:payday', 'reflection:a'])
  })

  it('an idle pill nobody opens steps back after IDLE_SHOW_MS and asks again after the snooze', () => {
    const tl = new BubbleTimeline()
    const idle = [L('staff', 'staff:e2', 'idle', 'e2')]
    tl.step(idle, null, 0)
    expect(shown(tl.step(idle, null, IDLE_DELAY_MS))).toEqual(['staff:e2'])
    expect(shown(tl.step(idle, null, IDLE_DELAY_MS + IDLE_SHOW_MS))).toEqual([])
    expect(shown(tl.step(idle, null, IDLE_DELAY_MS + IDLE_SHOW_MS + IDLE_SNOOZE_MS))).toEqual(['staff:e2'])
    // The open one never snoozes.
    expect(shown(tl.step(idle, 'staff:e2', IDLE_DELAY_MS * 2 + IDLE_SHOW_MS * 2 + IDLE_SNOOZE_MS))).toEqual(['staff:e2'])
  })

  it('shows a reflection for 4 s after a new answer, never one already on record at mount', () => {
    const tl = new BubbleTimeline()
    const old = [L('reflection', 'reflection:a', 'a', 'desk', '0@1')]
    expect(shown(tl.step(old, null, 0))).toEqual([])
    const fresh = [L('reflection', 'reflection:a', 'a', 'desk', '1@5')]
    expect(shown(tl.step(fresh, null, 10))).toEqual(['reflection:a'])
    expect(shown(tl.step(fresh, null, 10 + REFLECTION_MS))).toEqual([])
  })
})

describe('routeBubbles: a tapped employee (T14)', () => {
  it('their card exists only while open, beside them', () => {
    const s = game()
    s.employees = [emp('e1', { projectId: 'p1', deskSlotId: 'd1' })]
    expect(keys(open(s))).toEqual([])
    expect(open(s, 'person:e1')).toEqual([expect.objectContaining({ kind: 'person', key: 'person:e1', speakerId: 'e1' })])
  })

  it('a gone employee has no card, and the open card takes their anchor over a staff pill', () => {
    const s = game()
    expect(keys(open(s, 'person:ghost'))).toEqual([])
    s.employees = [emp('e2', { status: 'leaving', leaveDay: 30 })]
    expect(keys(open(s, 'person:e2'))).toEqual(['person:e2'])
  })
})

describe('routeBubbles: the module question (W2c)', () => {
  const quiet = (s: GameState): GameState => {
    s.bubbles = []
    s.visitors = []
    s.decisions.active = undefined
    s.decisions.lastAnswer = undefined
    s.finance.pendingPayday = undefined
    s.round = undefined
    s.candidates = []
    s.derived = { ...s.derived, canStartRound: false, renewals: [], nextStep: undefined }
    return s
  }

  it('a finished product with a free slot and an affordable module asks at the desk, with its project as refId', () => {
    const s = quiet(company(['web']))
    const lines = open(s).filter((l) => l.kind === 'desk')
    expect(lines).toEqual([expect.objectContaining({ key: `desk:module:${s.projects[0]!.id}`, speakerId: 'desk', ref: 'module', extra: s.projects[0]!.id })])
  })

  it('only ONE module bubble at a time, oldest project first, and a build / a young product / an asked stage silences it', () => {
    const s = quiet(company(['web', 'mobile']))
    expect(open(s).filter((l) => l.ref === 'module')).toHaveLength(1)
    expect(open(s).find((l) => l.ref === 'module')!.extra).toBe(s.projects[0]!.id)
    s.flags[modulePromptFlag(s.projects[0]!.id)] = projectVersion(s.projects[0]!)
    expect(open(s).find((l) => l.ref === 'module')!.extra).toBe(s.projects[1]!.id)
    s.projects[1]!.maturity = 0.9
    expect(open(s).some((l) => l.ref === 'module')).toBe(false)
  })

  it('it yields to the payday (one desk bubble at a time) and keeps its place while open', () => {
    const s = quiet(company(['web']))
    s.finance.pendingPayday = { day: 30, deferredBefore: 0, ledger: {} } as unknown as PendingPayday
    const shown = open(s)
    expect(shown.filter((l) => l.kind === 'desk')).toHaveLength(1)
    expect(shown.find((l) => l.kind === 'desk')!.ref).toBe('payday')
    const key = `desk:module:${s.projects[0]!.id}`
    expect(keys(open(s, key))).toContain(key)
  })
})

describe('effort needs in the scene (E3)', () => {
  /** A Pre-seed office with one person per need. */
  function worn(): GameState {
    const s = game()
    s.stage = 1
    s.employees = [
      emp('e1', { fatigue: 90, projectId: 'p1' }),
      emp('e2', { fatigue: 70, projectId: 'p1' }),
      emp('e3', { status: 'leaving' }),
      emp('e4', { fatigue: 88, projectId: 'p1' }),
      emp('e5', { fatigue: 95, projectId: 'p1' }),
      emp('e6', { boredDays: 40, loadAvg: 0.3, projectId: 'p1' }),
    ]
    return s
  }
  const lines = (s: GameState) => routeCandidates(s, { bubbleOpen: null }).filter((l) => l.kind === 'staff').map((l) => `${l.speakerId}:${l.ref}`)

  it('leaving > burnout (all of them, pinned) > tired > bored, the engine capping tired + bored at 1', () => {
    expect(lines(worn())).toEqual(['e3:leaving', 'e5:burnout', 'e1:burnout', 'e4:burnout', 'e2:tired'])
    expect(MAX_TIRED_BORED).toBe(1)
  })

  it('a bored person asks when nobody is tired', () => {
    const s = worn()
    s.employees = s.employees.filter((e) => e.id === 'e6')
    expect(lines(s)).toEqual(['e6:bored'])
  })

  it('the Garage asks for none of it', () => {
    const s = worn()
    s.stage = 0
    expect(lines(s)).toEqual(['e3:leaving'])
  })

  it('burnout ranks between leaving and tired and is never capped; the tired / bored cap holds for the scene too, an open one excepted', () => {
    const L = (ref: string, id: string): RoutedLine => ({ kind: 'staff', key: `staff:${id}`, speakerId: id, ref })
    const all = [L('tired', 'a'), L('burnout', 'b'), L('leaving', 'c')]
    expect(keys(capBubbles(all, null))).toEqual(['staff:c', 'staff:b', 'staff:a'])
    const many = [L('burnout', 'a'), L('burnout', 'b'), L('burnout', 'c'), L('tired', 'd')]
    // Pinned: three burnt-out people all stay, and the tired one still gets a slot.
    expect(keys(capBubbles(many, null))).toEqual(['staff:a', 'staff:b', 'staff:c', 'staff:d'])
    expect(keys(capBubbles([L('tired', 'a'), L('bored', 'b')], null))).toEqual(['staff:a'])
    expect(keys(capBubbles([L('tired', 'a'), L('bored', 'b')], 'staff:b'))).toEqual(['staff:b'])
  })

  it('a tired pill steps back after IDLE_SHOW_MS like an idle one, a burnout pill stays', () => {
    const tl = new BubbleTimeline()
    const staff = (id: string, ref: string): RoutedLine => ({ kind: 'staff', key: `staff:${id}`, speakerId: id, ref })
    const shown = (r: { lines: { key: string; exiting?: boolean }[] }) => r.lines.filter((l) => !l.exiting).map((l) => l.key)
    const c = [staff('e1', 'tired'), staff('e2', 'burnout')]
    tl.step(c, null, 0)
    expect(shown(tl.step(c, null, IDLE_DELAY_MS))).toEqual(['staff:e2', 'staff:e1'])
    expect(shown(tl.step(c, null, IDLE_DELAY_MS + IDLE_SHOW_MS))).toEqual(['staff:e2'])
  })
})
