// Panel tabs: Mağaza · Ekip · Projeler · Büyüme · Metrikler. They live in the bottom bar (layout/BottomBar.tsx,
// docs/LAYOUT.md §1); the tab content opens in the single RightPanel (a tab replaces whatever the panel showed, the
// same tab again closes it). Kazanımlar moved to the top-bar book icon (K, docs/GAMEPLAY_V2.md §12).
// HUD grammar (§10.4): icon 20 + badge, the label only on a ≥1280px screen (and always in title / aria).
// Guidance (§11, D8): the tab the next step needs breathes; a hire that bounced off a missing desk badges Mağaza,
// which then opens on the empty desk slot (the scene's ghost slot).
// Badges (§4.1): counters in brand, a leaving employee in warning.
// Locked late tools (§8.5, §9.4: Pazar, Refactor, Yenileme, Satın alma): the next stage's ones sit after the tabs as
// grey silhouettes with a lock and that stage's pill; they leave the row once the stage opens them.
import { useShallow } from 'zustand/react/shallow'
import { STAGES } from '../content'
import type { ToolId } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import type { DockTab } from '../store/types'
import { unseenMetrics } from '../store/metricPins'
import { Icon, type IconName } from './icons'
import { t } from './i18n'
import { cx } from './primitives'
import { deskNeeded, dropDeskError, guidedTab, shopSlotTarget } from './guidance'
import { lockedTools } from './center/centerData'

/** The noDesk error a free desk has already answered (guidance.ts dropDeskError), folded on every store change. */
let deskErrorDropped = 0
useGameStore.subscribe((st) => {
  deskErrorDropped = dropDeskError(deskErrorDropped, st.state, st.ui.lastError)
})

export interface DockTabDef {
  id: DockTab
  icon: IconName
  /** Desktop keyboard shortcut (lowercase). */
  key: string
}

export const DOCK_TABS: DockTabDef[] = [
  { id: 'shop', icon: 'bag', key: 'm' },
  { id: 'team', icon: 'users', key: 'e' },
  { id: 'projects', icon: 'rocket', key: 'p' },
  { id: 'growth', icon: 'growth', key: 'b' },
  { id: 'metrics', icon: 'bars', key: 'g' },
]

type BadgeTone = 'brand' | 'warn'

const TOOL_ICON: Partial<Record<ToolId, IconName>> = { segments: 'pie', refactor: 'refresh', renewal: 'handshake', mna: 'flag' }

function useBadges(): Partial<Record<DockTab, { n: number; tone: BadgeTone }>> {
  const leaving = useGameStore((s) => s.state.employees.filter((e) => e.status === 'leaving').length)
  const fresh = useGameStore((s) => unseenMetrics(s.state.unlockedWidgets, s.ui.seenMetrics).length)
  const desk = useGameStore((s) => deskNeeded(s.state, s.ui.lastError, deskErrorDropped))
  return {
    shop: { n: desk ? 1 : 0, tone: 'brand' },
    team: { n: leaving, tone: 'warn' },
    metrics: { n: fresh, tone: 'brand' },
  }
}

/** Tab press: Mağaza with a desk missing (bounced hire or the "desk" step) opens on the empty desk slot; every other press toggles the tab. */
function useTabPress(): (tab: DockTab) => void {
  const togglePanel = useGameStore((s) => s.togglePanel)
  return (tab) => {
    const st = useGameStore.getState()
    if (tab === 'shop' && st.ui.panel?.kind !== 'shop') {
      const slotTarget = shopSlotTarget(st.state, st.ui.lastError, deskErrorDropped)
      if (slotTarget) return st.openPanel({ kind: 'shop', slotTarget }, { root: true })
    }
    togglePanel(tab)
  }
}

/**
 * The tab buttons. `bar`: desktop bottom bar, h40, icon 20; the label shows only on a ≥1280px screen.
 * `mobile`: phone row, icon 20 + 10px label, h48. `touch` (landscape phone bar): the `bar` row with 44px targets.
 * The row always keeps to the bar's right end. The guided tab breathes unless it is already open.
 */
export function DockTabs({ variant, touch = false }: { variant: 'bar' | 'mobile'; touch?: boolean }) {
  const active = useGameStore((s) => s.ui.panel?.kind)
  const guided = useGameStore((s) => guidedTab(s.state))
  const press = useTabPress()
  const badges = useBadges()

  if (variant === 'mobile') {
    return (
      <div className="ui-scroll flex h-12 min-w-0 items-stretch gap-1 overflow-x-auto" role="tablist" aria-label={t('bottom.tabs')}>
        {DOCK_TABS.map((d) => {
          const on = active === d.id
          return (
            <button
              key={d.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => press(d.id)}
              className={cx(
                'relative flex min-w-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-control text-[10px] font-semibold',
                on ? 'bg-brand-soft text-brand-ink' : 'text-ink-2',
                guided === d.id && !on && 'animate-breathe text-brand-ink',
              )}
            >
              <Icon name={d.icon} size={20} />
              <span className="whitespace-nowrap leading-none">{t(`dock.${d.id}`)}</span>
              <Badge b={badges[d.id]} inset />
            </button>
          )
        })}
        <LockedTools size={48} />
      </div>
    )
  }

  return (
    <div className="ml-auto flex shrink-0 items-center gap-1" role="tablist" aria-label={t('bottom.tabs')}>
      {DOCK_TABS.map((d) => {
        const on = active === d.id
        const label = t(`dock.${d.id}`)
        return (
          <button
            key={d.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => press(d.id)}
            aria-label={label}
            title={`${label} (${d.key.toUpperCase()})`}
            className={cx(
              'relative flex items-center justify-center gap-2 rounded-control px-2.5 text-[13px] font-semibold transition-colors min-[1280px]:px-3',
              touch ? 'h-11 min-w-11' : 'h-10 min-w-10',
              on ? 'bg-brand text-on-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
              guided === d.id && !on && 'animate-breathe bg-brand-soft text-brand-ink',
            )}
          >
            <Icon name={d.icon} size={20} className="shrink-0" />
            <span className="hidden whitespace-nowrap min-[1280px]:inline">{label}</span>
            <Badge b={badges[d.id]} />
          </button>
        )
      })}
      <LockedTools size={touch ? 44 : 40} />
    </div>
  )
}

/** The next stage's late tools as grey silhouettes: icon, lock, the stage pill along the bottom edge (no action). */
function LockedTools({ size }: { size: number }) {
  const tools = useGameStore(useShallow((s) => lockedTools(STAGES, s.state.unlockedTools, s.state.stage).map((x) => `${x.id}:${x.stage}`)))
  return tools.map((key) => {
    const [id, at] = key.split(':') as [ToolId, string]
    const stage = STAGES[Number(at)]?.name ?? ''
    const title = t('dock.lockedTitle', { tool: t(`tool.${id}`), stage })
    return (
      <span
        key={id}
        role="img"
        aria-label={title}
        title={title}
        data-locked-tool={id}
        className="relative grid shrink-0 place-items-center rounded-control border border-dashed border-border-strong text-ink-3"
        style={{ width: size, height: size }}
      >
        <Icon name={TOOL_ICON[id] ?? 'lock'} size={18} className="-mt-2.5 opacity-40" />
        <span aria-hidden="true" className="absolute right-0.5 top-0.5 text-ink-2">
          <Icon name="lock" size={10} />
        </span>
        <span aria-hidden="true" className="tabular absolute bottom-[3px] left-1/2 max-w-[40px] -translate-x-1/2 truncate whitespace-nowrap rounded-full bg-surface-2 px-1 text-[8px] font-bold uppercase leading-3 text-ink-2">
          {stage}
        </span>
      </span>
    )
  })
}

/** `inset`: inside the button (phone row scrolls sideways, which would clip a badge that sticks out). */
function Badge({ b, inset }: { b?: { n: number; tone: BadgeTone }; inset?: boolean }) {
  if (!b?.n) return null
  return (
    <span
      className={cx(
        inset ? 'right-[calc(50%-20px)] top-0.5' : '-right-1 -top-1',
        'tabular absolute grid min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold leading-4 ring-2 ring-surface',
        b.tone === 'warn' ? 'bg-energy-ink text-on-ink' : 'bg-brand text-on-ink',
      )}
    >
      {b.n}
    </span>
  )
}
