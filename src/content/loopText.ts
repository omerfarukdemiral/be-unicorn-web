// Keyed Turkish UI text for the core loop (docs/CORE_LOOP.md): screen frame, focus pauses, slowdowns,
// payday + month receipt, release moments, next step chip, horizon strip, stage goals, "Kararın → sonucu".
// Merged into UI_TEXT by the content barrel (index.ts); keys never collide with strings.ts / timeText.ts.
export const LOOP_TEXT: Record<string, string> = {
  'time.resumeTo': '{v}× dönecek',
  'time.slowed': 'Önemli an · 1×’e yavaşladı',
  'time.frame.still': 'Zaman durdu',
  'time.frame.focus': 'Okurken zaman durur',
  'time.frame.running': 'Zaman {v}× akıyor',

  // Kasa: costs pile up until payday
  'cash.owed': 'Maaş gününe {d} gün · {v} birikti',
  'cash.owedShort': 'Maaşa {d} gün',
  'cash.paydayTitle': 'Maaş, kira ve altyapı ayın 1’inde tek kalemde ödenir. Gelir her gün kasaya akar.',

  // Next step chip
  'step.label': 'Sıradaki adım',
  'step.of': '{i}/{n}',
  'step.start': 'Zamanı başlat (Space)',
  'step.idea': 'Bir ürün fikri seç',
  'step.findUsers': 'Elle ilk kullanıcıları bul',
  'step.desk': 'Ekip için önce bir masa al',
  'step.hire': 'İlk çalışanını işe al',
  'step.launch': 'MVP’yi yayına çıkar · {v}',
  'step.users': '{v} kullanıcıya ulaş · {t} hedef',
  'step.revenue': 'İlk gelir: {v} / {t} MRR',
  'step.round': 'Tur hazır: yatırım turunu başlat',
  'step.roundWait': 'Tur sürüyor, metrikleri koru',
  'step.grow': 'Değerlemeyi büyüt · {v} / {t}',
  'step.go.projects': 'Projeler',
  'step.go.shop': 'Mağaza',
  'step.go.team': 'Ekip',
  'step.go.growth': 'Büyüme',
  'step.go.act': 'Yap',
  'step.go.start': 'Başlat',

  // Horizon strip
  'horizon.title': 'Ufuk',
  'horizon.span': '6 hafta',
  'horizon.payday': 'Maaş günü {v}',
  'horizon.delayed': '“{v}” kararının etkisi',
  'horizon.delayedNote': 'Kararının etkisi geliyor',
  'horizon.release': '{project} {level} yayını (tahmini)',
  'horizon.roundClose': 'Tur kapanışı (tahmini)',
  'horizon.roundReady': 'Tur açılabilir',
  'horizon.inDays': '{v} gün',
  'horizon.today': 'bugün',
  'horizon.empty': 'Önümüzdeki haftalar sakin',

  // Month receipt (ay fişi)
  'receipt.title': '{m}. ay fişi',
  'receipt.revenue': 'Gelir',
  'receipt.salaries': 'Maaş',
  'receipt.rent': 'Kira',
  'receipt.infra': 'Altyapı',
  'receipt.ads': 'Reklam',
  'receipt.net': 'Net',
  'receipt.runway': 'Runway',
  'receipt.runwayMove': '{a} → {b}',
  'receipt.growth': 'büyüme {v} → {m}×',
  'receipt.open': 'Ayrıntı için Büyüme paneli',
  'receipt.compact': 'Maaş günü {v} · Net {n}',
  'receipt.infinite': '∞',

  // Release moment (sürüm anı)
  'release.level.1': 'MVP',
  'release.level.2': 'v1',
  'release.level.3': 'v2',
  'release.level.4': 'v3',
  'release.level.5': 'tam sürüm',
  'release.title': 'Yayında! {project} {level}',
  'release.wave': '+{u} kullanıcı · MRR +{m}',
  'release.banner': 'Yayında! {level}',
  'release.waveShort': '+{u} kullanıcı',

  // Stage goals
  'goals.title': 'Aşama hedefleri',
  'goals.main': '{stage} değerlemesi',
  'goals.reward': 'Her ☆ hedef, sonraki turda satılan hisseden 1 puan düşer. Kaçırmanın cezası yok.',
  'goals.done': 'Tamam',
  'goals.final': 'Son düzlük: 1 milyar dolar değerleme.',
  'goals.toast': 'Hedef tamam: {v}',
  'goals.stars': '☆ {a}/{b}',

  // Kararın → sonucu
  'outcome.title': 'Kararın → sonucu',
  'outcome.line': '“{option}” seçiminden: {effects}',
  'outcome.empty': 'Gecikmeli karar etkileri geldikçe burada görünür.',
  'outcome.day': '{d}. gün',

  // Effect summary pieces
  'fx.users': '{v} kullanıcı',
  'fx.morale': 'moral {v}',
  'fx.reputation': 'itibar {v}',
  'fx.maturity': 'olgunluk {v}',
  'fx.techDebt': 'teknik borç {v}',
  'fx.energy': 'enerji {v}',
  'fx.equity': 'hisse {v}',
  'fx.cashPercent': 'kasa {v}',
  'fx.roundWeeks': 'tur {v} hafta',
  'fx.modifier': 'geçici etki',
  'fx.other': 'etkisi geldi',
}
