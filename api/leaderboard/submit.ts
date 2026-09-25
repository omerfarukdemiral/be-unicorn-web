// POST /api/leaderboard/submit (Bearer) LeaderboardSubmitBody → LeaderboardSubmitOk. Implausible numbers → 422.
import { bodyObject, ok, route, toVercel } from '../_lib/http.js'
import { limit, requireUser } from '../_lib/auth.js'
import { submit } from '../_lib/leaderboard.js'

export const handler = route({
  POST: async (req, kv) => {
    const me = await requireUser(kv, req)
    await limit(kv, 'submit', me.emailHash)
    return ok(await submit(kv, me, bodyObject(req)))
  },
})
export default toVercel(handler)
