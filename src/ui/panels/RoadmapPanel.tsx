// Yol haritası: the Unicorn yolu as a horizontal rail (GAMEPLAY V2 §10.5, §9.4). Passed and current stages show their
// name, the next one its target, the later ones are silhouettes. Tapping a known stage shows its office, round and what
// it opens under the rail as icon + number rows. The current stage carries the only sentence (how far the next one is).
import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ROADMAP_STEPS, STAGES, type StageDef } from '../../content'
import { useGameStore } from '../../store/gameStore'
import { Icon } from '../icons'
import { t } from '../i18n'
import { money } from '../format'
import { Bar, cx, Pill } from '../primitives'
import { openRound } from '../layout/StageSection'
import { GoalsCard, ValuationParts } from './GoalsCard'

type Status = 'done' | 'here' | 'next' | 'later'

function statusOf(i: number, stage: number): Status {
  if (i < stage) return 'done'
  if (i === stage) return 'here'
  return i === stage + 1 ? 'next' : 'later'
}

export function RoadmapPanel() {
  const s = useGameStore(
    useShallow((st) => ({
      stage: st.state.stage,
      progress: st.state.derived.stageProgress,
      valuation: st.state.finance.valuation,
      canStart: st.state.derived.canStartRound,
      company: st.state.meta.companyName,
      parts: st.state.derived.valuationParts,
      goalsDone: st.state.goalsDone,
    })),
  )
  const markGoalsSeen = useGameStore((st) => st.markGoalsSeen)
  // Open = seen: the stage name's goal dot clears here (goals reached while it is open never show it either).
  useEffect(() => markGoalsSeen(), [s.goalsDone, markGoalsSeen])
  const [picked, setPicked] = useState<number | null>(null)
  const next = STAGES[s.stage + 1]
  const gap = next ? (next.targetValuation ?? 0) - s.valuation : 0
  const line = !next ? t('roadmap.won') : s.canStart || gap <= 0 ? t('roadmap.ready', { stage: next.name }) : t('roadmap.gap', { stage: next.name, v: money(gap) })
  const shown = picked !== null && picked <= s.stage + 1 ? picked : s.stage
  const def = STAGES[shown]

  return (
    <div className="flex flex-col gap-3">
      {/* Where you stand: company, stage n/7, the one sentence, progress to the next stage. */}
      <div className="rounded-card bg-surface-2/60 p-3">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{s.company}</span>
          <Pill tint="var(--color-brand)" dot="var(--color-brand)">
            {STAGES[s.stage]?.name} · {t('roadmap.step', { n: s.stage + 1 })}
          </Pill>
        </div>
        {next && (
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="tabular text-[22px] font-semibold leading-tight text-ink">{money(s.valuation)}</span>
            <span className="tabular text-[13px] font-semibold text-ink-2">/ {money(next.targetValuation ?? 0)}</span>
          </div>
        )}
        {next && <Bar value={s.progress} height={6} className="mt-1.5" />}
        {next && s.parts && <ValuationParts parts={s.parts} />}
        <p className="font-text mt-1.5 text-xs text-ink-2">{line}</p>
        {next && s.canStart && (
          <button type="button" onClick={openRound} className="mt-2 inline-flex h-8 items-center gap-1 rounded-control bg-brand px-2.5 text-xs font-semibold text-on-ink transition-colors hover:bg-brand-hover">
            <Icon name="rocket" size={14} />
            {t('top.roundStart')}
          </button>
        )}
      </div>

      <GoalsCard />

      {/* The rail: one node per stage, the line between them filled once passed. */}
      <ol className="ui-scroll -mx-1 flex items-start overflow-x-auto px-1 pb-1" aria-label={t('roadmap.step', { n: s.stage + 1 })}>
        {STAGES.map((st, i) => (
          <StageNode
            key={st.key}
            def={st}
            status={statusOf(i, s.stage)}
            last={i === STAGES.length - 1}
            active={i === shown}
            onPick={i <= s.stage + 1 ? () => setPicked(i) : undefined}
          />
        ))}
      </ol>

      {def && <StageFacts def={def} />}
    </div>
  )
}

function StageNode({ def, status, last, active, onPick }: { def: StageDef; status: Status; last: boolean; active: boolean; onPick?: () => void }) {
  const hidden = status === 'later'
  return (
    <li className="flex min-w-[64px] flex-1 flex-col items-center">
      <div className="flex w-full items-center">
        <span className={cx('h-0.5 flex-1', def.index === 0 ? 'bg-transparent' : status === 'later' || status === 'next' ? 'bg-border' : 'bg-brand')} />
        <button
          type="button"
          disabled={!onPick}
          onClick={onPick}
          aria-pressed={active}
          aria-label={hidden ? t('roadmap.silhouette') : def.name}
          className={cx(
            'grid size-9 shrink-0 place-items-center rounded-full border-2 transition-colors',
            status === 'done' && 'border-brand bg-brand text-on-ink',
            status === 'here' && 'border-brand bg-brand-soft text-brand-ink ring-4 ring-brand/15',
            status === 'next' && 'border-brand/50 bg-surface text-brand-ink',
            hidden && 'border-dashed border-border-strong bg-surface-2 text-ink-3',
            active && status !== 'here' && 'ring-2 ring-brand/40',
          )}
        >
          {last ? <Icon name="unicorn" size={16} /> : status === 'done' ? <Icon name="check" size={14} /> : hidden ? <Icon name="lock" size={13} /> : <span className="tabular text-[12px] font-bold">{def.index + 1}</span>}
        </button>
        <span className={cx('h-0.5 flex-1', last ? 'bg-transparent' : status === 'done' ? 'bg-brand' : 'bg-border')} />
      </div>
      <span className={cx('mt-1 max-w-[72px] truncate text-center text-[11px] font-semibold', status === 'here' ? 'text-brand-ink' : hidden ? 'text-ink-3' : 'text-ink')}>
        {hidden ? t('roadmap.silhouette') : def.name}
      </span>
      <span className="tabular text-center text-[10.5px] font-medium text-ink-2">{def.targetValuation && !hidden ? money(def.targetValuation) : ''}</span>
    </li>
  )
}

/** The picked stage as icon + value rows: office, the round that opens it, what it unlocks. */
function StageFacts({ def }: { def: StageDef }) {
  const unlock = ROADMAP_STEPS.find((r) => r.stage === def.index)?.unlock
  return (
    <dl className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1 rounded-control bg-surface-2/60 px-2.5 py-2 text-[12px] leading-snug">
      <dt className="text-ink-3">
        <Icon name="building" size={14} />
      </dt>
      <dd className="font-semibold text-ink">{def.officeName}</dd>
      <dt className="text-ink-3">
        <Icon name="coin" size={14} />
      </dt>
      <dd className="tabular font-semibold text-ink">
        {def.roundAmount && def.roundEquity
          ? t('roadmap.roundValue', { amount: money(def.roundAmount), equity: Math.round(def.roundEquity * 100) })
          : t('roadmap.noRound')}
      </dd>
      {unlock && (
        <>
          <dt className="text-ink-3">
            <Icon name="key" size={14} />
          </dt>
          <dd className="text-ink-2">{unlock}</dd>
        </>
      )}
    </dl>
  )
}
