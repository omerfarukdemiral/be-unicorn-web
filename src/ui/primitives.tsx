// Shared UI building blocks: cards, buttons, bars, chips, labels.
// Minimal "neutral + one accent" look (docs/DESIGN.md): ink fills for primary, hairline frames for
// secondary, no pastel fills. Colour only on numbers (<Delta />) and tiny status marks (<Dot />).
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from './icons'
import { clamp01 } from './format'

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('ui-card', className)}>{children}</div>
}

/**
 * primary   = ink fill (main CTA)
 * secondary = hairline frame, transparent (alias: soft)
 * ghost     = text only, hover tint
 * danger    = hairline frame, red text
 * mint      = DEPRECATED alias of primary (kept so old callers compile)
 */
type Tone = 'primary' | 'secondary' | 'ghost' | 'soft' | 'danger' | 'mint'

const PRIMARY = 'bg-ink text-on-ink hover:bg-ink/85 disabled:bg-ink-3'
const SECONDARY = 'border border-border-strong bg-transparent text-ink hover:bg-surface-2'

const TONE: Record<Tone, string> = {
  primary: PRIMARY,
  secondary: SECONDARY,
  soft: SECONDARY,
  ghost: 'bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'border border-border-strong bg-transparent text-negative hover:bg-negative/5',
  mint: PRIMARY,
}

export function Button({
  tone = 'secondary',
  icon,
  size = 'md',
  className,
  children,
  ...rest
}: { tone?: Tone; icon?: IconName; size?: 'sm' | 'md' } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex select-none items-center justify-center gap-1.5 rounded-control font-ui font-semibold tracking-wide transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
        size === 'md' ? 'min-h-11 px-4 text-sm' : 'min-h-9 px-3 text-xs max-md:min-h-11',
        TONE[tone],
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'md' ? 18 : 16} />}
      {children}
    </button>
  )
}

export function IconButton({
  icon,
  label,
  active,
  className,
  size = 44,
  ...rest
}: { icon: IconName; label: string; active?: boolean; size?: number } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-control transition-colors active:scale-95 disabled:opacity-40',
        active ? 'bg-ink text-on-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        className,
      )}
      style={{ width: size, height: size }}
      {...rest}
    >
      <Icon name={icon} size={Math.round(size * 0.45)} />
    </button>
  )
}

/** Horizontal progress bar with optional marker (e.g. MVP at 0.2). Flat ink fill on a hairline track. */
export function Bar({
  value,
  tone = 'bg-ink',
  marker,
  className,
  height = 6,
}: { value: number; tone?: string; marker?: number; className?: string; height?: number }) {
  return (
    <div className={cx('relative w-full overflow-hidden rounded-full bg-border', className)} style={{ height }}>
      <div className={cx('h-full rounded-full transition-[width] duration-500', tone)} style={{ width: `${clamp01(value) * 100}%` }} />
      {marker !== undefined && (
        <div className="absolute inset-y-0 w-px bg-ink-2" style={{ left: `${clamp01(marker) * 100}%` }} />
      )}
    </div>
  )
}

/** Circular progress ring (cooldowns, round timer). `value` 0–1 = filled fraction. */
export function Ring({ value, size = 44, stroke = 2, tone = 'var(--color-ink)' }: { value: number; size?: number; stroke?: number; tone?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className="pointer-events-none absolute inset-0 -rotate-90" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={tone}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - clamp01(value))}
        style={{ transition: 'stroke-dashoffset 300ms linear' }}
      />
    </svg>
  )
}

/** Filter / segmented chip. Active = ink fill, idle = hairline frame. */
export function Chip({ active, onClick, children, icon }: { active?: boolean; onClick?: () => void; children: ReactNode; icon?: IconName }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'inline-flex min-h-9 shrink-0 items-center gap-1 rounded-control border px-3 text-xs font-semibold transition-colors max-md:min-h-11',
        active ? 'border-ink bg-ink text-on-ink' : 'border-border bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink',
      )}
    >
      {icon && <Icon name={icon} size={14} />}
      {children}
    </button>
  )
}

/** Small status tag: hairline frame, neutral text. Pass a text colour via className; `dot` adds a status mark. */
export function Pill({ className, children, dot }: { className?: string; children: ReactNode; dot?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-px text-[11px] font-medium text-ink-2', className)}>
      {dot && <Dot color={dot} size={6} />}
      {children}
    </span>
  )
}

/** Tiny colour mark: department identity or status. The only place hue may appear outside numbers. */
export function Dot({ color, size = 8, className }: { color: string; size?: number; className?: string }) {
  return <span aria-hidden="true" className={cx('inline-block shrink-0 rounded-full', className)} style={{ width: size, height: size, background: color }} />
}

/** Small uppercase tracked label (KASA, KULLANICI...). */
export function Label({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cx('ui-label', className)}>{children}</span>
}

/** Signed number: green when > 0, red when < 0. Pass the formatted text as children. */
export function Delta({ value, className, children }: { value: number; className?: string; children: ReactNode }) {
  return (
    <span className={cx('tabular font-semibold', value > 0 ? 'text-positive' : value < 0 ? 'text-negative' : 'text-ink-2', className)}>{children}</span>
  )
}

/** Icon "badge" without a coloured disc: ink-2 icon, optional faint neutral square. */
export function IconBadge({ icon, size = 32, filled = false, className }: { icon: IconName; size?: number; filled?: boolean; className?: string }) {
  return (
    <span
      className={cx('grid shrink-0 place-items-center rounded-control text-ink-2', filled && 'border border-border bg-surface-2', className)}
      style={{ width: size, height: size }}
    >
      <Icon name={icon} size={Math.round(size * 0.55)} />
    </span>
  )
}

export function Divider({ className }: { className?: string }) {
  return <div className={cx('h-px w-full bg-border', className)} />
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="ui-label">{children}</h3>
      {right}
    </div>
  )
}

export function LockedHint({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-control border border-dashed border-border-strong px-3 py-3 text-xs text-ink-2">
      <Icon name="lock" size={16} className="shrink-0 text-ink-3" />
      <span className="font-text">{text}</span>
    </div>
  )
}

export function Empty({ text, icon = 'sparkle' }: { text: string; icon?: IconName }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-xs text-ink-2">
      <Icon name={icon} size={20} className="text-ink-3" />
      <span className="font-text">{text}</span>
    </div>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-control border border-border px-3 py-2">
      <div className="ui-label truncate">{label}</div>
      <div className="tabular truncate text-sm font-semibold text-ink">{value}</div>
      {sub && <div className="truncate text-[11px] text-ink-2">{sub}</div>}
    </div>
  )
}

/** Stars for quality 0.5–1.5 (only when candidateQuality is unlocked). */
export function QualityStars({ quality }: { quality: number }) {
  const n = Math.max(1, Math.min(5, Math.round((quality - 0.5) * 4) + 1))
  return (
    <span className="inline-flex text-ink" aria-label={`${n}/5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Icon key={i} name="star" size={12} fill={i < n ? 'currentColor' : 'none'} className={i < n ? '' : 'text-ink-3'} />
      ))}
    </span>
  )
}
