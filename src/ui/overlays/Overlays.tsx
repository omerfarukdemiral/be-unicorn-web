// Blocking moment contents, each a game event card in OverlayFrame (medallion + ribbon / stamp + one pinned key): move
// scene, post-mortem, the sale (acquired), victory. HUD grammar (docs/GAMEPLAY_V2.md §10.6): numbers first, at most one
// sentence; hero numbers sit in recessed ui-inset trays. The move scene and the victory draw the stage report cards (§9.3).
import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ARCHETYPES, type Archetype, type ConceptId, type PostMortemCode, type StageReport } from '../../engine/types'
import { STAGES, TEASERS } from '../../content'
import { codexCount, useGameStore } from '../../store/gameStore'
import { Icon, type IconName } from '../icons'
import { t } from '../i18n'
import { fixed, money, num, pct } from '../format'
import { Button, IconBadge, IconButton, Label, Stat } from '../primitives'
import { NotebookCard } from '../NotebookCard'
import { conceptTitle } from '../panels/JournalPanel'
import { useModalQueue } from '../modalQueue'
import { stageVerb } from '../layout/RoadmapStepper'
import { OverlayFrame } from './OverlayFrame'

const STAGE_LAST = STAGES.length - 1

// ---------------------------------------------------------------------------
// Move scene (stage up)
// ---------------------------------------------------------------------------

/** "4.2 ay", "∞" (99 = profitable all stage, GAMEPLAY V2 §9.3). */
function reportRunway(m: number): string {
  return m >= 99 ? t('receipt.infinite') : t('unit.months', { v: fixed(m, 1) })
}

/** The report of the stage just left (null on an older save that has none). */
function lastReport(reports: readonly StageReport[] | undefined, stage: number): StageReport | null {
  return [...(reports ?? [])].reverse().find((r) => r.stage === stage - 1) ?? null
}

export function MoveSceneOverlay({ onClose }: { onClose: () => void }) {
  const s = useGameStore(useShallow((st) => ({ stage: st.state.stage, reports: st.state.stageReports })))
  const def = STAGES[s.stage]
  const next = STAGES[s.stage + 1]
  const report = lastReport(s.reports, s.stage)
  const verb = stageVerb(s.stage)
  return (
    // Dealt low in the scene area, so the new office stays lit above the card; the medallion carries the new verb.
    <OverlayFrame
      onClose={onClose}
      mood="event"
      place="low"
      emblem={{ icon: verb.icon }}
      title={def?.officeName}
      // One line under the ribbon: the new stage and its verb (no second label repeating the same news).
      kicker={def ? `${def.name} · ${verb.label}` : verb.label}
      actions={
        <Button tone="commit" icon="arrowRight" className="w-full" onClick={onClose} autoFocus>
          {t('move.go')}
        </Button>
      }
    >
      <div className="flex flex-col items-center gap-4 text-center">
        {report && (
          <div className="ui-inset grid w-full grid-cols-3 gap-3 p-3 text-left">
            {/* The numbers land one after another, a stage report read off the card. `backwards` holds each one at its
                first frame through its delay (the shared count token has no fill), so it does not show, then pop. */}
            <div className="animate-count" style={{ animationDelay: '0ms', animationFillMode: 'backwards' }}>
              <Stat label={t('report.days')} value={num(report.days)} />
            </div>
            <div className="animate-count" style={{ animationDelay: '80ms', animationFillMode: 'backwards' }}>
              <Stat label={t('report.goals')} value={num(report.goalsDone)} icon="star" color="var(--color-g-equity)" />
            </div>
            <div className="animate-count" style={{ animationDelay: '160ms', animationFillMode: 'backwards' }}>
              <Stat label={t('report.minRunway')} value={reportRunway(report.minRunway)} />
            </div>
          </div>
        )}
        {next && (
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-3 text-ink-3">
              <OfficeGlyph size={56} />
              <Icon name="chevronRight" size={20} />
              {/* The next office as a silhouette: its outline only, the teaser says what it opens. */}
              <span className="relative opacity-40" title={t('move.nextOffice')}>
                <OfficeGlyph size={56} muted />
                <Icon name="lock" size={14} className="absolute -right-1 -top-1 text-ink-2" />
              </span>
            </div>
            <span className="text-xs font-semibold text-ink-2">{TEASERS[s.stage as keyof typeof TEASERS]}</span>
          </div>
        )}
      </div>
    </OverlayFrame>
  )
}

function OfficeGlyph({ size, muted }: { size: number; muted?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {/* Isometric block: muted = old office (hairline tones), new office = brand ramp. */}
      <path d="M32 6 58 20 32 34 6 20Z" fill={muted ? 'var(--color-surface-2)' : 'color-mix(in oklab, var(--color-brand) 45%, var(--color-surface))'} stroke={muted ? 'var(--color-border-strong)' : 'none'} strokeLinejoin="round" />
      <path d="M6 20v22l26 14V34Z" fill={muted ? 'var(--color-border)' : 'var(--color-brand-ink)'} stroke={muted ? 'var(--color-border-strong)' : 'none'} strokeLinejoin="round" />
      <path d="M58 20v22L32 56V34Z" fill={muted ? 'var(--color-surface-2)' : 'var(--color-brand)'} stroke={muted ? 'var(--color-border-strong)' : 'none'} strokeLinejoin="round" />
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
  newGame({ seed: Math.floor(Math.random() * 2 ** 31), founderXp: xp, runIndex: state.meta.runIndex + 1, companyName: state.meta.companyName })
}

/** Highest month-end MRR of the run (the receipts' history plus today). */
function peakMrr(history: readonly number[], mrr: number): number {
  return history.reduce((m, v) => Math.max(m, v), mrr)
}

/** Post-mortem: day, peak MRR and the first blind spot as the one sentence (its Defter card one tap away), then "Yeniden". */
export function PostMortemOverlay() {
  const s = useGameStore(
    useShallow((st) => ({ go: st.state.gameOver, day: st.state.time.day, stage: st.state.stage, peak: peakMrr(st.state.finance.mrrHistory, st.state.finance.mrr) })),
  )
  const [open, setOpenRaw] = useState<ConceptId | null>(null)
  // The page turn unmounts whichever key was focused (the book key, then "back"): focus follows it, so keyboard play
  // never drops to <body> behind the modal. "Back" takes focus on mount (autoFocus); the book key takes it back here.
  const book = useRef<HTMLButtonElement>(null)
  const returning = useRef(false)
  useEffect(() => {
    if (open === null && returning.current) {
      returning.current = false
      book.current?.focus()
    }
  }, [open])
  // Opening a card from the post-mortem also learns it (openConcept is allowed after game over).
  const setOpen = (c: ConceptId | null) => {
    setOpenRaw(c)
    const { state, dispatch } = useGameStore.getState()
    if (c && state.concepts.triggered.includes(c) && !state.concepts.learned.includes(c)) dispatch({ type: 'openConcept', conceptId: c })
  }
  if (!s.go) return null
  // The sale (§8.2) is a sub-ending of its own, not a death: three numbers, the XP, "Yeniden".
  if (s.go.kind === 'acquired') return <AcquiredOverlay day={s.day} xp={s.go.xpEarned} />
  const cause = s.go.reasons[0]
  const cid = cause?.conceptId
  const xp = t('gameOver.xp', { v: fixed(s.go.xpEarned, 1) })
  // Lights out: the office goes grey under the card, the title is the red stamp (the one red here). No onClose: a lost
  // run is answered with "Yeniden", which stays pinned even while a Defter page is open.
  return (
    <OverlayFrame
      wide
      mood="loss"
      emblem={{ icon: s.go.kind === 'teamLost' ? 'users' : 'cash', color: 'var(--color-ink-2)' }}
      title={t(s.go.kind === 'teamLost' ? 'gameOver.teamLostTitle' : 'gameOver.bankruptTitle')}
      kicker={t('pm.sub', { stage: STAGES[s.stage]?.name ?? '', m: Math.floor(s.day / 30) + 1 })}
      actions={
        <Button tone="commit" icon="refresh" className="w-full" onClick={restart} autoFocus cost={xp}>
          {t('gameOver.retry')}
        </Button>
      }
    >
      {open ? (
        // The Defter card turns in as a page over the ledger (keyed, so a different card turns again).
        <div key={open} className="animate-page-turn flex flex-col gap-2">
          <IconButton
            icon="chevronLeft"
            label={t('common.back')}
            onClick={() => {
              returning.current = true
              setOpen(null)
            }}
            autoFocus
          />
          <NotebookCard conceptId={open} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="ui-inset grid grid-cols-2 gap-3 p-3">
            <Stat label={t('pm.day')} value={num(Math.floor(s.day))} />
            <Stat label={t('pm.peakMrr')} value={money(s.peak)} icon="trend" color="var(--color-g-cash)" />
          </div>
          {cause && (
            <div className="ui-inset flex items-start gap-2 p-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <p className="text-lg font-semibold leading-snug text-ink">{t(`postMortem.${cause.code}`)}</p>
                <div className="flex flex-wrap items-baseline gap-2">
                  <Label>{t('pm.cause')}</Label>
                  {cause.value !== undefined && <span className="tabular text-[15px] font-extrabold text-ink">{PM_FORMAT[cause.code](cause.value)}</span>}
                </div>
              </div>
              {cid && (
                <button
                  ref={book}
                  type="button"
                  onClick={() => setOpen(open === cid ? null : cid)}
                  title={t('decision.notebookLink', { v: conceptTitle(cid) })}
                  aria-label={t('decision.notebookLink', { v: conceptTitle(cid) })}
                  aria-expanded={open === cid}
                  className="grid size-9 shrink-0 place-items-center rounded-control text-kind-concept transition-colors hover:bg-surface-2 max-md:size-11"
                >
                  <Icon name="book" size={18} />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </OverlayFrame>
  )
}

/**
 * The sale (acquired, §8.2): a signed contract, not a success modal. The price is the one hero number, then the
 * founder's share and the day, then the XP on the "Yeniden" commit. No sentence; nothing goes to the leaderboard
 * (cloud.ts sends no 'acquired' run).
 */
export function AcquiredOverlay({ day, xp }: { day: number; xp: number }) {
  const s = useGameStore(useShallow((st) => ({ valuation: st.state.finance.valuation, equity: st.state.stats.equity, stage: st.state.stage })))
  return (
    <OverlayFrame
      mood="win"
      emblem={{ icon: 'handshake', color: 'var(--color-g-equity)' }}
      title={t('gameOver.acquiredTitle')}
      kicker={STAGES[s.stage]?.name}
      actions={
        <Button tone="commit" icon="refresh" className="w-full" onClick={restart} autoFocus cost={t('gameOver.xp', { v: fixed(xp, 1) })}>
          {t('gameOver.retry')}
        </Button>
      }
    >
      <div data-acquired="" className="flex flex-col items-center gap-3 text-center">
        <div className="flex flex-col items-center gap-1.5">
          <span className="inline-flex items-center gap-2">
            <Icon name="coin" size={30} tone="var(--color-g-equity)" />
            <span className="tabular text-[40px] font-extrabold leading-none text-ink">{money(s.valuation)}</span>
          </span>
          <Label>{t('acq.valuation')}</Label>
        </div>
        {/* The signature line under the price: the contract is closed. */}
        <span aria-hidden="true" className="h-0.5 w-40 rounded-full bg-border-strong" />
        <div className="ui-inset grid w-full grid-cols-2 gap-3 p-3 text-left">
          <Stat label={t('acq.equity')} value={pct(s.equity, 1)} icon="pie" color="var(--color-g-equity)" />
          <Stat label={t('acq.day')} value={num(Math.floor(day))} />
        </div>
      </div>
    </OverlayFrame>
  )
}

const ARCHETYPE_ICON: Record<Archetype, IconName> = {
  bootstrap: 'coin',
  vcRocket: 'rocket',
  niche: 'compass',
  platform: 'network',
}

/** Victory: 4 numbers, the stage report cards as mini bars, the archetype walked + 3 untried silhouettes, the Keşif count. */
export function VictoryOverlay() {
  const s = useGameStore(
    useShallow((st) => ({
      day: st.state.time.day,
      equity: st.state.stats.equity,
      valuation: st.state.finance.valuation,
      team: st.state.derived.teamSize,
      learned: st.state.concepts.learned.length,
      archetype: st.state.archetype,
      reports: st.state.stageReports,
      codex: st.ui.codex,
    })),
  )
  // The engine writes a report per stage left (Garaj … Series C, the last one by winRun); Unicorn closes the list as a
  // row of its own, without a bar (no stage was lived there).
  const reports = (s.reports ?? []).filter((r) => r.stage < STAGE_LAST).slice(-STAGE_LAST)
  const longest = Math.max(1, ...reports.map((r) => r.days))
  const found = codexCount(s.codex)
  return (
    // Award screen over the final office: the win veil's brand glow keeps the scene's own confetti visible.
    <OverlayFrame
      wide
      mood="win"
      emblem={{ icon: 'unicorn' }}
      title={t('victory.title')}
      actions={
        <Button tone="commit" icon="refresh" className="w-full" onClick={restart} autoFocus>
          {t('victory.again')}
        </Button>
      }
    >
      <div className="flex flex-col items-center gap-5 text-center">
        {/* Numbers first: the valuation right under the ribbon, the tray, then the one sentence. */}
        <div className="flex flex-col items-center gap-1.5">
          <span className="tabular text-[40px] font-extrabold leading-none text-ink">{money(s.valuation)}</span>
          <Label>{t('victory.valuation')}</Label>
        </div>
        <div className="ui-inset grid w-full grid-cols-3 gap-3 p-3 text-left">
          <Stat label={t('hud.equity')} value={pct(s.equity, 1)} />
          <Stat label={t('victory.team')} value={num(s.team)} />
          <Stat label={t('victory.learned')} value={s.learned} />
        </div>
        <p className="font-text text-sm text-ink-2">{t('victory.body', { days: Math.floor(s.day) })}</p>
        {reports.length > 0 && (
          <div className="w-full text-left" data-report-rows={reports.length + 1}>
            <Label>{t('report.title')}</Label>
            <ol className="mt-1.5 flex flex-col gap-1">
              {reports.map((r, i) => (
                <li key={r.stage} className="flex h-6 items-center gap-2">
                  <span className="w-20 shrink-0 truncate text-xs font-semibold text-ink">{STAGES[r.stage]?.name}</span>
                  <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-brand/15">
                    {/* The karne fills in stage by stage: each bar grows from the left after the one before. */}
                    <span
                      className="block h-full origin-left animate-grow-x rounded-full bg-brand"
                      style={{ width: `${(r.days / longest) * 100}%`, animationDelay: `${300 + 70 * i}ms` }}
                    />
                  </span>
                  <span className="tabular w-12 shrink-0 text-right text-xs font-semibold text-ink">{t('report.daysShort', { v: num(r.days) })}</span>
                  <span className="tabular inline-flex w-8 shrink-0 items-center justify-end gap-0.5 text-xs font-semibold text-ink-2" title={t('report.goals')}>
                    <Icon name="star" size={11} className="text-g-equity" />
                    {r.goalsDone}
                  </span>
                </li>
              ))}
              <li className="flex h-6 items-center gap-2">
                <span className="w-20 shrink-0 truncate text-xs font-semibold text-brand-ink">{STAGES[STAGE_LAST]?.name}</span>
                <Icon name="unicorn" size={14} className="animate-pop-once text-brand" style={{ animationDelay: `${300 + 70 * reports.length}ms` }} />
              </li>
            </ol>
          </div>
        )}
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2" title={TEASERS[6]}>
            {s.archetype && (
              <span className="inline-flex items-center gap-1.5">
                <IconBadge icon={ARCHETYPE_ICON[s.archetype]} size={28} color="var(--color-brand)" />
                <Label className="text-brand-ink">{t(`archetype.${s.archetype}`)}</Label>
              </span>
            )}
            {/* The roads not walked: neutral stickers, faded and unnamed. */}
            {ARCHETYPES.filter((a) => a !== s.archetype)
              .slice(0, 3)
              .map((a) => (
                <span key={a} aria-hidden="true" className="opacity-50">
                  <IconBadge icon={ARCHETYPE_ICON[a]} size={28} />
                </span>
              ))}
          </div>
          <span className="inline-flex items-center gap-1.5" title={t('victory.codex')}>
            <Icon name="sparkle" size={18} tone="var(--color-brand)" />
            <Label>{t('victory.codex')}</Label>
            <span className="tabular text-[15px] font-extrabold text-ink">{t('codex.count', found)}</span>
          </span>
        </div>
      </div>
    </OverlayFrame>
  )
}
