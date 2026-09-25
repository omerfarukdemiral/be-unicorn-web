/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'

/**
 * `MOCK_API=1 npm run dev`: serves /api/* from the real handlers over an in-memory Redis (api/_dev/devApi.ts), so the
 * online flow works without `vercel dev` / Upstash. Data lives until the dev server stops. Dev server only.
 */
function mockApi(): Plugin {
  return {
    name: 'be-unicorn-mock-api',
    apply: 'serve',
    configureServer(server) {
      if (process.env.MOCK_API !== '1') return
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://local')
        if (!url.pathname.startsWith('/api/')) return next()
        const chunks: Buffer[] = []
        for await (const c of req) chunks.push(c as Buffer)
        const raw = Buffer.concat(chunks).toString('utf8')
        let body: unknown = null
        try {
          body = raw ? JSON.parse(raw) : null
        } catch {
          body = raw
        }
        const headers: Record<string, string | undefined> = {}
        for (const [k, v] of Object.entries(req.headers)) headers[k.toLowerCase()] = Array.isArray(v) ? v.join(',') : v
        const mod = (await server.ssrLoadModule('/api/_dev/devApi.ts')) as typeof import('./api/_dev/devApi')
        const out = await mod.devApi({
          path: url.pathname,
          method: req.method ?? 'GET',
          headers,
          query: Object.fromEntries(url.searchParams),
          body,
          ip: req.socket.remoteAddress ?? 'dev',
        })
        if (!out) return next()
        for (const [k, v] of Object.entries(out.headers ?? {})) res.setHeader(k, v)
        res.statusCode = out.status
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(out.body))
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), mockApi()],
  build: { chunkSizeWarningLimit: 2000 },
  test: {
    include: ['src/**/*.test.ts', 'sim/**/*.test.ts', 'api/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
})
