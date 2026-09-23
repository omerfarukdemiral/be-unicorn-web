// Optional stage goals (☆, docs/CORE_LOOP.md §4.3): two per stage, never punished when missed.
// One uses the stage's new verb, one looks at quality. The ★ goal is always the next stage's valuation.
// Each reached ☆ takes 1 point off the equity sold in the next round (engine balance GOAL_STAR_EQUITY_DISCOUNT).
import type { GameState, StageBaseline } from '../engine/types'
import type { StageGoal } from './types'

const releasesSince = (s: GameState, b: StageBaseline): number => (s.releaseCount ?? 0) - b.releases
const newProjectAt = (s: GameState, b: StageBaseline, m: number): boolean => s.projects.some((p) => p.createdDay >= b.day && p.maturity >= m)

// Goals measure what is done INSIDE the stage (`b` = where it started): nothing carried in completes one on arrival.
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
    text: 'Maaş gününü kaçırmadan 50 kullanıcı',
    hint: 'Elle kullanıcı bul, sürümleri çıkar, maaş gününü kaçırma.',
    check: (s) => s.stats.users >= 50 && s.finance.negativeCashDays === 0 && !s.finance.payrollMissed,
  },
  {
    id: 'preseed-v2',
    stage: 1,
    text: 'Bu aşamada 2 sürüm çıkar',
    hint: 'Sürümler ve güncellemeler kullanıcı dalgası getirir: ekibi ürüne ata.',
    check: (s, b) => releasesSince(s, b) >= 2,
  },
  {
    id: 'preseed-team',
    stage: 1,
    text: 'Ekibi 3 kişi büyüt, moral 60 üstü',
    hint: 'Ortak alan eşyaları çevresindeki masaların moralini yükseltir.',
    check: (s, b) => s.employees.length >= b.team + 3 && s.stats.morale >= 60,
  },
  {
    id: 'seed-price',
    stage: 2,
    text: 'Fiyatı ayarla, churn %6 altında kal',
    hint: 'Fiyat ayarı pricing kavramıyla açılır.',
    check: (s, b) => s.finance.priceChangeDay !== undefined && s.finance.priceChangeDay >= b.day && s.finance.priceMultiplier !== 1 && s.stats.churn < 0.06,
  },
  {
    id: 'seed-v3',
    stage: 2,
    text: 'Kullanıcıları 2 katına çıkar',
    hint: 'Pazarlamacı organik akışı, sürümler dalgayı getirir.',
    check: (s, b) => s.stats.users >= Math.max(100, b.users * 2),
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
    text: 'Bir sürüm çıkar, teknik borç 20 altı',
    hint: 'Kriz anlarında borca girmemek ürünü hızlı tutar.',
    check: (s, b) => releasesSince(s, b) >= 1 && s.techDebt < 20,
  },
  {
    id: 'b-enterprise',
    stage: 4,
    text: 'Bu aşamada bir kurumsal müşteri kazan',
    hint: 'Satış görüşmesi kurumsal sözleşme getirebilir.',
    check: (s, b) => s.finance.enterpriseCustomers.some((c) => c.sinceDay >= b.day),
  },
  {
    id: 'b-spread',
    stage: 4,
    text: 'MRR’ı 2 katına çıkar, tek müşteri %30 altı',
    hint: 'Gelir tek bir büyük müşteriye bağlı kalmasın.',
    check: (s, b) => {
      const top = s.finance.enterpriseCustomers.reduce((m, c) => Math.max(m, c.mrr), 0)
      return s.finance.mrr >= Math.max(1, b.mrr * 2) && top / s.finance.mrr <= 0.3
    },
  },
  {
    id: 'c-profit',
    stage: 5,
    text: 'MRR’ı %50 büyüt ve kâra geç',
    hint: 'Aylık gelir gideri geçince şirket kendi ayakları üstünde durur.',
    check: (s, b) => s.finance.mrr >= Math.max(1, b.mrr * 1.5) && s.finance.net > 0,
  },
  {
    id: 'c-full',
    stage: 5,
    text: 'Yeni bir ürünü %60 olgunluğa taşı',
    hint: 'Bu aşamada başlayan bir ürün, şirketin tek ürüne bağlı olmadığını gösterir.',
    check: (s, b) => newProjectAt(s, b, 0.6),
  },
]

export function goalsOfStage(stage: number): StageGoal[] {
  return GOALS.filter((g) => g.stage === stage)
}
