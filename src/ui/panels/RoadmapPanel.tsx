// Yol haritası: the Unicorn yolu as a vertical timeline (PLAN §3.1). One row per stage: office, target valuation,
// the round that opens it, what it unlocks. The current stage carries the only sentence (how far the next one is).
import { useShallow } from 'zustand/react/shallow'
import { ROADMAP_STEPS, STAGES, type StageDef } from '../../content'
import { useGameStore } from '../../store/gameStore'
import { Icon } from '../icons'
import { t } from '../i18n'
import { money } from '../format'
import { Bar, cx, Pill } from '../primitives'
import { openRound } from '../layout/StageSection'

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
    })),
  )
  const next = STAGES[s.stage + 1]
  const gap = next ? Math.max(0, (next.targetValuation ?? 0) - s.valuation) : 0
  const line = !next ? t('roadmap.won') : s.canStart || gap === 0 ? t('roadmap.ready', { stage: next.name }) : t('roadmap.gap', { stage: next.name, v: money(gap) })

  return (
    <div className="flex flex-col gap-4">
      {/* Where you stand: company, stage n/7, the one sentence, progress to the next stage. */}
      <div className="rounded-card border border-border bg-surface-2/60 p-3">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{s.company}</span>
          <Pill tint="var(--color-brand)" dot="var(--color-brand)">
            {STAGES[s.stage]?.name} · {t('roadmap.step', { n: s.stage + 1 })}
          </Pill>
        </div>
        <p className="font-text mt-1.5 text-xs text-ink-2">{line}</p>
        {next && (
          <div className="mt-2 flex items-center gap-2">
            <Bar value={Math.max(0, Math.min(1, s.progress))} height={6} className="flex-1" />
            <span className="tabular shrink-0 text-[11px] font-semibold text-ink-2">{t('top.progress', { v: money(s.valuation), target: money(next.targetValuation ?? 0) })}</span>
          </div>
        )}
        {next && s.canStart && (
          <button type="button" onClick={openRound} className="mt-2 inline-flex h-8 items-center gap-1 rounded-control bg-brand px-2.5 text-xs font-semibold text-on-ink transition-colors hover:bg-brand-hover">
            <Icon name="rocket" size={14} />
            {t('top.roundStart')}
          </button>
        )}
      </div>

      <ol className="flex flex-col">
        {STAGES.map((st, i) => (
          <StageRow key={st.key} def={st} status={statusOf(i, s.stage)} last={i === STAGES.length - 1} />
        ))}
      </ol>
    </div>
  )
}

function StageRow({ def, status, last }: { def: StageDef; status: Status; last: boolean }) {
  const unlock = ROADMAP_STEPS.find((r) => r.stage === def.index)?.unlock
  const faint = status === 'later'
  return (
    <li className="flex gap-3">
      {/* Rail: node + the line down to the next stage (filled once passed). */}
      <div className="flex w-7 shrink-0 flex-col items-center">
        <span
          className={cx(
            'grid size-7 shrink-0 place-items-center rounded-full border-2 transition-colors',
            status === 'done' && 'border-brand bg-brand text-on-ink',
            status === 'here' && 'border-brand bg-brand-soft text-brand-ink ring-4 ring-brand/15',
            status === 'next' && 'border-brand/50 bg-surface text-brand-ink',
            status === 'later' && 'border-border-strong bg-surface text-ink-3',
          )}
        >
          {last ? <Icon name="unicorn" size={15} /> : status === 'done' ? <Icon name="check" size={13} /> : <span className="tabular text-[11px] font-bold">{def.index + 1}</span>}
        </span>
        {!last && <span className={cx('my-1 w-0.5 flex-1 rounded-full', status === 'done' ? 'bg-brand' : 'bg-border')} />}
      </div>

      <div className={cx('min-w-0 flex-1', last ? 'pb-1' : 'pb-4', faint && 'opacity-60')}>
        <div className="flex min-h-7 items-center gap-2">
          <span className={cx('text-sm font-semibold', status === 'here' ? 'text-brand-ink' : 'text-ink')}>{def.name}</span>
          {status === 'here' && <Pill tint="var(--color-brand)">{t('roadmap.here')}</Pill>}
          {status === 'next' && <Pill dot="var(--color-brand)">{t('roadmap.next')}</Pill>}
          <span className="tabular ml-auto shrink-0 text-xs font-semibold text-ink">{def.targetValuation ? money(def.targetValuation) : ''}</span>
        </div>
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px] leading-snug">
          <dt className="text-ink-3">
            <Icon name="building" size={12} className="inline align-[-2px]" />
          </dt>
          <dd className="font-text text-ink-2">{def.officeName}</dd>
          <dt className="text-ink-3">
            <Icon name="coin" size={12} className="inline align-[-2px]" />
          </dt>
          <dd className="font-text tabular text-ink-2">
            {def.roundAmount && def.roundEquity
              ? t('roadmap.roundValue', { amount: money(def.roundAmount), equity: Math.round(def.roundEquity * 100) })
              : t('roadmap.noRound')}
          </dd>
          {unlock && (
            <>
              <dt className="text-ink-3">
                <Icon name="key" size={12} className="inline align-[-2px]" />
              </dt>
              <dd className="font-text text-ink-2">{unlock}</dd>
            </>
          )}
        </dl>
      </div>
    </li>
  )
}
