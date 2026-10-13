// E2: a managed office must not nag. From Series B on, with a 28+ person office (the bots top out at 28 in B, 36 in C), the effort bubbles over the people (tired, burnout,
// bored; 'leaving' and 'idle' are older needs) may start at most once a game minute, median over the seeds.
import { describe, expect, it } from 'vitest'
import { CONTENT } from '../../src/content/index'
import { SECONDS_PER_DAY, staffAttention } from '../../src/engine/index'
import { playBot } from '../bots'

const SERIES_B = 4
const MIN_TEAM = 28
const SEEDS = [1, 2, 3]
const DAYS_PER_MINUTE = 60 / SECONDS_PER_DAY

/** Bubbles started per game minute on Series B+ days with a big office: a (person, need) pair that was not asking yesterday. */
function bubblesPerMinute(seed: number): { rate: number; days: number } {
  let prev = new Set<string>()
  let started = 0
  let days = 0
  let last = -1
  playBot('vcRocket', seed, CONTENT, 3600, (s) => {
    const day = Math.floor(s.time.day)
    if (day === last) return
    last = day
    const now = new Set(staffAttention(s).filter(([, need]) => need === 'tired' || need === 'burnout' || need === 'bored').map(([id, need]) => `${id}:${need}`))
    if (s.stage >= SERIES_B && s.employees.length >= MIN_TEAM) {
      days++
      for (const k of now) if (!prev.has(k)) started++
    }
    prev = now
  })
  return { rate: days ? (started / days) * DAYS_PER_MINUTE : 0, days }
}

describe('effort bubbles', () => {
  it('a managed big office from Series B asks at most once a minute (median)', { timeout: 300_000 }, () => {
    const runs = SEEDS.map(bubblesPerMinute)
    const measured = runs.filter((r) => r.days > 0).map((r) => r.rate).sort((a, b) => a - b)
    expect(measured.length).toBeGreaterThan(0)
    expect(measured[Math.floor(measured.length / 2)]!).toBeLessThanOrEqual(1)
  })
})
