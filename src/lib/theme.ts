// Light / Dark / System. System (no data-theme attribute) follows the OS.
// The choice is remembered per browser; index.html applies it before first paint.

import { useSyncExternalStore } from 'react'
import { canAnimate } from './motion'

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
  // Per-element colour transitions are suppressed while the theme changes, so the
  // whole screen changes as one: a single cross-fade where View Transitions run.
  const html = document.documentElement
  html.setAttribute('data-theme-switching', '')
  const apply = () => { current = t; applyTheme(t); listeners.forEach((l) => l()) }
  const d = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } }
  const end = () => requestAnimationFrame(() => requestAnimationFrame(() => html.removeAttribute('data-theme-switching')))
  if (d.startViewTransition && canAnimate()) {
    html.dataset.vt = 'theme'
    d.startViewTransition(apply).finished.finally(() => { if (html.dataset.vt === 'theme') delete html.dataset.vt; end() })
  } else {
    apply()
    end()
  }
  try {
    if (t === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, t)
  } catch {
    // Private mode etc.: the choice just isn't remembered.
  }
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
