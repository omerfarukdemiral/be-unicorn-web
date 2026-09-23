// Blocking overlay contents (the only centered modals): move scene, post-mortem, victory.
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { ConceptId, PostMortemCode, PostMortemReason } from '../../engine/types'
import { POST_MORTEM_TEXT, STAGES } from '../../content'
import { useGameStore } from '../../store/gameStore'
import { Icon } from '../icons'
import { t } from '../i18n'
import { fixed, money, num, pct } from '../format'
import { Button, Stat } from '../primitives'
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
        <div className="flex items-center gap-3 text-ink-400">
          <OfficeGlyph size={48} muted />
          <Icon name="chevronRight" size={22} />
          <OfficeGlyph size={72} />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-lilac-500">{t('move.kicker', { stage: def?.name ?? '' })}</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight">{t('round.moveTitle')}</h2>
          <p className="mt-0.5 text-base font-bold text-ink-700">{def?.officeName}</p>
          {def?.tagline && <p className="mt-1 text-sm italic text-ink-600">{def.tagline}</p>}
          {prev && <p className="mt-1 text-sm text-ink-600">{t('move.from', { office: prev.officeName })}</p>}
        </div>
        {def && (
          <div className="w-full rounded-2xl bg-mint-100 px-4 py-3 text-left">
            <div className="text-[11px] font-bold uppercase tracking-wider text-mint-600">{t('move.unlocks')}</div>
            <p className="text-sm font-semibold text-ink-900">{def.unlocksText}</p>
          </div>
        )}
        <p className="text-xs text-ink-600">{t('round.moveBody')}</p>
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
      <path d="M32 6 58 20 32 34 6 20Z" fill={muted ? '#ece0cc' : '#c9a7f5'} />
      <path d="M6 20v22l26 14V34Z" fill={muted ? '#dccbb0' : '#9fe0c3'} />
      <path d="M58 20v22L32 56V34Z" fill={muted ? '#ece0cc' : '#9cc9f5'} />
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
          <p className="text-xs font-bold uppercase tracking-wider text-rose-600">{t('pm.sub', { stage: STAGES[s.stage]?.name ?? '', m: Math.floor(s.day / 30) + 1 })}</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight">{t(s.go.kind === 'teamLost' ? 'gameOver.teamLostTitle' : 'gameOver.bankruptTitle')}</h2>
          <p className="mt-1 text-sm text-ink-600">{t(s.go.kind === 'teamLost' ? 'gameOver.teamLostBody' : 'gameOver.bankruptBody')}</p>
        </header>
        <h3 className="-mb-2 text-xs font-bold uppercase tracking-wider text-ink-600">{t('gameOver.reasonsTitle')}</h3>
        <ol className="flex flex-col gap-2">
          {reasons.map((r, i) => (
            <ReasonRow key={`${r.code}-${i}`} index={i} reason={r} open={open} setOpen={setOpen} />
          ))}
        </ol>
        {open && (
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-cream-300 animate-fade-in">
            <NotebookCard conceptId={open} />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-lilac-100 px-4 py-3">
          <Icon name="sparkle" size={22} className="text-lilac-500" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-extrabold">{t('gameOver.xp', { v: fixed(s.go.xpEarned, 1) })}</div>
            <div className="text-xs text-ink-600">{t('pm.xpHint', { total: fixed(s.xp + s.go.xpEarned, 1) })}</div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-0.5 text-center">
          <p className="text-xs italic text-ink-600">{t('pm.failureIsData')}</p>
          <button
            type="button"
            onClick={() => setOpen(open === 'failure-is-data' ? null : 'failure-is-data')}
            className="inline-flex min-h-9 items-center gap-1 text-xs font-bold text-lilac-500 hover:underline max-md:min-h-11"
          >
            <Icon name="book" size={13} />
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
    <li className="flex items-start gap-3 rounded-2xl bg-cream-100 p-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-rose-100 text-xs font-extrabold text-rose-600">{index + 1}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-snug">{t(`postMortem.${reason.code}`)}</p>
        <p className="text-sm leading-snug text-ink-700">{POST_MORTEM_TEXT[reason.code]}</p>
        {reason.value !== undefined && <p className="tabular text-xs text-ink-600">{t('pm.yourNumber', { v: PM_FORMAT[reason.code](reason.value) })}</p>}
        {cid && (
          <button
            type="button"
            onClick={() => setOpen(open === cid ? null : cid)}
            className="mt-1 inline-flex min-h-9 items-center gap-1 text-xs font-bold text-lilac-500 hover:underline max-md:min-h-11"
          >
            <Icon name="book" size={13} />
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
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-lilac-100 via-rose-100 to-transparent" />
        <span className="relative grid size-20 place-items-center rounded-full bg-cream-50 text-lilac-500 shadow-[var(--shadow-card)]">
          <Icon name="unicorn" size={44} />
        </span>
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-wider text-lilac-500">{t('victory.kicker')}</p>
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight">{t('victory.title')}</h2>
          <p className="mt-1 text-sm text-ink-600">{t('victory.body', { days: Math.floor(s.day) })}</p>
        </div>
        <div className="relative grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label={t('victory.valuation')} value={money(s.valuation)} />
          <Stat label={t('hud.equity')} value={pct(s.equity, 1)} />
          <Stat label={t('victory.team')} value={num(s.team)} />
          <Stat label={t('victory.learned')} value={s.learned} />
        </div>
        {s.archetype && <p className="relative text-sm font-semibold">{t('victory.archetype', { v: t(`archetype.${s.archetype}`) })}</p>}
        <Button tone="primary" icon="refresh" className="relative w-full" onClick={restart}>
          {t('victory.again')}
        </Button>
      </div>
    </OverlayFrame>
  )
}

