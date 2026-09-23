// PLAN §6.2 concept catalog (27). Bubble and rule texts follow PLAN verbatim.
// Triggers are pure reads of GameState. Flags/counters the engine is expected to maintain:
//   flags.firstHireDay, counters.hires, counters.manualFinds, counters.crunches, counters.lowGrowthMonths (consecutive months MoM < 2%)
//   flags.rushedProject (set by cards), flags.starHire (set by cards), flags.rivalPressure (number 0–1)
import type { GameState } from '../engine/types'
import type { Concept } from './types'
import { formatMoney, formatMonths, formatNumber, formatPercent, formatRatio } from './format'

const count = (s: GameState, k: keyof GameState['counters']): number => s.counters[k] ?? 0

function firstHireDay(s: GameState): number | null {
  const flagged = s.flags['firstHireDay']
  if (typeof flagged === 'number') return flagged
  if (s.employees.length === 0) return null
  return Math.min(...s.employees.map((e) => e.hiredDay))
}

function adShare(s: GameState): number {
  const c = s.derived.channels
  const total = c.organic + c.paid + c.manual + c.enterprise
  return total > 0 ? c.paid / total : 0
}

function topCustomerShare(s: GameState): number {
  if (s.finance.mrr <= 0 || s.finance.enterpriseCustomers.length === 0) return 0
  const top = Math.max(...s.finance.enterpriseCustomers.map((c) => c.mrr))
  return top / s.finance.mrr
}

function cardSeen(s: GameState, id: string): boolean {
  return s.decisions.active?.cardId === id || s.decisions.history.some((h) => h.cardId === id)
}

export const CONCEPTS: readonly Concept[] = [
  // ---------------------------------------------------------------- Garaj
  {
    id: 'runway',
    stage: 0,
    trigger: (s) => s.time.day >= 10,
    speaker: 'accountant',
    bubble: 'Bu parayla kaç ay dayanırız, hiç hesapladın mı?',
    card: {
      what: 'Kasandaki paranın, bugünkü harcamayla kaç ay yeteceği.',
      where: (s) =>
        s.finance.runway === null
          ? `Gelirin giderini karşılıyor, kasanda ${formatMoney(s.stats.cash)} var: runway sonsuz.`
          : `Ayda net ${formatMoney(-s.finance.net)} eriyor, kasanda ${formatMoney(s.stats.cash)} var: ${formatMonths(s.finance.runway)}.`,
      rule: 'Runway 6 ayın altına inmeden hareket et.',
    },
    unlocks: 'runway',
    shelfColor: '#E07A5F',
  },
  {
    id: 'burn',
    stage: 0,
    trigger: (s) => {
      const d = firstHireDay(s)
      return d !== null && s.time.day - d >= 30
    },
    speaker: 'accountant',
    bubble: 'Her yeni kişi aylık yakıtı artırıyor, fark ettin mi?',
    card: {
      what: 'Burn, şirketin her ay harcadığı toplam para.',
      where: (s) =>
        `Aylık yakıtın ${formatMoney(s.finance.burn)}, bunun ${formatMoney(s.finance.burnBreakdown.salaries)} kadarı maaş.`,
      rule: 'Yaktığın her doların sana ne kazandırdığını sor.',
    },
    unlocks: 'burnBreakdown',
    shelfColor: '#F2A65A',
  },
  {
    id: 'dont-scale',
    stage: 0,
    trigger: (s) => count(s, 'manualFinds') >= 1,
    speaker: 'mentor',
    bubble: 'İlk kullanıcılar tek tek kazanılır, reklamla değil.',
    card: {
      what: 'Başta ölçeklenmeyen, elle yapılan işler en iyi öğretmendir.',
      where: (s) => `Kendin ${count(s, 'manualFinds')} kez kapı çaldın, şu an ${formatNumber(s.stats.users)} kullanıcın var.`,
      rule: 'İlk 10 kullanıcıyı tanı, adını bil.',
    },
    shelfColor: '#81B29A',
  },
  {
    id: 'pmf',
    stage: 0,
    trigger: (s) => s.stats.users > 0 && s.derived.avgMaturity < 0.4 && s.stats.churn > 0.08,
    speaker: 'customer',
    bubble: 'Geliyorlar ama kalmıyorlar, ürün henüz tutmuyor.',
    card: {
      what: 'Ürün-pazar uyumu: kullanıcıların ürünü bırakmak istememesi.',
      where: (s) =>
        `Ürün olgunluğu ${formatPercent(s.derived.avgMaturity)}, her ay kullanıcıların ${formatPercent(s.stats.churn)} kadarı gidiyor.`,
      rule: 'Kalıcılık gelmeden büyümeye para dökme.',
    },
    unlocks: 'retention',
    shelfColor: '#3D405B',
  },
  {
    id: 'focus',
    stage: 0,
    trigger: (s) => s.stage === 0 && s.projects.length >= 2,
    speaker: 'cofounder',
    bubble: 'İki işi yarım yapmak, bir işi bitirmekten yavaş.',
    card: {
      what: 'Paralel projeler, her projenin hızını düşürür.',
      where: (s) => `Aynı anda ${s.projects.length} proje yürütüyorsun, her biri %20 daha yavaş ilerliyor.`,
      rule: 'Erken aşamada tek şeyi mükemmel yap.',
    },
    shelfColor: '#6D597A',
  },
  {
    id: 'default-alive',
    stage: 0,
    trigger: (s) => s.finance.mrr > 0,
    speaker: 'mentor',
    bubble: 'Yatırım almasak bu gidişle kâra geçer miyiz?',
    card: {
      what: 'Default-alive: yatırım almadan kâra ulaşabilecek gidişat.',
      where: (s) => `Aylık gelirin ${formatMoney(s.finance.mrr)}, aylık giderin ${formatMoney(s.finance.burn)}.`,
      rule: 'Default-alive olan masada pazarlık eder.',
    },
    unlocks: 'profitProjection',
    shelfColor: '#F4D35E',
  },

  // ---------------------------------------------------------------- Pre-seed
  {
    id: 'dilution',
    stage: 1,
    trigger: (s) => s.derived.canStartRound || s.round !== undefined,
    speaker: 'investor',
    bubble: 'Para güzel ama o yüzde bir daha geri gelmez.',
    card: {
      what: 'Dilution: yeni hisse satınca senin payının küçülmesi.',
      where: (s) => `Şu an şirketin ${formatPercent(s.stats.equity)} kadarı senin.`,
      rule: 'Her tur hisseni eritir, sonraki turun fiyat çapasıdır.',
    },
    unlocks: 'capTable',
    shelfColor: '#5E60CE',
  },
  {
    id: 'safe',
    stage: 1,
    trigger: (s) => cardSeen(s, 'angel-1'),
    speaker: 'investor',
    bubble: 'Değerlemeyi şimdi değil sonraki turda konuşuruz diyor.',
    card: {
      what: 'SAFE: bugün para, hisse fiyatı sonraki turda belirlenir.',
      where: (s) => `Hissenin ${formatPercent(s.stats.equity)} kadarı sende, SAFE bunu sonraki turda eritecek.`,
      rule: "SAFE dilution'ı erteler, ortadan kaldırmaz.",
    },
    shelfColor: '#7400B8',
  },
  {
    id: 'fundraise-time',
    stage: 1,
    trigger: (s) => s.round !== undefined,
    speaker: 'mentor',
    bubble: 'Tur haftalar sürer, kasa beklemez.',
    card: {
      what: 'Yatırım turu anında kapanmaz, haftalarca görüşme ister.',
      where: (s) =>
        `Tur ${s.round ? s.round.weeksTotal : 6} hafta sürecek, runway ${formatMonths(s.finance.runway)}.`,
      rule: 'Runway yarıya inmeden tur başlat.',
    },
    unlocks: 'roundTimer',
    shelfColor: '#48BFE3',
  },
  {
    id: 'hire-bar',
    stage: 1,
    trigger: (s) => count(s, 'hires') >= 3,
    speaker: 'cofounder',
    bubble: 'Hızlı almak kolay, yanlış kişiyi çıkarmak zor.',
    card: {
      what: 'İşe alım çıtası: kimi alacağına dair net bir standart.',
      where: (s) => `Şimdiye kadar ${count(s, 'hires')} kişi aldın, ekip ${s.derived.teamSize} kişi.`,
      rule: 'Yavaş işe al, sorun varsa hızlı karar ver.',
    },
    unlocks: 'candidateQuality',
    shelfColor: '#56CFE1',
  },
  {
    id: 'morale-compounds',
    stage: 1,
    trigger: (s) => s.derived.teamSize > 0 && s.stats.morale < 50,
    speaker: 'cofounder',
    bubble: 'Ekip yorgun, bu hız kendini yiyor.',
    card: {
      what: 'Moral verimi çarpar; düşünce çıktı da hızla düşer.',
      where: (s) => `Moral ${Math.round(s.stats.morale)}, hedef ${Math.round(s.derived.moraleTarget)}.`,
      rule: 'Moral bileşik getiridir, düşüşü de öyle.',
    },
    unlocks: 'moraleHeatmap',
    shelfColor: '#FF8FA3',
  },

  // ---------------------------------------------------------------- Seed
  {
    id: 'churn',
    stage: 2,
    trigger: (s) => s.stats.users > 300 && s.stats.churn > 0.05,
    speaker: 'customer',
    bubble: 'Her ay giden kullanıcılar sessizce büyümeyi yiyor.',
    card: {
      what: 'Churn: her ay ürünü bırakan kullanıcı oranı.',
      where: (s) =>
        `Churn ${formatPercent(s.stats.churn)}: ${formatNumber(s.stats.users)} kullanıcıdan ayda yaklaşık ${formatNumber(s.stats.users * s.stats.churn)} gidiyor.`,
      rule: 'Yeni kullanıcıdan önce gideni durdur.',
    },
    unlocks: 'churn',
    shelfColor: '#D62828',
  },
  {
    id: 'pricing',
    stage: 2,
    trigger: (s) => s.stats.users > 500 && s.finance.priceMultiplier <= 1 && s.stats.arpu < 3 * 1.15 ** s.stage,
    speaker: 'customer',
    bubble: 'Ürün değerli ama fiyatı korkarak koymuşuz.',
    card: {
      what: 'Fiyatlama: ürünün yarattığı değerden pay almak.',
      where: (s) => `Kullanıcı başı aylık gelirin ${formatMoney(s.stats.arpu)}, fiyat çarpanın ${formatRatio(s.finance.priceMultiplier)}.`,
      rule: 'Fiyat, yarattığın değeri yakalamaktır.',
    },
    unlocks: 'priceControl',
    shelfColor: '#FCBF49',
  },
  {
    id: 'feature-vs-product',
    stage: 2,
    trigger: (s) => s.projects.length >= 2 && s.projects.some((p) => s.time.day - p.createdDay < 2),
    speaker: 'engineer',
    bubble: 'Bu ayrı bir ürün mü, mevcut ürüne özellik mi?',
    card: {
      what: 'Her fikir ürün değildir; bazısı mevcut ürünün özelliğidir.',
      where: (s) => `Portföyünde ${s.projects.length} proje var, ${s.projects.filter((p) => p.launched).length} tanesi yayında.`,
      rule: 'Özelliği ürün diye satma, ürünü özelliğe hapsetme.',
    },
    shelfColor: '#2A9D8F',
  },
  {
    id: 'premature-scaling',
    stage: 2,
    trigger: (s) => s.derived.teamSize >= 6 && s.stats.users < 300,
    speaker: 'cofounder',
    bubble: 'Kalabalıklaştık ama kimse ne yapacağını bilmiyor.',
    card: {
      what: 'Erken ölçekleme: talep kanıtlanmadan ekibi büyütmek.',
      where: (s) => `Ekip ${s.derived.teamSize} kişi, kullanıcı sadece ${formatNumber(s.stats.users)}.`,
      rule: 'Talep kanıtlanmadan ekip büyütme.',
    },
    unlocks: 'coordinationWarning',
    shelfColor: '#E76F51',
  },

  // ---------------------------------------------------------------- Series A
  {
    id: 'ltv-cac',
    stage: 3,
    trigger: (s) => s.finance.adBudget > 0,
    speaker: 'accountant',
    bubble: 'Bir kullanıcıyı kaça alıyoruz, bize kaç kazandırıyor?',
    card: {
      what: 'LTV: bir kullanıcının ömür boyu getirisi. CAC: onu kazanma maliyeti.',
      where: (s) =>
        `Kullanıcı başı edinme ${formatMoney(s.derived.cac)}, ömür boyu getiri ${formatMoney(s.derived.ltv)}, oran ${formatRatio(s.derived.ltvCac)}.`,
      rule: "LTV:CAC 3'ün altındaysa reklam para yakar.",
    },
    unlocks: 'ltvCac',
    shelfColor: '#264653',
  },
  {
    id: 'organic-vs-paid',
    stage: 3,
    trigger: (s) => adShare(s) > 0.7,
    speaker: 'mentor',
    bubble: 'Reklamı kesersek büyüme de duruyor mu?',
    card: {
      what: 'Organik büyüme kendiliğinden gelir, ücretli büyüme reklamla alınır.',
      where: (s) => `Yeni kullanıcılarının ${formatPercent(adShare(s))} kadarı reklamdan geliyor.`,
      rule: 'Organik taban olmadan reklam bağımlılık yapar.',
    },
    unlocks: 'channelBreakdown',
    shelfColor: '#8AB17D',
  },
  {
    id: 'tech-debt',
    stage: 3,
    trigger: (s) => count(s, 'crunches') >= 3 || s.flags['rushedProject'] === true,
    speaker: 'engineer',
    bubble: 'Hızlı yazdık, şimdi her şey yavaşlıyor.',
    card: {
      what: 'Teknik borç: aceleyle alınan kısayolların sonradan ödenen bedeli.',
      where: (s) => `${count(s, 'crunches')} kez crunch yaptınız, borç sayacı ${Math.round(s.techDebt)}.`,
      rule: 'Teknik borç faizle birikir.',
    },
    unlocks: 'debtCounter',
    shelfColor: '#495057',
  },
  {
    id: 'ten-x-myth',
    stage: 3,
    trigger: (s) => s.employees.some((e) => e.star === true) || s.flags['starHire'] === true,
    speaker: 'mentor',
    bubble: 'Tek bir dahi, sistemin yerini tutmaz.',
    card: {
      what: '10x çalışan efsanesi: tek kişiye dayalı bir ekip kırılgandır.',
      where: (s) => {
        const star = s.employees.find((e) => e.star === true)
        return star ? `${star.name} giderse ekibin büyük bir parçası da gider.` : 'Yıldız çalışan kartında bunu tarttın.'
      },
      rule: 'Sistem kahramana muhtaçsa sistem kırıktır.',
    },
    shelfColor: '#FFB703',
  },
  {
    id: 'culture-freezes',
    stage: 3,
    trigger: (s) => s.derived.teamSize >= 15,
    speaker: 'cofounder',
    bubble: 'İlk 20 kişide kültür donar.',
    card: {
      what: 'Kültür, ilk çalışanların alışkanlıklarıyla şekillenir.',
      where: (s) => `Ekip ${s.derived.teamSize} kişiye ulaştı, moral ${Math.round(s.stats.morale)}.`,
      rule: 'Değerleri ekip küçükken yaz.',
    },
    unlocks: 'cultureBadge',
    shelfColor: '#B5838D',
  },

  // ---------------------------------------------------------------- Series B–C
  {
    id: 'concentration',
    stage: 4,
    trigger: (s) => topCustomerShare(s) > 0.3,
    speaker: 'accountant',
    bubble: 'Bu müşteri giderse gelirin üçte biri gider.',
    card: {
      what: 'Yoğunlaşma riski: gelirin tek bir kaynağa bağlı olması.',
      where: (s) => `En büyük müşterin gelirinin ${formatPercent(topCustomerShare(s))} kadarını tutuyor.`,
      rule: 'Tek müşteri, tek kanal, tek tedarikçi görünmez tasmadır.',
    },
    unlocks: 'revenueDistribution',
    shelfColor: '#9D4EDD',
  },
  {
    id: 'compliance',
    stage: 4,
    trigger: (s) => s.unlockedTools.includes('enterpriseSales'),
    speaker: 'customer',
    bubble: 'Büyük müşteri önce güvenlik belgesi soruyor.',
    card: {
      what: 'Uyum: güvenlik ve veri kurallarını belgelemek.',
      where: (s) => `Kurumsal satış açıldı, ${s.finance.enterpriseCustomers.length} kurumsal müşterin var.`,
      rule: 'Uyum sıkıcıdır ama kurumsal kapının anahtarıdır.',
    },
    shelfColor: '#6C757D',
  },
  {
    id: 'trough',
    stage: 4,
    trigger: (s) => count(s, 'lowGrowthMonths') >= 2,
    speaker: 'mentor',
    bubble: 'Heyecan bitti, sonuç henüz yok.',
    card: {
      what: 'Hayal kırıklığı vadisi: ilk heyecandan sonra gelen durgunluk.',
      where: (s) => `${count(s, 'lowGrowthMonths')} aydır büyüme %2'nin altında, son ay ${formatPercent(s.derived.momGrowth)}.`,
      rule: 'Hayal kırıklığı vadisi normaldir, pusula verindir.',
    },
    shelfColor: '#0077B6',
  },
  {
    id: 'cap-table-health',
    stage: 4,
    trigger: (s) => s.stats.equity < 0.35,
    speaker: 'mentor',
    bubble: 'Kontrol kimde, hiç baktın mı?',
    card: {
      what: 'Cap table: şirketin kimde ne kadar olduğunu gösteren tablo.',
      where: (s) => `Kurucu hissen ${formatPercent(s.stats.equity)}, geri kalanı yatırımcılarda.`,
      rule: 'Bugünkü %1 yarının pazarlık gücüdür.',
    },
    shelfColor: '#4361EE',
  },
  {
    id: 'no-single-path',
    stage: 4,
    trigger: (s) => s.archetype !== undefined,
    speaker: 'mentor',
    bubble: 'Senin yolun belli oldu, tek doğru yol bu değil.',
    card: {
      what: 'Kurucu arketipi: seçimlerinin çizdiği büyüme yolu.',
      where: (s) => `Şu ana kadar ${s.decisions.history.length} karar verdin, yolun şekillendi.`,
      rule: 'Dört farklı patikadan unicorn çıkar.',
    },
    unlocks: 'archetypeBadge',
    shelfColor: '#F72585',
  },

  // ---------------------------------------------------------------- Every stage
  {
    id: 'founder-burnout',
    stage: 0,
    trigger: (s) => s.founder.lowEnergyDays >= 5,
    speaker: 'cofounder',
    bubble: 'Sen tükenirsen şirket de tükenir.',
    card: {
      what: 'Kurucu tükenmişliği: enerji bitince kararlar da kötüleşir.',
      where: (s) => `${s.founder.lowEnergyDays} gündür enerjin %20'nin altında.`,
      rule: 'Dinlenmek görevdir.',
    },
    shelfColor: '#FB8500',
  },
  {
    id: 'failure-is-data',
    stage: 0,
    trigger: (s) => s.gameOver !== undefined && s.gameOver.kind !== 'unicorn',
    speaker: 'mentor',
    bubble: 'Bu bir veri noktası, kimlik değil.',
    card: {
      what: 'Post-mortem: neyin neden olduğunu suçlamadan incelemek.',
      where: (s) => `Şirket ${Math.floor(s.time.day)}. günde durdu, ${s.concepts.learned.length} ders öğrendin.`,
      rule: 'İyi post-mortem suçlu değil kör nokta arar.',
    },
    shelfColor: '#adb5bd',
  },
]
