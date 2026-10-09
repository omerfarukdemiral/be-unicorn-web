// Pazar haritası (docs/GAMEPLAY_V2.md §8.1–8.2), inside the CenterFrame: the fill ring ("68%"), one tile per segment
// (open and ramping in / ready with "Aç $250K" / grey silhouette with its stage pill), then the rivals: name, share,
// a valuation bar on the player's scale and, from Series B, the buy commit with its price. Every commit carries its
// CostPreview. Time keeps flowing (§14.1). The engine prices and gates everything (derived.market); centerData sorts.
import { useMemo } from 'react'
import { MARKET_SATURATION_PEN } from '../../engine/balance'
import { STAGES } from '../../content'
import { useGameStore } from '../../store/gameStore'
import { Icon } from '../icons'
import { t } from '../i18n'
import { compact, money, pct } from '../format'
import { Button, CostPreview, cx, Label, Pill, Ring } from '../primitives'
import { WIDGET_COLOR } from '../theme'
import { useSpendPreview } from '../widgets'
import { rivalRows, segmentTiles, type RivalRow, type SegmentTile } from './centerData'

export function MarketScreen() {
  // The views are rebuilt every step: compare them as one string of the numbers the screen prints.
  const key = useGameStore((s) => {
    const m = s.state.derived.market
    return JSON.stringify([m, s.state.rivals?.map((r) => [r.name, r.share.toFixed(3), Math.round(r.valuation), r.ahead]), Math.round(s.state.finance.valuation)])
  })
  const pen = useGameStore((s) => s.state.derived.penetration ?? 0)
  const tam = useGameStore((s) => s.state.derived.tam ?? 0)
  const { tiles, rivals, valuation } = useMemo(() => {
    const st = useGameStore.getState().state
    return { tiles: segmentTiles(st.derived.market), rivals: rivalRows(st.derived.market, st.rivals, st.finance.valuation), valuation: st.finance.valuation }
  }, [key])

  return (
    <div className="ui-scroll min-h-0 flex-1 px-3 pb-3 safe-bottom" data-market>
      <div className="flex items-center gap-3 pb-2 pt-1">
        <span className="relative grid size-14 shrink-0 place-items-center">
          <Ring value={pen} size={56} stroke={4} tone={WIDGET_COLOR.users} />
          <span className="tabular text-[15px] font-semibold text-ink" data-pen>{pct(pen)}</span>
        </span>
        <div className="min-w-0">
          <span className="tabular block text-[22px] font-semibold leading-none text-ink">{compact(tam)}</span>
          <Label>{t('mkt.fill')}</Label>
        </div>
        {pen >= MARKET_SATURATION_PEN && <p className="font-text ml-auto min-w-0 text-[13px] font-semibold leading-snug text-ink">{t('mkt.full')}</p>}
      </div>
      <ul className="grid grid-cols-1 gap-2 min-[560px]:grid-cols-2 min-[860px]:grid-cols-5">
        {tiles.map((s) => (
          <li key={s.id}>
            <SegmentCard seg={s} />
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center gap-1.5">
        <span aria-hidden="true" className="h-3 w-[3px] rounded-full bg-g-burn" />
        <Label>{t('mkt.rivals')}</Label>
      </div>
      {rivals.rows.length === 0 ? (
        <div className="mt-1.5 flex items-center gap-2 text-ink-3">
          <Icon name="flag" size={16} />
          <Label>{t('mkt.rivalsEmpty')}</Label>
        </div>
      ) : (
        <ul className="mt-1.5 flex flex-col gap-1">
          <li className="flex min-h-9 items-center gap-2 px-2">
            <span className="w-28 shrink-0 truncate text-[13px] font-semibold text-brand-ink">{t('mkt.you')}</span>
            <ValueBar value={rivals.you} color="var(--color-brand)" />
            <span className="tabular w-16 shrink-0 text-right text-[13px] font-semibold text-ink">{money(valuation)}</span>
          </li>
          {rivals.rows.map((r) => (
            <RivalLine key={r.id} r={r} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ValueBar({ value, color }: { value: number; color: string }) {
  return (
    <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
      <span className="block h-full rounded-full" style={{ width: `${Math.round(value * 100)}%`, background: color }} />
    </span>
  )
}

function SegmentCard({ seg }: { seg: SegmentTile }) {
  const dispatch = useGameStore((s) => s.dispatch)
  const preview = useSpendPreview(-seg.cost, seg.upkeep)
  const stageName = STAGES[seg.stage]?.name ?? ''
  const locked = seg.status === 'locked'
  return (
    <div
      data-segment={seg.id}
      data-status={seg.status}
      className={cx('flex h-full min-w-0 flex-col gap-1.5 rounded-control border p-2.5', locked ? 'border-hairline bg-surface-2/50' : 'border-border', seg.status === 'open' && 'bg-surface-2/60')}
    >
      <div className="flex items-center gap-1.5">
        <span className={cx('min-w-0 flex-1 truncate text-[13px] font-semibold text-ink', locked && 'opacity-55')}>{t(`mkt.segment.${seg.id}`)}</span>
        {seg.status === 'open' ? <Icon name="check" size={14} className="shrink-0 text-positive-ink" /> : <Pill className="tabular text-ink-2">{stageName}</Pill>}
        {locked && <Icon name="lock" size={13} className="shrink-0 text-ink-3" />}
      </div>
      <span className={cx('tabular text-[17px] font-semibold leading-none text-ink', locked && 'opacity-55')}>{t('mkt.size', { v: compact(seg.size) })}</span>
      {seg.status === 'open' && seg.ramp < 1 && (
        <span className="h-1 w-full overflow-hidden rounded-full bg-surface">
          <span className="block h-full rounded-full" style={{ width: `${Math.round(seg.ramp * 100)}%`, background: WIDGET_COLOR.users }} />
        </span>
      )}
      {seg.upkeep > 0 && seg.status !== 'locked' && <span className="tabular text-[11px] font-medium text-ink-2">{t('mkt.upkeep', { v: money(seg.upkeep) })}</span>}
      {seg.status === 'ready' && (
        <div className="mt-auto flex flex-col gap-1">
          <Button tone="commit" size="sm" disabled={seg.error !== null} onClick={() => dispatch({ type: 'openSegment', id: seg.id })} cost={seg.error ? t(`error.${seg.error}`) : money(seg.cost)}>
            {t('mkt.open')}
          </Button>
          <CostPreview preview={preview} className="justify-center" />
        </div>
      )}
      {locked && seg.cost > 0 && <span className="tabular mt-auto text-[11px] font-semibold text-ink-3">{money(seg.cost)}</span>}
      {locked && seg.auto && <span className="mt-auto text-[11px] font-semibold text-ink-3">{t('mkt.auto')}</span>}
    </div>
  )
}

function RivalLine({ r }: { r: RivalRow }) {
  const dispatch = useGameStore((s) => s.dispatch)
  const preview = useSpendPreview(-r.price, 0)
  // Before Series B ('mna' closed) the row is only a scoreboard: no buy button, no price.
  const canTry = r.error !== 'notUnlocked'
  return (
    <li data-rival={r.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-control bg-surface-2/60 px-2 py-1.5">
      <span className="flex w-28 shrink-0 items-center gap-1 truncate text-[13px] font-semibold text-ink" title={r.lead ? t('mkt.lead') : undefined}>
        {r.lead && <Icon name="flag" size={12} className="shrink-0 text-ink-2" />}
        <span className="truncate">{r.name}</span>
      </span>
      <ValueBar value={r.bar} color={r.ahead ? 'var(--color-energy)' : 'var(--color-ink-4)'} />
      <span className="tabular w-16 shrink-0 text-right text-[13px] font-semibold text-ink">{money(r.valuation)}</span>
      <Pill className="tabular text-ink">{t('rival.share', { p: pct(r.share) })}</Pill>
      {canTry && (
        <span className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          <Pill className="tabular text-ink-2">{t('mkt.brings', { v: compact(r.users) })}</Pill>
          <CostPreview preview={preview} />
          <Button tone="commit" size="sm" disabled={r.error !== null} onClick={() => dispatch({ type: 'acquireRival', id: r.id })} cost={r.error ? t(`error.${r.error}`) : money(r.price)}>
            {t('mkt.buy')}
          </Button>
        </span>
      )}
    </li>
  )
}
