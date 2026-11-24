import type { ButtonHTMLAttributes } from 'react'

/**
 * A compact, rounded answer button for inline choices inside a card ("Light day", "Add date").
 * Accent = the suggested answer (a tint, so it never competes with the screen's one primary button).
 * Neutral = the other answers.
 */
export function Pill({ tone = 'neutral', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'accent' | 'neutral' }) {
  const look = tone === 'accent'
    ? 'bg-accent-soft text-accent hover:opacity-80'
    : 'bg-bg text-fg ring-1 ring-line ring-inset hover:bg-line'
  return (
    <button
      type="button"
      className={`press inline-flex min-h-11 items-center justify-center rounded-full px-4 text-callout font-semibold disabled:opacity-40 ${look} ${className}`}
      {...rest}
    />
  )
}
