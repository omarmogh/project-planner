import { Check, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { watchChecklist } from '../data/setup'

/** Show a search field only when the list is long. */
const SEARCH_FROM = 20

/**
 * "Already watched" for one system: its B&B videos under their topics.
 * A tick means watched, not mastered: the video leaves the plan; the topic still
 * needs its questions. Used in onboarding and in the sheet from Today.
 */
export function WatchedChecklist({
  system, watched, onChange,
}: { system: string; watched: string[]; onChange: (ids: string[], on: boolean) => void }) {
  const groups = useMemo(() => watchChecklist(system), [system])
  const [query, setQuery] = useState('')
  const ticked = new Set(watched)
  const total = new Set(groups.flatMap((g) => g.videos.map((v) => v.id))).size
  const q = query.trim().toLowerCase()
  const shown = q
    ? groups.flatMap((g) => {
      if (g.topic.toLowerCase().includes(q)) return [g]
      const videos = g.videos.filter((v) => v.title.toLowerCase().includes(q))
      return videos.length ? [{ ...g, videos }] : []
    })
    : groups

  if (groups.length === 0) return <p className="py-4 text-subhead text-muted">No B&amp;B videos listed for {system} yet.</p>

  return (
    <div>
      {total > SEARCH_FROM && (
        <label className="mt-3 flex min-h-11 items-center gap-2 rounded-md bg-surface px-3 focus-within:outline-(length:--focus-ring) focus-within:outline-offset-(length:--focus-offset) focus-within:outline-accent focus-within:outline-solid">
          <Search className="size-icon-sm shrink-0 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${system} videos`}
            aria-label={`Search ${system} videos`}
            className="min-h-11 min-w-0 flex-1 bg-transparent text-body-sm text-fg outline-none placeholder:text-faint"
          />
        </label>
      )}
      {shown.length === 0 && <p className="py-4 text-subhead text-muted">No videos match “{query.trim()}”.</p>}
      <ul>
        {shown.map((g) => {
          const ids = g.videos.map((v) => v.id)
          const all = ids.every((id) => ticked.has(id))
          return (
            <li key={g.topicId} className="border-b border-line py-2 last:border-b-0">
              <div className="flex items-center gap-3">
                <h3 className="flex-1 text-callout font-semibold">{g.topic}</h3>
                <button
                  type="button"
                  onClick={() => onChange(ids, !all)}
                  className="min-h-11 shrink-0 px-1 text-subhead font-medium text-accent hover:opacity-70 active:opacity-60"
                  aria-label={`${all ? 'Untick' : 'Tick'} all ${g.topic} videos`}
                >
                  {all ? 'Untick all' : 'Tick all'}
                </button>
              </div>
              <ul>
                {g.videos.map((v) => {
                  const on = ticked.has(v.id)
                  return (
                    <li key={v.id}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        onClick={() => onChange([v.id], !on)}
                        className="flex min-h-11 w-full items-center gap-3 text-start text-body-sm hover:opacity-70 active:opacity-60"
                      >
                        <span
                          className={`flex size-icon-md shrink-0 items-center justify-center rounded-sm border transition-colors duration-150 ${
                            on ? 'border-accent bg-accent text-on-accent' : 'border-faint'
                          }`}
                          aria-hidden
                        >
                          {on && <Check strokeWidth={3} className="size-icon-xs" />}
                        </span>
                        <span className={on ? 'text-muted' : ''}>{v.title}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
