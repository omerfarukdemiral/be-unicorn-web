// The single panel: Mağaza, Ekip, Projeler, Büyüme, Metrikler, Kazanımlar, scene details, decisions and settings all
// open here and replace each other (store.ui.panel). Desktop = right column between the top bar and the bottom bar
// (top 72, bottom 72, 400px / 360px below 1280: docs/LAYOUT.md §1.2); landscape phones = the same side column between
// the h52 bars (min(360, 46vw) wide, so the sheet never covers the top bar or pushes the strip off-screen); portrait
// = one bottom sheet 8px above the bottom bar's tab row. The element carries data-scene-right / data-scene-sheet:
// layout/useSceneInset measures it.
// Head (docs/GAMEPLAY_V2.md §10.3): 3px kind stripe + 20px icon + 13px uppercase title + the panel's labelled primary
// number (KASA $15.1K: the label says which figure, since each panel shows a different one).
import { type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGameStore } from '../store/gameStore'
import type { Panel } from '../store/types'
import { Icon, type IconName } from './icons'
import { t } from './i18n'
import { money, num, pct } from './format'
import { cx, IconButton } from './primitives'
import { iconTone, PANEL_COLOR } from './theme'
import { ledgerMoney } from './widgets'
import { panelHeadline, type HeadlineUnit, type HeadlineValue } from './panelHeadline'
import { useIsMobile, useLayoutMode, useTween } from './hooks'
import { DetailBody, DetailHeader, DetailPreview, type RenderPreview } from './DetailPanel'
import { DOCK_TABS } from './Dock'
import { usePanelWidth } from './layout/useSceneInset'
import { BAR_H, EDGE, GAP, LANDSCAPE_BAR_H, MOBILE_BOTTOM_TABS_H } from './layout/tokens'
import { ShopPanel } from './panels/ShopPanel'
import { TeamPanel } from './panels/TeamPanel'
import { ProjectsPanel } from './panels/ProjectsPanel'
import { GrowthPanel } from './panels/GrowthPanel'
import { ErrorCatch } from './ErrorCatch'
import { JournalPanel } from './panels/JournalPanel'
import { MetricsPanel } from './panels/MetricsPanel'
import { DecisionPanel } from './panels/DecisionPanel'
import { SettingsPanel } from './panels/SettingsPanel'
import { RoadmapPanel } from './panels/RoadmapPanel'
import { LeaderboardPanel } from './panels/LeaderboardPanel'

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
    case 'roadmap':
      return { icon: 'unicorn', title: t('roadmap.title') }
    case 'leaderboard':
      return { icon: 'trophy', title: t('lb.title') }
    case 'journal':
      return { icon: 'book', title: t('achv.title') }
    default:
      return { icon: DOCK_TABS.find((d) => d.id === p.kind)?.icon ?? 'bag', title: t(`dock.${p.kind}`) }
  }
}

function headlineText(h: HeadlineValue): string {
  switch (h.unit) {
    case 'money':
      return money(h.value)
    // Same digits as the HUD Kasa chip, so the two never read differently.
    case 'cash':
      return ledgerMoney(h.value)
    case 'perMonth':
      return t('hud.netPerMonth', { v: money(h.value) })
    case 'pct':
      return pct(h.value)
    case 'people':
      return t('unit.people', { v: num(h.value) })
    case 'count':
      return h.of === undefined ? num(h.value) : t('journal.count', { n: num(h.value), total: h.of })
    case 'energy':
      return t('founder.energyValue', { v: Math.round(h.value) })
    // The label already says Gün, so the day prints bare.
    case 'day':
      return num(h.value)
  }
}

/** Units counted in whole steps: the tween's in-between values are rounded so "3 kişi" never reads "2.6 kişi". */
const WHOLE: readonly HeadlineUnit[] = ['people', 'count', 'energy', 'day']

/**
 * The panel's primary number (right of the title), behind its one-word label. Own subscription: only this ticks with
 * the engine, not the panel. Tweened like the HUD chips, so it eases to (and lands on) the same figure; keyed by panel,
 * so a panel switch shows the new figure at once instead of easing from the previous panel's number.
 */
function HeadlineNumber({ panel }: { panel: Panel }) {
  const h = useGameStore(
    useShallow((s) => {
      const x = panelHeadline(s.state, panel)
      return {
        label: x ? t(x.label) : null,
        value: x?.value ?? 0,
        unit: x?.unit ?? 'money',
        of: x?.of,
        sub: x?.sub ? headlineText(x.sub) : null,
        danger: !!x?.danger,
      }
    }),
  )
  const shown = useTween(h.value)
  if (!h.label) return null
  const main = headlineText({ value: WHOLE.includes(h.unit) ? Math.round(shown) : shown, unit: h.unit, of: h.of })
  return (
    <span className="tabular flex shrink-0 items-baseline gap-1.5 whitespace-nowrap" title={h.label}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-2">{h.label}</span>
      <span className={cx('text-[17px] font-bold leading-none', h.danger ? 'text-negative-ink' : 'text-ink')}>{main}</span>
      {h.sub && <span className="text-[12px] font-semibold text-ink-2">· {h.sub}</span>}
    </span>
  )
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
    case 'roadmap':
      return <RoadmapPanel />
    case 'leaderboard':
      return <LeaderboardPanel />
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
  const hue = PANEL_COLOR[panel.kind]
  // Head row 36px on desktop; phones keep 44px touch targets.
  const back = hasBack ? <IconButton icon="chevronLeft" label={t('common.back')} onClick={goBack} size={mobile ? 44 : 36} /> : null
  const close = <IconButton icon="close" label={t('common.close')} onClick={closePanel} size={mobile ? 44 : 36} />
  // 3px kind stripe along the top edge of the panel (identity hue, never a warning).
  const stripe = <div aria-hidden="true" className="h-[3px] w-full shrink-0" style={{ background: hue }} />
  let head: ReactNode
  if (panel.kind === 'detail') {
    head = (
      <div className="flex items-start gap-2 border-b border-border px-3 pb-2 pt-2">
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
      <div className="flex items-center gap-2 border-b border-border px-2 py-1">
        {back}
        <h2 className="flex min-w-0 flex-1 items-center gap-2 pl-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink">
          <Icon name={meta.icon} size={20} className="shrink-0" style={{ color: iconTone(hue) }} />
          <span className="truncate">{meta.title}</span>
        </h2>
        <HeadlineNumber key={panelKey(panel)} panel={panel} />
        {close}
      </div>
    )
  }
  const body = (
    <div key={panelKey(panel)} className={cx('@container ui-scroll min-h-0 flex-1 animate-fade-in', mobile ? 'px-3 pb-3 pt-3' : 'px-4 pb-4 pt-3')}>
      <ErrorCatch key={panelKey(panel)} where={panelKey(panel)}>
        <PanelBody panel={panel} />
      </ErrorCatch>
    </div>
  )

  if (mode === 'portrait') {
    // Above the bottom bar's tab row (the action row hides while the sheet is open), 8px apart, EDGE from the sides:
    // the same card family as the bars.
    return (
      <section
        data-scene-sheet=""
        aria-label={meta.title || t('panel.label')}
        className="ui-card pointer-events-auto absolute z-20 flex max-h-[52vh] animate-slide-up flex-col overflow-hidden shadow-[var(--shadow-panel)]"
        style={{ left: EDGE, right: EDGE, bottom: `calc(max(${EDGE}px, env(safe-area-inset-bottom, 0px)) + ${MOBILE_BOTTOM_TABS_H + GAP}px)` }}
      >
        {stripe}
        <div className="mx-auto mt-1.5 h-1 w-10 shrink-0 rounded-full bg-border-strong" />
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
      className="pointer-events-auto ui-card absolute z-20 flex max-w-[calc(100vw-16px)] origin-top-right animate-rise flex-col overflow-hidden shadow-[var(--shadow-panel)]"
      style={{
        width,
        right: EDGE,
        top: EDGE + barH + GAP,
        bottom: `calc(max(${EDGE}px, env(safe-area-inset-bottom, 0px)) + ${barH + GAP}px)`,
      }}
    >
      {stripe}
      {head}
      {body}
    </aside>
  )
}
