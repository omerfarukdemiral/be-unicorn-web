// GET /api/health — 200 when Redis is configured, 503 `notConfigured` otherwise (the client then plays offline).
import { ok, route, toVercel } from './_lib/http.js'

export const handler = route({ GET: async () => ok({ ok: true }) })
export default toVercel(handler)
