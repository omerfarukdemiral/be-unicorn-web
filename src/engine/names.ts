// Name rules shared by the engine (project rename), the start screen and the server (api/_lib/auth.ts). No imports on
// purpose: the Vercel functions load this file at runtime (via net/companyRules.ts). A test keeps the company limits
// equal to engine/types.ts.

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
const BAD_WORDS = new Set([
  'amk', 'aq', 'sik', 'sikik', 'got', 'pic', 'ibne', 'oc', 'mk', 'yarak', 'yarrak', 'dick', 'cock', 'fag', 'nazi', 'hitler',
  'am', 'amin', 'amina', 'anan', 'anani', 'avrat', 'sex', 'seks', 'tits', 'ass', 'pipi', 'cum', 'anal', 'rape',
])
/** Distinctive enough to match anywhere in the folded name. Checked on the name with repeats squeezed ("yarrrak") and
 * again with z read as s ("zikerim", "MILFZIGER"). */
const BAD_PARTS: readonly string[] = [
  'orosp', 'orspu', 'oruspu', 'siktir', 'sikis', 'sikim', 'siker', 'sikec', 'siger', 'sigis', 'sigim',
  'amcik', 'aminako', 'aminak', 'aminoglu', 'anani', 'ananis', 'pezeven', 'kahpe', 'yavsak', 'gavat', 'kaltak', 'surtuk', 'kevase',
  'yarak', 'yarra', 'dalyar', 'tasak', 'tasag', 'gotver', 'gotun', 'gotlek', 'puust', 'ibneh',
  'fuck', 'shit', 'bitch', 'cunt', 'nigg', 'whore', 'porn', 'milf', 'pussy', 'slut', 'dildo', 'penis', 'vagin', 'vajin',
  'boob', 'jizz', 'horny', 'nude', 'naked', 'hentai', 'tecavuz', 'sperm', 'mastur', 'orgasm',
]
/** Inside a longer word these innocent names would trip a part above: matched first and blanked out. */
const SAFE_WORDS: readonly string[] = ['fizik', 'physik', 'musik']

/** Validates a typed name. Returns the cleaned value (trimmed, spaces collapsed) when it can go on the leaderboard. */
export function checkName(raw: string, min: number, max: number): CompanyNameCheck {
  const value = raw.replace(/\s+/g, ' ').trim()
  const len = Array.from(value).length
  if (len < min) return { ok: false, issue: 'short' }
  if (len > max) return { ok: false, issue: 'long' }
  if (URL_LIKE.test(value)) return { ok: false, issue: 'url' }
  if (!ALLOWED.test(value)) return { ok: false, issue: 'chars' }
  if (isBadName(value)) return { ok: false, issue: 'bad' }
  return { ok: true, value }
}

/** Swear words, slurs and sexual words, after folding leetspeak, Turkish letters, repeats and z/s. */
export function isBadName(value: string): boolean {
  const folded = fold(value)
  const words = folded.split(/[^a-z]+/)
  for (const w of words) if (BAD_WORDS.has(w) || BAD_WORDS.has(squeeze(w))) return true
  let joined = folded.replace(/[^a-z]/g, '')
  for (const safe of SAFE_WORDS) joined = joined.split(safe).join('_')
  const forms = [joined, squeeze(joined), joined.replace(/z/g, 's'), squeeze(joined.replace(/z/g, 's'))]
  return BAD_PARTS.some((w) => forms.some((f) => f.includes(w)))
}

/** "yarrrak" → "yarak", "fuuuck" → "fuck". */
function squeeze(s: string): string {
  return s.replace(/(.)\1+/g, '$1')
}

export function checkCompanyName(raw: string): CompanyNameCheck {
  return checkName(raw, COMPANY_NAME_MIN, COMPANY_NAME_MAX)
}

/** Case-insensitive identity of a name, with Turkish dotted/dotless i treated as one letter ("Mobil" = "MOBİL" = "MOBIL"). */
export function nameKey(name: string): string {
  return name.toLowerCase().replace(/\u0307/g, '').replace(/ı/g, 'i')
}
