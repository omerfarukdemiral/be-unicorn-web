// One live note at a time (fix round 5): while the payday card pops out of the money island, the message pill and the
// release toast keep quiet instead of talking over it. A tiny external store, so render/ (the scene) can read it too.
import { useSyncExternalStore } from 'react'

let paydayOn = false
const subs = new Set<() => void>()

export function setPaydayCardOn(on: boolean): void {
  if (paydayOn === on) return
  paydayOn = on
  for (const f of subs) f()
}

export const paydayCardOn = (): boolean => paydayOn

function subscribe(f: () => void): () => void {
  subs.add(f)
  return () => subs.delete(f)
}

export function usePaydayCardOn(): boolean {
  return useSyncExternalStore(subscribe, paydayCardOn, paydayCardOn)
}
