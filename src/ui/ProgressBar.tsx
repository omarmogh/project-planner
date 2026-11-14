export function ProgressBar({ value, tone = 'accent', label }: { value: number; tone?: 'accent' | 'good' | 'warn' | 'weak'; label?: string }) {
  const color = { accent: 'bg-accent', good: 'bg-good', warn: 'bg-warn', weak: 'bg-weak' }[tone]
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-label={label} aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${color} transition-[width] duration-500 ease-out`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  )
}
