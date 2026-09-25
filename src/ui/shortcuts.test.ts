// Keyboard map: L (Liderlik) must not collide with a dock tab, a speed key or zoom.
import { describe, expect, it } from 'vitest'
import { DOCK_TABS } from './Dock'
import { LEADERBOARD_KEY } from './shortcuts'

describe('shortcuts', () => {
  it('L opens Liderlik without stealing another key', () => {
    const taken = [...DOCK_TABS.map((d) => d.key), '1', '2', '3', '+', '=', '-', '_', ' ', 'escape']
    expect(taken).not.toContain(LEADERBOARD_KEY)
    expect(new Set(DOCK_TABS.map((d) => d.key)).size).toBe(DOCK_TABS.length)
  })
})
