import { Check } from 'lucide-react'
import { useState } from 'react'
import { lectureQueue, type Task } from '../engine'
import { useDemo } from '../store/demoStore'
import { Sheet } from '../ui/Sheet'

/**
 * "Switch lecture" on a lectures task: pick which of the lectures left to do today.
 * Up to as many as the task holds (the time stays the same); fewer = the rest come from the list in order.
 */
export function LectureSwitch({ task, onClose }: { task: Task; onClose: () => void }) {
  const r = useDemo((s) => s.plan?.resources.find((x) => x.id === task.resourceId))
  const switchLectures = useDemo((s) => s.switchLectures)
  const setTab = useDemo((s) => s.setTab)
  const most = Math.max(1, task.amount ?? 1)
  // Tasks saved before lectures were tracked one by one carry no items: they cover the next ones in the list.
  const [picked, setPicked] = useState<number[]>(() => task.items ?? (r ? lectureQueue(r).slice(0, most) : []))
  if (!r) return null
  const queue = lectureQueue(r)
  const word = most === 1 ? (r.unit?.[0] ?? 'lecture') : (r.unit?.[1] ?? 'lectures')

  const toggle = (i: number) =>
    setPicked((p) => {
      if (p.includes(i)) return p.filter((x) => x !== i)
      // One lecture today: tapping another one swaps it. More: the oldest pick makes room.
      return [...p, i].slice(-most)
    })
  const close = () => {
    const before = task.items ?? queue.slice(0, most)
    const same = picked.length === before.length && picked.every((x, k) => x === before[k])
    if (!same) switchLectures(r.id, picked)
    onClose()
  }

  return (
    <Sheet title={most === 1 ? `Which ${word} today?` : `Which ${most} ${word} today?`} onClose={close}>
      <p className="pt-4 text-subhead text-muted">
        Same time as planned. The others stay in your list.
      </p>
      <ul className="py-2">
        {queue.map((i) => {
          const on = picked.includes(i)
          const name = r.itemNames?.[i]
          return (
            <li key={i}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(i)}
                className="flex min-h-11 w-full items-center gap-3 py-1 text-start text-body-sm active:opacity-60"
              >
                <span
                  className={`flex size-icon-md shrink-0 items-center justify-center rounded-full border transition-colors duration-150 ${on ? 'border-accent bg-accent text-on-accent' : 'border-faint'}`}
                  aria-hidden
                >
                  {on && <Check className="size-icon-xs" strokeWidth={3} />}
                </span>
                <span className="tnum w-7 shrink-0 text-muted">{i + 1}</span>
                <span className="min-w-0 flex-1">{name ?? `${(r.unit?.[0] ?? 'lecture').replace(/^./, (c) => c.toUpperCase())} ${i + 1}`}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        onClick={() => { close(); setTab('board') }}
        className="mb-2 inline-flex min-h-11 items-center text-callout font-medium text-accent active:opacity-60"
      >
        See everything on the Board
      </button>
    </Sheet>
  )
}

/** A lectures task worth switching: more lectures left than today's task covers (named or just numbered). */
export function canSwitch(task: Task, left: number): boolean {
  return task.status === 'pending' && task.kind === 'study' && left > (task.amount ?? 1)
}
