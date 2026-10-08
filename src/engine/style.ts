// The player's play style, read continuously from the garage on (playtest 2026-10-08: "the deck follows your
// strategy"). Pure: today's state only, so it can change as the player changes course. The four styles are the
// archetypes the run's karne already names (detectArchetype, Series A), now readable from day 0:
//   vcRocket  = buying growth with ads,  niche = selling to companies (sales calls, contracts),
//   bootstrap = price and profit first,  platform = several products at once.
// Style cards (DecisionCard.style) only come to a player whose style matches; null = no clear style yet.
import * as B from './balance'
import type { Archetype, GameState } from './types'

export type PlayStyle = Archetype

/** Each style's score from today's levers; the style is the top score once it passes STYLE_MIN_SCORE. */
export function styleScores(s: GameState): Record<PlayStyle, number> {
  const burn = Math.max(1, s.finance.burn)
  const ads = Math.max(0, s.finance.adBudget)
  const contracts = s.finance.enterpriseCustomers.length
  const enterpriseMrr = s.finance.enterpriseCustomers.reduce((a, c) => a + c.mrr, 0)
  const live = s.projects.filter((p) => p.launched).length
  return {
    vcRocket: (ads / burn) * 4,
    niche: (s.finance.mrr > 0 ? (enterpriseMrr / s.finance.mrr) * 3 : 0) + Math.min(2, contracts * 0.6),
    bootstrap: Math.max(0, s.finance.priceMultiplier - 1) * 6 + (live > 0 && s.finance.net >= 0 ? 1.2 : 0) + (s.flags['sideGig'] ? 0.6 : 0),
    platform: Math.max(0, s.projects.length - 1) * 1.1,
  }
}

export function playStyle(s: GameState): PlayStyle | null {
  const sc = styleScores(s)
  let best: PlayStyle | null = null
  let top = B.STYLE_MIN_SCORE
  for (const k of Object.keys(sc) as PlayStyle[]) {
    if (sc[k] > top) {
      top = sc[k]
      best = k
    }
  }
  return best
}
