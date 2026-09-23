// Settings inside the single panel: language, bubbles, zoom, save/load/new game, shortcuts.
import { useState, type ReactNode } from 'react'
import { useGameStore } from '../../store/gameStore'
import type { ZoomLevel } from '../../store/types'
import { Icon, type IconName } from '../icons'
import { t } from '../i18n'
import { Button, cx } from '../primitives'
import { usePrefs } from '../hooks'
import { useModalQueue } from '../modalQueue'


const SHORTCUTS: [string, string][] = [
  ['Space', 'shortcut.pause'],
  ['1 / 2 / 3', 'shortcut.speed'],
  ['M · E · P · B · D', 'shortcut.tabs'],
  ['Esc', 'shortcut.escape'],
  ['+ / −', 'shortcut.zoom'],
]

/** Settings as panel content (was a modal). */
export function SettingsPanel() {
  const prefs = usePrefs()
  const zoom = useGameStore((s) => s.ui.zoom)
  const setZoom = useGameStore((s) => s.setZoom)
  const save = useGameStore((s) => s.save)
  const load = useGameStore((s) => s.load)
  const [note, setNote] = useState<string | null>(null)
  const [confirmNew, setConfirmNew] = useState(false)

  return (
      <div className="flex flex-col gap-5">

        <SettingRow icon="globe" label={t('settings.language')}>
          <div className="flex rounded-full bg-cream-200 p-0.5 text-xs font-bold">
            <span className="rounded-full bg-ink-900 px-3 py-1.5 text-cream-50">TR</span>
            <span className="px-3 py-1.5 text-ink-400" title={t('view.languageSoon')}>
              EN
            </span>
          </div>
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
                className={cx('min-h-9 min-w-11 rounded-full px-2 text-xs font-bold max-md:min-h-11', zoom === z ? 'bg-ink-900 text-cream-50' : 'text-ink-700')}
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
      // Invisible 44px hit area around the 28px track.
      className={cx("relative h-7 w-12 shrink-0 rounded-full transition-colors before:absolute before:-inset-2 before:content-['']", on ? 'bg-mint-600' : 'bg-cream-300')}
    >
      <span className={cx('absolute top-0.5 size-6 rounded-full bg-cream-50 shadow transition-transform', on ? 'translate-x-5.5' : 'translate-x-0.5')} />
    </button>
  )
}
