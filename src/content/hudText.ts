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

  // Discovery grid (§9.2, §12): seen cards over all cards, thread names, secret cell
  'codex.title': 'Keşif',
  'codex.count': '{n}/{total}',
  'codex.threads': 'İplikler',
  'codex.threadDone': 'Tamamlandı',
  'codex.secret': 'Gizli kart',
  'codex.locked': '?',
  'codex.empty': 'Henüz kart yok',
  'codex.thread.mentor': 'Mentor',
  'codex.thread.investor': 'Yatırımcı',
  'codex.thread.customer': 'Müşteri',
  'codex.thread.rival': 'Rakip',
  'codex.thread.press': 'Basın',
  'codex.step': '{n}/{total} adım',

  // Rival (§8.2, §9.4): stage-line notch, the one strip item, the market row
  'rival.unknown': 'Adsız rakip',
  'rival.notchTitle': '{name} · değerleme {v}',
  'rival.passed': '{name} seni geçti',
  'rival.share': 'Pay {p}',
  'rival.ahead': 'Önde',
  'rival.behind': 'Geride',
}
