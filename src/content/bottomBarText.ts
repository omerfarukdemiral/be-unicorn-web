// Bottom bar + notification strip text (docs/LAYOUT.md §1, §3). Spread into UI_TEXT by content/index.ts.
export const BOTTOM_BAR_TEXT: Record<string, string> = {
  // Bottom bar
  'bottom.label': 'Alt bar',
  'bottom.actions': 'Kurucu aksiyonları',
  'bottom.tabs': 'Paneller',
  'dock.metrics': 'Metrikler',
  'founder.energyValue': 'Enerji {v}/100',
  'founder.energyLow': 'Enerji düşük: dinlenme vakti',

  // Ability slots (docs/GAMEPLAY_V2.md §10.4): the name is tooltip-only, ≤ 2 words; the line under it is a number
  'slot.findUsers': 'Kullanıcı bul',
  'slot.talkToUsers': 'Kullanıcıyla konuş',
  'slot.motivateTeam': 'Motive et',
  'slot.investorCoffee': 'Yatırımcı kahvesi',
  'slot.salesCall': 'Satış görüşmesi',
  'slot.rest': 'Dinlen',
  'slot.refactorSprint': 'Refactor sprinti',
  'slot.findTip': '{r} kullanıcı',
  'slot.salesTip': '{r} MRR',
  'slot.debtCut': 'Teknik borç −{n}',

  // Weekly moves (§7.1): "3/4" next to the slots
  'moves.count': '{l}/{t}',
  'moves.title': 'Bu hafta {l}/{t} hamle · yeni hafta {d}g',

  // Floating number over a finished action's slot (§10.4)
  'float.users': '+{v} kullanıcı',
  'float.mrr': '+{v}/ay',
  'float.debt': '−{v} borç',

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
  'strip.receipt': '{m}. ay fişi · net {n} · ödenen {p}{r}',
  'strip.release': '{project} {level} yayında · +{u} kullanıcı · +{m}/ay',

  // Horizon (readable text, nearest first): "Maaş günü 8 gün · Sürüm ~4 gün"
  'horizon.item.payday': 'Maaş günü {d}',
  'horizon.item.paydayDue': 'Maaş kararı {d}',
  'horizon.item.release': 'Sürüm ~{d}',
  'horizon.item.roundClose': 'Tur kapanışı ~{d}',
  'horizon.item.delayed': 'Karar etkisi {d}',
  'horizon.item.roundReady': 'Tur açılabilir',
  'horizon.days': '{v} gün',
  'horizon.daysShort': '{v}g',
}
