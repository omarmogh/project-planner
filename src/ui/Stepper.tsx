import { Minus, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/**
 * A number with − and +. With `typeable`, tapping the number opens the number keypad: for counts like
 * 80 lectures or 1,200 questions, typing is faster than any amount of tapping.
 * Without an explicit `step`, a count of 10 or more moves in 5s (`adaptive`), so 80 lectures is 16 taps, not 70.
 */
export function Stepper({
  value, onChange, min = 0, max = 9999, step, format = String, label, typeable = false, adaptive = false,
}: {
  value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number
  format?: (n: number) => string; label: string; typeable?: boolean; adaptive?: boolean
}) {
  const unit = step ?? (adaptive && value >= 10 ? 5 : 1)
  // Going down, 10 steps to 9 (not 5), so every small count stays reachable.
  const down = step ?? (adaptive && value > 10 ? Math.min(5, value - 10) : 1)
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n * 100) / 100))
  const btn = 'flex size-11 items-center justify-center rounded-full bg-surface text-fg active:opacity-60 disabled:opacity-30'
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { if (typing) input.current?.select() }, [typing])

  /** Digits only ("1,200" works); empty or nonsense keeps the old value. */
  const commit = () => {
    const n = Number.parseInt(draft.replace(/\D/g, ''), 10)
    if (Number.isFinite(n)) onChange(clamp(n))
    setTyping(false)
  }
  const shown = 'tnum min-w-12 text-center text-title-3 font-semibold'

  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button type="button" className={btn} onClick={() => onChange(clamp(value - down))} disabled={value <= min} aria-label={`Less ${label}`}>
        <Minus className="size-icon-sm" />
      </button>
      {typing ? (
        <input
          ref={input}
          value={draft}
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label={`Type ${label}`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit() }
            if (e.key === 'Escape') setTyping(false)
          }}
          className={`${shown} h-11 w-20 rounded-md border border-line bg-surface text-fg`}
        />
      ) : typeable ? (
        <button
          type="button"
          onClick={() => { setDraft(String(value)); setTyping(true) }}
          aria-label={`${label}: ${format(value)}. Tap to type a number`}
          className={`${shown} h-11 rounded-md px-2 active:opacity-60`}
        >
          {format(value)}
        </button>
      ) : (
        <span className={shown} aria-live="polite">{format(value)}</span>
      )}
      <button type="button" className={btn} onClick={() => onChange(clamp(value + unit))} disabled={value >= max} aria-label={`More ${label}`}>
        <Plus className="size-icon-sm" />
      </button>
    </div>
  )
}
