import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

/** Big tappable choice. `block` = full-width row (single choice lists). */
export function Chip({
  selected, onClick, children, hint, block = false, check = true,
}: { selected: boolean; onClick: () => void; children: ReactNode; hint?: string; block?: boolean; check?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex min-h-12 items-center gap-3 rounded-2xl border px-4 text-start text-[16px] transition-colors duration-150 ${
        block ? 'w-full py-3.5' : 'py-2.5'
      } ${selected ? 'border-accent bg-accent-soft text-fg' : 'border-line bg-bg text-fg active:bg-surface'}`}
    >
      <span className="flex-1">
        <span className="block font-medium">{children}</span>
        {hint && <span className="block text-[14px] text-muted">{hint}</span>}
      </span>
      {check && selected && <Check size={18} strokeWidth={2.5} className="shrink-0 text-accent" aria-hidden />}
    </button>
  )
}
