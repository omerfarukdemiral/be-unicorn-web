// Blocking overlay contents: concept card, decision, reflection, round, move scene, post-mortem, victory, settings.
import { useState, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { ConceptId, DecisionCardId, PostMortemCode, PostMortemReason } from '../../engine/types'
import { POST_MORTEM_TEXT, STAGES } from '../../content'
import { useGameStore } from '../../store/gameStore'
import type { ZoomLevel } from '../../store/types'
import { Icon, type IconName } from '../icons'
import { t } from '../i18n'
import { fixed, money, num, pct } from '../format'
import { Bar, Button, cx, Stat } from '../primitives'
import { usePrefs } from '../hooks'
import { NotebookCard } from '../NotebookCard'
import { DecisionCardView, decisionById, ReflectionView } from '../bubbles/DecisionBubble'
import { conceptTitle } from '../panels/JournalPanel'
import { useModalQueue } from '../modalQueue'
import { OverlayFrame } from './OverlayFrame'

// ---------------------------------------------------------------------------

export function ConceptCardOverlay({ conceptId, onClose }: { conceptId: ConceptId; onClose: () => void }) {
  return (
    <OverlayFrame onClose={onClose} bare>
      <NotebookCard conceptId={conceptId} onClose={onClose} />
    </OverlayFrame>
  )
}

export function DecisionOverlay({ cardId, onClose }: { cardId: DecisionCardId; onClose: () => void }) {
  const card = decisionById(cardId)
  const dispatch = useGameStore((s) => s.dispatch)
  const openOverlay = useGameStore((s) => s.openOverlay)
  const stillActive = useGameStore((s) => s.state.decisions.active?.cardId === cardId)
  if (!card || !stillActive) {
    return (
      <OverlayFrame onClose={onClose}>
        <p className="p-6 text-sm text-ink-600">{t('decision.expired')}</p>
      </OverlayFrame>
    )
  }
  return (
    <OverlayFrame onClose={onClose} wide>
      <div className="p-5 pr-14 sm:p-6 sm:pr-14">
        <DecisionCardView
          card={card}
          onChoose={(optionIndex) => {
            const r = dispatch({ type: 'answerDecision', cardId, optionIndex })
            if (r.ok) openOverlay({ kind: 'reflection', cardId, optionIndex })
          }}
        />
      </div>
    </OverlayFrame>
  )
}

export function ReflectionOverlay({ cardId, optionIndex, onClose }: { cardId: DecisionCardId; optionIndex: number; onClose: () => void }) {
  const card = decisionById(cardId)
  return (
    <OverlayFrame onClose={onClose}>
      <div className="p-5 pr-14">{card ? <ReflectionView card={card} optionIndex={optionIndex} onClose={onClose} /> : null}</div>
    </OverlayFrame>
  )
}

// ---------------------------------------------------------------------------
// Round
// ---------------------------------------------------------------------------

export function RoundOverlay({ onClose }: { onClose: () => void }) {
  const s = useGameStore(
    useShallow((st) => ({
      stage: st.state.stage,
      round: st.state.round,
      canStart: st.state.derived.canStartRound,
      valuation: st.state.finance.valuation,
      equity: st.state.stats.equity,
      runway: st.state.finance.runway,
    })),
  )
  const dispatch = useGameStore((st) => st.dispatch)
  const next = STAGES[s.stage + 1]
  const active = s.round?.active ? s.round : undefined

  return (
    <OverlayFrame onClose={onClose}>
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <header className="flex items-center gap-3 pr-10">
          <span className="grid size-11 place-items-center rounded-full bg-lilac-100 text-lilac-500">
            <Icon name={active ? 'timer' : 'rocket'} size={22} />
          </span>
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">{active ? t('round.activeTitle') : t('round.confirmTitle', { stage: next?.name ?? '' })}</h2>
            <p className="text-xs text-ink-600">{active ? t('round.activeSub') : t('round.confirmSub')}</p>
          </div>
        </header>

        {active ? (
          <>
            <div>
              <div className="mb-1 flex justify-between text-xs font-semibold text-ink-600">
                <span>{t('round.progress')}</span>
                <span className="tabular">{t('round.weeks', { done: fixed(Math.max(0, active.weeksTotal - active.weeksLeft), 0), total: fixed(active.weeksTotal, 0) })}</span>
              </div>
              <Bar value={active.weeksTotal > 0 ? 1 - active.weeksLeft / active.weeksTotal : 0} height={10} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stat label={t('round.amount')} value={money(active.offer.amount)} />
              <Stat label={t('round.equitySold')} value={pct(active.offer.equity, 1)} />
              <Stat label={t('round.preMoney')} value={money(active.offer.preMoney)} />
            </div>
            <p className="rounded-2xl bg-lemon-100 px-3 py-2 text-xs text-ink-700">{t('round.coffeeHint')}</p>
            <Button tone="primary" onClick={onClose}>
              {t('common.ok')}
            </Button>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Stat label={t('round.amount')} value={money(next?.roundAmount ?? 0)} />
              <Stat label={t('round.equitySold')} value={pct(next?.roundEquity ?? 0)} />
              <Stat label={t('round.valuationNow')} value={money(s.valuation)} />
              <Stat label={t('round.yourEquity')} value={pct(s.equity, 1)} />
            </div>
            <ul className="flex flex-col gap-1.5 text-xs text-ink-700">
              <li className="flex gap-2">
                <Icon name="timer" size={14} className="mt-px shrink-0 text-lilac-500" />
                {t('round.takesWeeks')}
              </li>
              <li className="flex gap-2">
                <Icon name="trend" size={14} className="mt-px shrink-0 text-lilac-500" />
                {t('round.metricsMatter')}
              </li>
              {s.runway !== null && (
                <li className="flex gap-2">
                  <Icon name="hourglass" size={14} className="mt-px shrink-0 text-lilac-500" />
                  {t('round.runwayNow', { v: fixed(s.runway, 1) })}
                </li>
              )}
            </ul>
            <div className="grid grid-cols-2 gap-2">
              <Button tone="ghost" onClick={onClose}>
                {t('common.later')}
              </Button>
              <Button
                tone="primary"
                icon="rocket"
                disabled={!s.canStart}
                onClick={() => {
                  const r = dispatch({ type: 'startRound' })
                  if (r.ok) onClose()
                }}
              >
                {t('round.start')}
              </Button>
            </div>
          </>
        )}
      </div>
    </OverlayFrame>
  )
}

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
  const [open, setOpen] = useState<ConceptId | null>(null)
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
        <p className="text-center text-xs italic text-ink-600">{t('pm.failureIsData')}</p>
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

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const SHORTCUTS: [string, string][] = [
  ['Space', 'shortcut.pause'],
  ['1 / 2 / 3', 'shortcut.speed'],
  ['M · E · P · B · D', 'shortcut.tabs'],
  ['Esc', 'shortcut.escape'],
  ['+ / −', 'shortcut.zoom'],
]

export function SettingsOverlay({ onClose }: { onClose: () => void }) {
  const prefs = usePrefs()
  const zoom = useGameStore((s) => s.ui.zoom)
  const setZoom = useGameStore((s) => s.setZoom)
  const save = useGameStore((s) => s.save)
  const load = useGameStore((s) => s.load)
  const [note, setNote] = useState<string | null>(null)
  const [confirmNew, setConfirmNew] = useState(false)

  return (
    <OverlayFrame onClose={onClose}>
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <h2 className="pr-10 text-lg font-extrabold tracking-tight">{t('settings.title')}</h2>

        <SettingRow icon="globe" label={t('settings.language')}>
          <div className="flex rounded-full bg-cream-200 p-0.5 text-xs font-bold">
            <span className="rounded-full bg-ink-900 px-3 py-1.5 text-cream-50">TR</span>
            <span className="px-3 py-1.5 text-ink-400" title={t('view.languageSoon')}>
              EN
            </span>
          </div>
        </SettingRow>
        <SettingRow icon={prefs.sound ? 'sound' : 'mute'} label={t('settings.sound')}>
          <Toggle on={prefs.sound} onChange={(v) => prefs.setPref('sound', v)} label={t('settings.sound')} />
        </SettingRow>
        <SettingRow icon="chat" label={t('settings.screenBubbles')}>
          <Toggle on={prefs.screenBubbles} onChange={(v) => prefs.setPref('screenBubbles', v)} label={t('settings.screenBubbles')} />
        </SettingRow>
        <SettingRow icon="zoomIn" label={t('settings.zoom')}>
          <div className="flex rounded-full bg-cream-200 p-0.5">
            {([0, 1, 2] as ZoomLevel[]).map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setZoom(z)}
                aria-pressed={zoom === z}
                className={cx('min-h-9 min-w-11 rounded-full px-2 text-xs font-bold', zoom === z ? 'bg-ink-900 text-cream-50' : 'text-ink-700')}
              >
                {t(`zoom.${z}`)}
              </button>
            ))}
          </div>
        </SettingRow>

        <div className="grid grid-cols-2 gap-2">
          <Button
            icon="save"
            onClick={() => {
              save()
              setNote(t('settings.saved'))
            }}
          >
            {t('settings.save')}
          </Button>
          <Button
            icon="refresh"
            onClick={() => {
              useModalQueue.getState().clear()
              setNote(load() ? t('settings.loaded') : t('settings.noSave'))
            }}
          >
            {t('settings.load')}
          </Button>
          <Button
            className="col-span-2"
            tone={confirmNew ? 'danger' : 'ghost'}
            icon={confirmNew ? 'warning' : 'plus'}
            onClick={() => {
              if (!confirmNew) return setConfirmNew(true)
              const { state, newGame } = useGameStore.getState()
              useModalQueue.getState().clear()
              newGame({ seed: Math.floor(Math.random() * 2 ** 31), founderXp: state.meta.founderXp, runIndex: state.meta.runIndex + 1 })
            }}
          >
            {confirmNew ? t('settings.newGameConfirm') : t('settings.newGame')}
          </Button>
        </div>
        {note && <p className="text-center text-xs font-semibold text-mint-600">{note}</p>}

        <div className="hidden md:block">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-600">{t('settings.shortcuts')}</h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
            {SHORTCUTS.map(([k, label]) => (
              <div key={k} className="contents">
                <dt>
                  <kbd className="rounded-md bg-cream-200 px-1.5 py-0.5 font-bold">{k}</kbd>
                </dt>
                <dd className="text-ink-700">{t(label)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </OverlayFrame>
  )
}

function SettingRow({ icon, label, children }: { icon: IconName; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <Icon name={icon} size={18} className="shrink-0 text-ink-600" />
      <span className="flex-1 text-sm font-semibold">{label}</span>
      {children}
    </div>
  )
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cx('relative h-7 w-12 shrink-0 rounded-full transition-colors', on ? 'bg-mint-600' : 'bg-cream-300')}
    >
      <span className={cx('absolute top-0.5 size-6 rounded-full bg-cream-50 shadow transition-transform', on ? 'translate-x-5.5' : 'translate-x-0.5')} />
    </button>
  )
}
