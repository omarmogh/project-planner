// A study session: the tasks the student chose on Today, run one after another by one timer.
// Pure helpers (no store, no clock of their own) so the timer maths is tested on its own.

import { EARLY_STOP_SHARE, KEEP_SESSION_MINUTES } from '../engine/config'

/** One task ticked off during a session: when, and how much timer time it took. */
export interface Lap { taskId: string; at: number; ms: number }

/** Timer or Pomodoro, and the Pomodoro lengths. Defaults are the classic 25 / 5 / 15, long break every 4. */
export interface TimerPrefs {
  mode: 'timer' | 'pomodoro'
  focus: number
  short: number
  long: number
  every: number
  /** Start the next focus by itself when a break ends. Off: the student taps "Back to it". */
  autoFocus: boolean
}
export const DEFAULT_TIMER: TimerPrefs = { mode: 'timer', focus: 25, short: 5, long: 15, every: 4, autoFocus: false }

export interface Pomo {
  phase: 'focus' | 'break'
  /** Worked ms when this focus started. */
  focusStart: number
  /** Wall clock when the break started, and its length. */
  breakStart?: number
  breakMin?: number
  /** Focus periods finished so far. */
  done: number
}

export interface Running {
  /** The task the timer is on now. */
  taskId: string
  startedAt: number
  pausedAt: number | null
  pausedMs: number
  /** The session's tasks in order (the current one included). Missing on older saves: a one-task session. */
  queue?: string[]
  laps?: Lap[]
  /** Worked ms when the current task got the timer. */
  segStart?: number
  /** Timer ms each task got before the student switched away from it. */
  spent?: Record<string, number>
  /** Minutes added to a task ("+5 min"). */
  extra?: Record<string, number>
  pomo?: Pomo
}

/** Timer time that counts: wall time minus pauses and breaks. */
export const worked = (r: Running, now: number) => (r.pausedAt ?? now) - r.startedAt - r.pausedMs

/** Timer ms the current task has had so far, including earlier stretches before a switch. */
export const taskMs = (r: Running, now: number) => (r.spent?.[r.taskId] ?? 0) + worked(r, now) - (r.segStart ?? 0)

/** Under a minute on the timer = it was done some other way: the planned minutes count (as before). */
export const lapMinutes = (ms: number, planned: number) => (ms < 60_000 ? planned : Math.max(1, Math.round(ms / 60_000)))

export const queueOf = (r: Running) => r.queue ?? [r.taskId]
export const isTicked = (r: Running, id: string) => (r.laps ?? []).some((l) => l.taskId === id)
/** Session tasks not ticked yet, the current one included. */
export const openIds = (r: Running) => queueOf(r).filter((id) => !isTicked(r, id))

export function startRun(ids: string[], now: number, prefs: TimerPrefs): Running {
  return {
    taskId: ids[0], startedAt: now, pausedAt: null, pausedMs: 0, queue: ids, laps: [], segStart: 0, spent: {}, extra: {},
    ...(prefs.mode === 'pomodoro' ? { pomo: { phase: 'focus' as const, focusStart: 0, done: 0 } } : {}),
  }
}

/** Move the timer to another task of the session; the time so far stays with the one being left. */
export function switchTask(r: Running, id: string, now: number): Running {
  if (id === r.taskId || !queueOf(r).includes(id) || isTicked(r, id)) return r
  const w = worked(r, now)
  return { ...r, taskId: id, segStart: w, spent: { ...r.spent, [r.taskId]: taskMs(r, now) } }
}

/** Tick the current task. The timer moves to the next open one; `next` is null when nothing is left. */
export function tickCurrent(r: Running, now: number): { run: Running; next: string | null } {
  const lap: Lap = { taskId: r.taskId, at: now, ms: taskMs(r, now) }
  const laps = [...(r.laps ?? []), lap]
  const ticked = new Set(laps.map((l) => l.taskId))
  const q = queueOf(r)
  const i = q.indexOf(r.taskId)
  // The next open task after this one, else the first open one before it.
  const next = [...q.slice(i + 1), ...q.slice(0, i)].find((id) => !ticked.has(id)) ?? null
  const spent = { ...r.spent }
  delete spent[r.taskId]
  return { run: { ...r, laps, taskId: next ?? r.taskId, segStart: worked(r, now), spent }, next }
}

/** Tick a session task that isn't the current one (done some other way). It keeps the timer time it already had. */
export function tickOther(r: Running, id: string, now: number): Running {
  if (id === r.taskId || !queueOf(r).includes(id) || isTicked(r, id)) return r
  const spent = { ...r.spent }
  const ms = spent[id] ?? 0
  delete spent[id]
  return { ...r, laps: [...(r.laps ?? []), { taskId: id, at: now, ms }], spent }
}

export function addToQueue(r: Running, id: string): Running {
  return queueOf(r).includes(id) ? r : { ...r, queue: [...queueOf(r), id] }
}
/** Take an open task (not the current one) out of the session. It stays on Today. */
export function dropFromQueue(r: Running, id: string): Running {
  if (id === r.taskId || isTicked(r, id)) return r
  return { ...r, queue: queueOf(r).filter((x) => x !== id) }
}
export const addTime = (r: Running, id: string, min: number): Running => ({ ...r, extra: { ...r.extra, [id]: (r.extra?.[id] ?? 0) + min } })

export const pauseRun = (r: Running, now: number): Running => (r.pausedAt ? r : { ...r, pausedAt: now })
export const resumeRun = (r: Running, now: number): Running =>
  r.pausedAt ? { ...r, pausedMs: r.pausedMs + now - r.pausedAt, pausedAt: null } : r

/** Pomodoro: the focus period is over. The task clock stops (a break never counts as study time). */
export function beginBreak(r: Running, now: number, prefs: TimerPrefs): Running {
  if (!r.pomo || r.pomo.phase === 'break') return r
  const done = r.pomo.done + 1
  const breakMin = done % Math.max(1, prefs.every) === 0 ? prefs.long : prefs.short
  return { ...pauseRun(r, now), pomo: { ...r.pomo, phase: 'break', done, breakStart: now, breakMin } }
}
/** Back from a break (or skipped it): a new focus period starts now. */
export function endBreak(r: Running, now: number): Running {
  if (!r.pomo || r.pomo.phase !== 'break') return r
  const back = resumeRun(r, now)
  return { ...back, pomo: { phase: 'focus', focusStart: worked(back, now), done: r.pomo.done } }
}

/** Seconds left in the current focus period (negative = over), or in the break. */
export function focusLeft(r: Running, now: number, prefs: TimerPrefs): number {
  if (!r.pomo) return 0
  return prefs.focus * 60 - (worked(r, now) - r.pomo.focusStart) / 1000
}
export function breakLeft(r: Running, now: number): number {
  if (!r.pomo || r.pomo.phase !== 'break') return 0
  return (r.pomo.breakMin ?? 0) * 60 - (now - (r.pomo.breakStart ?? now)) / 1000
}

/**
 * One report to make after a session. `ticked`: the student ticked it. `early`: ticked well before its
 * planned time, so the report asks how far they got instead of assuming it is done. Unticked tasks with
 * real timer time (`KEEP_SESSION_MINUTES` or more) are reported too, with the full question.
 */
export interface SessionReport { taskId: string; minutes: number; ticked: boolean; early?: boolean }

/** Planned minutes of a session task, with any "+5 min". */
const plannedOf = (r: Running, id: string, minutes: number) => minutes + (r.extra?.[id] ?? 0)

export function lapReport(r: Running, l: Lap, planned: number): SessionReport {
  const p = plannedOf(r, l.taskId, planned)
  const timed = l.ms >= 60_000
  return { taskId: l.taskId, minutes: lapMinutes(l.ms, planned), ticked: true, ...(timed && l.ms < p * 60_000 * EARLY_STOP_SHARE ? { early: true } : {}) }
}

/** Timer ms an unticked session task has had (the current one up to now). */
export const openMs = (r: Running, id: string, now: number) => (id === r.taskId ? taskMs(r, now) : r.spent?.[id] ?? 0)

/**
 * What ending the session now reports: the ticked tasks in tick order, then the unticked ones that got
 * real time, in session order. `minutesOf` gives a task's planned minutes (undefined = no longer on Today).
 */
export function sessionReports(r: Running, now: number, minutesOf: (id: string) => number | undefined): SessionReport[] {
  const ticked = (r.laps ?? []).flatMap((l) => {
    const m = minutesOf(l.taskId)
    return m === undefined ? [] : [lapReport(r, l, m)]
  })
  const open = openIds(r).flatMap((id) => {
    const ms = openMs(r, id, now)
    return minutesOf(id) === undefined || ms < KEEP_SESSION_MINUTES * 60_000 ? [] : [{ taskId: id, minutes: Math.round(ms / 60_000), ticked: false }]
  })
  return [...ticked, ...open]
}

/** Ending now would save something (a tick, or real time on a task). */
export const savesSomething = (r: Running, now: number) =>
  (r.laps?.length ?? 0) > 0 || openIds(r).some((id) => openMs(r, id, now) >= KEEP_SESSION_MINUTES * 60_000)
