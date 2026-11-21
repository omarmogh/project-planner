// Uni goals: lectures, summaries and past papers. Pure. See docs/ENGINE_SPEC.md section 4.2.
// Past papers are retrieval practice in the exam's format: spread over a window before the
// exam and denser near it, never all at the end.

import {
  LECTURE_MINUTES, LECTURES_AHEAD, LECTURES_DONE_BEFORE_SHARE, LECTURES_MAX_PER_DAY, MIN_TASK_MINUTES, UNI_REVIEW_MINUTES, UNI_WIND_DOWN_REVIEW_MAX, PAPER_MIN_PART, PAPERS_BACKLOAD, PAPERS_LARGE_LECTURES, PAPERS_LAST_BEFORE_EXAM_DAYS,
  PAPERS_SMALL_LECTURES, PAPERS_WINDOW_LARGE, PAPERS_WINDOW_SMALL, SUMMARY_SHARE, PAPER_GROW_AHEAD_DAYS,
} from './config'
import { addDays, daysBetween } from './dates'
import type { EngineState, Goal, ISODate, Resource, Task, Topic } from './types'

/** The subject a uni goal examines: "IM exam" → "IM". Its papers and retests are scored under this name. */
export function uniSubject(goal: Pick<Goal, 'label'>): string {
  return goal.label.replace(/ exam$/, '')
}

const slugOf = (x: string) => x.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, '-').replace(/^-|-$/g, '') || 'x'

/** Topic id for a uni goal's weak topic: `uni-<goalId>-<slug>`; `uni-<goalId>-all` is the whole subject. */
export function uniTopicId(goalId: string, name?: string): string {
  return `uni-${goalId}-${name ? slugOf(name) : 'all'}`
}

/**
 * What a student can tap as missed after a uni paper: the goal's lecture titles when it has them,
 * else the whole subject. Known topics keep their status. Never Step 1 systems.
 */
export function uniTopicChoices(s: Pick<EngineState, 'goals' | 'resources' | 'topics'>, goalId: string): Topic[] {
  const goal = s.goals.find((g) => g.id === goalId)
  if (!goal) return []
  const system = uniSubject(goal)
  const names = [...new Set(s.resources.filter((r) => r.goalId === goalId && r.type === 'slides').flatMap((r) => r.itemNames ?? []))]
  const fresh: Topic[] = names.length
    ? names.map((name) => ({ id: uniTopicId(goalId, name), system, name, status: 'unknown' }))
    : [{ id: uniTopicId(goalId), system, name: system, status: 'unknown', wholeSystem: true }]
  return fresh.map((t) => s.topics.find((x) => x.id === t.id) ?? t)
}

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

/** "Lecture" or, for an oral-exam list, "Question". */
function unitWord(r: Resource, n: number): string {
  const [one, many] = r.unit ?? ['lecture', 'lectures']
  return n === 1 ? one : many
}

/**
 * "IM slides: next lecture", "IM slides: next 2 lectures". With titles (Resource.itemNames):
 * "Lecture 7: Heart failure", "Lectures 7–8: Heart failure, Arrhythmias". The number is the student's own list.
 */
export function lecturesTitle(r: Resource, n: number): string {
  // After "Not sure" the count is a default: never name lectures the student may not have.
  if (r.unitsUnsure && !r.itemNames?.length) return `${r.name.replace(/ slides$/, '')}: next part of your material`
  const first = Math.floor(r.doneUnits + 1e-9)
  const names = r.itemNames?.slice(first, first + n) ?? []
  if (names.length === n && n > 0) {
    const word = unitWord(r, n)
    const cap = word.charAt(0).toUpperCase() + word.slice(1)
    const nums = n === 1 ? `${first + 1}` : `${first + 1}–${first + n}`
    return `${cap} ${nums}: ${names.join(', ')}`
  }
  return n === 1 ? `${r.name}: next ${unitWord(r, 1)}` : `${r.name}: next ${n} ${unitWord(r, n)}`
}

/**
 * Where the student is, in their own count: "3 of 8 done". Not "lecture 7": Locus only knows how many were left
 * at setup, not the uni's numbering. Nothing after "Not sure", where the count is a default.
 */
export function lecturesDetail(r: Resource): string | undefined {
  const done = Math.floor(r.doneUnits + 1e-9)
  const where = r.unitsUnsure ? undefined : done === 0 ? `${r.totalUnits} to go` : `${done} of ${r.totalUnits} done`
  return [r.fromSummary ? 'From the summary' : undefined, where].filter(Boolean).join(' · ') || undefined
}

export interface UniWork {
  tasks: Task[]
  used: number
}

/** 'shared' = other goals want the time too; 'alone' = the only goal studying; 'windDown' = its exam is close and board work is paused. */
export type UniMode = 'shared' | 'alone' | 'windDown'

/**
 * One uni goal's work for a day inside `budget` minutes.
 * 1. A past paper that is due (by its place in the window).
 * 2. Lectures: what finishes them LECTURES_DONE_BEFORE_SHARE of the days early. With the day to itself
 *    they run a little ahead (LECTURES_AHEAD); in the wind-down up to LECTURES_MAX_PER_DAY.
 * 3. Everything done → a short self-test on the lectures (recall, not re-reading) until the exam.
 */
export function uniWork(resources: Resource[], goal: Goal, date: ISODate, budget: number, days: number, lectureFactor: number, reason: string, mode: UniMode = 'shared'): UniWork {
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
      system: uniSubject(goal),
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

  if (papers && papers.doneUnits + 1e-9 < papersDueBy(papers, goal.examDate, date)) {
    add(paperTask(papers, 'Past papers show how this exam asks'))
  }

  // Lectures are paced to finish early, leaving the last days for papers and recall.
  const lectureDays = Math.max(1, Math.floor(days * (1 - LECTURES_DONE_BEFORE_SHARE)))
  for (const r of slides) {
    const rem = lecturesLeft(r)
    if (rem === 0) continue
    const want = Math.min(rem, Math.max(1, Math.ceil((r.totalUnits - r.doneUnits) / lectureDays)))
    const most = mode === 'windDown' ? Math.max(want, LECTURES_MAX_PER_DAY) : mode === 'alone' ? Math.ceil(want * LECTURES_AHEAD) : want
    let n = 0
    while (n < rem && n < most && lectureMinutes(r, n + 1, lectureFactor) <= left) n++
    if (n < 1) continue
    const minutes = lectureMinutes(r, n, lectureFactor)
    tasks.push({
      id: `${date}-${r.id}`,
      date,
      kind: 'study',
      goalId: goal.id,
      resourceId: r.id,
      title: lecturesTitle(r, n),
      detail: lecturesDetail(r),
      reason,
      minutes,
      amount: n,
      status: 'pending',
    })
    left -= minutes
  }

  // Nothing counted left to do today: a short self-test keeps the lectures until the exam.
  const lecturesDone = slides.length > 0 && slides.every((r) => lecturesLeft(r) === 0)
  // In the wind-down the freed time goes to the exam: recall comes after a paper too.
  if (lecturesDone && (tasks.length === 0 || mode === 'windDown')) {
    const minutes = Math.min(floorTo5(left), mode === 'windDown' ? UNI_WIND_DOWN_REVIEW_MAX : UNI_REVIEW_MINUTES)
    if (minutes >= MIN_TASK_MINUTES) {
      tasks.push({
        id: `${date}-${goal.id}-recall`,
        date,
        kind: 'study',
        goalId: goal.id,
        title: `${goal.label.replace(/ exam$/, '')}: recall your lectures without the slides, oldest first`,
        detail: 'Close the slides, write what you remember, then check',
        reason: 'Lectures are done: recall keeps them until the exam',
        minutes,
        status: 'pending',
      })
      left -= minutes
    }
  }
  return { tasks, used: budget - left }
}

/** The lecture a uni goal has left is shorter from a summary: used by rescue to show the saving. */
export function summarySaving(r: Resource, factor = 1): number {
  return Math.round(lecturesLeft(r) * LECTURE_MINUTES * factor * (1 - SUMMARY_SHARE))
}

/**
 * Leftover time after every goal had its share (planSteps growStep): a uni goal's whole lectures first
 * (today's lecture task grows, or one is added), then a whole past paper once the lectures are done or the
 * next paper is due within PAPER_GROW_AHEAD_DAYS. Never half a lecture, never past `room`. Mutates `tasks`
 * (today's tasks of this goal) and returns the minutes used.
 */
export function growUni(resources: Resource[], goal: Goal, date: ISODate, tasks: Task[], room: number, lectureFactor: number, reason: string): number {
  let left = room
  for (const r of resources.filter((x) => x.goalId === goal.id && x.type === 'slides')) {
    const rem = lecturesLeft(r)
    const task = tasks.find((t) => t.resourceId === r.id)
    let n = task?.amount ?? 0
    const was = task?.minutes ?? 0
    while (n < rem && n < Math.max(task?.amount ?? 0, LECTURES_MAX_PER_DAY) && lectureMinutes(r, n + 1, lectureFactor) - was <= left) n++
    if (n === (task?.amount ?? 0)) continue
    const minutes = lectureMinutes(r, n, lectureFactor)
    if (task) {
      Object.assign(task, { amount: n, minutes, title: lecturesTitle(r, n) })
    } else {
      tasks.push({
        id: `${date}-${r.id}`, date, kind: 'study', goalId: goal.id, resourceId: r.id,
        title: lecturesTitle(r, n), detail: lecturesDetail(r), reason, minutes, amount: n, status: 'pending',
      })
    }
    left -= minutes - was
  }
  const papers = resources.find((x) => x.goalId === goal.id && x.type === 'papers')
  const lecturesDone = resources.filter((x) => x.goalId === goal.id && x.type === 'slides').every((x) => lecturesLeft(x) === 0)
  if (papers && !tasks.some((t) => t.resourceId === papers.id) && papers.totalUnits - papers.doneUnits > 1e-9) {
    const soon = papers.doneUnits + 1e-9 < papersDueBy(papers, goal.examDate, addDays(date, PAPER_GROW_AHEAD_DAYS))
    const remaining = papers.totalUnits - papers.doneUnits
    const inPaper = remaining % 1 > 1e-9 ? remaining % 1 : 1
    const minutes = ceilTo5(inPaper * papers.minutesPerUnit)
    if ((lecturesDone || soon) && minutes <= left) {
      tasks.push({
        id: `${date}-${papers.id}`, date, kind: 'study', goalId: goal.id, resourceId: papers.id, system: uniSubject(goal),
        title: inPaper < 1 ? `${papers.name}: finish the paper you started` : `${papers.name}: one paper`,
        detail: 'Like the exam: timed, then go over what you missed', reason: 'Time left today: a paper in the exam\'s format',
        minutes, amount: inPaper, status: 'pending',
      })
      left -= minutes
    }
  }
  // Still time: recall of the lectures done so far (retrieval practice), up to UNI_WIND_DOWN_REVIEW_MAX.
  const slides = resources.filter((x) => x.goalId === goal.id && x.type === 'slides')
  const anyDone = slides.some((x) => x.doneUnits >= 1 - 1e-9)
  const recall = tasks.find((t) => t.id === `${date}-${goal.id}-recall`)
  const cap = Math.min(UNI_WIND_DOWN_REVIEW_MAX, (recall?.minutes ?? 0) + floorTo5(left))
  if (anyDone && cap >= MIN_TASK_MINUTES && cap > (recall?.minutes ?? 0)) {
    if (recall) {
      left -= cap - recall.minutes
      recall.minutes = cap
    } else {
      tasks.push({
        id: `${date}-${goal.id}-recall`, date, kind: 'study', goalId: goal.id,
        title: `${uniSubject(goal)}: recall the lectures you've done without the slides, oldest first`,
        detail: 'Close the slides, write what you remember, then check',
        reason: 'Time left today: recall keeps what you studied', minutes: cap, status: 'pending',
      })
      left -= cap
    }
  }
  return room - left
}
