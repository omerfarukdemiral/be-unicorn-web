// The single panel: Mağaza, Ekip, Projeler, Büyüme, Metrikler, Kazanımlar, scene details, decisions and settings all
// open here and replace each other (store.ui.panel). Desktop = right column between the top bar and the bottom bar
// (top 72, bottom 72, 400px / 360px below 1280: docs/LAYOUT.md §1.2); landscape phones = the same side column between
// the h52 bars (min(360, 46vw) wide, so the sheet never covers the top bar or pushes the strip off-screen); portrait
// = one bottom sheet 8px above the bottom bar's tab row. The element carries data-scene-right / data-scene-sheet:
// layout/useSceneInset measures it.
import { type ReactNode } from 'react'
import { useGameStore } from '../store/gameStore'
import type { Panel } from '../store/types'
import type { IconName } from './icons'
import { t } from './i18n'
import { cx, IconBadge, IconButton } from './primitives'
import { useIsMobile, useLayoutMode } from './hooks'
import { DetailBody, DetailHeader, DetailPreview, type RenderPreview } from './DetailPanel'
import { DOCK_TABS } from './Dock'
import { usePanelWidth } from './layout/useSceneInset'
import { BAR_H, EDGE, GAP, LANDSCAPE_BAR_H, MOBILE_BOTTOM_TABS_H } from './layout/tokens'
import { ShopPanel } from './panels/ShopPanel'
import { TeamPanel } from './panels/TeamPanel'
import { ProjectsPanel } from './panels/ProjectsPanel'
import { GrowthPanel } from './panels/GrowthPanel'
import { JournalPanel } from './panels/JournalPanel'
import { MetricsPanel } from './panels/MetricsPanel'
import { DecisionPanel } from './panels/DecisionPanel'
import { SettingsPanel } from './panels/SettingsPanel'

function panelMeta(p: Panel): { icon: IconName; title: string } {
  switch (p.kind) {
    case 'decision':
      return { icon: 'chat', title: t('decision.title') }
    case 'settings':
      return { icon: 'gear', title: t('settings.title') }
    case 'detail':
      return { icon: 'search', title: '' }
    case 'metrics':
      return { icon: 'bars', title: t('dock.metrics') }
    default:
      return { icon: DOCK_TABS.find((d) => d.id === p.kind)?.icon ?? 'bag', title: t(`dock.${p.kind}`) }
  }
}

/** Remount key: new content resets local state (filters, confirm buttons); a shop retarget keeps it. */
function panelKey(p: Panel): string {
  if (p.kind === 'detail') return `detail:${p.selection.kind}:${'id' in p.selection ? p.selection.id : ''}`
  if (p.kind === 'decision') return `decision:${p.cardId}`
  return p.kind
}

function PanelBody({ panel }: { panel: Panel }) {
  switch (panel.kind) {
    case 'shop':
      return <ShopPanel slotTarget={panel.slotTarget} />
    case 'team':
      return <TeamPanel />
    case 'projects':
      return <ProjectsPanel />
    case 'growth':
      return <GrowthPanel section={panel.section} />
    case 'journal':
      return <JournalPanel conceptId={panel.conceptId} />
    case 'metrics':
      return <MetricsPanel focus={panel.focus} />
    case 'detail':
      return <DetailBody selection={panel.selection} />
    case 'decision':
      return <DecisionPanel cardId={panel.cardId} answered={panel.answered} />
    case 'settings':
      return <SettingsPanel />
  }
}

export function RightPanel({ renderPreview }: { renderPreview?: RenderPreview }) {
  const panel = useGameStore((s) => s.ui.panel)
  const hasBack = useGameStore((s) => s.ui.panelBack !== null)
  const closePanel = useGameStore((s) => s.closePanel)
  const goBack = useGameStore((s) => s.panelGoBack)
  const mobile = useIsMobile()
  const mode = useLayoutMode()
  const width = usePanelWidth(mode)
  if (!panel) return null

  const meta = panelMeta(panel)
  const back = hasBack ? <IconButton icon="chevronLeft" label={t('common.back')} onClick={goBack} size={mobile ? 44 : 36} /> : null
  const close = <IconButton icon="close" label={t('common.close')} onClick={closePanel} size={mobile ? 44 : 36} />
  let head: ReactNode
  if (panel.kind === 'detail') {
    head = (
      <div className="flex items-start gap-2 border-b border-border px-3 pb-3 pt-3">
        {back}
        <div className={cx('shrink-0', mobile ? 'w-16' : 'w-24')}>
          <DetailPreview selection={panel.selection} renderPreview={renderPreview} />
        </div>
        <div className="min-w-0 flex-1 pt-1">
          <DetailHeader selection={panel.selection} />
        </div>
        {close}
      </div>
    )
  } else {
    head = (
      <div className="flex items-center gap-2 border-b border-border px-3 pb-2 pt-3">
        {back}
        <h2 className="flex min-w-0 flex-1 items-center gap-2 pl-1 text-base font-semibold tracking-wide text-ink">
          <IconBadge icon={meta.icon} size={28} color="var(--color-brand)" />
          <span className="truncate">{meta.title}</span>
        </h2>
        {close}
      </div>
    )
  }
  const body = (
    <div key={panelKey(panel)} className={cx('@container ui-scroll min-h-0 flex-1 animate-fade-in', mobile ? 'px-3 pb-3 pt-3' : 'px-4 pb-4 pt-3')}>
      <PanelBody panel={panel} />
    </div>
  )

  if (mode === 'portrait') {
    // Above the bottom bar's tab row (the action row hides while the sheet is open), 8px apart, EDGE from the sides:
    // the same card family as the bars.
    return (
      <section
        data-scene-sheet=""
        aria-label={meta.title || t('panel.label')}
        className="ui-card pointer-events-auto absolute z-20 flex max-h-[52vh] animate-slide-up flex-col overflow-hidden shadow-[var(--shadow-pop)]"
        style={{ left: EDGE, right: EDGE, bottom: `calc(max(${EDGE}px, env(safe-area-inset-bottom, 0px)) + ${MOBILE_BOTTOM_TABS_H + GAP}px)` }}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border-strong" />
        {head}
        {body}
      </section>
    )
  }
  const barH = mode === 'landscape' ? LANDSCAPE_BAR_H : BAR_H
  return (
    <aside
      data-scene-right=""
      aria-label={meta.title || t('panel.label')}
      className="pointer-events-auto ui-card absolute z-20 flex max-w-[calc(100vw-16px)] animate-slide-left flex-col overflow-hidden"
      style={{
        width,
        right: EDGE,
        top: EDGE + barH + GAP,
        bottom: `calc(max(${EDGE}px, env(safe-area-inset-bottom, 0px)) + ${barH + GAP}px)`,
      }}
    >
      {head}
      {body}
    </aside>
  )
}
