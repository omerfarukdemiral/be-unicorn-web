// The founder's laptop (T19, option A): data screens (Metrikler, Büyüme in the side panel; İstatistik and Pazar in the
// center frame) wear a dark screen bezel and an app bar ("● ● ●  Metrikler"), so a chart reads as an app on a device in
// the world, not a web page. Shop / Ekip / Projeler stay game cards. Desktop only: a phone panel already fills the
// phone. Fixed device colours (a laptop is dark in both themes).
import type { PanelKind } from '../../store/types'

/** Panels that open as an app on the laptop. */
export const DEVICE_PANELS: ReadonlySet<PanelKind> = new Set<PanelKind>(['metrics', 'growth'])

/** The bezel: replaces .ui-card's frame on the panel / center card (keep overflow-hidden on the element). */
export const DEVICE_SHELL = 'rounded-[18px] border-[9px] border-[#2d2724] bg-surface shadow-[0_0_0_1px_#120e0c,0_18px_40px_rgb(40_25_10/0.35)]'

/** The app's title bar: three window dots + the app name. Decorative for screen readers (the panel names itself). */
export function AppBar({ title }: { title: string }) {
  return (
    <div aria-hidden="true" className="flex h-[26px] shrink-0 items-center gap-2.5 bg-[#3a332f] px-3 text-[12px] font-semibold text-[#f3ebdf]">
      <span className="flex gap-[5px]">
        <i className="size-[9px] rounded-full bg-[#e0675a]" />
        <i className="size-[9px] rounded-full bg-[#e7b84b]" />
        <i className="size-[9px] rounded-full bg-[#6cb86a]" />
      </span>
      <span className="truncate">{title}</span>
    </div>
  )
}
