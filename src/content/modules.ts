// Project module names + one-liners (GAMEPLAY V2 modules, PLAN §3.4). The id list lives in engine/types.ts.
import type { ProjectCategory, ProjectModuleId } from '../engine/types'

export interface ModuleText {
  name: string
  /** One sentence, ≤ 10 words: what the module does for the company. */
  line: string
}

export const MODULE_TEXT: Record<ProjectModuleId, ModuleText> = {
  feedback: { name: 'Geri bildirim', line: 'Kullanıcının istediğini yaparsın, güncellemeler biraz uzar.' },
  referral: { name: 'Davet sistemi', line: 'Davet eden kullanıcıya kredi verirsin, gelir biraz düşer.' },
  paywall: { name: 'Paywall', line: 'Daha çok kazanırsın ama ürün daha yavaş yayılır.' },
  onboarding: { name: 'Onboarding', line: 'Yeni kullanıcı ilk gün uygulamayı bırakmaz.' },
  analytics: { name: 'Analitik', line: 'Hangi reklamın para getirdiğini görürsün.' },
  freemium: { name: 'Freemium', line: 'Ücretsiz sürüm hızlı yayılır, kullanıcı başı gelir düşer.' },
  openApi: { name: 'Public API', line: 'Başka ürünler sana bağlanır, müşteri kolay ayrılmaz.' },
  localization: { name: 'Lokalizasyon', line: 'Yeni dillerle yeni ülkelere açılırsın.' },
  aiAssistant: { name: 'AI asistan', line: 'Kullanıcı başı gelir artar, sunucu faturası da.' },
}

/** API projects call the open-API module by its portal name (balance: api churn×0.85, arpu×1.10). */
const API_PORTAL_NAME = 'Geliştirici portalı'

/** Module name for a project of this category; api projects get the portal name for openApi. */
export function moduleName(id: ProjectModuleId, category?: ProjectCategory): string {
  if (id === 'openApi' && category === 'api') return API_PORTAL_NAME
  return MODULE_TEXT[id].name
}
