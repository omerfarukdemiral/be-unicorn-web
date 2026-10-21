// Plague-style praise (2026-10-21, player: "beni takdir etse oyun güzel olurdu: ilk ayda %40 büyüme kaydettin, bu
// Netflix'inkinden %10 daha yüksek"). A milestone of the run set against a famous company's widely cited, approximate
// number. engine/praise.ts shows at most one per PRAISE_GAP_DAYS, and only when the player is ahead or close; else
// the neutral line (when there is one) or nothing. One sentence, numbers, no lecture, no em dash.
// {you}: the player's number (months, users, $, %), {them}: the company's.

/** What brings the row up: a game month passed, a users / MRR count first reached, a stage reached. */
export type PraiseOn = { kind: 'month'; n: number } | { kind: 'users'; n: number } | { kind: 'mrr'; n: number } | { kind: 'stage'; n: number }

/**
 * How the player compares. 'months': reached it in {you} months against their `months` (ahead ≤ theirs, close ≤
 * theirs × PRAISE_CLOSE_TIME). 'value': today's `metric` against their `value` (ahead ≥ theirs, close ≥ theirs ×
 * PRAISE_CLOSE_VALUE); usersMoM / mrrMoM are last month's growth (fraction).
 */
export type PraiseMeasure = { kind: 'months'; months: number } | { kind: 'value'; metric: 'users' | 'mrr' | 'usersMoM' | 'mrrMoM'; value: number }

export interface PraiseRow {
  id: string
  on: PraiseOn
  measure: PraiseMeasure
  ahead: string
  close?: string
  neutral?: string
}

export const PRAISE: readonly PraiseRow[] = [
  // Months of the run.
  {
    id: 'month-1',
    on: { kind: 'month', n: 1 },
    measure: { kind: 'value', metric: 'users', value: 3 },
    ahead: 'İlk ayın bitti: {you} kullanıcın var. Airbnb ilk misafirlerini ağırladığında 3 kişiydi.',
  },
  {
    id: 'month-3',
    on: { kind: 'month', n: 3 },
    measure: { kind: 'value', metric: 'usersMoM', value: 0.25 },
    ahead: 'Kullanıcıların bu ay {you} büyüdü. Paul Graham iyi tempoya haftada %5 ile 7 der, ayda ~{them}.',
    close: 'Bu ay {you} büyüdün, Paul Graham’ın iyi dediği ~{them} tempoya çok yakın.',
  },
  {
    id: 'month-6',
    on: { kind: 'month', n: 6 },
    measure: { kind: 'value', metric: 'mrr', value: 860 },
    ahead: 'Altıncı ayında ayda {you} kazanıyorsun. Airbnb aynı yaşta haftada ~$200, ayda ~{them} kazanıyordu.',
  },
  {
    id: 'month-12',
    on: { kind: 'month', n: 12 },
    measure: { kind: 'value', metric: 'mrrMoM', value: 0.25 },
    ahead: 'İlk yılın doldu, gelirin hâlâ ayda {you} büyüyor. Paul Graham’ın iyi tempo dediği ~{them}’in üstünde.',
    close: 'İlk yılın doldu, gelirin ayda {you} büyüyor, iyi tempo sayılan ~{them}’e yakın.',
  },
  // Users.
  {
    id: 'users-10k',
    on: { kind: 'users', n: 10_000 },
    measure: { kind: 'months', months: 9 },
    ahead: '10 bin kullanıcıya {you} ayda ulaştın. Pinterest ilk {them} ayında bu sayıyı göremedi.',
    close: '10 bin kullanıcı {you} ayda geldi. Pinterest’in ilk {them} ayı bundan da yavaştı.',
  },
  {
    id: 'users-1m',
    on: { kind: 'users', n: 1_000_000 },
    measure: { kind: 'months', months: 42 },
    ahead: '1 milyon kullanıcı {you} ayda geldi. Netflix 1 milyon aboneye ~3,5 yılda ulaşmıştı.',
    close: '1 milyon kullanıcı {you} ayda geldi, Netflix’in ~3,5 yılına yakın.',
  },
  // MRR.
  {
    id: 'mrr-10k',
    on: { kind: 'mrr', n: 10_000 },
    measure: { kind: 'months', months: 12 },
    ahead: 'Aylık gelir $10K, {you} ayda. Airbnb ilk yılında haftada ~$200 kazanıyordu.',
  },
  {
    id: 'mrr-100k',
    on: { kind: 'mrr', n: 100_000 },
    measure: { kind: 'months', months: 36 },
    ahead: 'Yıllık gelirin $1.2M’yi geçti, {you} ayda. Bir SaaS şirketi $1M yıllık gelire ortalama ~3 yılda varır.',
    close: 'Yıllık gelir $1.2M, {you} ayda. Ortalama SaaS buraya ~3 yılda varır.',
  },
  {
    id: 'mrr-1m',
    on: { kind: 'mrr', n: 1_000_000 },
    measure: { kind: 'months', months: 12 },
    ahead: 'Aylık gelir $1M, {you} ayda. Slack bu noktaya lansmandan ~1 yıl sonra gelmişti.',
    neutral: 'Aylık gelir $1M. Slack buraya ~1 yılda gelmişti, çok az şirket bu çizgiyi görür.',
  },
  // Stages.
  {
    id: 'stage-1',
    on: { kind: 'stage', n: 1 },
    measure: { kind: 'months', months: 15 },
    ahead: 'İlk yatırımı {you} ayda aldın. Airbnb ilk fikirden Y Combinator’ın ~$20K’sına ~15 ayda varmıştı.',
  },
  {
    id: 'stage-2',
    on: { kind: 'stage', n: 2 },
    measure: { kind: 'months', months: 18 },
    ahead: 'Seed {you} ayda geldi. Airbnb Sequoia’nın ~$600K’lık seed’ini ~1,5 yılda almıştı.',
  },
  {
    id: 'stage-3',
    on: { kind: 'stage', n: 3 },
    measure: { kind: 'months', months: 37 },
    ahead: 'Series A {you} ayda kapandı. Airbnb’nin Series A’sı ~3 yıl sürmüştü.',
  },
  {
    id: 'stage-4',
    on: { kind: 'stage', n: 4 },
    measure: { kind: 'months', months: 26 },
    ahead: 'Series B {you} ayda. Facebook Series B’yi ~2 yılda almıştı.',
    close: 'Series B {you} ayda geldi, Facebook’un ~2 yılına yakın.',
  },
  {
    id: 'stage-5',
    on: { kind: 'stage', n: 5 },
    measure: { kind: 'months', months: 53 },
    ahead: 'Series C {you} ayda. Uber Series C’ye ~4,5 yılda varmıştı.',
  },
  {
    id: 'stage-6',
    on: { kind: 'stage', n: 6 },
    measure: { kind: 'months', months: 84 },
    ahead: 'Unicorn, {you} ayda. Ortalama bir unicorn bu değere ~7 yılda ulaşır.',
    neutral: 'Unicorn oldun. Ortalama bir unicorn bu değere ~7 yılda ulaşır.',
  },
]
