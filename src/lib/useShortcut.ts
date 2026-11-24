import { useEffect, useRef } from 'react'

/**
 * A single-key shortcut for keyboard users (desktop). It stays out of the way: ignored while typing
 * in a field, while a button or link has focus (Space and Enter belong to it), while a sheet or dialog
 * is open, and when a modifier key is held, so browser and system shortcuts keep working.
 */
export function useShortcut(key: string, run: () => void, enabled = true) {
  const runRef = useRef(run)
  useEffect(() => { runRef.current = run })
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return
      if (e.key.toLowerCase() !== key.toLowerCase()) return
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, select, button, a, [contenteditable="true"], [role="textbox"]')) return
      if (document.querySelector('[role="dialog"]')) return
      e.preventDefault()
      runRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [key, enabled])
}
