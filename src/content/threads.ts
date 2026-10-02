// GAMEPLAY V2 §9.2 card threads (22 cards, 5 threads) and the 4 secret cards. Speakers are roles only: the UI puts
// the run's cast name on them (state.cast), so no card text names a person or a rival.
// Thread notes for the engine:
//   - step > 1 waits for the thread's step − 1 card; `after` narrows it to the options listed (decisions.ts threadOpen).
//   - One card per thread per stage; thread cards weigh THREAD_CARD_WEIGHT (3) and take the shared card cooldown.
//   - Steps that live in decisions.ts: investor 5 (acquisition-offer), rival 3 (the 3 rival cards).
//   - Conditions read existing state only (receipts, rivals, founder, flags).
import type { GameState, ModifierKind, MonthReceipt, ReceiptEntry } from '../engine/types'
import type { DecisionCard } from './types'

const mod = (kind: ModifierKind, value: number, days: number) => ({ kind, value, days })
/** The Pre-seed round is open or done: the five-step threads (investor, rival) may start in its Garaj weeks. */
const roundHeard = (s: GameState): boolean => s.stage >= 1 || s.round?.active === true
/** Set by rival-dies. T17: the engine removes that rival; until then the thread's later steps stay shut. */
const RIVAL_GONE_FLAG = 'rivalGone'
const rivalStands = (s: GameState): boolean => s.flags[RIVAL_GONE_FLAG] === undefined

// =========================================================== Threads (22)
export const THREAD_CARDS: readonly DecisionCard[] = [
  // ----------------------------------------------------------- Mentor (6: Garaj → C)
  {
    id: 'mentor-coffee',
    stage: 0,
    maxStage: 1,
    category: 'thread',
    speaker: 'mentor',
    thread: { id: 'mentor', step: 1 },
    question: 'Bir kahve içelim mi? Ne yaptığını bana bir de sen anlat.',
    options: [
      {
        label: 'Otur, anlat',
        tradeoff: { gain: 'Fikir netleşir', cost: 'Biraz enerji' },
        effects: { maturity: 0.02, energy: -5 },
        reflection: 'Anlatırken neyi bilmediğini kendin duydun.',
        conceptId: 'focus',
      },
      {
        label: 'Şimdi vaktim yok',
        tradeoff: { gain: 'İş durmaz', cost: 'Dış göz kaçar' },
        effects: { energy: 3 },
        reflection: 'Kahve bekler, kapı açık kaldı.',
        conceptId: 'focus',
      },
    ],
  },
  {
    id: 'mentor-runway',
    stage: 1,
    maxStage: 2,
    category: 'thread',
    speaker: 'mentor',
    thread: { id: 'mentor', step: 2 },
    question: 'Kasaya bakmadan söyle: kaç ay dayanırsın?',
    options: [
      {
        label: 'Birlikte hesaplayalım',
        tradeoff: { gain: 'Runway netleşir', cost: 'Bir akşamın gider' },
        effects: { energy: -5, queueConcept: 'runway' },
        reflection: 'Kaç ay kaldığını bilen, paniği erken yaşar.',
        conceptId: 'runway',
      },
      {
        label: 'İçgüdüme güvenirim',
        tradeoff: { gain: 'Hız korunur', cost: 'Tahmin tahmin kalır' },
        effects: { morale: 2 },
        reflection: 'İçgüdü hızlıdır, kasa ise sayıyla konuşur.',
        conceptId: 'burn',
      },
    ],
  },
  {
    id: 'mentor-hire',
    stage: 2,
    maxStage: 3,
    category: 'thread',
    speaker: 'mentor',
    thread: { id: 'mentor', step: 3 },
    question: 'Ekip büyüyor. Kimi işe almayacağını biliyor musun?',
    options: [
      {
        label: 'Çıtayı yaz',
        tradeoff: { gain: 'Ekip uyumlu kalır', cost: 'Alım yavaşlar' },
        effects: { morale: 4, modifiers: [mod('production', 0.95, 20)] },
        reflection: 'Yazılı çıta, acele günlerinde seni tutar.',
        conceptId: 'hire-bar',
      },
      {
        label: 'Görünce anlarım',
        tradeoff: { gain: 'Hızlı alım', cost: 'Uyumsuz biri sızar' },
        effects: { modifiers: [mod('production', 1.05, 20), mod('morale', -3, 45)] },
        reflection: 'Görünce anlamak, yorgun günde kolay şaşar.',
        conceptId: 'hire-bar',
      },
    ],
  },
  {
    id: 'mentor-scale',
    stage: 3,
    maxStage: 4,
    category: 'thread',
    speaker: 'mentor',
    thread: { id: 'mentor', step: 4 },
    question: 'Reklam açınca büyüyorsun. Kapatınca kim kalıyor, hiç baktın mı?',
    options: [
      {
        label: 'Bir hafta kapat',
        tradeoff: { gain: 'Organik taban görünür', cost: 'Yeni kullanıcı azalır' },
        effects: { queueConcept: 'organic-vs-paid', modifiers: [mod('cac', 0.9, 60), mod('organic', 0.9, 7)] },
        reflection: 'Reklamsız kalanlar, gerçek kullanıcılarındır.',
        conceptId: 'organic-vs-paid',
      },
      {
        label: 'Gaza devam',
        tradeoff: { gain: 'Büyüme sürer', cost: 'Reklam pahalanır' },
        effects: { modifiers: [mod('cac', 1.1, 60)] },
        reflection: 'Satın alınan büyüme, faturayla birlikte gelir.',
        conceptId: 'ltv-cac',
      },
    ],
  },
  {
    id: 'mentor-product',
    stage: 4,
    maxStage: 5,
    category: 'thread',
    speaker: 'mentor',
    thread: { id: 'mentor', step: 5 },
    question: 'Ürününü en son ne zaman kendin kullandın?',
    options: [
      {
        label: 'Bir gün kullan',
        tradeoff: { gain: 'Ürün olgunlaşır', cost: 'Bir gün toplantısız' },
        effects: { maturity: 0.03, energy: -5 },
        reflection: 'Kendi ürününe takılınca, kullanıcın neden gittiğini görürsün.',
        conceptId: 'feature-vs-product',
      },
      {
        label: 'Ekip kullanıyor',
        tradeoff: { gain: 'Zaman sende kalır', cost: 'Ürün uzaklaşır' },
        effects: { energy: 5 },
        reflection: 'Rapor okumak, ürünü elde tutmaya benzemez.',
        conceptId: 'feature-vs-product',
      },
    ],
  },
  {
    id: 'mentor-your-way',
    stage: 5,
    category: 'thread',
    speaker: 'mentor',
    thread: { id: 'mentor', step: 6 },
    question: 'Buraya kimseyi taklit etmeden geldin. Son düzlükte ne yapacaksın?',
    options: [
      {
        label: 'Kendi yolumdan',
        tradeoff: { gain: 'Ekip sana güvenir', cost: 'Kestirme yok' },
        effects: { morale: 6 },
        reflection: 'Bu yolu sen çizdin, sonunu da sen yürü.',
        conceptId: 'no-single-path',
      },
      {
        label: 'Bir hızlanalım',
        tradeoff: { gain: 'Tur hızlanır', cost: 'Ekip yorulur' },
        effects: { modifiers: [mod('roundSpeed', 1.15, 90), mod('morale', -3, 60)] },
        reflection: 'Son düzlükte hız, yorgunluğu da büyütür.',
        conceptId: 'no-single-path',
      },
    ],
  },

  // ----------------------------------------------------------- Yatırımcı (4 here: Pre-seed round → B; step 5 = exit cards)
  {
    id: 'investor-intro',
    stage: 0,
    maxStage: 1,
    category: 'thread',
    speaker: 'investor',
    thread: { id: 'investor', step: 1 },
    // From the Garaj round on. Each step closes one stage before the next one does, so a late step never pushes the
    // next past its window: one card per thread per stage, and step 5 (the exit offer) has Series C only.
    condition: roundHeard,
    question: 'Turunu duydum. Masada bana da bir sandalye var mı?',
    options: [
      {
        label: 'Sandalye ayır',
        tradeoff: { gain: 'Tur hızlanır', cost: '%1 hisse' },
        effects: { equity: -0.01, modifiers: [mod('roundSpeed', 1.15, 90)] },
        reflection: 'İlk dost yatırımcı, sonraki kapıları da çalar.',
        conceptId: 'fundraise-time',
      },
      {
        label: 'Önce ürün',
        tradeoff: { gain: 'Hisse sende', cost: 'Tur kendi hızında' },
        effects: { reputation: 2 },
        reflection: 'Beklettiğin yatırımcı, rakamlarla geri gelir.',
        conceptId: 'fundraise-time',
      },
    ],
  },
  {
    id: 'investor-monthly',
    stage: 1,
    maxStage: 2,
    category: 'thread',
    speaker: 'investor',
    thread: { id: 'investor', step: 2 },
    question: 'Rakamlarını her ay görmek isterim. Paylaşır mısın?',
    options: [
      {
        label: 'Her ay paylaş',
        tradeoff: { gain: 'Güven, hızlı tur', cost: 'Her ay hesap' },
        effects: { energy: -5, reputation: 3, modifiers: [mod('roundSpeed', 1.1, 90)] },
        reflection: 'Düzenli rapor, kötü ayı da konuşulabilir yapar.',
        conceptId: 'fundraise-time',
      },
      {
        label: 'Çeyrekte bir',
        tradeoff: { gain: 'Zaman sende', cost: 'Güven yavaş kurulur' },
        effects: { energy: 5, modifiers: [mod('roundSpeed', 0.95, 60)] },
        reflection: 'Az rapor, az soru getirir, az güven de.',
        conceptId: 'fundraise-time',
      },
    ],
  },
  {
    id: 'investor-board',
    stage: 2,
    maxStage: 3,
    category: 'thread',
    speaker: 'investor',
    thread: { id: 'investor', step: 3 },
    question: 'Artık kuruldayım. Kötü haberi senden önce duymayayım, olur mu?',
    options: [
      {
        label: 'Önce sana gelirim',
        tradeoff: { gain: 'Kurul arkanda durur', cost: 'Her kriz masaya gelir' },
        effects: { reputation: 4, energy: -5 },
        reflection: 'Erken gelen kötü haber, kurulda ortak dert olur.',
        conceptId: 'cap-table-health',
      },
      {
        label: 'Çözüp gelirim',
        tradeoff: { gain: 'Masa sakin kalır', cost: 'Sürpriz güveni yorar' },
        effects: { morale: 2 },
        delayed: { days: 40, effects: { reputation: -4 }, note: 'Kurul bir krizi basından duydu.' },
        reflection: 'Saklanan haber, kurula başkasından ulaşır.',
        conceptId: 'cap-table-health',
      },
    ],
  },
  {
    id: 'investor-target',
    stage: 3,
    // Series B at the latest (§9.2): Series C stays free for step 5, the exit offer.
    maxStage: 4,
    category: 'thread',
    speaker: 'investor',
    thread: { id: 'investor', step: 4 },
    question: 'Gelecek yıl üç kat büyüme bekliyorum. Yapabilir misin?',
    options: [
      {
        label: 'Hedefi kabul et',
        tradeoff: { gain: 'Tur kapısı açılır', cost: 'Ekip baskı altında' },
        effects: { reputation: 4, modifiers: [mod('roundSpeed', 1.15, 120), mod('morale', -4, 60)] },
        reflection: 'Kabul ettiğin hedef, her ay masaya gelir.',
        conceptId: 'premature-scaling',
      },
      {
        label: 'Kendi hedefimi koyarım',
        tradeoff: { gain: 'Ekip nefes alır', cost: 'Kurul soğur' },
        effects: { morale: 4, modifiers: [mod('roundSpeed', 0.9, 90)] },
        reflection: 'Tutturabileceğin hedef, tutmadığın sözden iyidir.',
        conceptId: 'premature-scaling',
      },
    ],
  },

  // ----------------------------------------------------------- Müşteri (4: Garaj → B)
  {
    id: 'customer-first',
    stage: 0,
    maxStage: 1,
    category: 'thread',
    speaker: 'customer',
    thread: { id: 'customer', step: 1 },
    question: 'Ürününü bir arkadaşım önerdi. Bana nasıl kullanıldığını gösterir misin?',
    options: [
      {
        label: 'Ekranını paylaş',
        tradeoff: { gain: 'Sadık ilk kullanıcı', cost: 'Kurucu enerjisi' },
        effects: { users: 3, energy: -8, maturity: 0.02 },
        reflection: 'Yanında oturduğun kullanıcı, takıldığı yeri gösterir.',
        conceptId: 'dont-scale',
      },
      {
        label: 'Kısa rehber gönder',
        tradeoff: { gain: 'Zaman sende', cost: 'Kullanıcı kaybolabilir' },
        effects: { users: 1 },
        reflection: 'Rehber yazılır, ama kimse sonuna kadar okumaz.',
        conceptId: 'dont-scale',
      },
    ],
  },
  {
    id: 'customer-pays',
    stage: 2,
    maxStage: 3,
    category: 'thread',
    speaker: 'customer',
    thread: { id: 'customer', step: 2 },
    question: 'Ücretsiz sürüm bana yetiyordu. Neden şimdi ödeyeyim?',
    options: [
      {
        label: 'Farkı göster',
        tradeoff: { gain: 'Ödeyen kullanıcı', cost: 'Ürün işi artar' },
        effects: { maturity: 0.03, modifiers: [mod('arpu', 1.05, 90), mod('production', 0.95, 20)] },
        reflection: 'Para, işini çözen şeye ödenir.',
        conceptId: 'pricing',
      },
      {
        label: 'İlk yıl indirim',
        tradeoff: { gain: 'Kullanıcı kalır', cost: 'Gelir düşük' },
        effects: { modifiers: [mod('churn', 0.9, 90), mod('arpu', 0.95, 90)] },
        reflection: 'İndirim kapıyı tutar, değeri ürün anlatır.',
        conceptId: 'churn',
      },
    ],
  },
  {
    id: 'customer-sla',
    stage: 3,
    maxStage: 4,
    category: 'thread',
    speaker: 'customer',
    thread: { id: 'customer', step: 3 },
    question: 'Şirketim seni kullanmak istiyor. Sistem çökerse bana ne olacak?',
    options: [
      {
        label: 'Yazılı söz ver',
        tradeoff: { gain: 'Kurumsal güven', cost: 'Mühendislik yükü' },
        effects: { reputation: 5, modifiers: [mod('production', 0.95, 30)] },
        reflection: 'Yazılı söz, büyük şirketin kapısını açar.',
        conceptId: 'compliance',
      },
      {
        label: 'Elimizden geleni',
        tradeoff: { gain: 'Ekip serbest', cost: 'Şirket tereddüt eder' },
        effects: { reputation: -2, energy: 3 },
        reflection: 'Büyük müşteri sözden önce kâğıda bakar.',
        conceptId: 'compliance',
      },
    ],
  },
  {
    id: 'customer-renewal',
    stage: 4,
    maxStage: 5,
    category: 'thread',
    speaker: 'customer',
    thread: { id: 'customer', step: 4 },
    question: 'Sözleşmem bitiyor. Bir yıl daha kalayım mı, düşünüyorum.',
    options: [
      {
        label: 'Yanına git, dinle',
        tradeoff: { gain: 'Müşteri kalır', cost: 'Kurucu enerjisi' },
        effects: { energy: -10, modifiers: [mod('churn', 0.9, 90)] },
        reflection: 'Masaya giden kurucu, sözleşmeyi masada tutar.',
        conceptId: 'concentration',
      },
      {
        label: 'Fiyatı sabitle',
        tradeoff: { gain: 'Kolay yenileme', cost: 'Gelir artmaz' },
        effects: { modifiers: [mod('arpu', 0.95, 90), mod('churn', 0.92, 90)] },
        reflection: 'Sabit fiyat bugünü tutar, büyümeyi bekletir.',
        conceptId: 'pricing',
      },
    ],
  },

  // ----------------------------------------------------------- Rakip (5 here: Pre-seed round, Seed, B ×2, C; step 3 = rival cards)
  {
    id: 'rival-rumor',
    stage: 0,
    maxStage: 2,
    category: 'thread',
    speaker: 'cofounder',
    thread: { id: 'rival', step: 1 },
    condition: roundHeard,
    question: 'Duydun mu? Birileri bizim fikrin üstünde çalışıyormuş.',
    options: [
      {
        label: 'Hızlanalım',
        tradeoff: { gain: 'Önde kalırsın', cost: 'Ekip yorulur' },
        effects: { modifiers: [mod('production', 1.1, 20), mod('morale', -3, 30)] },
        reflection: 'Adı olmayan rakip, yine de temponu değiştirdi.',
        conceptId: 'focus',
      },
      {
        label: 'Kendi işimize bakalım',
        tradeoff: { gain: 'Sakin ekip', cost: 'Göz kapalı kalır' },
        effects: { morale: 2 },
        reflection: 'Söylentiye koşmayan ekip, kendi işini bitirir.',
        conceptId: 'focus',
      },
    ],
  },
  {
    id: 'rival-born',
    stage: 2,
    maxStage: 3,
    category: 'thread',
    speaker: 'engineer',
    thread: { id: 'rival', step: 2 },
    question: 'Rakip çıktı. Ürünü bizimkine fazla benziyor.',
    condition: (s) => (s.rivals?.length ?? 0) > 0,
    options: [
      {
        label: 'Ürününü incele',
        tradeoff: { gain: 'Farkı görürsün', cost: 'Bir hafta gider' },
        effects: { maturity: 0.03, modifiers: [mod('production', 0.95, 7)] },
        reflection: 'Rakibi tanıyan, kendi farkını daha net görür.',
        conceptId: 'feature-vs-product',
      },
      {
        label: 'Görmezden gel',
        tradeoff: { gain: 'Odak korunur', cost: 'Pazar payı sızar' },
        effects: { morale: 2, modifiers: [mod('organic', 0.95, 30)] },
        reflection: 'Bakmadığın rakip, bakmadığın yerden büyür.',
        conceptId: 'focus',
      },
    ],
  },
  {
    // Step 3 option 0 (price cut / retention bonus / quick answer): the rival bled, the player can buy it.
    id: 'rival-buy-them',
    stage: 4,
    maxStage: 5,
    category: 'thread',
    speaker: 'investor',
    condition: rivalStands,
    thread: { id: 'rival', step: 4, after: [0] },
    question: 'Rakip zorlanıyor. Onları satın almayı düşünür müsün?',
    options: [
      {
        label: 'Teklif hazırla',
        tradeoff: { gain: 'Rakip masaya gelir', cost: 'Kasadan pay' },
        // T17: acquireRival reads flags.rivalBuyIntent (the offer opens on the market screen).
        effects: { cashPercent: -0.05, reputation: 4, setFlag: 'rivalBuyIntent' },
        reflection: 'Rakibi almak, pazarı tek hamlede büyütür.',
        conceptId: 'concentration',
      },
      {
        label: 'Pazarda yen',
        tradeoff: { gain: 'Kasa sende', cost: 'Savaş sürer' },
        effects: { morale: 3 },
        reflection: 'Pazarda kazanılan pay, kimseye borçlu değil.',
        conceptId: 'no-single-path',
      },
    ],
  },
  {
    // Step 3 option 1 (held the price / culture / roadmap): the rival grew, it comes to buy.
    id: 'rival-buys-you',
    stage: 4,
    maxStage: 5,
    category: 'thread',
    speaker: 'investor',
    condition: rivalStands,
    thread: { id: 'rival', step: 4, after: [1] },
    question: 'Rakip bizi satın almak istiyor. Masaya oturalım mı?',
    options: [
      {
        label: 'Dinle, satma',
        tradeoff: { gain: 'Değerin teyit edilir', cost: 'Enerji gider' },
        effects: { reputation: 4, energy: -10 },
        reflection: 'Teklif almak, rakibin seni ciddiye aldığını gösterir.',
        conceptId: 'no-single-path',
      },
      {
        label: 'Kapıyı kapat',
        tradeoff: { gain: 'Ekip moral bulur', cost: 'Masa kapanır' },
        effects: { morale: 4 },
        reflection: 'Satılık olmadığını ekibin de duydu.',
        conceptId: 'no-single-path',
      },
    ],
  },
  {
    id: 'rival-ipo-race',
    stage: 5,
    category: 'thread',
    speaker: 'cofounder',
    thread: { id: 'rival', step: 5 },
    condition: rivalStands,
    question: 'Rakip halka arz için başvurmuş. Biz yarışa girecek miyiz?',
    options: [
      {
        label: 'Yarışa gir',
        tradeoff: { gain: 'Tur hızlanır', cost: 'Ekip yorulur' },
        effects: { reputation: 5, modifiers: [mod('roundSpeed', 1.15, 90), mod('morale', -3, 60)] },
        reflection: 'Yarışı rakip başlattı, bitişi sen seçtin.',
        conceptId: 'no-single-path',
      },
      {
        label: 'Kendi saatimizle',
        tradeoff: { gain: 'Odak korunur', cost: 'Manşet onların' },
        effects: { morale: 3 },
        reflection: 'Başkasının saatiyle koşan, kendi yolunu kaybeder.',
        conceptId: 'no-single-path',
      },
    ],
  },

  // ----------------------------------------------------------- Basın (3: Seed → B)
  {
    id: 'press-first-story',
    stage: 2,
    maxStage: 3,
    category: 'thread',
    speaker: 'journalist',
    thread: { id: 'press', step: 1 },
    question: 'Sizi yazmak istiyorum. Bir röportaj verir misin?',
    options: [
      {
        label: 'Röportaj ver',
        tradeoff: { gain: 'İtibar, organik ziyaret', cost: 'Kurucu enerjisi' },
        effects: { reputation: 5, energy: -8, modifiers: [mod('organic', 1.1, 30)] },
        reflection: 'İlk haber, kapıyı kimsenin tanımadığı kişilere açar.',
        conceptId: 'organic-vs-paid',
      },
      {
        label: 'Ürün konuşsun',
        tradeoff: { gain: 'Odak korunur', cost: 'Haber çıkmaz' },
        effects: { maturity: 0.02 },
        reflection: 'Sessiz ürün, kendi sesini sonra bulur.',
        conceptId: 'feature-vs-product',
      },
    ],
  },
  {
    id: 'press-bad-news',
    stage: 3,
    maxStage: 4,
    category: 'thread',
    speaker: 'journalist',
    thread: { id: 'press', step: 2 },
    question: 'Eski bir çalışanınız sizi eleştirdi. Yorum yapacak mısın?',
    options: [
      {
        label: 'Açık cevap ver',
        tradeoff: { gain: 'Güven korunur', cost: 'Ekip tedirgin olur' },
        effects: { reputation: 3, morale: -2 },
        reflection: 'Açık cevap, haberi bir günde eskitir.',
        conceptId: 'culture-freezes',
      },
      {
        label: 'Yorum yok',
        tradeoff: { gain: 'Ekip sakin', cost: 'Haber tek sesli kalır' },
        effects: { reputation: -4, morale: 2 },
        reflection: 'Cevapsız haber, okuyanın kafasında tamamlanır.',
        conceptId: 'culture-freezes',
      },
    ],
  },
  {
    id: 'press-cover',
    stage: 4,
    maxStage: 5,
    category: 'thread',
    speaker: 'journalist',
    thread: { id: 'press', step: 3 },
    question: 'Kapak için seni istiyoruz. Bir gün çekim, bir gün röportaj.',
    options: [
      {
        label: 'Kapağa çık',
        tradeoff: { gain: 'İtibar, organik büyüme', cost: 'İki gün enerji' },
        effects: { reputation: 8, energy: -15, modifiers: [mod('organic', 1.15, 45)] },
        reflection: 'Kapaktaki yüz, şirketin sesi olur.',
        conceptId: 'organic-vs-paid',
      },
      {
        label: 'Ekibi öne çıkar',
        tradeoff: { gain: 'Ekip moral bulur', cost: 'Daha az manşet' },
        effects: { morale: 6, reputation: 3 },
        reflection: 'Kapakta ekip, işe alımda da görünür.',
        conceptId: 'culture-freezes',
      },
    ],
  },
]

// =========================================================== Secret cards (4)
// Rare but deterministic: each reads only state the engine keeps (month receipts, rivals, employees, founder, flags)
// and has a floor, so no ordinary run walks into one by accident. Once the condition holds the card is near certain
// (SECRET_WEIGHT): the condition is the rarity, the roll is not.
const SECRET_WEIGHT = 10

/** Paid month receipts, oldest first (months rebuilt from an older save carry no morale). */
const receipts = (s: GameState): MonthReceipt[] => (s.finance.receipts ?? []).filter((r: ReceiptEntry): r is MonthReceipt => !('partial' in r))
const lastTwo = (s: GameState) => receipts(s).slice(-2)

/**
 * Users doubled within one month, closed in the last two, from Seed on, past 2000 users. The reputation floor is 35,
 * not §9.2's 70: a Seed company that doubles sits near 40 reputation (sim, 96 good runs), so 70 never meets one.
 */
function viralMonth(s: GameState): boolean {
  if (s.stage < 2 || s.stats.users < 2000 || s.stats.reputation < 35) return false
  const r = receipts(s).slice(-3)
  return r.some((b, i) => i > 0 && r[i - 1]!.users > 0 && b.users >= 2 * r[i - 1]!.users)
}

/**
 * Team of 4+, morale under 45 at the last two month ends and today (≈ 60 days in a row). §9.2 asks for 6+ and 35:
 * a team that big stays near 55 morale in the sim (no bot run goes lower), so the card would never come.
 */
function mutinyBrewing(s: GameState): boolean {
  if (s.employees.length < 4 || s.stats.morale >= 45) return false
  const two = lastTwo(s)
  return two.length === 2 && two.every((r) => r.morale !== undefined && r.morale < 45)
}

/**
 * The rival the thread follows (the first one born), 90+ days old and fading. Strength moves halfway to its target
 * each month end (rounded), so ≤ 0.21 is only reached after three month ends under 0.25 (§9.2). Today's targets keep
 * strength ≥ 0.5, so a rival whose MRR fell under 15% of the player's counts too.
 */
function rivalFading(s: GameState): boolean {
  const r = s.rivals?.[0]
  if (!r || !rivalStands(s) || s.time.day - r.bornDay < 90) return false
  return r.strength <= 0.21 || (r.mrr > 0 && r.mrr < 0.15 * s.finance.mrr)
}

/** Day the crunch-culture policy was signed. T15: the policy wave writes flags.crunchCultureDay on signing. */
const CRUNCH_CULTURE_FLAG = 'crunchCultureDay'

/**
 * Energy run dry; or from Seed on, no rest for six months and energy under 40 (cooldowns.rest is the day the last
 * rest ended, rest has no cooldown); or six months under the crunch-culture policy.
 */
function burningOut(s: GameState): boolean {
  if (s.founder.energy <= 0) return true
  if (s.stage >= 2 && s.founder.energy < 40 && s.time.day - (s.founder.cooldowns.rest ?? 0) >= 180) return true
  const signed = s.flags[CRUNCH_CULTURE_FLAG]
  return typeof signed === 'number' && s.time.day - signed >= 180
}

export const SECRET_CARDS: readonly DecisionCard[] = [
  {
    id: 'viral-spike',
    stage: 2,
    category: 'normal',
    secret: true,
    weight: SECRET_WEIGHT,
    speaker: 'engineer',
    question: 'Kullanıcı bir ayda ikiye katlandı. Sunucular yetişmiyor, ne yapalım?',
    condition: viralMonth,
    options: [
      {
        label: 'Kapasiteyi büyüt',
        tradeoff: { gain: 'Dalga kaçmaz', cost: 'Kasadan pay' },
        effects: { cashPercent: -0.06, modifiers: [mod('capacity', 1.3, 60)] },
        reflection: 'Dalgayı karşılayan sunucu, kullanıcıyı da tutar.',
        conceptId: 'premature-scaling',
      },
      {
        label: 'Kayıtları yavaşlat',
        tradeoff: { gain: 'Ürün ayakta kalır', cost: 'Dalganın yarısı geçer' },
        effects: { modifiers: [mod('churn', 0.9, 60), mod('organic', 0.85, 30)] },
        reflection: 'Kapıda bekletilen kullanıcı, çöken üründen iyidir.',
        conceptId: 'churn',
      },
    ],
  },
  {
    id: 'team-mutiny',
    stage: 1,
    category: 'normal',
    secret: true,
    weight: SECRET_WEIGHT,
    speaker: 'cofounder',
    question: 'Ekip toplandı, seninle konuşmak istiyor. Hava gergin.',
    condition: mutinyBrewing,
    options: [
      {
        label: 'Dinle, söz ver',
        tradeoff: { gain: 'Moral toparlanır', cost: 'Kurucu enerjisi' },
        effects: { energy: -20, morale: 10, modifiers: [mod('morale', 5, 60)] },
        reflection: 'Dinlenen ekip, sözün tutulmasını bekler.',
        conceptId: 'morale-compounds',
      },
      {
        label: 'Kararımın arkasındayım',
        tradeoff: { gain: 'Yön değişmez', cost: 'Biri gidebilir' },
        effects: { morale: -5, modifiers: [mod('production', 1.05, 30)] },
        reflection: 'Arkasında durduğun karar, ekibin yükü oldu.',
        conceptId: 'culture-freezes',
      },
    ],
  },
  {
    id: 'rival-dies',
    stage: 2,
    category: 'normal',
    secret: true,
    weight: SECRET_WEIGHT,
    speaker: 'investor',
    question: 'Rakip kapıyı kapatıyor. Ekibi ve kullanıcıları ortada kaldı.',
    condition: rivalFading,
    options: [
      {
        label: 'Ekibini işe al',
        tradeoff: { gain: 'Hızlı ürün', cost: 'Kasadan pay' },
        effects: { cashPercent: -0.05, setFlag: RIVAL_GONE_FLAG, modifiers: [mod('production', 1.1, 60)] },
        reflection: 'Rakibin ekibi, onun hatalarını da bilir.',
        conceptId: 'hire-bar',
      },
      {
        label: 'Kullanıcıları karşıla',
        tradeoff: { gain: 'Yeni kullanıcı', cost: 'Sunucu yükü' },
        effects: { usersPercent: 0.08, setFlag: RIVAL_GONE_FLAG, modifiers: [mod('capacity', 0.9, 30)] },
        reflection: 'Kapanan rakibin kullanıcısı, yeni bir ev arar.',
        conceptId: 'churn',
      },
    ],
  },
  {
    id: 'founder-burnout',
    stage: 0,
    category: 'normal',
    secret: true,
    weight: SECRET_WEIGHT,
    speaker: 'cofounder',
    question: 'Aylardır izin yapmadın. Ekip senin için endişeli.',
    condition: burningOut,
    options: [
      {
        label: 'Bir hafta izin yap',
        tradeoff: { gain: 'Enerji ve bakış açısı', cost: 'Bir hafta sensiz' },
        effects: { energy: 50, modifiers: [mod('production', 0.9, 7)] },
        reflection: 'Şirket sensiz bir hafta dayanabiliyorsa, iyi kurmuşsun.',
        conceptId: 'founder-burnout',
      },
      {
        label: 'Yetki devret',
        tradeoff: { gain: 'Yük hafifler', cost: 'Bazı kararlar senden çıkar' },
        effects: { energy: 25, morale: 4 },
        reflection: 'Devretmek, ekibe güvenin görünür halidir.',
        conceptId: 'founder-burnout',
      },
      {
        label: 'Devam et',
        tradeoff: { gain: 'Hız korunur', cost: 'Tükenme riski' },
        effects: { energy: -10 },
        reflection: 'Maratonda da molalar vardır.',
        conceptId: 'founder-burnout',
      },
    ],
  },
]
