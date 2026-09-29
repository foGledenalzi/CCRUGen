// prefers-reduced-motion for JS animations (UI-07; the CSS block in globals.css cannot reach requestAnimationFrame).
import { useEffect, useState } from 'react'

/** Whether the user's OS/browser prefers reduced motion, live-updated if the preference changes. SSR-safe: nothing
 * touches `window` at render time, only inside the effect. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mql.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return reduced
}
