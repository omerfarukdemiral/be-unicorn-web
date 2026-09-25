// Liderlik: the live leaderboard in the single panel (net/cloud polls it every 10 s while this is open).
// Head card: my rank / total and the one sentence (gap to the row above). Rows: rank, startup, stage, valuation,
// then e-mail (masked for others), run length "7 ay (210 gün)", team "18 kişilik ekip", cash. My row is tinted
// and shows my full e-mail; outside the top list it follows after a "…" row.
import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { STAGES } from '../../content'
import { useCloud } from '../../net/cloud'
import type { LeaderboardGap, LeaderboardOk, LeaderboardRow } from '../../net/contract'
import { runLengthText, teamText } from '../../net/netText'
import { useGameStore } from '../../store/gameStore'
import { Icon } from '../icons'
import { t } from '../i18n'
import { money } from '../format'
import { Button, cx, Empty, Pill } from '../primitives'

/** Seconds since the board arrived, ticking once a second. */
function useAgo(at: number | null): number | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return at === null ? null : Math.max(0, Math.round((now - at) / 1000))
}

export function gapLine(above: LeaderboardRow, gap: LeaderboardGap): string {
  const base = { rank: above.rank, name: above.companyName }
  if (gap.stages > 0) return t('lb.gapStage', { ...base, n: gap.stages })
  if (gap.days > 0) return t('lb.gapDays', { ...base, n: gap.days })
  if (gap.valuation > 0) return t('lb.gapValuation', { ...base, v: money(gap.valuation) })
  return t('lb.gapTie', base)
}

/** Log in from offline play: the sign-in card comes back on reload (the local save is written first). */
function goSignIn() {
  useGameStore.getState().save()
  window.location.reload()
}

export function LeaderboardPanel() {
  const c = useCloud(
    useShallow((s) => ({
      backend: s.backend,
      account: s.account,
      board: s.board,
      boardAt: s.boardAt,
      boardError: s.boardError,
      submitError: s.submitError,
    })),
  )
  const ago = useAgo(c.boardAt)

  if (c.backend !== 'online') {
    return (
      <div className="flex flex-col gap-3">
        <Empty icon="cloud" text={t('lb.signedOut')} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <MeCard board={c.board} signedIn={!!c.account} />
      {c.submitError && <p className="font-text text-[11px] text-negative-ink">{t('lb.submitError', { v: c.submitError })}</p>}

      <div className="flex items-center gap-2 text-[11px] text-ink-2">
        <span className="inline-flex items-center gap-1 font-semibold text-positive-ink">
          <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-positive" />
          {t('lb.live')}
        </span>
        <span className="tabular">{ago === null ? '' : ago < 3 ? t('lb.updatedNow') : t('lb.updated', { v: ago })}</span>
        {c.board && <span className="tabular ml-auto">{t('lb.total', { v: c.board.total })}</span>}
      </div>
      {c.boardError && <p className="font-text text-[11px] text-negative-ink">{c.boardError}</p>}

      {!c.board ? (
        !c.boardError && <Empty icon="trophy" text={t('login.busy')} />
      ) : c.board.rows.length === 0 ? (
        <Empty icon="unicorn" text={t('lb.empty')} />
      ) : (
        <>
          {/* Which number is which: the big one is the valuation, cash is the small "Kasa" on the second line. */}
          <div className="-mb-1.5 flex items-center justify-between px-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
            <span className="pl-9">{t('lb.colStartup')}</span>
            <span>{t('lb.colValuation')}</span>
          </div>
          <BoardRows board={c.board} />
        </>
      )}
      <p className="font-text text-[11px] leading-snug text-ink-3">{t('lb.rule')}</p>
    </div>
  )
}

function MeCard({ board, signedIn }: { board: LeaderboardOk | null; signedIn: boolean }) {
  if (!signedIn) {
    return (
      <div className="rounded-card border border-border bg-surface-2/60 p-3">
        <p className="font-text text-xs text-ink-2">{t('lb.signedOut')}</p>
        <Button size="sm" tone="primary" icon="mail" className="mt-2" onClick={goSignIn}>
          {t('account.signIn')}
        </Button>
      </div>
    )
  }
  const me = board?.me
  if (!board) return null
  if (!me) {
    return (
      <div className="rounded-card border border-border bg-surface-2/60 p-3">
        <p className="font-text text-xs text-ink-2">{t('lb.notOnBoard')}</p>
      </div>
    )
  }
  const line = board.above && board.gap ? gapLine(board.above, board.gap) : t('lb.first')
  return (
    <div className="rounded-card border border-brand/30 bg-brand-soft p-3">
      <div className="flex items-baseline gap-2">
        <span className="ui-label text-brand-ink">{t('lb.you')}</span>
        <span className="tabular text-2xl font-bold leading-none text-brand-ink">{t('lb.yourRank', { rank: me.rank, total: board.total })}</span>
      </div>
      <p className="font-text mt-1.5 text-xs text-ink">{line}</p>
    </div>
  )
}

function BoardRows({ board }: { board: LeaderboardOk }) {
  const me = board.me
  const meInTop = !!me && board.rows.some((r) => r.me)
  return (
    <ol className="flex flex-col gap-1.5" aria-label={t('lb.title')}>
      {board.rows.map((r) => (
        <Row key={`${r.rank}:${r.email}`} row={r} />
      ))}
      {me && !meInTop && (
        <>
          <li aria-hidden="true" className="text-center text-xs leading-none text-ink-3">
            {t('lb.more')}
          </li>
          <Row row={me} />
        </>
      )}
    </ol>
  )
}

function RankMark({ rank }: { rank: number }) {
  // Top three: a small trophy tint (gold, silver, bronze-ish), the rest a plain number.
  const tint = rank === 1 ? 'var(--color-g-equity)' : rank === 2 ? 'var(--color-ink-3)' : rank === 3 ? 'var(--color-g-burn)' : null
  return (
    <span
      className={cx('tabular grid h-7 min-w-7 shrink-0 place-items-center rounded-control px-1 text-xs font-bold', !tint && 'text-ink-2')}
      style={tint ? { color: tint, background: `color-mix(in srgb, ${tint} 14%, transparent)` } : undefined}
    >
      {rank}
    </span>
  )
}

function Row({ row }: { row: LeaderboardRow }) {
  const stage = STAGES[row.stage]
  const unicorn = row.stage >= STAGES.length - 1
  return (
    <li
      className={cx(
        'rounded-control border px-2.5 py-2',
        row.me ? 'border-brand/40 bg-brand-soft' : 'border-border bg-surface',
      )}
      aria-current={row.me ? 'true' : undefined}
    >
      <div className="flex min-w-0 items-center gap-2">
        <RankMark rank={row.rank} />
        <span className={cx('min-w-0 flex-1 truncate text-sm font-semibold', row.me ? 'text-brand-ink' : 'text-ink')} title={row.companyName}>
          {row.companyName}
        </span>
        <Pill tint={unicorn ? 'var(--color-g-equity)' : 'var(--color-brand)'} className="shrink-0">
          {unicorn && <Icon name="unicorn" size={11} />}
          {stage?.name ?? '—'}
        </Pill>
        <span className="tabular w-16 shrink-0 text-right text-sm font-bold text-ink" title={t('lb.valuationTitle', { v: money(row.valuation) })}>
          {money(row.valuation)}
        </span>
      </div>
      {/* Who (masked e-mail) · cash on the right; then how long and how big: "7 ay (210 gün) · 18 kişilik ekip". */}
      <div className="font-text mt-1 flex min-w-0 items-center gap-2 pl-9 text-[11px] text-ink-2">
        <span className={cx('min-w-0 flex-1 truncate', row.me && 'font-semibold text-ink')} title={row.email}>
          {row.email}
        </span>
        <span className="tabular shrink-0">{t('lb.cash', { v: money(row.cash) })}</span>
      </div>
      <div className="font-text tabular mt-0.5 flex min-w-0 items-center gap-1.5 pl-9 text-[11px] text-ink-2">
        <span className="whitespace-nowrap">{runLengthText(row.day)}</span>
        <span aria-hidden="true" className="text-ink-3">·</span>
        <span className="min-w-0 truncate">{teamText(row.team)}</span>
        {row.status === 'bankrupt' && <Pill className="ml-auto shrink-0 text-negative-ink">{t('lb.status.bankrupt')}</Pill>}
      </div>
    </li>
  )
}
