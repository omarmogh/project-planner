import { Check, ChevronDown, ChevronRight, Minus, Plus } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  addDays, busyOn, count, daysBetween, inDays, studiedOn, suggestNextSystem, systemDaysLeft, systemProgress, systemsInOrder,
  RETEST_PASS, doMore as engineDoMore, lectureQueue, isSystemDone, lightTasks, totalMinutes, watchedIds, monthYear, type Goal, type ISODate, type Task,
  SWEEP, sweepOutcome, sweepTaskId, whatsNext, type Recall, type SweepItem,
} from '../engine'
import { demoSweep, planSweep } from '../data/sweep'
import { ideaEnabled } from '../lib/features'
import { canConnectAnki } from '../lib/ankiConnect'
import { duration, longDate } from '../lib/format'
import { REDUCED_FADE, canAnimate, play, prefersReduced, springs, transition } from '../lib/motion'
import { useLongPress } from '../lib/useLongPress'
import { useShortcut } from '../lib/useShortcut'
import { focusFinished, offerFor, tomorrowPlan, useDemo } from '../store/demoStore'
import { WeekendLine } from './WeekendSetting'
import { CommitmentLines, CommitmentSheet, TAG_LABEL, useCommitmentSheet } from './Commitments'
import { RecallSweep, type SweepOrigin } from './RecallSweep'
import { NextPrompt, PlanFlowScreen } from './WhatsNext'
import { LectureSwitch, canSwitch } from './LectureSwitch'
import { MorePicker, boardChoices } from './MorePicker'
import { Button } from '../ui/Button'
import { Chip } from '../ui/Chip'
import { Page } from '../ui/Page'
import { ProgressBar } from '../ui/ProgressBar'
import { Pill } from '../ui/Pill'
import { Wordmark } from '../ui/Wordmark'
import { Sheet } from '../ui/Sheet'
import { Tag } from '../ui/Tag'
import { WatchedChecklist } from '../ui/WatchedChecklist'

const FIRST_NIGHT_LINE = 'One short task tonight. The full plan starts tomorrow.'

const DAY_LINE = {
  weekend: 'Weekend: a longer day.',
  normal: '',
} as const

/** A countdown only for a date the student gave. "No idea" has no date to count to; a rough one only a month. */
function goalWhen(g: Goal, today: ISODate): string {
  if (g.dateSource === 'projected') return 'when you’re ready'
  if (g.dateSource === 'rough') return `around ${monthYear(g.examDate)}`
  return inDays(daysBetween(today, g.examDate))
}

/** After a light-day answer: one calm line, never a warning. */
function modeLine(mode: 'light' | 'essentials' | 'rest', note: { perDay: number; days: number } | null): string {
  const first = { light: 'A light day.', essentials: 'Essentials only today.', rest: 'Rest day.' }[mode]
  const moved = note ? ` The rest is spread over the next ${count(note.days, 'day')}: about ${note.perDay} min more a day.` : ''
  return first + moved
}

/** Exam protocol: the day before, the day, the day after. One calm line each. */
const DAY_TYPE_LINE = {
  eve: { title: 'Your exam is tomorrow.', sub: 'One light review, then stop for the day.' },
  exam: { title: 'Exam day.', sub: 'Nothing planned. Good luck.' },
  rest: { title: 'Rest today.', sub: 'Nothing planned after your exam. The plan picks up tomorrow.' },
} as const

export function Today() {
  const s = useDemo()
  const plan = s.plan!
  const tasks = s.todayTasks
  const planned = totalMinutes(tasks)
  // Real timer minutes, the same figure the Week card adds up.
  const doneMin = studiedOn(plan.sessions, s.today)
  const pending = tasks.filter((t) => t.status === 'pending')
  // The session: every open task unless the student tapped its circle to leave it out. The focused row goes first.
  const leftOut = s.leftOut ?? []
  const inSession = pending.filter((t) => !leftOut.includes(t.id))
  const target = inSession.find((t) => t.id === s.selectedId) ?? inSession[0]
  const sessionIds = target ? [target.id, ...inSession.filter((t) => t.id !== target.id).map((t) => t.id)] : []
  const startNow = () => { if (target) s.startSession(sessionIds) }
  const goalLabel = (id: string) => plan.goals.find((g) => g.id === id)?.label ?? ''
  // Commitment work carries its own tag (Uni / USMLE / Personal) instead of a goal.
  const labelFor = (t: Task) => (t.tag ? TAG_LABEL[t.tag] : goalLabel(t.goalId))
  const sheet = useCommitmentSheet()
  useShortcut('n', () => sheet.setOpen('new'))
  useShortcut('s', startNow, !!target && !s.flow)
  const [switching, setSwitching] = useState<Task | null>(null)
  // The "next up" highlight glides from the old row to the new one instead of jumping (FLIP, transform only).
  const hlPrev = useRef<{ id: string; top: number; h: number } | null>(null)
  useLayoutEffect(() => {
    const el = document.querySelector<HTMLElement>('[data-hl]')
    if (!el || !target) { hlPrev.current = null; return }
    // Measured on the row, not on the moving layer (a re-run mid-glide must not read a transformed box).
    const r = el.parentElement!.getBoundingClientRect()
    const top = r.top + window.scrollY
    const prev = hlPrev.current
    hlPrev.current = { id: target.id, top, h: r.height }
    if (!prev || prev.id === target.id || !canAnimate() || !r.height) return
    play(el, [{ transform: `translateY(${prev.top - top}px) scaleY(${prev.h / r.height})` }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' })
  }, [target?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const switchLink = (t: Task) => {
    const r = plan.resources.find((x) => x.id === t.resourceId)
    return r?.type === 'slides' && canSwitch(t, lectureQueue(r).length) ? () => setSwitching(t) : undefined
  }
  // The day was planned once by the store; its notes already say whether commitments squeezed it.
  const squeezed = s.dayMode === 'full' && s.dayNotes.includes('squeezed')
  const reset = useLongPress(s.reset)

  const tomorrow = useMemo(() => tomorrowPlan(plan, tasks, s.today), [plan, tasks, s.today])
  // Known before the tap: "Do more" only shows when there is something worth adding, otherwise one line says why.
  const moreTask = useMemo(() => (tasks.every((t) => t.status !== 'pending') ? engineDoMore(plan, tasks, s.today) : null), [plan, tasks, s.today])
  // The Board's own checklists count as something to add, whatever the plan says.
  const boardOpen = useMemo(() => boardChoices(s.board, tasks).length > 0, [s.board, tasks])
  const canDoMore = !!moreTask || boardOpen
  const [picking, setPicking] = useState(false)
  const goals = [...plan.goals].filter((g) => g.examDate > s.today).sort((a, b) => a.examDate.localeCompare(b.examDate))
  const context = [plan.rotation && plan.rotation.until >= s.today ? `${plan.rotation.short} rotation` : null, { weekend: 'Weekend', normal: null }[s.dayKind]]
    .filter(Boolean)
    .join(' · ')
  // The demo student is mid-prep, so it isn't her "first day".
  const firstDay = s.intro && plan.sessions.length === 0
  const hasPending = pending.length > 0
  const offer = useMemo(() => (s.dayMode === 'full' && hasPending ? offerFor(plan, s.today) : null), [plan, s.today, s.dayMode, hasPending])
  const special = s.dayType !== 'normal' ? DAY_TYPE_LINE[s.dayType] : null
  // "Weekend: a longer day." isn't true when something you have to do takes the time.
  const busyToday = busyOn(plan.commitments, s.today).length > 0
  const dayLine =
    s.dayMode !== 'full' ? modeLine(s.dayMode, s.lightNote) : pending.length === 0 ? '' : s.firstNight ? FIRST_NIGHT_LINE : s.missedNote ?? (busyToday ? '' : DAY_LINE[s.dayKind])
  // Recall Sweep: the demo with ?idea=1; by default for students without a question bank (their first
  // fix → retest comes from it). Not part of today's tasks or the Start button.
  const idea = ideaEnabled(1)
  const sweep = useMemo(() => (idea ? demoSweep(plan) : planSweep(plan, s.today, s.sweepRatings)), [idea, plan, s.today, s.sweepRatings])
  const [sweepOpen, setSweepOpen] = useState<{ items: SweepItem[]; origin: SweepOrigin } | null>(null)
  const [popKey, setPopKey] = useState(0)
  const [pulse, setPulse] = useState<{ ids: string[]; key: number } | null>(null)
  const closeSweep = (completed: boolean) => {
    const items = sweepOpen?.items ?? []
    setSweepOpen(null)
    if (!completed) return
    setPopKey((k) => k + 1)
    const ids = items.map(sweepTaskId).filter((id) => tomorrow.tasks.some((t) => t.id === id))
    if (ids.length) setPulse((p) => ({ ids, key: (p?.key ?? 0) + 1 }))
  }
  // Nothing ahead (block over, or no exam): ask "What's next?" instead of an empty "on track" day. "Not now" holds until tomorrow.
  const next = useMemo(() => whatsNext(plan, s.today), [plan, s.today])
  const askNext = !!next && !s.intro && s.nextDismissed !== s.today
  const canEase = s.dayMode === 'full' && !s.firstNight && hasPending && lightTasks(plan, tasks, 'light').length < tasks.length
  const datePrompt = !s.intro ? goals.find((g) => g.dateSource === 'assumed' && !s.datePromptDismissed.includes(g.id)) : undefined

  if (s.flow) return <PlanFlowScreen />

  return (
    <Page
      withTabs
      top={
        <div className="flex h-12 items-end px-5 tablet:px-8 desktop:hidden">
          <Wordmark {...reset} />
        </div>
      }
      footer={
        target ? (
          <Button className="vt-run" onClick={() => transition(startNow, 'open')} title="Start (S)">
            <span className="truncate">
              {inSession.length > 1 ? `Start · ${inSession.length} tasks · ${duration(totalMinutes(inSession))}` : `Start · ${shortTitle(target)}`}
            </span>
          </Button>
        ) : undefined
      }
      below={<Tomorrow tasks={tomorrow.tasks} newIds={s.newIds} labelFor={labelFor} open={pending.length === 0} pulse={pulse} />}
    >
      <header className="pt-4">
        {firstDay && <p className="anim-fade mb-1 text-callout font-medium text-muted">Here's your first day</p>}
        {context && <p className="text-subhead font-semibold text-muted">{context}</p>}
        <div className="mt-0.5 flex items-start justify-between gap-3">
          <h1 className="text-large-title leading-tight font-semibold tracking-display">{longDate(s.today)}</h1>
          <button
            type="button"
            onClick={() => sheet.setOpen('new')}
            aria-label="Add something you have to do"
            className="press mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-accent hover:bg-line"
            title="Add something you have to do (N)"
          >
            <Plus className="size-icon-md" strokeWidth={2.25} aria-hidden />
          </button>
        </div>

        <div className="mt-6 flex items-end justify-between gap-4">
          <p className="min-w-0">
            <span className="tnum text-title-1 leading-none font-semibold tracking-display">{duration(planned)}</span> <span className="text-callout text-muted">planned</span>
          </p>
          <p className="tnum shrink-0 pb-0.5 text-subhead text-muted">{tasks.filter((t) => t.status === 'done').length} of {count(tasks.length, 'task')} done</p>
        </div>
        <div className="mt-3">
          <ProgressBar thin value={planned ? doneMin / planned : 0} label="Today's progress" />
        </div>
        <p className="mt-4 text-subhead text-muted">
          {goals.map((g, i) => (
            <span key={g.id}>
              {i > 0 && <span className="px-1.5 text-faint" aria-hidden>·</span>}
              {i > 0 && <span className="sr-only">, </span>}
              <span className="font-medium text-fg">{g.label}</span> <span className="tnum">{goalWhen(g, s.today)}</span>
            </span>
          ))}
        </p>
        <SystemLine />
        {s.intro && <WeekendLine />}
      </header>

      {offer && <LightOffer kind={offer.kind} restAllowed={offer.restAllowed} minutes={totalMinutes(lightTasks(plan, pending, 'light'))} examSoon={goals[0] ? daysBetween(s.today, goals[0].examDate) : 0} />}

      {s.editNote && <p className="anim-fade mt-6 text-callout text-muted">{s.editNote}</p>}

      {askNext && next && <NextPrompt reason={next.reason} />}

      {focusFinished(plan) && <NextSystem />}

      <CommitmentLines squeezed={squeezed} retestsKept={pending.some((t) => t.kind === 'retest')} onEdit={(c) => sheet.setOpen(c)} />

      {special && (
        <div className="anim-rise mt-8">
          <p className="text-title-2 font-semibold tracking-tight">{special.title}</p>
          <p className="mt-1 text-body-sm text-muted">{special.sub}</p>
        </div>
      )}

      {s.dayType === 'normal' && s.dayNotes.includes('paused') && (
        <p className="mt-6 text-callout text-muted">Your exam is close, so board work is Anki only for now. Its fixes and retests wait until after the exam.</p>
      )}
      {s.dayType === 'normal' && s.movedTasks.length > 0 && (
        <p className="mt-6 text-callout text-muted">
          {s.movedTasks.length === 1 ? `"${shortTitle(s.movedTasks[0])}" didn't fit today. It's first in line on your next study day.` : `${s.movedTasks.length} fixes and retests didn't fit today. They're first in line on your next study day.`}
        </p>
      )}
      {s.dayType === 'normal' && s.dayNotes.includes('ankiShortened') && (
        <p className="mt-6 text-callout text-muted">A short day: Anki reviews get what time there is, and no new cards.</p>
      )}

      {dayLine && s.dayType === 'normal' && <p className="mt-8 text-callout text-muted">{dayLine}</p>}

      {pending.length === 0 && s.dayMode === 'rest' && (
        <div className="anim-rise mt-8">
          <p className="text-title-2 font-semibold tracking-tight">Enjoy the day off.</p>
          <p className="mt-1 text-body-sm text-muted">Tomorrow's plan is ready below.</p>
        </div>
      )}

      {pending.length === 0 && s.dayMode !== 'rest' && s.dayType === 'normal' && (
        <div className="anim-rise mt-8">
          <p className="text-title-2 font-semibold tracking-tight">{squeezed && doneMin === 0 ? 'Your commitments come first today.' : tasks.length === 0 ? 'Nothing planned today.' : 'Done for today.'}</p>
          <p className="mt-1 text-body-sm text-muted">{squeezed && doneMin === 0 ? "Tomorrow's plan is ready below." : tasks.length === 0 ? (next ? 'No exam is coming up, so there is nothing to plan yet.' : "You're on track. Tomorrow's plan is ready below.") : `${duration(doneMin)} studied. Tomorrow's plan is ready below.`}</p>
          {next && !askNext && (
            <button type="button" onClick={() => useDemo.setState({ nextDismissed: null })} className="mt-1 inline-flex min-h-11 items-center text-callout font-medium text-accent hover:opacity-70 active:opacity-60">What's next?</button>
          )}
          {canDoMore ? (
            <button type="button" onClick={squeezed && doneMin === 0 && moreTask ? s.doMore : () => setPicking(true)} className="mt-3 inline-flex min-h-11 items-center text-callout font-medium text-accent hover:opacity-70 active:opacity-60">
              {/* A day the commitments filled: one short, optional essential, never a full plan. */}
              {squeezed && doneMin === 0 && moreTask ? `Have ${duration(moreTask.minutes)}? ${moreTask.title}` : 'Do more'}
            </button>
          ) : (
            tasks.length > 0 && <p className="mt-3 text-callout text-muted">That's everything worth doing today. Rest is part of the plan.</p>
          )}
        </div>
      )}

      <ul className={`${dayLine ? 'mt-3' : 'mt-6'} -mx-3 flex flex-col gap-0.5`}>
        {sweep && sweep.items.length > 0 && (
          <SweepRow
            items={sweep.items}
            system={sweep.system}
            ratings={s.sweepRatings}
            added={sweepOutcome(sweep.items, s.sweepRatings, s.today).tasks.length}
            hidden={!!sweepOpen}
            popKey={popKey}
            onOpen={(origin) => setSweepOpen({ items: sweep.items, origin })}
          />
        )}
        {tasks.map((t, i) => (
          <TaskRow
            key={t.id}
            task={t}
            goal={labelFor(t)}
            editLink={t.commitmentId && t.status === 'pending' && t.id === target?.id ? () => {
              const c = plan.commitments?.find((x) => x.id === t.commitmentId)
              if (c) sheet.setOpen(c)
            } : undefined}
            doneLink={t.status === 'pending' && t.id === target?.id && !t.commitmentId ? () => transition(() => s.doneAlready(t.id), 'up') : undefined}
            switchLink={t.id === target?.id ? switchLink(t) : undefined}
            selected={t.id === target?.id}
            onSelect={() => { if (leftOut.includes(t.id)) s.toggleLeftOut(t.id); s.select(t.id) }}
            inSession={t.status === 'pending' ? !leftOut.includes(t.id) : undefined}
            onToggle={pending.length > 1 ? () => s.toggleLeftOut(t.id) : undefined}
            intro={s.intro ? i : undefined}
            ankiLink={t.kind === 'anki' && t.status === 'pending' && !s.ankiConnected && canConnectAnki() ? () => s.openAnki() : undefined}
            ankiConnected={t.kind === 'anki' && s.ankiConnected}
          />
        ))}
      </ul>

      {canEase && !offer && <EaseLink />}

      {switching && <LectureSwitch task={switching} onClose={() => setSwitching(null)} />}
      {picking && <MorePicker onClose={() => setPicking(false)} />}
      {sheet.open && <CommitmentSheet editing={sheet.open === 'new' ? undefined : sheet.open} onClose={sheet.close} />}
      {datePrompt && <DatePrompt goalId={datePrompt.id} label={datePrompt.label} />}
      {sweepOpen && createPortal(
        <RecallSweep
          title="Recall sweep"
          items={sweepOpen.items}
          ratings={s.sweepRatings}
          today={s.today}
          origin={sweepOpen.origin}
          onRate={(id, r) => s.rateSweep(sweepOpen.items, id, r)}
          onClose={closeSweep}
        />,
        document.body,
      )}
    </Page>
  )
}

function shortTitle(t: Task) {
  return t.title.replace(/^Retest: /, 'Retest ')
}

/**
 * "Cardio: 6 of 15 topics watched · 1 solid · about 5 days left" for the systems being studied now.
 * Watched comes from ticks and finished tasks; solid only from questions and retests.
 * Tap → the system's "already watched" checklist, when the student uses B&B.
 */
function SystemLine() {
  const { plan, today, setWatched } = useDemo()
  const [open, setOpen] = useState<string | null>(null)
  const close = useCallback(() => setOpen(null), [])
  const p = plan!
  if (!p.topicGoalId) return null
  const lines = p.focus.filter((x) => !isSystemDone(p.topics, x)).map((sys) => {
    const prog = systemProgress(p.topics, sys)
    const days = systemDaysLeft(p, sys, today)
    const text = `${sys}: ${prog.watched} of ${count(prog.total, 'topic')} watched · ${prog.solid} solid${days ? ` · about ${count(days, 'day')} left` : ''}`
    return { sys, text }
  })
  if (lines.length === 0) return null
  const tickable = p.materials.includes('bnb')
  return (
    <>
      <div className="mt-1">
        {lines.map((l) =>
          tickable ? (
            <button
              key={l.sys}
              type="button"
              onClick={() => setOpen(l.sys)}
              aria-label={`${l.text}. Mark ${l.sys} videos you've already watched`}
              className="tnum -my-1.5 flex min-h-11 items-center gap-1 text-start text-subhead text-muted transition-opacity hover:opacity-70 active:opacity-60"
            >
              <span>{l.text}</span>
              <ChevronRight className="size-icon-xs shrink-0 rtl:-scale-x-100" aria-hidden />
            </button>
          ) : (
            <p key={l.sys} className="tnum text-subhead text-muted">{l.text}</p>
          ),
        )}
      </div>
      {open && (
        <Sheet title={`Already watched in ${open}`} onClose={close}>
          <p className="pt-3 text-subhead text-muted">Ticked videos leave your plan. A topic only turns solid after its questions.</p>
          <WatchedChecklist system={open} watched={watchedIds(p.topics, open)} onChange={setWatched} />
        </Sheet>
      )}
    </>
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
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Pill tone="accent" onClick={() => chooseSystem(next)}>Start {next}</Pill>
            <Pill onClick={() => setPicking(true)}>Pick another</Pill>
          </div>
        </>
      )}
    </section>
  )
}

/**
 * After a rough patch, offered once: a lighter day. Never a warning, never a streak.
 * Close to an exam it's essentials only; past the weekly limit, just a nudge to do the first task.
 */
function LightOffer({ kind, restAllowed, minutes, examSoon }: { kind: 'light' | 'essentials' | 'firstOnly'; restAllowed: boolean; minutes: number; examSoon: number }) {
  const answer = useDemo((x) => x.answerLight)
  const link = 'inline-flex min-h-11 items-center text-callout transition-opacity hover:opacity-70 active:opacity-60'
  if (kind === 'firstOnly') {
    return (
      <section className="anim-rise mt-8 rounded-lg bg-surface p-5" aria-label="A lighter start">
        <p className="text-body font-semibold">Just the first task today. You can stop after it.</p>
        <Pill tone="accent" className="mt-4" onClick={() => answer('full')}>Got it</Pill>
      </section>
    )
  }
  return (
    <section className="anim-rise mt-8 rounded-lg bg-surface p-5" aria-label="Rough day">
      <p className="text-body font-semibold">
        {kind === 'essentials' ? 'Rough day? Do just the essentials.' : `Rough day? Do just the essentials (about ${Math.max(5, Math.round(minutes / 5) * 5)} min).`}
      </p>
      <p className="mt-1 text-callout text-muted">
        {kind === 'essentials'
          ? `Your exam is ${inDays(examSoon)}, so keep the two tasks that matter most. The rest moves to the coming days.`
          : restAllowed
            ? "A day off still keeps you on track for your exam. The rest moves to the coming days."
            : 'The rest moves to the coming days.'}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Pill tone="accent" onClick={() => answer('light')}>{kind === 'essentials' ? 'Essentials only' : 'Light day'}</Pill>
        {restAllowed && <Pill onClick={() => answer('rest')}>Take today off</Pill>}
        <button type="button" onClick={() => answer('full')} className={`${link} px-2 font-medium text-muted`}>Keep the full plan</button>
      </div>
    </section>
  )
}

/** "Not feeling well?" A quiet way to a lighter day on the student's own say-so, with one confirm and no guilt. */
function EaseLink() {
  const { plan, todayTasks, takeItEasy } = useDemo()
  const [open, setOpen] = useState(false)
  const minutes = totalMinutes(lightTasks(plan!, todayTasks, 'light').filter((t) => t.status === 'pending'))
  const link = 'inline-flex min-h-11 items-center text-callout hover:opacity-70 active:opacity-60'
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className={`${link} mt-4 font-medium text-muted`}>Not feeling well? Take it easy</button>
  }
  return (
    <section className="anim-fade mt-4 rounded-lg bg-surface p-5" aria-label="Take it easy">
      <p className="text-body font-semibold">A lighter day{minutes > 0 ? ` (about ${Math.max(5, Math.round(minutes / 5) * 5)} min)` : ''}?</p>
      <p className="mt-1 text-callout text-muted">Just the essentials today. The rest moves to the coming days and your plan adjusts.</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Pill tone="accent" onClick={() => { takeItEasy(); setOpen(false) }}>Lighter day</Pill>
        <button type="button" onClick={() => setOpen(false)} className={`${link} px-2 font-medium text-muted`}>Keep the full plan</button>
      </div>
    </section>
  )
}

/** First day only: the weekend that came with the university's country, with a tap to change. */

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
          <button type="submit" disabled={!(date > today)} className="inline-flex min-h-11 items-center text-callout font-semibold text-accent hover:opacity-70 active:opacity-60 disabled:opacity-40">
            Save
          </button>
        </form>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Pill tone="accent" onClick={() => setAdding(true)}>Add date</Pill>
          <Pill onClick={() => dismissDatePrompt(goalId)}>Not yet</Pill>
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
  task, goal, selected, onSelect, intro, ankiLink, ankiConnected, editLink, doneLink, switchLink, inSession, onToggle,
}: {
  task: Task; goal: string; selected: boolean; onSelect: () => void; intro?: number
  /** Open tasks: in the next session or left out. `onToggle` (two or more open) lets the circle choose. */
  inSession?: boolean; onToggle?: () => void
 ankiLink?: () => void; ankiConnected: boolean; editLink?: () => void; doneLink?: () => void; switchLink?: () => void
}) {
  const closed = task.status !== 'pending'
  const done = task.status === 'done'
  const note = STATUS_NOTE[task.status]
  return (
    <li
      className={`relative isolate rounded-lg px-3 transition-colors ${selected && !closed ? '' : closed ? '' : 'hover:bg-surface/60'} ${intro !== undefined ? 'anim-rise' : ''}`}
      style={intro !== undefined ? { animationDelay: `${180 + intro * 110}ms` } : undefined}
    >
      {selected && !closed && <span data-hl className="absolute inset-0 -z-10 origin-top rounded-lg bg-surface" aria-hidden />}
      <div className="flex gap-3.5 py-3.5">
        {onToggle && !closed && (
          // The circle chooses the session: tap to leave this one out (it stays on Today), tap again to take it back.
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={!!inSession}
            aria-label={inSession ? `In this session: ${task.title}. Tap to leave it out` : `Left out: ${task.title}. Tap to add it back`}
            title={inSession ? 'In this session · tap to leave out' : 'Left out · tap to add back'}
            className="group/c -mx-2.5 -mt-2 flex size-10.5 shrink-0 items-center justify-center rounded-full hover:bg-surface"
          >
            <span className={`flex size-5.5 items-center justify-center rounded-full border-control transition-colors ${inSession ? 'border-accent bg-bg' : 'border-faint group-hover/c:border-accent'}`} aria-hidden>
              {inSession && <span key="in" className="anim-pop size-2.5 rounded-full bg-accent" />}
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={onSelect}
          disabled={closed}
          aria-pressed={selected}
          aria-label={`${done ? 'Done' : note ? note : selected ? 'Next up' : 'Choose'}: ${task.title}`}
          className="group flex min-h-11 flex-1 gap-3.5 text-start disabled:cursor-default"
        >
          {!(onToggle && !closed) && (
            <span
              className={`mt-0.5 flex size-5.5 shrink-0 items-center justify-center rounded-full border-control transition-colors ${
                done ? 'border-good bg-good text-bg' : closed ? 'border-faint text-faint' : selected ? 'border-accent bg-bg' : 'border-faint group-hover:border-accent'
              }`}
              aria-hidden
            >
              {done ? <Check className="size-icon-xs" strokeWidth={3} /> : closed ? <Minus className="size-icon-xs" strokeWidth={3} /> : selected && <span className="size-2.5 rounded-full bg-accent" />}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="flex items-start justify-between gap-3">
              <span className={`text-body leading-snug font-medium transition-colors ${closed || inSession === false ? 'text-muted' : ''} ${done ? 'line-through decoration-faint' : ''}`}>{task.title}</span>
              <span className={`tnum shrink-0 pt-0.5 text-callout ${selected && !closed ? 'font-medium text-fg' : 'text-muted'}`}>{task.minutes} min</span>
            </span>
            {!closed && task.steps && <span className="mt-1 block text-subhead leading-snug text-fg">{task.steps.join(' · ')}</span>}
            {note && <span className="mt-1 block text-subhead leading-snug text-muted">{note}</span>}
            {inSession === false && <span className="anim-fade mt-1 block text-subhead leading-snug text-muted">Not in this session · stays on today</span>}
            {!closed && (
              <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                {task.kind === 'fix' && <Tag tone="accent">Fix</Tag>}
                <Tag>{goal}</Tag>
                <span className="text-subhead leading-snug text-muted">{ankiConnected ? 'Synced from Anki' : task.kind === 'retest' ? `${task.reason} · ${RETEST_PASS}% passes` : task.reason}</span>
              </span>
            )}
          </span>
        </button>
      </div>
      {ankiLink && (
        <button type="button" onClick={ankiLink} className="-mt-3 mb-1 ms-9 inline-flex min-h-11 items-center text-subhead font-medium text-accent hover:opacity-70 active:opacity-60">
          Connect Anki
        </button>
      )}
      {(doneLink || switchLink) && (
        <div className="-mt-3 mb-1 ms-9 flex flex-wrap gap-x-5">
          {switchLink && (
            <button type="button" onClick={switchLink} className="inline-flex min-h-11 items-center text-subhead font-medium text-accent hover:opacity-70 active:opacity-60">
              {(task.amount ?? 1) > 1 ? 'Switch lectures' : 'Switch lecture'}
            </button>
          )}
          {doneLink && (
            // Did it already, without the timer: straight to the report. Quiet, the primary action stays Start.
            <button type="button" onClick={doneLink} className="inline-flex min-h-11 items-center text-subhead font-medium text-muted hover:opacity-70 active:opacity-60">
              Done already
            </button>
          )}
        </div>
      )}
      {editLink && (
        <button type="button" onClick={editLink} className="-mt-3 mb-1 ms-9 inline-flex min-h-11 items-center text-subhead font-medium text-accent hover:opacity-70 active:opacity-60">
          Edit
        </button>
      )}
    </li>
  )
}

function Tomorrow({ tasks, newIds, labelFor, open: forceOpen, pulse }: {
  tasks: Task[]; newIds: string[]; labelFor: (t: Task) => string; open: boolean; pulse?: { ids: string[]; key: number } | null
}) {
  const [open, setOpen] = useState(false)
  const shown = open || forceOpen
  const section = useRef<HTMLElement>(null)

  // After a sweep: open, bring into view, and pulse the new items once.
  useEffect(() => {
    if (!pulse) return
    setOpen(true)
  }, [pulse])
  useLayoutEffect(() => {
    if (!pulse || !shown || !section.current) return
    const reduced = prefersReduced()
    section.current.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'end' })
    const timer = window.setTimeout(() => {
      pulse.ids.forEach((id) => {
        const glow = section.current?.querySelector<HTMLElement>(`[data-task="${id}"] [data-pulse]`)
        play(glow, [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }], { duration: reduced ? 900 : 1400, easing: 'ease-in-out' })
      })
    }, reduced ? 0 : 380)
    return () => window.clearTimeout(timer)
  }, [pulse?.key, shown])
  const hasNew = tasks.some((t) => newIds.includes(t.id))
  return (
    <section ref={section} className="mt-4 scroll-mb-36 border-t border-line pt-2">
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
            <li key={t.id} data-task={t.id} className="relative flex items-start justify-between gap-3">
              {pulse && <span data-pulse className="pointer-events-none absolute -inset-x-3 -inset-y-1.5 rounded-md bg-accent-soft opacity-0" aria-hidden />}
              <span className="relative min-w-0">
                <span className="block text-callout leading-snug">{t.title}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  {newIds.includes(t.id) && <Tag tone="accent">New</Tag>}
                  {t.kind === 'fix' && !newIds.includes(t.id) && <Tag tone="accent">Fix</Tag>}
                  <Tag>{labelFor(t)}</Tag>
                  <span className="text-footnote text-muted">{t.reason}</span>
                </span>
              </span>
              <span className="tnum relative shrink-0 text-subhead text-muted">{t.minutes} min</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Today's Recall sweep row (idea prototype). Expands into the full-screen sweep. */
function SweepRow({ items, system, ratings, added, hidden, popKey, onOpen }: {
  items: SweepItem[]; system: string; ratings: Record<string, Recall>; added: number; hidden: boolean; popKey: number
  onOpen: (origin: SweepOrigin) => void
}) {
  const row = useRef<HTMLButtonElement>(null)
  const title = useRef<HTMLSpanElement>(null)
  const check = useRef<HTMLSpanElement>(null)
  const rated = items.filter((it) => ratings[it.id]).length
  const complete = rated === items.length
  const lectures = items.filter((it) => it.kind === 'lecture')

  useLayoutEffect(() => {
    if (!popKey || !check.current) return
    if (prefersReduced()) play(check.current, [{ opacity: 0 }, { opacity: 1 }], { duration: REDUCED_FADE, easing: 'linear' })
    else play(check.current, [{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, transform: 'none' }], { duration: springs().card.duration, easing: springs().card.easing, delay: 60 })
  }, [popKey])

  const status = complete
    ? added ? `${count(added, 'item')} added to your week` : 'Nothing to add. Everything felt solid.'
    : rated ? `${rated} of ${items.length} rated · tap to continue`
    : !system && lectures[0] ? `${items.length === 1 ? 'A lecture' : `${items.length} lectures`} you finished in ${lectures[0].label.replace(/ lecture$/, '')}. How much is still there? Tap only.`
    : `${items.length} titles from ${system}${lectures[0] ? ` and ${lectures[0].label.replace(/ lecture$/, '')}` : ''}. Tap only.`

  return (
    <li className="rounded-lg px-3 transition-colors hover:bg-surface/60">
      <button
        ref={row}
        type="button"
        onClick={() => row.current && title.current && onOpen({ row: row.current, title: title.current })}
        aria-haspopup="dialog"
        aria-hidden={hidden || undefined}
        className="flex min-h-11 w-full gap-3.5 py-3.5 text-start"
      >
        <span
          ref={check}
          className={`mt-0.5 flex size-5.5 shrink-0 items-center justify-center rounded-full border-control ${complete ? 'border-good bg-good text-bg' : 'border-faint'}`}
          aria-hidden
        >
          {complete && <Check className="size-icon-xs" strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span ref={title} className={`text-body leading-snug font-medium ${complete ? 'text-muted' : ''}`}>Recall sweep</span>
            <span className="tnum shrink-0 pt-0.5 text-callout text-muted">{SWEEP.minutes} min</span>
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            {!complete && items.find((i) => i.kind === 'topic') && <Tag>{items.find((i) => i.kind === 'topic')!.label.split(' · ')[0]}</Tag>}
            {!complete && lectures[0] && <Tag>{lectures[0].label.replace(/ lecture$/, '')}</Tag>}
            <span className="text-subhead leading-snug text-muted">{status}</span>
          </span>
        </span>
      </button>
    </li>
  )
}
