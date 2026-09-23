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

function wantsMock(): boolean {
  try {
    return import.meta.env.DEV && new URLSearchParams(window.location.search).has('mock')
  } catch {
    return false
  }
}

function StartScreen({ onStart }: { onStart: () => void }) {
  const profile = useMemo(readProfile, [])
  const saved = useMemo(readSave, [])
  const canContinue = !!saved && !saved.gameOver
  const xp = profile.founderXp
  const bonus = Math.round(100 * Math.min(balance.XP_BONUS_CAP, balance.XP_BONUS_PER_XP * xp))

  const start = (resume: boolean) => {
    const store = useGameStore.getState()
    if (!(resume && store.load())) store.newGame()
    onStart()
  }

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-cream-100/55 p-4 backdrop-blur-[2px] safe-top safe-bottom safe-x">
      <div className="w-full max-w-sm animate-pop-in rounded-[var(--radius-card)] bg-cream-50/95 p-6 text-center text-ink-900 shadow-[var(--shadow-pop)]">
        <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-lilac-100 text-lilac-500">
          <Icon name="unicorn" size={32} />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">{t('start.title')}</h1>
        <p className="mt-2 text-sm leading-snug text-ink-600">{t('start.tagline')}</p>

        <div className="mt-5 flex flex-col gap-2">
          {canContinue && saved && (
            <Button tone="primary" icon="play" onClick={() => start(true)} className="w-full">
              <span className="flex flex-col items-start leading-tight">
                <span>{t('start.continue')}</span>
                <span className="text-[11px] font-medium opacity-75">
                  {t('start.continueSub', { stage: STAGES[saved.stage]?.name ?? '', day: Math.floor(saved.time.day) + 1 })}
                </span>
              </span>
            </Button>
          )}
          <Button tone={canContinue ? 'soft' : 'primary'} icon="rocket" onClick={() => start(false)} className="w-full">
            {t('start.new')}
          </Button>
        </div>

        <div className="mt-5 rounded-2xl bg-cream-100 px-3 py-2 text-xs text-ink-700">
          {xp > 0 ? (
            <>
              <span className="inline-flex items-center gap-1 font-bold">
                <Icon name="star" size={14} className="text-lemon-600" />
                {t('start.xp', { v: xp })}
              </span>
              <span className="ml-2">{t('start.xpBonus', { v: bonus })}</span>
            </>
          ) : (
            t('start.noXp')
          )}
        </div>
        <p className="mt-3 text-[11px] text-ink-400">{t('start.hint')}</p>
      </div>
    </div>
  )
}

export default function App() {
  const mock = useMemo(wantsMock, [])
  const [started, setStarted] = useState(mock)

  useEffect(() => {
    if (!started || mock) return
    return startLoop()
  }, [started, mock])

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream-100">
      <GameCanvas renderBubble={started ? renderWorldBubble : () => null} />
      {started ? (
        <GameUI worldBubbles mock={mock} renderPreview={(target) => <ObjectPreview target={target} />} />
      ) : (
        <StartScreen onStart={() => setStarted(true)} />
      )}
    </div>
  )
}
