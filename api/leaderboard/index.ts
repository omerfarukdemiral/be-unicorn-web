// GET /api/leaderboard?limit=50 → LeaderboardOk. With a Bearer token: the caller's row, the row above and the gap.
// Signed-in callers are limited per account, anonymous ones per IP.
import { ok, route, toVercel } from '../_lib/http.js'
import { limit, optionalUser } from '../_lib/auth.js'
import { list, parseLimit } from '../_lib/leaderboard.js'

export const handler = route({
  GET: async (req, kv) => {
    const me = await optionalUser(kv, req)
    await (me ? limit(kv, 'board', me.emailHash) : limit(kv, 'boardIp', req.ip))
    return ok(await list(kv, me, parseLimit(req.query.limit)))
  },
})
export default toVercel(handler)
