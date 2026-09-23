// The single panel: Mağaza, Ekip, Projeler, Büyüme, Defter, scene details, decisions and settings all open
// here and replace each other (store.ui.panel). Desktop = fixed right column, the office stays visible in
// the middle; phones = one bottom sheet above the dock bar.
import { useCallback, useRef, type ReactNode } from 'react'
import { useGameStore } from '../store/gameStore'
import type { Panel } from '../store/types'
import { Icon, type IconName } from './icons'
import { t } from './i18n'
import { cx, IconButton } from './primitives'
import { useIsMobile } from './hooks'
import { DetailBody, DetailHeader, DetailPreview, type RenderPreview } from './DetailPanel'
import { DOCK_TABS } from './Dock'
import { ShopPanel } from './panels/ShopPanel'
import { TeamPanel } from './panels/TeamPanel'
import { ProjectsPanel } from './panels/ProjectsPanel'
import { GrowthPanel } from './panels/GrowthPanel'
import { JournalPanel } from './panels/JournalPanel'
import { DecisionPanel } from './panels/DecisionPanel'
import { SettingsPanel } from './panels/SettingsPanel'

/** Desktop panel width (px). GameUI keeps the dock / toasts left of it. */
export const PANEL_W = 400
/** Panel width + its right gutter + a gap: where centered bottom UI must stop. */
export const PANEL_RESERVE = PANEL_W + 24

function panelMeta(p: Panel): { icon: IconName; title: string } {
  switch (p.kind) {
    case 'decision':
      return { icon: 'chat', title: t('decision.title') }
    case 'settings':
      return { icon: 'gear', title: t('settings.title') }
    case 'detail':
      return { icon: 'search', title: '' }
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

/**
 * Callback ref for the panel element: reports the screen area it covers (store.ui.sceneInset) so the camera
 * frames the office in the visible rest — left of the desktop panel, above the phone sheet and below the HUD.
 */
function useSceneInsetReporter(mobile: boolean): (el: HTMLElement | null) => void {
  const cleanup = useRef<(() => void) | null>(null)
  return useCallback(
    (el: HTMLElement | null) => {
      cleanup.current?.()
      cleanup.current = null
      const setInset = useGameStore.getState().setSceneInset
      if (!el) {
        setInset({ top: 0, right: 0, bottom: 0 })
        return
      }
      const measure = () => {
        const r = el.getBoundingClientRect()
        if (mobile) {
          const hud = document.querySelector('[data-scene-top]')?.getBoundingClientRect()
          setInset({ top: Math.round(hud?.bottom ?? 0), right: 0, bottom: Math.round(window.innerHeight - r.top) })
        } else {
          setInset({ top: 0, right: Math.round(window.innerWidth - r.left), bottom: 0 })
        }
      }
      measure()
      const ro = new ResizeObserver(measure)
      ro.observe(el)
      window.addEventListener('resize', measure)
      // The sheet slides in: measure again once the enter animation has settled.
      const late = window.setTimeout(measure, 350)
      cleanup.current = () => {
        ro.disconnect()
        window.removeEventListener('resize', measure)
        window.clearTimeout(late)
      }
    },
    [mobile],
  )
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
  const insetRef = useSceneInsetReporter(mobile)
  if (!panel) return null

  const meta = panelMeta(panel)
  const back = hasBack ? <IconButton icon="chevronLeft" label={t('common.back')} onClick={goBack} size={mobile ? 44 : 36} /> : null
  const close = <IconButton icon="close" label={t('common.close')} onClick={closePanel} size={mobile ? 44 : 36} />
  let head: ReactNode
  if (panel.kind === 'detail') {
    head = (
      <div className="flex items-start gap-2 px-3 pb-2 pt-3">
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
      <div className="flex items-center gap-2 px-3 pb-2 pt-3">
        {back}
        <h2 className="flex min-w-0 flex-1 items-center gap-2 pl-1 text-base font-extrabold tracking-tight">
          <Icon name={meta.icon} size={18} className="shrink-0 text-lilac-500" />
          <span className="truncate">{meta.title}</span>
        </h2>
        {close}
      </div>
    )
  }
  const body = (
    <div key={panelKey(panel)} className={cx('@container ui-scroll min-h-0 flex-1 animate-fade-in', mobile ? 'px-3 pb-3' : 'px-4 pb-4')}>
      <PanelBody panel={panel} />
    </div>
  )

  if (mobile) {
    return (
      <section
        ref={insetRef}
        aria-label={meta.title || t('panel.label')}
        className="pointer-events-auto fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom,0px))] z-20 flex max-h-[52vh] animate-slide-up flex-col rounded-t-[var(--radius-card)] border-t border-cream-300 bg-cream-50 shadow-[var(--shadow-pop)] landscape:max-h-[72vh]"
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-cream-300" />
        {head}
        {body}
      </section>
    )
  }
  return (
    <aside
      ref={insetRef}
      aria-label={meta.title || t('panel.label')}
      className="pointer-events-auto ui-card absolute bottom-3 right-3 top-[76px] z-20 flex max-w-[calc(100vw-1.5rem)] animate-slide-left flex-col overflow-hidden"
      style={{ width: PANEL_W }}
    >
      {head}
      {body}
    </aside>
  )
}
