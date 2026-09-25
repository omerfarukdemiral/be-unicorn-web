// Ayarlar › Hesap: who is signed in, the cloud save's state, "Şimdi buluta yaz", Çıkış yap (two-step), and the
// save conflict choice when another device got further. Offline play shows one line and a sign-in button.
import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { STAGES } from '../../content'
import { keepLocalSave, saveNow, signOut, takeCloudSave, useCloud } from '../../net/cloud'
import { useGameStore } from '../../store/gameStore'
import { Icon } from '../icons'
import { t } from '../i18n'
import { Button, cx } from '../primitives'
import { useModalQueue } from '../modalQueue'

function agoText(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000))
  if (s < 5) return t('account.justNow')
  if (s < 60) return t('account.agoS', { v: s })
  return t('account.agoM', { v: Math.round(s / 60) })
}

export function AccountSection() {
  const c = useCloud(useShallow((s) => ({ backend: s.backend, account: s.account, sync: s.sync, lastSyncAt: s.lastSyncAt, conflict: s.conflict })))
  const [confirmOut, setConfirmOut] = useState(false)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(id)
  }, [])

  if (!c.account) {
    return (
      <section className="flex flex-col gap-2 rounded-card border border-border bg-surface-2/60 p-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Icon name="cloud" size={18} className="shrink-0 text-ink-2" />
          {t('account.title')}
        </div>
        <p className="font-text text-xs text-ink-2">{t('account.offline')}</p>
        {c.backend === 'online' && (
          <Button
            size="sm"
            tone="primary"
            icon="mail"
            onClick={() => {
              useGameStore.getState().save()
              window.location.reload()
            }}
          >
            {t('account.signIn')}
          </Button>
        )}
      </section>
    )
  }

  const status =
    c.sync === 'saving'
      ? t('account.cloudSaving')
      : c.sync === 'offline'
        ? t('account.cloudOffline')
        : c.sync === 'signedOut'
          ? t('account.cloudSignedOut')
          : c.lastSyncAt
            ? t('account.cloudOk', { v: agoText(c.lastSyncAt, now) })
            : t('account.cloudNever')

  return (
    <section className="flex flex-col gap-2 rounded-card border border-border bg-surface-2/60 p-3">
      <div className="flex min-w-0 items-center gap-2">
        <Icon name="mail" size={18} className="shrink-0 text-ink-2" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={c.account.email}>
          {c.account.email}
        </span>
      </div>
      <p className={cx('font-text flex items-center gap-1 text-xs', c.sync === 'offline' || c.sync === 'signedOut' ? 'text-negative-ink' : 'text-ink-2')}>
        <Icon name="cloud" size={12} className="shrink-0" />
        {status}
      </p>

      {c.conflict && (
        <div className="flex flex-col gap-2 rounded-control border border-g-runway/40 bg-surface p-2">
          <p className="font-text text-xs text-ink">
            {t('account.conflict', { stage: STAGES[c.conflict.stage]?.name ?? '', day: Math.floor(c.conflict.day) + 1 })}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              tone="primary"
              onClick={() => {
                useModalQueue.getState().clear()
                takeCloudSave()
              }}
            >
              {t('account.takeCloud')}
            </Button>
            <Button size="sm" onClick={() => void keepLocalSave()}>
              {t('account.keepLocal')}
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" icon="cloud" disabled={c.sync === 'saving' || !!c.conflict} onClick={() => void saveNow({ force: false })}>
          {t('account.syncNow')}
        </Button>
        <Button
          size="sm"
          tone={confirmOut ? 'danger' : 'ghost'}
          icon="logout"
          disabled={busy}
          onClick={() => {
            if (!confirmOut) return setConfirmOut(true)
            setBusy(true)
            void signOut()
          }}
        >
          {confirmOut ? t('account.signOutConfirm') : t('account.signOut')}
        </Button>
        {confirmOut && (
          <Button
            size="sm"
            tone="ghost"
            disabled={busy}
            className="col-span-2"
            onClick={() => {
              setBusy(true)
              void signOut({ everywhere: true })
            }}
          >
            {t('account.signOutAll')}
          </Button>
        )}
      </div>
    </section>
  )
}
