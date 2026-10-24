// Jev's model client: OpenRouter chat completions (OpenAI-compatible). Node only: the key is read from process.env
// here and goes nowhere but the Authorization header. Nothing in this file logs it.

export interface LlmConfig {
  baseUrl: string
  model: string
  /** Read once by the caller from process.env.OPENROUTER_API_KEY; never logged. */
  apiKey: string
  maxTokens: number
  timeoutMs: number
}

export interface LlmAnswer {
  action: string
  why: string
}

export interface LlmResult {
  answer: LlmAnswer | null
  /** Raw text of the reply (trimmed, capped), for the run log. */
  raw: string
  promptTokens?: number
  completionTokens?: number
  error?: string
  ms: number
}

export const SYSTEM_PROMPT = [
  'Sen Jev\'sin: Be Unicorn adlı startup oyununu oynuyorsun. Amaç: iflas etmeden, olabildiğince az oyun gününde şirket değerlemesini 1 milyar $ (Unicorn) seviyesine çıkarmak.',
  'Aşamalar: Garaj → Pre-seed → Seed → Series A → Series B → Series C → Unicorn. Her aşamaya, değerleme hedefe yaklaşınca yatırım turu açarak geçilir.',
  'Birimler: para $ (cash kasa, mrr aylık gelir, netPerDay günlük net, valuation değerleme), runwayMonths = kasanın yeteceği ay (null = kârda), morale/founderEnergy 0-100, maturityPct ürün olgunluğu.',
  'Kasa eksiye düşer ve maaşlar ödenemezse oyun biter. Kurucu aksiyonları haftalık hamle ve enerji harcar.',
  'Sana gözlem (obs) ve şu an YASAL hamlelerin listesi (moves: id + label) verilir. chip:true olan, oyunun kendi önerisidir.',
  'SADECE şu JSON ile cevap ver, başka hiçbir şey yazma: {"action":"<moves listesindeki bir id>","why":"<tek kısa Türkçe cümle>"}',
].join('\n')

/** The first JSON object in a reply (models sometimes wrap it in prose or a code fence). */
export function parseAnswer(text: string): LlmAnswer | null {
  const t = text.replace(/```(?:json)?/gi, '')
  const start = t.indexOf('{')
  if (start < 0) return null
  let depth = 0
  for (let i = start; i < t.length; i++) {
    if (t[i] === '{') depth++
    else if (t[i] === '}' && --depth === 0) {
      try {
        const o = JSON.parse(t.slice(start, i + 1)) as Record<string, unknown>
        if (typeof o.action !== 'string') return null
        return { action: o.action.trim(), why: typeof o.why === 'string' ? o.why.trim().slice(0, 200) : '' }
      } catch {
        return null
      }
    }
  }
  return null
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** One chat completion with backoff on 429 / 5xx / network errors (up to `tries` attempts). */
export async function ask(cfg: LlmConfig, user: string, tries = 4): Promise<LlmResult> {
  const t0 = Date.now()
  let lastErr = ''
  // Some providers refuse response_format: one retry without it on a 400.
  let jsonMode = true
  for (let attempt = 0; attempt < tries; attempt++) {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), cfg.timeoutMs)
    try {
      const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        signal: ctl.signal,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${cfg.apiKey}`,
          'x-title': 'Be Unicorn Jev',
        },
        body: JSON.stringify({
          model: cfg.model,
          max_tokens: cfg.maxTokens,
          temperature: 0.4,
          ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: user },
          ],
        }),
      })
      if (res.status === 429 || res.status >= 500) {
        lastErr = `http ${res.status}`
        const ra = Number(res.headers.get('retry-after'))
        await sleep(Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 30_000) : 1500 * 2 ** attempt)
        continue
      }
      const body = (await res.json().catch(() => null)) as {
        choices?: { message?: { content?: string } }[]
        usage?: { prompt_tokens?: number; completion_tokens?: number }
        error?: { message?: string }
      } | null
      if (res.status === 400 && jsonMode) {
        jsonMode = false
        lastErr = 'http 400'
        continue
      }
      if (!res.ok) return { answer: null, raw: '', error: `http ${res.status}: ${String(body?.error?.message ?? '').slice(0, 160)}`, ms: Date.now() - t0 }
      const raw = (body?.choices?.[0]?.message?.content ?? '').trim()
      return {
        answer: parseAnswer(raw),
        raw: raw.slice(0, 400),
        ...(body?.usage?.prompt_tokens !== undefined ? { promptTokens: body.usage.prompt_tokens } : {}),
        ...(body?.usage?.completion_tokens !== undefined ? { completionTokens: body.usage.completion_tokens } : {}),
        ms: Date.now() - t0,
      }
    } catch (e) {
      lastErr = (e as Error).name === 'AbortError' ? 'timeout' : `network: ${(e as Error).message.slice(0, 120)}`
      if (lastErr === 'timeout') return { answer: null, raw: '', error: lastErr, ms: Date.now() - t0 }
      await sleep(1500 * 2 ** attempt)
    } finally {
      clearTimeout(timer)
    }
  }
  return { answer: null, raw: '', error: lastErr || 'failed', ms: Date.now() - t0 }
}
