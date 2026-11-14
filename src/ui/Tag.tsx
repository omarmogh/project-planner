import type { ReactNode } from 'react'

/** Small label: goal ("IM exam" / "Step 1"), "Fix", "New". */
export function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' }) {
  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-[12px] font-medium leading-none ${
        tone === 'accent' ? 'bg-accent-soft text-accent' : 'bg-surface text-muted'
      }`}
    >
      {children}
    </span>
  )
}
