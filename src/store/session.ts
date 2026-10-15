// F5: a run that was on screen when the page went away comes back on its own, and the next boot can tell why it went.
// Nothing in the app sends a running game to the start card; only a document reload does (a mobile browser discarding
// a background tab, jetsam under memory pressure, a crash the player reloads out of, or a deliberate sign-in/out).
// - Run mark (sessionStorage, so it lives exactly as long as this tab): set while a run is on screen, cleared before
//   every deliberate exit (sign-in, sign-out, game over). A reload that finds it skips the start card: the same run
//   loads paused, waiting for Başlat. Closing the tab drops it, so a new visit still starts at the menu.
// - Exit note (localStorage, survives anything): day, last write, hidden/visible, GL losses, last JS error. The next
//   boot reads it once and classifies the previous exit (console only: no player-facing popup).
// Every storage access is guarded: private mode / blocked storage must never break the boot.

export const RUN_MARK_KEY = 'be-unicorn:on-screen'
export const AUTO_RESUME_KEY = 'be-unicorn:auto-resume'
export const EXIT_KEY = 'be-unicorn:last-exit'
/** Two auto-resumes inside this window and the third reload shows the start card (a save that crashes on load). */
export const AUTO_RESUME_WINDOW_MS = 60_000
export const AUTO_RESUME_MAX = 2
const ERR_MAX_CHARS = 160

export interface RunMark {
  at: number
  day: number
}

export interface ExitNote {
  /** Date.now() of the last write. */
  at: number
  day: number
  /** The page was hidden at the last write (the tab went to the background). */
  hidden: boolean
  /** WebGL context losses in that session. */
  glLost: number
  /** Last uncaught error, truncated. */
  err?: string
  /** A deliberate exit (sign-in, sign-out, game over): not a crash. */
  by?: string
}

export type ExitKind = 'deliberate' | 'error' | 'background' | 'crash'

function store(kind: 'session' | 'local'): Storage | null {
  try {
    const s = kind === 'session' ? globalThis.sessionStorage : globalThis.localStorage
    return s ?? null
  } catch {
    return null
  }
}

function readJson<T>(kind: 'session' | 'local', key: string): T | null {
  try {
    const raw = store(kind)?.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJson(kind: 'session' | 'local', key: string, v: unknown): void {
  try {
    store(kind)?.setItem(key, JSON.stringify(v))
  } catch {
    /* storage full or blocked: the run goes on without the mark */
  }
}

function remove(kind: 'session' | 'local', key: string): void {
  try {
    store(kind)?.removeItem(key)
  } catch {
    /* blocked storage */
  }
}

// --- run mark ---------------------------------------------------------------------------------------------------

export function markRunOnScreen(day: number, now = Date.now()): void {
  writeJson('session', RUN_MARK_KEY, { at: now, day: Math.floor(day) } satisfies RunMark)
}

/** Before a deliberate reload or at game over: the next boot shows the start card. */
export function clearRunOnScreen(by: string, now = Date.now()): void {
  remove('session', RUN_MARK_KEY)
  noteExit({ by }, now)
}

export function readRunMark(): RunMark | null {
  const m = readJson<RunMark>('session', RUN_MARK_KEY)
  return m && typeof m.at === 'number' ? m : null
}

/**
 * Boot after a reload: with the run mark set, loads the save (`load` = gameStore.load, false when there is none or it
 * is over) and returns true. Gives up after AUTO_RESUME_MAX resumes inside AUTO_RESUME_WINDOW_MS so a save that
 * crashes the page cannot loop; it then clears the mark and the start card shows as before.
 */
export function resumeAfterReload(load: () => boolean, now = Date.now()): boolean {
  if (!readRunMark()) return false
  const prev = readJson<{ n: number; at: number }>('session', AUTO_RESUME_KEY)
  const n = prev && now - prev.at < AUTO_RESUME_WINDOW_MS ? prev.n : 0
  if (n >= AUTO_RESUME_MAX) {
    remove('session', RUN_MARK_KEY)
    return false
  }
  writeJson('session', AUTO_RESUME_KEY, { n: n + 1, at: n === 0 ? now : prev!.at })
  let ok = false
  try {
    ok = load()
  } catch (e) {
    console.error('[run] auto-resume failed', e)
  }
  if (!ok) remove('session', RUN_MARK_KEY)
  return ok
}

// --- exit note --------------------------------------------------------------------------------------------------

export function noteExit(patch: Partial<ExitNote>, now = Date.now()): void {
  const cur = readJson<ExitNote>('local', EXIT_KEY)
  const base: ExitNote = cur && !cur.by ? cur : { at: now, day: 0, hidden: false, glLost: 0 }
  const next: ExitNote = { ...base, ...patch, at: now }
  if (next.err) next.err = next.err.slice(0, ERR_MAX_CHARS)
  writeJson('local', EXIT_KEY, next)
}

/** A fresh session starts its own note (the previous one was already read at boot). */
export function startExitNote(day: number, now = Date.now()): void {
  writeJson('local', EXIT_KEY, { at: now, day: Math.floor(day), hidden: false, glLost: 0 } satisfies ExitNote)
}

export function readExitNote(): ExitNote | null {
  const n = readJson<ExitNote>('local', EXIT_KEY)
  return n && typeof n.at === 'number' ? n : null
}

/**
 * Why the previous session ended: a deliberate exit, a JS error, the tab sent to the background (then discarded or
 * killed by the OS), or gone while visible (a crash or jetsam: the page was killed in the player's hand).
 */
export function classifyExit(n: ExitNote | null): ExitKind | null {
  if (!n) return null
  if (n.by) return 'deliberate'
  if (n.err) return 'error'
  if (n.hidden) return 'background'
  return 'crash'
}

/** Read once per page load, before this session writes its own note. */
export const previousExit: { note: ExitNote | null; kind: ExitKind | null } = (() => {
  const note = readExitNote()
  return { note, kind: classifyExit(note) }
})()
