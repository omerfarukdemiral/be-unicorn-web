// PLAN §6.4 ambient office lines: short, not clickable, ~3s visible, ≤ 12 words.
// `condition` keeps lines honest (no runway panic in a profitable company).
import type { GameState } from '../engine/types'
import type { OfficeLine } from './types'

const burning = (s: GameState): boolean => s.finance.net < 0
const profitable = (s: GameState): boolean => s.finance.net >= 0 && s.finance.mrr > 0
const shortRunway = (s: GameState): boolean => burning(s) && s.finance.runway !== null && s.finance.runway < 6
const bigTeam = (s: GameState): boolean => s.derived.teamSize >= 6

export const OFFICE_LINES: readonly OfficeLine[] = [
  // ---- hire
  { id: 'hire-1', trigger: 'hire', speaker: 'anyEmployee', text: 'Hoş geldin! Kahve makinesi solda, şifre panoda.' },
  { id: 'hire-2', trigger: 'hire', speaker: 'founder', text: 'Ekibe katıldığın için çok mutluyuz.' },
  { id: 'hire-3', trigger: 'hire', speaker: 'eng', text: 'Yeni bir çift el, harika. İlk görevin hazır.' },
  { id: 'hire-4', trigger: 'hire', speaker: 'anyEmployee', text: 'Masan hazır, istersen önce ofisi gezelim.', condition: bigTeam },
  { id: 'hire-5', trigger: 'hire', speaker: 'anyEmployee', text: 'Garajda yer kalmadı ama sana da yer açarız.', maxStage: 0 },

  // ---- fire / resign
  { id: 'fire-1', trigger: 'fire', speaker: 'anyEmployee', text: 'Zor bir gün. Ona iyi şanslar diliyoruz.' },
  { id: 'fire-2', trigger: 'fire', speaker: 'founder', text: 'Bu kararı kolay vermedim, devam edelim.' },
  { id: 'resign-1', trigger: 'resign', speaker: 'anyEmployee', text: 'Masası boş kaldı, garip bir his.' },
  { id: 'resign-2', trigger: 'resign', speaker: 'anyEmployee', text: 'Onun işlerini paylaşmamız lazım.' },

  // ---- milestones
  { id: 'ms-launch-1', trigger: 'milestone', milestone: 'firstLaunch', speaker: 'anyEmployee', text: 'Yayındayız! Gerçek insanlar ürünümüzü kullanıyor.' },
  { id: 'ms-launch-2', trigger: 'milestone', milestone: 'firstLaunch', speaker: 'founder', text: 'İlk sürüm çıktı. Şimdi asıl iş başlıyor.' },
  { id: 'ms-100-1', trigger: 'milestone', milestone: 'users100', speaker: 'anyEmployee', text: 'Yüz kullanıcı! Hepsinin adını ezberleyebilirim.' },
  { id: 'ms-100-2', trigger: 'milestone', milestone: 'users100', speaker: 'marketing', text: 'Yüzüncü kullanıcı geldi, pasta kimde?' },
  { id: 'ms-1000-1', trigger: 'milestone', milestone: 'users1000', speaker: 'anyEmployee', text: 'Bin kullanıcı! Artık bir topluluk olduk.' },
  { id: 'ms-1000-2', trigger: 'milestone', milestone: 'users1000', speaker: 'eng', text: 'Bin kişi aynı anda girse bile ayaktayız.' },
  { id: 'ms-10k-1', trigger: 'milestone', milestone: 'users10k', speaker: 'anyEmployee', text: 'On bin kullanıcı, inanılır gibi değil.' },
  { id: 'ms-mrr-1', trigger: 'milestone', milestone: 'firstMrr', speaker: 'founder', text: 'Biri ürünümüze para ödedi. Bunu çerçeveletiyorum.' },
  { id: 'ms-mrr-2', trigger: 'milestone', milestone: 'firstMrr', speaker: 'sales', text: 'İlk gelir geldi, ekran görüntüsünü aldım.' },
  { id: 'ms-profit-1', trigger: 'milestone', milestone: 'firstProfitMonth', speaker: 'accountant', text: 'Bu ay kâra geçtik. Tablo ilk kez yeşil.' },
  { id: 'ms-profit-2', trigger: 'milestone', milestone: 'firstProfitMonth', speaker: 'anyEmployee', text: 'Kâr ettik mi? Gerçekten mi? Alkış!' },

  // ---- launch (any project)
  { id: 'launch-1', trigger: 'launch', speaker: 'product', text: 'Yeni ürün yayında, geri bildirimleri topluyorum.' },
  { id: 'launch-2', trigger: 'launch', speaker: 'eng', text: 'Deploy tamam, parmaklarımız çapraz.' },

  // ---- crisis resolved
  { id: 'crisis-1', trigger: 'crisisResolved', speaker: 'anyEmployee', text: 'Fırtına geçti, derin bir nefes.' },
  { id: 'crisis-2', trigger: 'crisisResolved', speaker: 'founder', text: 'Birlikte atlattık. Teşekkürler ekip.' },
  { id: 'crisis-3', trigger: 'crisisResolved', speaker: 'ops', text: 'Olay raporunu yazıyorum, bir daha yaşamayalım.' },

  // ---- idle (mood of the office)
  { id: 'idle-1', trigger: 'idle', speaker: 'anyEmployee', text: 'Bugün kod akıyor, kimse bölmesin.' },
  { id: 'idle-2', trigger: 'idle', speaker: 'product', text: 'Bu ekranı üçüncü kez çizdim, şimdi oldu.' },
  { id: 'idle-3', trigger: 'idle', speaker: 'marketing', text: 'Yeni kampanya fikri geldi, sonra anlatırım.' },
  { id: 'idle-4', trigger: 'idle', speaker: 'sales', text: 'Müşteri demo istedi, yarına ayarladım.', minStage: 2 },
  { id: 'idle-5', trigger: 'idle', speaker: 'ops', text: 'Destek kutusu bugün sakin, iyiye işaret.' },
  { id: 'idle-6', trigger: 'idle', speaker: 'anyEmployee', text: 'Kahve bitti, kim sipariş veriyor?' },
  { id: 'idle-7', trigger: 'idle', speaker: 'anyEmployee', text: 'Garajın sesi yankı yapıyor ama seviyorum.', maxStage: 0 },
  { id: 'idle-8', trigger: 'idle', speaker: 'anyEmployee', text: 'Rakamlar güzel gidiyor, bu tempoyu koruyalım.', condition: profitable },

  // ---- morale
  { id: 'lowmorale-1', trigger: 'lowMorale', speaker: 'anyEmployee', text: 'Biraz yorgunum, bir mola iyi gelirdi.' },
  { id: 'lowmorale-2', trigger: 'lowMorale', speaker: 'anyEmployee', text: 'Son haftalar ağır geçti açıkçası.' },
  { id: 'lowmorale-3', trigger: 'lowMorale', speaker: 'cofounder', text: 'Ekip bir soluklanmayı hak ediyor bence.' },
  { id: 'highmorale-1', trigger: 'highMorale', speaker: 'anyEmployee', text: 'Burada çalışmak gerçekten keyifli.' },
  { id: 'highmorale-2', trigger: 'highMorale', speaker: 'anyEmployee', text: 'Bu ekiple her şeyi yaparız gibi geliyor.' },

  // ---- profit
  { id: 'profit-1', trigger: 'profit', speaker: 'accountant', text: 'Gelir gideri geçti, runway artık sonsuz.', condition: profitable },
  { id: 'profit-2', trigger: 'profit', speaker: 'founder', text: 'Kendi ayaklarımız üstündeyiz, sıradaki hedef büyümek.', condition: profitable },

  // ---- low runway (never while profitable)
  { id: 'runway-1', trigger: 'lowRunway', speaker: 'accountant', text: 'Kasa hızla eriyor, bir plan konuşalım mı?', condition: shortRunway },
  { id: 'runway-2', trigger: 'lowRunway', speaker: 'cofounder', text: 'Birkaç ayımız kaldı, tura hazırlanmalıyız.', condition: shortRunway },
  { id: 'runway-3', trigger: 'lowRunway', speaker: 'anyEmployee', text: 'Maaşlar yatacak mı diye soran oldu.', condition: (s) => burning(s) && s.finance.runway !== null && s.finance.runway < 2 },

  // ---- overload
  { id: 'overload-1', trigger: 'overload', speaker: 'eng', text: 'Sunucular kırmızıda, herkes el atsın!' },
  { id: 'overload-2', trigger: 'overload', speaker: 'ops', text: 'Destek talepleri patladı, sayfa çok yavaş.' },
  { id: 'overload-3', trigger: 'overload', speaker: 'eng', text: 'Daha fazla mühendis ya da sunucu lazım.' },

  // ---- fundraising
  { id: 'round-start-1', trigger: 'roundStarted', speaker: 'investor', text: 'Rakamlarınızı inceleyeceğiz, birkaç hafta sürer.' },
  { id: 'round-start-2', trigger: 'roundStarted', speaker: 'anyEmployee', text: 'Takım elbiseli biri geldi, yatırımcı mı?' },
  { id: 'round-closed-1', trigger: 'roundClosed', speaker: 'founder', text: 'Tur kapandı! Bu para bir sorumluluk.' },
  { id: 'round-closed-2', trigger: 'roundClosed', speaker: 'anyEmployee', text: 'Tur kapandı, şampanya mı açıyoruz?' },

  // ---- stage up / moving
  { id: 'stage-1', trigger: 'stageUp', speaker: 'anyEmployee', text: 'Yeni ofis! Pencere kenarını ben kaptım.' },
  { id: 'stage-2', trigger: 'stageUp', speaker: 'founder', text: 'Garajdan buraya... yol uzun, devam ediyoruz.', minStage: 1, maxStage: 2 },
  { id: 'stage-3', trigger: 'stageUp', speaker: 'anyEmployee', text: 'Bu binada kaybolabilirim, harita var mı?', minStage: 5 },
]
