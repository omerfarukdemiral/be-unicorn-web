// Owner-only moderation, run from api/_dev/ban.ts with the production Redis env. Never routed: no HTTP handler.
import type { Kv } from './kv.js'
import { emailHash, keys, readSessions } from './auth.js'
import { trackKey } from './leaderboard.js'

/** Board rows whose stored company name matches (case-insensitive), with their e-mail hash. */
export async function findByName(kv: Kv, name: string, scan = 500): Promise<{ h: string; email: string; companyName: string }[]> {
  const want = name.trim().toLocaleLowerCase('tr')
  const members = await kv.zrevrange(keys.lb, 0, scan - 1)
  const raws = await kv.mget(members.map((m) => keys.lbRow(m.member)))
  const out: { h: string; email: string; companyName: string }[] = []
  members.forEach((m, i) => {
    const raw = raws[i]
    if (!raw) return
    const row = JSON.parse(raw) as { email: string; companyName: string }
    if (row.companyName.toLocaleLowerCase('tr') === want) out.push({ h: m.member, email: row.email, companyName: row.companyName })
  })
  return out
}

/** Deletes the account (user, sessions, cloud save, board row) and keeps a ban mark so the e-mail cannot register again. */
export async function banAccount(kv: Kv, h: string, note: string): Promise<void> {
  await kv.set(keys.ban(h), JSON.stringify({ at: Date.now(), note }))
  for (const s of await readSessions(kv, h)) await kv.del(keys.session(s.th))
  await kv.zrem(keys.lb, h)
  for (const k of [keys.sessions(h), keys.user(h), keys.save(h), keys.lbRow(h), keys.lbReplay(h), trackKey(h)]) await kv.del(k)
}

export async function banEmail(kv: Kv, email: string, note: string): Promise<string> {
  const h = emailHash(email.trim().toLowerCase())
  await banAccount(kv, h, note)
  return h
}

