// GET /api/save (Bearer) → SaveGetOk. PUT {data, baseRev, force?} → SavePutOk; stale baseRev → 409 + server copy.
import { bodyObject, ok, route, toVercel } from './_lib/http.js'
import { limitIp, requireUser } from './_lib/auth.js'
import { readSave, writeSave } from './_lib/save.js'

export const handler = route({
  GET: async (req, kv) => {
    await limitIp(kv, 'save', req.ip)
    const me = await requireUser(kv, req)
    return ok(await readSave(kv, me.emailHash))
  },
  PUT: async (req, kv) => {
    await limitIp(kv, 'save', req.ip)
    const me = await requireUser(kv, req)
    return ok(await writeSave(kv, me.emailHash, bodyObject(req)))
  },
})
export default toVercel(handler)
