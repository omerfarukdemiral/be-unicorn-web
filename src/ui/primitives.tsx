// Shared UI building blocks: cards, buttons, bars, chips, labels, the spend preview.
// "Toy UI + coloured accents" (docs/DESIGN.md) in the HUD grammar of docs/GAMEPLAY_V2.md §10.1: number over label,
// commit buttons carry their cost, warm paper surfaces with a lip, pressable things are keys (.ui-key), brand
// (unicorn violet) for the commit / active state / progress, per-meaning hues on duotone icons, bars and small
// marks. Text stays ink.
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { SpendPreview } from '../engine/types'
import { Icon, type IconName } from './icons'
import { t } from './i18n'
import { clamp01, fixed } from './format'
import { useTween } from './hooks'
import { InfoTip } from './InfoTip'
import { RUNWAY_DANGER_MONTHS, soft } from './theme'

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('ui-card', className)}>{children}</div>
}

/**
 * Button ladder (docs/GAMEPLAY_V2.md §10.1 D3):
 * commit  = spends money / equity / a move: brand key, optional `cost` chip (`−$4.2K/ay`), a 90 ms sink onto
 *           its lip and the `confirm` cue (data-cue, read by the click sound hook)
 * routine = Anladım, Kapat, Sonra: surface key, small by default
 * danger  = İşten çıkar, Sat: surface key with a faint negative edge + lip, red text
 * ghost   = text only, hover tint (not a key)
 * onInk   = routine for dark (ink) surfaces: toasts, banners (no lip)
 * primary / secondary / soft / mint = DEPRECATED aliases (commit look / routine look at md size) kept so old
 * callers compile; migrate with the panel content waves.
 *
 * Keys are .ui-key* classes (src/index.css): the tone only sets the fill / edge / lip variables. Disabled keys lose
 * their lip (flat = not pressable); commit drops to a neutral key with ink-2 text (readable, clearly inactive)
 * instead of fading its light label into a grey fill; the other tones fade with opacity.
 */
type Tone = 'commit' | 'routine' | 'danger' | 'ghost' | 'onInk' | 'primary' | 'secondary' | 'soft' | 'mint'

const COMMIT = 'ui-key ui-key-commit'
const ROUTINE = 'ui-key ui-key-routine'

const TONE: Record<Tone, string> = {
  commit: COMMIT,
  routine: ROUTINE,
  danger: 'ui-key ui-key-danger',
  ghost: 'border-2 border-transparent bg-transparent text-ink-2 transition-colors enabled:hover:bg-surface-2 enabled:hover:text-ink enabled:active:translate-y-px disabled:opacity-50',
  onInk: 'border-2 border-on-ink/30 bg-transparent text-on-ink transition-colors enabled:hover:bg-on-ink/10 enabled:active:translate-y-px disabled:opacity-50',
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
        'inline-flex select-none items-center justify-center gap-1.5 rounded-control font-ui font-extrabold disabled:cursor-not-allowed',
        sz === 'md' ? 'min-h-11 px-4 text-[15px]' : 'ui-key-sm min-h-9 px-3 text-[13px] max-md:min-h-11',
        TONE[tone],
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size={sz === 'md' ? 18 : 16} />}
      {children}
      {cost && (
        <span className={cx('tabular rounded-lg px-1.5 py-px text-[12px] font-extrabold', filled ? 'bg-brand-deep' : 'bg-surface-2 text-ink-2')}>{cost}</span>
      )}
    </button>
  )
}

/**
 * Square icon button. Quiet by default (panel close / back / collapse: no frame, hover tint). `raised` makes it a
 * small key with a lip (the top-bar view controls); active (panel open) is then the brand commit key.
 */
export function IconButton({
  icon,
  label,
  active,
  raised = false,
  className,
  size = 44,
  ...rest
}: { icon: IconName; label: string; active?: boolean; raised?: boolean; size?: number } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-control disabled:opacity-40',
        raised
          ? cx('ui-key ui-key-sm', active ? 'ui-key-commit' : 'ui-key-routine text-ink-2 enabled:hover:text-ink')
          : cx('transition-colors enabled:active:translate-y-px', active ? 'bg-brand text-on-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'),
        className,
      )}
      style={{ width: size, height: size }}
      {...rest}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} />
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
 * Filter / segment chip. Active = brand tint + brand frame + brand-ink text; idle = 2px warm frame on surface.
 * `count` adds a tabular number after the label (icon + number is the HUD way: "👥 12"); `label` names an
 * icon-only chip for screen readers. Inside a <Segmented> track pass `segment`: no frame, the active one is a
 * surface tile with a small lip.
 * Identity colours (e.g. a department) go in as a <Dot> child, never as the selected state: a dept hue
 * on a thin frame is below 3:1 for sales/ops, and selected must read the same on every chip.
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
        'inline-flex shrink-0 items-center gap-1 text-[12px] font-bold transition-colors',
        segment
          ? cx('min-h-8 rounded-[9px] px-2.5 max-md:min-h-11', active ? 'bg-surface text-ink shadow-[0_2px_0_var(--color-lip)]' : 'text-ink-2 hover:text-ink')
          : cx(
              'min-h-9 rounded-full border-2 px-3 max-md:min-h-11',
              active ? 'border-brand bg-brand-soft text-brand-ink' : 'border-border bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink',
            ),
      )}
    >
      {icon && <Icon name={icon} size={14} />}
      {children}
      {count !== undefined && <span className="tabular font-extrabold">{count}</span>}
    </button>
  )
}

/** Segment control track: a row of `<Chip segment>` in a recessed surface-2 well (one of them active). */
export function Segmented({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cx('ui-inset inline-flex items-center gap-1 p-1', className)}>
      {children}
    </div>
  )
}

const TEXT_COLOR = /(^|\s)text-(ink|brand|positive|negative|on-ink)/

/**
 * Small tag: thin warm frame, neutral text. Pass a text colour via className; `dot` adds a coloured mark;
 * `tint` (CSS colour) swaps the frame for a light fill of that hue (department / live tags), text stays ink.
 */
export function Pill({ className, children, dot, tint }: { className?: string; children: ReactNode; dot?: string; tint?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-lg border-[1.5px] px-1.5 py-px text-[11px] font-bold',
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

/** Small sentence-case label (Kasa, Kullanıcı...). */
export function Label({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cx('ui-label', className)}>{children}</span>
}

/** Signed number: green when > 0, red when < 0. Pass the formatted text as children. */
export function Delta({ value, className, children }: { value: number; className?: string; children: ReactNode }) {
  return (
    <span className={cx('tabular font-bold', value > 0 ? 'text-positive-ink' : value < 0 ? 'text-negative-ink' : 'text-ink-2', className)}>{children}</span>
  )
}

/**
 * Icon badge. Neutral: ink-2 duotone icon, optional faint round well (`filled`). With `color`: a bare duotone sticker
 * in that hue (HUD gauges, bubble kinds, section headers): Icon `tone` = iconTone() outline over a 30% body of the hue,
 * the same formula everywhere, so a metric is the same sticker in every place. No tile.
 */
export function IconBadge({ icon, size = 32, filled = false, color, className }: { icon: IconName; size?: number; filled?: boolean; color?: string; className?: string }) {
  if (color) {
    return (
      <span aria-hidden="true" className={cx('grid shrink-0 place-items-center', className)} style={{ width: size, height: size }}>
        <Icon name={icon} size={Math.round(size * 0.75)} tone={color} />
      </span>
    )
  }
  return (
    <span className={cx('grid shrink-0 place-items-center rounded-full text-ink-2', filled && 'bg-surface-2', className)} style={{ width: size, height: size }}>
      <Icon name={icon} size={Math.round(size * 0.6)} />
    </span>
  )
}

export function Divider({ className }: { className?: string }) {
  return <div className={cx('h-0.5 w-full rounded-full bg-border', className)} />
}

/** Section head: a 4px colour stripe (the section's hue; neutral by default) + the sentence-case label, `right` at the end. */
export function SectionTitle({ children, right, color = 'var(--color-border-strong)' }: { children: ReactNode; right?: ReactNode; color?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="ui-label flex min-w-0 items-center gap-1.5 text-[13px] text-ink">
        <span aria-hidden="true" className="h-3.5 w-1 shrink-0 rounded-full" style={{ background: color }} />
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
 * Metric in the HUD grammar (docs/GAMEPLAY_V2.md §10.1 D1): the number is the biggest thing (24px ui-num), the
 * sentence-case label sits under it. `icon` + `color` add the metric's duotone sticker next to the label (same hue as
 * its HUD chip). `delta` prints a signed change next to the value (green / red text only); `tween` eases a numeric `value`
 * through `format`. Grids of Stats read as rows separated by 2px rules (no card-in-card). Nothing ellipsises.
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
    <div className="min-w-0 border-t-2 border-border pt-2">
      <div className="flex min-w-0 items-baseline gap-1.5">
        <div className="ui-num break-words text-[24px] leading-none text-ink">
          {typeof value === 'number' ? tween ? <TweenValue value={value} format={format} /> : format(value) : value}
        </div>
        {delta && (
          <Delta value={delta.value} className="text-[12px]">
            {delta.text}
          </Delta>
        )}
      </div>
      <div className="mt-1 flex min-w-0 items-center gap-1.5">
        {/* Same duotone sticker as the HUD chip for this metric (WIDGET_COLOR), so a metric keeps its colour everywhere. */}
        {icon && color && <Icon name={icon} size={14} tone={color} className="shrink-0" />}
        <div className="ui-label line-clamp-2 min-w-0">{label}</div>
        {info && (
          <InfoTip title={label} size={12}>
            {info}
          </InfoTip>
        )}
      </div>
      {sub && <div className="break-words text-[11px] font-semibold text-ink-2">{sub}</div>}
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
        'tabular inline-flex items-center gap-1 rounded-lg border-[1.5px] px-1.5 py-px text-[11px] font-bold',
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
