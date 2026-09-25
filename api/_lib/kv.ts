// The small slice of Redis the API uses, behind an interface so tests run on an in-memory store (memoryKv.ts).
// Values are always strings: JSON is (de)serialized here, never by the Redis client.
import { Redis } from '@upstash/redis'

export interface ZMember {
  member: string
  score: number
}

export interface Kv {
  get(key: string): Promise<string | null>
  mget(keys: string[]): Promise<(string | null)[]>
  /** `nx`: only when the key does not exist; returns false then. `ex`: TTL in seconds. */
  set(key: string, value: string, opts?: { ex?: number; nx?: boolean }): Promise<boolean>
  del(key: string): Promise<void>
  /** Increments and returns the new value; `ex` sets the TTL only when the key was just created. */
  incr(key: string, ex?: number): Promise<number>
  expire(key: string, seconds: number): Promise<void>
  /** Remaining TTL in seconds; -1 no TTL, -2 no key. */
  ttl(key: string): Promise<number>
  zadd(key: string, score: number, member: string): Promise<void>
  zrem(key: string, member: string): Promise<void>
  /** Highest score first, inclusive range. */
  zrevrange(key: string, start: number, stop: number): Promise<ZMember[]>
  /** 0-based rank, highest score first; null when absent. */
  zrevrank(key: string, member: string): Promise<number | null>
  zcard(key: string): Promise<number>
}

export interface RedisEnv {
  url: string
  token: string
}

/** Vercel Marketplace (KV_REST_API_*) and plain Upstash (UPSTASH_REDIS_REST_*) env names both work. */
export function redisEnv(env: Record<string, string | undefined> = process.env): RedisEnv | null {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? { url, token } : null
}

class UpstashKv implements Kv {
  private r: Redis
  constructor(env: RedisEnv) {
    this.r = new Redis({ url: env.url, token: env.token, automaticDeserialization: false })
  }
  async get(key: string) {
    const v = await this.r.get<string>(key)
    return v == null ? null : String(v)
  }
  async mget(keys: string[]) {
    if (keys.length === 0) return []
    const v = await this.r.mget<(string | null)[]>(...keys)
    return v.map((x) => (x == null ? null : String(x)))
  }
  async set(key: string, value: string, opts?: { ex?: number; nx?: boolean }) {
    const res =
      opts?.nx && opts.ex ? await this.r.set(key, value, { nx: true, ex: opts.ex })
      : opts?.nx ? await this.r.set(key, value, { nx: true })
      : opts?.ex ? await this.r.set(key, value, { ex: opts.ex })
      : await this.r.set(key, value)
    return res === 'OK'
  }
  async del(key: string) {
    await this.r.del(key)
  }
  async incr(key: string, ex?: number) {
    const n = await this.r.incr(key)
    if (ex && n === 1) await this.r.expire(key, ex)
    return n
  }
  async expire(key: string, seconds: number) {
    await this.r.expire(key, seconds)
  }
  async ttl(key: string) {
    return this.r.ttl(key)
  }
  async zadd(key: string, score: number, member: string) {
    await this.r.zadd(key, { score, member })
  }
  async zrem(key: string, member: string) {
    await this.r.zrem(key, member)
  }
  async zrevrange(key: string, start: number, stop: number) {
    const flat = await this.r.zrange<(string | number)[]>(key, start, stop, { rev: true, withScores: true })
    const out: ZMember[] = []
    for (let i = 0; i + 1 < flat.length; i += 2) out.push({ member: String(flat[i]), score: Number(flat[i + 1]) })
    return out
  }
  async zrevrank(key: string, member: string) {
    const r = await this.r.zrevrank(key, member)
    return r == null ? null : Number(r)
  }
  async zcard(key: string) {
    return this.r.zcard(key)
  }
}

let override: Kv | null | undefined
let cached: Kv | null | undefined

/** The configured store, or null when no Redis env is set (the API then answers 503 `notConfigured`). */
export function getKv(): Kv | null {
  if (override !== undefined) return override
  if (cached !== undefined) return cached
  const env = redisEnv()
  cached = env ? new UpstashKv(env) : null
  return cached
}

/** Tests: inject a store (null = "not configured"); undefined restores the env-based one. */
export function setKvForTests(kv: Kv | null | undefined): void {
  override = kv
}
