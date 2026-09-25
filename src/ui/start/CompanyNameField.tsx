// Startup name field (start screen "Yeni oyun"; reusable by the sign-in flow). Controlled: the parent keeps `value`.
// Blank input means "use the suggestion" (the placeholder), so the player can start with one tap.
import { useId } from 'react'
import { COMPANY_NAME_ISSUE_TEXT, checkCompanyName, suggestCompanyName, type CompanyNameIssue } from '../../content'
import { COMPANY_NAME_MAX } from '../../engine/types'
import { Icon } from '../icons'
import { t } from '../i18n'
import { cx } from '../primitives'

/** The name to start with: the typed one when valid, the suggestion when blank, else the issue to show. */
export function resolveCompanyName(value: string, suggestion: string): { name: string } | { issue: CompanyNameIssue } {
  const res = checkCompanyName(value.trim() ? value : suggestion)
  return res.ok ? { name: res.value } : { issue: res.issue }
}

/** Live issue while typing ("too short" waits for submit: every name starts short). */
export function liveIssue(value: string): CompanyNameIssue | null {
  if (!value.trim()) return null
  const res = checkCompanyName(value)
  return res.ok || res.issue === 'short' ? null : res.issue
}

export function CompanyNameField({
  value,
  onChange,
  suggestion,
  onSuggest,
  issue,
  onSubmit,
  autoFocus,
  quiet,
}: {
  value: string
  onChange: (v: string) => void
  suggestion: string
  /** Rolls a new suggestion and puts it in the field. */
  onSuggest: (next: string) => void
  /** Issue to show under the field (submit-time or live); null shows the hint. */
  issue: CompanyNameIssue | null
  onSubmit?: () => void
  autoFocus?: boolean
  /** No hint line when there is no issue (the sign-in card already has its one sentence). */
  quiet?: boolean
}) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="text-xs font-semibold tracking-wide text-ink-2">
        {t('start.companyLabel')}
      </label>
      <div className="mt-1 flex items-center gap-1.5">
        <input
          id={id}
          type="text"
          value={value}
          autoFocus={autoFocus}
          autoComplete="organization"
          spellCheck={false}
          maxLength={COMPANY_NAME_MAX + 8}
          placeholder={t('start.companyPlaceholder', { v: suggestion })}
          aria-invalid={!!issue}
          aria-describedby={`${id}-hint`}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit?.()
          }}
          className={cx(
            'h-11 min-w-0 flex-1 rounded-control border bg-surface px-3 text-sm font-semibold text-ink outline-none transition-colors placeholder:font-medium placeholder:text-ink-3 focus:border-brand',
            issue ? 'border-negative' : 'border-border-strong',
          )}
        />
        <button
          type="button"
          onClick={() => {
            let next = suggestCompanyName()
            for (let i = 0; i < 4 && next === value; i++) next = suggestCompanyName()
            onSuggest(next)
          }}
          title={t('start.companyRandom')}
          aria-label={t('start.companyRandom')}
          className="grid size-11 shrink-0 place-items-center rounded-control border border-border-strong text-ink-2 transition-colors hover:bg-surface-2 hover:text-brand-ink"
        >
          <Icon name="refresh" size={18} />
        </button>
      </div>
      {(!quiet || issue) && (
        <p id={`${id}-hint`} className={cx('font-text mt-1.5 min-h-4 text-[11px]', issue ? 'text-negative-ink' : 'text-ink-2')}>
          {issue ? COMPANY_NAME_ISSUE_TEXT[issue] : t('start.companyHint')}
        </p>
      )}
    </div>
  )
}
