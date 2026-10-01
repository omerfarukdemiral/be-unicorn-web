// Crisis calendar pool (docs/GAMEPLAY_V2.md §5.1): one known storm per stage, and its mitigation card.
// The engine schedules the date (tied to time, not to stages), draws the id on the reveal day from the then-current
// stage and applies `effects(s, severity)` on the day; the card (category 'crisis') comes first that day.
// Early crises touch the cash: a % shock is not felt by a cash-rich company.
import type { EffectBundle, GameState, ModifierKind } from '../engine/types'
import type { CrisisDef, DecisionCard } from './types'

/** A timed modifier at `severity`: 1 + (v − 1) × severity (§5.1). */
function hit(kind: ModifierKind, value: number, days: number, severity: number): NonNullable<EffectBundle['modifiers']>[number] {
  return { kind, value: 1 + (value - 1) * severity, days }
}

const rentOf = (s: GameState): number => Math.max(0, s.finance.burnBreakdown.rent)

export const CRISES: readonly CrisisDef[] = [
  {
    id: 'lease-hike',
    stage: 1,
    name: 'Kira zammı',
    cardId: 'crisis-lease-hike',
    // Rent × 1.8 for 90 days + a deposit of 3 months' rent. There is no rent modifier yet (rent is priced in derive):
    // the 90-day difference is paid up front with the deposit.
    effects: (s, sev) => ({ cash: -Math.round(rentOf(s) * (3 + 0.8 * 3 * sev)) }),
  },
  {
    id: 'cac-war',
    stage: 2,
    name: 'Reklam savaşı',
    cardId: 'crisis-cac-war',
    // The rival's first campaign: paid users cost more and it undercuts the price.
    effects: (_s, sev) => ({ modifiers: [hit('cac', 1.6, 90, sev), hit('arpu', 0.9, 90, sev)] }),
  },
  {
    id: 'key-account-renewal',
    stage: 3,
    name: 'Büyük müşteri yenilemesi',
    cardId: 'crisis-key-account',
    // T19: the two biggest enterprise contracts fall to renewal (§8.4). Until renewals exist: a milder stand-in on the
    // whole revenue (the real crisis puts two contracts at risk, not every seat).
    effects: (_s, sev) => ({ modifiers: [hit('arpu', 0.9, 120, sev), hit('churn', 1.2, 120, sev)] }),
  },
  {
    id: 'investor-winter',
    stage: 4,
    name: 'Yatırımcı kışı',
    cardId: 'crisis-investor-winter',
    effects: (_s, sev) => ({ modifiers: [hit('multipleCap', 0.6, 120, sev), hit('diligenceMom', 1.5, 120, sev)] }),
  },
  {
    id: 'market-correction',
    stage: 5,
    name: 'Piyasa düzeltmesi',
    cardId: 'crisis-market-correction',
    effects: (_s, sev) => ({
      modifiers: [hit('churn', 1.4, 90, sev), hit('multipleCap', 0.6, 90, sev), hit('diligenceMom', 1.5, 90, sev)],
    }),
  },
]

/** Brought only by the calendar (never rolled): condition false, repeatable (the lighter repeat of a used pool brings it again). */
const calendarOnly = { category: 'crisis', once: false, condition: () => false, defaultAfterDays: 30 } as const

export const CRISIS_CARDS: readonly DecisionCard[] = [
  {
    ...calendarOnly,
    id: 'crisis-lease-hike',
    stage: 1,
    speaker: 'accountant',
    question: 'Ev sahibi kirayı artırdı, üç aylık depozito da istiyor.',
    defaultOption: 0,
    options: [
      {
        label: 'Kabul et, kal',
        tradeoff: { gain: 'Ekip yerinde kalır', cost: 'Zam kasadan çıktı' },
        effects: { morale: 2 },
        reflection: 'Yer değiştirmemek de bir bedel, sadece görünmez.',
        conceptId: 'burn',
      },
      {
        label: 'Uzaktan çalışmaya geç',
        // T15: opens the 'remote-first' policy once policies exist; until then part of the office cost back (a share
        // of the cash, so it scales with the company) and a slower quarter.
        tradeoff: { gain: 'Kasa +%4', cost: 'Üretim −%10, 90 gün' },
        effects: { cashPercent: 0.04, morale: -3, modifiers: [{ kind: 'production', value: 0.9, days: 90 }] },
        reflection: 'Ofis bir araçtır; kira, ekibin işine yaradığı kadar değerlidir.',
        conceptId: 'burn',
      },
    ],
  },
  {
    ...calendarOnly,
    id: 'crisis-cac-war',
    stage: 2,
    speaker: 'mentor',
    question: 'Rakip reklamlara yüklendi, fiyatı da kırdı. Nasıl karşılık verelim?',
    defaultOption: 0,
    options: [
      {
        label: 'Fiyatı koru',
        tradeoff: { gain: 'Gelir korunur', cost: 'Churn +%20, 90 gün' },
        effects: { modifiers: [{ kind: 'churn', value: 1.2, days: 90 }] },
        reflection: 'Fiyat, ürünün değerine dair verdiğin sözdür.',
        conceptId: 'pricing',
      },
      {
        label: 'İndirime eşlik et',
        tradeoff: { gain: 'Churn −%20, 180 gün', cost: 'Gelir −%10, 180 gün' },
        effects: { modifiers: [{ kind: 'arpu', value: 0.9, days: 180 }, { kind: 'churn', value: 0.8, days: 180 }] },
        reflection: 'Fiyat savaşını genelde kasası derin olan kazanır.',
        conceptId: 'ltv-cac',
      },
    ],
  },
  {
    ...calendarOnly,
    id: 'crisis-key-account',
    stage: 3,
    speaker: 'customer',
    question: 'En büyük iki müşterin sözleşmeyi yeniden masaya yatırıyor.',
    defaultOption: 0,
    options: [
      {
        label: 'Yeniden pazarlık et',
        tradeoff: { gain: 'Müşteriler kalır', cost: 'Gelir −%8, 180 gün' },
        effects: { reputation: 2, modifiers: [{ kind: 'arpu', value: 0.92, days: 180 }] },
        reflection: 'Büyük müşteri, pazarlık gücünü de beraberinde getirir.',
        conceptId: 'concentration',
      },
      {
        label: 'SLA yatırımı yap',
        // T19: a maturity step on the renewal once contracts renew (§8.4); until then product and churn. The spec's
        // burn × 0.5 as a share of the cash (a burn-sized cost has no effect field yet).
        tradeoff: { gain: 'Churn −%20, olgunluk +', cost: 'Kasa −%6' },
        effects: { cashPercent: -0.06, maturity: 0.05, reputation: 3, modifiers: [{ kind: 'churn', value: 0.8, days: 120 }] },
        reflection: 'Güven, sözleşmeden önce altyapıda kazanılır.',
        conceptId: 'concentration',
      },
    ],
  },
  {
    ...calendarOnly,
    id: 'crisis-investor-winter',
    stage: 4,
    speaker: 'investor',
    question: 'Yatırımcılar kışa girdi, çarpanlar düştü. Tur şimdi zor.',
    defaultOption: 0,
    options: [
      {
        label: 'Turu ertele',
        tradeoff: { gain: 'Hisse korunur', cost: 'Kasa kendine yetmeli' },
        effects: { reputation: 2 },
        reflection: 'Kışta yatırım aramak yerine baharı beklemek de bir strateji.',
        conceptId: 'fundraise-time',
      },
      {
        label: 'Köprü kredi al',
        // §6.2 loan sized on the burn (covenant = 2 months of runway); with a loan already running the engine pays nothing.
        tradeoff: { gain: 'Kasa nefes alır', cost: '%2 hisse ve borç' },
        effects: { loan: { burnMonths: 4, months: 9, rate: 0.02, covenantRunway: 2 }, equity: -0.02 },
        reflection: 'Köprü, karşıya geçmek için; üstünde yaşamak için değil.',
        conceptId: 'fundraise-time',
      },
    ],
  },
  {
    ...calendarOnly,
    id: 'crisis-market-correction',
    stage: 5,
    speaker: 'accountant',
    question: 'Piyasa sert düzeltmede. Müşteriler harcamayı kısıyor, fonlar temkinli.',
    defaultOption: 0,
    options: [
      {
        label: 'Kesinti yap',
        // T10: salaries × 0.9 once the payday desk lands; until then the saving as cash.
        tradeoff: { gain: 'Kasa +%6', cost: 'Moral −8' },
        effects: { cashPercent: 0.06, morale: -8 },
        reflection: 'Erken ve açık yapılan kesinti, geç yapılandan az acıtır.',
        conceptId: 'default-alive',
      },
      {
        label: 'Nakit yak, büyü',
        // T19: keeps the segment upkeep × 1.5 once segments exist; until then cash for lower churn.
        tradeoff: { gain: 'Churn −%25, 90 gün', cost: 'Kasa −%8' },
        effects: { cashPercent: -0.08, modifiers: [{ kind: 'churn', value: 0.75, days: 90 }] },
        reflection: 'Düzeltmede pay kazanmak ucuzdur, ama kasa derin olmalı.',
        conceptId: 'trough',
      },
    ],
  },
]
