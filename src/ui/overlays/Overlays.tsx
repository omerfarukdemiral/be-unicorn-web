// Blocking overlay contents (the only centered modals): move scene, post-mortem, victory.
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { ConceptId, PostMortemCode, PostMortemReason } from '../../engine/types'
import { POST_MORTEM_TEXT, STAGES } from '../../content'
import { useGameStore } from '../../store/gameStore'
import { Icon } from '../icons'
import { t } from '../i18n'
import { fixed, money, num, pct } from '../format'
import { Button, Dot, IconBadge, Label, Stat } from '../primitives'
import { NotebookCard } from '../NotebookCard'
import { conceptTitle } from '../panels/JournalPanel'
import { useModalQueue } from '../modalQueue'
import { OverlayFrame } from './OverlayFrame'

// ---------------------------------------------------------------------------
// Move scene (stage up)
// ---------------------------------------------------------------------------

export function MoveSceneOverlay({ onClose }: { onClose: () => void }) {
  const stage = useGameStore((s) => s.state.stage)
  const def = STAGES[stage]
  const prev = STAGES[stage - 1]
  return (
    <OverlayFrame onClose={onClose}>
      <div className="flex flex-col items-center gap-4 p-6 text-center">
        <div className="flex items-center gap-3 text-ink-3">
          <OfficeGlyph size={48} muted />
          <Icon name="chevronRight" size={22} />
          <OfficeGlyph size={72} />
        </div>
        <div>
          <Label>{t('move.kicker', { stage: def?.name ?? '' })}</Label>
          <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-ink">{t('round.moveTitle')}</h2>
          <p className="mt-0.5 text-base font-semibold text-ink">{def?.officeName}</p>
          {def?.tagline && <p className="font-text mt-1 text-sm text-ink-2">{def.tagline}</p>}
          {prev && <p className="font-text mt-1 text-sm text-ink-2">{t('move.from', { office: prev.officeName })}</p>}
        </div>
        {def && (
          <div className="w-full rounded-control border border-border px-4 py-3 text-left">
            <Label>{t('move.unlocks')}</Label>
            <p className="font-text mt-0.5 text-sm font-medium text-ink">{def.unlocksText}</p>
          </div>
        )}
        <p className="font-text text-xs text-ink-2">{t('round.moveBody')}</p>
        <Button tone="primary" className="w-full" onClick={onClose} autoFocus>
          {t('move.go')}
        </Button>
      </div>
    </OverlayFrame>
  )
}

function OfficeGlyph({ size, muted }: { size: number; muted?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {/* Neutral isometric block: muted = old office (hairline tones), new office = ink ramp. */}
      <path d="M32 6 58 20 32 34 6 20Z" fill={muted ? 'var(--color-surface-2)' : 'var(--color-ink-3)'} stroke={muted ? 'var(--color-border-strong)' : 'none'} strokeLinejoin="round" />
      <path d="M6 20v22l26 14V34Z" fill={muted ? 'var(--color-border)' : 'var(--color-ink)'} stroke={muted ? 'var(--color-border-strong)' : 'none'} strokeLinejoin="round" />
      <path d="M58 20v22L32 56V34Z" fill={muted ? 'var(--color-surface-2)' : 'var(--color-ink-2)'} stroke={muted ? 'var(--color-border-strong)' : 'none'} strokeLinejoin="round" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Post-mortem & victory
// ---------------------------------------------------------------------------

const PM_FORMAT: Record<PostMortemCode, (v: number) => string> = {
  runwayIgnored: (v) => t('unit.months', { v: fixed(v, 1) }),
  burnTooHigh: (v) => t('hud.perMonthPlain', { v: money(v) }),
  scaledWithoutPmf: (v) => pct(v),
  highChurn: (v) => pct(v, 1),
  lowMorale: (v) => String(Math.round(v)),
  prematureScaling: (v) => t('unit.people', { v: Math.round(v) }),
  lateFundraise: (v) => t('unit.days', { v: Math.round(v) }),
  overload: (v) => pct(v),
  teamLost: (v) => t('unit.people', { v: Math.round(v) }),
  unfocused: (v) => t('unit.projects', { v: Math.round(v) }),
}

function restart() {
  const { state, newGame } = useGameStore.getState()
  const xp = state.meta.founderXp + (state.gameOver?.xpEarned ?? 0)
  useModalQueue.getState().clear()
  newGame({ seed: Math.floor(Math.random() * 2 ** 31), founderXp: xp, runIndex: state.meta.runIndex + 1 })
}

export function PostMortemOverlay() {
  const s = useGameStore(useShallow((st) => ({ go: st.state.gameOver, day: st.state.time.day, xp: st.state.meta.founderXp, stage: st.state.stage })))
  const [open, setOpenRaw] = useState<ConceptId | null>(null)
  // Opening a card from the post-mortem also learns it (openConcept is allowed after game over).
  const setOpen = (c: ConceptId | null) => {
    setOpenRaw(c)
    const { state, dispatch } = useGameStore.getState()
    if (c && state.concepts.triggered.includes(c) && !state.concepts.learned.includes(c)) dispatch({ type: 'openConcept', conceptId: c })
  }
  if (!s.go) return null
  const reasons = s.go.reasons.slice(0, 3)
  return (
    <OverlayFrame wide>
      <div className="flex flex-col gap-5 p-5 sm:p-7">
        <header>
          <div className="flex items-center gap-1.5">
            <Dot color="var(--color-negative)" size={7} />
            <Label>{t('pm.sub', { stage: STAGES[s.stage]?.name ?? '', m: Math.floor(s.day / 30) + 1 })}</Label>
          </div>
          <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-ink">{t(s.go.kind === 'teamLost' ? 'gameOver.teamLostTitle' : 'gameOver.bankruptTitle')}</h2>
          <p className="font-text mt-1 text-sm text-ink-2">{t(s.go.kind === 'teamLost' ? 'gameOver.teamLostBody' : 'gameOver.bankruptBody')}</p>
        </header>
        <h3 className="ui-label -mb-2">{t('gameOver.reasonsTitle')}</h3>
        <ol className="flex flex-col gap-2">
          {reasons.map((r, i) => (
            <ReasonRow key={`${r.code}-${i}`} index={i} reason={r} open={open} setOpen={setOpen} />
          ))}
        </ol>
        {open && (
          <div className="overflow-hidden rounded-card border border-border animate-fade-in">
            <NotebookCard conceptId={open} />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 rounded-control border border-border px-4 py-3">
          <IconBadge icon="sparkle" size={32} filled />
          <div className="min-w-0 flex-1">
            <div className="tabular text-sm font-semibold text-ink">{t('gameOver.xp', { v: fixed(s.go.xpEarned, 1) })}</div>
            <div className="tabular text-xs text-ink-2">{t('pm.xpHint', { total: fixed(s.xp + s.go.xpEarned, 1) })}</div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-0.5 text-center">
          <p className="font-text text-xs font-medium text-ink-2">{t('pm.failureIsData')}</p>
          <button
            type="button"
            onClick={() => setOpen(open === 'failure-is-data' ? null : 'failure-is-data')}
            className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-ink underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-ink max-md:min-h-11"
          >
            <Icon name="book" size={13} className="text-ink-2" />
            {t('decision.notebookLink', { v: conceptTitle('failure-is-data') })}
          </button>
        </div>
        <Button tone="primary" icon="refresh" onClick={restart} autoFocus>
          {t('gameOver.retry')}
        </Button>
      </div>
    </OverlayFrame>
  )
}

function ReasonRow({ index, reason, open, setOpen }: { index: number; reason: PostMortemReason; open: ConceptId | null; setOpen: (c: ConceptId | null) => void }) {
  const cid = reason.conceptId
  return (
    <li className="flex items-start gap-3 rounded-control border border-border p-3">
      <span className="tabular w-6 shrink-0 pt-px text-sm font-semibold text-ink-2">{String(index + 1).padStart(2, '0')}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug text-ink">{t(`postMortem.${reason.code}`)}</p>
        <p className="font-text mt-0.5 text-sm leading-snug text-ink-2">{POST_MORTEM_TEXT[reason.code]}</p>
        {reason.value !== undefined && <p className="tabular mt-1 text-xs font-medium text-ink">{t('pm.yourNumber', { v: PM_FORMAT[reason.code](reason.value) })}</p>}
        {cid && (
          <button
            type="button"
            onClick={() => setOpen(open === cid ? null : cid)}
            className="mt-1 inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-ink underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-ink max-md:min-h-11"
          >
            <Icon name="book" size={13} className="text-ink-2" />
            {t('decision.notebookLink', { v: conceptTitle(cid) })}
          </button>
        )}
      </div>
    </li>
  )
}

export function VictoryOverlay() {
  const s = useGameStore(
    useShallow((st) => ({ day: st.state.time.day, equity: st.state.stats.equity, valuation: st.state.finance.valuation, team: st.state.derived.teamSize, learned: st.state.concepts.learned.length, archetype: st.state.archetype })),
  )
  return (
    <OverlayFrame wide>
      <div className="relative flex flex-col items-center gap-5 overflow-hidden p-6 text-center sm:p-8">
        <span className="relative grid size-16 place-items-center rounded-card bg-ink text-on-ink">
          <Icon name="unicorn" size={36} />
        </span>
        <div className="relative">
          <Label>{t('victory.kicker')}</Label>
          <h2 className="mt-1.5 text-3xl font-semibold tracking-tight text-ink">{t('victory.title')}</h2>
          <p className="font-text mt-1 text-sm text-ink-2">{t('victory.body', { days: Math.floor(s.day) })}</p>
        </div>
        <div className="relative grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label={t('victory.valuation')} value={money(s.valuation)} />
          <Stat label={t('hud.equity')} value={pct(s.equity, 1)} />
          <Stat label={t('victory.team')} value={num(s.team)} />
          <Stat label={t('victory.learned')} value={s.learned} />
        </div>
        {s.archetype && <p className="relative text-sm font-semibold text-ink">{t('victory.archetype', { v: t(`archetype.${s.archetype}`) })}</p>}
        <Button tone="primary" icon="refresh" className="relative w-full" onClick={restart}>
          {t('victory.again')}
        </Button>
      </div>
    </OverlayFrame>
  )
}

