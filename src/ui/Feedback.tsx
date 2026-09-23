// Small feedback layers: rejected-action toast and placing-mode banner.
import { useEffect, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { Icon } from './icons'
import { t } from './i18n'
import { Button } from './primitives'

const ERROR_MS = 2600

export function ErrorToast() {
  const err = useGameStore((s) => s.ui.lastError)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!err) return
    setVisible(true)
    const id = window.setTimeout(() => setVisible(false), ERROR_MS)
    return () => window.clearTimeout(id)
  }, [err])
  if (!err || !visible) return null
  return (
    <div role="alert" key={err.at} className="pointer-events-none flex animate-pop-in items-center gap-2 rounded-full bg-ink-900 px-4 py-2 text-xs font-semibold text-cream-50 shadow-[var(--shadow-pop)]">
      <Icon name="warning" size={15} className="text-peach-300" />
      {t(`error.${err.code}`)}
    </div>
  )
}

export function PlacingBanner() {
  const placing = useGameStore((s) => s.ui.placing)
  const setPlacing = useGameStore((s) => s.setPlacing)
  const employees = useGameStore((s) => s.state.employees)
  if (!placing) return null
  let text: string
  if (placing.kind === 'move') text = t('placing.move')
  else text = t('placing.seat', { name: employees.find((e) => e.id === placing.employeeId)?.name ?? '' })
  return (
    <div className="pointer-events-auto flex animate-pop-in items-center gap-2 rounded-full bg-lilac-500 py-1 pl-4 pr-1 text-xs font-bold text-cream-50 shadow-[var(--shadow-pop)]">
      <Icon name="move" size={15} />
      <span className="max-w-[60vw] truncate">{text}</span>
      <Button size="sm" tone="soft" onClick={() => setPlacing(null)}>
        {t('common.cancel')}
      </Button>
    </div>
  )
}
