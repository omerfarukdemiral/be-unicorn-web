// Company policies, the Kanun Kitabı (docs/GAMEPLAY_V2.md §7.2): twelve sharp laws, signed once, never revoked.
// Runway falling opens the survival tree: each hard law shifts the player's "normal" (creeping normality). The engine
// multiplies / adds the effects of the signed ones; names ≤ 6 words, texts ≤ 12 (§3 md.5).
import type { GameState } from '../engine/types'
import type { Policy } from './types'

/** Flag the lease-hike crisis card sets when the team goes remote (opens 'remote-first' before Seed). */
export const REMOTE_FIRST_FLAG = 'remoteFirstOpen'

/** Runway below `months` (a profitable company has none: the survival tree stays shut). */
const runwayBelow = (months: number) => (s: GameState): boolean => s.finance.runway !== null && s.finance.runway < months
const stageAtLeast = (stage: number) => (s: GameState): boolean => s.stage >= stage

export const POLICIES: readonly Policy[] = [
  // Survival: the runway opens them, each one costs a little of the next round's equity.
  {
    id: 'salary-freeze',
    tree: 'survival',
    tier: 1,
    name: 'Maaş dondurma',
    text: 'Yıllık zam yok, yıldız aday da yok. Moral −4.',
    unlock: runwayBelow(8),
    lock: { metric: 'runway', value: 8 },
    effect: { noRaises: true, qualityCap: 1, moraleTarget: -4 },
  },
  {
    id: 'lean-office',
    tree: 'survival',
    tier: 1,
    name: 'Dar ofis',
    text: 'Kira −%20, sunucu kapasitesi −%10.',
    unlock: runwayBelow(6),
    lock: { metric: 'runway', value: 6 },
    effect: { mult: { rent: 0.8, capacity: 0.9 } },
  },
  {
    id: 'founder-no-pay',
    tree: 'survival',
    tier: 2,
    name: 'Kurucu maaş almaz',
    text: 'Kurucu gideri sıfır, enerji %30 yavaş dolar.',
    unlock: runwayBelow(5),
    lock: { metric: 'runway', value: 5 },
    effect: { mult: { founderPay: 0, energyRegen: 0.7 } },
  },
  {
    id: 'deferred-pay',
    tree: 'survival',
    tier: 3,
    name: 'Ertelenmiş maaş',
    text: 'Maaşın %40’ı turda ödenir. İstifa riski iki kat, moral −10.',
    unlock: runwayBelow(3),
    lock: { metric: 'runway', value: 3 },
    effect: { mult: { salary: 0.6, resign: 2 }, payLater: true, moraleTarget: -10 },
  },
  {
    id: 'layoff-round',
    tree: 'survival',
    tier: 3,
    name: 'İşten çıkarma dalgası',
    text: 'Ekibin %30’u gider, kıdem ödenmez. İtibar −15, moral −20.',
    unlock: runwayBelow(3),
    lock: { metric: 'runway', value: 3 },
    effect: { layoff: 0.3, mult: { severance: 0 }, onSign: { reputation: -15, modifiers: [{ kind: 'morale', value: -20, days: 90 }] } },
  },
  // Growth: speed now, the bill later.
  {
    id: 'hire-fast',
    tree: 'growth',
    tier: 1,
    name: 'Hızlı işe alım',
    text: 'Aday havuzu +2, maaşlar +%10.',
    unlock: stageAtLeast(1),
    lock: { metric: 'stage', value: 1 },
    effect: { candidates: 2, mult: { salary: 1.1 } },
  },
  {
    id: 'crunch-culture',
    tree: 'growth',
    tier: 2,
    name: 'Crunch kültürü',
    text: 'Üretim +%20, haftada +1 hamle. Borç birikir, kurucu yıpranır.',
    unlock: stageAtLeast(2),
    lock: { metric: 'stage', value: 2 },
    excludes: ['quality-gate'],
    effect: { mult: { production: 1.2, energyRegen: 0.7 }, movesBonus: 1, techDebtMonthly: 1, moraleTarget: -6, flagDay: 'crunchCultureDay' },
  },
  {
    id: 'ads-first',
    tree: 'growth',
    tier: 3,
    name: 'Önce reklam',
    text: 'Reklam %10 ucuz, ağızdan ağıza %10 zayıf.',
    unlock: stageAtLeast(3),
    lock: { metric: 'stage', value: 3 },
    effect: { mult: { cac: 0.9, organic: 0.9 } },
  },
  // Craft: slower, sturdier.
  {
    id: 'remote-first',
    tree: 'craft',
    tier: 1,
    name: 'Önce uzaktan',
    text: 'Kira −%40, koordinasyon kaybı +%30.',
    unlock: (s) => s.flags[REMOTE_FIRST_FLAG] === true || s.stage >= 2,
    lock: { metric: 'stage', value: 2, crisis: 'lease-hike' },
    effect: { mult: { rent: 0.6, coordination: 1.3 } },
  },
  {
    id: 'quality-gate',
    tree: 'craft',
    tier: 2,
    name: 'Kalite kapısı',
    text: 'Churn −%15, üretim −%15, güncellemeler seyrek.',
    unlock: stageAtLeast(2),
    lock: { metric: 'stage', value: 2 },
    excludes: ['crunch-culture'],
    effect: { mult: { churn: 0.85, production: 0.85, releaseGap: 1.5 } },
  },
  {
    id: 'profit-share',
    tree: 'craft',
    tier: 3,
    name: 'Kâr paylaşımı',
    text: 'Moral +6, maaşlar +%12. Yatırımcı yakmaya biraz göz yumar.',
    unlock: (s) => (s.counters.profitMonths ?? 0) >= 3,
    lock: { metric: 'profitMonths', value: 3 },
    effect: { mult: { salary: 1.12 }, moraleTarget: 6, burnAsk: 0.5 },
  },
  // Organisation: the head count opens it.
  {
    id: 'management',
    tree: 'org',
    tier: 1,
    name: 'Yönetim katmanı',
    text: 'Koordinasyon kaybı yarıya iner. Kira +%10, haftada −1 hamle.',
    unlock: (s) => s.employees.length >= 20,
    lock: { metric: 'team', value: 20 },
    effect: { mult: { coordination: 0.5, rent: 1.1 }, movesBonus: -1 },
  },
]
