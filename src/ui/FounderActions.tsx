// Active founder actions (PLAN §4.4): energy bar, cooldown rings, stage locks.
import { useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { founderActionError } from '../engine/founder'
import { FOUNDER_ACTIONS, type ActionErrorCode, type FounderActionKind } from '../engine/types'
import { STAGES } from '../content'
import { panelSelection, useGameStore } from '../store/gameStore'
import { Icon } from './icons'
import { t } from './i18n'
import { cx, Ring } from './primitives'
import { FOUNDER_ICON, founderActionStage } from './theme'
import { useIsMobile } from './hooks'

export function FounderActions() {
  const mobile = useIsMobile()
  const f = useGameStore(
    useShallow((s) => ({
      energy: s.state.founder.energy,
      current: s.state.founder.currentAction,
      cooldowns: s.state.founder.cooldowns,
      stage: s.state.stage,
      day: s.state.time.day,
      over: !!s.state.gameOver,
    })),
  )
  // Same checks the engine runs (energy, missing project…), so buttons never promise an action that fails.
  const errors = useGameStore(
    useShallow((s) => Object.fromEntries(FOUNDER_ACTIONS.map((k) => [k, founderActionError(s.state, k)])) as Record<FounderActionKind, ActionErrorCode | null>),
  )
  const dispatch = useGameStore((s) => s.dispatch)
  const selection = useGameStore(useShallow((s) => panelSelection(s.ui.panel)))
  const projects = useGameStore(useShallow((s) => s.state.projects))
  // Remember when each cooldown started so the ring can show the fraction left.
  const cdStart = useRef<Partial<Record<FounderActionKind, { start: number; end: number }>>>({})

  const run = (kind: FounderActionKind) => {
    let targetId: string | undefined
    if (kind === 'talkToUsers') {
      targetId = selection?.kind === 'project' ? selection.id : (projects.find((p) => p.maturity < 1) ?? projects[0])?.id
    }
    dispatch({ type: 'founderAction', kind, targetId })
  }

  const busy = !!f.current && f.current.endDay > f.day
  const lowEnergy = f.energy < 20

  return (
    <div className={cx('pointer-events-auto ui-card flex flex-col gap-1.5', mobile ? 'p-1.5' : 'p-2')}>
      <div className="flex items-center gap-2 px-1">
        <Icon name="bolt" size={14} className={lowEnergy ? 'text-rose-600' : 'text-lemon-600'} />
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-cream-200" title={t('founder.energy')}>
          <div className={cx('h-full rounded-full transition-[width] duration-500', lowEnergy ? 'bg-rose-300' : 'bg-lemon-300')} style={{ width: `${Math.max(0, Math.min(100, f.energy))}%` }} />
        </div>
        <span className="tabular text-[11px] font-bold text-ink-600">{Math.round(f.energy)}</span>
      </div>
      <div className="flex items-center gap-1">
        {FOUNDER_ACTIONS.map((kind) => {
          const unlockStage = founderActionStage(kind)
          const locked = f.stage < unlockStage
          const cdEnd = f.cooldowns[kind]
          let cdFrac = 0
          if (cdEnd !== undefined && cdEnd > f.day) {
            const rec = cdStart.current[kind]
            if (!rec || rec.end !== cdEnd) cdStart.current[kind] = { start: f.day, end: cdEnd }
            const r = cdStart.current[kind]!
            cdFrac = r.end > r.start ? (r.end - f.day) / (r.end - r.start) : 0
          }
          const running = f.current?.kind === kind && busy
          const runFrac = running && f.current ? (f.day - f.current.startDay) / Math.max(0.01, f.current.endDay - f.current.startDay) : 0
          const err = errors[kind]
          const disabled = locked || f.over || cdFrac > 0 || (busy && !running) || (!running && err !== null)
          const action = t(`founder.${kind}`)
          const label = locked
            ? t('founder.lockedAt', { action, stage: STAGES[unlockStage]?.name ?? '' })
            : cdFrac > 0 && cdEnd !== undefined
              ? t('founder.cooldown', { action, d: Math.max(1, Math.ceil(cdEnd - f.day)) })
              : err === 'noEnergy'
                ? t('founder.noEnergy', { action })
                : err === 'notFound'
                  ? t('founder.noProject', { action })
                  : `${action}: ${t(`founder.${kind}.desc`)}`
          const size = mobile ? 44 : 48
          const button = (
            <button
              key={kind}
              type="button"
              onClick={() => run(kind)}
              disabled={disabled}
              title={label}
              aria-label={label}
              className={cx(
                'group relative grid shrink-0 place-items-center rounded-full transition-colors',
                running ? 'bg-lilac-100 text-lilac-500' : kind === 'rest' ? 'bg-sky-100 text-sky-600' : 'bg-cream-100 text-ink-900',
                !disabled && 'hover:bg-lilac-100 active:scale-95',
                disabled && !running && 'opacity-45',
              )}
              style={{ width: size, height: size }}
            >
              {cdFrac > 0 && <Ring value={cdFrac} size={size} tone="var(--color-ink-400)" />}
              {running && <Ring value={runFrac} size={size} tone="var(--color-lilac-500)" />}
              <Icon name={locked ? 'lock' : FOUNDER_ICON[kind]} size={mobile ? 18 : 20} />
              {!mobile && (
                <span className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-full bg-ink-900 px-2 py-1 text-[10px] font-bold text-cream-50 group-hover:block">
                  {action}
                </span>
              )}
            </button>
          )
          // Touch has no hover/title: a short visible label under each icon.
          return mobile ? (
            <div key={kind} className="flex w-[46px] flex-col items-center gap-0.5">
              {button}
              <span className={cx('w-full truncate text-center text-[9px] font-bold leading-none', disabled ? 'text-ink-400' : 'text-ink-700')}>{t(`founder.short.${kind}`)}</span>
            </div>
          ) : (
            button
          )
        })}
      </div>
    </div>
  )
}
