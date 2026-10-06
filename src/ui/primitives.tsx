// Shared UI building blocks: cards, buttons, bars, chips, labels, the spend preview.
// "Calm UI + coloured accents" (docs/DESIGN.md) in the HUD grammar of docs/GAMEPLAY_V2.md §10.1: number over label,
// commit buttons carry their cost, warm neutral surfaces, brand (unicorn violet) for the commit / active state /
// progress, per-meaning hues on icons, bars and small marks. Text stays ink.
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { SpendPreview } from '../engine/types'
import { Icon, type IconName } from './icons'
import { t } from './i18n'
import { clamp01, fixed } from './format'
import { useTween } from './hooks'
import { InfoTip } from './InfoTip'
import { iconTone, RUNWAY_DANGER_MONTHS, soft } from './theme'

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('ui-card', className)}>{children}</div>
}

/**
 * Button ladder (docs/GAMEPLAY_V2.md §10.1 D3):
 * commit  = spends money / equity / a move: brand fill, optional `cost` chip (`−$4.2K/ay`), a 120 ms press
 *           (scale 0.96 → 1) and the `confirm` cue (data-cue, read by the click sound hook)
 * routine = Anladım, Kapat, Sonra: hairline frame, small by default
 * danger  = İşten çıkar, Sat: hairline in a faint negative, red text
 * ghost   = text only, hover tint
 * onInk   = routine for dark (ink) surfaces: toasts, banners
 * primary / secondary / soft / mint = DEPRECATED aliases (commit look / routine look at md size) kept so old
 * callers compile; migrate with the panel content waves.
 *
 * Disabled: commit drops to a neutral frame with ink-2 text (readable, clearly inactive) instead of fading its
 * light label into a grey fill; the other tones fade with opacity.
 */
type Tone = 'commit' | 'routine' | 'danger' | 'ghost' | 'onInk' | 'primary' | 'secondary' | 'soft' | 'mint'

const COMMIT =
  'border border-brand bg-brand text-on-ink enabled:hover:border-brand-hover enabled:hover:bg-brand-hover enabled:active:scale-[0.96] disabled:border-border-strong disabled:bg-surface-2 disabled:text-ink-2'
const ROUTINE = 'border border-border-strong bg-transparent text-ink enabled:hover:bg-surface-2 enabled:active:scale-[0.98] disabled:opacity-50'

const TONE: Record<Tone, string> = {
  commit: COMMIT,
  routine: ROUTINE,
  danger: 'border border-negative/35 bg-transparent text-negative-ink enabled:hover:bg-negative/5 enabled:active:scale-[0.98] disabled:opacity-50',
  ghost: 'bg-transparent text-ink-2 enabled:hover:bg-surface-2 enabled:hover:text-ink enabled:active:scale-[0.98] disabled:opacity-50',
  onInk: 'border border-on-ink/30 bg-transparent text-on-ink enabled:hover:bg-on-ink/10 enabled:active:scale-[0.98] disabled:opacity-50',
  primary: COMMIT,
  secondary: ROUTINE,
  soft: ROUTINE,
  mint: COMMIT,
}

const FILLED = new Set<Tone>(['commit', 'primary', 'mint'])

export function Button({
  tone = 'secondary',
  icon,
  size,
  cost,
  className,
  children,
  ...rest
}: { tone?: Tone; icon?: IconName; size?: 'sm' | 'md'; cost?: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const sz = size ?? (tone === 'routine' ? 'sm' : 'md')
  const filled = FILLED.has(tone)
  return (
    <button
      type="button"
      data-cue={tone === 'commit' ? 'confirm' : undefined}
      className={cx(
        'inline-flex select-none items-center justify-center gap-1.5 rounded-control font-ui font-semibold tracking-wide transition-[color,background-color,border-color,transform] duration-[120ms] disabled:cursor-not-allowed',
        sz === 'md' ? 'min-h-11 px-4 text-sm' : 'min-h-9 px-3 text-xs max-md:min-h-11',
        TONE[tone],
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size={sz === 'md' ? 18 : 16} />}
      {children}
      {cost && (
        <span className={cx('tabular rounded-[6px] px-1.5 py-px text-[11px] font-semibold', filled ? 'bg-on-ink/15' : 'bg-surface-2 text-ink-2')}>{cost}</span>
      )}
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
 * Filter / segment chip. Active = brand tint + brand frame + brand-ink text; idle = hairline frame.
 * `count` adds a tabular number after the label (icon + number is the HUD way: "👥 12"); `label` names an
 * icon-only chip for screen readers. Inside a <Segmented> track pass `segment`: no frame, the active one lifts.
 * Identity colours (e.g. a department) go in as a <Dot> child, never as the selected state: a dept hue
 * on a 1px frame is below 3:1 for sales/ops, and selected must read the same on every chip.
 */
export function Chip({
  active,
  onClick,
  children,
  icon,
  count,
  label,
  segment,
}: { active?: boolean; onClick?: () => void; children?: ReactNode; icon?: IconName; count?: ReactNode; label?: string; segment?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex shrink-0 items-center gap-1 rounded-control text-xs font-semibold transition-colors',
        segment ? 'min-h-8 px-2.5 max-md:min-h-11' : 'min-h-9 border px-3 max-md:min-h-11',
        segment
          ? active
            ? 'bg-surface text-ink shadow-card'
            : 'text-ink-2 hover:text-ink'
          : active
            ? 'border-brand bg-brand-soft text-brand-ink'
            : 'border-border bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink',
      )}
    >
      {icon && <Icon name={icon} size={14} />}
      {children}
      {count !== undefined && <span className="tabular font-bold">{count}</span>}
    </button>
  )
}

/** Segment control track: a row of `<Chip segment>` on a surface-2 inset (one of them active). */
export function Segmented({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cx('inline-flex items-center gap-0.5 rounded-control bg-surface-2 p-0.5', className)}>
      {children}
    </div>
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

/** Section head: a 3px colour stripe (the section's hue; neutral by default) + the uppercase label, `right` at the end. */
export function SectionTitle({ children, right, color = 'var(--color-border-strong)' }: { children: ReactNode; right?: ReactNode; color?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="ui-label flex min-w-0 items-center gap-1.5">
        <span aria-hidden="true" className="h-3 w-[3px] shrink-0 rounded-full" style={{ background: color }} />
        {children}
      </h3>
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

/** A number that eases to its target (useTween) and prints through `format`. */
function TweenValue({ value, format }: { value: number; format: (n: number) => string }) {
  return <>{format(useTween(value))}</>
}

const plain = (n: number): string => String(Math.round(n))

/**
 * Metric in the HUD grammar (docs/GAMEPLAY_V2.md §10.1 D1): the number is the biggest thing (22px tabular), the
 * tracked label sits under it. `icon` + `color` add the metric's gauge tile next to the label (same hue as its HUD
 * chip). `delta` prints a signed change next to the value (green / red text only); `tween` eases a numeric `value`
 * through `format`. Grids of Stats read as rows separated by hairlines (no card-in-card). Nothing ellipsises.
 */
export function Stat({
  label,
  value,
  sub,
  icon,
  color,
  delta,
  tween,
  format = plain,
  info,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  /** The explanation behind an ⓘ next to the label (instead of a sub line). */
  info?: ReactNode
  icon?: IconName
  color?: string
  delta?: { value: number; text: string }
  tween?: boolean
  format?: (n: number) => string
}) {
  return (
    <div className="min-w-0 border-t border-border pt-2">
      <div className="flex min-w-0 items-baseline gap-1.5">
        <div className="tabular break-words text-[22px] font-semibold leading-none text-ink">
          {typeof value === 'number' ? tween ? <TweenValue value={value} format={format} /> : format(value) : value}
        </div>
        {delta && (
          <Delta value={delta.value} className="text-[12px]">
            {delta.text}
          </Delta>
        )}
      </div>
      <div className="mt-1 flex min-w-0 items-center gap-1.5">
        {/* Same gauge hue + tile as the HUD chip for this metric (WIDGET_COLOR), so a metric keeps its colour everywhere. */}
        {icon && color && (
          <span aria-hidden="true" className="grid size-[16px] shrink-0 place-items-center rounded-[5px]" style={{ color: iconTone(color), background: soft(color) }}>
            <Icon name={icon} size={10} />
          </span>
        )}
        <div className="ui-label line-clamp-2 min-w-0 leading-[14px] tracking-[0.04em]">{label}</div>
        {info && (
          <InfoTip title={label} size={12}>
            {info}
          </InfoTip>
        )}
      </div>
      {sub && <div className="break-words text-[11px] font-medium text-ink-2">{sub}</div>}
    </div>
  )
}

/** Months of runway as printed in the spend preview: 1 decimal, ∞ when profitable. */
function runwayText(m: number | null): string {
  return m === null ? t('top.runwayInfinite') : fixed(m, 1)
}

/**
 * What a commit does to the money (docs/GAMEPLAY_V2.md §4.4): `⌛ 9 → 7 ay`, with the button's `cost` in front.
 * Data comes in as the engine's previewSpend() result; this component computes nothing. Red only when the move
 * lands in the danger band (runway < 3 or the next payday cannot be paid: the one red rule).
 */
export function CostPreview({ preview, cost, className }: { preview: SpendPreview; cost?: string; className?: string }) {
  const after = preview.runwayAfter
  const danger = preview.paydayShort || (after !== null && after < RUNWAY_DANGER_MONTHS)
  return (
    <span
      data-danger={danger ? '' : undefined}
      className={cx(
        'tabular inline-flex items-center gap-1 rounded-md border px-1.5 py-px text-[11px] font-semibold',
        danger ? 'border-negative/35 text-negative-ink' : 'border-border text-ink-2',
        className,
      )}
    >
      {cost && <span className={danger ? undefined : 'text-ink'}>{cost}</span>}
      <Icon name="hourglass" size={12} />
      <span>{runwayText(preview.runwayNow)}</span>
      <Icon name="arrowRight" size={11} />
      <span>{after === null ? t('top.runwayInfinite') : t('top.runway', { v: runwayText(after) })}</span>
    </span>
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
