// In-memory Kv for tests. TTLs follow an injectable clock so lockouts and expiry can be tested without waiting.
import type { Kv, ZMember } from './kv.js'

interface Entry {
  value: string
  expiresAt: number | null
}

export class MemoryKv implements Kv {
  private data = new Map<string, Entry>()
  private zsets = new Map<string, Map<string, number>>()
  now: () => number

  constructor(now: () => number = () => Date.now()) {
    this.now = now
  }

  private live(key: string): Entry | null {
    const e = this.data.get(key)
    if (!e) return null
    if (e.expiresAt !== null && e.expiresAt <= this.now()) {
      this.data.delete(key)
      return null
    }
    return e
  }

  keys(): string[] {
    return [...this.data.keys()].filter((k) => this.live(k)).concat([...this.zsets.keys()])
  }

  async get(key: string) {
    return this.live(key)?.value ?? null
  }
  async mget(keys: string[]) {
    return keys.map((k) => this.live(k)?.value ?? null)
  }
  async set(key: string, value: string, opts?: { ex?: number; nx?: boolean }) {
    if (opts?.nx && this.live(key)) return false
    this.data.set(key, { value, expiresAt: opts?.ex ? this.now() + opts.ex * 1000 : null })
    return true
  }
  async del(key: string) {
    this.data.delete(key)
    this.zsets.delete(key)
  }
  async incr(key: string, ex?: number) {
    const e = this.live(key)
    const n = (e ? Number(e.value) : 0) + 1
    this.data.set(key, { value: String(n), expiresAt: e ? e.expiresAt : ex ? this.now() + ex * 1000 : null })
    return n
  }
  async expire(key: string, seconds: number) {
    const e = this.live(key)
    if (e) e.expiresAt = this.now() + seconds * 1000
  }
  async ttl(key: string) {
    const e = this.live(key)
    if (!e) return -2
    if (e.expiresAt === null) return -1
    return Math.ceil((e.expiresAt - this.now()) / 1000)
  }
  private sorted(key: string): ZMember[] {
    const z = this.zsets.get(key)
    if (!z) return []
    // Redis ZREVRANGE: score desc, ties by member desc (lexicographic).
    return [...z.entries()]
      .map(([member, score]) => ({ member, score }))
      .sort((a, b) => b.score - a.score || (a.member < b.member ? 1 : a.member > b.member ? -1 : 0))
  }
  async zadd(key: string, score: number, member: string) {
    let z = this.zsets.get(key)
    if (!z) this.zsets.set(key, (z = new Map()))
    z.set(member, score)
  }
  async zrem(key: string, member: string) {
    this.zsets.get(key)?.delete(member)
  }
  async zrevrange(key: string, start: number, stop: number) {
    const all = this.sorted(key)
    const end = stop < 0 ? all.length + stop : stop
    return all.slice(start, end + 1)
  }
  async zrevrank(key: string, member: string) {
    const i = this.sorted(key).findIndex((m) => m.member === member)
    return i < 0 ? null : i
  }
  async zcard(key: string) {
    return this.zsets.get(key)?.size ?? 0
  }
}
