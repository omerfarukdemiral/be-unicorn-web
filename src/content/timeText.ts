// Keyed Turkish UI text for time flow: paused start ("Başlat"), focus pauses, day/cash rhythm.
// Merged into UI_TEXT by the content barrel (index.ts); keys never collide with strings.ts.
export const TIME_TEXT: Record<string, string> = {
  'time.start': 'Başlat',
  'time.startTitle': 'Hazır olunca zamanı başlat',
  'time.startGoal': '{stage} hedefi: {v} değerleme',
  'time.startHint': 'Zaman akınca kasa her gün erir. Karar ve kavram kartlarını okurken oyun kendiliğinden durur.',
  'time.startKey': 'ya da Space',
  'time.paused': 'Duraklatıldı',
  'time.pausedShort': 'Durdu',
  'time.flowing': 'Zaman akıyor',
  'time.reason.start': 'Başlat’a bas',
  'time.reason.manual': 'Space ile devam',
  'time.reason.decision': 'Karar okunuyor',
  'time.reason.concept': 'Kavram okunuyor',
  'time.reason.modal': 'Bekliyor',
  'time.resumesAt': 'Kapatınca {v}× devam',
  'time.perDay': '{v}/gün',
  'time.monthProgress': 'Ay {m}: {d}/30 gün',
  'time.speedState': 'Hız: {v}',
}
