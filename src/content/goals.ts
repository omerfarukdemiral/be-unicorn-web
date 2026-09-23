// Optional stage goals (☆, docs/CORE_LOOP.md §4.3): two per stage, never punished when missed.
// One uses the stage's new verb, one looks at quality. The ★ goal is always the next stage's valuation.
// Each reached ☆ takes 1 point off the equity sold in the next round (engine balance GOAL_STAR_EQUITY_DISCOUNT).
import type { GameState } from '../engine/types'
import type { StageGoal } from './types'

const maxMaturity = (s: GameState): number => s.projects.reduce((m, p) => Math.max(m, p.maturity), 0)

export const GOALS: readonly StageGoal[] = [
  {
    id: 'garage-mvp',
    stage: 0,
    text: 'İlk sürümü çıkar',
    hint: 'Bir ürün MVP olgunluğuna (%20) ulaşınca yayına çıkar.',
    check: (s) => s.projects.some((p) => p.launched),
  },
  {
    id: 'garage-50',
    stage: 0,
    text: 'Kasa eksiye düşmeden 50 kullanıcı',
    hint: 'Elle kullanıcı bul, sürümleri çıkar, maaş gününü kaçırma.',
    check: (s) => s.stats.users >= 50 && s.finance.negativeCashDays === 0,
  },
  {
    id: 'preseed-v2',
    stage: 1,
    text: 'Bir ürünü %40 olgunluğa taşı',
    hint: 'Olgun ürün daha çok kullanıcı tutar ve daha pahalı satılır.',
    check: (s) => maxMaturity(s) >= 0.4,
  },
  {
    id: 'preseed-team',
    stage: 1,
    text: '3 kişilik ekip, moral 60 üstü',
    hint: 'Ortak alan eşyaları çevresindeki masaların moralini yükseltir.',
    check: (s) => s.employees.length >= 3 && s.stats.morale >= 60,
  },
  {
    id: 'seed-price',
    stage: 2,
    text: 'Fiyatı ayarla, churn %6 altında kal',
    hint: 'Fiyat ayarı pricing kavramıyla açılır.',
    check: (s) => s.finance.priceChangeDay !== undefined && s.finance.priceMultiplier !== 1 && s.stats.churn < 0.06,
  },
  {
    id: 'seed-v3',
    stage: 2,
    text: 'Bir ürünü %60 olgunluğa taşı',
    hint: 'Mühendis ve ürün ekibini aynı projeye ata.',
    check: (s) => maxMaturity(s) >= 0.6,
  },
  {
    id: 'a-ltv',
    stage: 3,
    text: 'Reklamla büyü, LTV:CAC 3× üstü',
    hint: 'Reklam bütçesini aç ama müşteri başı maliyeti izle.',
    check: (s) => s.finance.adBudget > 0 && (s.derived.ltvCac ?? 0) >= 3,
  },
  {
    id: 'a-quality',
    stage: 3,
    text: '%80 olgunluk, teknik borç 20 altı',
    hint: 'Kriz anlarında borca girmemek ürünü hızlı tutar.',
    check: (s) => maxMaturity(s) >= 0.8 && s.techDebt < 20,
  },
  {
    id: 'b-enterprise',
    stage: 4,
    text: 'İlk kurumsal müşteriyi kazan',
    hint: 'Satış görüşmesi kurumsal sözleşme getirebilir.',
    check: (s) => s.finance.enterpriseCustomers.length > 0,
  },
  {
    id: 'b-spread',
    stage: 4,
    text: '10K kullanıcı, tek müşteri gelirin %30 altı',
    hint: 'Gelir tek bir büyük müşteriye bağlı kalmasın.',
    check: (s) => {
      const top = s.finance.enterpriseCustomers.reduce((m, c) => Math.max(m, c.mrr), 0)
      return s.stats.users >= 10_000 && (s.finance.mrr <= 0 || top / s.finance.mrr <= 0.3)
    },
  },
  {
    id: 'c-profit',
    stage: 5,
    text: 'Kâra geç',
    hint: 'Aylık gelir gideri geçince şirket kendi ayakları üstünde durur.',
    check: (s) => s.finance.mrr > 0 && s.finance.net > 0,
  },
  {
    id: 'c-full',
    stage: 5,
    text: 'Bir ürünü %100 olgunluğa taşı',
    hint: 'Tam sürüm en yüksek ARPU ve en düşük churn demek.',
    check: (s) => maxMaturity(s) >= 1,
  },
]

export function goalsOfStage(stage: number): StageGoal[] {
  return GOALS.filter((g) => g.stage === stage)
}
