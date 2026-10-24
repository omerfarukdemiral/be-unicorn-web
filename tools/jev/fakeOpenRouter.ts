// A local stand-in for OpenRouter's /chat/completions, to run Jev end to end without a key (tests only).
//   npx tsx tools/jev/fakeOpenRouter.ts --port 8787
//   OPENROUTER_BASE_URL=http://127.0.0.1:8787/v1 OPENROUTER_API_KEY=fake OPENROUTER_MODEL=fake/jev npm run jev -- --env /dev/null
// It answers with the move marked [öneri] (else a random listed id), sometimes wraps it in prose, and every
// `--bad`-th call returns an id that is not on the list (exercises the retry / fallback path). It also checks that a
// Bearer header arrived, and never prints it.
import { createServer } from 'node:http'

const argv = process.argv.slice(2)
const val = (n: string, d: number) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 ? Number(argv[i + 1]) : d
}
const PORT = val('port', 8787)
const BAD_EVERY = val('bad', 5)
let calls = 0

createServer((req, res) => {
  if (req.method !== 'POST' || !req.url?.endsWith('/chat/completions')) {
    res.writeHead(404).end()
    return
  }
  const chunks: Buffer[] = []
  req.on('data', (c: Buffer) => chunks.push(c))
  req.on('end', () => {
    calls++
    const authed = /^Bearer \S+/.test(String(req.headers.authorization ?? ''))
    if (!authed) {
      res.writeHead(401, { 'content-type': 'application/json' }).end(JSON.stringify({ error: { message: 'no key' } }))
      return
    }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { messages: { role: string; content: string }[] }
    const user = body.messages.find((m) => m.role === 'user')?.content ?? ''
    const ids = [...user.matchAll(/^([A-Za-z0-9_.-]+): .*$/gm)].map((m) => ({ id: m[1]!, chip: m[0].includes('[öneri]') }))
    const chip = ids.find((x) => x.chip)?.id
    const pick = chip ?? ids[Math.floor(Math.random() * ids.length)]?.id ?? 'bekle'
    const bad = BAD_EVERY > 0 && calls % BAD_EVERY === 0
    const answer = JSON.stringify({ action: bad ? 'uydurma_hamle' : pick, why: chip ? 'Oyunun önerisi mantıklı görünüyor.' : 'Bir şey denemek istiyorum.' })
    const content = calls % 3 === 0 ? `Tamam, işte cevabım:\n\`\`\`json\n${answer}\n\`\`\`` : answer
    res.writeHead(200, { 'content-type': 'application/json' }).end(
      JSON.stringify({
        id: `fake-${calls}`,
        model: 'fake/jev',
        choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }],
        usage: { prompt_tokens: Math.ceil(user.length / 4), completion_tokens: Math.ceil(content.length / 4) },
      }),
    )
  })
}).listen(PORT, '127.0.0.1', () => console.log(`[fake-openrouter] http://127.0.0.1:${PORT}/v1`))
