// View controls (top bar, section C): zoom −/+, language (≥1440 only; otherwise in Settings), Kazanımlar, İstatistik,
// Liderlik, settings. Keycaps (raised IconButtons; an open panel = the brand commit key), no card of their own: they sit
// inside the top bar, divided from the speed control by a 2px rule.
import { useEffect, useRef } from 'react'
import { useGameStore, waitingConcepts } from '../../store/gameStore'
import type { ZoomLevel } from '../../store/types'
import { Icon } from '../icons'
import { t } from '../i18n'
import { IconButton } from '../primitives'
import { useCloud } from '../../net/cloud'
import { toggleAchievements, toggleLeaderboard } from '../shortcuts'

/** Gear → settings in the single panel (again closes it). */
export function toggleSettings() {
  const { ui, openPanel, closePanel } = useGameStore.getState()
  if (ui.panel?.kind === 'settings') closePanel()
  else openPanel({ kind: 'settings' }, { root: true })
}

export function ViewControls({ size = 40, showLanguage = false, showZoom = true }: { size?: number; showLanguage?: boolean; showZoom?: boolean }) {
  const zoom = useGameStore((s) => s.ui.zoom)
  const setZoom = useGameStore((s) => s.setZoom)
  const settingsOpen = useGameStore((s) => s.ui.panel?.kind === 'settings')
  const z = (d: number) => setZoom(Math.max(0, Math.min(2, zoom + d)) as ZoomLevel)
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {showZoom && (
        <>
          <IconButton icon="zoomOut" label={t('view.zoomOut')} onClick={() => z(-1)} disabled={zoom === 0} size={size} raised />
          <IconButton icon="zoomIn" label={t('view.zoomIn')} onClick={() => z(1)} disabled={zoom === 2} size={size} raised />
        </>
      )}
      {showLanguage && (
        <button
          type="button"
          title={t('view.languageSoon')}
          aria-label={t('view.language')}
          onClick={toggleSettings}
          className="ui-key ui-key-sm ui-key-routine flex h-9 w-12 shrink-0 items-center justify-center gap-1 text-[12px] font-extrabold text-ink-2 hover:text-ink"
        >
          <Icon name="globe" size={16} />
          TR
        </button>
      )}
      <AchievementsButton size={size} />
      <StatsButton size={size} />
      <LeaderboardButton size={size} />
      <IconButton icon="gear" label={t('settings.title')} onClick={toggleSettings} size={size} active={settingsOpen} raised />
    </div>
  )
}

/** One short pop when the badge grows (a new concept or goal): the only notice an achievement gets. */
const POP_MS = 600

/**
 * Book → Kazanımlar (K, docs/GAMEPLAY_V2.md §12): the concept grid and Keşif. The badge counts concepts waiting to
 * be read; when it grows the icon pops once (audio plays the milestone cue). Stage goals live in Yol haritası.
 */
function AchievementsButton({ size }: { size: number }) {
  const n = useGameStore((s) => waitingConcepts(s.state).length)
  const open = useGameStore((s) => s.ui.panel?.kind === 'journal')
  const box = useRef<HTMLSpanElement>(null)
  const prev = useRef(n)
  useEffect(() => {
    const grew = n > prev.current
    prev.current = n
    if (!grew || typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    box.current?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.22)' }, { transform: 'scale(1)' }], { duration: POP_MS, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.3)' })
  }, [n])
  return (
    <span ref={box} className="relative inline-flex shrink-0">
      <IconButton icon="book" label={t('achv.open')} onClick={toggleAchievements} size={size} active={open} raised />
      {n > 0 && (
        <span
          aria-hidden="true"
          className="tabular pointer-events-none absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[11px] font-extrabold leading-none text-on-ink shadow-[0_1.5px_0_var(--color-brand-deep)] ring-2 ring-surface"
        >
          {n}
        </span>
      )}
    </span>
  )
}

/** Trend → İstatistik (I): the center statistics screen, again closes it (docs/GAMEPLAY_V2.md §14.5). Time keeps flowing. */
function StatsButton({ size }: { size: number }) {
  const open = useGameStore((s) => s.ui.overlay?.kind === 'stats')
  const toggleCenter = useGameStore((s) => s.toggleCenter)
  return <IconButton icon="trend" label={t('stats.open')} onClick={() => toggleCenter('stats')} size={size} active={open} raised />
}

/** Trophy → Liderlik (L). Only when the backend answers; a signed-in player sees their rank as a small badge. */
function LeaderboardButton({ size }: { size: number }) {
  const online = useCloud((s) => s.backend === 'online')
  const rank = useCloud((s) => (s.account ? s.rank : null))
  const open = useGameStore((s) => s.ui.panel?.kind === 'leaderboard')
  if (!online) return null
  return (
    <span className="relative inline-flex shrink-0">
      <IconButton icon="trophy" label={t('lb.open')} onClick={toggleLeaderboard} size={size} active={open} raised />
      {rank !== null && (
        <span
          aria-hidden="true"
          className="tabular pointer-events-none absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-ink px-1 text-[10px] font-extrabold leading-none text-on-ink ring-2 ring-surface"
        >
          {t('lb.rankBadge', { v: rank })}
        </span>
      )}
    </span>
  )
}
