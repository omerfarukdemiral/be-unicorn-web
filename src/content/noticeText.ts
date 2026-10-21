// One-line notice cards (2026-10-21 clarity & pace): what just happened to the company and its price, in numbers.
// House tone: one sentence, no lecture, no em dash. {placeholders} are filled by the engine (engine/notices.ts).
import type { Dept } from '../engine/types'

export const NOTICE_TEXT = {
  /** The one-time angel (angel-lifeline, option 0). */
  angel: 'Kasa bitti. Melek yatırımcı can simidi attı: {cash} geldi, hissenin {equity} gitti.',
  /** The angel came and nobody answered: its default took it. */
  angelDefault: 'Kasa bitti, sen bakmadan melek yatırımcının simidi alındı: {cash} geldi, hissenin {equity} gitti.',
  /** emergency-loan option 0. */
  loan: 'Kasa bitti. Banka acil kredi verdi: {cash} geldi, her ay faiziyle geri ödenecek.',
  /** emergency-loan option 1 (also its default). */
  savings: 'Kasa bitti. Kendi birikimini koydun: {cash} geldi, enerjin düştü.',
  /** vc-bridge-loan option 0. */
  bridge: 'Kasa tur bitmeden bitiyordu. Yatırımcı köprü kredisi verdi: {cash} geldi, hissenin {equity} gitti.',
  /** A round closed while the till was empty or payroll was owed. */
  roundWhileBroke: 'Kasa bitmişti, tur tam vaktinde kapandı: {cash} geldi, hissenin {equity} gitti.',
  /** A down round closed: its price. */
  downRound: 'Değeri düşük tur kapandı: {cash} geldi, hissenin {equity} gitti, değerleme {valuation} oldu.',
  /** Delegated hiring: who joined this week. */
  teamHired: 'Ekip liderleri işe aldı: {list}.',
} as const

/** Department names in the team-hire line ("Geliştirme +2, Pazarlama +1") and the team chip move. */
export const NOTICE_DEPT: Readonly<Record<Dept, string>> = {
  eng: 'Geliştirme',
  product: 'Ürün',
  marketing: 'Pazarlama',
  sales: 'Satış',
  ops: 'Operasyon',
}
