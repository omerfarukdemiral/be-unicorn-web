// Round meetings in the ui: one icon per answer, the meeting's line ("Büyümeyi soruyor") and who asks ("Rakamcı VC ortağı").
// The investor grows with the company: an angel for Pre-seed / Seed, a VC partner for Series A / B, a growth fund after.
import type { PitchOption, RoundPitch, RoundView, StageIndex } from '../engine/types'
import type { Chip } from './EffectChips'
import { pct } from './format'
import { t } from './i18n'
import type { IconName } from './icons'

const signedPct = (v: number, digits = 1) => (v >= 0 ? `+${pct(v, digits)}` : `−${pct(-v, digits)}`)

export const PITCH_ICON: Record<RoundPitch, IconName> = {
  deck: 'bars',
  demo: 'sparkle',
  coinvestor: 'handshake',
  honest: 'check',
  spin: 'chat',
  fix: 'timer',
  rehearse: 'book',
  team: 'users',
  rival: 'flame',
  sign: 'flag',
  push: 'arrowUp',
  keep: 'key',
  metrics: 'bars',
  story: 'chat',
}

/** Who sits across the table, by the stage the round is for. */
export function investorTier(targetStage: StageIndex): 'angel' | 'vc' | 'fund' {
  return targetStage <= 2 ? 'angel' : targetStage <= 4 ? 'vc' : 'fund'
}

/** The investor across the table: "Rakamcı VC ortağı" (style and tier). */
export function investorLabel(view: Pick<RoundView, 'investorStyle'> | undefined, targetStage: StageIndex): string {
  return t(`investor.${investorTier(targetStage)}.${view?.investorStyle ?? 'numbers'}`)
}

/** What the open meeting is about: "Büyümeyi soruyor" (the deep dive names its question). */
export function meetingLine(view: Pick<RoundView, 'meeting' | 'topic'> | undefined): string {
  if (!view?.meeting) return t('bubble.pitch')
  return view.meeting === 'diligence' ? t(`meeting.topic.${view.topic ?? 'edge'}`) : t(`meeting.${view.meeting}.ask`)
}

/** A meeting answer as labelled chips: offer change (a gamble as its upside + its risk), weeks, equity, strike, energy. */
export function pitchChips(o: PitchOption): Chip[] {
  const out: Chip[] = []
  const title = t(`pitch.${o.pitch}`)
  // The investor's style favours it (the bonus is already in the offer numbers): said first, as a heart.
  if (o.fit) out.push({ icon: 'heart', label: t('pitch.fit'), text: '', good: true, title: t('pitch.fit') })
  if (o.min !== undefined && o.max !== undefined) {
    // "Teklif −%3.4…+%6.6" read as noise (QA): whole percents, the best case and the worst case as two chips.
    if (Math.round(o.max * 100) > 0) out.push({ icon: 'scale', label: t('fx.tag.offer'), text: signedPct(o.max, 0), good: true, title })
    if (Math.round(o.min * 100) < 0) out.push({ icon: 'warning', label: t('fx.tag.risk'), text: signedPct(o.min, 0), good: false, title })
  } else if (o.delta !== 0) {
    out.push({ icon: 'scale', label: t('fx.tag.offer'), text: signedPct(o.delta), good: o.delta > 0, title })
  }
  if (o.weeks > 0) out.push({ icon: 'timer', label: t('fx.tag.roundWeeks'), text: `−${t('fx.weeksShort', { v: o.weeks })}`, good: true, title: t('fx.roundLabel') })
  if (o.weeks < 0) out.push({ icon: 'timer', label: t('fx.tag.roundWeeks'), text: `+${t('fx.weeksShort', { v: -o.weeks })}`, good: null, title: t('fx.roundLabel') })
  // Equity sold is the founder's stake: more sold reads −, less sold reads + (the same sign as the round size rows).
  if (o.equity > 0) out.push({ icon: 'key', label: t('fx.tag.equity'), text: `−${pct(o.equity, 0)}`, good: false, title: t('hud.founderStake') })
  if (o.equity < 0) out.push({ icon: 'key', label: t('fx.tag.equity'), text: `+${pct(-o.equity, 0)}`, good: true, title: t('hud.founderStake') })
  if (o.strike) out.push({ icon: 'warning', label: t('fx.tag.strike'), text: `+${o.strike}`, good: false, title: t('fx.roundLabel') })
  if (o.energy > 0) out.push({ icon: 'bolt', label: t('fx.tag.energy'), text: `−${o.energy}`, good: false, title: t('fx.energyLabel') })
  return out
}
