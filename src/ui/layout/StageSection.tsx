// Top bar, section A: stage name + date (neutral month ring) + stage progress (valuation / target) + the round.
// The round clock lives ONLY here ("Tur 3/10 hf" chip, docs/LAYOUT.md §2.1); "Tur başlat" takes the same slot.
// Curiosity (docs/GAMEPLAY_V2.md §9.4): the lead rival's notch rides the stage line, the next stage's ghost sits at its end.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { rivalNotch, type GameEvent, type StageIndex } from '../../engine'
import { DECISIONS, STAGES, TEASERS } from '../../content'
import { unseenGoals, useGameStore } from '../../store/gameStore'
import { Icon } from '../icons'
import { t } from '../i18n'
import { money } from '../format'
import { cx } from '../primitives'
import { DayClock } from '../time'
import { valuationLine } from '../loopUi'
import { Ghost, openRoadmap, roadmapTitle, RoadmapStepper, type RivalNotch } from './RoadmapStepper'

/** Round chip / button → Büyüme panel scrolled to the round block (again closes it, like the dock tabs). */
export function openRound() {
  const { ui, openPanel, closePanel } = useGameStore.getState()
  if (ui.panel?.kind === 'growth') closePanel()
  else openPanel({ kind: 'growth', section: 'round' }, { root: true })
}

export type StageVariant = 'wide' | 'narrow' | 'mobile'

function useStage() {
  return useGameStore(
    useShallow((st) => ({
      stage: st.state.stage,
      progress: st.state.derived.stageProgress,
      valuation: st.state.finance.valuation,
      parts: st.state.derived.valuationParts,
      canStart: st.state.derived.canStartRound,
      roundActive: !!st.state.round?.active,
      weeksLeft: st.state.round?.weeksLeft ?? 0,
      weeksTotal: st.state.round?.weeksTotal ?? 0,
      gameOver: !!st.state.gameOver,
      company: st.state.meta.companyName,
      newGoals: unseenGoals(st.state, st.ui.seenGoals),
    })),
  )
}

/** Id of the newest rival card shown (category 'rival' or a rival thread step), 0 = none in the events buffer. */
function lastRivalCard(events: readonly GameEvent[]): number {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]
    if (e?.kind !== 'decisionShown') continue
    const card = DECISIONS.find((d) => d.id === e.refId)
    if (card && (card.category === 'rival' || card.thread?.id === 'rival')) return e.id
  }
  return 0
}

/**
 * The lead rival's notch on the current link, on the scale of derived.stageProgress (valuation / B.STAGE_TARGET_VALUATION).
 * Null before a rival is born, once the lead is bought (§8.2, the guard world.ts uses) and at the last stage.
 * The engine runs the race on MRR (`ahead`), so the notch is kept on the side of the fill its colour says.
 * `pulse` turns non-zero only for a rival card that came after this run was first seen (generation, like useFreshEvents).
 */
function useRivalNotch(): RivalNotch | null {
  const card = useGameStore((st) => lastRivalCard(st.state.events))
  const generation = useGameStore((st) => st.ui.generation)
  const r = useGameStore(useShallow((st) => rivalNotch(st.state)))
  // The card seen at the first sight of a run (mount, new game, loaded save) never nudges.
  const base = useRef<{ generation: number; id: number } | null>(null)
  if (!base.current || base.current.generation !== generation || card < base.current.id) base.current = { generation, id: card }
  if (!r) return null
  return { at: r.at, ahead: r.ahead, title: t('rival.notchTitle', { name: r.name, v: money(r.valuation) }), pulse: card > base.current.id ? card : 0 }
}

/** Nunito has no U+2192: the i18n "→" is drawn with the icon set's arrow, so no thin system-font glyph sits among 800-weight figures. */
function withArrow(text: string): ReactNode {
  const i = text.indexOf('→')
  if (i < 0) return text
  return (
    <>
      {text.slice(0, i)}
      <Icon name="arrowRight" size={12} className="-mx-0.5 inline-block align-[-1px]" />
      {text.slice(i + 1)}
    </>
  )
}

function progressTitle(s: ReturnType<typeof useStage>): string {
  const next = STAGES[s.stage + 1]
  if (!next) return t('top.lastStage')
  const head = t('top.progressTitle', { stage: next.name, v: money(s.valuation), target: money(next.targetValuation ?? 0) })
  return s.parts ? `${head}\n${valuationLine(s.parts)}` : head
}

/** Segmented Unicorn-yolu line (phones: 4px under row 1, no figures; the "n/7" chip sits by the stage name): one segment per stage step, the next stage's ghost at its right end (§9.4). */
export function StageProgressLine({ className }: { className?: string }) {
  const s = useStage()
  const notch = useRivalNotch()
  const next = STAGES[s.stage + 1]
  return (
    <div className={cx('flex items-center gap-1', className)}>
      <RoadmapStepper size="line" stage={s.stage} progress={next ? s.progress : 1} notch={notch} className="flex-1" />
      {next && <Ghost size={10} ghost={{ stage: next.index as StageIndex, teaser: TEASERS[s.stage as StageIndex] }} />}
    </div>
  )
}

/** Steps inside a stage (fractions of the next target): small wins between the big ones (playtest 2026-10-06). */
export const STAGE_MILESTONES = [0.05, 0.1, 0.25, 0.5, 0.75] as const

/** The highest milestone index reached at `progress` (−1 = none). */
export function milestoneIndex(progress: number): number {
  let i = -1
  STAGE_MILESTONES.forEach((m, k) => {
    if (progress >= m) i = k
  })
  return i
}

/**
 * A milestone just crossed: "✦ $25K" pops beside the stage figures for a moment, then goes. No toast, no sound of its
 * own; a fresh run, a loaded save or a new stage starts from where it stands (nothing flashes for the past).
 */
function MilestonePop({ stage, progress, target }: { stage: number; progress: number; target: number }) {
  const generation = useGameStore((st) => st.ui.generation)
  const base = useRef<{ key: string; idx: number } | null>(null)
  const [pop, setPop] = useState<{ idx: number; at: number } | null>(null)
  const key = `${generation}:${stage}`
  const idx = milestoneIndex(progress)
  if (!base.current || base.current.key !== key) base.current = { key, idx }
  useEffect(() => {
    const b = base.current
    if (!b || idx <= b.idx) return
    b.idx = idx
    const at = performance.now()
    setPop({ idx, at })
    const id = window.setTimeout(() => setPop((p) => (p?.at === at ? null : p)), 2600)
    return () => window.clearTimeout(id)
  }, [idx])
  if (!pop) return null
  const m = STAGE_MILESTONES[pop.idx] ?? 0
  return (
    <span key={pop.at} className="ui-num inline-flex shrink-0 animate-pop-in items-center gap-0.5 rounded-full bg-brand-soft px-2 text-[12px] text-brand-ink">
      <Icon name="sparkle" size={12} />
      {money(target * m)}
    </span>
  )
}

function RoundSlot({ variant }: { variant: StageVariant }) {
  const s = useStage()
  if (s.gameOver) return null
  if (s.roundActive) {
    const left = Math.max(0, Math.ceil(s.weeksLeft))
    const total = Math.max(1, Math.round(s.weeksTotal))
    // Weeks done, the same count as Büyüme › Tur's progress row ("3/11 hafta"): one number for the round.
    const week = Math.min(total, Math.max(0, Math.round(total - s.weeksLeft)))
    const title = t('top.roundTitle', { v: left })
    return (
      <button
        type="button"
        onClick={openRound}
        title={title}
        aria-label={title}
        className={cx(
          'ui-key ui-key-sm ui-key-soft ui-num inline-flex shrink-0 items-center gap-1 px-2 text-[12px]',
          // Phones: a 44px target (the row is h44); desktop: a small h28 key.
          variant === 'mobile' ? 'h-11' : 'h-7',
        )}
      >
        <Icon name="timer" size={14} tone="var(--color-brand)" />
        {/* Same meaning everywhere: weeks DONE of the total ("3/11"), never a bare countdown number. */}
        {variant === 'mobile' ? t('top.roundShort', { w: week, t: total }) : t('top.round', { w: week, t: total })}
      </button>
    )
  }
  if (!s.canStart) return null
  // The pop-in lives on a wrapper: its fill-mode `both` pins `transform`, which would stop the key from sinking.
  return (
    <span className="inline-flex shrink-0 animate-pop-in">
      <button
        type="button"
        onClick={openRound}
        title={t('top.roundStart')}
        aria-label={t('top.roundStart')}
        className={cx('ui-key ui-key-commit inline-flex shrink-0 items-center gap-1.5 px-3 text-[13px] font-extrabold', variant === 'mobile' ? 'h-11' : 'h-9')}
      >
        <Icon name="rocket" size={15} />
        {variant === 'wide' ? t('top.roundStart') : t('top.roundStartShort')}
      </button>
    </span>
  )
}

/**
 * wide (≥1280, ≥256px, grows so the name is never cut): name · n/7 · date on row 1, stepper + "$412K → Seed $3M" on
 * row 2, round slot on the right.
 * narrow (<1280, ≥216px, grows like wide): same, the figures shortened to "→ Seed" (the rest is in the tooltip).
 * mobile: one row (name · n/7 · date · round); TopBar draws StageProgressLine under it.
 */
export function StageSection({ variant = 'wide' }: { variant?: StageVariant }) {
  const s = useStage()
  const notch = useRivalNotch()
  const name = STAGES[s.stage]?.name ?? '—'
  const next = STAGES[s.stage + 1]

  const nameEl = (
    <button
      type="button"
      onClick={openRoadmap}
      title={roadmapTitle(s.stage)}
      className={cx(
        'inline-flex min-w-0 items-center gap-1.5 rounded-md text-[15px] font-extrabold leading-5 text-ink transition-colors hover:text-brand-ink',
        variant === 'mobile' && 'h-11',
      )}
    >
      <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-brand shadow-[0_1.5px_0_var(--color-brand-deep)]" />
      <span className="relative shrink-0">
        {name}
        {/* A ☆ stage goal reached since Yol haritası was last opened. */}
        {s.newGoals > 0 && <span aria-hidden="true" className="absolute -right-2 -top-0.5 size-1.5 rounded-full bg-brand" />}
      </span>
      {/* Where on the Unicorn yolu: "3/7", always visible (phones too). */}
      <span className="ui-num shrink-0 rounded-full bg-brand-soft px-1.5 text-[11px] leading-4 text-brand-ink">
        {t('roadmap.step', { n: s.stage + 1 })}
      </span>
      {/* Wide only: below 1280 the gauges need the room. */}
      {variant === 'wide' && s.company && (
        <span title={t('top.companyTitle', { v: s.company })} className="font-text min-w-0 truncate text-[12px] font-medium text-ink-2">
          {s.company}
        </span>
      )}
    </button>
  )

  if (variant === 'mobile') {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {nameEl}
        <DayClock compact />
        <RoundSlot variant="mobile" />
      </div>
    )
  }

  return (
    <div className={cx('flex shrink-0 items-center gap-2', variant === 'wide' ? 'min-w-64' : 'min-w-[216px]')}>
      {/* wide: the stepper keeps room (≥ 288px column) next to the figures even with the round chip beside it. */}
      <div className={cx('flex-1', variant === 'wide' ? 'min-w-72' : 'min-w-0')}>
        <div className="flex h-5 min-w-0 items-center gap-2">
          {nameEl}
          <DayClock />
        </div>
        <div className="mt-1 flex items-center gap-2" title={progressTitle(s)}>
          <RoadmapStepper stage={s.stage} progress={next ? s.progress : 1} notch={notch} />
          {/* The next stop by name: "$12K → Pre-seed $500K" (narrow: just "→ Pre-seed"). */}
          <span className="tabular shrink-0 text-[12px] font-bold text-ink-2">
            {!next
              ? t('top.lastStage')
              : variant === 'wide'
                ? withArrow(t('top.progressNext', { v: money(s.valuation), next: next.name, target: money(next.targetValuation ?? 0) }))
                : withArrow(t('top.nextShort', { next: next.name }))}
          </span>
          {next && <Ghost ghost={{ stage: next.index as StageIndex, teaser: TEASERS[s.stage as StageIndex] }} />}
          {next && <MilestonePop stage={s.stage} progress={s.progress} target={next.targetValuation ?? 0} />}
        </div>
      </div>
      <RoundSlot variant={variant} />
    </div>
  )
}
