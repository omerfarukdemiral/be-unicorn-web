// Keyed Turkish text tables. Extended by the content lane.
import type { ActivityTextTable, DeptTextTable, NpcTextTable, PostMortemTextTable, ProjectCategoryTextTable } from './types'

export const ACTIVITY_TEXT: ActivityTextTable = {
  hired: '{name} ekibe katıldı.',
  fired: '{name} işten çıkarıldı.',
  resigned: '{name} istifa etti.',
  resignWarning: '{name} istifa etmek üzere.',
  retained: '{name} kalmaya karar verdi.',
  itemPlaced: '{item} yerleştirildi.',
  itemSold: '{item} satıldı.',
  itemMoved: '{item} taşındı.',
  ringOpened: '{ring}. halka açıldı.',
  projectStarted: '{project} başladı, ilk satırlar yazılıyor.',
  projectLaunched: '{project} yayında!',
  founderActionStarted: '{action} başladı.',
  founderActionDone: '{action} tamamlandı.',
  roundStarted: 'Yatırım turu başladı.',
  roundProgress: 'Tur görüşmesi sürüyor ({done}/{total} hafta).',
  roundClosed: 'Tur kapandı: {amount}.',
  roundShrunk: 'Metrikler düştü, teklif küçüldü.',
  stageUp: 'Yeni aşama: {stage}.',
  milestone: '{milestone}',
  delayedEffect: '{note}',
  bankruptWarning: 'Kasa ekside: {days} gün kaldı.',
  enterpriseWon: '{customer} müşterimiz oldu.',
  enterpriseLost: '{customer} ayrıldı.',
  payday: 'Maaş günü: {amount} ödendi.',
  release: '{project} {level} yayında: +{users} kullanıcı.',
  goalDone: 'Aşama hedefi tamam: {goal}.',
  projectRenamed: '{from} artık {to}',
  moduleStarted: '{project}: {module} geliştiriliyor',
  moduleShipped: '{project}: {module} yayında',
  versionShipped: '{project} v{version} yayında: +{users} kullanıcı',
  adFocusChanged: 'Reklamlar artık {project} için',
  roundWindow: '{stage} turu için pencere açıldı: şimdi mi, biraz daha mı?',
  roundOffer: 'Tur haftası {done}/{total}: teklif {from} → {amount}.',
  roundPitch: 'Pitch: {pitch}. Teklif {amount}.',
  payrollMissed: 'Maaşlar ödenemedi: kasa {amount} ekside. İflas sayacı başladı.',
  decisionDefaulted: 'Cevap vermedin, "{option}" seçildi.',
  grew: '{name} ustalaştı',
  burnedOut: '{name} tükendi',
  leadSet: '{name} ekip lideri',
  sprintStarted: '{project} sprintte',
}

export const POST_MORTEM_TEXT: PostMortemTextTable = {
  runwayIgnored: 'Runway azalırken turu geç başlattın.',
  burnTooHigh: 'Aylık burn gelirin çok üstündeydi.',
  scaledWithoutPmf: 'Ürün tutmadan büyümeye para bastın.',
  highChurn: 'Kullanıcılar geldiği hızla gitti.',
  lowMorale: 'Ekip morali uzun süre düşük kaldı.',
  prematureScaling: 'Talep gelmeden ekibi büyüttün.',
  lateFundraise: 'Kasa bitmeden tur kapanmadı.',
  overload: 'Sunucular kullanıcıyı taşıyamadı.',
  teamLost: 'Ekip dağıldı.',
  unfocused: 'Aynı anda çok fazla ürün yürüttün.',
}

export const DEPT_TEXT: DeptTextTable = {
  eng: { name: 'Geliştirici', short: 'Dev' },
  product: { name: 'Ürün & Tasarım', short: 'Ürün' },
  marketing: { name: 'Pazarlama', short: 'Paz' },
  sales: { name: 'Satış', short: 'Satış' },
  ops: { name: 'Operasyon', short: 'Ops' },
}

// One line per category, ≤ 10 words: the category's trade-off in the engine (balance.ts PROJECT_SIZE: web 8 fastest,
// api 9, mobile 10, game / marketplace 12, ai 14 slowest; api + marketplace lean the run toward the platform archetype).
export const PROJECT_CATEGORY_TEXT: ProjectCategoryTextTable = {
  mobile: { name: 'Mobil', description: 'Dengeli: orta hız, orta gelir, iyi yayılır.' },
  web: { name: 'Web', description: 'En hızlı çıkar; kullanıcı başı az kazandırır.' },
  ai: { name: 'Yapay Zekâ', description: 'En uzun sürer; kullanıcı başı en çok kazandırır.' },
  api: { name: 'API', description: 'Hızlı çıkar, iyi kazandırır ama kendiliğinden yayılmaz.' },
  game: { name: 'Oyun', description: 'Uzun sürer, az kazandırır ama kendiliğinden yayılır.' },
  marketplace: { name: 'Pazar Yeri', description: 'Uzun sürer; iyi yayılır, platform yolunu açar.' },
}

export const NPC_TEXT: NpcTextTable = {
  mentor: { name: 'Nevin', title: 'Mentor' },
  cofounder: { name: 'Can', title: 'Kurucu ortak' },
  accountant: { name: 'Hakan', title: 'Muhasebeci', titleBy: { 2: 'Mali işler', 3: 'CFO' } },
  engineer: { name: 'Elif', title: 'Geliştirici', titleBy: { 2: 'Tech lead', 3: 'CTO' } },
  investor: { name: 'Bora', title: 'Yatırımcı' },
  customer: { name: 'Aylin', title: 'Müşteri', titleBy: { 2: 'Kurumsal müşteri' } },
  journalist: { name: 'Tuna', title: 'Gazeteci', titleBy: { 2: 'Teknoloji muhabiri' } },
}
