import { Check, ListChecks, Plus, Timer, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { chime } from '../lib/chime'
import { clock } from '../lib/format'
import { transition } from '../lib/motion'
import { useShortcut } from '../lib/useShortcut'
import { useDemo, type Running as Run, type TimerPrefs } from '../store/demoStore'
import { DEFAULT_TIMER, breakLeft, focusLeft, isTicked, lapMinutes, openIds, queueOf, savesSomething, taskMs } from '../store/session'
import { Button } from '../ui/Button'
import { Page } from '../ui/Page'
import { Pill } from '../ui/Pill'
import { ProgressBar } from '../ui/ProgressBar'
import { Sheet } from '../ui/Sheet'
import { Stepper } from '../ui/Stepper'
import { Tag } from '../ui/Tag'

const hhmm = (at: number) => new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

/**
 * A study session: the tasks chosen on Today, one timer. The current task is on screen; the whole
 * session (ticked with their times, what's next, what else is on today) is one tap away in a sheet.
 * Timer mode counts down the task's minutes; Pomodoro mode counts focus periods and breaks.
 */
export function Running() {
  const s = useDemo()
  const { running, todayTasks, plan, pause, resume, tickTask, cancelRun, addTime, startBreak, endBreak } = s
  const prefs = s.timerPrefs ?? DEFAULT_TIMER
  const [now, setNow] = useState(() => Date.now())
  const [sheet, setSheet] = useState<'session' | 'timer' | null>(null)
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])
  const onBreak = running?.pomo?.phase === 'break'
  const isPaused = running?.pausedAt != null && !onBreak
  useShortcut(' ', isPaused ? resume : pause, !!running && !onBreak)

  // Pomodoro: focus over → break (chime); break over → chime, and back to focus if the student chose that.
  const rang = useRef<string>('')
  const focusSec = running?.pomo && !onBreak ? focusLeft(running, now, prefs) : 1
  const breakSec = onBreak && running ? breakLeft(running, now) : 1
  useEffect(() => {
    if (!running?.pomo) return
    if (!onBreak && !running.pausedAt && focusSec <= 0) { chime(); startBreak() }
    const key = `b${running.pomo.done}`
    if (onBreak && breakSec <= 0 && rang.current !== key) {
      rang.current = key
      chime()
      if (prefs.autoFocus) endBreak()
    }
  }, [focusSec <= 0, breakSec <= 0, onBreak]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!running) return null
  const task = todayTasks.find((t) => t.id === running.taskId)
  if (!task) return null
  const goal = plan?.goals.find((g) => g.id === task.goalId)?.label
  const queue = queueOf(running)
  const open = openIds(running)
  const ticked = queue.length - open.length
  const nextId = open.find((id) => id !== running.taskId && queue.indexOf(id) > queue.indexOf(running.taskId)) ?? open.find((id) => id !== running.taskId)
  const nextTask = todayTasks.find((t) => t.id === nextId)
  const saves = savesSomething(running, now)

  const planned = task.minutes + (running.extra?.[task.id] ?? 0)
  const spentSec = taskMs(running, now) / 1000
  const pomo = running.pomo
  // The big number: the task countdown (timer mode) or the focus / break countdown (Pomodoro).
  const left = !pomo ? planned * 60 - spentSec : onBreak ? breakSec : focusSec
  const over = left < 0
  const span = !pomo ? planned * 60 : onBreak ? (pomo.breakMin ?? prefs.short) * 60 : prefs.focus * 60
  const longBreak = onBreak && pomo?.breakMin === prefs.long && prefs.long !== prefs.short
  const sub = isPaused
    ? 'Paused'
    : onBreak
      ? breakSec <= 0 ? "Break's over" : `${longBreak ? 'Long' : 'Short'} break · away from the desk`
      : pomo
        ? `Focus ${pomo.done + 1} · ${Math.floor(spentSec / 60)} of ${planned} min on this task`
        : over ? `over ${planned} min — tick it when you're done` : `of ${planned} min`

  return (
    <Page
      centered
      surface="vt-run bg-bg"
      top={
        <div className="flex h-14 items-center justify-between px-2">
          <button
            type="button"
            onClick={() => transition(cancelRun, 'close')}
            className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-fg"
            aria-label={saves ? 'End session' : 'Stop without saving'}
            title={saves ? 'End session (your progress is saved)' : 'Stop without saving'}
          >
            <X className="size-icon-xl" />
          </button>
          <button type="button" onClick={() => setSheet('timer')} className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-callout text-muted hover:bg-surface hover:text-fg" aria-label="Timer settings">
            <Timer className="size-icon-md" aria-hidden />
            {prefs.mode === 'pomodoro' ? 'Pomodoro' : 'Timer'}
          </button>
        </div>
      }
      footer={
        onBreak ? (
          <Button onClick={endBreak}>{breakSec <= 0 ? 'Back to it' : 'Skip break'}</Button>
        ) : (
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" className="min-w-32 flex-1" onClick={isPaused ? resume : pause} title="Space">{isPaused ? 'Resume' : 'Pause'}</Button>
            <Button className="min-w-32 flex-2" onClick={() => (nextTask ? tickTask() : transition(tickTask, 'up'))}>
              {nextTask ? 'Done · next' : 'Finish'}
            </Button>
          </div>
        )
      }
    >
      <div className="flex min-h-stage flex-col justify-center text-center">
        <div key={onBreak ? 'break' : task.id} className="anim-rise">
          <div className="flex justify-center gap-2">
            {onBreak ? <Tag tone="accent">Break</Tag> : <>
              {task.kind === 'fix' && <Tag tone="accent">Fix</Tag>}
              {goal && <Tag>{goal}</Tag>}
            </>}
          </div>
          <h1 className="mt-3 text-title-2 leading-snug font-semibold tracking-tight text-balance">
            {onBreak ? 'Stand up, drink some water' : task.title}
          </h1>
          {onBreak ? <p className="mt-1 text-body-sm text-muted">Then: {task.title}</p>
            : task.steps ? (
              <ul className="mx-auto mt-3 max-w-action space-y-1 text-body-sm leading-snug text-muted">
                {task.steps.map((line) => <li key={line}>{line}</li>)}
              </ul>
            ) : task.detail && <p className="mt-1 text-body-sm text-muted">{task.detail}</p>}
        </div>

        <p
          className={`tnum mt-12 text-timer leading-none font-light tracking-display transition-opacity ${isPaused ? 'opacity-40' : ''}`}
          aria-live="off"
          role="timer"
        >
          {clock(Math.abs(left))}
        </p>
        <p className="mt-3 text-callout text-muted">{sub}</p>
        <div className="mx-auto mt-6 w-40">
          <ProgressBar value={Math.min(1, Math.max(0, 1 - left / span))} label={onBreak ? 'Break' : 'Time used'} />
        </div>

        {!onBreak && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Pill onClick={() => addTime(5)} aria-label="Add 5 minutes to this task">
              <Plus className="me-1 size-icon-sm" aria-hidden />5 min
            </Pill>
            <Pill onClick={() => setSheet('session')} aria-label={`Session tasks, ${ticked} of ${queue.length} done`}>
              <ListChecks className="me-1.5 size-icon-sm" aria-hidden />
              <span className="tnum">Tasks · {ticked} of {queue.length}</span>
            </Pill>
          </div>
        )}
        {!onBreak && nextTask && (
          <button type="button" onClick={() => setSheet('session')} className="mx-auto mt-4 max-w-action truncate rounded-full px-3 py-1 text-subhead text-muted hover:text-fg">
            Up next: {nextTask.title}
          </button>
        )}
      </div>

      {sheet === 'session' && <SessionSheet run={running} now={now} onClose={() => setSheet(null)} />}
      {sheet === 'timer' && <TimerSheet prefs={prefs} onClose={() => setSheet(null)} />}
    </Page>
  )
}

/** The session at a glance: ticked (when, how long), now, next, and what else is on today. */
function SessionSheet({ run, now, onClose }: { run: Run; now: number; onClose: () => void }) {
  const { todayTasks, switchTo, tickOne, dropFromSession, addToSession, cancelRun } = useDemo()
  const api = useRef<{ close: () => void } | null>(null)
  const queue = queueOf(run)
  const byId = (id: string) => todayTasks.find((t) => t.id === id)
  const lap = (id: string) => run.laps?.find((l) => l.taskId === id)
  const others = todayTasks.filter((t) => t.status === 'pending' && !queue.includes(t.id))
  const saves = savesSomething(run, now)
  const row = 'flex min-h-14 items-center gap-3 py-2'
  const circle = 'flex size-7 shrink-0 items-center justify-center rounded-full border-control transition-colors'

  return (
    <Sheet title="This session" onClose={onClose} api={api}>
      <ul className="divide-y divide-line pt-2" aria-label="Session tasks">
        {queue.map((id) => {
          const t = byId(id)
          if (!t) return null
          const done = isTicked(run, id)
          const current = id === run.taskId && !done
          const l = lap(id)
          const meta = done && l
            ? `Ticked ${hhmm(l.at)} · ${lapMinutes(l.ms, t.minutes)} min`
            : current ? `Now · ${Math.floor(taskMs(run, now) / 60_000)} of ${t.minutes + (run.extra?.[id] ?? 0)} min` : `${t.minutes} min`
          return (
            <li key={id} className={`${row} anim-fade`}>
              <button
                type="button"
                disabled={done}
                onClick={() => tickOne(id)}
                className={`${circle} ${done ? 'border-good bg-good text-bg' : current ? 'border-accent hover:bg-accent-soft' : 'border-faint hover:border-accent'}`}
                aria-label={done ? `${t.title}, done` : `Tick ${t.title}`}
              >
                {done ? <Check className="size-icon-xs" strokeWidth={3} /> : current && <span className="size-2.5 rounded-full bg-accent" />}
              </button>
              <span className="min-w-0 flex-1 text-start">
                <span className={`block truncate text-body leading-snug font-medium ${done ? 'text-muted line-through decoration-faint' : ''}`}>{t.title}</span>
                <span className={`tnum block text-footnote ${current ? 'text-accent' : 'text-muted'}`}>{meta}</span>
              </span>
              {!done && !current && (
                <>
                  <Pill onClick={() => { switchTo(id); api.current?.close() }}>Switch</Pill>
                  <button type="button" onClick={() => dropFromSession(id)} className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-fg" aria-label={`Leave ${t.title} for later`} title="Leave for later (stays on Today)">
                    <X className="size-icon-md" />
                  </button>
                </>
              )}
            </li>
          )
        })}
      </ul>

      {others.length > 0 && (
        <>
          <h3 className="mt-5 text-footnote font-semibold tracking-wide text-muted uppercase">Also today</h3>
          <ul className="divide-y divide-line" aria-label="Other tasks today">
            {others.map((t) => (
              <li key={t.id} className={row}>
                <span className="min-w-0 flex-1 text-start">
                  <span className="block truncate text-body leading-snug">{t.title}</span>
                  <span className="tnum block text-footnote text-muted">{t.minutes} min</span>
                </span>
                <Pill tone="accent" onClick={() => addToSession(t.id)} aria-label={`Add ${t.title} to this session`}>
                  <Plus className="me-1 size-icon-sm" aria-hidden />Add
                </Pill>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="pt-5 pb-2">
        <Button variant="secondary" onClick={() => transition(cancelRun, 'close')}>
          {saves ? 'End session · save progress' : 'Stop without saving'}
        </Button>
      </div>
    </Sheet>
  )
}

/** Timer or Pomodoro, and the Pomodoro lengths. Changes apply right away, also mid-session. */
function TimerSheet({ prefs, onClose }: { prefs: TimerPrefs; onClose: () => void }) {
  const setTimerPrefs = useDemo((s) => s.setTimerPrefs)
  const seg = (on: boolean) => `press flex min-h-11 flex-1 items-center justify-center rounded-full text-callout font-semibold transition-colors ${on ? 'bg-bg text-fg shadow-sm' : 'text-muted hover:text-fg'}`
  const min = (n: number) => `${n} min`
  const line = 'flex items-center justify-between gap-4 py-3'

  return (
    <Sheet title="Timer" onClose={onClose}>
      <div role="radiogroup" aria-label="Timer style" className="mt-3 flex gap-1 rounded-full bg-surface p-1">
        <button type="button" role="radio" aria-checked={prefs.mode === 'timer'} className={seg(prefs.mode === 'timer')} onClick={() => setTimerPrefs({ mode: 'timer' })}>Timer</button>
        <button type="button" role="radio" aria-checked={prefs.mode === 'pomodoro'} className={seg(prefs.mode === 'pomodoro')} onClick={() => setTimerPrefs({ mode: 'pomodoro' })}>Pomodoro</button>
      </div>
      <p className="mt-3 text-subhead text-muted">
        {prefs.mode === 'timer'
          ? 'Counts down each task’s planned minutes. Add time if it runs long.'
          : 'Focus periods with breaks in between. Breaks never count as study time.'}
      </p>

      {prefs.mode === 'pomodoro' && (
        <div className="anim-fade mt-2 divide-y divide-line">
          <div className={line}><span className="text-body">Focus</span><Stepper label="Focus length" value={prefs.focus} min={5} max={90} step={5} format={min} onChange={(focus) => setTimerPrefs({ focus })} /></div>
          <div className={line}><span className="text-body">Short break</span><Stepper label="Short break length" value={prefs.short} min={1} max={30} format={min} onChange={(short) => setTimerPrefs({ short })} /></div>
          <div className={line}><span className="text-body">Long break</span><Stepper label="Long break length" value={prefs.long} min={5} max={60} step={5} format={min} onChange={(long) => setTimerPrefs({ long })} /></div>
          <div className={line}><span className="text-body">Long break every</span><Stepper label="Focus periods before a long break" value={prefs.every} min={2} max={8} format={(n) => `${n} focus`} onChange={(every) => setTimerPrefs({ every })} /></div>
          <label className={`${line} cursor-pointer`}>
            <span className="text-body">Start the next focus by itself</span>
            <input type="checkbox" className="size-5 accent-(--color-accent)" checked={prefs.autoFocus} onChange={(e) => setTimerPrefs({ autoFocus: e.target.checked })} />
          </label>
        </div>
      )}
    </Sheet>
  )
}
