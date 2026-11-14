import { Minus, Plus } from 'lucide-react'

export function Stepper({
  value, onChange, min = 0, max = 9999, step = 1, format = String, label,
}: { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; format?: (n: number) => string; label: string }) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n * 100) / 100))
  const btn = 'flex size-11 items-center justify-center rounded-full bg-surface text-fg active:opacity-60 disabled:opacity-30'
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button type="button" className={btn} onClick={() => onChange(clamp(value - step))} disabled={value <= min} aria-label={`Less ${label}`}>
        <Minus className="size-icon-sm" />
      </button>
      <span className="tnum min-w-12 text-center text-title-3 font-semibold" aria-live="polite">{format(value)}</span>
      <button type="button" className={btn} onClick={() => onChange(clamp(value + step))} disabled={value >= max} aria-label={`More ${label}`}>
        <Plus className="size-icon-sm" />
      </button>
    </div>
  )
}
