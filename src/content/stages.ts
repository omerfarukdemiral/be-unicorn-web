// PLAN §3.1. Slot counts / round sizes are starting values [DENGE].
import type { StageDef } from './types'

export const STAGES: readonly StageDef[] = [
  { index: 0, key: 'garage', name: 'Garaj', officeName: 'Garaj', rings: 1, totalSlots: 4, targetValuation: null, roundAmount: null, roundEquity: null, newSlotType: 'desk', unlocksText: 'Masa slotu, elle kullanıcı bulma' },
  { index: 1, key: 'preseed', name: 'Pre-seed', officeName: 'Coworking köşesi', rings: 2, totalSlots: 10, targetValuation: 500_000, roundAmount: 150_000, roundEquity: 0.1, newSlotType: 'common', unlockTools: ['capTableView'], unlocksText: 'Ortak alan slotu, cap table' },
  { index: 2, key: 'seed', name: 'Seed', officeName: 'Küçük ofis', rings: 3, totalSlots: 18, targetValuation: 3_000_000, roundAmount: 800_000, roundEquity: 0.15, newSlotType: 'room', unlockTools: ['priceControl'], unlocksText: 'Oda slotu (toplantı), fiyat ayarı' },
  { index: 3, key: 'seriesA', name: 'Series A', officeName: 'Açık plan kat', rings: 4, totalSlots: 30, targetValuation: 15_000_000, roundAmount: 4_000_000, roundEquity: 0.18, unlockTools: ['adBudget'], unlocksText: 'Reklam bütçesi, LTV:CAC paneli' },
  { index: 4, key: 'seriesB', name: 'Series B', officeName: 'İki katlı ofis', rings: 5, totalSlots: 44, targetValuation: 75_000_000, roundAmount: 20_000_000, roundEquity: 0.15, unlockTools: ['enterpriseSales'], unlocksText: 'Sunucu odası, kurumsal satış' },
  { index: 5, key: 'seriesC', name: 'Series C', officeName: 'Bina', rings: 6, totalSlots: 60, targetValuation: 300_000_000, roundAmount: 150_000_000, roundEquity: 0.12, newSlotType: 'special', unlocksText: 'Özel slotlar (sahne, lab)' },
  { index: 6, key: 'unicorn', name: 'Unicorn', officeName: 'Kampüs', rings: 0, totalSlots: 0, targetValuation: 1_000_000_000, roundAmount: null, roundEquity: null, unlocksText: 'Final sahnesi' },
]
