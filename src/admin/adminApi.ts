// Client for /api/admin/**. The token lives in sessionStorage: closing the tab signs the admin out.
import type {
  AdminAction,
  AdminActionOk,
  AdminLoginOk,
  AdminUserDetail,
  AdminUsersOk,
  ApiErrorBody,
  ApiErrorCode,
} from '../net/contract'
import { errorMessage } from '../net/netText'

export type AdminResult<T> = { ok: true; data: T } | { ok: false; error: ApiErrorCode; message: string }

const TOKEN_KEY = 'be-unicorn:admin'

export function adminToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

function message(code: ApiErrorCode, extra?: Partial<ApiErrorBody>): string {
  if (code === 'wrongCredentials') return 'Şifre yanlış.'
  if (code === 'notConfigured') return 'ADMIN_PASSWORD tanımlı değil (en az 16 karakter).'
  return errorMessage(code, extra)
}

async function request<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<AdminResult<T>> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (opts.body !== undefined) headers['content-type'] = 'application/json'
  const token = adminToken()
  if (token) headers.authorization = `Bearer ${token}`
  try {
    const resp = await fetch(path, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      cache: 'no-store',
    })
    if (!(resp.headers.get('content-type') ?? '').includes('application/json')) return { ok: false, error: 'offline', message: message('offline') }
    const body = (await resp.json()) as unknown
    if (resp.ok) return { ok: true, data: body as T }
    const eb = body as Partial<ApiErrorBody>
    const code = eb.error ?? 'server'
    if (code === 'unauthorized') sessionStorage.removeItem(TOKEN_KEY)
    return { ok: false, error: code, message: message(code, eb) }
  } catch {
    return { ok: false, error: 'offline', message: message('offline') }
  }
}

export async function signIn(password: string): Promise<AdminResult<AdminLoginOk>> {
  const r = await request<AdminLoginOk>('/api/admin/login', { method: 'POST', body: { password } })
  if (r.ok) sessionStorage.setItem(TOKEN_KEY, r.data.token)
  return r
}

export async function signOut(): Promise<void> {
  await request('/api/admin/login', { method: 'DELETE' })
  sessionStorage.removeItem(TOKEN_KEY)
}

export const getUsers = () => request<AdminUsersOk>('/api/admin/users')
export const getUser = (id: string) => request<AdminUserDetail>(`/api/admin/users?id=${id}`)
export const runAction = (id: string, action: AdminAction, value?: string) =>
  request<AdminActionOk>('/api/admin/users', { method: 'POST', body: { id, action, value } })
