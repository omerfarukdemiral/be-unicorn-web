// Project module names + one-liners (GAMEPLAY V2 modules, PLAN §3.4). The id list lives in engine/types.ts.
import type { ProjectCategory, ProjectModuleId } from '../engine/types'

export interface ModuleText {
  name: string
  /** One sentence, ≤ 10 words: what the module does for the company. */
  line: string
}

export const MODULE_TEXT: Record<ProjectModuleId, ModuleText> = {
  feedback: { name: 'Geri bildirim döngüsü', line: 'Kullanıcı ne istediğini söyler, güncellemeler isabet eder.' },
  referral: { name: 'Davet programı', line: 'Kullanıcı arkadaşını getirir, kredi verirsin.' },
  paywall: { name: 'Premium duvar', line: 'Asıl özellikler ücretli; yayılma yavaşlar.' },
  onboarding: { name: 'Karşılama akışı', line: 'Yeni gelen ilk gün kaybolmaz.' },
  analytics: { name: 'Ürün analitiği', line: 'Hangi reklam işe yarıyor, görürsün.' },
  freemium: { name: 'Ücretsiz katman', line: 'Ücretsiz katman hızlı yayılır, az kazandırır.' },
  openApi: { name: 'Açık API', line: 'Başkaları üstüne kurar, bırakmak zorlaşır.' },
  localization: { name: 'Çoklu dil', line: 'Yeni diller, yeni pazarlar.' },
  aiAssistant: { name: 'Yapay zekâ asistanı', line: 'Akıllı yardım gelir getirir, sunucu faturası da.' },
}

/** API projects call the open-API module by its portal name (balance: api churn×0.85, arpu×1.10). */
const API_PORTAL_NAME = 'Geliştirici portalı'

/** Module name for a project of this category; api projects get the portal name for openApi. */
export function moduleName(id: ProjectModuleId, category?: ProjectCategory): string {
  if (id === 'openApi' && category === 'api') return API_PORTAL_NAME
  return MODULE_TEXT[id].name
}
