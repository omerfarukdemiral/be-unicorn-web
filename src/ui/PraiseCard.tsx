// Praise (P4, Plague-style): "Instagram 1M kullanıcıya ~2,5 ayda ulaştı; sen 2 ayda". The engine picks the row and
// grade (engine/praise.ts, at most one per PRAISE_GAP_DAYS) and writes the sentence; this card shows it for PRAISE_MS
// at the top centre, a trophy for "ahead" / "close", a plain spark for a neutral fact line. A tap dismisses it. Never
// pauses, never takes the screen from a decision: while one is open it waits.
import { useEffect, useState } from 'react'
import type { Notice } from '../engine/types'
import { openDecision } from '../engine/pace'
import { useGameStore } from '../store/gameStore'
import { Icon } from './icons'
import { t } from './i18n'
import { useFreshEvents } from './loopUi'
import { cx } from './primitives'
import { soft } from './theme'
import { useLayoutMode } from './hooks'

export const PRAISE_MS = 6000

export function PraiseCard() {
  const [notice, setNotice] = useState<Notice | null>(null)
  const busy = useGameStore((s) => openDecision(s.state) !== null || s.ui.bubbleOpen !== null)
  const mode = useLayoutMode()
  useFreshEvents((events, s) => {
    const e = [...events].reverse().find((x) => x.kind === 'notice' && x.refId === 'praise')
    const n = e && s.notices?.find((x) => x.id === e.value)
    if (n) setNotice(n)
  })
  const shown = notice && !busy ? notice : null
  useEffect(() => {
    if (!shown) return
    const id = window.setTimeout(() => setNotice(null), PRAISE_MS)
    return () => window.clearTimeout(id)
  }, [shown])
  if (!shown) return null
  const win = shown.grade !== 'neutral'
  const color = win ? 'var(--color-g-equity)' : 'var(--color-brand)'
  return (
    <button
      type="button"
      data-praise-card={shown.grade ?? ''}
      onClick={() => setNotice(null)}
      aria-label={shown.text}
      className={cx(
        'ui-card pointer-events-auto absolute left-1/2 z-40 flex w-max -translate-x-1/2 animate-slide-up items-center gap-2.5 px-3 py-2.5 text-left',
        mode === 'desktop' ? 'top-[76px] max-w-[460px]' : 'top-[132px] max-w-[calc(100vw-24px)]',
      )}
    >
      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full" style={{ color, background: soft(color, 16) }}>
        <Icon name={win ? 'trophy' : 'sparkle'} size={20} />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color }}>
          {t(win ? 'praise.title' : 'praise.fact')}
        </span>
        <span className="font-text block text-[14px] font-semibold leading-snug text-ink">{shown.text}</span>
      </span>
    </button>
  )
}
