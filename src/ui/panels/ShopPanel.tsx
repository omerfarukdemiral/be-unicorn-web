// Mağaza: furniture catalog + ring expansion. "Satın al" places at once: on the tapped slot (slotTarget)
// or the free slot nearest the center (engine findAutoSlot). No separate placing step. HUD grammar (GAMEPLAY V2 §10.5):
// the price is the big number, "Satın al" is a commit with its CostPreview, the description lives in the tooltip.
// T12: the catalog is a 2-column grid of game tiles: the item's isometric thumbnail (public/items, T11) on a tint of
// its colour, name, its first effect, the price and the buy key. Locked = the same picture as a silhouette + lock and
// stage code, no text.
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
import { Button, Chip, CostPreview, cx, Empty, IconBadge, Pill, SectionTitle } from '../primitives'
import { useLayoutMode } from '../hooks'
import { useSpendPreview } from '../widgets'
import { SLOT_ICON, slotTypeStage, soft, stageCode, stageName } from '../theme'
import { useChipMark } from '../chipTarget'

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
  const layoutMode = useLayoutMode()
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
        {/* Landscape phone: the panel head already says Mağaza; the 28px goes to the cards. */}
        {layoutMode !== 'landscape' && <SectionTitle>{t('shop.catalog')}</SectionTitle>}
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
            <ul className="grid grid-cols-2 gap-1.5">
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
  const slotStage = slotTypeStage(item.slotType)
  const lockStage = item.stageUnlock > slotStage ? item.stageUnlock : slotStage
  const locked = lockStage > stage
  const afford = cash >= item.price
  const noRoom = !locked && !place.slot
  // No room: offer the next ring when this office has room for the item in a locked ring (rings open in order).
  const next = noRoom && place.roomRing !== null ? place.nextRing : undefined
  const preview = useSpendPreview(-item.price, item.upkeep ?? 0)
  const tags = effectTags(item.effects)
  const tip = [item.name, item.description, ...tags, locked ? stageName(lockStage) : ''].filter(Boolean).join('\n')
  const mark = useChipMark<HTMLLIElement>(`item:${item.id}`)
  return (
    <li ref={mark.ref} title={tip} className={cx('relative flex min-w-0 flex-col overflow-hidden rounded-control bg-surface-2/60', mark.markClass)}>
      {bought && (
        // Over the picture, clear of the Buy key; click-through so a repeat buy still lands.
        <div
          role="status"
          key={bought.key}
          className="pointer-events-none absolute inset-x-1.5 top-1.5 z-10 flex animate-pop-in items-center gap-1.5 rounded-control border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-ink shadow-sm"
        >
          <Icon name="check" size={12} className="shrink-0 text-positive-ink" />
          <span className="truncate">{bought.text}</span>
        </div>
      )}
      <ItemPicture item={item} locked={locked} lockStage={lockStage} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 px-2 pb-2 pt-1.5">
        <div className="flex min-w-0 items-center gap-1">
          <span className={cx('truncate text-[13px] font-semibold', locked ? 'text-ink-2' : 'text-ink')}>{item.name}</span>
          {!locked && place.targetMisfit && (
            <Icon
              name="warning"
              size={12}
              className="shrink-0 text-energy-ink"
              aria-label={place.slot ? t('shop.targetMisfit', { ring: place.slot.ring }) : t('shop.targetMisfitNoRoom')}
            />
          )}
        </div>
        {!locked && (
          <>
            {tags[0] && <span className="truncate text-[11px] font-semibold text-ink-2">{tags[0]}{tags.length > 1 ? ` +${tags.length - 1}` : ''}</span>}
            <div className="mt-auto flex items-end justify-between gap-1 pt-1">
              <span className="min-w-0">
                <span className={cx('tabular block text-[17px] font-semibold leading-5', afford ? 'text-ink' : 'text-ink-3')}>{money(item.price)}</span>
                {item.upkeep ? <span className="tabular block text-[10px] leading-3 text-ink-2">{t('shop.upkeep', { v: money(item.upkeep) })}</span> : null}
              </span>
              {noRoom ? (
                // Blocked, not an action: one quiet mark (the ring CTA above the list is the way out); the why is the tooltip.
                <span
                  title={next ? (place.roomRing !== null && place.roomRing !== next.index ? t('shop.roomInRing', { ring: place.roomRing }) : undefined) : t('shop.noRoomNextStage')}
                  className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-ink-3"
                >
                  <Icon name="building" size={12} />
                  {t('shop.noRoom')}
                </span>
              ) : (
                <Button size="sm" tone="commit" icon="bag" disabled={!afford} onClick={() => onBuy(item, place)} aria-label={`${t('shop.buyGo')}: ${item.name}`}>
                  {t('shop.buyGo')}
                </Button>
              )}
            </div>
            {!noRoom && <CostPreview preview={preview} className="self-start" />}
          </>
        )}
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
  const mark = useChipMark<HTMLDivElement>(`ring:${index}`)
  return (
    <div ref={mark.ref} aria-hidden={hidden || undefined} className={cx('mb-2 flex flex-wrap items-center gap-2 rounded-control border border-brand/30 bg-brand-soft p-2 pl-3', hidden && 'invisible', mark.markClass)}>
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

/**
 * The item's isometric thumbnail (public/items/<id>, T11) on a light tint of its own colour; size / tier as corner
 * pills. Locked: the same picture as a silhouette, a lock and the unlocking stage's code (no words).
 */
function ItemPicture({ item, locked, lockStage }: { item: FurnitureItem; locked: boolean; lockStage: number }) {
  const src = `/items/${item.id}`
  return (
    <span className="relative grid aspect-[4/3] place-items-center" style={{ background: locked ? 'var(--color-surface-2)' : soft(item.visual.colors.primary, 22) }}>
      <img
        src={`${src}@1x.png`}
        srcSet={`${src}@1x.png 1x, ${src}@2x.png 2x`}
        alt=""
        draggable={false}
        className="size-[84%] object-contain"
        style={locked ? { filter: 'brightness(0) opacity(.3)' } : undefined}
      />
      <span className="absolute left-1.5 top-1.5 flex gap-1">
        {item.size === 2 && <Pill className="tabular bg-surface">2×</Pill>}
        {item.tier > 1 && <Pill className="tabular bg-surface text-ink">T{item.tier}</Pill>}
      </span>
      {locked && (
        <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink-2" aria-label={stageName(lockStage)}>
          <Icon name="lock" size={11} />
          {stageCode(stageName(lockStage))}
        </span>
      )}
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
  const mark = useChipMark<HTMLDivElement>(`ring:${index}`)
  return (
    <div ref={mark.ref} className={cx('flex flex-wrap items-center gap-x-3 gap-y-2 rounded-control bg-surface-2/60 p-2', mark.markClass)}>
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
