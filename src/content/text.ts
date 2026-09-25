// Keyed Turkish text tables. Extended by the content lane.
import type { ActivityTextTable, DeptTextTable, NpcTextTable, PostMortemTextTable, ProjectCategoryTextTable } from './types'

export const ACTIVITY_TEXT: ActivityTextTable = {
  hired: '{name} ekibe katıldı.',
  fired: '{name} ile yollar ayrıldı.',
  resigned: '{name} istifa etti.',
  resignWarning: '{name} ayrılmayı düşünüyor.',
  retained: '{name} kalmaya karar verdi.',
  itemPlaced: '{item} yerleştirildi.',
  itemSold: '{item} satıldı.',
  itemMoved: '{item} taşındı.',
  ringOpened: '{ring}. halka açıldı.',
  projectStarted: '{project} projesi başladı.',
  projectLaunched: '{project} yayında!',
  founderActionStarted: '{action} başladı…',
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
  roundWindow: '{stage} turu için pencere açıldı: şimdi mi, biraz daha mı?',
  roundOffer: 'Tur haftası {done}/{total}: teklif {from} → {amount}.',
  roundPitch: 'Pitch: {pitch}. Teklif {amount}.',
  payrollMissed: 'Maaşlar ödenemedi: kasa {amount} ekside. İflas sayacı başladı.',
  decisionDefaulted: 'Cevapsız kart kendi varsayılanıyla kapandı: {option}.',
}

export const POST_MORTEM_TEXT: PostMortemTextTable = {
  runwayIgnored: 'Runway azalırken tur geç başladı.',
  burnTooHigh: 'Aylık yakıt gelirin çok üstündeydi.',
  scaledWithoutPmf: 'Ürün tutmadan büyümeye para harcandı.',
  highChurn: 'Kullanıcılar geldiği hızla gitti.',
  lowMorale: 'Ekip morali uzun süre düşük kaldı.',
  prematureScaling: 'Ekip talepten önce büyüdü.',
  lateFundraise: 'Tur, kasa bitmeden kapanamadı.',
  overload: 'Sunucular kullanıcıyı taşıyamadı.',
  teamLost: 'Ekip dağıldı.',
  unfocused: 'Aynı anda çok fazla proje yürüdü.',
}

export const DEPT_TEXT: DeptTextTable = {
  eng: { name: 'Mühendislik', short: 'Müh' },
  product: { name: 'Ürün & Tasarım', short: 'Ürün' },
  marketing: { name: 'Pazarlama', short: 'Paz' },
  sales: { name: 'Satış', short: 'Satış' },
  ops: { name: 'Operasyon', short: 'Ops' },
}

// One line per category, ≤ 10 words: the category's trade-off in the engine (balance.ts PROJECT_SIZE: web 8 fastest,
// api 9, mobile 10, game / marketplace 12, ai 14 slowest; api + marketplace lean the run toward the platform archetype).
export const PROJECT_CATEGORY_TEXT: ProjectCategoryTextTable = {
  mobile: { name: 'Mobil', description: 'Cebe girmesi kolay, ana ekranda kalması zor.' },
  web: { name: 'Web', description: 'En çabuk çıkan ürün: önce yayınla, sonra cilala.' },
  ai: { name: 'Yapay Zekâ', description: 'En uzun pişen ürün; demosu şov, sabrı bol ister.' },
  api: { name: 'API', description: 'Çabuk biter; müşterin geliştirici, yolun platforma çıkar.' },
  game: { name: 'Oyun', description: 'Uzun sürer ve eğlenceli değilse kimse ikinci kez açmaz.' },
  marketplace: { name: 'Pazar Yeri', description: 'İki tarafı birden ikna edersen platform olursun.' },
}

export const NPC_TEXT: NpcTextTable = {
  mentor: { name: 'Nevin', title: 'Mentor' },
  cofounder: { name: 'Can', title: 'Kurucu ortak' },
  accountant: { name: 'Hakan', title: 'Muhasebeci' },
  engineer: { name: 'Elif', title: 'Mühendis' },
  investor: { name: 'Bora', title: 'Yatırımcı' },
  customer: { name: 'Aylin', title: 'Müşteri' },
  journalist: { name: 'Tuna', title: 'Gazeteci' },
}
