// GET /api/leaderboard?limit=50 → LeaderboardOk. With a Bearer token: the caller's row, the row above and the gap.
import { ok, route, toVercel } from '../_lib/http.js'
import { limitIp, optionalUser } from '../_lib/auth.js'
import { list, parseLimit } from '../_lib/leaderboard.js'

export const handler = route({
  GET: async (req, kv) => {
    await limitIp(kv, 'board', req.ip)
    return ok(await list(kv, await optionalUser(kv, req), parseLimit(req.query.limit)))
  },
})
export default toVercel(handler)
