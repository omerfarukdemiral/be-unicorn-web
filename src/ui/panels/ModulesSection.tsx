// Project modules (GAMEPLAY V2 "Proje modülleri"): the slots row of a finished product, the three suggested modules
// behind a "+", the folded full list, a stale module's refresh and the running build's cancel. One row = icon, name,
// one sentence, at most three chips (main gain green, main minus red, cost + days), one commit button. The numbers
// are the engine's (moduleOffers, moduleHeadlines, buildStatus); this file only lays them out.
import { useState, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { buildStatus, moduleDef, moduleHeadlines, moduleLock, moduleOffers, moduleStrength, projectSlots, projectVersion, suggestModules, type ModuleOffer } from '../../engine/modules'
import type { Project, ProjectModuleId } from '../../engine/types'
import { MODULE_TEXT, moduleName } from '../../content'
import { useGameStore } from '../../store/gameStore'
import { ChipRow, type Chip } from '../EffectChips'
import { pct } from '../format'
import { t } from '../i18n'
import { Icon, type IconName } from '../icons'
import { Button, cx, Ring, SectionTitle } from '../primitives'
import { CATEGORY_COLOR } from './ProjectsPanel'
import { buildChips, costChip, founderBuildCost, headlineChip, lockedChips, measuredLine, versionLine, type MeasuredLine } from './moduleView'

/** One icon per module (no repeat inside core + one category; design §1.4). */
export const MODULE_ICON: Record<ProjectModuleId, IconName> = {
  feedback: 'chat',
  referral: 'handshake',
  paywall: 'lock',
  onboarding: 'door',
  analytics: 'bars',
  freemium: 'tag',
  openApi: 'network',
  localization: 'globe',
  aiAssistant: 'sparkle',
  notifications: 'mail',
  support: 'phone',
  cicd: 'check',
  abTest: 'branch',
  security: 'key',
  sso: 'building',
  aso: 'star',
  crashReports: 'bug',
  deepLinks: 'pin',
  offlineMode: 'cloud',
  inAppPurchase: 'bag',
  widgets: 'grid',
  tabletApp: 'desk',
  watchApp: 'timer',
  seo: 'search',
  landingPages: 'flag',
  templates: 'book',
  teamPlans: 'users',
  integrations: 'move',
  adminPanel: 'gear',
  pwa: 'cloud',
  auditLog: 'save',
  evals: 'star',
  usagePricing: 'coin',
  rag: 'book',
  modelRouter: 'compass',
  guardrails: 'flag',
  voiceMode: 'sound',
  fineTune: 'bolt',
  agents: 'rocket',
  docs: 'book',
  rateLimit: 'scale',
  sdks: 'keyboard',
  webhooks: 'arrowRight',
  sandbox: 'refresh',
  usageDashboard: 'pie',
  slaPlans: 'trophy',
  multiRegion: 'cloud',
  leaderboard: 'trophy',
  dailyRewards: 'coffee',
  liveEvents: 'flame',
  shop: 'bag',
  battlePass: 'star',
  guilds: 'users',
  ugcEditor: 'pencil',
  crossPlay: 'move',
  esports: 'flag',
  reviews: 'star',
  payments: 'cash',
  sellerDashboard: 'desk',
  search: 'search',
  promotedListings: 'megaphone',
  buyerProtection: 'heart',
  shipping: 'arrowRight',
  recommendations: 'trend',
  cityLaunch: 'pin',
}

/** What a build costs the founder besides cash: one move, or 10 energy in the garage (no move budget there). */
export function useBuildCost(): { icon: IconName; text: string } {
  return useGameStore(useShallow((s) => founderBuildCost(s.state)))
}

export { buildChips, costChip }

/** A slot's strength bar colour: yellow while it slips, red once most of the gain is gone. */
const strengthTone = (v: number) => (v >= 0.75 ? 'var(--color-positive)' : v >= 0.6 ? 'var(--color-energy)' : 'var(--color-negative)')

type Pick = 'add' | 'build' | ProjectModuleId | null

/** The running build, quantized to 5% steps so the slots do not redraw on every tick. */
function useBuild(p: Project) {
  return useGameStore(
    useShallow((s) => {
      const b = buildStatus(s.state, p)
      return b ? { id: b.id, refresh: b.refresh, fraction: Math.round(b.fraction * 20) / 20, days: b.days } : null
    }),
  )
}

export function ModulesSection({ project: p }: { project: Project }) {
  const view = useGameStore(useShallow((s) => ({ ...projectSlots(s.state, p), version: projectVersion(p), line: versionLine(s.state, p), day: Math.floor(s.state.time.day) })))
  const build = useBuild(p)
  const [pick, setPick] = useState<Pick>(null)
  const mods = p.modules ?? []
  const empties = Math.max(0, view.total - mods.length - (build && !build.refresh ? 1 : 0))
  const toggle = (k: Pick) => setPick((cur) => (cur === k ? null : k))
  const tile = 'relative grid size-14 shrink-0 place-items-center rounded-control border transition-colors'
  return (
    <section>
      <SectionTitle
        right={
          <span className="tabular flex items-center gap-1.5 text-xs font-semibold text-ink-2">
            <span data-version-badge="" className="rounded-md bg-brand-soft px-1.5 py-0.5 text-brand-ink">{t('module.version', { v: view.version })}</span>
            {t('module.slots', { used: view.used, total: view.total })}
          </span>
        }
      >
        {t('detail.modules')}
      </SectionTitle>
      <div data-version-line="" className="font-text mb-2 text-[11px] font-semibold text-ink-2">{view.line}</div>
      <div className="flex flex-wrap gap-2">
        {mods.map((m) => {
          const strength = moduleStrength(m, view.day)
          const refreshing = build?.refresh && build.id === m.id
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={pick === m.id}
              aria-label={moduleName(m.id, p.category)}
              title={MODULE_TEXT[m.id].line}
              onClick={() => toggle(refreshing ? 'build' : m.id)}
              className={cx(tile, 'border-border bg-surface-2/60 hover:bg-surface-2', pick === m.id && 'border-brand bg-brand-soft')}
            >
              <Icon name={MODULE_ICON[m.id]} size={24} tone={CATEGORY_COLOR[p.category]} className={cx(refreshing && 'opacity-50')} />
              {refreshing && <Ring value={build.fraction} size={56} stroke={3} />}
              {strength < 1 && !refreshing && <StrengthBar v={strength} />}
            </button>
          )
        })}
        {build && !build.refresh && (
          <button type="button" aria-pressed={pick === 'build'} aria-label={t('module.building')} onClick={() => toggle('build')} className={cx(tile, 'border-border bg-surface-2/60', pick === 'build' && 'border-brand bg-brand-soft')}>
            <Icon name={MODULE_ICON[build.id]} size={24} tone={CATEGORY_COLOR[p.category]} className="opacity-50" />
            <Ring value={build.fraction} size={56} stroke={3} />
            {build.days !== null && <span className="tabular absolute inset-x-0 bottom-0.5 text-center text-[10px] font-bold leading-none text-ink-2">{t('module.daysEta', { d: build.days })}</span>}
          </button>
        )}
        {Array.from({ length: empties }, (_, i) => (
          <button
            key={`e${i}`}
            type="button"
            aria-pressed={pick === 'add'}
            aria-label={t('module.add')}
            onClick={() => toggle('add')}
            className={cx(tile, 'border-dashed border-border-strong text-ink-3 hover:bg-surface-2 hover:text-ink', pick === 'add' && 'border-brand bg-brand-soft text-brand-ink')}
          >
            <Icon name="plus" size={20} />
          </button>
        ))}
      </div>
      {pick === null && <LatestMeasured project={p} />}
      {pick === 'add' && <Suggestions project={p} onDone={() => setPick(null)} />}
      {pick === 'build' && build && <BuildRow project={p} />}
      {pick && pick !== 'add' && pick !== 'build' && <InstalledRow project={p} id={pick} onDone={() => setPick(null)} />}
    </section>
  )
}

/** The newest module's measured result, always on show under the slots ("Davet sistemi · Son 12g: +27 kullanıcı (öncesi +11/30g)"). */
function LatestMeasured({ project: p }: { project: Project }) {
  const view = useGameStore(
    useShallow((s) => {
      const m = [...(p.modules ?? [])].reverse().find((x) => x.base)
      const line = m ? measuredLine(s.state, p, m) : null
      return m && line ? { id: m.id, ...line } : null
    }),
  )
  if (!view) return null
  return (
    <div data-measured="" className={cx('font-text mt-2 flex items-start gap-1.5 text-[12px] font-semibold leading-snug', view.good === true ? 'text-positive-ink' : view.good === false ? 'text-negative-ink' : 'text-ink-2')}>
      <Icon name={MODULE_ICON[view.id]} size={14} tone={CATEGORY_COLOR[p.category]} className="mt-px shrink-0" />
      <span className="min-w-0">
        {moduleName(view.id, p.category)} · {view.text}
      </span>
    </div>
  )
}

function StrengthBar({ v }: { v: number }) {
  return (
    <span aria-hidden="true" className="absolute inset-x-2 bottom-1.5 h-[3px] overflow-hidden rounded-full bg-border">
      <span className="block h-full rounded-full" style={{ width: `${v * 100}%`, background: strengthTone(v) }} />
    </span>
  )
}

/** The row shell: icon tile, name + one sentence, chips and the commit button under them. */
function Row({ id, category, name, line, chips, action, reason, locked, measured }: { id: ProjectModuleId; category: Project['category']; name: string; line: string; chips: readonly Chip[]; action?: ReactNode; reason?: string | null; locked?: boolean; measured?: MeasuredLine | null }) {
  return (
    <li className={cx('flex flex-col gap-2 rounded-control border border-border p-2.5', locked && 'bg-surface-2/40 opacity-70')}>
      <div className="flex items-start gap-2.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-control bg-surface-2">
          <Icon name={locked ? 'lock' : MODULE_ICON[id]} size={22} tone={locked ? undefined : CATEGORY_COLOR[category]} className={cx(locked && 'text-ink-3')} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13px] font-semibold leading-tight text-ink">{name}</span>
          <span className="font-text text-[12px] leading-snug text-ink-2">{line}</span>
        </span>
        {action}
      </div>
      <ChipRow chips={chips} />
      {measured && (
        <span data-measured="" className={cx('font-text flex items-center gap-1 text-[12px] font-semibold', measured.good === true ? 'text-positive-ink' : measured.good === false ? 'text-negative-ink' : 'text-ink-2')}>
          <Icon name="trend" size={12} />
          {measured.text}
        </span>
      )}
      {reason && <span className="font-text flex items-center gap-1 text-[11px] font-semibold text-negative-ink"><Icon name="warning" size={12} />{reason}</span>}
    </li>
  )
}

function BuildButton({ id, project, refresh, offer, onDone }: { id: ProjectModuleId; project: Project; refresh?: boolean; offer: ModuleOffer; onDone: () => void }) {
  const dispatch = useGameStore((s) => s.dispatch)
  const cost = useBuildCost()
  return (
    <Button
      size="sm"
      tone={refresh ? 'secondary' : 'primary'}
      icon={cost.icon}
      cost={cost.text}
      disabled={offer.error !== null}
      className="shrink-0"
      onClick={() => {
        const r = dispatch({ type: refresh ? 'refreshModule' : 'buildModule', projectId: project.id, moduleId: id })
        if (r.ok) onDone()
      }}
    >
      {t(refresh ? 'module.refresh' : 'module.build')}
    </Button>
  )
}

const reasonOf = (e: ModuleOffer['error']): string | null => (e ? t(`error.${e}`) : null)

/** Three suggested modules, the rest folded behind "Tüm modüller" (stage-locked ones as grey rows with their stage). */
export function Suggestions({ project: p, onDone }: { project: Project; onDone: () => void }) {
  const [all, setAll] = useState(false)
  const st = useGameStore((s) => s.state)
  const offers = suggestModules(st, p, 3)
  const shown = new Set(offers.map((o) => o.id))
  // Every other module this product could take; the ones an installed module rules out stay off the list.
  const rest = moduleOffers(st, p).filter((o) => !o.refresh && o.error !== 'invalid' && !shown.has(o.id))
  return (
    <div className="mt-3 flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {offers.map((o) => (
          <OfferRow key={o.id} project={p} offer={o} onDone={onDone} />
        ))}
      </ul>
      {rest.length > 0 && (
        <>
          <button
            type="button"
            aria-expanded={all}
            onClick={() => setAll((a) => !a)}
            className="flex min-h-11 w-full items-center justify-between rounded-control px-2 text-left text-xs font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            {t('module.all')}
            <Icon name={all ? 'chevronUp' : 'chevronDown'} size={16} />
          </button>
          {all && <TierGroups project={p} rest={rest} onDone={onDone} />}
        </>
      )}
    </div>
  )
}

/** The folded list, grouped by the version that opens each tier ("v2 modülleri"); open modules first inside a group. */
export function TierGroups({ project: p, rest, onDone }: { project: Project; rest: ModuleOffer[]; onDone: () => void }) {
  const tiers = [...new Set(rest.map((o) => moduleDef(o.id)?.tier ?? 1))].sort((a, b) => a - b)
  return (
    <div className="flex flex-col gap-3">
      {tiers.map((tier) => (
        <div key={tier} className="flex flex-col gap-2" data-tier={tier}>
          <span className="px-1 text-[11px] font-semibold tracking-wide text-ink-3">{t('module.allTier', { v: tier })}</span>
          <ul className="flex flex-col gap-2">
            {rest
              .filter((o) => (moduleDef(o.id)?.tier ?? 1) === tier)
              .sort((a, b) => Number(a.error === 'notUnlocked') - Number(b.error === 'notUnlocked'))
              .map((o) => (
                <OfferRow key={o.id} project={p} offer={o} onDone={onDone} />
              ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function OfferRow({ project: p, offer, onDone }: { project: Project; offer: ModuleOffer; onDone: () => void }) {
  const st = useGameStore((s) => s.state)
  // A module not open yet (its version, a prerequisite) shows the lock instead of a button.
  const locked = offer.error === 'notUnlocked' && moduleLock(st, p, offer.id) !== null
  const chips = locked ? lockedChips(st, p, offer.id) : buildChips(st, p, offer)
  return (
    <Row
      id={offer.id}
      category={p.category}
      name={moduleName(offer.id, p.category)}
      line={MODULE_TEXT[offer.id].line}
      chips={chips}
      locked={locked}
      reason={locked ? null : reasonOf(offer.error)}
      action={locked ? undefined : <BuildButton id={offer.id} project={p} offer={offer} onDone={onDone} />}
    />
  )
}

/** The running build: how far, the days left, and the way out. */
function BuildRow({ project: p }: { project: Project }) {
  const dispatch = useGameStore((s) => s.dispatch)
  const b = useBuild(p)
  if (!b) return null
  const chips: Chip[] = [
    { icon: 'timer', label: t('module.tag.time'), text: b.days !== null ? t('module.daysEta', { d: b.days }) : '–', good: null, title: t('module.building') },
    { icon: 'trend', label: t('module.tag.progress'), text: pct(b.fraction), good: null, title: t('module.building') },
  ]
  return (
    <ul className="mt-3">
      <Row
        id={b.id}
        category={p.category}
        name={moduleName(b.id, p.category)}
        line={t('module.building')}
        chips={chips}
        action={
          <Button size="sm" tone="secondary" icon="close" className="shrink-0" onClick={() => dispatch({ type: 'cancelModule', projectId: p.id })}>
            {t('module.cancel')}
          </Button>
        }
      />
    </ul>
  )
}

/** An installed module: what it does; once it slips, the Yenile row with the cost, the days and the strength it returns to. */
function InstalledRow({ project: p, id, onDone }: { project: Project; id: ProjectModuleId; onDone: () => void }) {
  const st = useGameStore((s) => s.state)
  const m = p.modules?.find((x) => x.id === id)
  const offer = moduleOffers(st, p).find((o) => o.id === id && o.refresh)
  if (!m || !offer) return null
  const strength = moduleStrength(m, st.time.day)
  const { gain, minus } = moduleHeadlines(id, p.category)
  const title = MODULE_TEXT[id].line
  const chips: Chip[] = []
  if (strength < 1) {
    chips.push(costChip(offer))
    chips.push({ icon: 'refresh', label: t('module.tag.power'), text: `${pct(strength)} → ${pct(1)}`, good: true, title })
  } else {
    if (gain) chips.push(headlineChip(gain, title))
    if (minus) chips.push(headlineChip(minus, title))
  }
  const measured = m ? measuredLine(st, p, m) : null
  return (
    <ul className="mt-3">
      <Row
        id={id}
        category={p.category}
        name={moduleName(id, p.category)}
        line={MODULE_TEXT[id].line}
        chips={chips}
        reason={strength < 1 ? reasonOf(offer.error) : null}
        measured={measured}
        action={strength < 1 ? <BuildButton id={id} project={p} refresh offer={offer} onDone={onDone} /> : undefined}
      />
    </ul>
  )
}

/** The project card's module row (replaces the percent bar at 1.0): an icon per module, the build as a ring, a faint dot per free slot. */
export function ModuleStrip({ project: p }: { project: Project }) {
  const total = useGameStore((s) => projectSlots(s.state, p).total)
  const build = useBuild(p)
  const select = useGameStore((s) => s.select)
  const mods = p.modules ?? []
  const free = Math.max(0, total - mods.length - (build && !build.refresh ? 1 : 0))
  return (
    <button type="button" aria-label={t('detail.modules')} onClick={() => select({ kind: 'project', id: p.id })} className="flex min-h-11 w-full flex-wrap items-center gap-2 rounded-control px-1 text-left hover:bg-surface-2">
      {mods.map((m) => (
        <span key={m.id} title={moduleName(m.id, p.category)} className="relative grid size-8 shrink-0 place-items-center rounded-control bg-surface-2">
          <Icon name={MODULE_ICON[m.id]} size={18} tone={CATEGORY_COLOR[p.category]} className={cx(build?.refresh && build.id === m.id && 'opacity-50')} />
          {build?.refresh && build.id === m.id && <Ring value={build.fraction} size={32} stroke={2} />}
        </span>
      ))}
      {build && !build.refresh && (
        <span title={t('module.building')} className="relative grid size-8 shrink-0 place-items-center rounded-control bg-surface-2">
          <Icon name={MODULE_ICON[build.id]} size={18} tone={CATEGORY_COLOR[p.category]} className="opacity-50" />
          <Ring value={build.fraction} size={32} stroke={2} />
        </span>
      )}
      {Array.from({ length: free }, (_, i) => (
        <span key={i} aria-hidden="true" className="grid size-8 shrink-0 place-items-center">
          <span className="size-2 rounded-full bg-border-strong/60" />
        </span>
      ))}
      <span data-slot-count="" className="tabular ml-auto pr-1 text-xs font-semibold text-ink-2">{t('module.slots', { used: Math.min(total, mods.length + (build && !build.refresh ? 1 : 0)), total })}</span>
    </button>
  )
}
