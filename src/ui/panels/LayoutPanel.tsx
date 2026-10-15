// Ofisi düzenle (grid §4), in the single right panel: one line on how, the selected piece (turn, team label for a
// desk), the last refusal in the game's voice, undo / redo and Vazgeç / Bitti. The scene does the moving
// (render/LayoutEditor); this panel never opens a popup. The head number is "Masa 14/21" (panelHeadline).
import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { DEPT_TEXT, FURNITURE } from '../../content'
import { DEPTS, type Dept } from '../../engine/types'
import { useGameStore } from '../../store/gameStore'
import { draftPieces } from '../../store/layoutEdit'
import { Icon } from '../icons'
import { t } from '../i18n'
import { useCanEditLayout } from '../layoutEditGate'
import { Button, cx } from '../primitives'
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
      return { id: p.id, itemId: p.itemId, type: p.type, team: p.team ?? null, who: who ?? null }
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
      <p className="font-text text-[13px] text-ink-2">{t('layout.hint')}</p>
      <SelectedPiece />
      <Refusal />
      <div className="mt-auto flex flex-col gap-2 pt-2">
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
