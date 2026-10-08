// Startup name field (start screen "Yeni oyun"; reusable by the sign-in flow). Controlled: the parent keeps `value`.
// Blank input means "use the suggestion" (the placeholder), so the player can start with one tap.
import { useId } from 'react'
import { COMPANY_NAME_ISSUE_TEXT, checkCompanyName, suggestCompanyName, type CompanyNameIssue } from '../../content'
import { COMPANY_NAME_MAX } from '../../engine/types'
import { t } from '../i18n'
import { IconButton, Label, cx } from '../primitives'

/** Start-screen text field: a recessed well (no 1px frame). 16px text: iOS zooms the page into any smaller input. */
export const INPUT = 'ui-inset h-11 w-full min-w-0 px-3 font-ui text-[16px] font-bold text-ink placeholder:font-semibold placeholder:text-ink-3'

/**
 * Invalid mark: a 2px negative ring drawn as an inset shadow, not an outline. The global :focus-visible rule is
 * unlayered and replaces any outline on focus, so an outline ring would vanish on the very field the error focuses.
 */
export function inputRing(invalid: boolean): string {
  return invalid ? 'shadow-[inset_0_0_0_2px_var(--color-negative)]' : ''
}

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
      <label htmlFor={id} className="block">
        <Label>{t('start.companyLabel')}</Label>
      </label>
      <div className="mt-1 flex items-center gap-2">
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
          className={cx(INPUT, 'flex-1', inputRing(!!issue))}
        />
        {/* A dice key beside the well: rolling a name is a toy, not a form control. */}
        <IconButton
          raised
          icon="refresh"
          label={t('start.companyRandom')}
          onClick={() => {
            let next = suggestCompanyName()
            for (let i = 0; i < 4 && next === value; i++) next = suggestCompanyName()
            onSuggest(next)
          }}
        />
      </div>
      {(!quiet || issue) && (
        <p id={`${id}-hint`} className={cx('font-text mt-1.5 min-h-4 text-[11px]', issue ? 'text-negative-ink' : 'text-ink-2')}>
          {issue ? COMPANY_NAME_ISSUE_TEXT[issue] : t('start.companyHint')}
        </p>
      )}
    </div>
  )
}
