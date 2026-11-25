// "Do more" with a choice: the plan's suggestion, anything the student picks themselves (any lecture left, any
// topic not yet covered), or a Board checklist item. One job: choose one thing and add it. The suggestion is
// chosen already, so one tap on Add is enough.

import { Check, ChevronDown } from 'lucide-react'
import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { moreChoices, pickChoices, type ISODate, type Task } from '../engine'
import { duration } from '../lib/format'
import { useDemo, type Board } from '../store/demoStore'
import { Button } from '../ui/Button'
import { Sheet } from '../ui/Sheet'

/** Lengths offered for a Board item; the middle one is the default. */
const BOARD_LENGTHS = [15, 25, 45]

interface Choice { key: string; title: string; sub: string; task: Task | null; tick?: string; list?: string }

/** Open items on the student's own Board checklists, not yet ticked or on today's list. */
export function boardChoices(board: Board | undefined, today: Task[]): { tick: string; title: string; list: string }[] {
  const ticks = new Set(board?.ticks ?? [])
  const taken = new Set(today.map((t) => t.boardTick).filter(Boolean))
  return (board?.lists ?? []).flatMap((l) =>
    l.items
      .filter((i) => i.text.trim() && !ticks.has(`${l.id}:${i.id}`) && !taken.has(`${l.id}:${i.id}`))
      .map((i) => ({ tick: `${l.id}:${i.id}`, title: i.text.trim(), list: l.title.trim() || 'Checklist' })),
  )
}

/** Stagger the rows in, briefly: the whole list is in place within ~200 ms. */
const stagger = (i: number): CSSProperties => ({ animationDelay: `${Math.min(i, 6) * 30}ms` })

export function MorePicker({ onClose }: { onClose: () => void }) {
  const s = useDemo()
  const plan = s.plan!
  const planned = useMemo(() => moreChoices(plan, s.todayTasks, s.today as ISODate), [plan, s.todayTasks, s.today])
  const groups = useMemo(() => pickChoices(plan, s.todayTasks, s.today as ISODate), [plan, s.todayTasks, s.today])
  const fromBoard = useMemo(() => boardChoices(s.board, s.todayTasks), [s.board, s.todayTasks])
  const fromPlan: Choice[] = planned.map((t) => ({ key: t.id, title: t.title, sub: [t.detail, t.reason.replace(/^Extra, your choice · /, '')].filter(Boolean).join(' · '), task: t }))
  const own: { key: string; label: string; choices: Choice[] }[] = groups.map((g) => ({
    key: g.key,
    label: g.label,
    choices: g.tasks.map((t) => ({ key: `pick-${t.id}`, title: t.title, sub: t.detail ?? '', task: t })),
  }))
  const boardList: Choice[] = fromBoard.map((b) => ({ key: `board-${b.tick}`, title: b.title, sub: b.list, task: null, tick: b.tick, list: b.list }))
  const all = [...fromPlan, ...own.flatMap((g) => g.choices), ...boardList]
  const [picked, setPicked] = useState(fromPlan[0]?.key ?? boardList[0]?.key ?? '')
  // Groups start closed (a list of every lecture and topic is long); only one opens at a time.
  const [open, setOpen] = useState<string | null>(() => (fromPlan.length === 0 && boardList.length === 0 && own.length === 1 ? own[0].key : null))
  const [length, setLength] = useState(BOARD_LENGTHS[1])
  const api = useRef<{ close: () => void } | null>(null)
  const current = all.find((c) => c.key === picked)
  const minutes = current?.task ? current.task.minutes : length

  const add = () => {
    if (!current) return
    const goal = [...plan.goals].filter((g) => g.examDate >= s.today).sort((a, b) => a.examDate.localeCompare(b.examDate))[0] ?? plan.goals[0]
    const task: Task = current.task ?? {
      id: `board-${current.tick}-${s.today}`,
      date: s.today,
      kind: 'study',
      goalId: goal?.id ?? '',
      title: current.title,
      detail: current.list,
      reason: 'Extra, your choice · From your Board',
      minutes: length,
      status: 'pending',
      extra: true,
      boardTick: current.tick,
    }
    s.addMore(task)
    api.current?.close()
  }

  const heading = 'mt-5 mb-1 text-footnote font-semibold tracking-wide text-muted uppercase'
  const row = (c: Choice, i: number, suggested = false) => {
    const on = picked === c.key
    return (
      <div key={c.key} className="anim-rise" style={stagger(i)}>
        <button
          type="button"
          role="radio"
          aria-checked={on}
          onClick={() => setPicked(c.key)}
          className={`-mx-3 flex w-[calc(100%+1.5rem)] items-center gap-3 rounded-lg px-3 py-3 text-start transition-colors duration-200 ${on ? 'bg-accent-soft' : 'hover:bg-surface active:bg-surface'}`}
        >
          <span className={`grid size-5 shrink-0 place-items-center rounded-full border transition-[background-color,border-color] duration-200 ${on ? 'border-accent bg-accent' : 'border-line'}`} aria-hidden>
            <Check strokeWidth={3} className={`size-3 text-on-accent transition-[transform,opacity] duration-200 ease-[var(--ease-enter)] ${on ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body-sm font-medium">
              {c.title}
              {suggested && <span className="ms-2 text-footnote font-medium text-accent">Suggested</span>}
            </span>
            {c.sub && !c.list && <span className="block truncate text-subhead text-muted">{c.sub}</span>}
          </span>
          {c.task && <span className="tnum shrink-0 text-subhead text-muted">{duration(c.task.minutes)}</span>}
        </button>
        {/* A Board item has no length yet: the choice opens under it (height eases open, grid-rows). */}
        {!c.task && (
          <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[var(--ease-calm)] ${on ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`} aria-hidden={!on}>
            <div className="overflow-hidden">
              <div className="flex gap-2 ps-8 pt-1 pb-2">
                {BOARD_LENGTHS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    tabIndex={on ? 0 : -1}
                    aria-pressed={length === m}
                    onClick={() => setLength(m)}
                    className={`press min-h-9 rounded-full border px-3 text-subhead transition-colors duration-150 ${length === m ? 'border-accent bg-accent text-on-accent' : 'border-line hover:bg-surface'}`}
                  >
                    {m} min
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Board items group under their checklist's name, in Board order.
  let lastList = ''
  return (
    <Sheet title="Add to today" onClose={onClose} api={api}>
      <p className="pt-4 text-subhead text-muted">Extra, by your choice. It never counts against you.</p>
      {all.length === 0 && <p className="py-6 text-body-sm text-muted">Nothing else is worth adding today. Checklists you make on the Board show up here too.</p>}
      <div role="radiogroup" aria-label="What to add" className="pb-4">
        {fromPlan.length > 0 && <h3 className={heading}>From your plan</h3>}
        {fromPlan.map((c, i) => row(c, i, i === 0))}

        {own.length > 0 && <h3 className={heading}>Choose yourself</h3>}
        {own.map((g, gi) => {
          const expanded = open === g.key
          const chosen = g.choices.find((c) => c.key === picked)
          return (
            <div key={g.key} className="anim-rise" style={stagger(fromPlan.length + gi)}>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : g.key)}
                className="-mx-3 flex min-h-11 w-[calc(100%+1.5rem)] items-center gap-3 rounded-lg px-3 py-2 text-start hover:bg-surface active:bg-surface"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-sm font-medium">{g.label}</span>
                  <span className="block truncate text-subhead text-muted">{chosen && !expanded ? chosen.title : `${g.choices.length} left`}</span>
                </span>
                <ChevronDown className={`size-icon-sm shrink-0 text-muted transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} aria-hidden />
              </button>
              {expanded && <div className="ps-3">{g.choices.map((c, i) => row(c, i))}</div>}
            </div>
          )
        })}

        {boardList.map((c, i) => {
          const head = c.list && c.list !== lastList ? c.list : null
          if (c.list) lastList = c.list
          return (
            <div key={c.key}>
              {head && (
                <h3 className={heading}>
                  {i === 0 ? <>From your Board · <span className="normal-case">{head}</span></> : <span className="normal-case">{head}</span>}
                </h3>
              )}
              {row(c, fromPlan.length + own.length + i)}
            </div>
          )
        })}
      </div>
      {all.length > 0 && (
        <div className="sticky bottom-0 -mx-5 border-t border-line bg-bg px-5 pt-3 pb-4 tablet:-mx-8 tablet:px-8">
          <Button onClick={add} disabled={!current}>
            {current ? `Add · ${duration(minutes)}` : 'Pick something to add'}
          </Button>
        </div>
      )}
    </Sheet>
  )
}
