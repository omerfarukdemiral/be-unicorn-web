// POST /api/admin/login {password} → AdminLoginOk. 10 tries per IP in 15 minutes. DELETE (Bearer) ends the admin session.
import { bodyObject, ok, route, toVercel } from '../_lib/http.js'
import { limit } from '../_lib/auth.js'
import { adminLogin, adminLogout } from '../_lib/admin.js'

export const handler = route({
  POST: async (req, kv) => {
    await limit(kv, 'adminLogin', req.ip)
    return ok(await adminLogin(kv, bodyObject(req)))
  },
  DELETE: async (req, kv) => {
    await adminLogout(kv, req)
    return ok({ ok: true })
  },
})
export default toVercel(handler)
