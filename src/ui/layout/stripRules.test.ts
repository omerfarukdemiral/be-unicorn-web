// Notification strip rules (docs/LAYOUT.md §3): one item at a time, priorities, queue, merging, 4× timing,
// activity de-duplication and when the resting next step hides.
import { describe, expect, it } from 'vitest'
import {
  activityShown,
  enqueue,
  nextStepShown,
  pickSlot,
  priorityOf,
  SAME_STORY_MS,
  STRIP_ACTIVITY,
  STRIP_LIFE_MS,
  STRIP_QUEUE_MAX,
  stripLifeMs,
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

  it('only the runway drop is a P0 transient; the rest are P2', () => {
    expect(priorityOf('runwayLow')).toBe(0)
    for (const k of ['error', 'receipt', 'release', 'outcome', 'goal', 'roundWindow', 'roundWeek', 'newMetric', 'activity'] as const) expect(priorityOf(k)).toBe(2)
  })
})

describe('strip queue', () => {
  it('shows one item; at most 3 wait, the oldest WAITING one drops, never the one on screen', () => {
    let cur: QueueItem[] = []
    cur = enqueue(cur, [q(1, 'release'), q(2, 'goal'), q(3, 'outcome'), q(4, 'activity'), q(5, 'newMetric')])
    expect(cur).toHaveLength(1 + STRIP_QUEUE_MAX)
    expect(cur[0]?.key).toBe(1)
    expect(keys(cur)).not.toContain(2)
  })

  it('a newer receipt / round week replaces the older one in place', () => {
    const cur = [q(1, 'receipt'), q(2, 'release'), q(3, 'roundWeek')]
    expect(keys(enqueue(cur, [q(4, 'receipt'), q(5, 'roundWeek')]))).toEqual([4, 2, 5])
  })

  it('an error jumps the queue (behind a P0), a newer error replaces the older one', () => {
    let cur = [q(1, 'release'), q(2, 'goal')]
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
    expect(stripLifeMs('newMetric', 4)).toBe(3750)
  })
})

describe('activity in the strip', () => {
  it('announces only the listed kinds', () => {
    expect(activityShown('hired', [], 0)).toBe(true)
    expect(activityShown('itemPlaced', [], 0)).toBe(false)
    expect(activityShown('payday', [], 0)).toBe(false)
    expect(STRIP_ACTIVITY.has('payrollMissed')).toBe(false)
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
