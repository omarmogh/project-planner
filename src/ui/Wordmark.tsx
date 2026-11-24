import type { HTMLAttributes } from 'react'

/** The product mark: a point inside a ring (a locus), then the name. */
export function Wordmark({ className = '', ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`inline-flex select-none items-center gap-2 text-callout font-semibold tracking-tight text-fg ${className}`} title="Locus" {...rest}>
      <svg viewBox="0 0 16 16" className="size-4 text-accent" aria-hidden>
        <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.75" />
        <circle cx="8" cy="8" r="2.5" fill="currentColor" />
      </svg>
      Locus
    </span>
  )
}
