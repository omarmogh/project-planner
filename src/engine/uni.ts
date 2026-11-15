// Uni goals: lectures, summaries and past papers. Pure. See docs/ENGINE_SPEC.md section 4.2.
// Past papers are retrieval practice in the exam's format: spread over a window before the
// exam and denser near it, never all at the end.

import {
  LECTURE_MINUTES, LECTURES_MAX_PER_DAY, MIN_TASK_MINUTES, PAPER_MIN_PART, PAPERS_BACKLOAD, PAPERS_LARGE_LECTURES, PAPERS_LAST_BEFORE_EXAM_DAYS,
  PAPERS_SMALL_LECTURES, PAPERS_WINDOW_LARGE, PAPERS_WINDOW_SMALL, SUMMARY_SHARE,
} from './config'
import { addDays, daysBetween } from './dates'
import type { Goal, ISODate, Resource, Task } from './types'

const ceilTo5 = (n: number) => Math.ceil(n / 5) * 5
const floorTo5 = (n: number) => Math.floor(n / 5) * 5

/** Share of the prep time the papers are spread over: half for small material, a third for large. */
export function papersWindowShare(lectures: number, o: { small?: number; large?: number } = {}): number {
  const small = o.small ?? PAPERS_WINDOW_SMALL
  const large = o.large ?? PAPERS_WINDOW_LARGE
  if (lectures <= PAPERS_SMALL_LECTURES) return small
  if (lectures >= PAPERS_LARGE_LECTURES) return large
  return small + ((large - small) * (lectures - PAPERS_SMALL_LECTURES)) / (PAPERS_LARGE_LECTURES - PAPERS_SMALL_LECTURES)
}

/** The day paper k (1-based) of the resource is due. Later papers sit closer together. */
export function paperDueDate(r: Resource, examDate: ISODate, k: number): ISODate {
  const end = addDays(examDate, -PAPERS_LAST_BEFORE_EXAM_DAYS)
  const from = r.prepFrom ?? end
  const span = Math.max(0, daysBetween(from, end))
  const window = span * (r.windowShare ?? PAPERS_WINDOW_SMALL)
  const start = span - window
  const n = Math.max(1, Math.round(r.totalUnits))
  return addDays(from, Math.round(start + window * Math.pow(Math.min(1, k / n), PAPERS_BACKLOAD)))
}

/** Papers that should be done by the end of `date`. */
export function papersDueBy(r: Resource, examDate: ISODate, date: ISODate): number {
  let n = 0
  for (let k = 1; k <= r.totalUnits; k++) if (paperDueDate(r, examDate, k) <= date) n++
  return n
}

/** Lectures still to study; a half-done lecture ("Partly") counts as one. */
export function lecturesLeft(r: Resource): number {
  return Math.max(0, Math.ceil(r.totalUnits - r.doneUnits - 1e-9))
}

/** Minutes for the next n lectures; a half-done lecture is shorter; from summaries they take SUMMARY_SHARE. */
export function lectureMinutes(r: Resource, n: number, factor = 1): number {
  if (n <= 0) return 0
  const part = (r.totalUnits - r.doneUnits) % 1
  const each = LECTURE_MINUTES * factor * (r.fromSummary ? SUMMARY_SHARE : 1)
  return ceilTo5(Math.max(MIN_TASK_MINUTES, (n - (part > 0 ? 1 - part : 0)) * each))
}

/** "IM slides: next lecture", "IM slides: next 2 lectures". Lecture titles aren't known, so no numbers. */
export function lecturesTitle(r: Resource, n: number): string {
  return n === 1 ? `${r.name}: next lecture` : `${r.name}: next ${n} lectures`
}

export interface UniWork {
  tasks: Task[]
  used: number
}

/**
 * One uni goal's work for a day inside `budget` minutes.
 * 1. A past paper that is due (by its place in the window).
 * 2. Lectures: what finishes them a day early in the study days left (`days`).
 * 3. Lectures all done → the next paper early.
 * `fill` = no other goal can use the time today: lectures run ahead (up to LECTURES_MAX_PER_DAY) and a paper comes early.
 */
export function uniWork(resources: Resource[], goal: Goal, date: ISODate, budget: number, days: number, lectureFactor: number, reason: string, fill = false): UniWork {
  const tasks: Task[] = []
  let left = budget
  const papers = resources.find((r) => r.goalId === goal.id && r.type === 'papers')
  const slides = resources.filter((r) => r.goalId === goal.id && r.type === 'slides')

  const paperTask = (r: Resource, why: string): Task | null => {
    const remaining = r.totalUnits - r.doneUnits
    if (remaining <= 1e-9) return null
    const inPaper = remaining % 1 > 1e-9 ? remaining % 1 : 1
    const need = ceilTo5(inPaper * r.minutesPerUnit)
    const minutes = Math.min(need, floorTo5(left))
    if (minutes < Math.min(need, PAPER_MIN_PART)) return null
    const continues = inPaper < 1
    return {
      id: `${date}-${r.id}`,
      date,
      kind: 'study',
      goalId: goal.id,
      resourceId: r.id,
      title: continues ? `${r.name}: finish the paper you started` : `${r.name}: one paper`,
      detail: minutes < need ? 'Continues next time' : 'Like the exam: timed, then go over what you missed',
      reason: why,
      minutes,
      amount: Math.min(inPaper, minutes / r.minutesPerUnit),
      status: 'pending',
    }
  }
  const add = (t: Task | null) => {
    if (!t) return
    tasks.push(t)
    left -= t.minutes
  }

  const lecturesRemain = slides.some((r) => lecturesLeft(r) > 0)
  if (papers && Math.floor(papers.doneUnits + 1e-9) < papersDueBy(papers, goal.examDate, date)) {
    add(paperTask(papers, 'Past papers show how this exam asks'))
  }

  for (const r of slides) {
    const rem = lecturesLeft(r)
    if (rem === 0) continue
    // Finish a day early when there's room for it.
    const want = Math.min(rem, Math.max(1, Math.ceil((r.totalUnits - r.doneUnits) / Math.max(1, days - 1))))
    let n = 0
    while (n < rem && lectureMinutes(r, n + 1, lectureFactor) <= left) n++
    // Today's need, not more: spare time passes to the other goals instead of piling up lectures.
    // When no other goal can use the time (a wind-down, or the only goal), get ahead, within reason.
    n = Math.min(n, fill ? Math.max(want, LECTURES_MAX_PER_DAY) : want)
    if (n < 1) continue
    const minutes = lectureMinutes(r, n, lectureFactor)
    tasks.push({
      id: `${date}-${r.id}`,
      date,
      kind: 'study',
      goalId: goal.id,
      resourceId: r.id,
      title: lecturesTitle(r, n),
      detail: r.fromSummary ? 'From the summary' : undefined,
      reason,
      minutes,
      amount: n,
      status: 'pending',
    })
    left -= minutes
  }

  if (papers && (!lecturesRemain || fill) && !tasks.some((t) => t.resourceId === papers.id)) {
    add(paperTask(papers, lecturesRemain ? 'Time to spare today: a past paper early' : 'Lectures are done: past papers from here'))
  }
  return { tasks, used: budget - left }
}

/** The lecture a uni goal has left is shorter from a summary: used by rescue to show the saving. */
export function summarySaving(r: Resource, factor = 1): number {
  return Math.round(lecturesLeft(r) * LECTURE_MINUTES * factor * (1 - SUMMARY_SHARE))
}
