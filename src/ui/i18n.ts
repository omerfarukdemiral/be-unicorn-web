// Keyed UI text. Source of truth is content's UI_TEXT.
import { UI_TEXT } from '../content'
import { STAGE_TEXT, stageBand } from '../content/stageBand'

export type TextParams = Record<string, string | number>

/** Replaces {name} placeholders. Unknown params stay visible for easy spotting. */
export function fill(template: string, params?: TextParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (m, k: string) => {
    const v = params[k]
    return v === undefined ? m : String(v)
  })
}

const reportedMissing = new Set<string>()

export function t(key: string, params?: TextParams): string {
  const text = UI_TEXT[key]
  if (text === undefined) {
    if (import.meta.env.DEV && !reportedMissing.has(key)) {
      reportedMissing.add(key)
      console.warn(`[ui] missing text key: ${key}`)
    }
    return key
  }
  return fill(text, params)
}

/** t(key) in the voice of the company's size: STAGE_TEXT overrides a band, anything else is the key's own text. */
export function stageText(key: string, stage: number, params?: TextParams): string {
  const v = STAGE_TEXT[key]?.[stageBand(stage)]
  return v === undefined ? t(key, params) : fill(v, params)
}
