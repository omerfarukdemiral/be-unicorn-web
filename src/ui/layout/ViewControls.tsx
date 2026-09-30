// View controls (top bar, section C): zoom −/+, language (≥1440 only; otherwise in Settings), Kazanımlar, İstatistik,
// Liderlik, settings. No card of their own: they sit inside the top bar, divided from the speed control by a 1px rule.
import { useEffect, useRef } from 'react'
import { achievementsBadge, useGameStore } from '../../store/gameStore'
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
    <div className="flex shrink-0 items-center gap-0.5">
      {showZoom && (
        <>
          <IconButton icon="zoomOut" label={t('view.zoomOut')} onClick={() => z(-1)} disabled={zoom === 0} size={size} />
          <IconButton icon="zoomIn" label={t('view.zoomIn')} onClick={() => z(1)} disabled={zoom === 2} size={size} />
        </>
      )}
      {showLanguage && (
        <button
          type="button"
          title={t('view.languageSoon')}
          aria-label={t('view.language')}
          onClick={toggleSettings}
          className="flex h-10 w-12 shrink-0 items-center justify-center gap-1 rounded-control text-[11px] font-semibold tracking-wide text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Icon name="globe" size={16} />
          TR
        </button>
      )}
      <AchievementsButton size={size} />
      <StatsButton size={size} />
      <LeaderboardButton size={size} />
      <IconButton icon="gear" label={t('settings.title')} onClick={toggleSettings} size={size} active={settingsOpen} />
    </div>
  )
}

/** One short pop when the badge grows (a new concept or goal): the only notice an achievement gets. */
const POP_MS = 600

/**
 * Book → Kazanımlar (K, docs/GAMEPLAY_V2.md §12): stage goals, the concept shelf, Keşif. The badge counts concepts
 * waiting to be read + goals done since it was last opened; when it grows the icon pops once (audio plays the
 * milestone cue). Nothing else announces an achievement.
 */
function AchievementsButton({ size }: { size: number }) {
  const n = useGameStore((s) => achievementsBadge(s.state, s.ui.seenGoals))
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
      <IconButton icon="book" label={t('achv.open')} onClick={toggleAchievements} size={size} active={open} />
      {n > 0 && (
        <span
          aria-hidden="true"
          className="tabular pointer-events-none absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold leading-4 text-on-ink ring-2 ring-surface"
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
  return <IconButton icon="trend" label={t('stats.open')} onClick={() => toggleCenter('stats')} size={size} active={open} />
}

/** Trophy → Liderlik (L). Only when the backend answers; a signed-in player sees their rank as a small badge. */
function LeaderboardButton({ size }: { size: number }) {
  const online = useCloud((s) => s.backend === 'online')
  const rank = useCloud((s) => (s.account ? s.rank : null))
  const open = useGameStore((s) => s.ui.panel?.kind === 'leaderboard')
  if (!online) return null
  return (
    <span className="relative inline-flex shrink-0">
      <IconButton icon="trophy" label={t('lb.open')} onClick={toggleLeaderboard} size={size} active={open} />
      {rank !== null && (
        <span
          aria-hidden="true"
          className="tabular pointer-events-none absolute -right-1 -top-1 rounded-full border border-surface bg-ink px-1 text-[9px] font-bold leading-[14px] text-on-ink"
        >
          {t('lb.rankBadge', { v: rank })}
        </span>
      )}
    </span>
  )
}
