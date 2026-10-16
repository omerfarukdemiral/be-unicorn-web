// F5 guard: a playtest run went back to the menu around day 765. The engine is not the cause: archetypes played to
// day 900 never throw, never end near the two-year mark, and the save stays small (localStorage quota ~5 MB).
import { describe, expect, it } from 'vitest'
import { CONTENT } from '../../src/content/index'
import { serialize } from '../../src/engine'
import { playBot, type BotKind } from '../bots'

const DAYS = 900
const SAVE_MAX_CHARS = 150_000

describe('long run to day 900 (F5)', () => {
  for (const kind of ['bootstrap', 'vcRocket', 'niche', 'platform'] as BotKind[]) {
    for (const seed of [1]) {
      it(`${kind} #${seed}: no throw, no ending, save under ${SAVE_MAX_CHARS / 1000}k`, { timeout: 120_000 }, () => {
        let maxSave = 0
        let lastDay = 0
        let ended: string | null = null
        playBot(kind, seed, CONTENT, DAYS, (s) => {
          const d = Math.floor(s.time.day)
          if (d >= lastDay + 150) {
            lastDay = d
            maxSave = Math.max(maxSave, serialize(s).length)
          }
          if (s.gameOver && !ended) ended = `${s.gameOver.kind}@${Math.round(s.gameOver.day)}`
        })
        expect(ended).toBeNull()
        expect(lastDay).toBeGreaterThanOrEqual(750)
        expect(maxSave).toBeGreaterThan(0)
        expect(maxSave).toBeLessThan(SAVE_MAX_CHARS)
      })
    }
  }
})
