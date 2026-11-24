import { setTheme, useTheme, type Theme } from '../lib/theme'

const OPTIONS: { id: Theme; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
]

/** Small, quiet appearance control. Lives at the bottom of the Week tab. */
export function ThemeSwitch() {
  const theme = useTheme()
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
      <span id="theme-label" className="text-callout text-muted">Appearance</span>
      <div role="radiogroup" aria-labelledby="theme-label" className="flex rounded-md bg-surface p-0.5">
        {OPTIONS.map(({ id, label }) => {
          const on = theme === id
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setTheme(id)}
              className={`min-h-11 rounded-md px-3 text-subhead font-medium ${on ? 'bg-bg text-fg' : 'text-muted hover:text-fg'}`}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
