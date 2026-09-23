// Name pools. Engine picks with its seeded Rng; all names are fictional.
import type { NpcRole } from '../engine/types'

/** Turkish first names for employees and candidates (mixed genders, plus a few unisex). */
export const EMPLOYEE_NAMES: readonly string[] = [
  // kadın
  'Mira', 'Ece', 'Zeynep', 'Selin', 'Elif', 'Defne', 'Ayşe', 'Merve', 'Ceren', 'Buse',
  'İrem', 'Nazlı', 'Pelin', 'Gizem', 'Dilara', 'Esra', 'Melis', 'Sude', 'Yağmur', 'Aslı',
  'Ebru', 'Hande', 'Tuğba', 'Nehir', 'Beril', 'Lale', 'Sevgi', 'Gülşen', 'Ada', 'Nil',
  // erkek
  'Kaan', 'Emre', 'Arda', 'Can', 'Mert', 'Burak', 'Onur', 'Kerem', 'Barış', 'Oğuz',
  'Tolga', 'Serkan', 'Yusuf', 'Emir', 'Batuhan', 'Cem', 'Alp', 'Efe', 'Hakan', 'Volkan',
  'Tarık', 'Umut', 'Sinan', 'Doruk', 'Kıvanç', 'Levent', 'Rıza', 'Selim', 'Taylan', 'Berk',
  // unisex
  'Deniz', 'Ege', 'Evren', 'Derya', 'Özgür', 'Aydın', 'Bora', 'Ilgaz', 'Toprak', 'Yağız',
]

/** Default display name per NPC role (NPC_TEXT uses the first). Extra names for variety. */
export const NPC_NAMES: Readonly<Record<NpcRole, readonly string[]>> = {
  mentor: ['Nevin', 'Rahmi', 'Suna'],
  cofounder: ['Can', 'Ela'],
  accountant: ['Hakan', 'Filiz'],
  engineer: ['Elif', 'Tamer'],
  investor: ['Bora', 'Nesrin', 'Kurt'],
  customer: ['Aylin', 'Orhan', 'Şule', 'Metin'],
  journalist: ['Tuna', 'Pınar'],
}

/** Suggested project names when the player does not type one. */
export const PROJECT_NAMES: readonly string[] = [
  'Kanka', 'Pusula', 'Filiz', 'Mavi', 'Çınar', 'Işık', 'Dalga', 'Kıvılcım', 'Martı', 'Yörünge',
  'Kovan', 'Rota', 'Şimşek', 'Liman', 'Çıra', 'Atlas', 'Nabız', 'Tohum', 'Köprü', 'Ufuk',
]

/** Fictional enterprise customers (enterprise sales, Series B+). */
export const ENTERPRISE_NAMES: readonly string[] = [
  'Anadolu Lojistik', 'Boğaz Holding', 'Kuzey Enerji', 'Ege Tekstil', 'Toros Gıda', 'Marmara Sigorta',
  'Kapadokya Turizm', 'Karadeniz Denizcilik', 'Başkent Sağlık', 'Trakya Tarım', 'Yıldız Perakende', 'Fırat Yapı',
]
