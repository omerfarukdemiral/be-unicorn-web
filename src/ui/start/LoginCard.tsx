// Sign-in on the start card: e-mail + 4-digit PIN. One form, two modes:
//   login    — e-mail + PIN → /api/auth/login; an unknown e-mail flips to register with the PIN kept.
//   register — e-mail + chosen PIN + PIN again + startup name → /api/auth/register.
// The masked e-mail preview says how the player shows up on the board. "Çevrimdışı oyna" skips it all.
import { useId, useState } from 'react'
import { suggestCompanyName, type CompanyNameIssue } from '../../content'
import { login, register, type AuthOk } from '../../net/api'
import { looksLikeEmail, maskEmail } from '../../net/netText'
import { t } from '../i18n'
import { Button, cx } from '../primitives'
import { CompanyNameField, liveIssue, resolveCompanyName } from './CompanyNameField'

export type AuthKind = 'login' | 'register'

const INPUT =
  'h-11 w-full min-w-0 rounded-control border bg-surface px-3 text-sm font-semibold text-ink outline-none transition-colors placeholder:font-medium placeholder:text-ink-3 focus:border-brand'

function PinInput({
  label,
  value,
  onChange,
  autoComplete,
  onEnter,
  invalid,
  autoFocus,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  autoComplete: string
  onEnter: () => void
  invalid?: boolean
  autoFocus?: boolean
}) {
  const id = useId()
  return (
    <div className="min-w-0 flex-1">
      <label htmlFor={id} className="text-xs font-semibold tracking-wide text-ink-2">
        {label}
      </label>
      <input
        id={id}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        value={value}
        placeholder="••••"
        aria-invalid={invalid}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onEnter()
        }}
        className={cx(INPUT, 'tabular mt-1 tracking-[0.4em]', invalid ? 'border-negative' : 'border-border-strong')}
      />
    </div>
  )
}

export function LoginCard({ onAuthed, onOffline }: { onAuthed: (a: AuthOk, kind: AuthKind, companyName?: string) => void; onOffline: () => void }) {
  const emailId = useId()
  const [mode, setMode] = useState<AuthKind>('login')
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [company, setCompany] = useState('')
  const [suggestion, setSuggestion] = useState(() => suggestCompanyName())
  const [nameIssue, setNameIssue] = useState<CompanyNameIssue | null>(null)
  /** One line under the form: an error (red) or a hint such as "no company yet, let's found one" (neutral). */
  const [msg, setMsg] = useState<{ text: string; tone: 'error' | 'info' } | null>(null)
  const [bad, setBad] = useState<'email' | 'pin' | 'pin2' | null>(null)
  const [busy, setBusy] = useState(false)

  const fail = (text: string, field: typeof bad = null) => {
    setMsg({ text, tone: 'error' })
    setBad(field)
  }

  const submit = async () => {
    if (busy) return
    const e = email.trim()
    if (!looksLikeEmail(e)) return fail(t('login.emailBad'), 'email')
    if (!/^\d{4}$/.test(pin)) return fail(t('login.pinShort'), 'pin')
    if (mode === 'register') {
      if (pin2 !== pin) return fail(t('login.pinMismatch'), 'pin2')
      const res = resolveCompanyName(company, suggestion)
      if ('issue' in res) {
        setNameIssue(res.issue)
        return
      }
      setBusy(true)
      const r = await register(e, pin, res.name)
      setBusy(false)
      if (r.ok) return onAuthed(r.data, 'register', res.name)
      if (r.error === 'emailTaken') {
        setMode('login')
        return setMsg({ text: r.message, tone: 'info' })
      }
      if (r.error === 'invalidCompanyName') return setNameIssue('chars')
      return fail(r.message, r.error === 'invalidEmail' ? 'email' : r.error === 'invalidPin' ? 'pin' : null)
    }
    setBusy(true)
    const r = await login(e, pin)
    setBusy(false)
    if (r.ok) return onAuthed(r.data, 'login')
    if (r.error === 'unknownEmail') {
      setMode('register')
      setBad(null)
      return setMsg({ text: t('login.unknown'), tone: 'info' })
    }
    fail(r.message, r.error === 'invalidEmail' ? 'email' : r.error === 'wrongCredentials' || r.error === 'invalidPin' ? 'pin' : null)
  }

  const onEnter = () => void submit()
  const switchMode = (m: AuthKind) => {
    setMode(m)
    setMsg(null)
    setBad(null)
    setPin2('')
  }
  const masked = looksLikeEmail(email) ? maskEmail(email) : null

  return (
    <form
      className="mt-6 flex flex-col gap-3"
      onSubmit={(ev) => {
        ev.preventDefault()
        void submit()
      }}
      noValidate
    >
      <div>
        <h2 className="text-sm font-semibold tracking-wide text-ink">{t('login.title')}</h2>
        {/* One sentence at a time: in "new company" mode the message below replaces the subtitle. */}
        {!(mode === 'register' && msg) && (
          <p className="font-text mt-0.5 text-xs text-ink-2">{mode === 'login' ? t('login.sub') : t('login.subNew')}</p>
        )}
      </div>

      <div>
        <label htmlFor={emailId} className="text-xs font-semibold tracking-wide text-ink-2">
          {t('login.email')}
        </label>
        <input
          id={emailId}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          value={email}
          placeholder={t('login.emailPlaceholder')}
          aria-invalid={bad === 'email'}
          onChange={(ev) => {
            setEmail(ev.target.value)
            if (bad === 'email') setBad(null)
          }}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter') onEnter()
          }}
          className={cx(INPUT, 'mt-1', bad === 'email' ? 'border-negative' : 'border-border-strong')}
        />
      </div>

      <div className="flex gap-2">
        <PinInput
          label={mode === 'login' ? t('login.pin') : t('login.pinNew')}
          value={pin}
          onChange={(v) => {
            setPin(v)
            if (bad === 'pin') setBad(null)
          }}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          onEnter={onEnter}
          invalid={bad === 'pin'}
        />
        {mode === 'register' && (
          <PinInput
            label={t('login.pinAgain')}
            value={pin2}
            onChange={(v) => {
              setPin2(v)
              if (bad === 'pin2') setBad(null)
            }}
            autoComplete="new-password"
            onEnter={onEnter}
            invalid={bad === 'pin2'}
            autoFocus
          />
        )}
      </div>

      {mode === 'register' && (
        <CompanyNameField
          value={company}
          onChange={(v) => {
            setCompany(v)
            setNameIssue(null)
          }}
          suggestion={suggestion}
          onSuggest={(next) => {
            setSuggestion(next)
            setCompany(next)
            setNameIssue(null)
          }}
          issue={nameIssue ?? liveIssue(company)}
          onSubmit={onEnter}
          quiet
        />
      )}

      {msg && (
        <p role={msg.tone === 'error' ? 'alert' : 'status'} className={cx('font-text text-xs', msg.tone === 'error' ? 'text-negative-ink' : 'text-brand-ink')}>
          {msg.text}
        </p>
      )}

      <Button type="submit" tone="primary" icon={mode === 'login' ? 'play' : 'rocket'} disabled={busy} className="w-full">
        {busy ? t('login.busy') : mode === 'login' ? t('login.go') : t('login.create')}
      </Button>

      {mode === 'register' && (
        <p className="font-text text-[11px] leading-snug text-ink-2">
          {t('login.maskNote', { v: masked ?? 'om***@helio.studio' })}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
          className="min-h-9 text-xs font-semibold text-brand-ink hover:underline max-md:min-h-11"
        >
          {mode === 'login' ? t('login.switchNew') : t('login.switchBack')}
        </button>
        <button
          type="button"
          onClick={onOffline}
          title={t('login.offlineNote')}
          className="min-h-9 text-xs font-medium text-ink-2 hover:text-ink hover:underline max-md:min-h-11"
        >
          {t('login.offline')}
        </button>
      </div>
    </form>
  )
}
