// App shell: 3D office (render) under the HTML game layer (ui), plus the title screen.
// Before a run starts, the canvas shows the garage behind the title screen and the loop is stopped.
// Start card phases (net/cloud): boot (probe the backend + resume the token) → login (e-posta + PIN, or play
// offline) → ready (Devam et / Yeni oyun). Without a backend the card goes straight to ready, local save only.
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
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
import { Button, IconBadge, IconButton } from './ui/primitives'
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

/**
 * The title screen: a light-fall over the live garage (no veil, no blur), the logo medallion and the big title set
 * straight on the scene, then the phase's one menu plate, then an optional strip under it (account + XP).
 */
function StartShell({ children, strip }: { children: ReactNode; strip?: ReactNode }) {
  const title = splitTitle(t('start.title'))
  return (
    // Light falls from the column's side (bottom on phones) and holds 92% canvas behind the text before it fades,
    // so the title and tagline keep AA over any garage pixel while the right/top of the scene stays fully lit. On wide
    // screens it eases out over ~500px (92 → 60 → 25 → 0%): one straight fade read as a wash with a seam on the wall.
    // Safe-area padding sits on the scroller and the gutter on the inner box: .safe-* is unlayered and would beat p-*.
    <div
      className="absolute inset-0 z-50 overflow-y-auto bg-[linear-gradient(0deg,var(--fall)_0,var(--fall)_45%,transparent_80%)] text-ink safe-top safe-bottom safe-x sm:bg-[linear-gradient(90deg,var(--fall)_0,var(--fall)_440px,var(--fall-mid)_600px,var(--fall-low)_780px,transparent_max(70%,960px))]"
      style={
        {
          '--fall': 'color-mix(in oklab, var(--color-canvas-bg) 92%, transparent)',
          '--fall-mid': 'color-mix(in oklab, var(--color-canvas-bg) 60%, transparent)',
          '--fall-low': 'color-mix(in oklab, var(--color-canvas-bg) 25%, transparent)',
        } as CSSProperties
      }
    >
      {/* mt-auto / my-auto instead of items-end / items-center: an auto margin never pushes a tall column (register
          mode on a short phone) past the scroller's reachable top. */}
      <div className="flex min-h-full flex-col p-4 sm:p-10">
        <div className="mt-auto flex w-full max-w-sm animate-deal flex-col gap-4 max-sm:mx-auto sm:my-auto">
          <span className="ui-medallion">
            <IconBadge icon="unicorn" size={36} color="var(--color-brand)" />
          </span>
          <div>
            {/* Title: Nunito, uppercase, tight; the second word carries the weight. */}
            <h1 lang="en" aria-label={t('start.title')} className="text-[40px] font-medium uppercase leading-[0.9] tracking-[-0.02em] text-ink sm:text-[48px]">
              {title.head && <span className="block text-ink-2">{title.head}</span>}
              <span className="block font-extrabold text-brand-ink">{title.tail}</span>
            </h1>
            <p className="font-text mt-2 text-sm font-medium leading-snug text-ink">{t('start.tagline')}</p>
          </div>
          {/* The one surface: the phase's menu plate. */}
          <div className="ui-card p-4 shadow-pop">{children}</div>
          {strip}
        </div>
      </div>
    </div>
  )
}

function BootCard() {
  return (
    <StartShell>
      <span className="flex items-center gap-2 text-[13px] font-bold text-ink-2">
        <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-brand" />
        {t('login.checking')}
      </span>
    </StartShell>
  )
}

/** Who is playing: e-mail + Çıkış, or the offline mark (its sentence moves to the tooltip: one sentence on screen). */
function AccountRow() {
  const account = useCloud((s) => s.account)
  const backend = useCloud((s) => s.backend)
  const [busy, setBusy] = useState(false)
  if (account) {
    return (
      <div className="flex min-h-10 min-w-0 items-center gap-2">
        <Icon name="mail" size={16} className="shrink-0 text-ink-2" />
        <span className="min-w-0 flex-1 truncate font-bold text-ink" title={account.email}>
          {t('start.signedAs', { v: account.email })}
        </span>
        <IconButton
          icon="logout"
          label={t('start.signOut')}
          size={40}
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void signOut()
          }}
        />
      </div>
    )
  }
  return (
    <div className="flex min-h-10 items-center gap-2" title={backend === 'offline' ? t('start.offlineHint') : t('login.offlineNote')}>
      <Icon name="cloud" size={16} className="shrink-0 text-ink-2" />
      <span className="font-bold text-ink">{t('start.offlineBadge')}</span>
    </div>
  )
}

/** Under the menu plate, on the light-fall: who is playing, then the founder XP carried between runs. */
function StartStrip({ xp, bonus }: { xp: number; bonus: number }) {
  return (
    <div className="flex flex-col px-1 text-[13px]" title={t('start.hint')}>
      <AccountRow />
      <div className="flex min-h-8 min-w-0 items-center gap-2">
        <Icon name="star" size={16} fill="currentColor" className="shrink-0 text-g-equity" />
        {xp > 0 ? (
          <>
            <span className="tabular font-extrabold text-ink">{t('start.xp', { v: xp })}</span>
            <span className="tabular ml-auto font-bold text-positive-ink">{t('start.xpBonus', { v: bonus })}</span>
          </>
        ) : (
          <span className="font-bold text-ink-2">{t('start.noXp')}</span>
        )}
      </div>
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
    <StartShell strip={<StartStrip xp={xp} bonus={bonus} />}>
      {naming ? (
        <div className="flex flex-col gap-2">
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
          <Button tone="commit" icon="rocket" onClick={startNew} className="w-full">
            {t('start.go')}
          </Button>
          {canContinue && (
            <Button tone="ghost" onClick={() => setNaming(false)} className="w-full">
              {t('start.back')}
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {canContinue && saved && (
            <Button tone="commit" icon="play" onClick={resume} className="w-full py-2">
              <span className="flex min-w-0 flex-col items-start leading-tight">
                <span>{t('start.continue')}</span>
                <span className="tabular max-w-full truncate text-[12px] font-bold opacity-90">
                  {saved.meta.companyName ? `${saved.meta.companyName} · ` : ''}
                  {t('start.continueSub', { stage: STAGES[saved.stage]?.name ?? '', day: Math.floor(saved.time.day) + 1 })}
                </span>
              </span>
            </Button>
          )}
          {canContinue && cloudLoaded && (
            <span className="flex items-center gap-1 text-[12px] font-bold text-positive-ink">
              <Icon name="cloud" size={14} />
              {t('start.cloudLoaded')}
            </span>
          )}
          {/* Only a menu key when there is something to continue; with nothing saved it is the run's one answer. */}
          <Button tone={canContinue ? 'routine' : 'commit'} size="md" icon="rocket" onClick={() => setNaming(true)} className="w-full">
            {t('start.new')}
          </Button>
        </div>
      )}
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
