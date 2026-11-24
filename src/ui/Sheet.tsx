import { useEffect, useId, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import { canAnimate, done, play } from '../lib/motion'
import { useMedia } from '../lib/useMedia'

const PHONE = '(max-width: 39.99rem)'
const DRAWER = 'cubic-bezier(0.32, 0.72, 0, 1)'

/**
 * A bottom sheet on phone, a centred panel on wider screens.
 * One job each time it opens; "Done" closes it. Escape and the scrim close it too.
 * On phone the sheet is a drawer: it follows the finger when dragged by its top edge and
 * closes past a short distance or a quick flick; otherwise it springs back.
 */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const id = useId()
  const panel = useRef<HTMLDivElement>(null)
  const scrim = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose })
  const phone = useMedia(PHONE)
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(false)

  /** Animate out (faster than in), then unmount. Keyboard and reduced motion close at once. */
  const close = (fromY = 0) => {
    if (closingRef.current) return
    const el = panel.current
    if (!el || !canAnimate()) { closeRef.current(); return }
    closingRef.current = true
    setClosing(true)
    const out = window.matchMedia(PHONE).matches
      ? play(el, [{ transform: `translateY(${fromY}px)` }, { transform: 'translateY(100%)' }], { duration: 220, easing: 'cubic-bezier(0.4, 0, 1, 1)' })
      : play(el, [{ transform: 'none', opacity: 1 }, { transform: 'scale(0.97)', opacity: 0 }], { duration: 160, easing: 'ease-in' })
    play(scrim.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-in' })
    done(out).then(() => closeRef.current())
  }
  const closeFn = useRef(close)
  closeFn.current = close

  // Runs once per open: a re-render must never pull focus out of a field the student is typing in.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    if (!panel.current?.contains(document.activeElement)) panel.current?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeFn.current()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      prev?.focus()
    }
  }, [])

  // Drag to dismiss (phone). The panel is locked to the finger while dragging; easing only after release.
  const drag = useRef<{ id: number; y0: number; y: number; t: number; v: number } | null>(null)
  const onDown = (e: RPointerEvent) => {
    if (!phone || closingRef.current || (e.target as HTMLElement).closest('button')) return
    drag.current = { id: e.pointerId, y0: e.clientY, y: 0, t: e.timeStamp, v: 0 }
    e.currentTarget.setPointerCapture(e.pointerId)
    // The entrance runs with fill: both, which would override the inline transform below.
    panel.current?.getAnimations().forEach((a) => a.cancel())
    scrim.current?.getAnimations().forEach((a) => a.cancel())
  }
  const onMove = (e: RPointerEvent) => {
    const d = drag.current
    const el = panel.current
    if (!d || d.id !== e.pointerId || !el) return
    const raw = e.clientY - d.y0
    // Downward follows the finger; upward meets friction instead of a hard stop.
    const y = raw > 0 ? raw : -Math.sqrt(-raw) * 2
    const dt = Math.max(1, e.timeStamp - d.t)
    d.v = (y - d.y) / dt
    d.y = y
    d.t = e.timeStamp
    el.style.transform = `translateY(${y}px)`
    if (scrim.current) scrim.current.style.opacity = String(Math.max(0, 1 - Math.max(0, y) / el.offsetHeight))
  }
  const onUp = (e: RPointerEvent) => {
    const d = drag.current
    const el = panel.current
    if (!d || d.id !== e.pointerId || !el) return
    drag.current = null
    el.style.transform = ''
    if (scrim.current) scrim.current.style.opacity = ''
    if (d.y > 80 || d.v > 0.5) {
      close(d.y)
      return
    }
    if (Math.abs(d.y) > 1) play(el, [{ transform: `translateY(${d.y}px)` }, { transform: 'none' }], { duration: 300, easing: DRAWER })
    if (scrim.current && d.y > 1) play(scrim.current, [{ opacity: Math.max(0, 1 - d.y / el.offsetHeight) }, { opacity: 1 }], { duration: 300, easing: DRAWER })
  }

  return (
    <div className={`fixed inset-0 z-40 flex items-end justify-center tablet:items-center tablet:p-8 ${closing ? 'pointer-events-none' : ''}`}>
      <div ref={scrim} className="anim-fade absolute inset-0 bg-scrim" onClick={() => close()} aria-hidden />
      <div
        ref={panel}
        // While closing it is no longer a dialog, so shortcuts and focus behave as if it were gone.
        role={closing ? undefined : 'dialog'}
        aria-modal={closing ? undefined : 'true'}
        aria-labelledby={id}
        tabIndex={-1}
        className="anim-sheet relative flex max-h-[88dvh] w-full max-w-phone flex-col rounded-t-lg bg-bg shadow-lifted outline-none tablet:max-w-tablet tablet:rounded-lg"
      >
        <div
          className="relative flex touch-none items-center gap-3 border-b border-line ps-5 pe-2 pt-3 pb-2 tablet:ps-8 tablet:pe-4 tablet:pt-2"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {/* Grabber: shows the sheet can be pulled down (phone only). */}
          <span className="absolute top-1.5 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-line tablet:hidden" aria-hidden />
          <h2 id={id} className="flex-1 truncate text-body font-semibold">{title}</h2>
          <button type="button" onClick={() => close()} className="min-h-11 px-3 rounded-md text-body font-semibold text-accent hover:bg-accent-soft active:opacity-60">
            Done
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pb-safe-4 tablet:px-8">{children}</div>
      </div>
    </div>
  )
}
