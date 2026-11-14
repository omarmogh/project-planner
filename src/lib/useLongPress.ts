import { useRef } from 'react'

/** Long-press handler props (pointer events; works with touch and mouse). */
export function useLongPress(onLongPress: () => void, ms = 800) {
  const timer = useRef<number | null>(null)
  const clear = () => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
  }
  return {
    onPointerDown: () => {
      clear()
      timer.current = window.setTimeout(() => {
        timer.current = null
        onLongPress()
      }, ms)
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  }
}
