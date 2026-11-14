// Light / Dark / System. System (no data-theme attribute) follows the OS.
// The choice is remembered per browser; index.html applies it before first paint.

import { useSyncExternalStore } from 'react'

export type Theme = 'system' | 'light' | 'dark'
const KEY = 'locus-theme'
const listeners = new Set<() => void>()

function read(): Theme {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

let current: Theme = typeof window === 'undefined' ? 'system' : read()

export function applyTheme(t: Theme) {
  const html = document.documentElement
  if (t === 'system') html.removeAttribute('data-theme')
  else html.setAttribute('data-theme', t)
}

export function setTheme(t: Theme) {
  current = t
  applyTheme(t)
  try {
    if (t === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, t)
  } catch {
    // Private mode etc.: the choice just isn't remembered.
  }
  listeners.forEach((l) => l())
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
}
