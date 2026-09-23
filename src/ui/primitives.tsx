// Shared UI building blocks: cards, buttons, bars, chips, labels.
// "Calm UI + coloured accents" (docs/DESIGN.md): warm neutral surfaces, brand (unicorn violet) for the
// primary action / active state / progress, per-meaning hues on icons, bars and small marks. Text stays ink.
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from './icons'
import { clamp01 } from './format'
import { iconTone, soft } from './theme'

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('ui-card', className)}>{children}</div>
}

/**
 * primary   = brand fill (main CTA)
 * secondary = hairline frame, transparent (alias: soft)
 * ghost     = text only, hover tint
 * danger    = hairline frame, red text
 * onInk     = secondary for dark (ink) surfaces: toasts, banners
 * mint      = DEPRECATED alias of primary (kept so old callers compile)
 *
 * Disabled: primary drops to a neutral frame with ink-2 text (readable, clearly inactive) instead of
 * fading its light label into a grey fill; the other tones fade with opacity.
 */
type Tone = 'primary' | 'secondary' | 'ghost' | 'soft' | 'danger' | 'onInk' | 'mint'

const PRIMARY =
  'border border-brand bg-brand text-on-ink enabled:hover:border-brand-hover enabled:hover:bg-brand-hover disabled:border-border-strong disabled:bg-surface-2 disabled:text-ink-2'
const SECONDARY = 'border border-border-strong bg-transparent text-ink enabled:hover:bg-surface-2 disabled:opacity-50'

const TONE: Record<Tone, string> = {
  primary: PRIMARY,
  secondary: SECONDARY,
  soft: SECONDARY,
  ghost: 'bg-transparent text-ink-2 enabled:hover:bg-surface-2 enabled:hover:text-ink disabled:opacity-50',
  danger: 'border border-border-strong bg-transparent text-negative-ink enabled:hover:bg-negative/5 disabled:opacity-50',
  onInk: 'border border-on-ink/30 bg-transparent text-on-ink enabled:hover:bg-on-ink/10 disabled:opacity-50',
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
        'inline-flex select-none items-center justify-center gap-1.5 rounded-control font-ui font-semibold tracking-wide transition-colors enabled:active:scale-[0.98] disabled:cursor-not-allowed',
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
        active ? 'bg-brand text-on-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        className,
      )}
      style={{ width: size, height: size }}
      {...rest}
    >
      <Icon name={icon} size={Math.round(size * 0.45)} />
    </button>
  )
}

/**
 * Horizontal progress bar with optional marker (e.g. MVP at 0.2). Brand fill by default; pass a Tailwind
 * `tone` class or a CSS `color` (gauge hue) — with `color` the track becomes a faint tint of the same hue.
 */
export function Bar({
  value,
  tone = 'bg-brand',
  color,
  marker,
  className,
  height = 6,
}: { value: number; tone?: string; color?: string; marker?: number; className?: string; height?: number }) {
  return (
    <div className={cx('relative w-full overflow-hidden rounded-full', !color && 'bg-border', className)} style={{ height, background: color ? soft(color, 16) : undefined }}>
      <div className={cx('h-full rounded-full transition-[width] duration-500', !color && tone)} style={{ width: `${clamp01(value) * 100}%`, background: color }} />
      {marker !== undefined && (
        <div className="absolute inset-y-0 w-px bg-ink-2" style={{ left: `${clamp01(marker) * 100}%` }} />
      )}
    </div>
  )
}

/** Circular progress ring (cooldowns, round timer). `value` 0–1 = filled fraction. */
export function Ring({ value, size = 44, stroke = 2, tone = 'var(--color-brand)' }: { value: number; size?: number; stroke?: number; tone?: string }) {
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

/**
 * Filter / segmented chip. Active = brand tint + brand frame + brand-ink text; idle = hairline frame.
 * Identity colours (e.g. a department) go in as a <Dot> child, never as the selected state: a dept hue
 * on a 1px frame is below 3:1 for sales/ops, and selected must read the same on every chip.
 */
export function Chip({ active, onClick, children, icon }: { active?: boolean; onClick?: () => void; children: ReactNode; icon?: IconName }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'inline-flex min-h-9 shrink-0 items-center gap-1 rounded-control border px-3 text-xs font-semibold transition-colors max-md:min-h-11',
        active ? 'border-brand bg-brand-soft text-brand-ink' : 'border-border bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink',
      )}
    >
      {icon && <Icon name={icon} size={14} />}
      {children}
    </button>
  )
}

const TEXT_COLOR = /(^|\s)text-(ink|brand|positive|negative|on-ink)/

/**
 * Small tag: hairline frame, neutral text. Pass a text colour via className; `dot` adds a coloured mark;
 * `tint` (CSS colour) swaps the frame for a light fill of that hue (department / live tags), text stays ink.
 */
export function Pill({ className, children, dot, tint }: { className?: string; children: ReactNode; dot?: string; tint?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-px text-[11px] font-medium',
        tint ? 'border-transparent' : 'border-border',
        // Default text colour only when the caller passes none (two text-* utilities would race on CSS order).
        !TEXT_COLOR.test(className ?? '') && (tint ? 'text-ink' : 'text-ink-2'),
        className,
      )}
      style={tint ? { background: soft(tint, 14) } : undefined}
    >
      {dot && <Dot color={dot} size={6} />}
      {children}
    </span>
  )
}

/** Tiny colour mark: department identity, status or kind. */
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
    <span className={cx('tabular font-semibold', value > 0 ? 'text-positive-ink' : value < 0 ? 'text-negative-ink' : 'text-ink-2', className)}>{children}</span>
  )
}

/**
 * Icon badge. Neutral: ink-2 icon, optional faint square (`filled`). With `color`: icon in that hue on a
 * ~12% tile of the same hue (HUD gauges, bubble kinds, section headers). Small and light, never a solid disc.
 */
export function IconBadge({ icon, size = 32, filled = false, color, className }: { icon: IconName; size?: number; filled?: boolean; color?: string; className?: string }) {
  return (
    <span
      className={cx('grid shrink-0 place-items-center rounded-control', !color && 'text-ink-2', !color && filled && 'border border-border bg-surface-2', className)}
      style={{ width: size, height: size, ...(color ? { color: iconTone(color), background: soft(color) } : null) }}
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

/**
 * Metric: same pattern as the HUD widgets: no frame, a hairline on top, tracked label, 15px tabular value.
 * `icon` + `color` add the metric's gauge tile (same hue as its HUD chip).
 * Grids of Stats read as rows separated by hairlines (no card-in-card). Labels and values wrap, never ellipsise.
 */
export function Stat({ label, value, sub, icon, color }: { label: string; value: ReactNode; sub?: ReactNode; icon?: IconName; color?: string }) {
  return (
    <div className="min-w-0 border-t border-border pt-2">
      <div className="flex min-w-0 items-center gap-1.5">
        {/* Same gauge hue + tile as the HUD chip for this metric (WIDGET_COLOR), so a metric keeps its colour everywhere. */}
        {icon && color && (
          <span aria-hidden="true" className="grid size-[18px] shrink-0 place-items-center rounded-[5px]" style={{ color: iconTone(color), background: soft(color) }}>
            <Icon name={icon} size={11} />
          </span>
        )}
        <div className="ui-label line-clamp-2 min-w-0 leading-[14px] tracking-[0.04em]">{label}</div>
      </div>
      <div className="tabular mt-0.5 break-words text-[15px] font-semibold leading-tight text-ink">{value}</div>
      {sub && <div className="break-words text-[11px] font-medium text-ink-2">{sub}</div>}
    </div>
  )
}

/** Stars for quality 0.5–1.5 (only when candidateQuality is unlocked). */
export function QualityStars({ quality }: { quality: number }) {
  const n = Math.max(1, Math.min(5, Math.round((quality - 0.5) * 4) + 1))
  return (
    <span className="inline-flex text-g-equity" aria-label={`${n}/5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Icon key={i} name="star" size={12} fill={i < n ? 'currentColor' : 'none'} className={i < n ? '' : 'text-ink-3'} />
      ))}
    </span>
  )
}
