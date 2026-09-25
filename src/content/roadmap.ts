// Unicorn yolu (PLAN §3.1): one short "what opens" line per stage for the top-bar stepper + Yol haritası panel.
// Office, target valuation and the round come from STAGES; this adds only the player-facing unlock line (≤ 6 words).
import type { StageIndex } from '../engine/types'

export interface RoadmapStep {
  stage: StageIndex
  /** What this stage opens, ≤ 6 words. */
  unlock: string
}

export const ROADMAP_STEPS: readonly RoadmapStep[] = [
  { stage: 0, unlock: 'Bir masa, elle kullanıcı avı' },
  { stage: 1, unlock: 'Ortak alan, cap table' },
  { stage: 2, unlock: 'Toplantı odası, satış görüşmesi' },
  { stage: 3, unlock: 'Reklam bütçesi, LTV:CAC paneli' },
  { stage: 4, unlock: 'Sunucu odası, kurumsal satış' },
  { stage: 5, unlock: 'Sahne ve lab slotları' },
  { stage: 6, unlock: 'Kampüs. Oyun biter, efsane başlar.' },
]
