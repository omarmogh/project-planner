// Commitments: things the student has to do. Not a to-do list: they exist only to take
// time from the plan, which adapts around them. Pure: no React, no store, no Date.now().
//
// Busy time ("Lecture 10–12", "Gym 6pm 1h") reduces that day's study time.
// Deadline work ("Seminar on DKA Thursday 3h") is split across the days before the deadline.
// Commitments always come first; due retests and fixes are never dropped for them.

import { statedMinutes } from './availability'
import { dayType } from './exams'
import { DAY_ENDS_HOUR, DAYTIME_BUSY_SHARE, DEADLINE_BUFFER_DAYS, DEADLINE_MIN_CHUNK, ROOM_UNTIL, SHIFT_WORDS, STUDY_WINDOW_LEARN_MIN, STUDY_WINDOW_LEARN_SHARE, STUDY_WINDOWS, TOPIC_LINK_DAYS, UNTIMED_BUSY_SHARE, WAKE_MINUTES } from './config'
import { addDays, daysBetween, weekday } from './dates'
import { dayName } from './reasons'
import type { Commitment, EngineState, ISODate, StudyWindow, Task } from './types'

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

/** Whether a busy item covers a day: its date (to `until` for a span), or its weekdays from its first day to `until`. */
export function coversDay(c: Commitment, date: ISODate): boolean {
  if (date < c.date || (c.until && date > c.until)) return false
  return c.repeat?.length ? c.repeat.includes(weekday(date)) : date <= (c.until ?? c.date)
}

/** Busy items on a day: one-off ones on their dates, repeating ones on their weekdays from their first day on. */
export function busyOn(commitments: Commitment[] | undefined, date: ISODate): Commitment[] {
  return (commitments ?? []).filter((c) => c.kind === 'busy' && !c.done && coversDay(c, date))
}

/** A busy item that isn't the student's normal week: once, a span of days, or a repeat that ends. */
export const isOneOff = (c: Commitment) => !c.repeat?.length || !!c.until

/** What busy time needs to know about the student: when they study, and the rotation (for shifts). */
export interface BusyContext {
  window?: StudyWindow
  /** The rotation's last day: a daytime hospital shift on or before it counts 0. */
  rotationUntil?: ISODate
  /** The day the item falls on (repeating items). Defaults to the item's own date. */
  date?: ISODate
}

/** A hospital shift ("Ward 8–2", "Duty", "مناوبة"): the student's hours are already "after hospital". */
export const isShift = (c: Pick<Commitment, 'title'>) => SHIFT_WORDS.test(c.title)

/** One busy item split into what it costs outside the study window and the stretch it covers inside it. */
function busyParts(c: Commitment, ctx: BusyContext): { outside: number; inside: [number, number] | null } {
  const len = busyMinutes(c)
  const date = ctx.date ?? c.date
  const shift = isShift(c) && !!ctx.rotationUntil && date <= ctx.rotationUntil
  const w = STUDY_WINDOWS[ctx.window ?? 'evening']
  // The whole day (a funeral, a trip, sick): no study time that day.
  if (c.allDay) return { outside: 0, inside: [w.from, w.to] }
  if (!c.from) {
    // No clock time: we can't tell when it is. The waking hours outside the study window take it first,
    // at UNTIMED_BUSY_SHARE; whatever doesn't fit there ("Tutoring 12h") must fall in the study window.
    const outsideRoom = Math.max(0, ROOM_UNTIL - WAKE_MINUTES - Math.max(0, Math.min(w.to, ROOM_UNTIL) - Math.max(w.from, WAKE_MINUTES)))
    if (len <= outsideRoom) return { outside: shift ? 0 : len * UNTIMED_BUSY_SHARE, inside: null }
    const spill = Math.min(w.to - w.from, len - outsideRoom)
    return { outside: outsideRoom * (shift ? 0 : UNTIMED_BUSY_SHARE), inside: [w.from, w.from + spill] }
  }
  // 01:00 is late in the study day, not early: times before the day's end count as after midnight.
  const start = clockMinutes(c.from)
  const from = start < DAY_ENDS_HOUR * 60 ? start + 24 * 60 : start
  const to = from + len
  const a = Math.max(from, w.from)
  const b = Math.min(to, w.to)
  const inside = Math.max(0, b - a)
  return { outside: (len - inside) * (shift ? 0 : DAYTIME_BUSY_SHARE), inside: inside > 0 ? [a, b] : null }
}

/**
 * The most one busy item can take from the day's study time (when the window has no room left around it).
 * Inside the student's study window (default the evening, STUDY_WINDOW) it counts in full; outside it at
 * DAYTIME_BUSY_SHARE. A hospital shift on a rotation day counts 0 outside the window (no double count).
 * No clock time → UNTIMED_BUSY_SHARE (we can't tell day from evening); an untimed shift on a rotation day → 0.
 */
export function busyCost(c: Commitment, ctx: BusyContext = {}): number {
  const { outside, inside } = busyParts(c, ctx)
  return outside + (inside ? inside[1] - inside[0] : 0)
}

/**
 * How much busy time takes from a day of `cap` minutes. Rounded to 5, never more than the day.
 * Busy time inside the study window only cuts the plan when the free part of the window
 * (to ROOM_UNTIL) is shorter than the plan; otherwise it costs DAYTIME_BUSY_SHARE of its length (energy).
 * Duty 18–22 for a late studier with a 2 h plan → 30 min, not the whole evening.
 */
export function busyReduction(commitments: Commitment[] | undefined, date: ISODate, cap: number, ctx: BusyContext = {}): number {
  const w = STUDY_WINDOWS[ctx.window ?? 'evening']
  const usableTo = Math.min(w.to, ROOM_UNTIL)
  let outside = 0
  const spans: [number, number][] = []
  for (const c of busyOn(commitments, date)) {
    const p = busyParts(c, { ...ctx, date })
    outside += p.outside
    if (p.inside) spans.push(p.inside)
  }
  // Merge overlapping stretches so two items at the same time aren't counted twice.
  spans.sort((x, y) => x[0] - y[0])
  let inside = 0
  let usedUsable = 0
  let end = -Infinity
  for (const [a0, b] of spans) {
    const a = Math.max(a0, end)
    if (b <= a) continue
    inside += b - a
    usedUsable += Math.max(0, Math.min(b, usableTo) - a)
    end = b
  }
  const room = Math.max(0, usableTo - w.from - usedUsable)
  const insideCost = Math.min(inside, Math.max(cap - room, inside * DAYTIME_BUSY_SHARE))
  return Math.min(cap, roundTo5(outside + insideCost))
}

/** The busy context for a state: its study window and rotation. */
export const busyContext = (s: Pick<EngineState, 'availability' | 'rotation'>): BusyContext => ({
  window: s.availability.studyWindow,
  rotationUntil: s.rotation?.until,
})

/**
 * Learn when the student studies from the clock times (minutes after midnight, local) their timer started.
 * Null until STUDY_WINDOW_LEARN_MIN starts; then the window holding STUDY_WINDOW_LEARN_SHARE of them
 * (early, late, else evening), or 'mixed'.
 */
export function learnStudyWindow(startMinutes: number[]): StudyWindow | null {
  if (startMinutes.length < STUDY_WINDOW_LEARN_MIN) return null
  const day = startMinutes.map((m) => (m < DAY_ENDS_HOUR * 60 ? m + 24 * 60 : m))
  const share = (w: { from: number; to: number }) => day.filter((m) => m >= w.from && m < w.to).length / day.length
  for (const key of ['early', 'late', 'evening'] as const) if (share(STUDY_WINDOWS[key]) >= STUDY_WINDOW_LEARN_SHARE) return key
  return 'mixed'
}

/** Study minutes left on a day after busy time. */
export function capacity(s: EngineState, date: ISODate): number {
  const base = statedMinutes(s.availability, date)
  return base - busyReduction(s.commitments, date, base, busyContext(s))
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
 * - Aims to finish DEADLINE_BUFFER_DAYS before (a day early) when that fits and leaves more than today,
 *   else the day before. Due today or tomorrow → today.
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
    let rest = ceilTo5(remainingMinutes(c))
    const fallback = c.date > from ? addDays(c.date, -1) : from
    const early = addDays(c.date, -DEADLINE_BUFFER_DAYS)
    const total = (to: ISODate) => days(from, to).reduce((n, d) => n + Math.max(0, floorTo5(room(d))), 0)
    // Finishing early never means "all of it today": when the buffer leaves only today and later days exist, use them.
    const last = early > from && total(early) >= rest ? early : fallback
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
  const busy = busyReduction(s.commitments, date, base, busyContext(s))
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
