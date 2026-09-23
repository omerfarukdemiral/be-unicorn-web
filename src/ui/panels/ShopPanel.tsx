// Mağaza: furniture catalog + ring expansion. "Satın al" places at once: on the tapped slot (slotTarget)
// or the free slot nearest the center (engine findAutoSlot). No separate placing step.
import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
// Pure placement rules shared with the engine (same precedent as FounderActions → founderActionError).
import { canPlaceAt } from '../../engine/office'
import { shopPlacement, type ShopPlacement } from './shopPlacement'
import { SLOT_TYPES, type OfficeState, type Slot, type SlotId, type SlotType } from '../../engine/types'
import { DEPT_TEXT, FURNITURE, type FurnitureEffects, type FurnitureItem } from '../../content'
import { useGameStore } from '../../store/gameStore'
import { Icon } from '../icons'
import { t } from '../i18n'
import { fixed, money, pct } from '../format'
import { Button, Chip, cx, Dot, Empty, IconBadge, Pill, SectionTitle } from '../primitives'
import { SLOT_ICON, slotTypeStage, stageName } from '../theme'

export function effectTags(e: FurnitureEffects): string[] {
  const out: string[] = []
  if (e.moraleAura) out.push(t('effect.moraleAura', { v: e.moraleAura }))
  if (e.deskQuality && e.deskQuality !== 1) out.push(t('effect.deskQuality', { v: fixed(e.deskQuality, 2) }))
  if (e.deptBonus) {
    for (const [d, v] of Object.entries(e.deptBonus)) {
      if (v) out.push(t('effect.deptBonus', { dept: DEPT_TEXT[d as keyof typeof DEPT_TEXT]?.short ?? d, v: pct(v) }))
    }
  }
  if (e.capacityMult) out.push(t('effect.capacity', { v: fixed(e.capacityMult, 2) }))
  if (e.infraMult) out.push(t('effect.infra', { v: fixed(e.infraMult, 2) }))
  if (e.coordinationFix) out.push(t('effect.coordinationFix'))
  if (e.globalMorale) out.push(t('effect.globalMorale', { v: e.globalMorale }))
  if (e.reputation) out.push(t('effect.reputation', { v: e.reputation }))
  if (e.maturityBonus) out.push(t('effect.maturity', { v: pct(e.maturityBonus) }))
  if (e.enablesTool) out.push(t('effect.enables', { tool: t(`tool.${e.enablesTool}`) }))
  return out
}

/** Where "Satın al" puts `item` (targeted slot when it fits, else the auto slot) and what to offer when full. */
function placementFor(office: OfficeState, item: FurnitureItem, target: Slot | undefined): ShopPlacement {
  return shopPlacement(office, { slotType: item.slotType, size: item.size === 2 ? 2 : 1 }, target)
}

const BOUGHT_MS = 2400

export function ShopPanel({ slotTarget }: { slotTarget?: SlotId }) {
  const { stage, cash, office } = useGameStore(useShallow((s) => ({ stage: s.state.stage, cash: s.state.stats.cash, office: s.state.office })))
  const dispatch = useGameStore((s) => s.dispatch)
  const openPanel = useGameStore((s) => s.openPanel)
  const target = slotTarget ? office.slots.find((x) => x.id === slotTarget) : undefined
  const [filter, setFilter] = useState<SlotType | 'all'>(target?.type ?? 'all')
  const [bought, setBought] = useState<{ text: string; key: number } | null>(null)

  // A new target (another empty slot tapped) filters to its type.
  const targetType = target?.type
  useEffect(() => {
    if (slotTarget && targetType) setFilter(targetType)
  }, [slotTarget, targetType])
  // The target got filled (bought here, or elsewhere): drop it, later buys go to the auto slot.
  const targetGone = !!slotTarget && (!target || target.itemId !== undefined || target.spanOf !== undefined)
  useEffect(() => {
    if (targetGone) openPanel({ kind: 'shop' }, { replace: true })
  }, [targetGone, openPanel])
  useEffect(() => {
    if (!bought) return
    const id = window.setTimeout(() => setBought((b) => (b?.key === bought.key ? null : b)), BOUGHT_MS)
    return () => window.clearTimeout(id)
  }, [bought])

  const freeByType = (type: SlotType) =>
    office.slots.filter((sl) => sl.type === type && canPlaceAt(office, sl, { slotType: type, size: 1 })).length

  const items = FURNITURE.filter((f) => filter === 'all' || f.slotType === filter)
    .slice()
    .sort((a, b) => a.stageUnlock - b.stageUnlock || a.price - b.price)

  const buy = (item: FurnitureItem, place: ShopPlacement) => {
    // Untargeted buys use the engine's own auto placement (placeItem without slotId).
    const r = dispatch(place.targeted && place.slot ? { type: 'placeItem', itemId: item.id, slotId: place.slot.id } : { type: 'placeItem', itemId: item.id })
    if (!r.ok) return
    const ev = [...r.state.events].reverse().find((e) => e.kind === 'itemPlaced')
    const ring = r.state.office.slots.find((x) => x.id === ev?.refId)?.ring ?? place.slot?.ring ?? 1
    setBought({ text: t('shop.bought', { item: item.name, ring }), key: performance.now() })
  }

  return (
    <div className="flex flex-col gap-4">
      {target && !targetGone && (
        <div className="flex items-center gap-2 rounded-control border border-border bg-surface-2 py-1.5 pl-3 pr-1.5 text-xs font-semibold text-ink">
          <Icon name={SLOT_ICON[target.type]} size={15} className="shrink-0 text-ink-2" />
          <span className="min-w-0 flex-1 truncate">{t('shop.forSlot', { ring: target.ring, type: t(`slot.${target.type}`) })}</span>
          <Button
            size="sm"
            tone="ghost"
            icon="close"
            onClick={() => {
              setFilter('all')
              openPanel({ kind: 'shop' }, { replace: true })
            }}
          >
            {t('shop.clearTarget')}
          </Button>
        </div>
      )}
      <div>
        <SectionTitle>{t('shop.catalog')}</SectionTitle>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2">
          <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
            {t('shop.all')}
          </Chip>
          {SLOT_TYPES.map((type) => {
            const lockStage = slotTypeStage(type)
            const locked = lockStage > stage
            return (
              <Chip key={type} active={filter === type} onClick={() => setFilter(type)} icon={locked ? 'lock' : SLOT_ICON[type]}>
                {t(`slot.${type}`)}
                {!locked && <span className="tabular opacity-60">· {freeByType(type)}</span>}
              </Chip>
            )
          })}
        </div>
        {!target && <p className="font-text mb-2 text-[11px] leading-snug text-ink-2">{t('shop.autoHint')}</p>}
        {filter !== 'all' && slotTypeStage(filter) > stage && (
          <p className="font-text mb-2 flex items-center gap-1.5 text-xs text-ink-2">
            <Icon name="lock" size={14} />
            {t('shop.slotLocked', { stage: stageName(slotTypeStage(filter)) })}
          </p>
        )}
        {bought && (
          <p role="status" key={bought.key} className="mb-2 flex animate-pop-in items-center gap-1.5 rounded-control border border-border px-3 py-2 text-xs font-semibold text-ink">
            <Icon name="check" size={14} className="shrink-0 text-positive-ink" />
            {bought.text}
          </p>
        )}
        {items.length === 0 ? (
          <Empty text={t('shop.empty')} icon="bag" />
        ) : (
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {items.map((item) => (
              <ShopItem key={item.id} item={item} stage={stage} cash={cash} place={placementFor(office, item, target)} onBuy={buy} />
            ))}
          </ul>
        )}
      </div>
      <RingSection />
    </div>
  )
}

function ShopItem({
  item,
  stage,
  cash,
  place,
  onBuy,
}: {
  item: FurnitureItem
  stage: number
  cash: number
  place: ShopPlacement
  onBuy: (item: FurnitureItem, place: ShopPlacement) => void
}) {
  const dispatch = useGameStore((s) => s.dispatch)
  const locked = item.stageUnlock > stage || slotTypeStage(item.slotType) > stage
  const afford = cash >= item.price
  const noRoom = !locked && !place.slot
  // No room: offer the next ring when this office has room for the item in a locked ring (rings open in order).
  const next = noRoom && place.roomRing !== null ? place.nextRing : undefined
  return (
    <li className={cx('flex flex-col gap-2 px-1 py-3', locked && 'opacity-55')}>
      <div className="flex items-start gap-3">
        <Swatch item={item} locked={locked} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold">{item.name}</span>
            {item.size === 2 && <Pill className="tabular">2×</Pill>}
            {item.tier > 1 && <Pill className="tabular text-ink">T{item.tier}</Pill>}
          </div>
          <p className="font-text mt-0.5 line-clamp-2 text-[11px] leading-snug text-ink-2">{item.description}</p>
          {!locked && place.targetMisfit && (
            <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-ink">
              <Icon name="warning" size={12} className="shrink-0 text-negative" />
              {place.slot ? t('shop.targetMisfit', { ring: place.slot.ring }) : t('shop.targetMisfitNoRoom')}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {effectTags(item.effects).map((tag) => (
              <Pill key={tag} className="text-ink">
                {tag}
              </Pill>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        {locked ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-2">
            <Icon name="lock" size={12} />
            {stageName(Math.max(item.stageUnlock, slotTypeStage(item.slotType)))}
          </span>
        ) : (
          <span className="min-w-0">
            <span className={cx('tabular text-sm font-semibold', afford ? 'text-ink' : 'text-negative-ink')}>{money(item.price)}</span>
            {item.upkeep ? <span className="tabular ml-1.5 text-[10px] text-ink-2">{t('shop.upkeep', { v: money(item.upkeep) })}</span> : null}
          </span>
        )}
        {!locked &&
          (noRoom ? (
            next ? (
              <span className="flex min-w-0 flex-col items-end gap-1">
                <Button size="sm" tone="primary" icon="plus" disabled={cash < next.openCost} onClick={() => dispatch({ type: 'openRing', ring: next.index })}>
                  {t('shop.noRoomOpenRing', { n: next.index, cost: money(next.openCost) })}
                </Button>
                {place.roomRing !== null && place.roomRing !== next.index && (
                  <span className="text-right text-[10px] leading-tight text-ink-2">{t('shop.roomInRing', { ring: place.roomRing })}</span>
                )}
              </span>
            ) : (
              <span className="text-right text-[11px] font-semibold text-ink-2">{t('shop.noRoomNextStage')}</span>
            )
          ) : (
            <Button size="sm" tone="primary" icon="bag" disabled={!afford} onClick={() => onBuy(item, place)}>
              {t('common.buy')}
            </Button>
          ))}
      </div>
    </li>
  )
}

function Swatch({ item, locked }: { item: FurnitureItem; locked: boolean }) {
  const c = item.visual.colors
  return (
    // Neutral tile + the item's own colour as a small mark (no pastel fills in the UI).
    <span className="relative grid size-11 shrink-0 place-items-center rounded-control border border-border bg-surface-2 text-ink-2">
      <Icon name={locked ? 'lock' : SLOT_ICON[item.slotType]} size={18} />
      <Dot color={c.primary} size={7} className="absolute right-1 top-1 ring-1 ring-ink/10" />
    </span>
  )
}

function RingSection() {
  const rings = useGameStore(useShallow((s) => s.state.office.rings))
  const cash = useGameStore((s) => s.state.stats.cash)
  const dispatch = useGameStore((s) => s.dispatch)
  const next = rings.filter((r) => !r.unlocked).sort((a, b) => a.index - b.index)[0]
  const open = rings.filter((r) => r.unlocked).length
  return (
    <div>
      <SectionTitle right={<span className="tabular text-[11px] font-semibold text-ink-2">{t('shop.ringsOpen', { n: open, total: rings.length })}</span>}>
        {t('shop.expand')}
      </SectionTitle>
      {next ? (
        <div className="flex flex-wrap items-center gap-3 rounded-control border border-border p-3">
          <IconBadge icon="building" size={40} filled />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">{t('shop.ringTitle', { n: next.index })}</div>
            <div className="tabular text-[11px] text-ink-2">
              {`${t('shop.ringCost', { cost: money(next.openCost) })} · ${t('shop.ringRent', { v: money(next.rentPerMonth) })}`}
            </div>
          </div>
          <Button tone="primary" icon="plus" disabled={cash < next.openCost} onClick={() => dispatch({ type: 'openRing', ring: next.index })}>
            {t('shop.openRing')}
          </Button>
        </div>
      ) : (
        <p className="font-text text-xs text-ink-2">{t('shop.allRingsOpen')}</p>
      )}
    </div>
  )
}
