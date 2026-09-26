// PLAN §6.2 concept catalog (27). Titles, bubbles and card texts were rewritten per docs/VOICE.md
// (PLAN §6.2 bubble/rule columns are kept in sync with this file).
// Triggers are pure reads of GameState. Flags/counters the engine is expected to maintain:
//   flags.firstHireDay, counters.hires, counters.manualFinds, counters.crunches, counters.lowGrowthMonths (consecutive months MoM < 2%)
//   flags.rushedProject (set by cards), flags.starHire (set by cards), flags.rivalPressure (number 0–1)
import type { GameState } from '../engine/types'
import type { Concept } from './types'
import { parallelProjectSpeed } from '../engine/economy'
import { TECH_DEBT_MIN_SPEED, TECH_DEBT_PER_POINT } from '../engine/balance'
import { formatMoney, formatMonths, formatNumber, formatPercent, formatRatio } from './format'
import { ARCHETYPE_TEXT } from './strings'

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
      what: 'Kasan bu gidişle kaç ay yeter? O sayının adı runway.',
      where: (s) => {
        if (s.finance.runway === null) return `Gelirin gideri karşılıyor, kasa erimiyor. Kasanda ${formatMoney(s.stats.cash)} duruyor.`
        if (s.finance.runway < 0.5) return `Kasa ayda ${formatMoney(-s.finance.net)} eriyor ve bitmek üzere.`
        if (s.finance.mrr > 0) return `Gelir girse de kasa ayda ${formatMoney(-s.finance.net)} eriyor. Bu gidişle ${formatMonths(s.finance.runway)} sonra biter.`
        return `Kasa ayda ${formatMoney(-s.finance.net)} eriyor. Bu gidişle ${formatMonths(s.finance.runway)} sonra biter.`
      },
      rule: "İşe alım yapmadan önce runway'in kaç aya ineceğine bak.",
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
    bubble: 'Geçen ay bu kadar para yakmıyorduk. Ne değişti?',
    card: {
      what: 'Maaş, kira, reklam: her ay kasadan çıkan paranın toplamı burn.',
      where: (s) =>
        `Ayda ${formatMoney(s.finance.burn)} yakıyorsun, bunun ${formatMoney(s.finance.burnBreakdown.salaries)} kadarı maaşlara gidiyor.`,
      rule: "Yeni masrafı onaylamadan önce burn'e ekle, sonra karar ver.",
    },
    unlocks: 'burnBreakdown',
    shelfColor: '#F2A65A',
  },
  {
    id: 'dont-scale',
    stage: 0,
    trigger: (s) => count(s, 'manualFinds') >= 1,
    speaker: 'mentor',
    bubble: 'Onları tek tek kendin buldun. Neden geldiklerini sordun mu?',
    card: {
      what: 'Kullanıcıyı elle, tek tek bulmak yavaş. Ama neden geldiğini kendi ağzından duyarsın.',
      where: (s) => {
        const finds = count(s, 'manualFinds')
        const talks = count(s, 'userTalks')
        const users = formatNumber(s.stats.users)
        if (finds > 0 && talks > 0) return `Kendin ${finds} kez kapı çaldın, ${talks} kez de oturup konuştun. Bugün ${users} kullanıcın var.`
        if (finds > 0) return `Kendin ${finds} kez kapı çaldın ama hiç oturup konuşmadın. Bugün ${users} kullanıcın var.`
        if (talks > 0) return `Hiç kapı çalmadın ama ${talks} kez oturup konuştun. Bugün ${users} kullanıcın var.`
        return `${users} kullanıcın var ama hiçbiriyle oturup konuşmadın.`
      },
      rule: 'Bu hafta bir kullanıcınla oturup konuş.',
    },
    shelfColor: '#81B29A',
  },
  {
    id: 'pmf',
    stage: 0,
    // Felt at a release moment: users arrive with the release and some walk out again (never before the MVP).
    trigger: (s) => (s.releases?.length ?? 0) > 0 && s.stats.users > 0 && s.derived.avgMaturity < 0.4 && s.stats.churn > 0.08,
    speaker: 'customer',
    bubble: 'Denedim, fena değil ama bir daha açmadım açıkçası.',
    card: {
      what: 'Gelen kalmıyorsa ürün daha tutmamış. Tuttuğu gün ürün-pazar uyumunu bulmuş olursun.',
      where: (s) =>
        `Ürün ${formatPercent(s.derived.avgMaturity)} hazır. Her ay kullanıcılarının ${formatPercent(s.stats.churn)} kadarı bırakıp gidiyor.`,
      rule: "Kullanıcıların her ay %8'den fazlası gidiyorsa reklam açma.",
    },
    unlocks: 'retention',
    shelfColor: '#8E9BF0',
  },
  {
    id: 'focus',
    stage: 0,
    trigger: (s) => s.stage === 0 && s.projects.length >= 2,
    speaker: 'cofounder',
    bubble: 'Yeni projeye mi geçiyoruz abi? Öbürü ne olacak?',
    card: {
      what: 'Ekibi iki projeye bölersen ikisi de yavaşlar. Birini bitirmeden ötekine geçme: odak bu.',
      where: (s) => {
        const active = s.projects.filter((p) => p.maturity < 1).length
        const slow = Math.round((1 - parallelProjectSpeed(active, s.stage)) * 100)
        if (active === 0) return `Yarım kalan projen yok, hız kaybın da yok.`
        if (active === 1) return `Şu an tek projeye yüklenmişsin, hız kaybın yok.`
        if (slow === 0) return `${active} proje birden yürüyor ama ekip artık kaldırıyor, hız kaybın yok.`
        return `Aynı anda ${active} proje yürütüyorsun, bu yüzden her biri %${slow} yavaş ilerliyor.`
      },
      rule: 'Birini bitirmeden yeni proje açma.',
    },
    shelfColor: '#C08BD9',
  },
  {
    id: 'default-alive',
    stage: 0,
    // Felt on a month receipt that already shows revenue next to the costs.
    trigger: (s) => s.finance.mrr > 0 && (s.finance.lastReceipt?.revenue ?? 0) > 0,
    speaker: 'mentor',
    bubble: 'Yatırımcı hiç gelmese, bu gidişle kâra geçer misin?',
    card: {
      what: 'Kasa bitmeden kâra yetişiyorsan yatırımcı gelmese de yaşarsın: default-alive.',
      where: (s) => {
        const flow = `Ayda ${formatMoney(s.finance.mrr)} geliyor, ${formatMoney(s.finance.burn)} gidiyor.`
        if (s.finance.net >= 0) return `${flow} Kasa erimiyor, zaten kârdasın.`
        if (s.finance.runway !== null && s.finance.runway < 0.5) return `${flow} Kasa bitmek üzere, aradaki ${formatMoney(-s.finance.net)} farkı kapatacak zaman kalmadı.`
        return `${flow} Aradaki ${formatMoney(-s.finance.net)} farkı ${formatMonths(s.finance.runway)} içinde kapatman lazım.`
      },
      rule: 'Farkı zamanında kapatamayacaksan gideri kıs ya da yatırım ara.',
    },
    unlocks: 'profitProjection',
    shelfColor: '#F4D35E',
  },

  // ---------------------------------------------------------------- Pre-seed
  {
    id: 'dilution',
    // Stage 0: the first offer (Garaj → Pre-seed) happens in the garage (PLAN §6.2 "İlk yatırım teklifi").
    stage: 0,
    trigger: (s) => s.derived.canStartRound || s.round !== undefined,
    speaker: 'investor',
    bubble: 'Parayı getiririm, karşılığında şirketinden biraz isterim. Adil, değil mi?',
    card: {
      what: 'Yatırımcıya hisse verdikçe pastadaki dilimin küçülür. Dilution, yani hisse sulanması.',
      where: (s) =>
        s.round?.active
          ? `Bu turda şirketin ${formatPercent(s.round.offer.equity)} kadarını veriyorsun. Teklif böyle kapanırsa elinde ${formatPercent(s.stats.equity * (1 - s.round.offer.equity))} kalır.`
          : `Şirketin ${formatPercent(s.stats.equity)} kadarı senin. Her turda bundan bir dilim gider.`,
      rule: 'Turu imzalamadan önce elinde yüzde kaç kalacağına bak.',
    },
    unlocks: 'capTable',
    shelfColor: '#8B8CF2',
  },
  {
    id: 'safe',
    stage: 1,
    trigger: (s) => cardSeen(s, 'angel-1'),
    speaker: 'investor',
    bubble: 'Parayı bugün vereyim, fiyatı sonraki turda konuşuruz. Anlaştık mı?',
    card: {
      what: 'Parayı bugün alırsın, kaç hisse vereceğin sonraki turda belli olur. Anlaşmanın adı SAFE.',
      where: (s) => {
        const pct = formatPercent(s.stats.equity)
        if (s.decisions.pending.some((p) => p.sourceCardId === 'angel-1')) {
          return `SAFE'i imzaladın. Şirketin şu an ${pct} kadarı senin, SAFE hisseye dönünce bir dilim gider.`
        }
        if (s.decisions.history.some((h) => h.cardId === 'angel-1' && h.optionIndex === 0)) {
          return `SAFE hisseye döndü. Şirketin artık ${pct} kadarı senin.`
        }
        return `SAFE'i imzalamadın. Şirketin ${pct} kadarı hâlâ senin.`
      },
      rule: 'SAFE imzalamadan önce hissenden ne kadar gideceğini hesapla.',
    },
    shelfColor: '#B58AF5',
  },
  {
    id: 'fundraise-time',
    stage: 0,
    trigger: (s) => s.round !== undefined,
    speaker: 'mentor',
    bubble: 'Tur başladı. Para gelene kadar kasa dayanır mı, baktın mı?',
    card: {
      what: 'Turu başlatınca para hemen gelmez. Haftalarca görüşürsün, kasa o sırada erimeye devam eder.',
      where: (s) => {
        const runway = s.finance.runway
        if (!s.round) {
          return runway === null
            ? `Bir tur 8–12 hafta sürüyor. Kasa erimiyor, acele etmene gerek yok.`
            : `Bir tur 8–12 hafta sürüyor, kasan ${formatMonths(runway)} yetiyor.`
        }
        const weeks = s.round.weeksLeft
        if (runway === null) return `Turun bitmesine ${weeks} hafta var. Kasa erimiyor, acele yok.`
        const left = runway - weeks / 4.3
        if (left <= 0) return `Turun bitmesine ${weeks} hafta var, kasan ${formatMonths(runway)} yetiyor. Para gelmeden kasa biter.`
        if (left < 3) return `Turun bitmesine ${weeks} hafta var. Bittiği gün kasan ${formatMonths(left)} yeter. 3 aydan az kalırsa teklif düşer.`
        return `Turun bitmesine ${weeks} hafta var. Bittiği gün kasan hâlâ ${formatMonths(left)} yeter.`
      },
      rule: 'Kasan en az 6 ay yetiyorken turu başlat.',
    },
    unlocks: 'roundTimer',
    shelfColor: '#48BFE3',
  },
  {
    id: 'hire-bar',
    stage: 1,
    trigger: (s) => count(s, 'hires') >= 3,
    speaker: 'cofounder',
    bubble: 'Ekip büyüyor abi. Hepsi gerçekten iyi mi, yoksa acele mi ettik?',
    card: {
      what: 'Her adayda tek soru: bu kişi ekibi yukarı çeker mi? Çıtan bu.',
      where: (s) => {
        const payroll = s.employees.reduce((sum, e) => sum + e.salary, 0)
        const weak = s.employees.filter((e) => e.quality < 1).length
        const bar = weak > 0 ? `${weak} kişi ortalama adayın altında.` : `Hiçbiri ortalama adayın altında değil.`
        return `${count(s, 'hires')} kişi aldın, maaşlara ayda ${formatMoney(payroll)} gidiyor. ${bar}`
      },
      rule: 'Emin değilsen alma. Yanlış aldıysan hemen çıkar.',
    },
    unlocks: 'candidateQuality',
    shelfColor: '#56CFE1',
  },
  {
    id: 'morale-compounds',
    stage: 1,
    trigger: (s) => s.derived.teamSize > 0 && s.stats.morale < 50,
    speaker: 'cofounder',
    bubble: 'Ekip bitik abi, bu tempoyla daha ne kadar gideriz?',
    card: {
      what: 'Moral düşerse ekip yavaşlar. Kasa eksiye girerse ya da iş ekibe fazla gelirse moral iner.',
      where: (s) => {
        const m = Math.round(s.stats.morale)
        const t = Math.round(s.derived.moraleTarget)
        const speed =
          m < 50
            ? `Moral ${m}, ekip normal hızının ${formatPercent(0.5 + m / 100)} kadarıyla çalışıyor.`
            : m > 50
              ? `Moral ${m}, ekip normalden ${formatPercent(m / 100 - 0.5)} hızlı.`
              : `Moral ${m}, ekip normal hızında.`
        if (Math.abs(t - m) < 2) return `${speed} Şu gidişle moral burada kalır.`
        if (t < m) return `${speed} Şu gidişle moral ${t} civarına iner.`
        return m < 50 ? `${speed} Şu gidişle moral ${t} civarına toparlanır.` : `${speed} Şu gidişle moral ${t} civarına çıkar.`
      },
      rule: "Moral 50'nin altındaysa ekibin yükünü hafiflet, kasayı eksiye düşürme.",
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
    bubble: 'Bir ay kullandım, sonra bıraktım. Neden diye soran olmadı.',
    card: {
      what: 'Aylin gibi her ay sessizce gidenlerin oranı: churn.',
      where: (s) =>
        `${formatNumber(s.stats.users)} kullanıcından her ay yaklaşık ${formatNumber(Math.max(1, Math.round(s.stats.users * s.stats.churn)))} kişi gidiyor. Churn'ün ${formatPercent(s.stats.churn)}.`,
      rule: 'Yeni kullanıcı aramadan önce gidenin neden gittiğini sor.',
    },
    unlocks: 'churn',
    shelfColor: '#F07167',
  },
  {
    id: 'pricing',
    stage: 2,
    // Valuable product (mature, users stay) still sold at the default price.
    trigger: (s) => s.stats.users > 500 && s.finance.priceMultiplier <= 1 && s.derived.avgMaturity >= 0.5 && s.stats.churn < 0.08,
    speaker: 'customer',
    bubble: 'Bu fiyata mı? Açıkçası iki katını da verirdim.',
    card: {
      what: 'Sen hâlâ ilk günkü fiyattasın; ürünün ise artık daha fazlasını ediyor.',
      where: (s) =>
        `Kullanıcı başına ayda ${formatMoney(s.stats.arpu)} alıyorsun. Fiyatı %5 artırsan kâğıt üstünde kasaya ayda ${formatMoney(s.stats.users * s.stats.arpu * 0.05)} daha girer.`,
      rule: "Fiyatı küçük adımla artır, bir ay churn'e bak.",
    },
    unlocks: ['priceControl', 'arpu'],
    shelfColor: '#FCBF49',
  },
  {
    id: 'feature-vs-product',
    stage: 2,
    trigger: (s) => s.projects.length >= 2 && s.projects.some((p) => s.time.day - p.createdDay < 2),
    speaker: 'engineer',
    bubble: 'Yeni proje mi açtın? Elimizdekine eklesek olmaz mıydı?',
    card: {
      what: 'Yeni proje başka birinin derdini çözüyorsa ürün. Aynı kullanıcıya bir şey katıyorsa özellik.',
      where: (s) => {
        const n = s.projects.length
        const launched = s.projects.filter((p) => p.launched).length
        const newest = n ? s.projects.reduce((a, b) => (b.createdDay > a.createdDay ? b : a)) : null
        const head = newest ? `"${newest.name}" ${n}. projen` : `${n} projen var`
        if (launched > 0) return `${head}. Yayındakileri zaten ${formatNumber(s.stats.users)} kişi kullanıyor.`
        return n === 1 ? `${head}, henüz yayında değil.` : `${head}, hiçbiri henüz yayında değil.`
      },
      rule: 'Yeni proje açmadan önce kimin kullanacağını tek cümleyle yaz.',
    },
    shelfColor: '#4CC4B4',
  },
  {
    id: 'premature-scaling',
    stage: 2,
    trigger: (s) => s.derived.teamSize >= 6 && s.stats.users < 300,
    speaker: 'cofounder',
    bubble: 'Masalar doldu, maaşlar arttı, kullanıcı hâlâ bir avuç, abi.',
    card: {
      what: 'Kullanıcı gelmeden ekibi büyüttük. Bunun adı erken ölçekleme.',
      where: (s) => {
        const team = s.derived.teamSize
        const payroll = s.employees.reduce((sum, e) => sum + e.salary, 0)
        return `Ekip ${team} kişi, kullanıcı ${formatNumber(s.stats.users)}. Maaşa ayda ${formatMoney(payroll)} gidiyor, kasaya giren ${formatMoney(s.finance.mrr)}.`
      },
      rule: 'Kullanıcı artmıyorsa yeni kişiyi alma.',
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
    bubble: 'Her kullanıcıya reklam parası saydık. Gidene kadar bunu çıkarır mı?',
    card: {
      what: 'Kullanıcının gidene kadar bıraktığı para LTV, onu getirmek için ödediğin para CAC.',
      where: (s) => {
        const r = s.derived.ltvCac
        const base = `Reklamla gelen her kullanıcıya ${formatMoney(s.derived.cac)} ödüyorsun`
        if (r === null) return `${base}. Ne bırakacağını henüz hesaplayamıyorum.`
        const verdict = r >= 3 ? 'reklam masrafını rahat çıkarıyor' : r >= 1 ? 'reklam masrafını ancak çıkarıyor' : 'reklam para yakıyor'
        return `${base}. Kullanıcı gidene kadar ${formatMoney(s.derived.ltv)} bırakıyor. Oran ${formatRatio(r)}, ${verdict}.`
      },
      rule: "Oran 1'in altındaysa reklamı kes, 3'ün altındaysa kıs.",
    },
    unlocks: 'ltvCac',
    shelfColor: '#5FA8C9',
  },
  {
    id: 'organic-vs-paid',
    stage: 3,
    trigger: (s) => adShare(s) > 0.7,
    speaker: 'mentor',
    bubble: 'Reklamı bir hafta kapatsan kaç kişi yine gelir?',
    card: {
      what: 'Kendiliğinden ya da tavsiyeyle gelen organik. Reklamla gelenin her birine ayrı para ödüyorsun.',
      where: (s) => {
        const c = s.derived.channels
        const free = c.organic + c.manual
        const total = free + c.paid
        if (total <= 0) return 'Bu ay henüz yeni kullanıcı gelmedi.'
        const tens = Math.round((c.paid / total) * 10)
        const lead =
          tens >= 10
            ? 'Yeni kullanıcıların neredeyse hepsi reklamdan.'
            : tens <= 0
              ? 'Yeni kullanıcıların neredeyse hiçbiri reklamdan gelmiyor.'
              : `Her 10 yeni kullanıcının ${tens} tanesi reklamdan.`
        const tail = free > 0 ? `Reklamı kapatsan ayda ${formatNumber(free)} kişi yine gelir.` : 'Reklamı kapatsan kapını çalan olmaz.'
        return `${lead} ${tail}`
      },
      rule: "Pazarlamacı al, reklam payını 10'da 7'nin altına çek.",
    },
    unlocks: 'channelBreakdown',
    shelfColor: '#8AB17D',
  },
  {
    id: 'tech-debt',
    stage: 3,
    trigger: (s) => count(s, 'crunches') >= 3 || s.flags['rushedProject'] === true,
    speaker: 'engineer',
    bubble: 'Aceleyle yazdığımız kod şimdi her işte ayağıma dolanıyor.',
    card: {
      what: "'Sonra düzeltiriz' dediğin her yama birikiyor. Adı teknik borç, faizini de yavaşlayarak ödüyorsun.",
      where: (s) => {
        const debt = Math.round(s.techDebt)
        const n = count(s, 'crunches')
        const lead = n > 0 ? `${n} kez fazla mesaiyle yetiştirdin, teknik borcun ${debt} puan.` : `Teknik borcun ${debt} puan.`
        if (s.techDebt < 1) return `${lead} Şimdilik hızın düşmedi.`
        const slow = Math.min(1 - TECH_DEBT_MIN_SPEED, TECH_DEBT_PER_POINT * s.techDebt)
        return `${lead} Projelerin hızı bu yüzden ${formatPercent(slow)} düştü.`
      },
      rule: 'Borç 5 puanı geçince ilk temizlik teklifine evet de.',
    },
    unlocks: 'debtCounter',
    shelfColor: '#7FC8A9',
  },
  {
    id: 'ten-x-myth',
    stage: 3,
    trigger: (s) => s.employees.some((e) => e.star === true) || s.flags['starHire'] === true,
    speaker: 'mentor',
    bubble: 'Yıldızımız yarın giderse bu işi başka bilen var mı?',
    card: {
      what: 'Biri on kişinin işini çıkarır sandık: 10x efsanesi. Asıl dert, işi yalnız onun bilmesi.',
      where: (s) => {
        const star = s.employees.find((e) => e.star === true)
        const n = s.derived.teamSize
        if (star) return `${star.name} giderse ${n} kişilik ekipte yaptığı işi bilen kimse kalmıyor.`
        if (s.flags['starHire'] === true) return `Yıldızını karşı teklifle tuttun ama ${n} kişilik ekipte onun işini hâlâ yalnız o biliyor.`
        return `${n} kişilik ekipte bir işi tek kişi biliyorsa, o gidince iş de durur.`
      },
      rule: 'Karşı teklif verme, işini bir ekip arkadaşına öğrettir.',
    },
    shelfColor: '#FFB703',
  },
  {
    id: 'culture-freezes',
    stage: 3,
    trigger: (s) => s.derived.teamSize >= 15,
    speaker: 'cofounder',
    bubble: 'Kalabalıklaştık abi, yeni gelenler bizi taklit ediyor.',
    card: {
      what: 'İlk günkü alışkanlıklarımız herkese bulaşıyor. Kültür dediğin bu; bir oturdu mu zor sökülür.',
      where: (s) => {
        const m = Math.round(s.stats.morale)
        const mood = m >= 60 ? 'rahat' : m >= 40 ? 'gergin' : 'yorgun'
        return `Ekip ${s.derived.teamSize} kişi, moral ${m}. Yeni gelenler de bu ${mood} havaya ayak uyduruyor.`
      },
      rule: "Moral 60'ın altındaysa yeni kişi almadan önce ekibi toparla.",
    },
    unlocks: 'cultureBadge',
    shelfColor: '#E39AAE',
  },

  // ---------------------------------------------------------------- Series B–C
  {
    id: 'concentration',
    stage: 4,
    trigger: (s) => topCustomerShare(s) > 0.3,
    speaker: 'accountant',
    bubble: 'En büyük müşterinin sözleşmesi bittiği gün gelir bir kalemde düşer.',
    card: {
      what: 'Gelirinin büyük kısmı tek müşteriye bağlıysa, o gidince şirket sarsılır.',
      where: (s) => {
        const list = s.finance.enterpriseCustomers
        if (list.length === 0 || s.finance.mrr <= 0) return `Şu an aylık gelirin ${formatMoney(s.finance.mrr)}, tek müşteriye bağlı değil.`
        const top = list.reduce((a, b) => (b.mrr > a.mrr ? b : a))
        const head = `${top.name} tek başına aylık gelirinin ${formatPercent(topCustomerShare(s))} kadarını getiriyor.`
        if (top.untilDay === undefined) return `${head} Giderse gelirin ayda ${formatMoney(top.mrr)} düşer.`
        const days = Math.max(0, Math.ceil(top.untilDay - s.time.day))
        return `${head} Sözleşmesi ${days} gün sonra bitince gelirin ayda ${formatMoney(top.mrr)} düşer.`
      },
      rule: "Kurumsal müşteri ekle, en büyüğünün payını %30'un altına indir.",
    },
    unlocks: 'revenueDistribution',
    shelfColor: '#C39BF2',
  },
  {
    id: 'compliance',
    stage: 4,
    trigger: (s) => s.unlockedTools.includes('enterpriseSales'),
    speaker: 'customer',
    bubble: 'Verilerim nerede duruyor? Belgeyi görmeden imza atmam.',
    card: {
      what: 'Büyük müşteri imzadan önce KVKK ve güvenlik belgesi ister. Hepsi uyum evrakı.',
      where: (s) => {
        const list = s.finance.enterpriseCustomers
        const seen = cardSeen(s, 'gdpr-audit')
        if (list.length > 0) {
          const total = list.reduce((t, c) => t + c.mrr, 0)
          const head = `${list.length} kurumsal müşterin ayda ${formatMoney(total)} getiriyor.`
          return seen ? `${head} Veri denetimi de bir kez kapını çaldı.` : `${head} Veri denetimi henüz gelmedi.`
        }
        return s.unlockedTools.includes('enterpriseSales')
          ? `Kurumsal satış açıldı, ilk büyük müşterin henüz yok. Şimdilik aylık gelirin ${formatMoney(s.finance.mrr)}.`
          : `Aylık gelirin ${formatMoney(s.finance.mrr)}, kurumsal satış henüz açılmadı.`
      },
      rule: 'Veri denetimi gelince danışman tut, evrakı tamamla.',
    },
    shelfColor: '#8FC0E8',
  },
  {
    id: 'trough',
    stage: 4,
    trigger: (s) => count(s, 'lowGrowthMonths') >= 2,
    speaker: 'mentor',
    bubble: 'İki aydır grafik dümdüz. Şimdi neyi değiştireceksin?',
    card: {
      what: 'Büyüme yerinde sayıyor, heyecan da geçti. Durgunluk çukuru tam burası.',
      where: (s) =>
        count(s, 'lowGrowthMonths') >= 2
          ? `${count(s, 'lowGrowthMonths')} aydır aylık büyümen %2'yi geçmiyor. Son ay ${formatPercent(s.derived.momGrowth)} ile kapandı.`
          : `Çukurdan çıktın, son ay ${formatPercent(s.derived.momGrowth)} büyüdün.`,
      rule: 'Bu ay tek bir şeyi değiştir, ay sonunda sayıya bak.',
    },
    shelfColor: '#5AA9E6',
  },
  {
    id: 'cap-table-health',
    stage: 4,
    trigger: (s) => s.stats.equity < 0.35,
    speaker: 'mentor',
    bubble: 'Şirketin kaçta kaçı hâlâ senin, en son ne zaman baktın?',
    card: {
      what: 'Kimin elinde ne kadar hisse var? Bunu gösteren tablo cap table, ortaklık tablosu.',
      where: (s) => `Kurucu payın ${formatPercent(s.stats.equity)}. Kalan ${formatPercent(1 - s.stats.equity)} artık başkalarında.`,
      rule: 'Turda 18 aylık para al, fazlası için hisse verme.',
    },
    unlocks: 'equity',
    shelfColor: '#7B93F5',
  },
  {
    id: 'no-single-path',
    stage: 4,
    trigger: (s) => s.archetype !== undefined,
    speaker: 'mentor',
    bubble: 'Tarzın belli oldu. Rakibin başka yoldan gidiyor, sence kim yanlış?',
    card: {
      what: 'Şirketi nasıl büyüttüğün, senin kurucu tarzın. Tek doğru tarz yok.',
      where: (s) => {
        if (s.archetype === undefined) return `Tarzın henüz belli değil, ${s.projects.length} projen var.`
        const name = ARCHETYPE_TEXT[s.archetype].name
        const n = s.projects.length
        const net = s.finance.net
        const line =
          s.archetype === 'platform'
            ? `${n} projeyle geniş bir pazara yayılıyorsun.`
            : s.archetype === 'vcRocket'
              ? `${count(s, 'roundsClosed')} tur kapattın, reklama ayda ${formatMoney(s.finance.adBudget)} gidiyor. Hızı yatırım parası taşıyor.`
              : s.archetype === 'niche'
                ? `${n} projeyle dar bir kitleye derin gidiyorsun.`
                : net >= 0
                  ? `Ayda ${formatMoney(net)} artıdasın, büyümeyi kendi gelirin taşıyor.`
                  : `Şu an ayda ${formatMoney(-net)} eksidesin, bu tarzda uzun sürmez.`
        return `Tarzın ${name}. ${line}`
      },
      rule: 'Rakibi kopyalamadan önce kendi kasana ve büyümene bak.',
    },
    unlocks: 'archetypeBadge',
    shelfColor: '#F57AB3',
  },

  // ---------------------------------------------------------------- Every stage
  {
    id: 'founder-burnout',
    stage: 0,
    trigger: (s) => s.founder.lowEnergyDays >= 5,
    speaker: 'cofounder',
    bubble: 'Hiç durmadın. Bir gün de biz bakalım şirkete.',
    card: {
      what: 'Enerjin bitince durmazsan tükenmişlik başlar. İlk bozulan kararların olur.',
      where: (s) => {
        const now = formatPercent(s.founder.energy / 100, 0)
        return s.founder.lowEnergyDays > 0
          ? `${s.founder.lowEnergyDays} gündür enerjin %20'nin altında. Şu an ${now}.`
          : `Şu an enerjin ${now}. Şimdilik ayaktasın.`
      },
      rule: "Enerjin %20'ye yaklaşınca bir gün izin al.",
    },
    shelfColor: '#FB8500',
  },
  {
    id: 'failure-is-data',
    stage: 0,
    trigger: (s) => s.gameOver !== undefined && s.gameOver.kind !== 'unicorn',
    speaker: 'mentor',
    bubble: 'Kapandı. Otur bakalım, neyi farklı yapardın?',
    card: {
      what: 'Bitince oturup neden öyle bittiğine bakarsın: post-mortem, şirketin otopsisi.',
      where: (s) => {
        const go = s.gameOver
        const n = s.concepts.learned.length
        if (!go)
          return n > 0
            ? `Defterinde ${n} sayfa var. Bu şirkette hangisine önce bakacaksın?`
            : 'Defterin boş. İlk sayfayı bu şirket yazacak.'
        const day = Math.floor(go.day)
        if (go.kind === 'unicorn') return `${day} günde unicorn oldun. Bu sefer neyi doğru yaptın?`
        const how = go.kind === 'teamLost' ? 'ekip dağıldı' : 'kasa bitti'
        const k = go.reasons.length
        return `${day} gün dayandın, sonra ${how}.` + (k > 0 ? ` ${k} kör nokta bulduk.` : '')
      },
      rule: 'Suçlu arama, sebebi bul. Yeni şirkete onu bilerek başla.',
    },
    shelfColor: '#A8D5A2',
  },
]
