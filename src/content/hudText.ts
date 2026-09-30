// HUD text of GAMEPLAY_V2 (docs/GAMEPLAY_V2.md §10-§14): Kazanımlar icon, center screens, strip digest.
// Spread into UI_TEXT by content/index.ts. Every new UI wording of the V2 waves lands here (strings.ts stays as is).
// Budgets (docs/VOICE.md): button ≤ 2 words, tooltip ≤ 8, empty state ≤ 4, panel sentence ≤ 12.
export const HUD_TEXT: Record<string, string> = {
  // Kazanımlar (top-bar book icon, K)
  'achv.title': 'Kazanımlar',
  'achv.open': 'Kazanımlar (K)',
  'achv.discovery': 'Keşif',
  'achv.discoveryEmpty': 'Yakında açılır',

  // Settings > shortcuts
  'shortcut.achievements': 'Kazanımlar',
  'shortcut.stats': 'İstatistik',

  // Center screens (CenterFrame): title strip + top-bar trend icon (I)
  'center.stats': 'İstatistik',
  'center.lawbook': 'Kanun Kitabı',
  'center.market': 'Pazar haritası',
  'center.soon': 'Yakında',
  'stats.open': 'İstatistik (I)',
  'stats.tabs': 'Sekmeler',

  // Statistics screen (§14.5): tab names, one-word chart names / axes, the one sentence (death day)
  'stats.tab.money': 'Para',
  'stats.tab.growth': 'Büyüme',
  'stats.tab.team': 'Ekip',
  'stats.tab.profile': 'Profil',
  'stats.cash': 'Kasa',
  'stats.runway': 'Runway',
  'stats.flow': 'Gelir–gider',
  'stats.revenue': 'Gelir',
  'stats.cost': 'Gider',
  'stats.split': 'Dağılım',
  'stats.mrr': 'MRR',
  'stats.users': 'Kullanıcı',
  'stats.valuation': 'Değerleme',
  'stats.target': 'Hedef',
  'stats.window': 'Pencere',
  'stats.newUsers': 'Yeni',
  'stats.channels': 'Kanallar',
  'stats.market': 'Pazar',
  'stats.team': 'Ekip',
  'stats.morale': 'Moral',
  'stats.depts': 'Departman',
  'stats.people': 'Kişi',
  'stats.output': 'Çıktı',
  'stats.equity': 'Hisse',
  'stats.founder': 'Kurucu',
  'stats.investors': 'Yatırımcı',
  'stats.profile': 'Profil',
  'stats.company': 'Şirket',
  'stats.expected': 'Beklenti',
  'stats.other': 'Diğer',
  'stats.day': 'Gün {d}',
  'stats.deathDay': 'Kasa biter · Gün {d}',
  'stats.axis.product': 'Ürün',
  'stats.axis.growth': 'Büyüme',
  'stats.axis.efficiency': 'Verim',
  'stats.axis.team': 'Ekip',
  'stats.axis.morale': 'Moral',
  'stats.axis.cash': 'Nakit',

  // Notification strip: items folded over the daily budget (count on the ⌃ button)
  'strip.digest': '+{n}',
}
