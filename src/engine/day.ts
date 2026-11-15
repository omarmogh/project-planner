// The day's edges: what happens when a study day starts and ends, and "Do more".
// Pure. See docs/ENGINE_SPEC.md sections 2 and 3.

import { DO_MORE_MINUTES } from './config'
import { addDays } from './dates'
import { lastSitting } from './exams'
import { projectedExamDate } from './pace'
import { buildDay } from './plan'
import { assumeDone } from './progress'
import type { EngineState, ISODate, Task, TaskOutcome } from './types'

/**
 * A study day starts:
 * - "no idea" exam dates follow the current pace, so they never pass silently;
 * - a rough date that has passed becomes a projected one;
 * - fixes and retests of uni goals whose exam is over are dropped (board topics keep theirs).
 */
export function startDay(s: EngineState, today: ISODate): EngineState {
  let goals = s.goals.map((g) => (g.dateSource === 'rough' && g.examDate <= today ? { ...g, dateSource: 'projected' as const } : g))
  let next: EngineState = { ...s, goals }
  goals = goals.map((g) => (g.dateSource === 'projected' ? { ...g, examDate: projectedExamDate(next, g, today) } : g))
  next = { ...next, goals }
  const over = new Set(goals.filter((g) => g.kind === 'uni' && lastSitting(g) <= today).map((g) => g.id))
  if (over.size === 0) return next
  return { ...next, scheduled: next.scheduled.filter((t) => !(over.has(t.goalId) && t.status === 'pending')) }
}

/**
 * A study day ends: every task never answered counts as "didn't get to it". Nothing is lost
 * (its work is still in the state, so the next plan picks it up) and nothing is marked as failed.
 */
export function endDay(s: EngineState, tasks: Task[], today: ISODate): EngineState {
  const missed: TaskOutcome[] = tasks.filter((t) => t.status === 'pending' && !t.extra).map((t) => ({ date: today, taskId: t.id, result: 'skipped' }))
  if (missed.length === 0) return s
  return { ...s, outcomes: [...(s.outcomes ?? []), ...missed] }
}

/**
 * "Do more": the next task the plan would hold with more time, on the student's request.
 * Today's tasks are assumed done; a retest is never brought forward (buildDay only plans due ones).
 * Null when there's nothing more worth doing today (exam day, eve, rest day, or nothing left).
 */
export function doMore(s: EngineState, tasks: Task[], today: ISODate): Task | null {
  const have = new Set(tasks.map((t) => t.id))
  const kinds = new Set(tasks.map((t) => t.kind))
  const after = assumeDone(s, tasks, today)
  const more = buildDay(after, today, { extraMinutes: DO_MORE_MINUTES + tasks.reduce((n, t) => n + t.minutes, 0), ignoreLight: true })
  if (more.type !== 'normal') return null
  const next = more.tasks.find((t) => !t.commitmentId && !(t.kind === 'anki' && kinds.has('anki')) && !tasks.some((x) => x.kind === t.kind && x.kind !== 'study' && x.id === t.id))
  if (!next) return null
  let id = next.id
  for (let i = 2; have.has(id); i++) id = `${next.id}-more${i}`
  return { ...next, id, extra: true, reason: `Extra, your choice · ${next.reason}` }
}

/** Tomorrow's date, for callers that roll the day. */
export const nextDay = (d: ISODate) => addDays(d, 1)

/**
 * The rotation is over and nothing says what comes next: the app asks once, "What's next?"
 * (the next rotation and its end, or a break with its own hours). Until then the plan
 * continues with the remaining goals at the current hours.
 */
export function rotationEnded(s: EngineState, today: ISODate): boolean {
  if (!s.rotation || s.rotation.until >= today || s.nextAsked === s.rotation.until) return false
  return !s.goals.some((g) => g.kind === 'uni' && lastSitting(g) >= today)
}
