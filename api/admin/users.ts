// GET /api/admin/users (admin Bearer) → AdminUsersOk; ?id=… → AdminUserDetail. POST AdminActionBody → AdminActionOk.
import { ApiError, bodyObject, ok, route, toVercel } from '../_lib/http.js'
import { adminAction, isUserId, listUsers, requireAdmin, userDetail } from '../_lib/admin.js'

export const handler = route({
  GET: async (req, kv) => {
    await requireAdmin(kv, req)
    const id = req.query.id
    if (id === undefined) return ok(await listUsers(kv))
    if (!isUserId(id)) throw new ApiError(400, 'badRequest')
    return ok(await userDetail(kv, id))
  },
  POST: async (req, kv) => {
    await requireAdmin(kv, req)
    return ok(await adminAction(kv, bodyObject(req)))
  },
})
export default toVercel(handler)
