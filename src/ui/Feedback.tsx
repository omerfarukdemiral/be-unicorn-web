// Small feedback: rejected-action error and placing mode. Their text now lives in the notification strip
// (docs/LAYOUT.md §3: error P2, placing P1) via `errorText` / `usePlacing`.
import { useGameStore } from '../store/gameStore'
import { t } from './i18n'

export function errorText(code: string): string {
  return t(`error.${code}`)
}

/** Placing mode for the strip: its line and the cancel action (null when not placing). */
export function usePlacing(): { text: string; cancel: () => void } | null {
  const placing = useGameStore((s) => s.ui.placing)
  const setPlacing = useGameStore((s) => s.setPlacing)
  const name = useGameStore((s) => {
    const p = s.ui.placing
    return p?.kind === 'seat' ? (s.state.employees.find((e) => e.id === p.employeeId)?.name ?? '') : ''
  })
  if (!placing) return null
  return { text: placing.kind === 'move' ? t('placing.move') : t('placing.seat', { name }), cancel: () => setPlacing(null) }
}
