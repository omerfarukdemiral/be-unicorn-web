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

export const PROJECT_CATEGORY_TEXT: ProjectCategoryTextTable = {
  mobile: { name: 'Mobil', description: 'Cebe giren uygulama.' },
  web: { name: 'Web', description: 'Tarayıcıda çalışan ürün.' },
  ai: { name: 'Yapay Zekâ', description: 'Veriden değer üreten model.' },
  api: { name: 'API', description: 'Diğer ürünlere altyapı.' },
  game: { name: 'Oyun', description: 'Eğlence ürünü.' },
  marketplace: { name: 'Pazar Yeri', description: 'Alıcı ile satıcıyı buluşturur.' },
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

export const UI_TEXT: Record<string, string> = {
  'app.title': 'Be Unicorn',
}
