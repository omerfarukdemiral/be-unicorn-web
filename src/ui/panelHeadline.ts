// The number on the right of the RightPanel head (docs/GAMEPLAY_V2.md §10.3): each panel kind shows its one
// primary figure (Ekip "N · −$X/ay", Mağaza Kasa, Büyüme MRR, Projeler olgunluk…). Pure: it only picks engine
// numbers (state / finance / derived, and cashflow's usable Kasa so the head matches the HUD chip), never computes a
// formula; RightPanel formats and draws them behind a one-word label, since each panel's figure means something else.
import { CONCEPT_IDS, type GameState } from '../engine/types'
import type { Panel } from '../store/types'
import { cashFlow } from './cashflow'

/** How the number prints: money ($12K), Kasa in the HUD chip's own format ($15,098), money per month (−$4.2K/ay),
 * a 0–1 fraction (%64), people (3 kişi), a count out of `of` (4/12), founder energy (Enerji 64/100), a game day. */
export type HeadlineUnit = 'money' | 'cash' | 'perMonth' | 'pct' | 'people' | 'count' | 'energy' | 'day'

export interface HeadlineValue {
  value: number
  unit: HeadlineUnit
  /** `count` only: the whole it is counted against, so a lone number never stands without meaning. */
  of?: number
}

export interface PanelHeadline extends HeadlineValue {
  /** i18n key of the one-word label drawn before the figure (Kasa, MRR, Değerleme…). */
  label: string
  /** Smaller second figure after a "·" (Ekip: the monthly payroll). */
  sub?: HeadlineValue
  /** The number is in the danger band (one red rule: usable Kasa < 0). */
  danger?: boolean
}

/** Primary number of `panel` (null: nothing honest to show, e.g. a visitor or an empty slot). */
export function panelHeadline(s: GameState, panel: Panel): PanelHeadline | null {
  switch (panel.kind) {
    case 'shop':
    case 'decision': {
      // Buying and most card options are paid from Kasa: the usable figure the HUD chip shows, not the bank balance.
      const usable = cashFlow(s).usable
      return { label: 'hud.cash', value: usable, unit: 'cash', danger: usable < 0 }
    }
    case 'team':
      return { label: 'head.roster', value: s.employees.length, unit: 'people', sub: { value: -s.finance.burnBreakdown.salaries, unit: 'perMonth' } }
    case 'projects':
      return { label: 'projects.maturity', value: s.derived.avgMaturity, unit: 'pct' }
    case 'growth':
      return { label: 'head.mrr', value: s.finance.mrr, unit: 'money' }
    case 'metrics':
      return { label: 'head.mom', value: s.derived.momGrowth, unit: 'pct' }
    case 'journal':
      return { label: 'journal.shelf', value: s.concepts.learned.length, unit: 'count', of: CONCEPT_IDS.length }
    case 'roadmap':
      return { label: 'head.stage', value: s.derived.stageProgress, unit: 'pct' }
    case 'leaderboard':
      return { label: 'head.valuation', value: s.finance.valuation, unit: 'money' }
    case 'settings':
      return { label: 'head.day', value: Math.floor(s.time.day) + 1, unit: 'day' }
    // The detail head draws DetailHeader, not this number; the figure is kept for the selection's own readouts.
    case 'detail': {
      const sel = panel.selection
      if (sel.kind === 'employee') {
        const e = s.employees.find((x) => x.id === sel.id)
        return e ? { label: 'detail.salary', value: -e.salary, unit: 'perMonth' } : null
      }
      if (sel.kind === 'project') {
        const p = s.projects.find((x) => x.id === sel.id)
        return p ? { label: 'detail.maturity', value: p.maturity, unit: 'pct' } : null
      }
      if (sel.kind === 'founder') return { label: 'founder.energy', value: s.founder.energy, unit: 'energy' }
      return null
    }
  }
}
