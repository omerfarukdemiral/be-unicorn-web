// Kanun Kitabı (docs/GAMEPLAY_V2.md §7.2), inside the CenterFrame: the policy trees side by side, each law a card.
// Signed = in force for good (lock + check), locked = grey silhouette with its lock as a number ("runway < 6"),
// closed = a signed law shuts it. One law is picked at a time; the bar under the trees carries its one sentence, the
// signing ring, the survival law's equity price, the CostPreview and the single commit "İmzala". Time keeps flowing
// (§14.1). The engine decides every gate (policyError) and the burn after a signature (signBurnDelta).
import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { policyError } from '../../engine'
import { POLICY_SURVIVAL_EQUITY } from '../../engine/balance'
import type { PolicyId } from '../../engine/types'
import { CONTENT, POLICIES, STAGES } from '../../content'
import type { PolicyLock, PolicyTree } from '../../content/types'
import { useGameStore } from '../../store/gameStore'
import { Icon } from '../icons'
import { t } from '../i18n'
import { pct } from '../format'
import { Button, CostPreview, cx, Label, Pill, Ring } from '../primitives'
import { useSpendPreview } from '../widgets'
import { lawbookView, signBurnDelta, type LawCard } from './centerData'

/** Tree hue (identity, never a warning): the survival tree takes the runway's gauge colour. */
const TREE_COLOR: Record<PolicyTree, string> = {
  survival: 'var(--color-g-runway)',
  growth: 'var(--color-g-users)',
  craft: 'var(--color-g-retention)',
  org: 'var(--color-g-indigo)',
}

/** The lock as a number: "runway < 6", "Seed+", "ekip ≥ 20" (+ "kira krizi" when a crisis also opens it). */
export function lockText(lock: PolicyLock): string {
  const v = lock.metric === 'stage' ? (STAGES[lock.value]?.name ?? String(lock.value)) : lock.value
  const main = t(`law.lock.${lock.metric}`, { v })
  return lock.crisis ? `${main} · ${t('law.lock.crisis')}` : main
}

export function LawbookScreen() {
  const day = useGameStore((s) => Math.floor(s.state.time.day))
  // Re-read the book when a signature, the stage, the runway band or the moves change it (policyError's inputs).
  const gate = useGameStore((s) =>
    [s.state.policies?.adopted.join(',') ?? '', s.state.stage, s.state.finance.runway === null ? '∞' : Math.floor(s.state.finance.runway), s.state.employees.length, s.state.derived.moves?.left ?? '', day].join('|'),
  )
  const book = useMemo(() => {
    const st = useGameStore.getState().state
    return lawbookView(POLICIES, st.derived.policies, (id) => policyError(st, CONTENT, id), st)
  }, [gate])
  const cards = book.trees.flatMap((g) => g.cards)
  // Unpicked, the bar shows the first open law; right after a signature none is open, so it keeps the countdown
  // (first waiting law) or the law just signed instead of falling back to "Yasa seç".
  const firstOpen = cards.find((c) => c.status === 'open')?.id ?? null
  const firstWait = cards.find((c) => c.status === 'wait')?.id ?? null
  const lastSigned = useGameStore((s) => s.state.policies?.adopted.at(-1) ?? null)
  const [picked, setPicked] = useState<PolicyId | null>(null)
  const sel = cards.find((c) => c.id === (picked ?? firstOpen ?? firstWait ?? lastSigned)) ?? null

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-lawbook>
      <div className="flex shrink-0 items-center gap-3 px-3 pb-2 pt-1">
        <span className="tabular text-[22px] font-semibold leading-none text-ink">{t('law.count', { n: book.signed, total: book.total })}</span>
        <Label>{t('law.signed')}</Label>
        <span className="ml-auto inline-flex items-center gap-2" title={t('law.waitTitle')}>
          <span className="relative grid size-9 place-items-center">
            <Ring value={1 - book.wait.left / book.wait.total} size={36} stroke={3} />
            <Icon name="timer" size={14} className="text-ink-2" />
          </span>
          <span className="tabular text-[15px] font-semibold text-ink">{t('law.wait', { d: book.wait.left })}</span>
        </span>
      </div>
      <div className="ui-scroll min-h-0 flex-1 px-3 pb-3">
        <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2 min-[860px]:grid-cols-4">
          {book.trees.map((g) => (
            <section key={g.tree} className="min-w-0" data-tree={g.tree}>
              <div className="mb-1.5 flex items-center gap-1.5">
                <span aria-hidden="true" className="h-3 w-[3px] rounded-full" style={{ background: TREE_COLOR[g.tree] }} />
                <span className="ui-label">{t(`law.tree.${g.tree}`)}</span>
              </div>
              <ul className="flex flex-col gap-1">
                {g.cards.map((c) => (
                  <li key={c.id}>
                    <LawCardButton card={c} on={sel?.id === c.id} waitLeft={book.wait.left} onPick={() => setPicked(c.id)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
      <SignBar card={sel} day={day} waitLeft={book.wait.left} waitTotal={book.wait.total} />
    </div>
  )
}

function LawCardButton({ card, on, waitLeft, onPick }: { card: LawCard; on: boolean; waitLeft: number; onPick: () => void }) {
  const silhouette = card.status === 'locked' || card.status === 'closed'
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={on}
      data-law={card.id}
      data-status={card.status}
      title={card.text}
      className={cx(
        'flex min-h-11 w-full items-center gap-2 rounded-control border px-2 py-1.5 text-left transition-colors',
        on ? 'border-brand bg-brand-soft' : silhouette ? 'border-hairline bg-surface-2/50' : 'border-border hover:bg-surface-2',
        card.status === 'signed' && !on && 'bg-surface-2',
      )}
    >
      <span className={cx('min-w-0 flex-1', silhouette && 'opacity-55')}>
        <span className="block truncate text-[13px] font-semibold text-ink">{card.name}</span>
        {card.status === 'locked' && <span className="tabular block text-[11px] font-semibold text-ink-2">{lockText(card.lock)}</span>}
        {card.status === 'closed' && <span className="block text-[11px] font-semibold text-ink-3">{t('law.closed')}</span>}
        {card.status === 'wait' && <span className="tabular block text-[11px] font-semibold text-ink-2">{t('law.wait', { d: waitLeft })}</span>}
      </span>
      {card.status === 'signed' && <Icon name="check" size={16} className="shrink-0 text-positive-ink" />}
      {(card.status === 'signed' || silhouette) && <Icon name="lock" size={14} className="shrink-0 text-ink-3" />}
      {card.status === 'wait' && <Icon name="timer" size={14} className="shrink-0 text-ink-3" />}
    </button>
  )
}

/**
 * The picked law: its sentence, the survival price, the money preview, the commit (or the reason it cannot be signed).
 * A blocked commit says why as a number: the cooldown's days left (with the header's ring beside it), or the moves.
 */
function SignBar({ card, day, waitLeft, waitTotal }: { card: LawCard | null; day: number; waitLeft: number; waitTotal: number }) {
  const dispatch = useGameStore((s) => s.dispatch)
  const id = card?.id ?? null
  const status = card?.status
  const burnDelta = useMemo(() => (id && status !== 'signed' ? signBurnDelta(useGameStore.getState().state, id) : 0), [id, status, day])
  const preview = useSpendPreview(0, burnDelta)
  const moves = useGameStore(useShallow((s) => s.state.derived.moves))
  if (!card) {
    return (
      <div className="flex shrink-0 items-center justify-center border-t border-border px-3 py-3 safe-bottom">
        <Label>{t('law.pick')}</Label>
      </div>
    )
  }
  const canSign = card.status === 'open' && card.error === null
  const cooling = card.error === 'cooldown'
  const cost = cooling
    ? t('law.wait', { d: waitLeft })
    : card.error === 'noMoves'
      ? `${moves?.left ?? 0}/${moves?.total ?? 0} · ${t('error.noMoves')}`
      : card.error
        ? t(`error.${card.error}`)
        : moves
          ? `${moves.left}/${moves.total}`
          : undefined
  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-border px-3 py-2.5 safe-bottom min-[640px]:flex-row min-[640px]:items-center" data-sign-bar={card.id}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[15px] font-semibold text-ink">{card.name}</span>
          {card.survival && (
            <Pill tint="var(--color-g-equity)" className="tabular text-ink">
              <span title={t('law.equityTitle')}>{t('law.equity', { v: pct(POLICY_SURVIVAL_EQUITY, 1) })}</span>
            </Pill>
          )}
          {card.status === 'locked' && <Pill className="tabular text-ink">{lockText(card.lock)}</Pill>}
        </div>
        <p className="font-text mt-0.5 text-[13px] leading-snug text-ink-2">{card.text}</p>
      </div>
      {card.status === 'signed' ? (
        <Pill className="text-ink">
          <Icon name="lock" size={12} />
          {t('law.signed')}
        </Pill>
      ) : (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Pill className="text-ink-2">
            <Icon name="lock" size={12} />
            {t('law.final')}
          </Pill>
          <CostPreview preview={preview} />
          {card.status === 'wait' && (
            <span className="relative grid size-9 shrink-0 place-items-center" title={t('law.waitTitle')} data-sign-wait>
              <Ring value={1 - waitLeft / waitTotal} size={36} stroke={3} />
              <Icon name="timer" size={14} className="text-ink-2" />
            </span>
          )}
          <Button
            tone="commit"
            icon={cooling ? 'timer' : undefined}
            disabled={!canSign}
            title={cooling ? t('law.waitTitle') : undefined}
            onClick={() => dispatch({ type: 'adoptPolicy', policyId: card.id })}
            cost={cost}
          >
            {t('law.sign')}
          </Button>
        </div>
      )}
    </div>
  )
}
