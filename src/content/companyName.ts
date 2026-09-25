// Startup name: suggestions for the start screen + a light check before it goes on the public leaderboard.
// The engine normalizes (trim / collapse / cap, engine/createGame.ts › cleanCompanyName); this file judges.
import { COMPANY_NAME_MAX, COMPANY_NAME_MIN } from '../engine/types'
import type { CompanyNameIssue } from '../net/companyRules'

// The check itself lives in net/companyRules.ts (no imports) so the server runs the same rules.
export { checkCompanyName, type CompanyNameCheck, type CompanyNameIssue } from '../net/companyRules'

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

/** Short player-facing reason per issue (start screen, under the field). */
export const COMPANY_NAME_ISSUE_TEXT: Readonly<Record<CompanyNameIssue, string>> = {
  short: `En az ${COMPANY_NAME_MIN} karakter.`,
  long: `En fazla ${COMPANY_NAME_MAX} karakter.`,
  chars: 'Harf, rakam, boşluk ve . - & yeter.',
  url: 'Link değil, şirket adı lazım.',
  bad: 'Yatırımcı bunu sunumda okuyacak. Başka bir ad?',
}
