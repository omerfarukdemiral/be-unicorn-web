// GAMEPLAY V2 §9.4 teasers: what the next stage opens, ≤ 6 words (the ghost at the end of the stage line, the month
// receipt). Keyed by the stage the player is on; Unicorn's line points at the archetypes not yet walked.
import type { StageIndex } from '../engine/types'

export const TEASERS: Readonly<Record<StageIndex, string>> = {
  0: 'Pre-seed: ekip masası açılır',
  1: 'Seed: rakibin adı öğrenilir',
  2: 'A: reklam, pazar, kurul',
  3: 'B: kurumsal satış, balina müşteri',
  4: 'C: çıkış penceresi açılır',
  5: 'Unicorn: kurucu karnesi',
  6: "4 yoldan 1'i yürüdün",
}
