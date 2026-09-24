// Keyed Turkish UI text for the top bar (docs/LAYOUT.md §1–§2): stage, date, round, the four gauges, speed.
// Merged into UI_TEXT by the content barrel (index.ts); keys never collide with strings.ts / timeText / loopText.
export const TOP_BAR_TEXT: Record<string, string> = {
  'top.label': 'Durum çubuğu',
  'top.progress': '{v} / {target}',
  'top.progressTitle': '{stage} hedefine ilerleme: {v} / {target} değerleme',
  'top.lastStage': 'Son aşama',
  // Round: one small chip in the stage section (the only home of the round clock).
  'top.round': 'Tur {w}/{t} hf',
  'top.roundShort': '{w}/{t}',
  'top.roundTitle': 'Tur sürüyor: {v} hafta kaldı. Büyüme › Tur’da takip et.',
  'top.roundStart': 'Tur başlat',
  'top.roundStartShort': 'Tur',
  // Kasa: usable money + the daily NET flow (always with the word "net").
  'top.netPerDay': 'net {v}/gün',
  'top.netPerDayShort': 'net {v}/g',
  'top.dateShort': 'A{m}·G{d}',
  'top.cashTitle': 'Kullanılabilir para {v}. Kasada {bank}; maaş gününe {owed} ayrıldı. Her gün net akış kadar değişir; maaş günü ödeme kasadan çıkar.',
  'top.cashTitleNoOwed': 'Kullanılabilir para {v}. Her gün net akış kadar değişir.',
  'top.debt': 'Borç: {v}',
  'top.bankrupt': 'Maaş ödenemedi: iflasa {v} gün',
  // Runway: months the usable money lasts at this burn.
  'top.runway': '{v} ay',
  'top.runwayInfinite': '∞',
  'top.runwayTitle': 'Runway: bu hızla paranın yeteceği süre ({v}).',
  'top.runwayProfitable': 'Runway: kârdasın, para erimiyor.',
  'top.runwayDanger': 'Tehlike: runway 3 ayın altında.',
  'top.usersTitle': 'Kullanıcı: {v}',
  'top.usersOverload': 'Aşırı yük: ürün kapasitesi yetmiyor.',
  'top.moraleTitle': 'Ekip morali: {v}/100',
  'top.moraleTired': 'Ekip yorgun (50’nin altı).',
  'top.moraleDanger': 'Tehlike: moral 28’in altında, istifalar başlar.',
  // Pinned metrics (Metrikler sekmesi).
  'top.pinnedMore': '+{n} sabitli gösterge · Metrikler',
  'top.pinnedAll': 'Sabitli göstergeler ({n}) · Metrikler',
  // Speed control (the only place the speed colour lives, besides the thin screen edge).
  'top.speedFocus': '{reason} · {v}×',
  'top.speedFocusTitle': 'Duraklatıldı · {reason}. Kapatınca {v}× devam.',
  'top.speedPausedTitle': 'Duraklatıldı · {reason}',
  'top.slowed': 'Önemli an · 1×',
  'top.speedCycle': 'Hız: {v}. Dokun: {next}',
}
