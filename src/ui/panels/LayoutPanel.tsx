// Ofisi düzenle (grid §4, §6), in the single right panel: one line on how, the selected piece (turn, team label for a
// desk; turn / Depoya kaldır for decor), the last refusal in the game's voice, the piece tabs (Ayırıcı, Dekor, Duvar,
// Depo: a card arms the piece, the scene puts it down), the footer (Parça n/cap, the spend paid on Bitti, undo / redo,
// Vazgeç / Bitti). The scene does the moving (render/LayoutEditor); this panel never opens a popup. The head number is
// "Masa 14/21" (panelHeadline). The Masalar tab also lists the team islands (grid §5: 3 same-team desks side by side,
// +TEAM_ADJ_BONUS speed), or the one-line hint when there is none.
import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { DEPT_TEXT, FURNITURE } from '../../content'
import { DECOR, PAINT_KIND, PAINT_PRICE, PAINT_SWATCHES, decorDef, type DecorDef, type DecorGroup } from '../../content/decor'
import * as B from '../../engine/balance'
import { decorBill, decorCap, isWallKind, paintable, previewSnapshot } from '../../engine/layout'
import { LAYOUT_PRESETS, SAVED_LAYOUT_MAX, LAYOUT_NAME_MAX, islandHeads, missingPieces, type LayoutPreset, type MissingPiece } from '../../engine/layoutPlans'
import { DEPTS, type Dept } from '../../engine/types'
import { useGameStore } from '../../store/gameStore'
import { draftIslands, draftPieces, draftSpend, wallAt } from '../../store/layoutEdit'
import { money } from '../format'
import { stageName } from '../theme'
import { Icon } from '../icons'
import { t } from '../i18n'
import { useCanEditLayout } from '../layoutEditGate'
import { Button, Chip, CostPreview, cx } from '../primitives'
import { useSpendPreview } from '../widgets'
import { DEPT_COLOR, soft } from '../theme'
import { Avatar } from './TeamPanel'

/** A refusal stays readable this long (ms) after the drop; the next change clears it anyway. */
const REFUSAL_MS = 4000

function SelectedPiece() {
  const sel = useGameStore(
    useShallow((s) => {
      const e = s.ui.layoutEdit
      const p = e?.selected ? draftPieces(s.state.office, e.draft).find((x) => x.id === e.selected) : undefined
      if (!p) return null
      const who = p.occupantId ? s.state.employees.find((x) => x.id === p.occupantId)?.name : undefined
      const island = p.type === 'desk' && draftIslands(s.state.office, e!.draft, deptOfIn(s.state.employees)).some((c) => c.active && c.slotIds.includes(p.id))
      return { id: p.id, itemId: p.itemId, type: p.type, team: p.team ?? null, who: who ?? null, island }
    }),
  )
  const op = useGameStore((s) => s.layoutEditOp)
  if (!sel) return <div className="font-text text-[13px] text-ink-2">{t('layout.pick')}</div>
  const item = FURNITURE.find((f) => f.id === sel.itemId)
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-3">
      <div className="flex items-center gap-2">
        <Icon name={sel.type === 'desk' ? 'desk' : 'sofa'} size={20} className="shrink-0 text-ink-2" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold text-ink">{item?.name ?? sel.itemId}</div>
          {sel.who && <div className="truncate text-[12px] text-ink-2">{t('layout.sits', { name: sel.who })}</div>}
        </div>
        <Button size="sm" tone="routine" icon="refresh" onClick={() => op({ kind: 'rotate' })} title="R">
          {t('layout.rotate')}
        </Button>
      </div>
      {sel.type === 'desk' && (
        <div className="flex flex-col gap-1.5">
          <span className="ui-label text-ink-2">{t('layout.team')}</span>
          <div className="flex gap-1.5">
            {DEPTS.map((d, i) => (
              <TeamButton key={d} dept={d} hotkey={i + 1} active={sel.team === d} onClick={() => op({ kind: 'team', team: d })} />
            ))}
          </div>
          {sel.island && <span className="font-text text-[12px] font-semibold text-positive-ink">{t('layout.deskIsland', { v: BONUS_PCT })}</span>}
        </div>
      )}
    </div>
  )
}

/** TEAM_ADJ_BONUS as the panel prints it ("4" in "+%4 hız"). */
const BONUS_PCT = Math.round(B.TEAM_ADJ_BONUS * 100)

const deptOfIn = (employees: readonly { id: string; dept: Dept }[]) => {
  const m = new Map(employees.map((e) => [e.id, e.dept]))
  return (id: string) => m.get(id)
}

/** Masalar tab: one row per team island of the draft (dept face, "3 kişi yan yana", +%4), else the rule as a dim row. */
function TeamIslands() {
  const rows = useGameStore(
    useShallow((s) => {
      const e = s.ui.layoutEdit
      if (!e) return [] as string[]
      // "dept:size" keys keep the shallow compare cheap; the panel needs nothing else.
      return draftIslands(s.state.office, e.draft, deptOfIn(s.state.employees))
        .filter((c) => c.active)
        .sort((a, b) => b.slotIds.length - a.slotIds.length)
        .map((c) => `${c.team}:${c.slotIds.length}`)
    }),
  )
  const chip = <span className="tabular shrink-0 rounded-md bg-positive/10 px-1.5 py-[3px] text-[12px] font-bold text-positive-ink">{t('team.islandChip', { v: BONUS_PCT })}</span>
  // No island yet: the rule as one dim row (3 same-team desks side by side → the chip), not a sentence.
  if (!rows.length)
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-border px-2 py-1.5" data-team-islands="">
        <Icon name="users" size={18} className="shrink-0 text-ink-3" />
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink-2">{t('layout.islandHint')}</span>
        {chip}
      </div>
    )
  return (
    <div className="flex flex-col gap-1.5" data-team-islands="">
      <span className="ui-label text-ink-2">{t('layout.islands')}</span>
      {rows.map((r, i) => {
        const [dept, n] = r.split(':') as [Dept, string]
        return (
          <div key={i} className="flex items-center gap-2 rounded-xl bg-surface-2/70 px-2 py-1.5">
            <Avatar name={DEPT_TEXT[dept].name} dept={dept} size={22} />
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
              {DEPT_TEXT[dept].short} · {t('layout.islandRow', { n })}
            </span>
            {chip}
          </div>
        )
      })}
    </div>
  )
}

/** The selected floor or wall piece: its name, Döndür (floor), Depoya kaldır (Del). */
function SelectedDecor() {
  const sel = useGameStore(
    useShallow((s) => {
      const e = s.ui.layoutEdit
      if (!e) return null
      if (e.decorSel) {
        const p = e.draft.decor.find((x) => x.id === e.decorSel)
        return p ? { kind: p.kind, floor: true } : null
      }
      const w = e.wallSel ? wallAt(e.draft, e.wallSel) : undefined
      return w ? { kind: w.kind, floor: false } : null
    }),
  )
  const op = useGameStore((s) => s.layoutEditOp)
  if (!sel) return null
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-surface-2 p-3">
      <Swatch kind={sel.kind} size={28} />
      <div className="min-w-0 flex-1 truncate text-[15px] font-bold text-ink">{decorDef(sel.kind)?.name ?? sel.kind}</div>
      {sel.floor && (
        <Button size="sm" tone="routine" icon="refresh" onClick={() => op({ kind: 'rotate' })} title="R">
          {t('layout.rotate')}
        </Button>
      )}
      <Button size="sm" tone="routine" icon="bag" onClick={() => op({ kind: 'remove' })} title="Del">
        {t('layout.toStorage')}
      </Button>
    </div>
  )
}

/** Card tint per piece: the colour the model reads as, so a card is recognisable without a render. */
const TINT: Record<string, string> = {
  panel: '#c3cbd6', plantRow: '#7fd07a', glass: '#bfe3f2', slats: '#b9875a', marblePlanter: '#ece8e2',
  plantPot: '#e7b48a', bin: '#7b8794', lamp: '#ffe2a8', whiteboard: '#f6f7f9', rug: '#c98f7a', sign: '#b79cff', arcade: '#5a3fd1', sculpture: '#e8c46a',
  poster: '#ffb48a', banner: '#7fdcb4', clock: '#fbf8f2', plaque: '#e8c46a', print: '#9cc9f5', neon: '#ff6fb1', canvas: '#86bdf7', goldRecords: '#f2c94c',
}

function Swatch({ kind, size = 36, color }: { kind: string; size?: number; color?: string }) {
  const def = decorDef(kind)
  const icon = def?.group === 'wall' ? 'camera' : def?.group === 'separator' ? 'grid' : 'sofa'
  return (
    <span className="grid shrink-0 place-items-center rounded-xl border border-black/10 text-ink/60" style={{ width: size, height: size, background: color ?? TINT[kind] ?? '#ecc996' }}>
      {!color && <Icon name={icon} size={Math.round(size * 0.5)} />}
    </span>
  )
}

type Tab = 'desks' | 'plans' | 'separator' | 'floor' | 'wall' | 'storage'
const TABS: Tab[] = ['desks', 'plans', 'separator', 'floor', 'wall', 'storage']

function PieceCard({ def, armed, stored, onArm }: { def: DecorDef; armed: boolean; stored: number; onArm: () => void }) {
  const stage = useGameStore((s) => s.state.stage)
  const cash = useGameStore((s) => s.state.stats.cash)
  const locked = def.stage > stage && stored === 0
  const afford = stored > 0 || cash >= def.price
  return (
    <button
      type="button"
      disabled={locked}
      onClick={onArm}
      aria-pressed={armed}
      title={locked ? t('layout.opensAt', { stage: stageName(def.stage) }) : def.name}
      className={cx(
        'flex min-w-0 items-center gap-2 rounded-xl border-2 p-1.5 text-left transition-colors',
        armed ? 'border-brand bg-surface' : 'border-transparent bg-surface-2/70 hover:bg-surface-2',
        locked && 'opacity-55',
      )}
    >
      <Swatch kind={def.kind} size={30} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[12px] font-bold leading-4 text-ink">{def.name}</span>
        <span className={cx('tabular truncate text-[11px] font-semibold leading-4', stored > 0 ? 'text-positive-ink' : locked ? 'text-ink-3' : afford ? 'text-ink-2' : 'text-negative-ink')}>
          {locked ? t('layout.opensAt', { stage: stageName(def.stage) }) : stored > 0 ? t('layout.inStorage', { n: stored }) : money(def.price)}
        </span>
      </span>
      {locked && <Icon name="lock" size={12} className="shrink-0 text-ink-3" />}
    </button>
  )
}

/** Storage as the draft leaves it: what is stored now plus what the draft took out, less what it put back. */
function useStock(): Record<string, number> {
  return useGameStore(
    useShallow((s) => {
      const out: Record<string, number> = {}
      const e = s.ui.layoutEdit
      const bill = e ? decorBill(s.state.office, e.draft) : null
      const rows = bill && !('error' in bill) ? bill.storage : (s.state.office.storage ?? [])
      for (const x of rows) out[x.kind] = x.n
      return out
    }),
  )
}

function Catalogue({ group }: { group: DecorGroup }) {
  const armed = useGameStore((s) => s.ui.layoutEdit?.armed ?? null)
  const op = useGameStore((s) => s.layoutEditOp)
  const stock = useStock()
  const stage = useGameStore((s) => s.state.stage)
  const items = DECOR.filter((d) => d.group === group)
  const walls = group !== 'wall' || paintable(stage, 'left') || paintable(stage, 'back')
  if (!walls) return <div className="font-text text-[13px] text-ink-2">{t('layout.noWalls')}</div>
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-1.5">
        {items.map((d) => (
          <PieceCard key={d.kind} def={d} armed={armed?.kind === d.kind} stored={stock[d.kind] ?? 0} onArm={() => op({ kind: 'arm', armed: armed?.kind === d.kind ? null : { kind: d.kind } })} />
        ))}
      </div>
      {group === 'wall' && <PaintRow />}
    </div>
  )
}

function PaintRow() {
  const armed = useGameStore((s) => s.ui.layoutEdit?.armed ?? null)
  const op = useGameStore((s) => s.layoutEditOp)
  const stored = useStock()[PAINT_KIND] ?? 0
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="ui-label text-ink-2">{t('layout.paint')}</span>
        <span className={cx('tabular text-[12px] font-semibold', stored > 0 ? 'text-positive-ink' : 'text-ink-2')}>
          {stored > 0 ? t('layout.inStorage', { n: stored }) : t('layout.paintPrice', { v: money(PAINT_PRICE) })}
        </span>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {PAINT_SWATCHES.map((c) => {
          const on = armed?.kind === PAINT_KIND && armed.color === c
          return (
            <button
              key={c}
              type="button"
              aria-pressed={on}
              aria-label={`${t('layout.paint')} ${c}`}
              onClick={() => op({ kind: 'arm', armed: on ? null : { kind: PAINT_KIND, color: c } })}
              className={cx('h-7 rounded-lg border-2 transition-transform', on ? 'scale-105 border-brand' : 'border-black/10 hover:scale-105')}
              style={{ background: c }}
            />
          )
        })}
      </div>
    </div>
  )
}

function StorageTray() {
  const armed = useGameStore((s) => s.ui.layoutEdit?.armed ?? null)
  const op = useGameStore((s) => s.layoutEditOp)
  const stock = useStock()
  const kinds = Object.keys(stock).filter((k) => k !== PAINT_KIND && stock[k]! > 0 && decorDef(k))
  if (!kinds.length) return <div className="font-text text-[13px] text-ink-2">{t('layout.storageEmpty')}</div>
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {kinds.map((k) => (
        <PieceCard key={k} def={decorDef(k)!} armed={armed?.kind === k} stored={stock[k]!} onArm={() => op({ kind: 'arm', armed: armed?.kind === k ? null : { kind: k } })} />
      ))}
    </div>
  )
}

/** The panel's one line on how: how to put the armed piece down, else how to move pieces. */
function HowLine() {
  const armed = useGameStore((s) => s.ui.layoutEdit?.armed ?? null)
  const key = !armed ? 'layout.hint' : armed.kind === PAINT_KIND ? 'layout.armedPaint' : isWallKind(armed.kind) ? 'layout.armedWall' : 'layout.armedFloor'
  return <p className={cx('font-text text-[13px]', armed ? 'font-semibold text-brand-ink' : 'text-ink-2')}>{t(key)}</p>
}

/** Mini plan of each preset (desk cells on a 9×7 floor, the founder in the middle): read at a glance, no render. */
const PRESET_CELLS: Record<LayoutPreset, [number, number][]> = {
  classic: [[4, 1], [2, 3], [6, 3], [4, 5], [1, 1], [7, 1], [1, 5], [7, 5], [4, 0], [0, 3], [8, 3], [4, 6]],
  islands: [[1, 1], [2, 1], [3, 1], [1, 2], [2, 2], [3, 2], [5, 1], [6, 1], [7, 1], [5, 2], [6, 2], [7, 2], [1, 4], [2, 4], [3, 4], [1, 5], [2, 5], [3, 5], [5, 4], [6, 4], [7, 4], [5, 5], [6, 5], [7, 5]],
  open: [0, 1, 2, 3, 5, 6, 7, 8].flatMap((x) => [[x, 0], [x, 1], [x, 2], [x, 4], [x, 5], [x, 6]] as [number, number][]),
  rows: [0, 1, 2, 3, 5, 6, 7, 8].flatMap((x) => [[x, 0], [x, 2], [x, 4], [x, 6]] as [number, number][]),
}

function PresetPlan({ preset }: { preset: LayoutPreset }) {
  return (
    <svg viewBox="0 0 9 7" className="h-9 w-12 shrink-0" aria-hidden="true">
      {PRESET_CELLS[preset].map(([x, z]) => (
        <rect key={`${x},${z}`} x={x + 0.12} y={z + 0.12} width={0.76} height={0.76} rx={0.18} className="fill-ink-3" />
      ))}
      <rect x={4.1} y={3.1} width={0.8} height={0.8} rx={0.2} className="fill-brand" />
    </svg>
  )
}

/** The arrangements a tap gives (each one a draft step: Geri al undoes it, Vazgeç drops it, nothing is bought). */
function Plans() {
  const apply = useGameStore((s) => s.applyLayoutPlan)
  const { heads, seated } = useGameStore(
    useShallow((s) => {
      const e = s.ui.layoutEdit
      const dept = new Map(s.state.employees.map((x) => [x.id, x.dept]))
      const built = e ? previewSnapshot(s.state.office, e.draft) : null
      const office = built && !('error' in built) ? built.office : s.state.office
      return { heads: islandHeads(office, (id) => dept.get(id)), seated: s.state.employees.filter((x) => x.deskSlotId && x.deskSlotId !== 'founder').length }
    }),
  )
  return (
    <div className="flex flex-col gap-3" data-layout-plans="">
      <Missing />
      <div className="grid grid-cols-2 gap-1.5">
        {LAYOUT_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            data-preset={p}
            title={t(`layout.presetTitle.${p}`)}
            onClick={() => apply({ kind: 'preset', preset: p })}
            className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border-2 border-transparent bg-surface-2/70 p-1.5 text-left transition-colors hover:bg-surface-2"
          >
            <PresetPlan preset={p} />
            <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink">{t(`layout.preset.${p}`)}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button tone="routine" icon="sparkle" onClick={() => apply({ kind: 'auto' })} title={t('layout.autoTitle')} data-layout-auto="">
          {t('layout.auto')}
        </Button>
        {seated > 0 && (
          <span className="ml-auto flex min-w-0 items-center gap-1.5 text-[12px] font-semibold text-ink-2" data-island-count="">
            <span className="tabular truncate">{t('layout.islandCount', { n: heads, m: seated })}</span>
            {heads > 0 && <span className="tabular shrink-0 rounded-md bg-positive/10 px-1.5 py-[3px] text-[12px] font-bold text-positive-ink">{t('team.islandChip', { v: BONUS_PCT })}</span>}
          </span>
        )}
      </div>
      <SavedLayouts />
    </div>
  )
}

function SavedLayouts() {
  const saved = useGameStore(useShallow((s) => (s.state.office.saved ?? []).map((x) => `${x.stage}|${x.name}`)))
  const apply = useGameStore((s) => s.applyLayoutPlan)
  const save = useGameStore((s) => s.saveLayout)
  const del = useGameStore((s) => s.deleteSavedLayout)
  const [name, setName] = useState('')
  const full = saved.length >= SAVED_LAYOUT_MAX
  const submit = () => {
    const res = save(name.trim() || t('layout.defaultName', { n: saved.length + 1 }))
    if (res?.ok) setName('')
  }
  return (
    <div className="flex flex-col gap-1.5" data-saved-layouts="">
      <span className="ui-label text-ink-2">{t('layout.saved')}</span>
      {saved.length === 0 && <span className="font-text text-[13px] text-ink-3">{t('layout.savedEmpty')}</span>}
      {saved.map((row, i) => {
        const [stage, label] = [Number(row.split('|')[0]), row.slice(row.indexOf('|') + 1)]
        return (
          <div key={i} className="flex items-center gap-1.5 rounded-xl bg-surface-2/70 py-1 pl-2 pr-1">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] font-bold text-ink">{label}</span>
              <span className="truncate text-[11px] font-semibold text-ink-3">{t('layout.savedStage', { stage: stageName(stage as never) })}</span>
            </span>
            <Button size="sm" tone="routine" onClick={() => apply({ kind: 'saved', index: i })}>
              {t('layout.apply')}
            </Button>
            <button type="button" onClick={() => del(i)} title={t('layout.deleteTitle')} aria-label={t('layout.deleteTitle')} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-surface-2 hover:text-negative-ink">
              <Icon name="close" size={16} />
            </button>
          </div>
        )
      })}
      {full ? (
        <span className="font-text text-[12px] font-semibold text-ink-2">{t('layout.savedFull')}</span>
      ) : (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(ev) => {
            ev.preventDefault()
            submit()
          }}
        >
          <input
            value={name}
            maxLength={LAYOUT_NAME_MAX}
            onChange={(ev) => setName(ev.target.value)}
            placeholder={t('layout.defaultName', { n: saved.length + 1 })}
            aria-label={t('layout.namePlaceholder')}
            className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 text-[13px] font-semibold text-ink outline-none placeholder:text-ink-3 focus:border-brand"
          />
          <Button tone="routine" icon="save" type="submit">
            {t('layout.save')}
          </Button>
        </form>
      )}
    </div>
  )
}

/** What the applied saved layout still lacks: decor rows arm the piece (bought on Bitti like any new piece), furniture is in the shop. */
function Missing() {
  const rows = useGameStore(
    useShallow((s) => {
      const e = s.ui.layoutEdit
      if (!e?.fromSaved) return [] as string[]
      return missingPieces(s.state.office, e.draft, e.fromSaved.layout).map((m) => `${m.item ? 1 : 0}|${m.n}|${m.kind}`)
    }),
  )
  const op = useGameStore((s) => s.layoutEditOp)
  if (!rows.length) return null
  const list: MissingPiece[] = rows.map((r) => {
    const [item, n, ...kind] = r.split('|')
    return { item: item === '1', n: Number(n), kind: kind.join('|') }
  })
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-dashed border-negative-ink/40 p-2" data-layout-missing="">
      <span className="ui-label text-negative-ink">{t('layout.missing')}</span>
      <span className="font-text text-[12px] text-ink-2">{t('layout.missingLine')}</span>
      {list.map((m) => {
        const item = m.item ? FURNITURE.find((f) => f.id === m.kind) : undefined
        const def = m.item ? undefined : decorDef(m.kind)
        const name = item?.name ?? (m.kind === PAINT_KIND ? t('layout.paint') : (def?.name ?? m.kind))
        const price = item ? t('layout.inShop') : money(m.kind === PAINT_KIND ? PAINT_PRICE : (def?.price ?? 0))
        const body = (
          <>
            {m.item ? <Icon name={item?.slotType === 'desk' ? 'desk' : 'sofa'} size={18} className="shrink-0 text-ink-3" /> : <Swatch kind={m.kind} size={24} />}
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
              {name} ×{m.n}
            </span>
            <span className="tabular shrink-0 text-[12px] font-semibold text-ink-2">{price}</span>
          </>
        )
        // A decor row arms the piece; paint has its swatches on the Duvar tab.
        return def ? (
          <button key={m.kind} type="button" onClick={() => op({ kind: 'arm', armed: { kind: m.kind } })} className="flex min-h-11 items-center gap-2 rounded-xl bg-surface-2/70 px-2 text-left hover:bg-surface-2">
            {body}
          </button>
        ) : (
          <div key={m.kind} className="flex min-h-11 items-center gap-2 rounded-xl px-2">
            {body}
          </div>
        )
      })}
    </div>
  )
}

/** Footer counts and the spend: "Parça 9/20", and what Bitti will cost (red when the cash or the next payday cannot cover it). */
export function SpendLine() {
  const { spend, cash, pieces, cap } = useGameStore(
    useShallow((s) => {
      const e = s.ui.layoutEdit
      const decor = e?.draft.decor.length ?? 0
      const walls = (e?.draft.walls ?? []).filter((w) => w.kind !== PAINT_KIND).length
      return { spend: e ? draftSpend(s.state.office, e.draft) : 0, cash: s.state.stats.cash, pieces: decor + walls, cap: decorCap(s.state.office.stage) }
    }),
  )
  const full = pieces >= cap
  // Against the next payday, not the raw cash (the owed month stays): the same red line the Shop shows; Bitti still works.
  const preview = useSpendPreview(-spend, 0)
  const short = spend > cash
  const red = short || preview.paydayShort
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[13px] font-semibold">
        <span className={cx('tabular', full ? 'text-negative-ink' : 'text-ink-2')} data-layout-pieces="">
          {t('layout.pieces')} {pieces}/{cap}
          {full && <span className="ml-1.5 rounded-full bg-negative-ink/10 px-2 py-0.5 text-[11px] font-bold text-negative-ink">{t('layout.full')}</span>}
        </span>
      </div>
      {spend > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <span data-layout-spend="" data-danger={red ? '' : undefined} className={cx('tabular font-text text-[13px] font-semibold', red ? 'text-negative-ink' : 'text-ink')}>
            {short ? t('layout.spendShort', { v: money(spend) }) : t('layout.spend', { v: money(spend) })}
          </span>
          <CostPreview preview={preview} />
        </div>
      )}
    </div>
  )
}

function TeamButton({ dept, hotkey, active, onClick }: { dept: Dept; hotkey: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={`${DEPT_TEXT[dept].name} (${hotkey})`}
      className={cx('flex flex-1 flex-col items-center gap-1 rounded-xl border-2 px-1 py-1.5 transition-colors', active ? 'text-ink' : 'border-transparent text-ink-2 hover:bg-surface')}
      style={active ? { borderColor: DEPT_COLOR[dept].dot, background: soft(DEPT_COLOR[dept].dot, 14) } : undefined}
    >
      <Avatar name={DEPT_TEXT[dept].name} dept={dept} size={30} />
      <span className="text-[11px] font-bold">{DEPT_TEXT[dept].short}</span>
    </button>
  )
}

function Refusal() {
  const r = useGameStore((s) => s.ui.layoutEdit?.refused ?? null)
  const armed = useGameStore((s) => s.ui.layoutEdit?.armedCancel ?? false)
  const op = useGameStore((s) => s.layoutEditOp)
  // The red line fades on its own; the red cells in the scene go with it (render reads the same timestamp).
  useEffect(() => {
    if (!r) return
    const id = window.setTimeout(() => useGameStore.setState((s) => (s.ui.layoutEdit?.refused === r ? { ui: { ...s.ui, layoutEdit: { ...s.ui.layoutEdit, refused: null } } } : s)), REFUSAL_MS)
    return () => window.clearTimeout(id)
  }, [r, op])
  if (armed) return <div className="font-text text-[13px] font-semibold text-negative-ink">{t('layout.armed')}</div>
  if (!r) return null
  return (
    <div role="status" className="flex items-center gap-1.5 font-text text-[13px] font-semibold text-negative-ink">
      <Icon name="warning" size={16} className="shrink-0" />
      {t(`layout.reason.${r.reason}`)}
    </div>
  )
}

export function LayoutPanel() {
  const allowed = useCanEditLayout()
  const initial = useGameStore((s) => s.ui.layoutEdit?.tab)
  const [tab, setTab] = useState<Tab>(TABS.includes(initial as Tab) ? (initial as Tab) : 'desks')
  const decorPicked = useGameStore((s) => !!(s.ui.layoutEdit?.decorSel || s.ui.layoutEdit?.wallSel))
  const itemPicked = useGameStore((s) => !!s.ui.layoutEdit?.selected)
  const { canUndo, canRedo } = useGameStore(useShallow((s) => ({ canUndo: (s.ui.layoutEdit?.undo.length ?? 0) > 0, canRedo: (s.ui.layoutEdit?.redo.length ?? 0) > 0 })))
  const op = useGameStore((s) => s.layoutEditOp)
  const cancel = useGameStore((s) => s.cancelLayoutEdit)
  const commit = useGameStore((s) => s.commitLayoutEdit)
  // The window shrank to the phone layout: the edit mode is PC only, the draft goes.
  useEffect(() => {
    if (!allowed) cancel()
  }, [allowed, cancel])
  return (
    <div className="flex min-h-full flex-col gap-3">
      <HowLine />
      {decorPicked ? <SelectedDecor /> : tab === 'desks' || itemPicked ? <SelectedPiece /> : null}
      <Refusal />
      {tab === 'desks' && !decorPicked && <TeamIslands />}
      <div role="tablist" className="flex gap-0.5 rounded-xl bg-surface-2 p-0.5">
        {TABS.map((k) => (
          <Chip key={k} segment active={tab === k} onClick={() => setTab(k)}>
            {t(`layout.tab.${k}`)}
          </Chip>
        ))}
      </div>
      {tab === 'plans' && <Plans />}
      {tab === 'separator' && <Catalogue group="separator" />}
      {tab === 'floor' && <Catalogue group="floor" />}
      {tab === 'wall' && <Catalogue group="wall" />}
      {tab === 'storage' && <StorageTray />}
      {/* Always in reach: the counts, the spend and Bitti stick to the panel's bottom edge while the catalogue scrolls. */}
      <div className="sticky -bottom-4 z-10 -mx-4 -mb-4 mt-auto flex flex-col gap-2 border-t border-border bg-surface px-4 pb-4 pt-2">
        <SpendLine />
        <div className="flex gap-1.5">
          <Button size="sm" tone="ghost" icon="chevronLeft" disabled={!canUndo} onClick={() => op({ kind: 'undo' })} title="Ctrl+Z">
            {t('layout.undo')}
          </Button>
          <Button size="sm" tone="ghost" icon="chevronRight" disabled={!canRedo} onClick={() => op({ kind: 'redo' })} title="Ctrl+Shift+Z">
            {t('layout.redo')}
          </Button>
        </div>
        <div className="flex gap-2">
          <Button tone="routine" className="flex-1" onClick={cancel} title="Esc">
            {t('layout.cancel')}
          </Button>
          <Button tone="commit" className="flex-1" icon="check" onClick={() => commit()} title="Enter">
            {t('layout.done')}
          </Button>
        </div>
      </div>
    </div>
  )
}
