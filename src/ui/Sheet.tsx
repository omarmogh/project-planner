import { useEffect, useId, useRef, type ReactNode } from 'react'

/**
 * A bottom sheet on phone, a centred panel on wider screens.
 * One job each time it opens; "Done" closes it. Escape and the scrim close it too.
 */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const id = useId()
  const panel = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose })

  // Runs once per open: a re-render must never pull focus out of a field the student is typing in.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    if (!panel.current?.contains(document.activeElement)) panel.current?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      prev?.focus()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center tablet:items-center tablet:p-8">
      <div className="anim-fade absolute inset-0 bg-scrim" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        className="anim-sheet relative flex max-h-[88dvh] w-full max-w-phone flex-col rounded-t-lg bg-bg outline-none tablet:max-w-tablet tablet:rounded-lg"
      >
        <div className="flex items-center gap-3 border-b border-line ps-5 pe-2 pt-2 pb-2 tablet:ps-8 tablet:pe-4">
          <h2 id={id} className="flex-1 truncate text-body font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="min-h-11 px-3 text-body font-semibold text-accent active:opacity-60">
            Done
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pb-safe-4 tablet:px-8">{children}</div>
      </div>
    </div>
  )
}
