// Commitments: things the student has to do. Not a to-do list: they exist only to take
// time from the plan, which adapts around them. Pure: no React, no store, no Date.now().
//
// Busy time ("Lecture 10–12", "Gym 6pm 1h") reduces that day's study time.
// Deadline work ("Seminar on DKA Thursday 3h") is split across the days before the deadline.
// Commitments always come first; due retests and fixes are never dropped for them.

import { statedMinutes } from './availability'
import { dayType } from './exams'
import { DAY_ENDS_HOUR, DAYTIME_BUSY_SHARE, DEADLINE_BUFFER_DAYS, DEADLINE_MIN_CHUNK, STUDY_WINDOW, TOPIC_LINK_DAYS } from './config'
import { addDays, daysBetween } from './dates'
import { dayName } from './reasons'
import type { Commitment, EngineState, ISODate, Task } from './types'

const ceilTo5 = (n: number) => Math.ceil(n / 5) * 5
const floorTo5 = (n: number) => Math.floor(n / 5) * 5
const roundTo5 = (n: number) => Math.round(n / 5) * 5

/** 'HH:MM' → minutes after midnight. */
export function clockMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + (m || 0)
}

/** Length of busy time: from its clock times, else its minutes. */
export function busyMinutes(c: Commitment): number {
  if (c.from && c.to) {
    const d = clockMinutes(c.to) - clockMinutes(c.from)
    return d > 0 ? d : d + 24 * 60
  }
  return c.minutes ?? 0
}

/** Busy items on a day. */
export function busyOn(commitments: Commitment[] | undefined, date: ISODate): Commitment[] {
  return (commitments ?? []).filter((c) => c.kind === 'busy' && !c.done && c.date === date)
}

/**
 * Minutes one busy item takes from the day's study time.
 * Inside STUDY_WINDOW (the evening) it counts in full; daytime counts at DAYTIME_BUSY_SHARE.
 * No clock time → in full (we can't tell, so we don't over-promise time).
 */
export function busyCost(c: Commitment): number {
  const len = busyMinutes(c)
  if (!c.from) return len
  // 01:00 is late in the study day, not early: times before the day's end count as after midnight.
  const start = clockMinutes(c.from)
  const from = start < DAY_ENDS_HOUR * 60 ? start + 24 * 60 : start
  const to = from + len
  const inside = Math.max(0, Math.min(to, STUDY_WINDOW.to) - Math.max(from, STUDY_WINDOW.from))
  return inside + (len - inside) * DAYTIME_BUSY_SHARE
}

/** How much busy time takes from a day of `cap` minutes. Rounded to 5, never more than the day. */
export function busyReduction(commitments: Commitment[] | undefined, date: ISODate, cap: number): number {
  const total = busyOn(commitments, date).reduce((n, c) => n + busyCost(c), 0)
  return Math.min(cap, roundTo5(total))
}

/** Study minutes left on a day after busy time. */
export function capacity(s: EngineState, date: ISODate): number {
  const base = statedMinutes(s.availability, date)
  return base - busyReduction(s.commitments, date, base)
}

/** Room for deadline work: none on exam days, rest days and exam eves (work lands there only when nothing else is left). */
function deadlineRoom(s: EngineState, date: ISODate): number {
  return dayType(s.goals, date) === 'normal' ? capacity(s, date) : 0
}

/** Deadline work still to do, soonest deadline first. Past deadlines drop out. */
export function openDeadlines(commitments: Commitment[] | undefined, from: ISODate): Commitment[] {
  return (commitments ?? [])
    .filter((c) => c.kind === 'deadline' && !c.done && c.date >= from && remainingMinutes(c) > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function remainingMinutes(c: Commitment): number {
  return Math.max(0, (c.minutes ?? 0) - (c.doneMinutes ?? 0))
}

export interface Chunk {
  commitmentId: string
  date: ISODate
  minutes: number
}

export interface DeadlinePlan {
  chunks: Chunk[]
  /** Deadlines whose work doesn't fit the days before them; their chunks are bigger than the days allow. */
  overloaded: string[]
}

function days(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

/**
 * Splits each deadline's remaining work across the days from `from` until before its deadline.
 * - Aims to finish DEADLINE_BUFFER_DAYS before (a day early) when that fits, else the day before.
 *   Due today → today.
 * - Even chunks, never under DEADLINE_MIN_CHUNK; a day with less room than that is skipped.
 * - Each day's room is its study time after busy time and earlier deadlines' chunks.
 * - Work that still doesn't fit is placed anyway (it has to be done) and the deadline is flagged.
 */
export function deadlinePlan(s: EngineState, from: ISODate): DeadlinePlan {
  const used = new Map<ISODate, number>()
  const room = (d: ISODate) => deadlineRoom(s, d) - (used.get(d) ?? 0)
  const chunks: Chunk[] = []
  const overloaded: string[] = []

  for (const c of openDeadlines(s.commitments, from)) {
    let rest = remainingMinutes(c)
    const fallback = c.date > from ? addDays(c.date, -1) : from
    const early = addDays(c.date, -DEADLINE_BUFFER_DAYS)
    const total = (to: ISODate) => days(from, to).reduce((n, d) => n + Math.max(0, floorTo5(room(d))), 0)
    const last = early >= from && total(early) >= rest ? early : fallback
    const span = days(from, last)
    const target = Math.max(DEADLINE_MIN_CHUNK, ceilTo5(rest / span.length))
    const mine: Chunk[] = []

    for (const d of span) {
      if (rest <= 0) break
      const r = Math.max(0, floorTo5(room(d)))
      let m = Math.min(target, rest, r)
      // Never leave a crumb under the minimum for later: take it now if the day allows.
      if (rest - m > 0 && rest - m < DEADLINE_MIN_CHUNK && rest <= r) m = rest
      if (m < DEADLINE_MIN_CHUNK && m < rest) continue
      if (m <= 0) continue
      mine.push({ commitmentId: c.id, date: d, minutes: m })
      rest -= m
    }

    if (rest > 0) {
      // Doesn't fit: spread the rest over the days it already has (or the last day), and say so.
      overloaded.push(c.id)
      const calm = [...span].reverse().find((d) => dayType(s.goals, d) === 'normal') ?? last
      const over = mine.length > 0 ? mine : [{ commitmentId: c.id, date: calm, minutes: 0 }]
      if (mine.length === 0) mine.push(over[0])
      const each = ceilTo5(rest / over.length)
      for (const x of over) {
        const add = Math.min(each, rest)
        x.minutes += add
        rest -= add
      }
    }
    for (const x of mine) used.set(x.date, (used.get(x.date) ?? 0) + x.minutes)
    chunks.push(...mine)
  }
  return { chunks, overloaded }
}

/** "3 h", "1 h 30", "45 min". Engine-side, for task details. */
function hours(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`
}

/** A day's chunk of deadline work as a normal task, with the commitment's tag. */
export function chunkTask(c: Commitment, chunk: Chunk, date: ISODate, overloaded: boolean): Task {
  const left = remainingMinutes(c)
  return {
    id: `${date}-c-${c.id}`,
    date,
    kind: 'study',
    goalId: '',
    commitmentId: c.id,
    tag: c.tag,
    topicIds: c.topicId ? [c.topicId] : undefined,
    title: c.title,
    detail: left > chunk.minutes ? `${hours(left - chunk.minutes)} left after this` : 'Finishes it',
    reason: overloaded ? `Due ${dayName(c.date, date)}: tight, so it comes first` : `Due ${dayName(c.date, date)}`,
    minutes: chunk.minutes,
    status: 'pending',
  }
}

/**
 * Topics linked to deadline work count as being studied: the plan doesn't schedule them
 * separately from when the commitment is added until TOPIC_LINK_DAYS after its deadline.
 */
export function linkedTopicIds(commitments: Commitment[] | undefined, date: ISODate): Set<string> {
  return new Set(
    (commitments ?? [])
      .filter((c) => c.kind === 'deadline' && c.topicId && date >= c.createdOn && daysBetween(c.date, date) <= TOPIC_LINK_DAYS)
      .map((c) => c.topicId!),
  )
}

/** What a day's commitments do to it: busy time, deadline tasks, and whether study had to move. */
export interface CommitmentDay {
  /** Minutes busy time takes from the day. */
  busy: number
  tasks: Task[]
  /** Deadline ids that don't fit before their deadline. */
  overloaded: string[]
}

export function commitmentDay(s: EngineState, date: ISODate): CommitmentDay {
  const base = statedMinutes(s.availability, date)
  const busy = busyReduction(s.commitments, date, base)
  const plan = deadlinePlan(s, date)
  const byId = new Map((s.commitments ?? []).map((c) => [c.id, c]))
  const tasks = plan.chunks
    .filter((x) => x.date === date)
    .map((x) => chunkTask(byId.get(x.commitmentId)!, x, date, plan.overloaded.includes(x.commitmentId)))
  return { busy, tasks, overloaded: plan.overloaded }
}

/** Deadline work done (or partly): its minutes count; once all of it is done, it's done. */
export function applyCommitmentWork(commitments: Commitment[] | undefined, id: string, minutes: number): Commitment[] {
  return (commitments ?? []).map((c) => {
    if (c.id !== id) return c
    const doneMinutes = (c.doneMinutes ?? 0) + minutes
    return { ...c, doneMinutes, done: doneMinutes >= (c.minutes ?? 0) }
  })
}

/** Deadlines still coming that have no work today (all prepared, or no room): shown as "Coming up". */
export function comingUp(commitments: Commitment[] | undefined, today: ISODate, todayTasks: Task[]): Commitment[] {
  const onToday = new Set(todayTasks.map((t) => t.commitmentId).filter(Boolean))
  return (commitments ?? []).filter((c) => c.kind === 'deadline' && !c.done && c.date >= today && !onToday.has(c.id))
}
