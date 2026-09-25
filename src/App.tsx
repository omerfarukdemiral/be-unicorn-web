// App shell: 3D office (render) under the HTML game layer (ui), plus the start card.
// Before a run starts, the canvas shows the garage behind the title card and the loop is stopped.
// Start card phases (net/cloud): boot (probe the backend + resume the token) → login (e-posta + PIN, or play
// offline) → ready (Devam et / Yeni oyun). Without a backend the card goes straight to ready, local save only.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { STAGES, suggestCompanyName, type CompanyNameIssue } from './content'
import { balance } from './engine'
import type { GameState } from './engine/types'
import { GameCanvas } from './render/GameCanvas'
import { ObjectPreview } from './render/ObjectPreview'
import { startLoop } from './store/loop'
import { useGameStore } from './store/gameStore'
import { readProfile, readSave } from './store/save'
import { GameUI } from './ui/GameUI'
import { renderWorldBubble } from './ui/bubbles'
import { Icon } from './ui/icons'
import { t } from './ui/i18n'
import { Button } from './ui/primitives'
import { usePrefs } from './ui/hooks'
import { CompanyNameField, liveIssue, resolveCompanyName } from './ui/start/CompanyNameField'
import { LoginCard, type AuthKind } from './ui/start/LoginCard'
import { afterAuth, bootCloud, playOffline, setRunOnScreen, signOut, startCloudSync, useCloud } from './net/cloud'
import type { AuthOk } from './net/api'

function wantsMock(): boolean {
  try {
    return import.meta.env.DEV && new URLSearchParams(window.location.search).has('mock')
  } catch {
    return false
  }
}

/** "Be Unicorn" → light first word(s) + heavy last word. */
function splitTitle(s: string): { head: string; tail: string } {
  const i = s.trim().lastIndexOf(' ')
  return i < 0 ? { head: '', tail: s } : { head: s.slice(0, i), tail: s.slice(i + 1) }
}

/**
 * Run index for a new game from the start card: past the profile, the abandoned local save and the cloud save seen
 * at sign-in (the leaderboard refuses an older run index as stale).
 */
function nextRunIndex(saved: GameState | null): number {
  const cloudRun = useCloud.getState().cloudRunIndex
  return Math.max(readProfile().runIndex, saved ? saved.meta.runIndex + 1 : 0, cloudRun >= 0 ? cloudRun + 1 : 0)
}

/** The start card frame: logo, title, tagline, then the phase's content. */
function StartShell({ children }: { children: ReactNode }) {
  const title = splitTitle(t('start.title'))
  return (
    <div className="absolute inset-0 z-50 grid place-items-center overflow-y-auto bg-canvas-bg/55 p-4 backdrop-blur-[2px] safe-top safe-bottom safe-x">
      <div className="w-full max-w-sm animate-pop-in rounded-card border border-border bg-surface/95 p-6 text-ink shadow-pop">
        <span className="grid size-10 place-items-center rounded-control bg-brand text-on-ink shadow-[0_6px_16px_-6px_var(--color-brand)]">
          <Icon name="unicorn" size={24} />
        </span>
        {/* Title: Oxanium, uppercase, tight; the second word carries the weight. */}
        <h1 lang="en" aria-label={t('start.title')} className="mt-5 text-[40px] font-medium uppercase leading-[0.9] tracking-[-0.02em] text-ink">
          {title.head && <span className="block text-ink-2">{title.head}</span>}
          <span className="block font-bold text-brand-ink">{title.tail}</span>
        </h1>
        <p className="font-text mt-3 text-sm leading-snug text-ink-2">{t('start.tagline')}</p>
        {children}
      </div>
    </div>
  )
}

function BootCard() {
  return (
    <StartShell>
      <p className="font-text mt-6 flex items-center gap-2 text-xs text-ink-2">
        <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-brand" />
        {t('login.checking')}
      </p>
    </StartShell>
  )
}

/** Who is playing: e-mail + Çıkış, or the offline badge. */
function AccountRow() {
  const account = useCloud((s) => s.account)
  const backend = useCloud((s) => s.backend)
  const [busy, setBusy] = useState(false)
  if (account) {
    return (
      <div className="mt-4 flex min-w-0 items-center gap-2 text-xs text-ink-2">
        <Icon name="mail" size={14} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate font-semibold text-ink" title={account.email}>
          {t('start.signedAs', { v: account.email })}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void signOut()
          }}
          className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-control px-2 font-semibold text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink max-md:min-h-11"
        >
          <Icon name="logout" size={14} />
          {t('start.signOut')}
        </button>
      </div>
    )
  }
  return (
    <div className="mt-4 flex items-center gap-2 text-xs text-ink-2">
      <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-px text-[11px] font-semibold">
        <Icon name="cloud" size={12} />
        {t('start.offlineBadge')}
      </span>
      <span className="font-text">{backend === 'offline' ? t('start.offlineHint') : t('login.offlineNote')}</span>
    </div>
  )
}

function StartScreen({ onStart }: { onStart: () => void }) {
  const profile = useMemo(readProfile, [])
  const saved = useMemo(readSave, [])
  const account = useCloud((s) => s.account)
  const cloudLoaded = useCloud((s) => s.cloudLoaded)
  const canContinue = !!saved && !saved.gameOver
  const xp = profile.founderXp
  const bonus = Math.round(100 * Math.min(balance.XP_BONUS_CAP, balance.XP_BONUS_PER_XP * xp))

  // "Yeni oyun" asks for the startup name first (straight away when there is nothing to continue).
  // Signed in: the account's company name is the default.
  const [naming, setNaming] = useState(!canContinue)
  const [company, setCompany] = useState(() => account?.companyName ?? '')
  const [suggestion, setSuggestion] = useState(() => suggestCompanyName())
  const [submitIssue, setSubmitIssue] = useState<CompanyNameIssue | null>(null)
  const issue = submitIssue ?? liveIssue(company)

  const resume = () => {
    // Starts paused: the scene shows a Başlat call and time waits for the player.
    if (!useGameStore.getState().load()) {
      setNaming(true)
      return
    }
    onStart()
  }

  const startNew = () => {
    const res = resolveCompanyName(company, suggestion)
    if ('issue' in res) {
      setSubmitIssue(res.issue)
      return
    }
    useGameStore.getState().newGame({ companyName: res.name, runIndex: nextRunIndex(saved) })
    onStart()
  }

  return (
    <StartShell>
      {naming ? (
        <div className="mt-6 flex flex-col gap-2">
          <CompanyNameField
            value={company}
            onChange={(v) => {
              setCompany(v)
              setSubmitIssue(null)
            }}
            suggestion={suggestion}
            onSuggest={(next) => {
              setSuggestion(next)
              setCompany(next)
              setSubmitIssue(null)
            }}
            issue={issue}
            onSubmit={startNew}
            autoFocus
          />
          <Button tone="primary" icon="rocket" onClick={startNew} className="w-full">
            {t('start.go')}
          </Button>
          {canContinue && (
            <Button tone="ghost" onClick={() => setNaming(false)} className="w-full">
              {t('start.back')}
            </Button>
          )}
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {canContinue && saved && (
            <Button tone="primary" icon="play" onClick={resume} className="w-full py-2">
              <span className="flex min-w-0 flex-col items-start leading-tight">
                <span>{t('start.continue')}</span>
                <span className="tabular max-w-full truncate text-[11px] font-medium opacity-70">
                  {saved.meta.companyName ? `${saved.meta.companyName} · ` : ''}
                  {t('start.continueSub', { stage: STAGES[saved.stage]?.name ?? '', day: Math.floor(saved.time.day) + 1 })}
                </span>
              </span>
            </Button>
          )}
          {canContinue && cloudLoaded && (
            <p className="font-text flex items-center gap-1 text-[11px] text-positive-ink">
              <Icon name="cloud" size={12} />
              {t('start.cloudLoaded')}
            </p>
          )}
          <Button tone={canContinue ? 'secondary' : 'primary'} icon="rocket" onClick={() => setNaming(true)} className="w-full">
            {t('start.new')}
          </Button>
        </div>
      )}

      <AccountRow />

      <div className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-xs text-ink-2">
        {xp > 0 ? (
          <>
            <Icon name="star" size={14} fill="currentColor" className="shrink-0 text-g-equity" />
            <span className="tabular font-semibold text-ink">{t('start.xp', { v: xp })}</span>
            <span className="tabular ml-auto text-positive-ink">{t('start.xpBonus', { v: bonus })}</span>
          </>
        ) : (
          <span className="font-text">{t('start.noXp')}</span>
        )}
      </div>
      <p className="font-text mt-3 text-[11px] text-ink-2">{t('start.hint')}</p>
    </StartShell>
  )
}

/** Signed in on the card: a new company starts right away (unless offline progress waits to be continued). */
async function onAuthed(a: AuthOk, kind: AuthKind, companyName: string | undefined, onStart: () => void): Promise<void> {
  await afterAuth(a)
  if (kind !== 'register') return
  const saved = readSave()
  if (saved && !saved.gameOver) return
  useGameStore.getState().newGame({ companyName: companyName ?? a.companyName, runIndex: nextRunIndex(saved) })
  onStart()
}

export default function App() {
  const mock = useMemo(wantsMock, [])
  const [started, setStarted] = useState(mock)
  const ambient = usePrefs((p) => p.screenBubbles)
  const phase = useCloud((s) => s.phase)
  const backend = useCloud((s) => s.backend)

  useEffect(() => {
    if (mock) playOffline()
    else void bootCloud()
  }, [mock])

  useEffect(() => {
    if (!started || mock) return
    setRunOnScreen(true)
    const stop = startLoop()
    return () => {
      setRunOnScreen(false)
      stop()
    }
  }, [started, mock])

  // Cloud save + leaderboard submit/poll while a run is on screen (no-ops without an account).
  useEffect(() => {
    if (!started || mock || backend !== 'online') return
    return startCloudSync()
  }, [started, mock, backend])

  const start = () => setStarted(true)
  let card: ReactNode = null
  if (!started) {
    if (phase === 'boot') card = <BootCard />
    else if (phase === 'login')
      card = (
        <StartShell>
          <LoginCard onAuthed={(a, kind, name) => void onAuthed(a, kind, name, start)} onOffline={playOffline} />
        </StartShell>
      )
    else card = <StartScreen onStart={start} />
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-canvas-bg">
      <GameCanvas renderBubble={started ? renderWorldBubble : () => null} ambientBubbles={ambient} />
      {started ? <GameUI worldBubbles mock={mock} renderPreview={(target) => <ObjectPreview target={target} />} /> : card}
    </div>
  )
}
