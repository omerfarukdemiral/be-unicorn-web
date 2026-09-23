// Shared UI building blocks: cards, buttons, bars, chips, sheets.
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from './icons'
import { clamp01 } from './format'

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('ui-card', className)}>{children}</div>
}

type Tone = 'primary' | 'ghost' | 'soft' | 'danger' | 'mint'

const TONE: Record<Tone, string> = {
  primary: 'bg-ink-900 text-cream-50 hover:bg-ink-700 disabled:bg-ink-400',
  ghost: 'bg-transparent text-ink-700 hover:bg-cream-200/70',
  soft: 'bg-cream-200/80 text-ink-900 hover:bg-cream-300/80',
  danger: 'bg-rose-100 text-rose-600 hover:bg-rose-300/60',
  mint: 'bg-mint-300 text-ink-900 hover:bg-mint-300/80',
}

export function Button({
  tone = 'soft',
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
        'inline-flex select-none items-center justify-center gap-1.5 rounded-full font-semibold transition-colors active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50',
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
        'inline-flex shrink-0 items-center justify-center rounded-full transition-colors active:scale-95 disabled:opacity-40',
        active ? 'bg-ink-900 text-cream-50' : 'text-ink-700 hover:bg-cream-200/80',
        className,
      )}
      style={{ width: size, height: size }}
      {...rest}
    >
      <Icon name={icon} size={Math.round(size * 0.45)} />
    </button>
  )
}

/** Horizontal progress bar with optional marker (e.g. MVP at 0.2). */
export function Bar({
  value,
  tone = 'bg-lilac-300',
  marker,
  className,
  height = 8,
}: { value: number; tone?: string; marker?: number; className?: string; height?: number }) {
  return (
    <div className={cx('relative w-full overflow-hidden rounded-full bg-cream-200', className)} style={{ height }}>
      <div className={cx('h-full rounded-full transition-[width] duration-500', tone)} style={{ width: `${clamp01(value) * 100}%` }} />
      {marker !== undefined && (
        <div className="absolute inset-y-0 w-0.5 bg-ink-900/40" style={{ left: `${clamp01(marker) * 100}%` }} />
      )}
    </div>
  )
}

/** Circular progress ring (cooldowns, round timer). `value` 0–1 = filled fraction. */
export function Ring({ value, size = 44, stroke = 3, tone = 'var(--color-lilac-500)' }: { value: number; size?: number; stroke?: number; tone?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className="pointer-events-none absolute inset-0 -rotate-90" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-cream-200)" strokeWidth={stroke} />
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

export function Chip({ active, onClick, children, icon }: { active?: boolean; onClick?: () => void; children: ReactNode; icon?: IconName }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold transition-colors max-md:min-h-11',
        active ? 'bg-ink-900 text-cream-50' : 'bg-cream-200/80 text-ink-700 hover:bg-cream-300/80',
      )}
    >
      {icon && <Icon name={icon} size={14} />}
      {children}
    </button>
  )
}

export function Pill({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', className)}>{children}</span>
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-ink-600">{children}</h3>
      {right}
    </div>
  )
}

export function LockedHint({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-dashed border-cream-300 bg-cream-100/70 px-3 py-3 text-xs text-ink-600">
      <Icon name="lock" size={16} className="shrink-0 text-ink-400" />
      <span>{text}</span>
    </div>
  )
}

export function Empty({ text, icon = 'sparkle' }: { text: string; icon?: IconName }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-xs text-ink-600">
      <Icon name={icon} size={22} className="text-ink-400" />
      <span>{text}</span>
    </div>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-cream-100 px-3 py-2">
      <div className="truncate text-[11px] font-medium text-ink-600">{label}</div>
      <div className="tabular truncate text-sm font-bold text-ink-900">{value}</div>
      {sub && <div className="truncate text-[11px] text-ink-600">{sub}</div>}
    </div>
  )
}

/** Stars for quality 0.5–1.5 (only when candidateQuality is unlocked). */
export function QualityStars({ quality }: { quality: number }) {
  const n = Math.max(1, Math.min(5, Math.round((quality - 0.5) * 4) + 1))
  return (
    <span className="inline-flex text-lemon-600" aria-label={`${n}/5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Icon key={i} name="star" size={12} fill={i < n ? 'currentColor' : 'none'} className={i < n ? '' : 'text-cream-300'} />
      ))}
    </span>
  )
}
