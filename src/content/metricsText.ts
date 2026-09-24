// Keyed Turkish UI text for the Metrikler tab and the gauge cards (docs/LAYOUT.md §2.3, §5).
// Merged into UI_TEXT by the content barrel (index.ts). `hud.*` keys here only ADD wording; the money words follow
// one definition: Yakıt = the month's total cost, Kâr tahmini = Gelir − Yakıt, Kasa shows the daily net.
export const METRICS_TEXT: Record<string, string> = {
  'metrics.intro': 'Öğrendiğin her kavram buraya bir gösterge ekler. En fazla ikisini üst bara sabitleyebilirsin.',
  'metrics.group.pinned': 'Sabitli',
  'metrics.group.money': 'Para',
  'metrics.group.growth': 'Büyüme',
  'metrics.group.team': 'Ekip',
  'metrics.group.path': 'Yol',
  'metrics.pin': 'Üst bara sabitle',
  'metrics.pinReplace': 'Üst bara sabitle ({old} yerine)',
  'metrics.unpin': 'Üst bardan kaldır',
  'metrics.onTopBar': 'Üst barda',
  'metrics.new': 'Yeni',
  'metrics.concept': 'Kavram: {c}',
  'metrics.more': '{n} gösterge daha kavramlarla açılacak',
  'metrics.allOpen': 'Tüm göstergeler açık',
  'metrics.pinnedCount': '{n}/{max} sabitli',
  'metrics.openTitle': '{label} · Metrikler’de aç',

  // Kasa dökümü (not pinnable: the Kasa itself is always in the top bar).
  'metrics.cash.title': 'Kasa dökümü',
  'metrics.cash.bank': 'Bankada',
  'metrics.cash.owed': 'Maaş gününe ayrılan',
  'metrics.cash.usable': 'Kullanılabilir',
  'metrics.cash.note': 'Üst bardaki Kasa, bankadaki paradan maaş gününe biriken giderler düşülmüş halidir. Altındaki “net/gün” = (Gelir − Yakıt) ÷ 30.',

  // One money vocabulary (docs/LAYOUT.md §2.3).
  'hud.netPerDay': 'net {v}/gün',
  'hud.netPerMonth': '{v}/ay',
  'hud.burnSub': 'maaş + kira + kurucu + altyapı + reklam',
  'hud.burnTitle': 'Yakıt: bir ayın toplam gideri (maaş + kira + kurucu + altyapı + reklam). Gelir düşülmez; gelir düşülmüş hali Kâr tahmini.',
  'hud.profitFormula': 'Gelir {mrr} − Yakıt {burn}',
  'hud.profitTitle': 'Kâr tahmini: aylık Gelir − Yakıt. Eksideyse kasa her ay bu kadar erir.',
  'burn.founder': 'Kurucu',

  // Merged cards.
  'hud.churnInline': 'churn {v}/ay',
  'hud.stakeInline': 'Kurucu payı {v}',

  // Tur: its home is Büyüme › Tur and the top bar; Metrikler only links there.
  'metrics.round.link': 'Büyüme › Tur’a git',
}
