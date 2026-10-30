// Admin panel: the player list on the left, one right panel for the selected player (no popups). Every change goes
// through one server action; the list row is patched from the answer, so nothing reloads the whole list.
import { useCallback, useEffect, useMemo, useState, type ButtonHTMLAttributes, type FormEvent, type ReactNode } from 'react'
import { STAGES } from '../content/stages'
import type { AdminAction, AdminUser, AdminUserDetail } from '../net/contract'
import { adminToken, getUser, getUsers, runAction, signIn, signOut } from './adminApi'

const DAY_MS = 24 * 3600 * 1000

type Note = { text: string; error: boolean }
type Filter = 'all' | 'active' | 'banned'
type Sort = 'recent' | 'newest' | 'valuation'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Hepsi' },
  { key: 'active', label: 'Son 24 saat' },
  { key: 'banned', label: 'Banlı' },
]
const SORTS: { key: Sort; label: string }[] = [
  { key: 'recent', label: 'Son aktivite' },
  { key: 'newest', label: 'Yeni kayıt' },
  { key: 'valuation', label: 'Değerleme' },
]

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 })
const stageName = (stage: number) => STAGES[stage]?.name ?? String(stage)
const date = (ms: number) => new Date(ms).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })

function ago(ms: number): string {
  const min = Math.floor((Date.now() - ms) / 60_000)
  if (min < 1) return 'şimdi'
  if (min < 60) return `${min} dk önce`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours} sa önce`
  return `${Math.floor(hours / 24)} gün önce`
}

const lastActive = (u: AdminUser) => u.board?.updatedAt ?? 0

const inputClass = 'ui-inset font-text h-10 w-full min-w-0 select-text px-3 text-sm text-ink outline-none placeholder:text-ink-3'

function Key({ tone = 'routine', className = '', ...rest }: { tone?: 'routine' | 'commit' | 'danger' } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`ui-key ui-key-${tone} ui-key-sm inline-flex min-h-10 shrink-0 items-center justify-center rounded-control px-3 text-[13px] font-bold disabled:cursor-not-allowed ${className}`}
      {...rest}
    />
  )
}

export function AdminApp() {
  const [signedIn, setSignedIn] = useState(() => adminToken() !== null)
  return signedIn ? <Panel onSignedOut={() => setSignedIn(false)} /> : <SignIn onDone={() => setSignedIn(true)} />
}

function SignIn({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const r = await signIn(password)
    setBusy(false)
    if (r.ok) onDone()
    else setError(r.message)
  }
  return (
    <main className="flex h-dvh items-center justify-center p-4">
      <form onSubmit={(e) => void submit(e)} className="ui-card flex w-full max-w-sm flex-col gap-3 p-5">
        <h1 className="text-lg font-bold">Be Unicorn · Admin</h1>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          aria-label="Şifre"
          placeholder="Şifre"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
        {error && <p role="alert" className="font-text text-xs text-negative-ink">{error}</p>}
        <Key tone="commit" type="submit" disabled={busy || !password}>Gir</Key>
      </form>
    </main>
  )
}

function Panel({ onSignedOut }: { onSignedOut: () => void }) {
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('recent')
  const [selected, setSelected] = useState<string | null>(null)
  // Up here, not in Detail: an e-mail change gives the account a new id (Detail remounts), a delete closes it.
  const [note, setNote] = useState<Note | null>(null)

  const load = useCallback(async () => {
    const r = await getUsers()
    if (r.ok) {
      setUsers(r.data.users)
      setError(null)
    } else if (r.error === 'unauthorized') onSignedOut()
    else setError(r.message)
  }, [onSignedOut])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(() => {
    const list = users ?? []
    const cutoff = Date.now() - DAY_MS
    return [
      { label: 'Oyuncu', value: list.length },
      { label: 'Son 24 saat', value: list.filter((u) => lastActive(u) > cutoff).length },
      { label: 'Unicorn', value: list.filter((u) => u.board?.status === 'unicorn').length },
      { label: 'Banlı', value: list.filter((u) => u.bannedAt).length },
    ]
  }, [users])

  const shown = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr')
    const cutoff = Date.now() - DAY_MS
    const list = (users ?? []).filter((u) => {
      if (filter === 'banned' && !u.bannedAt) return false
      if (filter === 'active' && lastActive(u) <= cutoff) return false
      return !q || u.email.includes(q) || u.companyName.toLocaleLowerCase('tr').includes(q)
    })
    const value: Record<Sort, (u: AdminUser) => number> = {
      recent: lastActive,
      newest: (u) => u.createdAt,
      valuation: (u) => u.board?.valuation ?? -1,
    }
    return list.sort((a, b) => value[sort](b) - value[sort](a))
  }, [users, query, filter, sort])

  const onChanged = (oldId: string, next: AdminUser | null) => {
    setUsers((list) => (list ?? []).flatMap((u) => (u.id !== oldId ? [u] : next ? [next] : [])))
    setSelected(next?.id ?? null)
  }

  return (
    <div className="flex h-dvh flex-col select-text">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 pt-4 pb-3">
        <h1 className="text-lg font-bold">Be Unicorn · Admin</h1>
        <dl className="flex gap-5">
          {stats.map((s) => (
            <div key={s.label} className="flex items-baseline gap-1.5">
              <dd className="ui-num text-lg">{s.value}</dd>
              <dt className="text-xs font-semibold text-ink-2">{s.label}</dt>
            </div>
          ))}
        </dl>
        <div className="ml-auto flex gap-2">
          <Key onClick={() => void load()}>Yenile</Key>
          <Key onClick={() => void signOut().then(onSignedOut)}>Çıkış</Key>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4 md:flex-row">
        <section className="ui-card flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-hairline p-3">
            <input
              type="search"
              aria-label="Oyuncu ara"
              placeholder="Şirket adı ya da e-posta"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={`${inputClass} min-w-48 flex-1`}
            />
            <div className="ui-inset flex p-1">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={`rounded-lg px-2.5 py-1 text-[13px] font-semibold ${filter === f.key ? 'bg-brand-soft text-brand-ink' : 'text-ink-2'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <select aria-label="Sıralama" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="ui-inset h-10 px-2 text-[13px] font-semibold">
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
          {error && <p role="alert" className="font-text p-3 text-sm text-negative-ink">{error}</p>}
          <div className="ui-scroll min-h-0 flex-1 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-surface text-xs text-ink-2">
                <tr>
                  <th className="px-3 py-2 font-semibold">Şirket</th>
                  <th className="px-3 py-2 font-semibold">Aşama</th>
                  <th className="px-3 py-2 text-right font-semibold">Değerleme</th>
                  <th className="px-3 py-2 text-right font-semibold">Sıra</th>
                  <th className="px-3 py-2 font-semibold">Son aktivite</th>
                  <th className="px-3 py-2 font-semibold">Kayıt</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => {
                      setSelected(u.id)
                      setNote(null)
                    }}
                    aria-selected={selected === u.id}
                    className={`cursor-pointer border-t border-hairline ${selected === u.id ? 'bg-brand-soft' : 'hover:bg-surface-2'}`}
                  >
                    <td className="max-w-64 px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-bold">{u.companyName}</span>
                        {u.bannedAt && <span className="shrink-0 rounded-lg bg-negative/15 px-1.5 text-[11px] font-bold text-negative-ink">Banlı</span>}
                      </div>
                      <div className="font-text truncate text-xs text-ink-2">{u.email}</div>
                    </td>
                    <td className="px-3 py-2">{u.board ? stageName(u.board.stage) : '–'}</td>
                    <td className="ui-num px-3 py-2 text-right">{u.board ? money.format(u.board.valuation) : '–'}</td>
                    <td className="ui-num px-3 py-2 text-right">{u.board?.rank ?? '–'}</td>
                    <td className="px-3 py-2 text-ink-2">{u.board ? ago(u.board.updatedAt) : '–'}</td>
                    <td className="px-3 py-2 text-ink-2">{date(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users && shown.length === 0 && <p className="font-text p-6 text-center text-sm text-ink-2">Kimse yok.</p>}
            {!users && !error && <p className="font-text p-6 text-center text-sm text-ink-2">Yükleniyor…</p>}
          </div>
        </section>

        <aside className="ui-card ui-scroll flex min-h-0 w-full shrink-0 flex-col gap-3 p-4 max-md:max-h-[50dvh] md:w-[360px]">
          {note && <p role={note.error ? 'alert' : 'status'} className={`font-text text-sm ${note.error ? 'text-negative-ink' : 'text-positive-ink'}`}>{note.text}</p>}
          {selected ? (
            <Detail key={selected} id={selected} onNote={setNote} onChanged={onChanged} onSignedOut={onSignedOut} />
          ) : (
            !note && <p className="font-text text-sm text-ink-2">Soldan bir oyuncu seç.</p>
          )}
        </aside>
      </div>
    </div>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-ink-2">{label}</dt>
      <dd className="ui-num text-sm">{children}</dd>
    </div>
  )
}

function ValueForm({ label, initial = '', placeholder, button, inputMode, onSubmit }: {
  label: string
  initial?: string
  placeholder?: string
  button: string
  inputMode?: 'numeric'
  onSubmit: (value: string) => void
}) {
  const [value, setValue] = useState(initial)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit(value)
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-1">
      <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
        {label}
        <input value={value} placeholder={placeholder} inputMode={inputMode} onChange={(e) => setValue(e.target.value)} className={inputClass} />
      </label>
      <Key type="submit" disabled={!value.trim() || value === initial} className="self-end">{button}</Key>
    </form>
  )
}

function Detail({ id, onNote, onChanged, onSignedOut }: {
  id: string
  onNote: (note: Note) => void
  onChanged: (oldId: string, next: AdminUser | null) => void
  onSignedOut: () => void
}) {
  const [user, setUser] = useState<AdminUserDetail | null>(null)
  const [busy, setBusy] = useState(false)
  const [banReason, setBanReason] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    let live = true
    void getUser(id).then((r) => {
      if (!live) return
      if (r.ok) setUser(r.data)
      else if (r.error === 'unauthorized') onSignedOut()
      else onNote({ text: r.message, error: true })
    })
    return () => {
      live = false
    }
  }, [id, onNote, onSignedOut])

  const act = async (action: AdminAction, done: string, value?: string) => {
    setBusy(true)
    const r = await runAction(id, action, value)
    setBusy(false)
    if (!r.ok) {
      if (r.error === 'unauthorized') return onSignedOut()
      return onNote({ text: r.message, error: true })
    }
    onNote({ text: done, error: false })
    if (r.data.user) setUser(r.data.user)
    onChanged(id, r.data.user)
  }

  if (!user) return <p className="font-text text-sm text-ink-2">Yükleniyor…</p>

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg leading-tight font-bold break-words">{user.companyName}</h2>
        <p className="font-text text-sm break-all text-ink-2">{user.email}</p>
        {user.bannedAt && (
          <p className="font-text mt-1 text-sm text-negative-ink">
            {date(user.bannedAt)} tarihinde banlandı{user.banReason ? `: ${user.banReason}` : '.'}
          </p>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
        {user.board ? (
          <>
            <Fact label="Aşama">{stageName(user.board.stage)}</Fact>
            <Fact label="Değerleme">{money.format(user.board.valuation)}</Fact>
            <Fact label="Kasa">{money.format(user.board.cash)}</Fact>
            <Fact label="Ekip">{user.board.team}</Fact>
            <Fact label="Oyun günü">{Math.floor(user.board.day)}</Fact>
            <Fact label="Sıra">{user.board.rank ?? '–'}</Fact>
          </>
        ) : (
          <Fact label="Sıralama">Listede değil</Fact>
        )}
        <Fact label="Kayıt">{date(user.createdAt)}</Fact>
        <Fact label="Açık cihaz">{user.sessions}</Fact>
        <Fact label="Bulut kaydı">{user.save ? `${user.save.day} gün, #${user.save.rev}` : 'Yok'}</Fact>
        <Fact label="Son bulut yazımı">{user.save ? ago(user.save.updatedAt) : '–'}</Fact>
      </dl>

      <div className="flex flex-col gap-3 border-t border-hairline pt-3">
        <ValueForm
          key={`name:${user.companyName}`}
          label={user.nameLocked ? 'Şirket adı (kilitli, oyun değiştiremez)' : 'Şirket adı'}
          initial={user.companyName}
          button="Adı değiştir"
          onSubmit={(v) => void act('rename', 'Ad değişti.', v)}
        />
        <ValueForm
          key={`email:${user.email}`}
          label="E-posta"
          initial={user.email}
          button="E-postayı değiştir"
          onSubmit={(v) => void act('email', 'E-posta değişti, oyuncu aynı PIN ile yeni e-postadan girer.', v)}
        />
        <ValueForm
          label="Yeni PIN (4 rakam)"
          placeholder="••••"
          inputMode="numeric"
          button="PIN'i değiştir"
          onSubmit={(v) => void act('pin', 'PIN değişti, kilit kalktı.', v)}
        />
      </div>

      <div className="flex flex-col gap-2 border-t border-hairline pt-3">
        <Key disabled={busy || user.sessions === 0} onClick={() => void act('logout', 'Tüm cihazlardan çıkarıldı.')}>Tüm cihazlardan çıkar</Key>
        {user.bannedAt ? (
          <Key disabled={busy} onClick={() => void act('unban', 'Ban kalktı. Sıralamaya sonraki gönderimde döner.')}>Banı kaldır</Key>
        ) : (
          <div className="flex gap-2">
            <input aria-label="Ban sebebi" placeholder="Sebep (isteğe bağlı)" value={banReason} maxLength={200} onChange={(e) => setBanReason(e.target.value)} className={inputClass} />
            <Key tone="danger" disabled={busy} onClick={() => void act('ban', 'Banlandı.', banReason)}>Banla</Key>
          </div>
        )}
        {confirmDelete ? (
          <div className="flex flex-col gap-2">
            <p className="font-text text-sm text-negative-ink">
              Hesap, bulut kaydı ve sıralama satırı kalıcı olarak silinir.{user.bannedAt ? ' E-posta bir daha kayıt olamaz.' : ''}
            </p>
            <div className="flex gap-2">
              <Key tone="danger" disabled={busy} className="flex-1" onClick={() => void act('delete', 'Silindi.')}>Evet, kalıcı olarak sil</Key>
              <Key onClick={() => setConfirmDelete(false)}>Vazgeç</Key>
            </div>
          </div>
        ) : (
          <Key tone="danger" onClick={() => setConfirmDelete(true)}>Hesabı sil</Key>
        )}
      </div>
    </div>
  )
}
