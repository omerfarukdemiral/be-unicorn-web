// Keyboard map: L (Liderlik), K (Kazanımlar) and the center-screen keys (I İstatistik) must not collide with a dock
// tab, a speed key, zoom or each other.
import { describe, expect, it } from 'vitest'
import { DOCK_TABS } from './Dock'
import { ACHIEVEMENTS_KEY, CENTER_KEYS, LEADERBOARD_KEY } from './shortcuts'

const FIXED = ['1', '2', '3', '+', '=', '-', '_', ' ', 'escape']

describe('shortcuts', () => {
  it('L opens Liderlik without stealing another key', () => {
    const taken = [...DOCK_TABS.map((d) => d.key), ...FIXED]
    expect(taken).not.toContain(LEADERBOARD_KEY)
    expect(new Set(DOCK_TABS.map((d) => d.key)).size).toBe(DOCK_TABS.length)
  })

  it('five dock tabs; K moved to the Kazanımlar icon', () => {
    expect(DOCK_TABS.map((d) => d.id)).toEqual(['shop', 'team', 'projects', 'growth', 'metrics'])
    expect(ACHIEVEMENTS_KEY).toBe('k')
  })

  it('i / l / m / k: every key has one owner (dock, Liderlik, Kazanımlar, center screens, speed, zoom)', () => {
    const all = [...DOCK_TABS.map((d) => d.key), LEADERBOARD_KEY, ACHIEVEMENTS_KEY, ...Object.keys(CENTER_KEYS), ...FIXED]
    expect(new Set(all).size).toBe(all.length)
    expect(CENTER_KEYS.i).toBe('stats')
    for (const k of ['i', 'l', 'm', 'k', 'y', 'h']) expect(all.filter((x) => x === k)).toHaveLength(1)
  })

  it('y / h open Kanun Kitabı and Pazar haritası, clear of the dock, Liderlik and Kazanımlar', () => {
    expect(CENTER_KEYS.y).toBe('lawbook')
    expect(CENTER_KEYS.h).toBe('market')
    const others = [...DOCK_TABS.map((d) => d.key), LEADERBOARD_KEY, ACHIEVEMENTS_KEY]
    for (const k of ['y', 'h']) expect(others).not.toContain(k)
    expect(new Set(Object.values(CENTER_KEYS))).toEqual(new Set(['stats', 'lawbook', 'market']))
  })
})
