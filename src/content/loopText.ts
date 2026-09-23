// Keyed Turkish UI text for the core loop (docs/CORE_LOOP.md): screen frame, focus pauses, slowdowns.
// Merged into UI_TEXT by the content barrel (index.ts); keys never collide with strings.ts / timeText.ts.
export const LOOP_TEXT: Record<string, string> = {
  'time.resumeTo': '{v}× dönecek',
  'time.slowed': 'Önemli an · 1×’e yavaşladı',
  'time.frame.still': 'Zaman durdu',
  'time.frame.focus': 'Okurken zaman durur',
  'time.frame.running': 'Zaman {v}× akıyor',
}
