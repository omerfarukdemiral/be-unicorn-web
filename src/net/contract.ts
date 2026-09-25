// Wire contract between the client (src/net/api.ts) and the Vercel functions (api/**).
// Types only: the server imports this file with `import type`, so nothing here may have a runtime value.

/** Machine-readable error codes. The client maps each one to a Turkish message (src/net/api.ts). */
export type ApiErrorCode =
  | 'notConfigured' // server has no Redis env: the client plays offline
  | 'offline' // client-side: the API could not be reached at all
  | 'badRequest'
  | 'invalidEmail'
  | 'invalidPin'
  | 'invalidCompanyName'
  | 'emailTaken'
  | 'wrongCredentials'
  | 'unknownEmail' // login with an e-mail that never registered: the client offers "new company"
  | 'locked' // too many wrong PINs for this e-mail
  | 'rateLimited' // too many requests from this IP
  | 'unauthorized' // missing / expired token
  | 'forbiddenOrigin'
  | 'methodNotAllowed'
  | 'tooLarge'
  | 'conflict' // save revision is behind the server copy
  | 'invalidSave'
  | 'invalidMetrics' // leaderboard submission failed the plausibility checks
  | 'staleRun' // submission from an older run than the one on the board
  | 'server'

export interface ApiErrorBody {
  error: ApiErrorCode
  /** Seconds until the lock / rate limit lifts (locked, rateLimited). */
  retryAfter?: number
  /** Wrong PIN: tries left before the 15-minute lock. */
  attemptsLeft?: number
  /** Which check failed (invalidMetrics), for logs and debugging. */
  detail?: string
}

// --- auth -------------------------------------------------------------------------------------------------------

export interface RegisterBody {
  email: string
  /** Exactly 4 digits. */
  pin: string
  companyName: string
}

export interface LoginBody {
  email: string
  pin: string
}

export interface AuthOk {
  token: string
  /** Normalized e-mail (lower-case, trimmed). */
  email: string
  companyName: string
  /** Token lifetime in seconds (sliding: every authenticated call renews it). */
  expiresIn: number
}

export interface MeOk {
  email: string
  companyName: string
}

// --- cloud save -------------------------------------------------------------------------------------------------

export interface SaveMeta {
  /** Server revision, +1 per accepted write. 0 = no save yet. */
  rev: number
  /** Server time (ms) of the last accepted write. */
  updatedAt: number
  /** Summary read from the save, for "continue" screens and conflict choices. */
  day: number
  stage: number
  runIndex: number
}

export interface SaveGetOk extends SaveMeta {
  /** The serialized SaveFile (engine `serialize`), or null when the account has no save yet. */
  data: string | null
}

export interface SavePutBody {
  /** engine `serialize(state)` output. ≤ 160 KB (real saves ~40 KB). */
  data: string
  /** The rev this device last loaded or wrote. A stale rev is refused with 409 `conflict`. */
  baseRev: number
  /** Overwrite even when baseRev is stale (the player chose this device's progress). */
  force?: boolean
}

export type SavePutOk = SaveMeta

/** 409 body: the server copy, so the client can offer "keep this device" (force) or "take the cloud one". */
export interface SaveConflictBody extends ApiErrorBody {
  error: 'conflict'
  server: SaveGetOk
}

// --- leaderboard ------------------------------------------------------------------------------------------------

export type RunStatus = 'playing' | 'bankrupt' | 'unicorn'

export interface LeaderboardSubmitBody {
  /** StageIndex 0 (Garaj) … 6 (Unicorn). */
  stage: number
  valuation: number
  cash: number
  /** Game day (state.time.day). */
  day: number
  /** Headcount including the founder (employees.length + 1). */
  team: number
  companyName: string
  /** state.meta.runIndex: a new run replaces the previous one on the board (a Unicorn finish is kept until beaten). */
  runIndex: number
  status?: RunStatus
  /** Optional replay log (store exportReplay()), kept for audit. ≤ 200 KB. */
  replay?: unknown
}

export interface LeaderboardRow {
  rank: number
  companyName: string
  /** Masked (om***@helio.studio) for everyone but the owner. */
  email: string
  stage: number
  valuation: number
  cash: number
  day: number
  team: number
  status: RunStatus
  /** Server time (ms) of the row's last update. */
  updatedAt: number
  /** True on the caller's own row. */
  me?: boolean
}

export interface LeaderboardGap {
  /** Stages between the caller and the row above (0 = same stage). */
  stages: number
  /** Valuation the caller needs to pass the row above (same stage); for Unicorn rows: days fewer needed. */
  valuation: number
  days: number
}

export interface LeaderboardOk {
  rows: LeaderboardRow[]
  total: number
  /** The caller's own row (also when outside the top `limit`), when a valid token was sent and a row exists. */
  me?: LeaderboardRow
  /** The row just above the caller and the gap to it; absent for #1 or without a row. */
  above?: LeaderboardRow
  gap?: LeaderboardGap
  /** Server time (ms), for "updated N s ago". */
  now: number
}

export interface LeaderboardSubmitOk {
  rank: number
  total: number
  row: LeaderboardRow
}

export interface HealthOk {
  ok: true
}
