// Bottom bar + notification strip text (docs/LAYOUT.md §1, §3). Spread into UI_TEXT by content/index.ts.
export const BOTTOM_BAR_TEXT: Record<string, string> = {
  // Bottom bar
  'bottom.label': 'Alt bar',
  'bottom.actions': 'Kurucu aksiyonları',
  'bottom.tabs': 'Paneller',
  'dock.metrics': 'Metrikler',
  'founder.energyValue': 'Enerji {v}/100',
  'founder.energyLow': 'Enerji düşük: dinlenmeden yeni aksiyon zor',

  // Notification strip
  'strip.label': 'Bildirimler',
  'strip.more': 'Yaklaşan ve son olaylar',
  'strip.upcoming': 'Yaklaşan',
  'strip.recent': 'Son olaylar',
  'strip.noRecent': 'Henüz olay yok',
  'strip.bankrupt': 'Maaş ödenemedi · iflasa {d} gün',
  'strip.bankruptSub': 'Kasayı artıya çevir: gelir, tur ya da kesinti',
  'strip.runwayLow': 'Runway 3 ayın altında: {v} ay',
  'strip.runwayLowSub': 'Yakıtı kıs ya da tura çık',
  'strip.paid': 'ödenen',
  'strip.receipt': '{m}. ay fişi · ödenen {p} · net {n} · runway {r}',
  'strip.release': '{project} {level} yayında · +{u} kullanıcı · +{m}/ay',
  'strip.goal': '☆ Hedef tamam: {v}',
  'strip.roundWeek': 'Tur {w}/{n} · teklif {a} → {b}',
  'strip.newMetric': 'Yeni gösterge: {name}',
  'strip.newMetric.pinned': 'üst bara sabitlendi',
  'strip.newMetric.top': 'üst barda',
  'strip.newMetric.listed': 'Metrikler’de',
  'strip.step': 'Sıradaki adım {i}/{n}',

  // Horizon (readable text, nearest first): "Maaş günü 8 gün · Sürüm ~4 gün"
  'horizon.item.payday': 'Maaş günü {d}',
  'horizon.item.release': 'Sürüm ~{d}',
  'horizon.item.roundClose': 'Tur kapanışı ~{d}',
  'horizon.item.delayed': 'Karar etkisi {d}',
  'horizon.item.roundReady': 'Tur açılabilir',
  'horizon.days': '{v} gün',
  'horizon.daysShort': '{v}g',
}
