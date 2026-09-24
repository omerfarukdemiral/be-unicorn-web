// The moments' rules (docs/CORE_LOOP.md §7 "Popup bütçesi"): ≤ 4 s, a burst merged without dropping the one on
// screen, the panel each opens. Strip queue / 4× timing: layout/stripRules.test.ts.
import { describe, expect, it } from 'vitest'
import { mergeMoments, MOMENT_LIFE_MS, MOMENT_QUEUE_MAX, momentPanel, type MomentKind } from './momentRules'
import { runwayTone, ledgerMoney } from './widgets'

const m = (key: number, kind: MomentKind) => ({ key, kind })

describe('moment cards', () => {
  it('every card closes by itself within 4 s', () => {
    for (const ms of Object.values(MOMENT_LIFE_MS)) expect(ms).toBeLessThanOrEqual(4000)
  })

  it('a newer receipt / round week replaces the older one in place; others queue', () => {
    const cur = [m(1, 'receipt'), m(2, 'release')]
    const out = mergeMoments(cur, [m(3, 'receipt'), m(4, 'goal')], 2)
    expect(out.map((x) => x.key)).toEqual([3, 2, 4])
  })

  it('over the limit the oldest WAITING card goes, never one on screen', () => {
    const shown = 2
    const cur = [m(1, 'release'), m(2, 'goal')]
    const burst = [m(3, 'outcome'), m(4, 'release'), m(5, 'goal'), m(6, 'roundWindow')]
    const out = mergeMoments(cur, burst, shown)
    expect(out).toHaveLength(shown + MOMENT_QUEUE_MAX)
    expect(out.slice(0, 2).map((x) => x.key)).toEqual([1, 2])
    expect(out.map((x) => x.key)).not.toContain(3)
  })

  it('each card opens its panel (never a pause: panels that pause are only decision / Defter / round offer)', () => {
    expect(momentPanel('receipt')).toEqual({ kind: 'metrics', focus: 'burnBreakdown' })
    expect(momentPanel('release')).toEqual({ kind: 'projects' })
    expect(momentPanel('goal')).toEqual({ kind: 'growth' })
    expect(momentPanel('outcome')).toEqual({ kind: 'growth' })
    expect(momentPanel('roundWindow')).toEqual({ kind: 'growth', section: 'round' })
    expect(momentPanel('roundWeek')).toEqual({ kind: 'growth', section: 'round' })
  })
})

describe('Kasa widget rules', () => {
  it('runway colour bands: > 12 neutral, 6–12 amber, 3–6 orange, < 3 red', () => {
    expect(runwayTone(null)).toBe('calm')
    expect(runwayTone(14)).toBe('calm')
    expect(runwayTone(12)).toBe('amber')
    expect(runwayTone(6)).toBe('amber')
    expect(runwayTone(5.9)).toBe('orange')
    expect(runwayTone(3)).toBe('orange')
    expect(runwayTone(2.9)).toBe('red')
  })

  it('whole dollars under $100K, short above', () => {
    expect(ledgerMoney(15_000)).toBe('$15,000')
    expect(ledgerMoney(14_950.4)).toBe('$14,950')
    expect(ledgerMoney(-1_200)).toBe('−$1,200')
    expect(ledgerMoney(250_000)).toBe('$250.0K')
    expect(ledgerMoney(2_500_000)).toBe('$2.50M')
  })
})
