// Style cards (playtest 2026-10-08: "the deck follows your strategy"). Each one only comes to a player whose play
// style today (engine/style.ts) is its `style`, and weighs STYLE_CARD_WEIGHT there: the ad buyer meets ad stories,
// the B2B seller meets customers, the bootstrapper meets price and profit, the multi-product founder meets focus.
// Same budgets as the deck: question ≤ 12 words, label ≤ 5, reflection ≤ 10.
import type { ModifierKind } from '../engine/types'
import type { DecisionCard } from './types'

const mod = (kind: ModifierKind, value: number, days: number) => ({ kind, value, days })

export const STYLE_CARDS: readonly DecisionCard[] = [
  // ------------------------------------------------------------ ads (vcRocket)
  {
    id: 'style-ads-viral',
    stage: 0,
    maxStage: 2,
    category: 'normal',
    style: 'vcRocket',
    speaker: 'cofounder',
    question: 'Bir reklamımız patladı. Bütçeyi bu hafta ikiye katlayalım mı?',
    options: [
      {
        label: 'İkiye katla',
        tradeoff: { gain: 'Dalgayı yakala', cost: 'Kasadan para' },
        effects: { cash: -1500, modifiers: [mod('organic', 1.35, 30)] },
        reflection: 'Dalga kısa sürer, bedelini kasa öder.',
        conceptId: 'organic-vs-paid',
      },
      {
        label: 'Ölçerek ilerle',
        tradeoff: { gain: 'Ucuz kullanıcı', cost: 'Dalga kaçabilir' },
        effects: { reputation: 2, modifiers: [mod('cac', 0.85, 30)] },
        reflection: 'Kullanıcı ucuz gelir, dalga kaçabilir.',
        conceptId: 'ltv-cac',
      },
    ],
  },
  {
    id: 'style-ads-review',
    stage: 0,
    maxStage: 3,
    category: 'normal',
    style: 'vcRocket',
    speaker: 'engineer',
    question: 'Reklam platformu hesabımızı incelemeye aldı. Ne yapalım?',
    options: [
      {
        label: 'İtiraz et, bekle',
        tradeoff: { gain: 'Kanal geri gelir', cost: 'Reklam pahalanır' },
        effects: { modifiers: [mod('cac', 1.5, 20)] },
        reflection: 'Kanal geri gelir, reklam pahalanır.',
        conceptId: 'organic-vs-paid',
      },
      {
        label: 'Organiğe yüklen',
        tradeoff: { gain: 'Kendi kanalın', cost: 'Emek ve para' },
        effects: { cash: -800, energy: -10, modifiers: [mod('organic', 1.25, 40)] },
        reflection: 'Kendi kanalın kurulur, emek ve para gider.',
        conceptId: 'organic-vs-paid',
      },
    ],
  },
  // ------------------------------------------------------------ B2B sales (niche)
  {
    id: 'style-b2b-custom',
    stage: 0,
    maxStage: 2,
    category: 'normal',
    style: 'niche',
    speaker: 'customer',
    question: 'En büyük müşterimiz yalnız kendine özel bir özellik istiyor.',
    options: [
      {
        label: 'Özel geliştir',
        tradeoff: { gain: 'Ek ödeme', cost: 'Borç ve yavaşlık' },
        effects: { cash: 4000, techDebt: 6, modifiers: [mod('production', 0.85, 20)] },
        reflection: 'Ek ödeme geldi, borç ve yavaşlık arttı.',
        conceptId: 'concentration',
      },
      {
        label: 'Ürüne sadık kal',
        tradeoff: { gain: 'Ürün odaklı', cost: 'Müşteri kırılabilir' },
        effects: { reputation: 3, morale: 3 },
        delayed: { days: 40, effects: { cash: -1500 }, note: 'Müşteri indirim istedi.' },
        reflection: 'Ürün çizgisinde kaldın, müşteri kırılabilir.',
        conceptId: 'feature-vs-product',
      },
    ],
  },
  {
    id: 'style-b2b-pilot',
    stage: 0,
    maxStage: 2,
    category: 'normal',
    style: 'niche',
    speaker: 'customer',
    question: 'Bir holding ücretli pilot öneriyor. Ödeme 90 gün sonra.',
    options: [
      {
        label: 'Pilotu kabul et',
        tradeoff: { gain: 'Büyük ödeme', cost: 'Üç ay bekleyiş' },
        effects: { reputation: 4, modifiers: [mod('production', 0.9, 30)] },
        delayed: { days: 90, effects: { cash: 9000 }, note: 'Pilot ödemesi geldi.' },
        reflection: 'Büyük ödeme 90 gün sonra gelir, runway dayanmalı.',
        conceptId: 'runway',
      },
      {
        label: 'Peşin ödeyen ara',
        tradeoff: { gain: 'Hemen nakit', cost: 'Daha küçük iş' },
        effects: { cash: 2500, energy: -15 },
        reflection: 'Nakit hemen girer, iş daha küçük.',
        conceptId: 'runway',
      },
    ],
  },
  // ------------------------------------------------------------ price and profit (bootstrap)
  {
    id: 'style-boot-raise',
    stage: 0,
    maxStage: 2,
    category: 'normal',
    style: 'bootstrap',
    speaker: 'accountant',
    question: 'Zamdan sonra ay kârla kapandı. Bir zam daha mı?',
    options: [
      {
        label: 'Bir zam daha',
        tradeoff: { gain: 'Kullanıcı başı gelir', cost: 'Churn artar' },
        effects: { modifiers: [mod('arpu', 1.1, 60), mod('churn', 1.2, 30)] },
        reflection: 'Kullanıcı başı gelir artar, churn da artar.',
        conceptId: 'pricing',
      },
      {
        label: 'Fiyatı sabitle',
        tradeoff: { gain: 'Sadık kullanıcı', cost: 'Gelir aynı kalır' },
        effects: { morale: 4, modifiers: [mod('churn', 0.9, 30)] },
        reflection: 'Kullanıcı kalır, gelir aynı.',
        conceptId: 'pricing',
      },
    ],
  },
  {
    id: 'style-boot-investor',
    stage: 0,
    maxStage: 2,
    category: 'normal',
    style: 'bootstrap',
    speaker: 'investor',
    question: 'Kârlı olduğunuzu duydum. Yine de para alır mısınız?',
    options: [
      {
        label: 'Küçük çek al',
        tradeoff: { gain: '+$25K kasa', cost: 'Hissenden %6' },
        effects: { cash: 25000, equity: -0.06 },
        reflection: 'Kasa +$25K, payının %6’sı gitti.',
        conceptId: 'dilution',
      },
      {
        label: 'Kendi yolumuz',
        tradeoff: { gain: 'Hisse ve itibar', cost: 'Yavaş büyüme' },
        effects: { reputation: 4, morale: 3 },
        reflection: 'Pay ve itibar sende, büyüme yavaş.',
        conceptId: 'default-alive',
      },
    ],
  },
  // ------------------------------------------------------------ several products (platform)
  {
    id: 'style-multi-focus',
    stage: 0,
    maxStage: 2,
    category: 'normal',
    style: 'platform',
    speaker: 'mentor',
    question: 'İki ürün aynı ekibi paylaşıyor. Birini dondurur musun?',
    options: [
      {
        label: 'Birini dondur',
        tradeoff: { gain: 'Tek ürün hızlanır', cost: 'Ekip üzülür' },
        effects: { morale: -3, modifiers: [mod('production', 1.2, 30)] },
        reflection: 'Tek ürün hızlanır, ekip üzülür.',
        conceptId: 'focus',
      },
      {
        label: 'İkisi de sürsün',
        tradeoff: { gain: 'İki şans', cost: 'İkisi de yavaş' },
        effects: { reputation: 2, modifiers: [mod('production', 0.9, 20)] },
        reflection: 'İki ürün de sürüyor, ikisi de yavaş.',
        conceptId: 'no-single-path',
      },
    ],
  },
  {
    id: 'style-multi-bundle',
    stage: 1,
    maxStage: 3,
    category: 'normal',
    style: 'platform',
    speaker: 'customer',
    question: 'Müşteriler iki ürünü tek paket olarak istiyor.',
    options: [
      {
        label: 'Paket yap',
        tradeoff: { gain: 'Paket geliri', cost: 'Teknik borç' },
        effects: { techDebt: 4, modifiers: [mod('arpu', 1.12, 60)] },
        reflection: 'Paket geliri geldi, teknik borç arttı.',
        conceptId: 'no-single-path',
      },
      {
        label: 'Ayrı sat',
        tradeoff: { gain: 'Esnek seçim', cost: 'Ek gelir yok' },
        effects: { modifiers: [mod('churn', 0.92, 30)] },
        reflection: 'Müşteri seçer, ek gelir yok.',
        conceptId: 'no-single-path',
      },
    ],
  },
]
