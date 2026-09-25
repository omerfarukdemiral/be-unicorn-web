// POST /api/auth/login {email, pin} → AuthOk. Wrong PIN: 401 (attemptsLeft); 5th wrong: 429 `locked` for 15 min.
import { bodyObject, ok, route, toVercel } from '../_lib/http.js'
import { limitIp, login } from '../_lib/auth.js'

export const handler = route({
  POST: async (req, kv) => {
    await limitIp(kv, 'auth', req.ip)
    return ok(await login(kv, bodyObject(req)))
  },
})
export default toVercel(handler)
