// Jev (LLM player): the observation and the legal moves of a state, both read from the engine.
// Pure: no DOM, no store. The page bridge (page.ts) calls it on the live state; tests call it on a sim state.
// Every move is a real engine Action that applyAction accepts right now (a dry run filters the candidates), so the
// list follows the engine as it changes: a verb the engine refuses never reaches the model.
import {
  DEPT_TEXT,
  MARKET_SEGMENTS,
  POLICIES,
  PROJECT_CATEGORY_TEXT,
  STAGES,
  moduleName,
  type ContentBundle,
} from '../../src/content/index'
import {
  DEPTS,
  FOUNDER_ACTIONS,
  FOUNDER_FOCI,
  MARKET_SEGMENT_IDS,
  POLICY_IDS,
  PROJECT_CATEGORIES,
  RENEW_OFFERS,
  ROUND_SIZES,
  PRICE_STEPS,
  adBudgetSteps,
  autoPaydayChoice,
  balance,
  createEngine,
  idleBuilders,
  modules as moduleLib,
  nextLockedRing,
  openDecision,
  staffAttention,
  stepAction,
  type Action,
  type Dept,
  type EngineApi,
  type GameState,
  type PaydayChoice,
} from '../../src/engine/index'
import { moveAction } from '../../src/engine/loopSelectors'

/** One legal move: a short id the model answers with, a short label, and the engine action (null = wait). */
export interface Move {
  id: string
  label: string
  action: Action | null
  /** The game's own suggestion (the next-step chip). */
  chip?: boolean
}

export interface Observation {
  day: number
  stage: string
  nextStage: string | null
  targetValuation: number | null
  cash: number
  netPerDay: number
  runwayMonths: number | null
  users: number
  mrr: number
  valuation: number
  arpu: number
  churnPct: number
  morale: number
  founderEnergy: number
  movesLeft: number | null
  team: Partial<Record<Dept, number>>
  wagesPerMonth: number
  adBudget: number
  price: number
  projects: { name: string; cat: string; maturityPct: number; launched: boolean; builders: number; modules: number }[]
  round: string | null
  chip: string | null
  open: { kind: string; text: string } | null
  recent: string[]
}

const FOUNDER_LABEL: Record<string, string> = {
  findUsers: 'Kurucu: elle kullanıcı bul',
  talkToUsers: 'Kurucu: kullanıcıyla konuş (ürün)',
  motivateTeam: 'Kurucu: ekibi motive et (moral)',
  investorCoffee: 'Kurucu: yatırımcı kahvesi',
  salesCall: 'Kurucu: satış görüşmesi (MRR)',
  rest: 'Kurucu: dinlen (enerji)',
  refactorSprint: 'Kurucu: refactor sprinti (teknik borç)',
}
const FOCUS_LABEL: Record<string, string> = { users: 'Odak: kullanıcı bul', talk: 'Odak: kullanıcıyla konuş', build: 'Odak: ürün geliştir' }
const PITCH_LABEL: Record<string, string> = {
  deck: 'sunum', demo: 'demo', coinvestor: 'ortak yatırımcı', honest: 'dürüst ol', spin: 'parlat', fix: 'düzeltme planı',
  rehearse: 'prova', team: 'ekibi öne çıkar', rival: 'rakibi kullan', sign: 'imzala', push: 'pazarlık', keep: 'şartları koru',
  metrics: 'metrikler', story: 'hikâye',
}
/** New module offers listed per project (the catalogue has ~15 per category; the list stays small for the model). */
const MODULES_PER_PROJECT = 4
const RESIGN_LABEL ={ raise: 'zam yap', talk: 'konuş', letGo: 'bırak gitsin' } as const

const k = (v: number): string => {
  const a = Math.abs(v)
  const s = a >= 1e9 ? `${(a / 1e9).toFixed(2)}B` : a >= 1e6 ? `${(a / 1e6).toFixed(2)}M` : a >= 1e3 ? `${(a / 1e3).toFixed(1)}K` : `${Math.round(a)}`
  return `${v < 0 ? '-' : ''}$${s}`
}
const deptName = (d: Dept): string => DEPT_TEXT[d]?.short ?? d
const sameAction = (a: Action | null, b: Action | null): boolean => JSON.stringify(a) === JSON.stringify(b)

/** Payday desk presets (PaydayChoice lines): the game's own default first. */
function paydayPresets(s: GameState): { key: string; label: string; choice: PaydayChoice }[] {
  const auto = autoPaydayChoice(s)
  const out: { key: string; label: string; choice: PaydayChoice }[] = [
    { key: 'oto', label: `Maaş günü: otomatik (maaş ${auto.salaries}, kira ${auto.rent}, altyapı ${auto.infra}, reklam ${auto.ads}, kurucu ${auto.founder})`, choice: auto },
    { key: 'tam', label: 'Maaş günü: her şeyi öde', choice: { salaries: 'full', rent: 'pay', infra: 'pay', ads: 'pay', founder: 'pay' } },
    { key: 'maas', label: 'Maaş günü: maaşları öde, kira+altyapı ertele, reklamı kes, kurucu almasın', choice: { salaries: 'full', rent: 'defer', infra: 'defer', ads: 'cut', founder: 'skip' } },
    { key: 'yarim', label: 'Maaş günü: yarım maaş, kirayı öde, reklamı kes', choice: { salaries: 'half', rent: 'pay', infra: 'pay', ads: 'cut', founder: 'skip' } },
    { key: 'ertele', label: 'Maaş günü: her şeyi ertele, reklamı kes', choice: { salaries: 'defer', rent: 'defer', infra: 'defer', ads: 'cut', founder: 'skip' } },
  ]
  return out.filter((o, i) => i === 0 || !out.slice(0, i).some((p) => JSON.stringify(p.choice) === JSON.stringify(o.choice)))
}

/**
 * The legal moves now. With a decision open (card, payday desk, round meeting, leaver) only its answers and "bekle";
 * otherwise every verb the player has (founder, focus, hires, ads, price, rounds, laws, market, modules, office, effort).
 */
export function legalMoves(s: GameState, content: ContentBundle, api: EngineApi = createEngine(content), chipText: string | null = null): Move[] {
  const out: Move[] = []
  const ok = (a: Action): boolean => api.applyAction(s, a).ok
  const add = (id: string, label: string, a: Action): void => {
    if (out.some((m) => m.id === id) || out.some((m) => sameAction(m.action, a))) return
    if (ok(a)) out.push({ id, label, action: a })
  }
  out.push({ id: 'bekle', label: 'Bekle (hiçbir şey yapma)', action: null })
  if (s.gameOver) return out

  const open = openDecision(s)
  if (open === 'card' && s.decisions.active) {
    const card = content.decisions.find((c) => c.id === s.decisions.active!.cardId)
    card?.options.forEach((o, i) =>
      add(`kart${i + 1}`, `${o.label} (+ ${o.tradeoff.gain} / - ${o.tradeoff.cost})`, { type: 'answerDecision', cardId: card.id, optionIndex: i }),
    )
  } else if (open === 'payday') {
    for (const p of paydayPresets(s)) add(`maas_${p.key}`, p.label, { type: 'resolvePayday', choice: p.choice })
  } else if (open === 'meeting') {
    for (const o of s.derived.round?.pitchOptions ?? []) {
      const d = o.min !== undefined && o.max !== undefined ? `%${Math.round(o.min * 100)}..%${Math.round(o.max * 100)}` : `%${Math.round(o.delta * 100)}`
      const extra = [o.fit ? 'yatırımcıya uygun' : '', o.weeks ? `${o.weeks > 0 ? '-' : '+'}${Math.abs(o.weeks)} hafta` : '', o.strike ? `${o.strike} ihtar` : '', o.equity ? `+%${(o.equity * 100).toFixed(1)} hisse` : '']
        .filter(Boolean)
        .join(', ')
      add(`pitch_${o.pitch}`, `Toplantı: ${PITCH_LABEL[o.pitch] ?? o.pitch} (teklif ${d}${extra ? ', ' + extra : ''})`, { type: 'roundPitch', pitch: o.pitch })
    }
  } else if (open === 'leaver') {
    for (const e of s.employees.filter((x) => x.status === 'leaving')) {
      const who = `${e.name} (${deptName(e.dept)}, ${k(e.salary)}/ay, neden ${e.leaveCause ?? '?'})`
      for (const r of ['raise', 'talk', 'letGo'] as const) add(`ayrilan_${e.id}_${r}`, `İstifa: ${who} · ${RESIGN_LABEL[r]}`, { type: 'respondResignation', employeeId: e.id, response: r })
      if (e.leaveCause === 'bored')
        for (const p of s.projects.filter((x) => x.id !== e.projectId && x.maturity < 1)) add(`ayrilan_${e.id}_${p.id}`, `İstifa: ${who} · ${p.name} projesine ver`, { type: 'assign', employeeId: e.id, projectId: p.id })
    }
  } else {
    generalMoves(s, content, add)
  }

  // The chip's suggestion: marked on its row, or its own row (its amount / module can differ from the steps above).
  // With a decision open only an answer of that decision counts.
  const chip = chipAction(s)
  if (chip) {
    const m = out.find((x) => sameAction(x.action, chip))
    if (m) m.chip = true
    else if (!open && ok(chip)) out.push({ id: 'oneri', label: `Oyunun önerisi: ${chipText ?? describe(s, chip)}`, action: chip, chip: true })
  }
  return out
}

/** A short line for an action outside the generated rows (the chip's own pick). */
function describe(s: GameState, a: Action): string {
  switch (a.type) {
    case 'setAdBudget':
      return `reklam bütçesi ${k(s.finance.adBudget)} → ${k(a.amount)}/ay`
    case 'setPrice':
      return `fiyat ×${s.finance.priceMultiplier.toFixed(2)} → ×${a.multiplier.toFixed(2)}`
    case 'buildModule':
    case 'refreshModule': {
      const p = s.projects.find((x) => x.id === a.projectId)
      return `${a.type === 'buildModule' ? 'modül ekle' : 'modülü yenile'}: ${moduleName(a.moduleId, p?.category)} → ${p?.name ?? a.projectId}`
    }
    case 'founderAction':
      return FOUNDER_LABEL[a.kind] ?? a.kind
    case 'startRound':
      return `yatırım turu başlat (${a.size ?? 'target'})`
    case 'setHireTarget':
      return `kadro hedefi ${deptName(a.dept)} → ${a.target}`
    case 'hire': {
      const c = s.candidates.find((x) => x.id === a.candidateId)
      return c ? `işe al: ${deptName(c.dept)} ${c.name} (${k(c.salary)}/ay)` : 'işe al'
    }
    default:
      return a.type
  }
}

/** The next-step chip's concrete action, when it names one the engine accepts. */
export function chipAction(s: GameState): Action | null {
  const st = s.derived.nextStep
  if (!st) return null
  let a: Action | null = null
  try {
    a = stepAction(s, st)
  } catch {
    a = null
  }
  if (a) return a
  // Steps whose chip opens a picker (the naive probe answers them with the picker's first row).
  if (st.id === 'idea') return { type: 'startProject', category: 'mobile' }
  if (st.id === 'round' || s.derived.canStartRound) return { type: 'startRound', size: 'small' }
  return null
}

/** What the game does when the player does nothing (a decision's default, else the chip). */
export function fallbackMove(s: GameState, content: ContentBundle, moves: readonly Move[]): Move {
  const open = openDecision(s)
  const pick = (a: Action | null): Move | undefined => (a ? moves.find((m) => sameAction(m.action, a)) : undefined)
  let def: Action | null = null
  if (open === 'card' && s.decisions.active) {
    const card = content.decisions.find((c) => c.id === s.decisions.active!.cardId)
    if (card) def = { type: 'answerDecision', cardId: card.id, optionIndex: card.defaultOption ?? card.options.length - 1 }
  } else if (open === 'payday') def = { type: 'resolvePayday', choice: autoPaydayChoice(s) }
  else if (open === 'leaver') def = moveAction(s, 'keepStaff')
  return pick(def) ?? moves.find((m) => m.chip) ?? (open === 'meeting' ? moves.find((m) => m.id.startsWith('pitch_')) : undefined) ?? moves[0]!
}

function generalMoves(s: GameState, content: ContentBundle, add: (id: string, label: string, a: Action) => void): void {
  // Founder
  for (const kind of FOUNDER_ACTIONS) add(`kurucu_${kind}`, FOUNDER_LABEL[kind] ?? kind, { type: 'founderAction', kind })
  for (const focus of FOUNDER_FOCI) if (s.founder.focus !== focus) add(`odak_${focus}`, FOCUS_LABEL[focus] ?? focus, { type: 'setFounderFocus', focus })

  // Projects
  for (const c of PROJECT_CATEGORIES) add(`urun_${c}`, `Yeni ürün: ${PROJECT_CATEGORY_TEXT[c]?.name ?? c} · ${PROJECT_CATEGORY_TEXT[c]?.description ?? ''}`, { type: 'startProject', category: c })
  for (const p of s.projects) {
    // New modules: the desk's suggestions first, at most MODULES_PER_PROJECT; refreshes only for stale ones.
    const suggested = new Set(moduleLib.suggestModules(s, p, MODULES_PER_PROJECT).map((o) => o.id))
    const offers = moduleLib.moduleOffers(s, p).filter((o) => !o.error)
    const fresh = [...offers.filter((o) => !o.refresh && suggested.has(o.id)), ...offers.filter((o) => !o.refresh && !suggested.has(o.id))].slice(0, MODULES_PER_PROJECT)
    const stale = offers.filter((o) => {
      const m = o.refresh ? p.modules?.find((x) => x.id === o.id) : undefined
      return m !== undefined && moduleLib.moduleStrength(m, s.time.day) < moduleLib.MODULE_ASK_STRENGTH
    })
    for (const o of [...fresh, ...stale]) {
      const name = moduleName(o.id, p.category)
      add(`${o.refresh ? 'yenile' : 'modul'}_${p.id}_${o.id}`, `${o.refresh ? 'Modülü yenile' : 'Modül ekle'}: ${name} → ${p.name} (${k(o.cost)}${o.days ? `, ~${o.days}g` : ''})`, o.refresh ? { type: 'refreshModule', projectId: p.id, moduleId: o.id } : { type: 'buildModule', projectId: p.id, moduleId: o.id })
    }
    add(`sprint_${p.id}`, `Sprint: ${p.name} (ekip hızlanır, yorulur)`, { type: 'sprint', projectId: p.id, on: true })
  }
  // Idle builders onto the least mature open project.
  const openProjects = s.projects.filter((p) => p.maturity < 1).sort((a, b) => a.maturity - b.maturity)
  for (const id of idleBuilders(s)) {
    const e = s.employees.find((x) => x.id === id)
    for (const p of openProjects.slice(0, 2)) if (e) add(`ata_${id}_${p.id}`, `Boştaki ${e.name} (${deptName(e.dept)}) → ${p.name}`, { type: 'assign', employeeId: id, projectId: p.id })
  }

  // Team: hires before Series A, headcount targets from it.
  if (s.stage < balance.STAFFING_FROM_STAGE) {
    for (const c of s.candidates) {
      const sk = c.skills?.length ? `, ${c.skills.join('/')}` : ''
      add(`ise_al_${c.id}`, `İşe al: ${deptName(c.dept)} ${c.name} (${k(c.salary)}/ay, kalite ${c.quality.toFixed(2)}${sk})`, { type: 'hire', candidateId: c.id, autoDesk: true })
    }
    add('aday_yenile', 'Aday listesini yenile', { type: 'refreshCandidates' })
  } else {
    const view = s.derived.staffing
    for (const d of DEPTS) {
      const cur = view?.depts[d]?.target ?? 0
      for (const delta of [1, 3, -1]) {
        const target = Math.max(0, Math.min(balance.STAFF_TARGET_MAX, cur + delta))
        if (target !== cur) add(`hedef_${d}_${target}`, `Kadro hedefi: ${deptName(d)} ${cur} → ${target}`, { type: 'setHireTarget', dept: d, target })
      }
    }
  }
  if (s.employees.length <= 12)
    for (const e of s.employees) add(`kov_${e.id}`, `Çıkar: ${e.name} (${deptName(e.dept)}, ${k(e.salary)}/ay, moral ${Math.round(e.morale)})`, { type: 'fire', employeeId: e.id })

  // Effort: only the people the game itself flags.
  for (const [id, need] of staffAttention(s)) {
    const e = s.employees.find((x) => x.id === id)
    if (!e || need === 'leaving' || need === 'idle') continue
    const who = `${e.name} (${need}, yorgunluk ${Math.round(e.fatigue ?? 0)})`
    if (need === 'calmBack') add(`tempo_${id}_normal`, `Normal tempoya al: ${who}`, { type: 'setPace', employeeId: id, pace: 'normal' })
    else add(`tempo_${id}_calm`, `Yavaşlat: ${who}`, { type: 'setPace', employeeId: id, pace: 'calm' })
    add(`izin_${id}`, `İzin ver: ${who}`, { type: 'giveLeave', employeeId: id })
  }

  // Growth: ads and price.
  for (const st of adBudgetSteps(s.finance.adBudget, s.stage)) {
    if (st.amount === s.finance.adBudget) continue
    add(`reklam_${st.key}`, `Reklam bütçesi: ${k(s.finance.adBudget)} → ${k(st.amount)}/ay`, { type: 'setAdBudget', amount: st.amount })
  }
  const pi = PRICE_STEPS.findIndex((p) => Math.abs(p - s.finance.priceMultiplier) < 0.005)
  for (const p of [PRICE_STEPS[pi - 1], PRICE_STEPS[pi + 1]]) if (p !== undefined) add(`fiyat_${p}`, `Fiyat: ×${s.finance.priceMultiplier.toFixed(2)} → ×${p.toFixed(2)}`, { type: 'setPrice', multiplier: p })
  if (s.projects.length > 1) for (const p of s.projects) add(`reklam_odak_${p.id}`, `Reklamı ${p.name} ürününe odakla`, { type: 'setAdFocus', projectId: p.id })

  // Funding.
  for (const size of ROUND_SIZES) {
    const o = s.derived.round?.sizes?.find((x) => x.size === size)
    const lab = o ? ` (~${k(o.offer)}, %${(o.equity * 100).toFixed(1)} hisse, ${o.months} ay)` : ''
    add(`tur_${size}`, `Yatırım turu başlat: ${size}${lab}`, { type: 'startRound', size })
    add(`tur_${size}_down`, `Düşük değerli tur: ${size}`, { type: 'startRound', size, down: true })
  }

  // Company: laws, market, rivals, contracts.
  for (const id of POLICY_IDS) {
    const def = POLICIES.find((p) => p.id === id)
    add(`kanun_${id}`, `Kanun imzala: ${def?.name ?? id}`, { type: 'adoptPolicy', policyId: id })
  }
  for (const id of MARKET_SEGMENT_IDS) {
    const def = MARKET_SEGMENTS.find((m) => m.id === id)
    add(`pazar_${id}`, `Pazar segmenti aç: ${id}${def ? ` (+${Math.round(def.size)} kişi, ${k(def.cost)}, ${k(def.upkeep)}/ay)` : ''}`, { type: 'openSegment', id })
  }
  for (const r of s.derived.market?.rivals ?? []) {
    const name = s.rivals?.find((x) => x.id === r.id)?.name ?? r.id
    add(`rakip_${r.id}`, `Rakibi satın al: ${name} (${k(r.price)}, +${Math.round(r.users)} kullanıcı)`, { type: 'acquireRival', id: r.id })
  }
  for (const r of s.derived.renewals ?? [])
    for (const offer of RENEW_OFFERS)
      add(`sozlesme_${r.id}_${offer}`, offer === 'hold' ? `Sözleşme ${r.name}: fiyatı koru (%${Math.round(r.holdChance * 100)} kalır, ${k(r.holdMrr)})` : `Sözleşme ${r.name}: indirim (${k(r.discountMrr)} kesin)`, { type: 'renewContract', id: r.id, offer })

  // Office: the next ring, and per slot type the cheapest piece that fits now.
  const ring = nextLockedRing(s.office)
  if (ring !== null) add(`halka_${ring}`, `Ofiste yeni alan aç (halka ${ring})`, { type: 'openRing', ring })
  const byType = new Map<string, typeof content.furniture>()
  for (const f of content.furniture) if (f.stageUnlock <= s.stage && f.price <= s.stats.cash) byType.set(f.slotType, [...(byType.get(f.slotType) ?? []), f])
  for (const [type, items] of byType) {
    let n = 0
    for (const f of [...items].sort((a, b) => a.price - b.price)) {
      if (n >= 2) break
      add(`esya_${f.id}`, `Satın al (${type}): ${f.name} (${k(f.price)}${f.upkeep ? `, ${k(f.upkeep)}/ay` : ''}) · ${f.description.slice(0, 60)}`, { type: 'placeItem', itemId: f.id })
      n++
    }
  }
}

/** A small observation for the model (keys short, money in $, rounded). */
export function observe(s: GameState, content: ContentBundle, chipText: string | null = null, openText: string | null = null): Observation {
  const team: Partial<Record<Dept, number>> = {}
  for (const e of s.employees) team[e.dept] = (team[e.dept] ?? 0) + 1
  const next = STAGES[s.stage + 1]
  const r = s.round
  const round = r?.active ? `tur sürüyor: ${r.weeksLeft} hafta kaldı, hedef ${STAGES[r.targetStage]?.name ?? r.targetStage}` : s.derived.canStartRound ? 'tur penceresi açık' : null
  const open = openDecision(s)
  let text = openText ?? ''
  if (!text && open === 'card' && s.decisions.active) text = content.decisions.find((c) => c.id === s.decisions.active!.cardId)?.question ?? ''
  if (!text && open === 'payday') text = `Kasa maaş gününü karşılamıyor (kasa ${k(s.stats.cash)})`
  if (!text && open === 'meeting') text = `Yatırımcı toplantısı: ${s.derived.round?.meeting ?? ''}`
  if (!text && open === 'leaver') text = 'Bir çalışan istifa etmek üzere'
  const recent = s.events
    .slice(-12)
    .filter((e) => e.day >= s.time.day - 14 && !['founderActionDone', 'visitorArrived'].includes(e.kind))
    .slice(-6)
    .map((e) => `g${Math.floor(e.day)} ${e.kind}${e.refId ? ':' + e.refId : ''}`)
  return {
    day: Math.floor(s.time.day),
    stage: STAGES[s.stage]?.name ?? String(s.stage),
    nextStage: next?.name ?? null,
    targetValuation: next?.targetValuation ?? null,
    cash: Math.round(s.stats.cash),
    netPerDay: Math.round(s.finance.net / 30),
    runwayMonths: s.finance.runway === null ? null : Number(s.finance.runway.toFixed(1)),
    users: Math.round(s.stats.users),
    mrr: Math.round(s.finance.mrr),
    valuation: Math.round(s.finance.valuation),
    arpu: Number(s.stats.arpu.toFixed(2)),
    churnPct: Number((s.stats.churn * 100).toFixed(1)),
    morale: Math.round(s.stats.morale),
    founderEnergy: Math.round(s.founder.energy),
    movesLeft: s.derived.moves?.left ?? null,
    team,
    wagesPerMonth: Math.round(s.employees.reduce((a, e) => a + e.salary, 0)),
    adBudget: Math.round(s.finance.adBudget),
    price: s.finance.priceMultiplier,
    projects: s.projects.map((p) => ({
      name: p.name,
      cat: p.category,
      maturityPct: Math.round(p.maturity * 100),
      launched: p.launched,
      builders: s.employees.filter((e) => e.projectId === p.id).length,
      modules: (p.modules ?? []).length,
    })),
    round,
    chip: chipText,
    open: open ? { kind: open, text } : null,
    recent,
  }
}
