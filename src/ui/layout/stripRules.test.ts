// Notification strip rules (docs/LAYOUT.md §3, docs/GAMEPLAY_V2.md §12): one item at a time, priorities, queue,
// merging, 4× timing, activity de-duplication, the daily budget and when the resting next step hides.
import { describe, expect, it } from 'vitest'
import {
  activityShown,
  admit,
  admitOfficeLine,
  dailyBudget,
  DEDUPE_DAYS,
  enqueue,
  nextHover,
  nextStepShown,
  P2_PER_DAY,
  pickSlot,
  priorityOf,
  readDigest,
  SAME_STORY_MS,
  STRIP_ACTIVITY,
  STRIP_LIFE_MS,
  STRIP_QUEUE_MAX,
  stripClockRuns,
  stripLifeMs,
  stripVisible,
  type QueueItem,
  type TransientKind,
} from './stripRules'

const q = (key: number, kind: TransientKind): QueueItem => ({ key, kind })
const keys = (xs: readonly QueueItem[]) => xs.map((x) => x.key)

describe('strip priority', () => {
  it('P0 bankruptcy beats everything, a P0 transient beats placing, placing beats P2, next step rests last', () => {
    expect(pickSlot({ bankrupt: true, placing: true, nextStep: true, front: q(1, 'runwayLow') })).toBe('bankrupt')
    expect(pickSlot({ bankrupt: false, placing: true, nextStep: true, front: q(1, 'runwayLow') })).toBe('queue')
    expect(pickSlot({ bankrupt: false, placing: true, nextStep: true, front: q(1, 'receipt') })).toBe('placing')
    expect(pickSlot({ bankrupt: false, placing: false, nextStep: true, front: q(1, 'receipt') })).toBe('queue')
    expect(pickSlot({ bankrupt: false, placing: false, nextStep: true })).toBe('nextStep')
    expect(pickSlot({ bankrupt: false, placing: false, nextStep: false })).toBe('empty')
  })

  it('only the runway drop is a P0 transient; cash-tension alarms are P1; the rest are P2', () => {
    expect(priorityOf('runwayLow')).toBe(0)
    for (const k of ['paydayShort', 'crisis', 'loanCalled', 'roundFailed', 'boardMissed'] as const) expect(priorityOf(k)).toBe(1)
    for (const k of ['error', 'receipt', 'release', 'outcome', 'activity'] as const) expect(priorityOf(k)).toBe(2)
  })

  it('a P1 alarm beats placing and waits only behind a P0', () => {
    expect(pickSlot({ bankrupt: false, placing: true, nextStep: true, front: q(1, 'paydayShort') })).toBe('queue')
    expect(keys(enqueue([q(1, 'runwayLow'), q(2, 'release')], [q(3, 'crisis')]))).toEqual([1, 3, 2])
    expect(keys(enqueue([q(1, 'crisis'), q(2, 'release')], [q(3, 'error')]))).toEqual([1, 3, 2])
  })
})

describe('strip queue', () => {
  it('shows one item; at most 3 wait, the oldest WAITING one drops, never the one on screen', () => {
    let cur: QueueItem[] = []
    cur = enqueue(cur, [q(1, 'release'), q(2, 'outcome'), q(3, 'outcome'), q(4, 'receipt'), q(5, 'release')])
    expect(cur).toHaveLength(1 + STRIP_QUEUE_MAX)
    expect(cur[0]?.key).toBe(1)
    expect(keys(cur)).not.toContain(2)
  })

  it('activity never pushes a moment out: waiting activity goes first', () => {
    expect(keys(enqueue([q(1, 'outcome')], [q(2, 'release'), q(3, 'outcome'), q(4, 'activity'), q(5, 'activity')]))).toEqual([1, 2, 3, 5])
    expect(keys(enqueue([q(1, 'receipt')], [q(2, 'outcome'), q(3, 'activity'), q(4, 'activity'), q(5, 'activity')]))).toEqual([1, 2, 4, 5])
    expect(keys(enqueue([q(1, 'receipt')], [q(2, 'activity'), q(3, 'release'), q(4, 'outcome'), q(5, 'outcome')]))).toEqual([1, 3, 4, 5])
    const burst = enqueue([q(1, 'activity')], [q(2, 'receipt'), q(3, 'release'), q(4, 'outcome'), ...[5, 6, 7, 8].map((k) => q(k, 'activity'))])
    expect(keys(burst)).toEqual([1, 2, 3, 4])
  })

  it('a newer receipt replaces the older one in place', () => {
    const cur = [q(1, 'receipt'), q(2, 'release'), q(3, 'outcome')]
    expect(keys(enqueue(cur, [q(4, 'receipt')]))).toEqual([4, 2, 3])
  })

  it('an error jumps the queue (behind a P0), a newer error replaces the older one', () => {
    let cur = [q(1, 'release'), q(2, 'outcome')]
    cur = enqueue(cur, [q(3, 'error')])
    expect(keys(cur)).toEqual([3, 1, 2])
    cur = enqueue(cur, [q(4, 'error')])
    expect(keys(cur)).toEqual([4, 1, 2])
    cur = enqueue([q(9, 'runwayLow'), q(1, 'release')], [q(5, 'error')])
    expect(keys(cur)).toEqual([9, 5, 1])
  })

  it('the runway P0 goes to the very front', () => {
    expect(keys(enqueue([q(1, 'error'), q(2, 'release')], [q(3, 'runwayLow')]))).toEqual([3, 1, 2])
  })

  it('at 4× no more than 2 of one kind are queued', () => {
    const cur = enqueue([], [q(1, 'activity'), q(2, 'activity'), q(3, 'activity')], { fast: true })
    expect(cur.filter((x) => x.kind === 'activity')).toHaveLength(2)
    expect(cur[0]?.key).toBe(1)
    const slow = enqueue([], [q(1, 'activity'), q(2, 'activity'), q(3, 'activity')])
    expect(slow.filter((x) => x.kind === 'activity')).toHaveLength(3)
  })
})

describe('strip timing', () => {
  it('transient items close within 6 s; at 4× 0.75× with a 2.5 s floor', () => {
    for (const [k, ms] of Object.entries(STRIP_LIFE_MS) as [TransientKind, number][]) {
      expect(ms).toBeLessThanOrEqual(6000)
      expect(stripLifeMs(k, 1)).toBe(ms)
      expect(stripLifeMs(k, 4)).toBe(Math.max(2500, Math.round(ms * 0.75)))
    }
    expect(stripLifeMs('error', 4)).toBe(2500)
    expect(stripLifeMs('runwayLow', 4)).toBe(4500)
  })
})

describe('activity in the strip', () => {
  it('announces only the listed kinds', () => {
    expect(activityShown('hired', [], 0)).toBe(true)
    expect(activityShown('itemPlaced', [], 0)).toBe(false)
    expect(activityShown('payday', [], 0)).toBe(false)
    expect(STRIP_ACTIVITY.has('payrollMissed')).toBe(false)
  })

  it('diet (D9): milestones, founder actions and round beats stay out; no achievement ever enters', () => {
    for (const k of ['milestone', 'founderActionDone', 'roundStarted', 'roundWindow', 'goalDone'] as const) {
      expect(STRIP_ACTIVITY.has(k), k).toBe(false)
      expect(activityShown(k, [], 0)).toBe(false)
    }
  })

  it('hides an entry when a moment told the same story within 2 s', () => {
    const recent = [{ kind: 'release' as const, at: 1000 }]
    expect(activityShown('projectLaunched', recent, 1000 + SAME_STORY_MS)).toBe(false)
    expect(activityShown('projectLaunched', recent, 1000 + SAME_STORY_MS + 1)).toBe(true)
    expect(activityShown('hired', recent, 1000)).toBe(true)
  })
})

describe('next step (resting item)', () => {
  const base = { hasStep: true, startCall: false, stepId: 'users', canStartRound: false, over: false, sheetOpen: false }
  it('shows by default and hides under the start card, when the top bar offers the round, after the end, under a sheet', () => {
    expect(nextStepShown(base)).toBe(true)
    expect(nextStepShown({ ...base, startCall: true })).toBe(false)
    expect(nextStepShown({ ...base, stepId: 'round', canStartRound: true })).toBe(false)
    expect(nextStepShown({ ...base, stepId: 'round', canStartRound: false })).toBe(true)
    expect(nextStepShown({ ...base, over: true })).toBe(false)
    expect(nextStepShown({ ...base, sheetOpen: true })).toBe(false)
    expect(nextStepShown({ ...base, hasStep: false })).toBe(false)
  })
})

describe('strip queue: mixed kinds over the cap', () => {
  it('moments and activity mixed: overflow drops waiting activity, never a moment first', () => {
    let out = enqueue([], [q(1, 'receipt'), q(2, 'activity'), q(3, 'release'), q(4, 'activity')])
    expect(keys(out)).toEqual([1, 2, 3, 4])
    out = enqueue(out, [q(5, 'outcome')])
    expect(keys(out)).toEqual([1, 3, 4, 5])
    out = enqueue(out, [q(6, 'activity')])
    expect(out.filter((x) => x.kind !== 'activity').map((x) => x.key)).toEqual([1, 3, 5])
    expect(out.length).toBe(1 + STRIP_QUEUE_MAX)
  })
})

describe('strip clock and hover', () => {
  it('the life clock runs only for a queue item on screen, not hovered, not under an overlay', () => {
    const base = { slot: 'queue' as const, hasFront: true, hover: false, overlay: false }
    expect(stripClockRuns(base)).toBe(true)
    expect(stripClockRuns({ ...base, hover: true })).toBe(false)
    expect(stripClockRuns({ ...base, overlay: true })).toBe(false)
    expect(stripClockRuns({ ...base, hasFront: false })).toBe(false)
    expect(stripClockRuns({ ...base, slot: 'placing' })).toBe(false)
  })

  it('a hover left over from a strip that stopped rendering is cleared, so the next item still expires', () => {
    // Hovered item; it is clicked away and the slot empties (the element unmounts, no mouseleave).
    expect(nextHover(true, 'queue', false)).toBe(true)
    expect(stripVisible('empty', false)).toBe(false)
    const hover = nextHover(true, 'empty', false)
    expect(hover).toBe(false)
    // A new item arrives: its clock runs.
    expect(stripClockRuns({ slot: 'queue', hasFront: true, hover, overlay: false })).toBe(true)
    // Phone: the resting next step hides under the sheet, which also drops the hover.
    expect(nextHover(true, 'nextStep', true)).toBe(false)
    expect(nextHover(true, 'nextStep', false)).toBe(true)
  })
})

describe('daily budget (docs/GAMEPLAY_V2.md §12 D9)', () => {
  /** Runs items through the budget on one day; returns the verdicts. */
  function run(items: { kind: TransientKind; dedupeKey?: string }[], day: number, start = dailyBudget(day)) {
    let b = start
    const out: string[] = []
    for (const it of items) {
      const [v, next] = admit(b, it, day)
      b = next
      out.push(v)
    }
    return { out, b }
  }

  it('the 3rd P2 of a game day falls into the digest; the next day refills', () => {
    const { out, b } = run([{ kind: 'activity' }, { kind: 'release' }, { kind: 'outcome' }, { kind: 'activity' }], 10.2)
    expect(P2_PER_DAY).toBe(2)
    expect(out).toEqual(['show', 'show', 'digest', 'digest'])
    expect(b.digest).toBe(2)
    const next = run([{ kind: 'activity' }], 11.1, b)
    expect(next.out).toEqual(['show'])
    expect(next.b.digest).toBe(2)
    expect(readDigest(next.b).digest).toBe(0)
  })

  it('P0 / P1 pierce the quota; the month receipt and errors are quota-free', () => {
    const { out } = run([{ kind: 'activity' }, { kind: 'activity' }, { kind: 'runwayLow' }, { kind: 'crisis' }, { kind: 'receipt' }, { kind: 'error' }, { kind: 'activity' }], 3)
    expect(out).toEqual(['show', 'show', 'show', 'show', 'show', 'show', 'digest'])
  })

  it('the same dedupeKey does not come back within 30 days', () => {
    let { b } = run([{ kind: 'activity', dedupeKey: 'rivalPassed:nova' }], 100)
    expect(admit(b, { kind: 'activity', dedupeKey: 'rivalPassed:nova' }, 101)[0]).toBe('skip')
    expect(admit(b, { kind: 'paydayShort', dedupeKey: 'rivalPassed:nova' }, 100 + DEDUPE_DAYS - 1)[0]).toBe('skip')
    expect(admit(b, { kind: 'activity', dedupeKey: 'rivalPassed:other' }, 101)[0]).toBe('show')
    ;[, b] = admit(b, { kind: 'activity' }, 100 + DEDUPE_DAYS)
    expect(admit(b, { kind: 'activity', dedupeKey: 'rivalPassed:nova' }, 100 + DEDUPE_DAYS)[0]).toBe('show')
  })

  it('goalDone never reaches the strip (no goal moment, not an announced activity)', () => {
    expect(activityShown('goalDone', [], 0)).toBe(false)
    expect(Object.keys(STRIP_LIFE_MS)).not.toContain('goal')
  })

  it('office lines: at most one a game day, only hire / fire / resign / crisis', () => {
    let b = dailyBudget(5)
    let ok: boolean
    ;[ok, b] = admitOfficeLine(b, 'milestone', 5)
    expect(ok).toBe(false)
    ;[ok, b] = admitOfficeLine(b, 'idle', 5)
    expect(ok).toBe(false)
    ;[ok, b] = admitOfficeLine(b, 'hire', 5.3)
    expect(ok).toBe(true)
    ;[ok, b] = admitOfficeLine(b, 'resign', 5.8)
    expect(ok).toBe(false)
    ;[ok, b] = admitOfficeLine(b, 'fire', 6)
    expect(ok).toBe(true)
    expect(admitOfficeLine(b, undefined, 7)[0]).toBe(false)
  })

  it('4× for a game month: at most 2 P2 a day reach the strip, one receipt a month', () => {
    let b = dailyBudget(0)
    let shownP2 = 0
    let receipts = 0
    // A noisy month: 5 activity items and a release every day, the payday receipt on day 30.
    for (let day = 0; day < 30; day++) {
      let today = 0
      for (const kind of ['activity', 'activity', 'release', 'activity', 'activity', 'activity'] as const) {
        const [v, next] = admit(b, { kind }, day + 0.5)
        b = next
        if (v === 'show') today++
      }
      expect(today).toBeLessThanOrEqual(P2_PER_DAY)
      shownP2 += today
    }
    const [v] = admit(b, { kind: 'receipt' }, 30)
    if (v === 'show') receipts++
    expect(shownP2).toBeLessThanOrEqual(P2_PER_DAY * 30)
    expect(receipts).toBe(1)
  })

  it('a new run (earlier day) starts a clean budget', () => {
    const { b } = run([{ kind: 'activity', dedupeKey: 'x' }, { kind: 'activity' }, { kind: 'activity' }], 400)
    const fresh = dailyBudget(0, b)
    expect(fresh).toEqual({ day: 0, p2: 0, office: 0, digest: 0, seen: {} })
  })
})
