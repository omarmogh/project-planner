import { Check, ChevronDown, Minus } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  addDays, count, daysBetween, inDays, studiedMinutes, suggestNextSystem, systemDaysLeft, systemProgress, systemsInOrder,
  isSystemDone, totalMinutes, type Task,
} from '../engine'
import { duration, longDate } from '../lib/format'
import { useLongPress } from '../lib/useLongPress'
import { focusFinished, tomorrowPlan, useDemo } from '../store/demoStore'
import { Button } from '../ui/Button'
import { Chip } from '../ui/Chip'
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
  const doneMin = tasks.reduce((n, t) => n + studiedMinutes(t), 0)
  const pending = tasks.filter((t) => t.status === 'pending')
  const target = tasks.find((t) => t.id === s.selectedId && t.status === 'pending') ?? pending[0]
  const goalLabel = (id: string) => plan.goals.find((g) => g.id === id)?.label ?? ''
  const reset = useLongPress(s.reset)

  const tomorrow = useMemo(() => tomorrowPlan(plan, tasks, s.today), [plan, tasks, s.today])
  const goals = [...plan.goals].filter((g) => g.examDate > s.today).sort((a, b) => a.examDate.localeCompare(b.examDate))
  const context = [plan.rotation && plan.rotation.until >= s.today ? `${plan.rotation.short} rotation` : null, { postCall: 'Post-call', call: 'On call', weekend: 'Weekend', normal: null }[s.dayKind]]
    .filter(Boolean)
    .join(' · ')
  const datePrompt = !s.intro ? goals.find((g) => g.dateSource === 'assumed' && !s.datePromptDismissed.includes(g.id)) : undefined

  return (
    <Page
      withTabs
      top={
        <div className="flex h-12 items-end px-5 tablet:px-8 desktop:hidden">
          <span {...reset} className="select-none text-callout font-semibold tracking-tight text-faint" title="Locus">Locus</span>
        </div>
      }
      footer={
        target ? (
          <Button onClick={() => s.start(target.id)}>
            <span className="truncate">Start · {shortTitle(target)}</span>
          </Button>
        ) : undefined
      }
      below={<Tomorrow tasks={tomorrow.tasks} newIds={s.newIds} goalLabel={goalLabel} open={pending.length === 0} />}
    >
      <header className="pt-3">
        {s.intro && <p className="anim-fade mb-1 text-callout font-medium text-accent">Here's your first day</p>}
        {context && <p className="text-callout font-medium text-muted">{context}</p>}
        <h1 className="mt-0.5 text-large-title leading-tight font-semibold tracking-tight">{longDate(s.today)}</h1>

        <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-body">
            <span className="tnum font-semibold">{duration(planned)}</span> <span className="text-muted">planned</span>
          </p>
          <p className="tnum text-callout text-muted">{tasks.filter((t) => t.status === 'done').length} of {count(tasks.length, 'task')} done</p>
        </div>
        <div className="mt-3">
          <ProgressBar value={planned ? doneMin / planned : 0} label="Today's progress" />
        </div>
        <p className="mt-3 text-callout text-muted">
          {goals.map((g, i) => (
            <span key={g.id}>
              {i > 0 && ' · '}
              {g.label} <span className="tnum">{inDays(daysBetween(s.today, g.examDate))}</span>
            </span>
          ))}
        </p>
        <SystemLine />
      </header>

      {focusFinished(plan) && <NextSystem />}

      {DAY_LINE[s.dayKind] && pending.length > 0 && <p className="mt-8 text-callout text-muted">{DAY_LINE[s.dayKind]}</p>}

      {pending.length === 0 && (
        <div className="anim-rise mt-8">
          <p className="text-title-2 font-semibold tracking-tight">Done for today.</p>
          <p className="mt-1 text-body-sm text-muted">{duration(doneMin)} studied. Tomorrow's plan is ready below.</p>
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

      {datePrompt && <DatePrompt goalId={datePrompt.id} label={datePrompt.label} />}
    </Page>
  )
}

function shortTitle(t: Task) {
  return t.title.replace(/^Retest: /, 'Retest ')
}

/** "Cardio: 6 of 15 topics · about 5 days left" for the systems being studied now. */
function SystemLine() {
  const { plan, today } = useDemo()
  const p = plan!
  if (!p.topicGoalId) return null
  const lines = p.focus.filter((x) => !isSystemDone(p.topics, x)).map((sys) => {
    const prog = systemProgress(p.topics, sys)
    const days = systemDaysLeft(p, sys, today)
    return { sys, text: `${sys}: ${prog.covered} of ${count(prog.total, 'topic')}${days ? ` · about ${count(days, 'day')} left` : ''}` }
  })
  if (lines.length === 0) return null
  return (
    <p className="tnum mt-1 text-callout text-muted">
      {lines.map((l, i) => (
        <span key={l.sys}>{i > 0 && ' · '}{l.text}</span>
      ))}
    </p>
  )
}

/** A system is finished: suggest the next one, one tap to accept or pick another. */
function NextSystem() {
  const { plan, today, chooseSystem } = useDemo()
  const p = plan!
  const [picking, setPicking] = useState(false)
  const done = p.focus.join(' and ')
  const next = suggestNextSystem(p, today)
  if (!next) {
    return (
      <section className="anim-rise mt-8 rounded-lg bg-surface p-5">
        <p className="text-body font-semibold">{done} is done. That's every system.</p>
        <p className="mt-1 text-callout text-muted">From here it's questions, fixes and retests.</p>
      </section>
    )
  }
  const fresh = systemProgress(p.topics, next).covered === 0
  const others = systemsInOrder(p.topics).filter((x) => !isSystemDone(p.topics, x))
  return (
    <section className="anim-rise mt-8 rounded-lg bg-surface p-5" aria-label="Next system">
      <p className="text-body font-semibold">{done} is done.</p>
      {picking ? (
        <>
          <p className="mt-1 text-callout text-muted">Pick what's next:</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {others.map((x) => (
              <Chip key={x} check={false} selected={x === next} onClick={() => chooseSystem(x)}>{x}</Chip>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-callout text-muted">
            Next: <span className="font-medium text-fg">{next}</span>, {fresh ? 'not started yet' : 'your weakest by accuracy'}.
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4">
            <button type="button" onClick={() => chooseSystem(next)} className="inline-flex min-h-11 items-center text-callout font-semibold text-accent active:opacity-60">
              Start {next}
            </button>
            <button type="button" onClick={() => setPicking(true)} className="inline-flex min-h-11 items-center text-callout font-medium text-muted active:opacity-60">
              Pick another
            </button>
          </div>
        </>
      )}
    </section>
  )
}

/** "Is your IM exam date out yet?" One quiet question, asked once. */
function DatePrompt({ goalId, label }: { goalId: string; label: string }) {
  const { today, setExamDate, dismissDatePrompt } = useDemo()
  const [adding, setAdding] = useState(false)
  const [date, setDate] = useState('')
  return (
    <section className="mt-8 border-b border-line pb-4">
      <p className="text-callout text-muted">Is your {label} date out yet?</p>
      {adding ? (
        <form
          className="mt-2 flex flex-wrap items-center gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (date > today) setExamDate(goalId, date)
          }}
        >
          <input
            type="date"
            value={date}
            min={addDays(today, 1)}
            aria-label={`${label} date`}
            onChange={(e) => setDate(e.target.value)}
            className="tnum min-w-0 max-w-full rounded-md bg-surface px-3 text-body-sm text-fg"
          />
          <button type="submit" disabled={!(date > today)} className="inline-flex min-h-11 items-center text-callout font-semibold text-accent active:opacity-60 disabled:opacity-40">
            Save
          </button>
        </form>
      ) : (
        <div className="mt-1 flex flex-wrap gap-x-4">
          <button type="button" onClick={() => setAdding(true)} className="inline-flex min-h-11 items-center text-callout font-semibold text-accent active:opacity-60">
            Add date
          </button>
          <button type="button" onClick={() => dismissDatePrompt(goalId)} className="inline-flex min-h-11 items-center text-callout font-medium text-muted active:opacity-60">
            Not yet
          </button>
        </div>
      )}
    </section>
  )
}

const STATUS_NOTE: Partial<Record<Task['status'], string>> = {
  partly: 'Partly done · the rest comes first next time',
  skipped: 'Moved to the coming days',
}

function TaskRow({
  task, goal, selected, onSelect, intro, ankiLink, ankiConnected,
}: {
  task: Task; goal: string; selected: boolean; onSelect: () => void; intro?: number; ankiLink?: () => void; ankiConnected: boolean
}) {
  const closed = task.status !== 'pending'
  const done = task.status === 'done'
  const note = STATUS_NOTE[task.status]
  return (
    <li className={intro !== undefined ? 'anim-rise' : ''} style={intro !== undefined ? { animationDelay: `${180 + intro * 110}ms` } : undefined}>
      <div className="flex gap-3.5 py-4">
        <button
          type="button"
          onClick={onSelect}
          disabled={closed}
          aria-pressed={selected}
          aria-label={`${done ? 'Done' : note ? note : selected ? 'Next up' : 'Choose'}: ${task.title}`}
          className="flex flex-1 gap-3.5 text-start disabled:cursor-default"
        >
          <span
            className={`mt-0.5 flex size-5.5 shrink-0 items-center justify-center rounded-full border-control transition-colors ${
              done ? 'border-good bg-good text-bg' : closed ? 'border-faint text-faint' : selected ? 'border-accent' : 'border-faint'
            }`}
            aria-hidden
          >
            {done ? <Check className="size-icon-xs" strokeWidth={3} /> : closed ? <Minus className="size-icon-xs" strokeWidth={3} /> : selected && <span className="size-2.5 rounded-full bg-accent" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-start justify-between gap-3">
              <span className={`text-body leading-snug font-medium ${closed ? 'text-muted' : ''} ${done ? 'line-through decoration-faint' : ''}`}>{task.title}</span>
              <span className="tnum shrink-0 pt-0.5 text-callout text-muted">{task.minutes} min</span>
            </span>
            {!closed && task.steps && <span className="mt-1 block text-subhead leading-snug text-fg">{task.steps.join(' · ')}</span>}
            {note && <span className="mt-1 block text-subhead leading-snug text-muted">{note}</span>}
            {!closed && (
              <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                {task.kind === 'fix' && <Tag tone="accent">Fix</Tag>}
                <Tag>{goal}</Tag>
                <span className="text-subhead leading-snug text-muted">{ankiConnected ? 'Synced from Anki' : task.reason}</span>
              </span>
            )}
          </span>
        </button>
      </div>
      {ankiLink && (
        <button type="button" onClick={ankiLink} className="-mt-3 mb-1 ms-9 inline-flex min-h-11 items-center text-subhead font-medium text-accent active:opacity-60">
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
    <section className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={shown}
        className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-start"
      >
        <span className="text-body font-semibold">
          Tomorrow{' '}
          <span className="tnum font-normal text-muted">· {duration(totalMinutes(tasks))} · {count(tasks.length, 'task')}</span>
        </span>
        <span className="flex items-center gap-2">
          {hasNew && !shown && <Tag tone="accent">Updated</Tag>}
          <ChevronDown className={`size-icon-md text-faint transition-transform ${shown ? 'rotate-180' : ''}`} aria-hidden />
        </span>
      </button>
      {shown && (
        <ul className="anim-fade mt-1 space-y-3 pb-2">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-callout leading-snug">{t.title}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  {newIds.includes(t.id) && <Tag tone="accent">New</Tag>}
                  {t.kind === 'fix' && !newIds.includes(t.id) && <Tag tone="accent">Fix</Tag>}
                  <Tag>{goalLabel(t.goalId)}</Tag>
                  <span className="text-footnote text-muted">{t.reason}</span>
                </span>
              </span>
              <span className="tnum shrink-0 text-subhead text-muted">{t.minutes} min</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
