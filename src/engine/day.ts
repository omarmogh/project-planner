// The day's edges: what happens when a study day starts and ends, and "Do more".
// Pure. See docs/ENGINE_SPEC.md sections 2 and 3.

import { DO_MORE_MINUTES } from './config'
import { addDays } from './dates'
import { activeGoals, lastSitting, studies } from './exams'
import { statedMinutes } from './availability'
import { commitmentDay } from './commitments'
import { lightDayOffer, taskImpact, type LightDayOffer } from './lightday'
import { projectedExamDate } from './pace'
import { buildDay, type DayPlan } from './plan'
import { retireGoals } from './planEdits'
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
  if (over.size > 0) next = { ...next, scheduled: next.scheduled.filter((t) => !(over.has(t.goalId) && t.status === 'pending')) }
  // After its rest day a passed uni exam moves to the past (planEdits.ts).
  return retireGoals(next, today)
}

/**
 * A study day ends: every task never answered counts as "didn't get to it". Nothing is lost
 * (its work is still in the state, so the next plan picks it up) and nothing is marked as failed.
 */
export function endDay(s: EngineState, tasks: Task[], today: ISODate): EngineState {
  // A day with nothing planned is a day off, never a missed day.
  if (tasks.length === 0) return (s.daysOff ?? []).includes(today) ? s : { ...s, daysOff: [...(s.daysOff ?? []), today] }
  const missed: TaskOutcome[] = tasks.filter((t) => t.status === 'pending' && !t.extra).map((t) => ({ date: today, taskId: t.id, result: 'skipped', auto: true }))
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
  const more = buildDay(after, today, { roomMinutes: DO_MORE_MINUTES, ignoreLight: true })
  if (more.type !== 'normal') return null
  const next = more.tasks.find((t) => !t.commitmentId && !(t.kind === 'anki' && kinds.has('anki')))
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

export type WhatsNextReason = 'rotationEnded' | 'noExam'

/**
 * Today asks "What's next?" instead of showing an empty "on track" day:
 * 'rotationEnded' = the rotation or block is over and its exams are done;
 * 'noExam' = no exam ahead at all (nothing to plan for).
 */
export function whatsNext(s: EngineState, today: ISODate): { reason: WhatsNextReason } | null {
  if (rotationEnded(s, today)) return { reason: 'rotationEnded' }
  if (!activeGoals(s.goals, today).some((g) => studies(g, today))) return { reason: 'noExam' }
  return null
}

/** Today's light-day offer, if any: only on a day that actually has study planned. */
export function todayOffer(s: EngineState, today: ISODate): LightDayOffer | null {
  const offer = lightDayOffer(s, today)
  if (!offer) return null
  return buildDay(s, today, { ignoreLight: true }).tasks.some((t) => !t.commitmentId) ? offer : null
}

/** Minutes of study (not deadline work) already started or done in today's list. */
export function spentMinutes(tasks: Task[]): number {
  return tasks.filter((t) => t.status !== 'pending' && !t.commitmentId).reduce((n, t) => n + t.minutes, 0)
}

/**
 * Keep today's list inside the day (spec invariant: the plan never exceeds the stated time).
 * Room = stated time − busy time − deadline work. Pending study tasks are dropped, lowest
 * impact first (Anki last), until started/done study plus pending study fits the room.
 * Deadline work and tasks already touched are never dropped.
 */
export function fitToday(s: EngineState, tasks: Task[], today: ISODate): Task[] {
  const cday = commitmentDay(s, today)
  const deadline = tasks.filter((t) => t.commitmentId).reduce((n, t) => n + t.minutes, 0)
  const room = Math.max(0, statedMinutes(s.availability, today) - cday.busy - deadline)
  let used = tasks.filter((t) => !t.commitmentId).reduce((n, t) => n + t.minutes, 0)
  if (used <= room) return tasks
  const drop = new Set<string>()
  const candidates = tasks.filter((t) => t.status === 'pending' && !t.commitmentId).sort((a, b) => taskImpact(s, b) - taskImpact(s, a))
  for (const t of candidates) {
    if (used <= room) break
    drop.add(t.id)
    used -= t.minutes
  }
  return tasks.filter((t) => !drop.has(t.id))
}

/**
 * Commitments changed mid-day: re-plan what's left of today. Tasks already started or done
 * stay, and their minutes come out of the room so the day isn't planned twice.
 * `light` keeps a light day (or first night) light: only the deadline work is refreshed.
 */
export function replanToday(s: EngineState, tasks: Task[], today: ISODate, light: boolean): { day: DayPlan | null; tasks: Task[] } {
  const touched = tasks.filter((t) => t.status !== 'pending')
  const fresh = (list: Task[], keep: Task[]) => list.filter((t) => !keep.some((k) => k.id === t.id))
  if (light) {
    const keep = tasks.filter((t) => t.status !== 'pending' || !t.commitmentId)
    return { day: null, tasks: fitToday(s, [...keep, ...fresh(commitmentDay(s, today).tasks, keep)], today) }
  }
  const day = buildDay(s, today, { spentMinutes: spentMinutes(tasks) })
  return { day, tasks: fitToday(s, [...touched, ...fresh(day.tasks, touched)], today) }
}
