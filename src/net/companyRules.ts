// Company-name rules shared by the start screen and the server (api/_lib/auth.ts). No imports on purpose: the
// Vercel functions load this file at runtime. A test keeps the length limits equal to engine/types.ts.

export const COMPANY_NAME_MIN = 2
export const COMPANY_NAME_MAX = 32

export type CompanyNameIssue = 'short' | 'long' | 'chars' | 'url' | 'bad'

export type CompanyNameCheck = { ok: true; value: string } | { ok: false; issue: CompanyNameIssue }

const ALLOWED = /^[\p{L}\p{N} .&'+!-]+$/u
const URL_LIKE = /:\/\/|www\.|\/|@|\.(com|net|org|xyz|ru|gg|me|tr|info|biz|site|online|link|top|shop)(\b|$)/i

/** Leetspeak + Turkish letters folded to plain ASCII for the word check. */
function fold(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ç/g, 'c')
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/\$/g, 's')
}

/** Whole-word matches only (short roots hide inside innocent words: "Klasik", "Gotik"). */
const BAD_WORDS = new Set(['amk', 'aq', 'sik', 'sikik', 'got', 'pic', 'ibne', 'oc', 'mk', 'yarak', 'yarrak', 'dick', 'cock', 'fag', 'nazi', 'hitler'])
/** Distinctive enough to match anywhere in the folded name. */
const BAD_PARTS: readonly string[] = ['orosp', 'siktir', 'amcik', 'pezevenk', 'kahpe', 'yavsak', 'gavat', 'fuck', 'shit', 'bitch', 'cunt', 'nigg', 'whore', 'porn']

/** Validates a typed name. Returns the cleaned value (trimmed, spaces collapsed) when it can go on the leaderboard. */
export function checkCompanyName(raw: string): CompanyNameCheck {
  const value = raw.replace(/\s+/g, ' ').trim()
  const len = Array.from(value).length
  if (len < COMPANY_NAME_MIN) return { ok: false, issue: 'short' }
  if (len > COMPANY_NAME_MAX) return { ok: false, issue: 'long' }
  if (URL_LIKE.test(value)) return { ok: false, issue: 'url' }
  if (!ALLOWED.test(value)) return { ok: false, issue: 'chars' }
  const folded = fold(value)
  const joined = folded.replace(/[^a-z]/g, '')
  if (BAD_PARTS.some((w) => joined.includes(w))) return { ok: false, issue: 'bad' }
  if (folded.split(/[^a-z]+/).some((w) => BAD_WORDS.has(w))) return { ok: false, issue: 'bad' }
  return { ok: true, value }
}
