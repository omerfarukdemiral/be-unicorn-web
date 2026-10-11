// Center boards and event cards sit in the scene area (sceneInset). On desktop the money island (bottom-left, taller
// than the founder / tab islands) is outside [data-scene-bottom], so the inset's bottom does not clear it.
import { useEffect, useState } from 'react'
import { GAP } from './tokens'

/**
 * Desktop: the money island (bottom-left, taller than the founder / tab islands) is outside [data-scene-bottom], so
 * the scene inset's bottom does not clear it; the board keeps above its top edge too. 0 when there is no island.
 */
export function useMoneyIslandClearance(): number {
  const [h, setH] = useState(0)
  useEffect(() => {
    const el = document.querySelector<HTMLElement>('[data-money-island]')
    if (!el) return
    const read = () => setH(Math.max(0, Math.round(window.innerHeight - el.getBoundingClientRect().top + GAP)))
    const ro = new ResizeObserver(read)
    ro.observe(el)
    window.addEventListener('resize', read)
    read()
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', read)
    }
  }, [])
  return h
}

