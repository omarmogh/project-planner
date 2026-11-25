import { CalendarRange, Gauge, LayoutGrid, ListChecks } from 'lucide-react'
import { useLongPress } from '../lib/useLongPress'
import { useDemo, type Tab } from '../store/demoStore'
import { useShortcut } from '../lib/useShortcut'
import { Wordmark } from './Wordmark'
import { useLayoutEffect, useRef } from 'react'
import { canAnimate, play, transition } from '../lib/motion'

// Where the sidebar's active background was last drawn: each screen mounts its own Nav, so it lives here.
let lastInd: number | null = null

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
    if (t === s.tab) return
    const order = TABS.map((x) => x.id)
    // Content slides in the direction of the tab (mirrored in RTL by the CSS); the nav itself stays put.
    transition(() => { s.endIntro(); s.setTab(t) }, order.indexOf(t) > order.indexOf(s.tab) ? 'forward' : 'back')
  }
  // 1–4 switch tabs (registered once, by the sidebar, which is always mounted with the tabs).
  const keys = variant === 'side'
  useShortcut('1', () => go('today'), keys)
  useShortcut('2', () => go('pace'), keys)
  useShortcut('3', () => go('week'), keys)
  useShortcut('4', () => go('board'), keys)
  // The sidebar's active background glides from the previous tab (FLIP, transform only).
  useLayoutEffect(() => {
    if (variant !== 'side') return
    const el = document.querySelector<HTMLElement>('[data-tab-ind]')
    if (!el || !el.offsetParent) return
    // Measured on the button (never transformed), not on the moving layer.
    const top = el.parentElement!.getBoundingClientRect().top
    if (lastInd !== null && lastInd !== top && canAnimate()) {
      play(el, [{ transform: `translateY(${lastInd - top}px)` }, { transform: 'none' }], { duration: 240, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' })
    }
    lastInd = top
  }, [tab, variant])
  // The bar grows with the phone's font size (Android "font size", iOS larger text). Its real height becomes
  // --tabbar-h, so the sticky Start button and the page's last lines always sit above it, never under it.
  const row = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = row.current?.firstElementChild as HTMLElement | null
    if (variant !== 'bottom' || !el || typeof ResizeObserver === 'undefined') return
    const root = document.documentElement
    const set = () => { if (el.offsetHeight) root.style.setProperty('--tabbar-h', `${el.offsetHeight + 1}px`) }
    set()
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => ro.disconnect()
  }, [variant])
  if (variant === 'bottom') {
    return (
      <nav className="vt-nav-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg desktop:hidden" aria-label="Main">
        <div ref={row} className="mx-auto flex max-w-tablet pb-safe">
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
    <nav className="vt-nav-side fixed inset-y-0 start-0 z-20 hidden w-sidebar flex-col border-e border-line bg-bg px-4 py-8 desktop:flex" aria-label="Main">
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
                className={`group relative isolate flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-start text-body font-medium transition-colors ${
                  on ? 'text-fg' : 'text-muted hover:bg-surface hover:text-fg'
                }`}
              >
                {/* The active background is its own layer so it can glide between tabs. */}
                {on && <span data-tab-ind className="absolute inset-0 -z-10 rounded-md bg-surface" aria-hidden />}
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
