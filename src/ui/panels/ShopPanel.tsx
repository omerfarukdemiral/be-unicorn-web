// Mağaza: furniture catalog + ring expansion. "Satın al" places at once: on the tapped slot (slotTarget)
// or the free slot nearest the center (engine findAutoSlot). No separate placing step. HUD grammar (GAMEPLAY V2 §10.5):
// the price is the big number, "Satın al" is a commit with its CostPreview, the description lives in the tooltip.
import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
// Pure placement rules shared with the engine (same precedent as FounderActions → founderActionError).
import { canPlaceAt } from '../../engine/office'
import { shopPlacement, type ShopPlacement } from './shopPlacement'
import { SLOT_TYPES, type OfficeState, type RingState, type Slot, type SlotId, type SlotType } from '../../engine/types'
import { DEPT_TEXT, FURNITURE, type FurnitureEffects, type FurnitureItem } from '../../content'
import { useGameStore } from '../../store/gameStore'
import { Icon } from '../icons'
import { t } from '../i18n'
import { fixed, money, pct } from '../format'
import { Button, Chip, CostPreview, cx, Dot, Empty, IconBadge, Pill, SectionTitle } from '../primitives'
import { useSpendPreview } from '../widgets'
import { SLOT_ICON, slotTypeStage, soft, stageName } from '../theme'

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
/** "Bought" toast pinned on the bought row: an overlay, so the list never shifts under the cursor. */
type Bought = { itemId: string; text: string; key: number }
/** What sits above the catalog: the "for slot" strip and the ring CTA. Either one appearing or leaving moves every row. */
type AboveList = { strip?: { ring: number; type: SlotType }; ring?: RingState }
const aboveKey = (a: AboveList) => `${a.strip ? `${a.strip.ring}:${a.strip.type}` : '-'}|${a.ring ? `${a.ring.index}:${a.ring.openCost}` : '-'}`

export function ShopPanel({ slotTarget }: { slotTarget?: SlotId }) {
  const { stage, cash, office } = useGameStore(useShallow((s) => ({ stage: s.state.stage, cash: s.state.stats.cash, office: s.state.office })))
  const dispatch = useGameStore((s) => s.dispatch)
  const openPanel = useGameStore((s) => s.openPanel)
  const target = slotTarget ? office.slots.find((x) => x.id === slotTarget) : undefined
  const [filter, setFilter] = useState<SlotType | 'all'>(target?.type ?? 'all')
  const [bought, setBought] = useState<Bought | null>(null)

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
    .map((item) => ({ item, place: placementFor(office, item, target) }))
  // Full office: ONE "open the next ring" call to action above the list instead of a brand button per item.
  const ringOffer = items.find(
    ({ item, place }) => !place.slot && place.roomRing !== null && place.nextRing && item.stageUnlock <= stage && slotTypeStage(item.slotType) <= stage,
  )?.place.nextRing

  // Layout hold: while the pointer is on the catalog or the bought toast shows, the strip/CTA boxes keep their last
  // layout (a gone one turns invisible, a new one waits), so the next "Satın al" stays under the cursor.
  const [hovering, setHovering] = useState(false)
  const live: AboveList = { strip: target && !targetGone ? { ring: target.ring, type: target.type } : undefined, ring: ringOffer }
  const liveKey = aboveKey(live)
  const [shown, setShown] = useState({ key: liveKey, v: live })
  const held = hovering || bought !== null
  if (!held && shown.key !== liveKey) setShown({ key: liveKey, v: live })
  const above = held ? shown.v : live
  const strip = above.strip && (live.strip ?? above.strip)
  const ringCta = above.ring && (live.ring ?? above.ring)

  const buy = (item: FurnitureItem, place: ShopPlacement) => {
    // Untargeted buys use the engine's own auto placement (placeItem without slotId).
    const r = dispatch(place.targeted && place.slot ? { type: 'placeItem', itemId: item.id, slotId: place.slot.id } : { type: 'placeItem', itemId: item.id })
    if (!r.ok) return
    const ev = [...r.state.events].reverse().find((e) => e.kind === 'itemPlaced')
    const ring = r.state.office.slots.find((x) => x.id === ev?.refId)?.ring ?? place.slot?.ring ?? 1
    setBought({ itemId: item.id, text: t('shop.bought', { item: item.name, ring }), key: performance.now() })
  }

  return (
    <div className="flex flex-col gap-4">
      {strip && (
        <div
          aria-hidden={!live.strip || undefined}
          className={cx('flex items-center gap-2 rounded-control border border-border bg-surface-2 py-1.5 pl-3 pr-1.5 text-xs font-semibold text-ink', !live.strip && 'invisible')}
        >
          <Icon name={SLOT_ICON[strip.type]} size={15} className="shrink-0 text-ink-2" />
          <span className="min-w-0 flex-1 truncate">{t('shop.forSlot', { ring: strip.ring, type: t(`slot.${strip.type}`) })}</span>
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
      <div onPointerEnter={() => setHovering(true)} onPointerLeave={() => setHovering(false)}>
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
        {filter !== 'all' && slotTypeStage(filter) > stage && (
          <p className="font-text mb-2 flex items-center gap-1.5 text-xs text-ink-2">
            <Icon name="lock" size={14} />
            {t('shop.slotLocked', { stage: stageName(slotTypeStage(filter)) })}
          </p>
        )}
        {items.length === 0 ? (
          <Empty text={t('shop.empty')} icon="bag" />
        ) : (
          <>
            {ringCta && (
              <RingCta
                index={ringCta.index}
                openCost={ringCta.openCost}
                rent={ringCta.rentPerMonth}
                cash={cash}
                hidden={!live.ring}
                onOpen={() => dispatch({ type: 'openRing', ring: ringCta.index })}
              />
            )}
            <ul className="flex flex-col gap-1">
              {items.map(({ item, place }) => (
                <ShopItem key={item.id} item={item} stage={stage} cash={cash} place={place} bought={bought?.itemId === item.id ? bought : undefined} onBuy={buy} />
              ))}
            </ul>
          </>
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
  bought,
  onBuy,
}: {
  item: FurnitureItem
  stage: number
  cash: number
  place: ShopPlacement
  bought?: Bought
  onBuy: (item: FurnitureItem, place: ShopPlacement) => void
}) {
  const locked = item.stageUnlock > stage || slotTypeStage(item.slotType) > stage
  const afford = cash >= item.price
  const noRoom = !locked && !place.slot
  // No room: offer the next ring when this office has room for the item in a locked ring (rings open in order).
  const next = noRoom && place.roomRing !== null ? place.nextRing : undefined
  const preview = useSpendPreview(-item.price, item.upkeep ?? 0)
  return (
    <li title={item.description} className={cx('relative flex flex-col gap-1.5 rounded-control bg-surface-2/60 px-2 py-2', locked && 'opacity-55')}>
      {bought && (
        // Top-right, clear of the bottom-right Buy button; click-through so a repeat buy still lands.
        <div
          role="status"
          key={bought.key}
          className="pointer-events-none absolute right-1.5 top-1.5 z-10 flex max-w-[75%] animate-pop-in items-center gap-1.5 rounded-control border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-ink shadow-sm"
        >
          <Icon name="check" size={12} className="shrink-0 text-positive-ink" />
          <span className="truncate">{bought.text}</span>
        </div>
      )}
      <div className="flex items-start gap-3">
        <Swatch item={item} locked={locked} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold">{item.name}</span>
            {item.size === 2 && <Pill className="tabular">2×</Pill>}
            {item.tier > 1 && <Pill className="tabular text-ink">T{item.tier}</Pill>}
          </div>
          {!locked && place.targetMisfit && (
            <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-ink">
              <Icon name="warning" size={12} className="shrink-0 text-energy-ink" />
              {place.slot ? t('shop.targetMisfit', { ring: place.slot.ring }) : t('shop.targetMisfitNoRoom')}
            </div>
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
            {stageName(item.stageUnlock > slotTypeStage(item.slotType) ? item.stageUnlock : slotTypeStage(item.slotType))}
          </span>
        ) : (
          <span className="min-w-0">
            <span className={cx('tabular text-[22px] font-semibold leading-none', afford ? 'text-ink' : 'text-ink-3')}>{money(item.price)}</span>
            {item.upkeep ? <span className="tabular ml-1.5 text-[10px] text-ink-2">{t('shop.upkeep', { v: money(item.upkeep) })}</span> : null}
          </span>
        )}
        {!locked &&
          (noRoom ? (
            next ? (
              // Blocked, not an action: neutral note; the single ring CTA sits above the list.
              <span className="flex min-w-0 flex-col items-end gap-0.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-2">
                  <Icon name="building" size={12} />
                  {t('shop.noRoom')}
                </span>
                {place.roomRing !== null && place.roomRing !== next.index && (
                  <span className="text-right text-[10px] leading-tight text-ink-2">{t('shop.roomInRing', { ring: place.roomRing })}</span>
                )}
              </span>
            ) : (
              <span className="text-right text-[11px] font-semibold text-ink-2">{t('shop.noRoomNextStage')}</span>
            )
          ) : (
            <span className="flex shrink-0 items-center gap-1.5">
              <CostPreview preview={preview} />
              <Button size="sm" tone="commit" icon="bag" disabled={!afford} onClick={() => onBuy(item, place)}>
                {t('shop.buyGo')}
              </Button>
            </span>
          ))}
      </div>
    </li>
  )
}

/** Full office: the one "open the next ring" call above the list, a commit with its runway preview like every other. */
function RingCta({
  index,
  openCost,
  rent,
  cash,
  hidden,
  onOpen,
}: {
  index: number
  openCost: number
  rent: number
  cash: number
  /** Gone but held for layout: keeps its box, invisible and inert. */
  hidden?: boolean
  onOpen: () => void
}) {
  const preview = useSpendPreview(-openCost, rent)
  return (
    <div aria-hidden={hidden || undefined} className={cx('mb-2 flex flex-wrap items-center gap-2 rounded-control border border-brand/30 bg-brand-soft p-2 pl-3', hidden && 'invisible')}>
      <Icon name="building" size={16} className="shrink-0 text-brand-ink" />
      <span className="min-w-0 flex-1 text-xs font-semibold text-ink">{t('shop.noRoomOpenRing', { n: index, cost: money(openCost) })}</span>
      <span className="flex shrink-0 items-center gap-1.5">
        <CostPreview preview={preview} />
        <Button size="sm" tone="commit" icon="plus" disabled={cash < openCost} onClick={onOpen}>
          {t('shop.openRing')}
        </Button>
      </span>
    </div>
  )
}

function Swatch({ item, locked }: { item: FurnitureItem; locked: boolean }) {
  const c = item.visual.colors
  return (
    // Light tint of the item's own colour + its slot icon; the solid colour as a small corner mark.
    <span
      className={cx('relative grid size-11 shrink-0 place-items-center rounded-control', locked ? 'border border-border bg-surface-2 text-ink-2' : 'text-ink')}
      style={locked ? undefined : { background: soft(c.primary, 30) }}
    >
      <Icon name={locked ? 'lock' : SLOT_ICON[item.slotType]} size={18} />
      <Dot color={c.primary} size={8} className="absolute right-1 top-1 ring-2 ring-surface" />
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
        <RingOffer index={next.index} openCost={next.openCost} rent={next.rentPerMonth} cash={cash} onOpen={() => dispatch({ type: 'openRing', ring: next.index })} />
      ) : (
        <span className="font-text text-xs text-ink-2">{t('shop.allRingsOpen')}</span>
      )}
    </div>
  )
}

/** The next ring: its cost as the number, the rent under it, the commit with its runway preview. */
function RingOffer({ index, openCost, rent, cash, onOpen }: { index: number; openCost: number; rent: number; cash: number; onOpen: () => void }) {
  const preview = useSpendPreview(-openCost, rent)
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-control bg-surface-2/60 p-2">
      <IconBadge icon="building" size={36} color="var(--color-brand)" />
      <div className="min-w-0 flex-1">
        <div className="ui-label">{t('shop.ringTitle', { n: index })}</div>
        <div className="tabular text-[22px] font-semibold leading-tight text-ink">{money(openCost)}</div>
        <div className="tabular text-[11px] text-ink-2">{t('shop.ringRent', { v: money(rent) })}</div>
      </div>
      <span className="flex shrink-0 items-center gap-1.5">
        <CostPreview preview={preview} />
        <Button tone="commit" icon="plus" size="sm" disabled={cash < openCost} onClick={onOpen}>
          {t('shop.openRing')}
        </Button>
      </span>
    </div>
  )
}
