// Project module names + one-liners (GAMEPLAY V2 modules, PLAN §3.4; round 3 catalogue, design §1.4 + §6). The id list lives in engine/types.ts.
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
  onboarding: { name: 'Onboarding', line: 'Yeni kullanıcı ilk gün bırakmaz, araç aylık ücretli.' },
  analytics: { name: 'Analitik', line: 'Hangi reklam para getiriyor görürsün, araç aylık ücretli.' },
  freemium: { name: 'Freemium', line: 'Ücretsiz sürüm hızlı yayılır, kullanıcı başı gelir düşer.' },
  openApi: { name: 'Public API', line: 'Başka ürünler sana bağlanır, müşteri kolay ayrılmaz.' },
  localization: { name: 'Lokalizasyon', line: 'Yeni dillerle yeni ülkelere açılırsın, reklam biraz pahalanır.' },
  aiAssistant: { name: 'AI asistan', line: 'Kullanıcı başı gelir artar, sunucu faturası da.' },
  // Core, new in round 3
  notifications: { name: 'Bildirimler', line: 'Unutanı geri çağırırsın, gönderim servisi aylık ücretli.' },
  support: { name: 'Canlı destek', line: 'Sorunu anında çözersin, destek aracı aylık ücretli.' },
  cicd: { name: 'Otomatik test', line: 'Her güncelleme daha az emek ister, test sunucusu ücretli.' },
  abTest: { name: 'A/B testi', line: 'İki fiyatı denersin, kazanan kalır, güncellemeler uzar.' },
  security: { name: 'Güvenlik denetimi', line: 'Borç erir, büyük müşteri güvenir, her sürüm denetlenir.' },
  sso: { name: 'Kurumsal giriş (SSO)', line: 'Şirketler toplu hesap açar, kod tabanı ağırlaşır.' },
  // Mobil
  aso: { name: 'Mağaza sayfası (ASO)', line: 'Mağazada daha çok görünürsün, her sürümde görseller yenilenir.' },
  crashReports: { name: 'Çökme raporu', line: 'Çökmeyi kullanıcıdan önce görürsün, servis aylık ücretli.' },
  deepLinks: { name: 'Paylaşım linkleri', line: 'Paylaşılan link uygulamayı açar, davetle birlikte daha güçlü.' },
  offlineMode: { name: 'Çevrimdışı mod', line: 'İnternet yokken de çalışır, kod tabanı ağırlaşır.' },
  inAppPurchase: { name: 'Uygulama içi satın alma', line: 'Uygulamada satış yaparsın, mağaza payını alır.' },
  widgets: { name: "Ana ekran widget'ı", line: 'Ürünün ana ekranda durur, her sürüm uzar.' },
  tabletApp: { name: 'Tablet sürümü', line: 'Tablet kullananlara açılırsın, her güncelleme uzar.' },
  watchApp: { name: 'Saat uygulaması', line: 'Bildirimler bilekte, kullanıcı kolay bırakmaz, güncellemeler uzar.' },
  // Web
  seo: { name: 'SEO', line: "Google'dan ücretsiz kullanıcı gelir, içerik yazarı aylık ücretli." },
  landingPages: { name: 'Açılış sayfaları', line: 'Reklamdan gelen daha çok kayıt olur, sayfa aracı ücretli.' },
  templates: { name: 'Şablon galerisi', line: 'Kullanıcı hazır şablonla başlar, şablonları güncel tutarsın.' },
  teamPlans: { name: 'Ekip planı', line: 'Şirketler koltuk başı öder, bireysel kullanıcı biraz kaçar.' },
  integrations: { name: 'Entegrasyonlar', line: "Slack ve Zapier'a bağlanırsın, müşteri kolay ayrılmaz, borç birikir." },
  adminPanel: { name: 'Yönetici paneli', line: 'Ekip yöneticisi kontrol ister, panel daha çok kazandırır.' },
  pwa: { name: 'Mobil web (PWA)', line: 'Telefondan uygulama gibi açılır, her güncelleme uzar.' },
  auditLog: { name: 'Denetim kaydı', line: 'Kurumsal müşteri kaydı ister, kod tabanı ağırlaşır.' },
  // Yapay Zekâ
  evals: { name: 'Kalite testleri', line: 'Model hatasını kullanıcıdan önce yakalarsın, güncellemeler uzar.' },
  usagePricing: { name: 'Kullanım bazlı fiyat', line: 'Kullanan kadar öder, sürpriz fatura biraz kullanıcı kaçırır.' },
  rag: { name: 'Bilgi tabanı (RAG)', line: 'Model müşterinin belgesiyle cevap verir, veritabanı aylık ücretli.' },
  modelRouter: { name: 'Model yönlendirme', line: 'Kolay soruyu ucuz modele yollarsın, kalite biraz düşer.' },
  guardrails: { name: 'Guardrail', line: 'Model saçmalamaz, kurumsal müşteri güvenir, güncellemeler uzar.' },
  voiceMode: { name: 'Sesli mod', line: 'Kullanıcı konuşarak sorar, ürün yayılır, sunucu faturası artar.' },
  fineTune: { name: 'Özel model', line: 'Kendi modelin daha iyi cevaplar, GPU faturası ağır.' },
  agents: { name: 'Ajan modu', line: 'Model işi baştan sona yapar, sunucu ve borç artar.' },
  // API
  docs: { name: 'Dokümantasyon', line: 'Geliştirici kendi başına bağlanır, her güncellemede yazarsın.' },
  rateLimit: { name: 'Rate limit', line: 'Sunucu faturan düşer, sınıra takılan biraz kullanıcı kaçar.' },
  sdks: { name: "SDK'lar", line: 'Her dilde hazır kütüphane, bakımı güncellemeleri uzatır.' },
  webhooks: { name: "Webhook'lar", line: 'Müşterinin sistemi sana bağlanır, kolay ayrılmaz, biraz borç.' },
  sandbox: { name: 'Test ortamı', line: 'Geliştirici risksiz dener, test sunucusu aylık ücretli.' },
  usageDashboard: { name: 'Kullanım paneli', line: 'Müşteri harcamasını görür, faturaya şaşırmaz, güncellemeler uzar.' },
  slaPlans: { name: 'SLA paketi', line: 'Garantili hizmete daha çok öder, nöbet ekibi ücretli.' },
  multiRegion: { name: 'Çok bölge', line: 'Her kıtada hızlı çalışırsın, sunucu faturası ağırlaşır.' },
  // Oyun
  leaderboard: { name: 'Liderlik tablosu', line: 'Oyuncular yarışır ve paylaşır, sunucu biraz yüklenir.' },
  dailyRewards: { name: 'Günlük ödül', line: 'Oyuncu her gün döner, bedavalar gelirden yer.' },
  liveEvents: { name: 'Canlı etkinlik', line: 'Her güncelleme olay olur, içerik hazırlamak uzar.' },
  shop: { name: 'Oyun içi mağaza', line: 'Kostüm ve eşya satarsın, bazı oyuncular uzaklaşır.' },
  battlePass: { name: 'Sezon bileti', line: 'Her sezon bilet satarsın, sezon içeriği güncellemeyi uzatır.' },
  guilds: { name: 'Klanlar', line: 'Arkadaşlar birlikte oynar, kolay bırakmaz, sunucu yüklenir.' },
  ugcEditor: { name: 'Seviye editörü', line: 'Oyuncu kendi seviyesini yapar ve paylaşır, borç birikir.' },
  crossPlay: { name: 'Platformlar arası oyun', line: 'Telefon ve bilgisayar birlikte oynar, kod tabanı ağırlaşır.' },
  esports: { name: 'Turnuva modu', line: 'Turnuvalar yeni oyuncu çeker, ödül havuzu aylık ücretli.' },
  // Pazar Yeri
  reviews: { name: 'Değerlendirme sistemi', line: 'Yıldızlar güven verir, ürün yayılır, moderasyon güncellemeyi uzatır.' },
  payments: { name: 'Ödeme altyapısı (escrow)', line: 'Para güvenle el değiştirir, ödeme servisi aylık ücretli.' },
  sellerDashboard: { name: 'Satıcı paneli', line: 'Satıcı ilanını kendi yönetir, güncellemeler uzar.' },
  search: { name: 'Akıllı arama', line: 'Aranan hemen bulunur, satış artar, sunucu yüklenir.' },
  promotedListings: { name: 'Öne çıkan ilan', line: 'Satıcı öne çıkmak için öder, liste reklamla dolar.' },
  buyerProtection: { name: 'Alıcı koruması', line: 'Alıcı rahat alır ve kalır, iadeler gelirden yer.' },
  shipping: { name: 'Kargo entegrasyonu', line: 'Kargo tek tıkla çıkar, yeni şehirler açılır, servis ücretli.' },
  recommendations: { name: 'Öneri motoru', line: 'Herkese uygun ilanı gösterirsin, satış artar, sunucu yüklenir.' },
  cityLaunch: { name: 'Yeni şehir', line: 'Yeni şehirde pazar açılır, reklam başta pahalı.' },
}

/** API projects call the open-API module by its portal name (balance: api churn×0.85, arpu×1.10). */
const API_PORTAL_NAME = 'Geliştirici portalı'

/** Category names for shared modules: the same effect, said the way that product's people say it. */
export const CATEGORY_MODULE_NAME: Partial<Record<ProjectCategory, Partial<Record<ProjectModuleId, string>>>> = {
  api: { openApi: API_PORTAL_NAME, onboarding: 'Hızlı başlangıç', paywall: 'Ücretli plan' },
  game: { onboarding: 'Eğitim bölümü', referral: 'Arkadaşını çağır', feedback: 'Oyuncu yorumları', notifications: 'Oyun bildirimleri', support: 'Oyuncu desteği' },
  marketplace: { referral: 'Arkadaşını getir', onboarding: 'İlk ilan rehberi', support: 'Alıcı-satıcı desteği', paywall: 'Satıcı aboneliği' },
  mobile: { notifications: 'Push bildirimi', onboarding: 'İlk açılış turu' },
  ai: { feedback: 'Cevap puanlama', onboarding: 'İlk soru rehberi' },
}

/** Module name for a project of this category (category override first, then the shared name). */
export function moduleName(id: ProjectModuleId, category?: ProjectCategory): string {
  return (category && CATEGORY_MODULE_NAME[category]?.[id]) || MODULE_TEXT[id].name
}
