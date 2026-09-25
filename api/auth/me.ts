// GET /api/auth/me (Bearer) → MeOk: checks a stored token and renews it (app start). DELETE ends the session
// (log out); DELETE ?all=1 ends every session of the account ("sign out everywhere").
import { ok, route, toVercel } from '../_lib/http.js'
import { endSession, limit, requireUser } from '../_lib/auth.js'

export const handler = route({
  GET: async (req, kv) => {
    await limit(kv, 'session', req.ip)
    const { user } = await requireUser(kv, req, { renew: true })
    return ok({ email: user.email, companyName: user.companyName })
  },
  DELETE: async (req, kv) => {
    await limit(kv, 'session', req.ip)
    await endSession(kv, req, req.query.all === '1')
    return ok({ ok: true })
  },
})
export default toVercel(handler)
