// PLAN §3.1. Slot counts / round sizes are starting values [DENGE]; tune together with engine/balance.ts.
import type { StageDef } from './types'

export const STAGES: readonly StageDef[] = [
  {
    index: 0, key: 'garage', name: 'Garaj', officeName: 'Garaj', rings: 1, totalSlots: 4,
    targetValuation: null, roundAmount: null, roundEquity: null, newSlotType: 'desk',
    unlockActions: ['findUsers', 'talkToUsers', 'rest'],
    unlocksText: 'Masa slotu, elle kullanıcı bulma', paletteKey: 'concrete',
    tagline: 'Her şey bir garajda başlar.',
  },
  {
    index: 1, key: 'preseed', name: 'Pre-seed', officeName: 'Coworking köşesi', rings: 2, totalSlots: 10,
    targetValuation: 500_000, roundAmount: 150_000, roundEquity: 0.1, newSlotType: 'common',
    unlockTools: ['capTableView'], unlockActions: ['motivateTeam', 'investorCoffee'],
    unlocksText: 'Ortak alan slotu, cap table', paletteKey: 'cowork',
    tagline: 'İlk yatırım geldi, artık bir masadan fazlası var.',
  },
  {
    index: 2, key: 'seed', name: 'Seed', officeName: 'Küçük ofis', rings: 3, totalSlots: 18,
    targetValuation: 3_000_000, roundAmount: 800_000, roundEquity: 0.15, newSlotType: 'room',
    unlockTools: ['priceControl'], unlockActions: ['salesCall'],
    unlocksText: 'Oda slotu (toplantı), fiyat ayarı', paletteKey: 'smallOffice',
    tagline: 'Kapısında adımız yazan ilk ofis.',
  },
  {
    index: 3, key: 'seriesA', name: 'Series A', officeName: 'Açık plan kat', rings: 4, totalSlots: 30,
    targetValuation: 15_000_000, roundAmount: 4_000_000, roundEquity: 0.18,
    unlockTools: ['adBudget'],
    unlocksText: 'Reklam bütçesi, LTV:CAC paneli', paletteKey: 'openPlan',
    tagline: 'Koca bir kat, büyümeyi ölçme zamanı.',
  },
  {
    index: 4, key: 'seriesB', name: 'Series B', officeName: 'İki katlı ofis', rings: 5, totalSlots: 44,
    targetValuation: 75_000_000, roundAmount: 20_000_000, roundEquity: 0.15,
    unlockTools: ['enterpriseSales'],
    unlocksText: 'Sunucu odası, kurumsal satış', paletteKey: 'twoFloor',
    tagline: 'İki kat, büyük müşteriler, büyük sorumluluk.',
  },
  {
    index: 5, key: 'seriesC', name: 'Series C', officeName: 'Bina', rings: 6, totalSlots: 60,
    targetValuation: 300_000_000, roundAmount: 150_000_000, roundEquity: 0.12, newSlotType: 'special',
    unlocksText: 'Özel slotlar (sahne, lab)', paletteKey: 'tower',
    tagline: 'Koca bir bina, bir adım kaldı.',
  },
  {
    index: 6, key: 'unicorn', name: 'Unicorn', officeName: 'Kampüs', rings: 0, totalSlots: 0,
    targetValuation: 1_000_000_000, roundAmount: null, roundEquity: null,
    unlocksText: 'Final sahnesi', paletteKey: 'campus',
    tagline: 'Bir milyar dolar. Garajdan kampüse.',
  },
]
