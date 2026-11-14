// What a task's completion answer does to the plan, and tomorrow's preview.
// Pure: (state, task, answer) → new state.

import { PARTLY_SHARE } from './config'
import { addDays } from './dates'
import { buildDay, type DayPlan } from './plan'
import { applyFixDone } from './retest'
import { estimates } from './estimates'
import { applyTopicCompletion } from './topics'
import type { Completion, EngineState, ISODate, Task } from './types'

const roundTo5 = (n: number) => Math.round(n / 5) * 5

/**
 * Apply Done / Partly / Didn't get to it.
 * - Topic task: the topic's items move on (see applyTopicCompletion).
 * - Slides: done = the lectures are done; partly = half of them; skipped = nothing.
 * - Fix: done = topic moves weak → fixing; partly = stays, tomorrow, with less time; skipped = tomorrow.
 * - Questions inside the task count toward the qbank (`questions` = what was really done; defaults to the plan).
 * Anything not done simply stays in the state, so the next plan picks it up.
 */
export function applyCompletion(s: EngineState, task: Task, result: Completion, today: ISODate, questions?: number): EngineState {
  const share = result === 'done' ? 1 : result === 'partly' ? PARTLY_SHARE : 0
  let next = s

  if (task.kind === 'fix') {
    if (result === 'done') {
      return {
        ...s,
        topics: applyFixDone(s.topics, task),
        scheduled: s.scheduled.map((t) => (t.id === task.id ? { ...t, status: 'done' } : t)),
      }
    }
    const minutes = result === 'partly' ? Math.max(10, roundTo5(task.minutes * (1 - PARTLY_SHARE))) : task.minutes
    return { ...s, scheduled: s.scheduled.map((t) => (t.id === task.id ? { ...t, date: addDays(today, 1), minutes } : t)) }
  }

  if (task.topicId) {
    const factor = estimates(s).topic
    next = { ...next, topics: next.topics.map((t) => (t.id === task.topicId ? applyTopicCompletion(t, task, result, factor) : t)) }
  }

  const r = s.resources.find((x) => x.id === task.resourceId)
  if (r && task.amount) {
    const units = r.type === 'qbank' ? questions ?? Math.round(task.amount * share) : task.amount * share
    if (units > 0) {
      next = {
        ...next,
        resources: next.resources.map((x) => (x.id === r.id ? { ...x, doneUnits: Math.min(x.totalUnits, x.doneUnits + units) } : x)),
      }
    }
  }
  return next
}

/** What a pending task does to the plan if it gets done, for the preview of tomorrow. */
function assume(s: EngineState, task: Task, today: ISODate): EngineState {
  if (task.kind === 'retest') return { ...s, scheduled: s.scheduled.map((t) => (t.id === task.id ? { ...t, status: 'done' } : t)) }
  if (task.kind === 'anki') {
    return s.anki ? { ...s, anki: { ...s.anki, newCardsLeft: Math.max(0, s.anki.newCardsLeft - (task.amount ?? 0)) } } : s
  }
  return applyCompletion(s, task, 'done', today)
}

/** Today's pending tasks, assumed done. Tasks answered Partly or Didn't get to it are already in the state. */
export function assumeDone(s: EngineState, tasks: Task[], today: ISODate): EngineState {
  return tasks.filter((t) => t.status === 'pending').reduce((acc, t) => assume(acc, t, today), s)
}

/** Tomorrow's plan, assuming today goes as planned. Re-plans by itself after Partly / Didn't get to it. */
export function previewTomorrow(s: EngineState, todayTasks: Task[], today: ISODate): DayPlan {
  return buildDay(assumeDone(s, todayTasks, today), addDays(today, 1))
}

/** A task's share of minutes that counts as studied. */
export function studiedMinutes(task: Task): number {
  return task.status === 'done' ? task.minutes : task.status === 'partly' ? Math.round(task.minutes * PARTLY_SHARE) : 0
}
