// Mağaza: ring expansion + furniture catalog filtered by slot type, stage lock, price.
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { SLOT_TYPES, type SlotType } from '../../engine/types'
import { DEPT_TEXT, FURNITURE, type FurnitureEffects, type FurnitureItem } from '../../content'
import { useGameStore } from '../../store/gameStore'
import { Icon } from '../icons'
import { t } from '../i18n'
import { fixed, money, pct } from '../format'
import { Button, Chip, cx, Empty, Pill, SectionTitle } from '../primitives'
import { SLOT_ICON, slotTypeStage, stageName } from '../theme'
import { useIsMobile } from '../hooks'

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

export function ShopPanel() {
  const [filter, setFilter] = useState<SlotType | 'all'>('all')
  const { stage, cash, slots, rings } = useGameStore(
    useShallow((s) => ({ stage: s.state.stage, cash: s.state.stats.cash, slots: s.state.office.slots, rings: s.state.office.rings })),
  )
  const setPlacing = useGameStore((s) => s.setPlacing)
  const setDockTab = useGameStore((s) => s.setDockTab)
  const placing = useGameStore((s) => s.ui.placing)
  const mobile = useIsMobile()

  const openRings = new Set(rings.filter((r) => r.unlocked).map((r) => r.index))
  const freeByType = (type: SlotType) =>
    slots.filter((sl) => sl.type === type && !sl.itemId && (sl.ring === 0 || openRings.has(sl.ring))).length

  const items = FURNITURE.filter((f) => filter === 'all' || f.slotType === filter)
    .slice()
    .sort((a, b) => a.stageUnlock - b.stageUnlock || a.price - b.price)

  const pick = (item: FurnitureItem) => {
    setPlacing({ kind: 'place', itemId: item.id })
    if (mobile) setDockTab(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <RingSection />
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
                {!locked && <span className="opacity-60">· {freeByType(type)}</span>}
              </Chip>
            )
          })}
        </div>
        {filter !== 'all' && slotTypeStage(filter) > stage && (
          <p className="mb-2 flex items-center gap-1.5 text-xs text-ink-600">
            <Icon name="lock" size={14} />
            {t('shop.slotLocked', { stage: stageName(slotTypeStage(filter)) })}
          </p>
        )}
        {items.length === 0 ? (
          <Empty text={t('shop.empty')} icon="bag" />
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {items.map((item) => {
              const locked = item.stageUnlock > stage || slotTypeStage(item.slotType) > stage
              const afford = cash >= item.price
              const selected = placing?.kind === 'place' && placing.itemId === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={locked}
                  onClick={() => pick(item)}
                  className={cx(
                    'group flex min-h-16 items-start gap-3 rounded-2xl border p-2.5 text-left transition-colors',
                    selected ? 'border-lilac-500 bg-lilac-100' : 'border-cream-200 bg-cream-100/70 hover:border-cream-300 hover:bg-cream-50',
                    locked && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <Swatch item={item} locked={locked} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-bold">{item.name}</span>
                      {item.size === 2 && <Pill className="bg-cream-200 text-ink-600">2×</Pill>}
                      {item.tier > 1 && <Pill className="bg-lemon-100 text-lemon-600">T{item.tier}</Pill>}
                    </div>
                    <p className="line-clamp-2 text-[11px] leading-snug text-ink-600">{item.description}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {effectTags(item.effects).map((tag) => (
                        <Pill key={tag} className="bg-mint-100 text-mint-600">
                          {tag}
                        </Pill>
                      ))}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {locked ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-600">
                        <Icon name="lock" size={12} />
                        {stageName(Math.max(item.stageUnlock, slotTypeStage(item.slotType)))}
                      </span>
                    ) : (
                      <>
                        <div className={cx('tabular text-sm font-extrabold', afford ? 'text-ink-900' : 'text-rose-600')}>{money(item.price)}</div>
                        {item.upkeep ? <div className="tabular text-[10px] text-ink-600">{t('shop.upkeep', { v: money(item.upkeep) })}</div> : null}
                      </>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Swatch({ item, locked }: { item: FurnitureItem; locked: boolean }) {
  const c = item.visual.colors
  return (
    <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl" style={{ background: c.primary }}>
      {c.secondary && <span className="absolute inset-x-0 bottom-0 h-1/3" style={{ background: c.secondary }} />}
      {c.accent && <span className="absolute right-1 top-1 size-2.5 rounded-full" style={{ background: c.accent }} />}
      <Icon name={locked ? 'lock' : SLOT_ICON[item.slotType]} size={18} className="relative text-ink-900/70" />
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
      <SectionTitle right={<span className="text-[11px] font-semibold text-ink-600">{t('shop.ringsOpen', { n: open, total: rings.length })}</span>}>
        {t('shop.expand')}
      </SectionTitle>
      {next ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-lilac-100/70 p-3">
          <div className="grid size-11 place-items-center rounded-full bg-cream-50 text-lilac-500">
            <Icon name="building" size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold">{t('shop.ringTitle', { n: next.index })}</div>
            <div className="tabular text-[11px] text-ink-600">
              {`${t('shop.ringCost', { cost: money(next.openCost) })} · ${t('shop.ringRent', { v: money(next.rentPerMonth) })}`}
            </div>
          </div>
          <Button tone="primary" icon="plus" disabled={cash < next.openCost} onClick={() => dispatch({ type: 'openRing', ring: next.index })}>
            {t('shop.openRing')}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-ink-600">{t('shop.allRingsOpen')}</p>
      )}
    </div>
  )
}
