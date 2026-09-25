// This device's login: token + who it belongs to + the cloud save revision this device last saw.
// localStorage only, every access guarded (private mode / blocked storage ⇒ the player just logs in again).

export const SESSION_KEY = 'be-unicorn:session'

export interface Session {
  token: string
  email: string
  companyName: string
  /** Cloud save revision this device last loaded or wrote (baseRev of the next PUT). */
  cloudRev: number
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function readSession(): Session | null {
  try {
    const raw = storage()?.getItem(SESSION_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<Session>
    if (typeof p.token !== 'string' || !p.token || typeof p.email !== 'string') return null
    return {
      token: p.token,
      email: p.email,
      companyName: typeof p.companyName === 'string' ? p.companyName : '',
      cloudRev: typeof p.cloudRev === 'number' && p.cloudRev >= 0 ? p.cloudRev : 0,
    }
  } catch {
    return null
  }
}

export function writeSession(s: Session): void {
  try {
    storage()?.setItem(SESSION_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

/** Merges fields into the stored session (no-op without one). */
export function patchSession(p: Partial<Session>): Session | null {
  const cur = readSession()
  if (!cur) return null
  const next = { ...cur, ...p }
  writeSession(next)
  return next
}

export function clearSession(): void {
  try {
    storage()?.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}
