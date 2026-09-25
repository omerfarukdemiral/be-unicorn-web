// Turkish text for the network layer: error messages and leaderboard row pieces.
// Kept next to the API so every error code has a message (the Record type enforces it); the content lane may
// move this table into src/content later without changing callers.
import type { ApiErrorCode } from './contract'

export const NET_ERROR_TEXT: Record<ApiErrorCode, string> = {
  notConfigured: 'Bulut kapalı. Bu cihazda oynuyorsun.',
  offline: 'Sunucuya ulaşamadık. İnternet bir kahve molasında.',
  badRequest: 'Bir şeyler ters gitti. Bir daha dene.',
  invalidEmail: 'Bu e-posta pek e-postaya benzemiyor.',
  invalidPin: 'PIN tam 4 rakam olmalı.',
  invalidCompanyName: 'Şirket adı 2–32 karakter olsun.',
  emailTaken: 'Bu e-posta zaten bir şirket kurmuş. PIN\'inle gir.',
  wrongCredentials: 'PIN tutmadı.',
  unknownEmail: 'Bu e-postayla kayıt yok. Yeni şirket mi kuruyoruz?',
  locked: 'Çok fazla yanlış PIN. Biraz bekle.',
  rateLimited: 'Biraz yavaş. Birkaç saniye sonra tekrar dene.',
  unauthorized: 'Oturum düştü. Tekrar gir.',
  forbiddenOrigin: 'Bu istek başka bir yerden geldi, reddedildi.',
  methodNotAllowed: 'Bir şeyler ters gitti. Bir daha dene.',
  tooLarge: 'Kayıt çok büyümüş, buluta sığmadı.',
  conflict: 'Başka bir cihazda daha yeni bir kayıt var.',
  invalidSave: 'Kayıt bozuk görünüyor.',
  invalidMetrics: 'Bu sayılar sıralamaya fazla iyi geldi.',
  staleRun: 'Bu eski bir oyundan kalma.',
  server: 'Sunucu tökezledi. Birazdan tekrar dene.',
}

/** "18 dk" / "3 sn" style wait, for locked / rateLimited. */
export function waitText(seconds: number): string {
  if (seconds >= 60) return `${Math.ceil(seconds / 60)} dk`
  return `${Math.max(1, Math.ceil(seconds))} sn`
}

/** Error message with the extra numbers filled in (wait time, tries left). */
export function errorMessage(code: ApiErrorCode, extra?: { retryAfter?: number; attemptsLeft?: number }): string {
  const base = NET_ERROR_TEXT[code]
  if ((code === 'locked' || code === 'rateLimited') && extra?.retryAfter) return `${base} (${waitText(extra.retryAfter)})`
  if (code === 'wrongCredentials' && extra?.attemptsLeft !== undefined) return `${base} ${extra.attemptsLeft} hakkın kaldı.`
  return base
}

/** Leaderboard run length: "7 ay (210 gün)"; under a month just "12 gün". */
export function runLengthText(day: number): string {
  const d = Math.max(0, Math.floor(day))
  const months = Math.floor(d / 30)
  return months >= 1 ? `${months} ay (${d} gün)` : `${d} gün`
}

/** Leaderboard team size (founder included): "18 kişilik ekip", the founder alone "Tek kişilik ekip". */
export function teamText(team: number): string {
  return team <= 1 ? 'Tek kişilik ekip' : `${team} kişilik ekip`
}

/** Client copy of the server's mask (api/_lib/auth.ts maskEmail), for the sign-in note: om***@helio.studio. */
export function maskEmail(email: string): string {
  const e = email.trim().toLowerCase()
  const at = e.lastIndexOf('@')
  if (at < 1) return '***'
  const local = e.slice(0, at)
  const keep = local.length <= 3 ? 1 : 2
  return `${local.slice(0, keep)}***${e.slice(at)}`
}

/** Loose e-mail shape check before calling the server (the server has the final say). */
export function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
}
