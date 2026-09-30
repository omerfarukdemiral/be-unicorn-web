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

  // Notification strip: items folded over the daily budget (count on the ⌃ button)
  'strip.digest': '+{n}',
}
