// POST /api/auth/register {email, pin, companyName} → AuthOk (201). 409 `emailTaken` when the e-mail exists.
import { bodyObject, ok, route, toVercel } from '../_lib/http.js'
import { limit, register } from '../_lib/auth.js'

export const handler = route({
  POST: async (req, kv) => {
    await limit(kv, 'register', req.ip)
    return ok(await register(kv, bodyObject(req)), 201)
  },
})
export default toVercel(handler)
