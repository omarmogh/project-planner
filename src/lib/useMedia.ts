import { useSyncExternalStore } from 'react'

/** Live media query, e.g. useMedia('(prefers-reduced-motion: reduce)'). */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
  )
}

export const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'
