// PLAN §6.3 decision cards + the one-time angel (GAMEPLAY V2 §5.2). No card scolds the player; every option shows gain / cost.
// GAMEPLAY V2 §3 md.11 / §9.2: the thread cards (threads.ts) came in and as many weak cards went out (the deck stays at
// its size): the ones a thread step now tells better, the rare ones and the late cards every run used to drain.
// Effect notes for the engine:
//   - modifiers.value is a multiplier, except kind 'morale' where it is an additive morale-target bonus.
//   - cashPercent stays within ±0.25 here; engine caps again.
//   - Flags set by cards: rushedProject, starHire, nichePath, platformPath (+ rivalBuyIntent, threads.ts).
//   - Loans (GAMEPLAY V2 §6.2) are `effects.loan` terms; the engine sizes them on the burn and closes every loan offer
//     while one runs (one loan only).
//   - Rival cards read flags.rivalPressure (0–1), maintained by the engine.
//   - acquisition-offer's sale sets SOLD_FLAG (engine balance ACQUIRED_FLAG): the run ends as 'acquired' (GAMEPLAY V2 §8.2).
//   - BOARD_CARDS: the board-review card the engine brings on the second missed quarter in a row (§8.3), never rolled.
import type { GameState, ModifierKind } from '../engine/types'
import type { DecisionCard } from './types'

const mod = (kind: ModifierKind, value: number, days: number) => ({ kind, value, days })
/**
 * Cards that bring free money only come while money is a real limit (runway < 12 months): with a long runway they
 * would just pile up cash (docs/CORE_LOOP.md §2 "para her aşamada kısıt kalır").
 */
const needsCash = (s: GameState): boolean => s.finance.runway !== null && s.finance.runway < 12
const rivalPressure = (s: GameState): number => {
  const v = s.flags['rivalPressure']
  return typeof v === 'number' ? v : 0
}
/**
 * Rival thread step 3 (GAMEPLAY V2 §9.2) comes at Series A, after the rival is born: a named rival is enough there
 * (the lead's pressure fades once the player outgrows its anchor).
 */
const rivalNear = (s: GameState): boolean => rivalPressure(s) >= 0.35 || (s.rivals?.length ?? 0) > 0
/** Mirrors engine balance ACQUIRED_FLAG: the sale ends the run. */
const SOLD_FLAG = 'companySold'
/** GAMEPLAY V2 §8.2: a buyer only knocks while a rival in the market is strong (strength > 0.7). */
const strongRival = (s: GameState): boolean => (s.rivals ?? []).some((r) => r.acquiredDay === undefined && r.goneDay === undefined && r.strength > 0.7)

export const DECISIONS: readonly DecisionCard[] = [
  // =========================================================== Garaj (3)
  {
    id: 'early-focus',
    stage: 0,
    maxStage: 1,
    category: 'normal',
    speaker: 'cofounder',
    question: 'İki fikir birden cazip geliyor. Hangisine odaklanalım?',
    // Only once a second idea is on the table (a single project has nothing to focus between).
    condition: (s) => s.projects.length >= 2,
    options: [
      {
        label: 'Tek ürüne odaklan',
        tradeoff: { gain: 'Proje hızı artar', cost: 'Diğer fikir bekler' },
        effects: { modifiers: [mod('production', 1.15, 30)] },
        reflection: 'Odak, erken aşamanın en ucuz hızlandırıcısıdır.',
        conceptId: 'focus',
      },
      {
        label: 'İkisini birden dene',
        tradeoff: { gain: 'Daha çok seçenek', cost: 'Her iş biraz yavaşlar' },
        effects: { reputation: 2, modifiers: [mod('production', 0.9, 20)] },
        reflection: 'Denemek öğretir, ama hız bölünür.',
        conceptId: 'focus',
      },
    ],
  },
  {
    id: 'early-sidegig',
    stage: 0,
    maxStage: 1,
    category: 'normal',
    speaker: 'cofounder',
    question: 'Bir ajans serbest iş teklif ediyor. Kasa rahatlar ama zaman gider.',
    options: [
      {
        label: 'İşi al',
        tradeoff: { gain: '+$3K kasa', cost: 'Ürün 20 gün yavaşlar' },
        effects: { cash: 3000, modifiers: [mod('production', 0.8, 20)] },
        reflection: 'Runway satın almak bazen en akıllıca yatırımdır.',
        conceptId: 'runway',
      },
      {
        label: 'Ürüne odaklan',
        tradeoff: { gain: 'Tam hız ürün', cost: 'Kasa aynı kalır' },
        effects: { morale: 3, maturity: 0.03 },
        reflection: 'Zamanını ürüne vermek de bir yatırım.',
        conceptId: 'focus',
      },
    ],
  },
  {
    id: 'early-equity-split',
    stage: 0,
    maxStage: 1,
    category: 'normal',
    speaker: 'cofounder',
    question: 'Ortaklık paylarını netleştirelim mi? Belirsizlik ileride dert olur.',
    options: [
      {
        label: 'Adil böl, hakediş ekle',
        tradeoff: { gain: 'Güven ve moral', cost: 'Hissenden %10' },
        effects: { equity: -0.1, morale: 8 },
        reflection: 'Net anlaşma, zor günlerde ortaklığı korur.',
        conceptId: 'dilution',
      },
      {
        label: 'Şimdilik konuşmayalım',
        tradeoff: { gain: 'Hisse sende kalır', cost: 'Belirsizlik birikir' },
        effects: {},
        delayed: { days: 45, effects: { morale: -8 }, note: 'Pay konusu gerginlik yarattı.' },
        reflection: 'Ertelenen konuşma genelde daha zor bir anda gelir.',
        conceptId: 'dilution',
      },
    ],
  },

  // =========================================================== Pre-seed (3)
  {
    id: 'angel-1',
    stage: 1,
    maxStage: 2,
    category: 'normal',
    speaker: 'investor',
    question: 'Bir melek yatırımcı SAFE ile $40K koymak istiyor. Değerlemeyi sonraki tura bırakıyor.',
    condition: needsCash,
    options: [
      {
        label: "SAFE'i imzala",
        tradeoff: { gain: '+$40K kasa', cost: 'Sonraki turda ek dilution' },
        effects: { cash: 40_000, queueConcept: 'safe' },
        delayed: { days: 90, effects: { equity: -0.04 }, note: 'SAFE hisseye dönüştü.' },
        reflection: 'Bugünün kolay parası, yarının hisse tablosunda görünür.',
        conceptId: 'safe',
      },
      {
        label: 'Teşekkür et, bekle',
        tradeoff: { gain: 'Hisse korunur', cost: 'Kasa aynı kalır' },
        effects: { reputation: 2 },
        reflection: 'Beklemek de bir müzakere pozisyonudur.',
        conceptId: 'safe',
      },
    ],
  },
  {
    id: 'cofounder-conflict',
    stage: 1,
    maxStage: 2,
    category: 'normal',
    speaker: 'cofounder',
    question: 'Ortağınla yön konusunda anlaşamıyorsunuz. Gerilim ekibe de yansıyor.',
    options: [
      {
        label: 'Açık bir toplantı yap',
        tradeoff: { gain: 'Moral toparlanır', cost: 'Enerji ve iki gün' },
        effects: { morale: 8, energy: -20 },
        reflection: 'Konuşulan anlaşmazlık, büyümeden çözülür.',
        conceptId: 'morale-compounds',
      },
      {
        label: 'Kararı sen ver, devam et',
        tradeoff: { gain: 'Hız korunur', cost: 'Gerilim bir ay sürer' },
        effects: { modifiers: [mod('morale', -6, 30)] },
        reflection: 'Hızlı karar zaman kazandırır, gerilimi taşır.',
        conceptId: 'morale-compounds',
      },
      {
        label: 'Mentordan arabuluculuk iste',
        tradeoff: { gain: 'Tarafsız bir göz', cost: '$2K ve %1 hisse' },
        effects: { cash: -2000, equity: -0.01, morale: 5 },
        reflection: 'Dışarıdan bakış, içeride görünmeyeni gösterir.',
        conceptId: 'morale-compounds',
      },
    ],
  },
  {
    id: 'pmf-hypothesis-width',
    stage: 1,
    maxStage: 2,
    category: 'normal',
    speaker: 'customer',
    question: 'Kitleyi geniş mi tutalım, dar bir niş mi? İkisi farklı ürün demek.',
    options: [
      {
        label: 'Dar bir niş seç',
        tradeoff: { gain: 'Hızlı olgunluk, düşük churn', cost: 'Küçük pazar' },
        effects: {
          maturity: 0.06,
          setFlag: 'nichePath',
          modifiers: [mod('churn', 0.85, 60), mod('organic', 0.85, 60)],
        },
        reflection: 'Küçük bir kitleyi çok mutlu etmek sağlam bir başlangıç.',
        conceptId: 'pmf',
      },
      {
        label: 'Geniş kitleye aç',
        tradeoff: { gain: 'Büyük pazar, daha çok kullanıcı', cost: 'Ürün yavaş oturur' },
        effects: { setFlag: 'platformPath', modifiers: [mod('organic', 1.2, 60), mod('churn', 1.15, 60)] },
        reflection: 'Geniş ağ çok balık tutar, bazıları kaçar.',
        conceptId: 'pmf',
      },
    ],
  },

  // =========================================================== Seed (4)
  {
    id: 'pricing-change',
    stage: 2,
    maxStage: 3,
    category: 'normal',
    speaker: 'accountant',
    question: 'Fiyatı %20 artırmayı düşünüyoruz. Bazı kullanıcılar gidebilir.',
    options: [
      {
        label: 'Herkes için artır',
        tradeoff: { gain: 'Gelir hızla artar', cost: 'Bir ay churn yükselir' },
        effects: { modifiers: [mod('arpu', 1.15, 90), mod('churn', 1.15, 30)] },
        reflection: 'Kalanlar, ürüne gerçekten değer verenlerdir.',
        conceptId: 'pricing',
      },
      {
        label: 'Sadece yeni kullanıcılara',
        tradeoff: { gain: 'Mevcut kullanıcı kalır', cost: 'Gelir yavaş artar' },
        effects: { modifiers: [mod('arpu', 1.07, 90)] },
        reflection: 'Yumuşak geçiş, güveni korur.',
        conceptId: 'pricing',
      },
    ],
  },
  {
    id: 'remote-vs-office',
    stage: 2,
    maxStage: 3,
    category: 'normal',
    speaker: 'cofounder',
    question: 'Ekip uzaktan çalışmak istiyor. Ofis mi, hibrit mi?',
    options: [
      {
        label: 'Hibrit çalışalım',
        tradeoff: { gain: 'Moral artar', cost: 'Koordinasyon zorlaşır' },
        effects: { morale: 6, modifiers: [mod('production', 0.95, 30)] },
        reflection: 'Esneklik, güvenle birlikte çalışır.',
        conceptId: 'culture-freezes',
      },
      {
        label: 'Ofiste kalalım',
        tradeoff: { gain: 'Hızlı iletişim', cost: 'Bazıları mutsuz' },
        effects: { morale: -4, modifiers: [mod('production', 1.05, 30)] },
        reflection: 'Yakınlık hız verir, herkese aynı uymaz.',
        conceptId: 'culture-freezes',
      },
    ],
  },
  {
    id: 'culture-values',
    stage: 2,
    maxStage: 3,
    category: 'normal',
    speaker: 'cofounder',
    question: 'Şirket değerlerini yazıya dökmenin zamanı geldi mi?',
    options: [
      {
        label: 'Ekiple birlikte yazalım',
        tradeoff: { gain: 'Uzun süreli moral bonusu', cost: 'Bir haftalık odak' },
        effects: { morale: 5, modifiers: [mod('morale', 3, 120), mod('production', 0.9, 7)] },
        reflection: 'Yazılı değerler, yeni gelenlere pusula olur.',
        conceptId: 'culture-freezes',
      },
      {
        label: 'Şimdi değil',
        tradeoff: { gain: 'Hız korunur', cost: 'Kültür kendi kendine şekillenir' },
        effects: {},
        delayed: { days: 60, effects: { morale: -4 }, note: 'Ekipte "biz kimiz?" sorusu dolaşıyor.' },
        reflection: 'Kültür yazılmasa da oluşur, sadece kendi yolunu seçer.',
        conceptId: 'culture-freezes',
      },
    ],
  },
  {
    id: 'server-crash',
    stage: 2,
    maxStage: 3,
    category: 'normal',
    speaker: 'engineer',
    question: 'Sunucular çöktü, kullanıcılar bekliyor. Nasıl ilerleyelim?',
    condition: (s) => s.derived.overload > 0 || s.stats.users > 1000,
    options: [
      {
        label: 'Gece boyu yama yap',
        tradeoff: { gain: 'Hızlı geri dönüş', cost: 'Yorgunluk ve teknik borç' },
        effects: { morale: -5, techDebt: 5 },
        reflection: 'Yama bugünü kurtarır, borcu yarına yazar.',
        conceptId: 'tech-debt',
      },
      {
        label: 'Durum sayfası aç, sağlam çöz',
        tradeoff: { gain: 'Kalıcı çözüm, güven', cost: 'Biraz kullanıcı kaybı' },
        effects: { usersPercent: -0.03, reputation: 2 },
        reflection: 'Şeffaf kesinti, sessiz kesintiden çok daha az iz bırakır.',
        conceptId: 'tech-debt',
      },
    ],
  },

  // =========================================================== Series A (3)
  {
    id: 'technical-debt-vote',
    stage: 3,
    maxStage: 4,
    category: 'normal',
    speaker: 'engineer',
    question: 'Ekip bir sprinti sadece teknik borca ayırmak istiyor.',
    options: [
      {
        label: 'Evet, temizleyelim',
        tradeoff: { gain: 'Borç azalır, hız geri gelir', cost: 'Bir ay yeni özellik yok' },
        effects: { techDebt: -20, modifiers: [mod('production', 0.8, 30)] },
        delayed: { days: 30, effects: { modifiers: [mod('production', 1.1, 60)] }, note: 'Temiz kod, ekibi hızlandırdı.' },
        reflection: 'Borcu ödemek, gelecekteki hızı satın almaktır.',
        conceptId: 'tech-debt',
      },
      {
        label: 'Önce yeni özellik',
        tradeoff: { gain: 'Yol haritası ilerler', cost: 'Borç faizle birikir' },
        effects: { techDebt: 10, maturity: 0.03, setFlag: 'rushedProject' },
        reflection: 'Bazen hız borca değer, faizini bilmek şartıyla.',
        conceptId: 'tech-debt',
      },
    ],
  },
  {
    id: 'star-resign',
    stage: 3,
    maxStage: 4,
    category: 'normal',
    speaker: 'cofounder',
    question: 'Yıldız çalışanımız rakipten teklif almış. Kalması için ne yapalım?',
    condition: (s) => s.derived.teamSize >= 8,
    options: [
      {
        label: 'Karşı teklif ver',
        tradeoff: { gain: 'O kalır', cost: 'Maaş dengesi bozulur' },
        effects: { cashPercent: -0.04, morale: -3, setFlag: 'starHire' },
        reflection: 'Bir kişiyi tutmak, diğerlerine de bir mesajdır.',
        conceptId: 'ten-x-myth',
      },
      {
        label: 'Bilgiyi yay, gitmesine izin ver',
        tradeoff: { gain: 'Sistem güçlenir', cost: 'Kısa süre yavaşlama' },
        effects: { modifiers: [mod('production', 0.85, 30)] },
        delayed: { days: 45, effects: { modifiers: [mod('production', 1.1, 60)] }, note: 'Ekip bilgiyi paylaşınca hızlandı.' },
        reflection: 'Kişiye değil sisteme yatırım, uzun vadede taşır.',
        conceptId: 'ten-x-myth',
      },
    ],
  },
  {
    id: 'crunch-vs-launch',
    stage: 3,
    maxStage: 4,
    category: 'normal',
    speaker: 'cofounder',
    question: 'Lansmana iki hafta var ve yetişmeyecek. Crunch mı, erteleme mi?',
    options: [
      {
        label: 'Crunch yap',
        tradeoff: { gain: 'Lansman zamanında', cost: 'Moral ve teknik borç' },
        effects: { morale: -8, techDebt: 8, maturity: 0.05, setFlag: ['crunch', 'rushedProject'] },
        reflection: 'Crunch bir kez işe yarar, alışkanlık olursa yorar.',
        conceptId: 'tech-debt',
      },
      {
        label: 'İki hafta ertele',
        tradeoff: { gain: 'Ekip dinlenir, kalite artar', cost: 'Basın ilgisi soğur' },
        effects: { reputation: -3, morale: 3, maturity: 0.02 },
        reflection: 'Ertelenen tarih unutulur, kötü lansman hatırlanır.',
        conceptId: 'tech-debt',
      },
    ],
  },

  // =========================================================== Series B (4)
  {
    id: 'gdpr-audit',
    stage: 4,
    maxStage: 5,
    category: 'normal',
    speaker: 'accountant',
    question: 'Veri koruma denetimi kapıda. Hazır mıyız?',
    options: [
      {
        label: 'Danışman tut, hazırlan',
        tradeoff: { gain: 'Kurumsal kapı açılır', cost: 'Bütçeden pay' },
        effects: { cashPercent: -0.04, reputation: 6, queueConcept: 'compliance' },
        reflection: 'Uyum, görünmeyen bir satış ekibidir.',
        conceptId: 'compliance',
      },
      {
        label: 'Asgari hazırlıkla geç',
        tradeoff: { gain: 'Para kasada kalır', cost: 'Ceza riski' },
        effects: {},
        delayed: { days: 60, effects: { cashPercent: -0.08, reputation: -5 }, note: 'Denetimde eksikler çıktı.' },
        reflection: 'Uyumu ertelemek, faturayı ertelemektir.',
        conceptId: 'compliance',
      },
    ],
  },
  {
    id: 'cloud-bill-shock',
    stage: 4,
    maxStage: 5,
    category: 'normal',
    speaker: 'engineer',
    question: 'Bu ayki bulut faturası iki katına çıktı.',
    options: [
      {
        label: 'Optimizasyona ekip ayır',
        tradeoff: { gain: 'Altyapı ucuzlar', cost: 'Bir sprint gider' },
        effects: { modifiers: [mod('production', 0.9, 20)] },
        delayed: { days: 30, effects: { cashPercent: 0.03 }, note: 'Optimizasyon faturayı düşürdü.' },
        reflection: 'Görünmeyen gider, görünür hale gelince küçülür.',
        conceptId: 'burn',
      },
      {
        label: 'Öde, büyümeye devam',
        tradeoff: { gain: 'Hız korunur', cost: 'Kasa erir' },
        effects: { cashPercent: -0.05 },
        reflection: 'Büyümenin bir altyapı faturası vardır.',
        conceptId: 'burn',
      },
    ],
  },
  {
    id: 'talent-raid',
    stage: 4,
    maxStage: 5,
    category: 'normal',
    speaker: 'cofounder',
    question: 'Büyük bir teknoloji şirketi ekibimizden insan topluyor.',
    options: [
      {
        label: 'Maaşları artır',
        tradeoff: { gain: 'Ekip kalır', cost: 'Burn artar' },
        effects: { cashPercent: -0.05, morale: 6 },
        reflection: 'Para tutar, tek başına bağlamaz.',
        conceptId: 'morale-compounds',
      },
      {
        label: 'Hisse opsiyonu dağıt',
        tradeoff: { gain: 'Aidiyet artar', cost: 'Hissen azalır' },
        effects: { equity: -0.02, morale: 8 },
        reflection: 'Ortak gibi hisseden ekip, ortak gibi davranır.',
        conceptId: 'cap-table-health',
      },
      {
        label: 'Misyona güven',
        tradeoff: { gain: 'Ek maliyet yok', cost: 'Bazıları gidebilir' },
        effects: { morale: -5 },
        reflection: 'Misyon güçlüdür, rakip teklif de öyle.',
        conceptId: 'morale-compounds',
      },
    ],
  },
  {
    id: 'international-launch',
    stage: 4,
    maxStage: 5,
    category: 'normal',
    speaker: 'investor',
    question: 'Yurt dışına açılma zamanı mı? Yeni pazar, yeni dertler demek.',
    options: [
      {
        label: 'Yurt dışına açıl',
        tradeoff: { gain: 'Büyük yeni pazar', cost: 'Maliyet ve karmaşa' },
        effects: { cashPercent: -0.1, setFlag: 'platformPath', modifiers: [mod('production', 0.9, 45)] },
        delayed: { days: 60, effects: { usersPercent: 0.2 }, note: 'Yeni pazardan kullanıcılar geliyor.' },
        reflection: 'Yeni pazar, yeni bir şirket kurmak gibidir.',
        conceptId: 'focus',
      },
      {
        label: 'Ev pazarını derinleştir',
        tradeoff: { gain: 'Güçlü, sadık taban', cost: 'Büyüme tavanı' },
        effects: { setFlag: 'nichePath', modifiers: [mod('churn', 0.9, 90)] },
        reflection: 'Derin kök, rüzgârda devrilmez.',
        conceptId: 'focus',
      },
    ],
  },

  // =========================================================== Series C (3; acquisition-offer = investor thread step 5)
  {
    id: 'acquisition-offer',
    stage: 5,
    category: 'normal',
    speaker: 'investor',
    thread: { id: 'investor', step: 5 },
    question: 'Büyük bir şirket bizi satın almak istiyor. Rakam cazip.',
    condition: strongRival,
    // The sale comes last (old saves' option indexes keep their meaning) and is never the default: an unanswered card
    // closes the door and does not end the run.
    defaultOption: 1,
    options: [
      {
        label: 'Masaya otur, satma',
        tradeoff: { gain: 'Değerleme kanıtı, itibar', cost: 'Yönetim zamanı ve enerji' },
        effects: { reputation: 8, energy: -15 },
        reflection: 'Teklif almak, değerinin dışarıdan teyididir.',
        conceptId: 'no-single-path',
      },
      {
        label: 'Kapıyı nazikçe kapat',
        tradeoff: { gain: 'Odak ve moral', cost: 'Güvenli çıkış kaçar' },
        effects: { morale: 5 },
        reflection: 'Hedefi bilen, cazip teklife de hayır diyebilir.',
        conceptId: 'no-single-path',
      },
      {
        label: 'Sat, oyunu bitir',
        tradeoff: { gain: 'Güvenli çıkış, hisse paraya döner', cost: 'Unicorn yolu burada biter' },
        effects: { setFlag: SOLD_FLAG },
        reflection: 'Satmak da bir varış; yalnız başka bir yere.',
        conceptId: 'no-single-path',
      },
    ],
  },
  {
    id: 'secondary-sale',
    stage: 5,
    category: 'normal',
    speaker: 'investor',
    question: 'Hissenin bir kısmını satıp kişisel olarak rahatlayabilirsin.',
    options: [
      {
        label: '%3 sat',
        tradeoff: { gain: 'Kişisel güvence ve enerji', cost: 'Hissen azalır' },
        effects: { equity: -0.03, energy: 30 },
        reflection: 'Rahat bir kurucu, uzun vadeli düşünebilir.',
        conceptId: 'cap-table-health',
      },
      {
        label: 'Tümünü tut',
        tradeoff: { gain: 'Tam pay sende', cost: 'Kişisel risk sürer' },
        effects: { energy: -5 },
        reflection: 'Tüm yumurtalar tek sepette, sepeti iyi tanıyorsan.',
        conceptId: 'cap-table-health',
      },
    ],
  },
  {
    // Not a thread step: the investor thread shows one card per stage, so a second step 5 would hide the exit offer.
    id: 'ipo-vs-stay-private',
    stage: 5,
    category: 'normal',
    speaker: 'investor',
    question: 'Halka arz konuşulmaya başlandı. Hazır mıyız?',
    options: [
      {
        label: 'Hazırlık başlat',
        tradeoff: { gain: 'İtibar ve likidite yolu', cost: 'Uyum yükü ve maliyet' },
        effects: { reputation: 10, cashPercent: -0.05, modifiers: [mod('production', 0.95, 60)] },
        reflection: 'Halka arz bir varış değil, yeni bir başlangıçtır.',
        conceptId: 'compliance',
      },
      {
        label: 'Özel şirket kal',
        tradeoff: { gain: 'Esneklik ve hız', cost: 'Yatırımcılar sabırsızlanır' },
        effects: { morale: 3 },
        reflection: 'Özel kalmak, kendi saatine göre koşmaktır.',
        conceptId: 'no-single-path',
      },
    ],
  },

  // =========================================================== Kriz (3, every stage; + the angel, up to Seed)
  {
    id: 'payroll-risk',
    stage: 0,
    category: 'crisis',
    speaker: 'accountant',
    question: 'Gelecek ayın maaşları risk altında. Nasıl ilerleyelim?',
    condition: (s) => s.stats.cash > 0 && s.finance.runway !== null && s.finance.runway < 1.5,
    weight: 3,
    once: false,
    options: [
      {
        label: 'Maaşları bir ay ertele',
        tradeoff: { gain: '+%15 kasa (bir kerelik)', cost: 'Moral belirgin düşer' },
        effects: { cashPercent: 0.15, morale: -10 },
        reflection: 'Zor anda açık konuşmak, güveni korur.',
        conceptId: 'runway',
      },
      {
        label: 'Kurucu maaşından vazgeç',
        tradeoff: { gain: 'Ekip korunur', cost: 'Enerjin düşer' },
        effects: { cashPercent: 0.08, energy: -20, morale: 3 },
        reflection: 'Yükü önce kurucu taşıyınca ekip de omuz verir.',
        conceptId: 'burn',
      },
    ],
  },
  {
    id: 'vc-bridge-loan',
    stage: 1,
    category: 'crisis',
    speaker: 'investor',
    question: 'Tur bitmeden kasa bitebilir. Mevcut yatırımcı köprü kredi öneriyor.',
    condition: (s) => !s.finance.loan && s.round?.active === true && s.finance.runway !== null && s.finance.runway < 2,
    weight: 3,
    options: [
      {
        label: 'Köprüyü al',
        tradeoff: { gain: 'Dört aylık gider kasada', cost: '%3 hisse, faiz, şart' },
        effects: { loan: { burnMonths: 4, months: 9, rate: 0.02, covenantRunway: 2 }, equity: -0.03 },
        reflection: 'Köprü, karşıya geçmek için; üstünde yaşamak için değil.',
        conceptId: 'fundraise-time',
      },
      {
        label: 'Turu hızlandır, az al',
        tradeoff: { gain: 'Hisse korunur', cost: 'Teklif küçülür' },
        effects: { roundWeeks: -2, reputation: -3 },
        reflection: 'Az ama zamanında gelen para, çok ama geç gelenden iyidir.',
        conceptId: 'fundraise-time',
      },
    ],
  },
  {
    id: 'emergency-loan',
    stage: 0,
    category: 'crisis',
    speaker: 'mentor',
    question: 'Kasa eksiye düştü. Birlikte bir çıkış yolu bulalım.',
    // One loan only: with a loan running this rescue does not come (GAMEPLAY V2 §6.2).
    condition: (s) => s.stats.cash < 0 && !s.finance.loan,
    weight: 5,
    once: false,
    // The rescue must land well before the 60-day bankruptcy clock: unanswered, the savings go in after 14 days.
    defaultOption: 1,
    defaultAfterDays: 14,
    options: [
      {
        label: 'Acil kredi çek',
        tradeoff: { gain: 'Üç aylık gider kasada', cost: 'Faiz ve runway şartı' },
        effects: { loan: { burnMonths: 3, months: 12, rate: 0.03, covenantRunway: 1 } },
        reflection: 'Kredi zaman satın alır; zamanı ne için kullanacağın önemli.',
        conceptId: 'runway',
      },
      {
        label: 'Kişisel birikimini koy',
        tradeoff: { gain: 'Kontrol sende', cost: 'Kişisel risk ve enerji' },
        effects: { cash: 8000, energy: -25 },
        reflection: 'Kendi parası ortada olan kurucu, her doları iki kez sayar.',
        conceptId: 'burn',
      },
    ],
  },
  {
    // GAMEPLAY V2 §5.2: the one-time angel. Only the engine brings it (first missed payroll up to Seed), never a roll.
    id: 'angel-lifeline',
    stage: 0,
    maxStage: 2,
    category: 'crisis',
    speaker: 'investor',
    question: 'Maaş kaçtı. Bir melek yatırımcı tek seferlik can simidi uzatıyor.',
    condition: () => false,
    defaultOption: 0,
    defaultAfterDays: 14,
    options: [
      {
        label: 'Uzatılan simidi al',
        tradeoff: { gain: 'İki aylık gider kasada', cost: '%5 hisse' },
        effects: { cashBurnMonths: 2, equity: -0.05 },
        reflection: 'İkinci şans bir kez gelir; zamanı iyi kullan.',
        conceptId: 'runway',
      },
      {
        label: 'Kendi yolunu bul',
        tradeoff: { gain: 'Hisse korunur', cost: 'Olağan kurtarma masada' },
        effects: { queueCard: 'emergency-loan' },
        reflection: 'Hisse sende kalır; çıkış yolu yine masada.',
        conceptId: 'burn',
      },
    ],
  },

  // =========================================================== Rakip (3, a rival in the market; rival thread step 3, up to Series A)
  {
    id: 'rival-price-war',
    stage: 2,
    maxStage: 3,
    category: 'rival',
    speaker: 'customer',
    thread: { id: 'rival', step: 3 },
    question: 'Rakip fiyatını yarıya indirdi. Kullanıcılar soruyor.',
    condition: rivalNear,
    options: [
      {
        label: 'Fiyatı düşür',
        tradeoff: { gain: 'Kullanıcı kalır', cost: 'Gelir düşer' },
        effects: { modifiers: [mod('arpu', 0.85, 90), mod('churn', 0.9, 90)] },
        reflection: 'Fiyat savaşının kazananı genelde en derin cep olur.',
        conceptId: 'pricing',
      },
      {
        label: 'Değere odaklan',
        tradeoff: { gain: 'Marj korunur, ürün güçlenir', cost: 'Bir süre churn artar' },
        effects: { maturity: 0.04, modifiers: [mod('churn', 1.1, 45)] },
        reflection: 'Ucuz olmak yerine vazgeçilmez olmak da bir yol.',
        conceptId: 'pricing',
      },
    ],
  },
  {
    id: 'rival-talent-raid',
    stage: 2,
    maxStage: 3,
    category: 'rival',
    speaker: 'cofounder',
    thread: { id: 'rival', step: 3 },
    question: 'Rakip ekibimizden iki kişiye teklif götürmüş.',
    condition: (s) => rivalNear(s) && s.derived.teamSize >= 4,
    options: [
      {
        label: 'Tutma primi ver',
        tradeoff: { gain: 'Ekip kalır', cost: 'Kasadan pay' },
        effects: { cashPercent: -0.04, morale: 5 },
        reflection: 'Prim bugünü tutar, kültür yarını.',
        conceptId: 'culture-freezes',
      },
      {
        label: 'Kültüre yatırım yap',
        tradeoff: { gain: 'Uzun vadeli bağlılık', cost: 'Kısa süre yavaşlama' },
        effects: { morale: 3, modifiers: [mod('morale', 4, 90), mod('production', 0.95, 14)] },
        reflection: 'İnsanlar şirketten çok, ekipten ayrılmakta zorlanır.',
        conceptId: 'culture-freezes',
      },
    ],
  },
  {
    id: 'rival-copycat-feature',
    stage: 2,
    maxStage: 3,
    category: 'rival',
    speaker: 'engineer',
    thread: { id: 'rival', step: 3 },
    question: 'Rakip en sevilen özelliğimizi birebir kopyaladı.',
    condition: rivalNear,
    options: [
      {
        label: 'Hemen karşılık ver',
        tradeoff: { gain: 'Önde kalırsın', cost: 'Aceleci kod, borç' },
        effects: { maturity: 0.03, techDebt: 6, setFlag: 'rushedProject' },
        reflection: 'Rakibe koşmak, kendi yolundan sapmak olabilir.',
        conceptId: 'tech-debt',
      },
      {
        label: 'Yol haritana sadık kal',
        tradeoff: { gain: 'Tutarlı ürün, itibar', cost: 'Bir süre organik yavaşlar' },
        effects: { reputation: 3, modifiers: [mod('organic', 0.9, 30)] },
        reflection: 'Kopyalanan özellik, kopyalanamayan vizyonu gösterir.',
        conceptId: 'feature-vs-product',
      },
    ],
  },
]

/**
 * GAMEPLAY V2 §8.3: brought by the engine when the board's quarter is missed twice in a row (never rolled). It takes
 * the next card slot like a crisis card; the multiple stays capped until a quarter is hit, whatever is picked.
 */
export const BOARD_CARDS: readonly DecisionCard[] = [
  {
    id: 'board-review',
    stage: 3,
    category: 'crisis',
    speaker: 'investor',
    question: 'Kurul iki çeyrektir hedefi kaçırdı. CEO değişimi mi, plan revizyonu mu?',
    condition: () => false,
    once: false,
    defaultAfterDays: 30,
    options: [
      {
        label: 'Deneyimli CEO getir',
        tradeoff: { gain: 'Kurul sakinleşir, ekip hızlı kalır', cost: '%2 hisse yeni CEO’ya' },
        effects: { equity: -0.02 },
        reflection: 'Kontrolü paylaşmak, bazen şirketi korumanın bedelidir.',
        conceptId: 'cap-table-health',
      },
      {
        label: 'Planı revize et',
        tradeoff: { gain: 'Hisse sende kalır', cost: 'İki ay üretim yavaşlar' },
        effects: { modifiers: [mod('production', 0.9, 60)] },
        reflection: 'Gerçekçi plan, tekrar kaçırılan hedeften iyidir.',
        conceptId: 'no-single-path',
      },
    ],
  },
]
