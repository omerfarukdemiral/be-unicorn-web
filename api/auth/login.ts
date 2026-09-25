// POST /api/auth/login {email, pin} → AuthOk. Wrong PIN: 401 (attemptsLeft); past 5 tries in 15 min: 429 `locked`.
import { bodyObject, ok, route, toVercel } from '../_lib/http.js'
import { limit, login } from '../_lib/auth.js'

export const handler = route({
  POST: async (req, kv) => {
    await limit(kv, 'auth', req.ip)
    return ok(await login(kv, bodyObject(req)))
  },
})
export default toVercel(handler)
