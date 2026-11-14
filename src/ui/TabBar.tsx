import { CalendarRange, Gauge, ListChecks } from 'lucide-react'
import type { Tab } from '../store/demoStore'

const TABS: { id: Tab; label: string; Icon: typeof Gauge }[] = [
  { id: 'today', label: 'Today', Icon: ListChecks },
  { id: 'pace', label: 'Pace', Icon: Gauge },
  { id: 'week', label: 'Week', Icon: CalendarRange },
]

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg" aria-label="Main">
      <div className="mx-auto flex max-w-[560px] pb-[env(safe-area-inset-bottom)]">
        {TABS.map(({ id, label, Icon }) => {
          const on = id === tab
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-current={on ? 'page' : undefined}
              className={`flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${on ? 'text-accent' : 'text-faint'}`}
            >
              <Icon size={22} strokeWidth={on ? 2.2 : 1.8} aria-hidden />
              {label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
