import { CalendarRange, Gauge, LayoutGrid, ListChecks } from 'lucide-react'
import { useLongPress } from '../lib/useLongPress'
import { useDemo, type Tab } from '../store/demoStore'
import { useShortcut } from '../lib/useShortcut'
import { Wordmark } from './Wordmark'

const TABS: { id: Tab; label: string; Icon: typeof Gauge }[] = [
  { id: 'today', label: 'Today', Icon: ListChecks },
  { id: 'pace', label: 'Pace', Icon: Gauge },
  { id: 'week', label: 'Week', Icon: CalendarRange },
  { id: 'board', label: 'Board', Icon: LayoutGrid },
]

/**
 * Bottom tabs on phone and tablet, a quiet sidebar on desktop. Rendered by Page only:
 * the sidebar before the content (first in Tab order), the bottom bar after it.
 */
export function Nav({ variant }: { variant: 'bottom' | 'side' }) {
  const tab = useDemo((s) => s.tab)
  const reset = useLongPress(useDemo.getState().reset)
  const go = (t: Tab) => {
    const s = useDemo.getState()
    s.endIntro()
    s.setTab(t)
  }
  // 1–4 switch tabs (registered once, by the sidebar, which is always mounted with the tabs).
  const keys = variant === 'side'
  useShortcut('1', () => go('today'), keys)
  useShortcut('2', () => go('pace'), keys)
  useShortcut('3', () => go('week'), keys)
  useShortcut('4', () => go('board'), keys)
  if (variant === 'bottom') {
    return (
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg desktop:hidden" aria-label="Main">
        <div className="mx-auto flex max-w-tablet pb-safe">
          {TABS.map(({ id, label, Icon }) => {
            const on = id === tab
            return (
              <button
                key={id}
                type="button"
                onClick={() => go(id)}
                aria-current={on ? 'page' : undefined}
                className={`flex min-h-tabbar flex-1 flex-col items-center justify-center gap-0.5 py-1 text-caption-2 font-medium transition-colors ${on ? 'text-accent' : 'text-muted active:text-fg'}`}
              >
                <Icon className="size-icon-lg" strokeWidth={on ? 2.2 : 1.8} aria-hidden />
                {label}
              </button>
            )
          })}
        </div>
      </nav>
    )
  }

  return (
    <nav className="fixed inset-y-0 start-0 z-20 hidden w-sidebar flex-col border-e border-line bg-bg px-4 py-8 desktop:flex" aria-label="Main">
      <p className="px-3 pb-6"><Wordmark {...reset} /></p>
      <ul className="flex flex-col gap-1">
        {TABS.map(({ id, label, Icon }, i) => {
          const on = id === tab
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => go(id)}
                aria-current={on ? 'page' : undefined}
                title={`${label} (${i + 1})`}
                className={`group flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-start text-body font-medium transition-colors ${
                  on ? 'bg-surface text-fg' : 'text-muted hover:bg-surface hover:text-fg'
                }`}
              >
                <Icon className={`size-icon-md ${on ? 'text-accent' : ''}`} strokeWidth={on ? 2.2 : 1.8} aria-hidden />
                <span className="flex-1">{label}</span>
                <kbd className={`tnum font-sans text-caption-1 text-faint ${on ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity`} aria-hidden>{i + 1}</kbd>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
