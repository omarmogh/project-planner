import type { CSSProperties } from 'react'

export function ProgressBar({ value, tone = 'accent', label, thin = false }: { value: number; tone?: 'accent' | 'good' | 'warn' | 'weak'; label?: string; thin?: boolean }) {
  const color = { accent: 'bg-accent', good: 'bg-good', warn: 'bg-warn', weak: 'bg-weak' }[tone]
  const p = Math.max(0, Math.min(1, value))
  return (
    <div className={`${thin ? 'h-1' : 'h-1.5'} w-full overflow-hidden rounded-full bg-line`} role="progressbar" aria-label={label} aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      {/* A full-width fill slid into place (index.css .bar-fill): transform only, fills from empty on open. */}
      <div className={`bar-fill h-full w-full rounded-full ${color}`} style={{ '--p': p } as CSSProperties} />
    </div>
  )
}
