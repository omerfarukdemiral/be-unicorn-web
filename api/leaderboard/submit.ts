// POST /api/leaderboard/submit (Bearer) LeaderboardSubmitBody → LeaderboardSubmitOk. Implausible numbers → 422.
import { bodyObject, ok, route, toVercel } from '../_lib/http.js'
import { limitIp, requireUser } from '../_lib/auth.js'
import { submit } from '../_lib/leaderboard.js'

export const handler = route({
  POST: async (req, kv) => {
    await limitIp(kv, 'submit', req.ip)
    const me = await requireUser(kv, req)
    return ok(await submit(kv, me, bodyObject(req)))
  },
})
export default toVercel(handler)
