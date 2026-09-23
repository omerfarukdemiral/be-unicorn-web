// App shell: 3D office (render) under the HTML game layer (ui), plus the start screen.
// Before a run starts, the canvas shows the garage behind the title card and the loop is stopped.
import { useEffect, useMemo, useState } from 'react'
import { STAGES } from './content'
import { balance } from './engine'
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

function StartScreen({ onStart }: { onStart: () => void }) {
  const profile = useMemo(readProfile, [])
  const saved = useMemo(readSave, [])
  const canContinue = !!saved && !saved.gameOver
  const xp = profile.founderXp
  const bonus = Math.round(100 * Math.min(balance.XP_BONUS_CAP, balance.XP_BONUS_PER_XP * xp))

  const title = splitTitle(t('start.title'))

  const start = (resume: boolean) => {
    const store = useGameStore.getState()
    if (!(resume && store.load({ resume: true }))) store.newGame()
    onStart()
  }

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-canvas-bg/55 p-4 backdrop-blur-[2px] safe-top safe-bottom safe-x">
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

        <div className="mt-6 flex flex-col gap-2">
          {canContinue && saved && (
            <Button tone="primary" icon="play" onClick={() => start(true)} className="w-full py-2">
              <span className="flex flex-col items-start leading-tight">
                <span>{t('start.continue')}</span>
                <span className="tabular text-[11px] font-medium opacity-70">
                  {t('start.continueSub', { stage: STAGES[saved.stage]?.name ?? '', day: Math.floor(saved.time.day) + 1 })}
                </span>
              </span>
            </Button>
          )}
          <Button tone={canContinue ? 'secondary' : 'primary'} icon="rocket" onClick={() => start(false)} className="w-full">
            {t('start.new')}
          </Button>
        </div>

        <div className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-xs text-ink-2">
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
      </div>
    </div>
  )
}

export default function App() {
  const mock = useMemo(wantsMock, [])
  const [started, setStarted] = useState(mock)
  const ambient = usePrefs((p) => p.screenBubbles)

  useEffect(() => {
    if (!started || mock) return
    return startLoop()
  }, [started, mock])

  return (
    <div className="relative h-full w-full overflow-hidden bg-canvas-bg">
      <GameCanvas renderBubble={started ? renderWorldBubble : () => null} ambientBubbles={ambient} />
      {started ? (
        <GameUI worldBubbles mock={mock} renderPreview={(target) => <ObjectPreview target={target} />} />
      ) : (
        <StartScreen onStart={() => setStarted(true)} />
      )}
    </div>
  )
}
