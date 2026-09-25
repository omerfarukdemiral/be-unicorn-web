// Startup name: suggestions for the start screen + a light check before it goes on the public leaderboard.
// The engine normalizes (trim / collapse / cap, engine/createGame.ts › cleanCompanyName); this file judges.
import { COMPANY_NAME_MAX, COMPANY_NAME_MIN } from '../engine/types'

const ROOTS: readonly string[] = [
  'Helio', 'Kovan', 'Poyraz', 'Lodos', 'Yakamoz', 'Simurg', 'Martı', 'Pusula', 'Kervan', 'Meltem',
  'Anka', 'Fener', 'Çıra', 'Tılsım', 'Nabız', 'Otağ', 'Liman', 'Kıvılcım', 'Dalga', 'Yörünge',
  'Zemberek', 'Şimşek', 'Köprü', 'Tohum', 'Pervane', 'Bulut', 'Kandil', 'Nova', 'Orbit', 'Pixel',
]
const WORD_SUFFIXES: readonly string[] = ['Labs', 'Studio', 'AI', 'Works', 'Tech', 'Hub', 'Pay', 'Go', 'Cloud', 'Games']
const JOINED_SUFFIXES: readonly string[] = ['ly', '.io', '.app', 'ify', 'X']

/** A fresh suggestion, e.g. "Helio Studio", "Kovanly", "Pusula.io". `rand` returns [0, 1). */
export function suggestCompanyName(rand: () => number = Math.random): string {
  const pick = <T,>(list: readonly T[]): T => list[Math.min(list.length - 1, Math.floor(rand() * list.length))]!
  const root = pick(ROOTS)
  if (rand() < 0.7) return `${root} ${pick(WORD_SUFFIXES)}`
  // Joined forms read better on roots without Turkish diacritics at the end ("Novaly", "Kovan.io").
  return `${root}${pick(JOINED_SUFFIXES)}`
}

export type CompanyNameIssue = 'short' | 'long' | 'chars' | 'url' | 'bad'

export type CompanyNameCheck = { ok: true; value: string } | { ok: false; issue: CompanyNameIssue }

/** Short player-facing reason per issue (start screen, under the field). */
export const COMPANY_NAME_ISSUE_TEXT: Readonly<Record<CompanyNameIssue, string>> = {
  short: `En az ${COMPANY_NAME_MIN} karakter.`,
  long: `En fazla ${COMPANY_NAME_MAX} karakter.`,
  chars: 'Harf, rakam, boşluk ve . - & yeter.',
  url: 'Link değil, şirket adı lazım.',
  bad: 'Yatırımcı bunu sunumda okuyacak. Başka bir ad?',
}

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
