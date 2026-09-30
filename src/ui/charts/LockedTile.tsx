// A chart not learned yet (docs/GAMEPLAY_V2.md §14.4): icon + name in a dashed frame, no sentence. The series exists
// but its gauge is still locked (Hisset → Adlandır → Kullan, DECISIONS #9-#10), so the tile only says "here".
import { Icon, type IconName } from '../icons'

export function LockedTile({ label, icon, height = 200 }: { label: string; icon: IconName; height?: number }) {
  return (
    <div
      data-locked-tile=""
      className="flex w-full flex-col items-center justify-center gap-1.5 rounded-control border border-dashed border-border-strong text-ink-3"
      style={{ minHeight: height }}
    >
      <span className="relative">
        <Icon name={icon} size={22} />
        <Icon name="lock" size={12} className="absolute -bottom-1 -right-2 rounded-full bg-surface text-ink-2" />
      </span>
      <span className="ui-label text-ink-3">{label}</span>
    </div>
  )
}
