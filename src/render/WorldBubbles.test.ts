import { describe, expect, it } from 'vitest'
import { DECISIONS } from '../content'
import { createGame } from '../engine'
import type { Employee, GameState, PendingPayday, RenewalView, RoundState } from '../engine/types'
import {
  BubbleTimeline,
  DECISION_DELAY_MS,
  EXIT_MS,
  IDLE_DELAY_MS,
  IDLE_LINGER_MS,
  IDLE_SHOW_MS,
  IDLE_SNOOZE_MS,
  ARRIVE_MAX_MS,
  MAX_ACTIONABLE,
  MAX_IDLE,
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
  it(`shows at most ${MAX_ACTIONABLE} actionable bubbles: decision > visitor > desk > leaving > idle`, () => {
    const s = game()
    withDecision(s, 'investor')
    withPitch(s, true)
    s.finance.pendingPayday = { day: 30 } as PendingPayday
    s.employees = [emp('e2'), emp('e1', { status: 'leaving' })]
    expect(keys(open(s))).toEqual([`decision:${cardBy('investor')}`, 'visitor:pitch:vr', 'desk:payday'])
    // Without the pitch, the person walking out gets the third slot before the idle builder.
    s.round = undefined
    s.visitors = s.visitors.filter((v) => v.id !== 'vr')
    expect(keys(open(s))).toEqual([`decision:${cardBy('investor')}`, 'desk:payday', 'staff:e1'])
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
    expect(keys(open(s, 'staff:e1'))).toEqual(['staff:e1', `decision:${cardBy('investor')}`, 'visitor:pitch:vr'])
  })

  it('reflection and ambient lines do not count against the cap', () => {
    const s = game()
    withDecision(s, 'investor')
    withPitch(s, true)
    s.finance.pendingPayday = { day: 30 } as PendingPayday
    s.decisions.lastAnswer = { cardId: cardBy('cofounder'), optionIndex: 1, day: 3 }
    s.bubbles = [{ id: 'b1', lineId: 'x', speakerId: 'founder', day: 0, untilDay: 1 }]
    const ls = open(s)
    expect(ls.filter((l) => l.kind !== 'reflection' && l.kind !== 'ambient')).toHaveLength(3)
    expect(ls.find((l) => l.kind === 'reflection')).toMatchObject({ key: `reflection:${cardBy('cofounder')}`, speakerId: 'desk', extra: '1' })
    expect(ls.find((l) => l.kind === 'ambient')).toMatchObject({ key: 'amb:b1', speakerId: 'founder' })
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
    expect(shown(r0)).toEqual(['desk:payday', 'staff:e1'])
    expect(r0.nextAt).toBe(DECISION_DELAY_MS)
    expect(shown(tl.step(c, null, DECISION_DELAY_MS))).toEqual(['decision:x', 'desk:payday', 'staff:e1'])
    // Idle comes later and the cap (3) is already full.
    expect(shown(tl.step(c, null, IDLE_DELAY_MS))).toEqual(['decision:x', 'desk:payday', 'staff:e1'])
  })

  it('a round pill nobody opens steps back so the next desk topic can ask', () => {
    const tl = new BubbleTimeline()
    const c = [L('desk', 'desk:round', 'round', 'desk'), L('desk', 'desk:hire', 'hire', 'desk')]
    expect(shown(tl.step(c, null, 0))).toEqual(['desk:round'])
    expect(shown(tl.step(c, null, IDLE_SHOW_MS))).toEqual(['desk:hire'])
    expect(shown(tl.step(c, null, IDLE_SHOW_MS + IDLE_SNOOZE_MS))).toEqual(['desk:round'])
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
