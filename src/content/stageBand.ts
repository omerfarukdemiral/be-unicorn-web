// Growth you can feel (G1): the same words and sounds, a little bigger company each band. Cosmetic only: no rng, no
// engine state, no save. Band 1 is today's text everywhere, so a missing variant always falls back to it.
import type { NpcRole, StageIndex } from '../engine/types'
import { NPC_TEXT } from './text'
import type { DecisionCard, OfficeLine } from './types'

/** 0 Garage · 1 Pre-seed / Seed · 2 Series A / B · 3 Series C / Unicorn. */
export type StageBand = 0 | 1 | 2 | 3

export function stageBand(stage: number): StageBand {
  return stage <= 0 ? 0 : stage <= 2 ? 1 : stage <= 4 ? 2 : 3
}

/** An ambient office line in the voice of the company's size (variant or the base text). */
export function lineText(line: Pick<OfficeLine, 'text' | 'variants'>, stage: number): string {
  return line.variants?.[stageBand(stage)] ?? line.text
}

/** A card's question for the company's size (same meaning, same numbers; options are never varied). */
export function cardQuestion(card: Pick<DecisionCard, 'question' | 'questionBy'>, stage: number): string {
  return card.questionBy?.[stageBand(stage)] ?? card.question
}

/** The NPC's title for the company's size: Muhasebeci → Mali işler → CFO. */
export function npcTitle(role: NpcRole, stage: number): string {
  const n = NPC_TEXT[role]
  return n.titleBy?.[stageBand(stage)] ?? n.title
}

/** The founder's sub-label, per stage (0–6): Kurucu → Kurucu & CEO → CEO → Unicorn CEO. */
const FOUNDER_SUB: readonly string[] = ['Kurucu', 'Kurucu', 'Kurucu & CEO', 'CEO', 'CEO', 'CEO', 'Unicorn CEO']

export function founderSub(stage: StageIndex | number): string {
  return FOUNDER_SUB[Math.min(Math.max(stage, 0), FOUNDER_SUB.length - 1)]!
}

/**
 * System voice per band (≤ 6 words), keyed by an existing UI_TEXT key: the table only overrides, the key's own text
 * is band 1. Read through i18n's stageText; keys here must exist in UI_TEXT (test).
 */
export const STAGE_TEXT: Readonly<Record<string, Partial<Record<StageBand, string>>>> = {
  'bubble.payday': { 2: 'Bordro günü · {v}', 3: 'Bordro · {v}' },
}
