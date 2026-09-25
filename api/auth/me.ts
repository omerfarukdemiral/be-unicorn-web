// GET /api/auth/me (Bearer) → MeOk: checks a stored token and renews it. DELETE ends the session (log out).
import { ok, route, toVercel } from '../_lib/http.js'
import { endSession, limitIp, requireUser } from '../_lib/auth.js'

export const handler = route({
  GET: async (req, kv) => {
    await limitIp(kv, 'save', req.ip)
    const { user } = await requireUser(kv, req)
    return ok({ email: user.email, companyName: user.companyName })
  },
  DELETE: async (req, kv) => {
    await endSession(kv, req)
    return ok({ ok: true })
  },
})
export default toVercel(handler)
