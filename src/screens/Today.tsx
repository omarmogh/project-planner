import { Check, ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { daysBetween, inDays, totalMinutes, type Task } from '../engine'
import { duration, longDate } from '../lib/format'
import { useLongPress } from '../lib/useLongPress'
import { tomorrowPlan, useDemo } from '../store/demoStore'
import { Button } from '../ui/Button'
import { Page } from '../ui/Page'
import { ProgressBar } from '../ui/ProgressBar'
import { Tag } from '../ui/Tag'

const DAY_LINE = {
  postCall: 'Post-call, so today is lighter.',
  call: 'On call today — just Anki.',
  weekend: 'Weekend: a longer day.',
  normal: '',
} as const

export function Today() {
  const s = useDemo()
  const plan = s.plan!
  const tasks = s.todayTasks
  const planned = totalMinutes(tasks)
  const doneMin = totalMinutes(tasks.filter((t) => t.status === 'done'))
  const pending = tasks.filter((t) => t.status === 'pending')
  const target = tasks.find((t) => t.id === s.selectedId && t.status === 'pending') ?? pending[0]
  const goalLabel = (id: string) => plan.goals.find((g) => g.id === id)?.label ?? ''
  const reset = useLongPress(s.reset)

  const tomorrow = useMemo(() => tomorrowPlan(plan, s.today), [plan, s.today])
  const goals = [...plan.goals].filter((g) => g.examDate > s.today).sort((a, b) => a.examDate.localeCompare(b.examDate))
  const context = [plan.rotation && plan.rotation.until >= s.today ? `${plan.rotation.short} rotation` : null, { postCall: 'Post-call', call: 'On call', weekend: 'Weekend', normal: null }[s.dayKind]]
    .filter(Boolean)
    .join(' · ')

  return (
    <Page
      withTabs
      top={
        <div className="flex h-12 items-end px-5 sm:px-8">
          <span {...reset} className="select-none text-[15px] font-semibold tracking-tight text-faint" title="Locus">Locus</span>
        </div>
      }
      footer={
        target ? (
          <Button onClick={() => s.start(target.id)}>
            <span className="truncate">Start · {shortTitle(target)}</span>
          </Button>
        ) : undefined
      }
    >
      <header className="pt-3">
        {s.intro && <p className="anim-fade mb-1 text-[15px] font-medium text-accent">Here's your first day</p>}
        {context && <p className="text-[15px] font-medium text-muted">{context}</p>}
        <h1 className="mt-0.5 text-[30px] leading-tight font-semibold tracking-tight">{longDate(s.today)}</h1>

        <div className="mt-5 flex items-baseline justify-between gap-4">
          <p className="text-[17px]">
            <span className="tnum font-semibold">{duration(planned)}</span> <span className="text-muted">planned</span>
          </p>
          <p className="tnum text-[15px] text-muted">{tasks.length - pending.length} of {tasks.length} done</p>
        </div>
        <div className="mt-3">
          <ProgressBar value={planned ? doneMin / planned : 0} label="Today's progress" />
        </div>
        <p className="mt-3 text-[15px] text-muted">
          {goals.map((g, i) => (
            <span key={g.id}>
              {i > 0 && ' · '}
              {g.label} <span className="tnum">{inDays(daysBetween(s.today, g.examDate))}</span>
            </span>
          ))}
        </p>
      </header>

      {DAY_LINE[s.dayKind] && pending.length > 0 && <p className="mt-8 text-[15px] text-muted">{DAY_LINE[s.dayKind]}</p>}

      {pending.length === 0 && (
        <div className="anim-rise mt-8">
          <p className="text-[22px] font-semibold tracking-tight">Done for today.</p>
          <p className="mt-1 text-[16px] text-muted">{duration(doneMin)} studied. Tomorrow's plan is ready below.</p>
        </div>
      )}

      <ul className={`${DAY_LINE[s.dayKind] && pending.length > 0 ? 'mt-3' : 'mt-6'} divide-y divide-line border-y border-line`}>
        {tasks.map((t, i) => (
          <TaskRow
            key={t.id}
            task={t}
            goal={goalLabel(t.goalId)}
            selected={t.id === target?.id}
            onSelect={() => s.select(t.id)}
            intro={s.intro ? i : undefined}
            ankiLink={t.kind === 'anki' && t.status === 'pending' && !s.ankiConnected ? () => s.openAnki() : undefined}
            ankiConnected={t.kind === 'anki' && s.ankiConnected}
          />
        ))}
      </ul>

      <Tomorrow tasks={tomorrow.tasks} newIds={s.newIds} goalLabel={goalLabel} open={pending.length === 0} />
    </Page>
  )
}

function shortTitle(t: Task) {
  return t.title.replace(/^Retest: /, 'Retest ')
}

function TaskRow({
  task, goal, selected, onSelect, intro, ankiLink, ankiConnected,
}: {
  task: Task; goal: string; selected: boolean; onSelect: () => void; intro?: number; ankiLink?: () => void; ankiConnected: boolean
}) {
  const done = task.status === 'done'
  return (
    <li className={intro !== undefined ? 'anim-rise' : ''} style={intro !== undefined ? { animationDelay: `${180 + intro * 110}ms` } : undefined}>
      <div className="flex gap-3.5 py-4">
        <button
          type="button"
          onClick={onSelect}
          disabled={done}
          aria-pressed={selected}
          aria-label={`${done ? 'Done' : selected ? 'Next up' : 'Choose'}: ${task.title}`}
          className="flex flex-1 gap-3.5 text-start disabled:cursor-default"
        >
          <span
            className={`mt-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors ${
              done ? 'border-good bg-good text-bg' : selected ? 'border-accent' : 'border-faint'
            }`}
            aria-hidden
          >
            {done ? <Check size={14} strokeWidth={3} /> : selected && <span className="size-2.5 rounded-full bg-accent" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-start justify-between gap-3">
              <span className={`text-[17px] leading-snug font-medium ${done ? 'text-muted line-through decoration-faint' : ''}`}>{task.title}</span>
              <span className="tnum shrink-0 pt-0.5 text-[15px] text-muted">{task.minutes} min</span>
            </span>
            {!done && (
              <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                {task.kind === 'fix' && <Tag tone="accent">Fix</Tag>}
                <Tag>{goal}</Tag>
                <span className="text-[14px] leading-snug text-muted">{ankiConnected ? 'Synced from Anki' : task.reason}</span>
              </span>
            )}
          </span>
        </button>
      </div>
      {ankiLink && (
        <button type="button" onClick={ankiLink} className="-mt-2 mb-3 ms-9 text-[14px] font-medium text-accent active:opacity-60">
          Connect Anki
        </button>
      )}
    </li>
  )
}

function Tomorrow({ tasks, newIds, goalLabel, open: forceOpen }: { tasks: Task[]; newIds: string[]; goalLabel: (id: string) => string; open: boolean }) {
  const [open, setOpen] = useState(false)
  const shown = open || forceOpen
  const hasNew = tasks.some((t) => newIds.includes(t.id))
  return (
    <section className="mt-8">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={shown}
        className="flex w-full items-center justify-between gap-3 py-2 text-start"
      >
        <span className="text-[17px] font-semibold">
          Tomorrow{' '}
          <span className="tnum font-normal text-muted">· {duration(totalMinutes(tasks))} · {tasks.length} tasks</span>
        </span>
        <span className="flex items-center gap-2">
          {hasNew && !shown && <Tag tone="accent">Updated</Tag>}
          <ChevronDown size={20} className={`text-faint transition-transform ${shown ? 'rotate-180' : ''}`} aria-hidden />
        </span>
      </button>
      {shown && (
        <ul className="anim-fade mt-1 space-y-3 pb-2">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-[15px] leading-snug">{t.title}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  {newIds.includes(t.id) && <Tag tone="accent">New</Tag>}
                  {t.kind === 'fix' && !newIds.includes(t.id) && <Tag tone="accent">Fix</Tag>}
                  <Tag>{goalLabel(t.goalId)}</Tag>
                  <span className="text-[13px] text-muted">{t.reason}</span>
                </span>
              </span>
              <span className="tnum shrink-0 text-[14px] text-muted">{t.minutes} min</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
