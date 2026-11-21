import type { dayContext } from './availability'
import type { DayType, Sitting } from './exams'
import { estimates } from './estimates'
import { ankiStep, eveDay, finishDay, growStep, loopStep, needsStep, openDay, quietDay, shareStep, studyStep, topicTask } from './planSteps'
import { sliceTopic } from './topics'
import type { EngineState, ISODate, Task } from './types'

export { lectureMinutes, lecturesLeft, lecturesTitle } from './uni'
export { checkTitle, topicTask } from './planSteps'

/** One calm line for Today, when the day isn't a plain full day. */
export type DayNote =
  /** Commitments left too little room: study moved to the coming days. */
  | 'squeezed'
  /** Anki reviews take all the time there is. */
  | 'ankiFillsDay'
  /** Anki was shortened to fit; no new cards today. */
  | 'ankiShortened'
  /** A uni exam is close: board work is Anki only, its fixes and retests wait. */
  | 'paused'
  /** Fixes or retests moved to the next day. */
  | 'moved'

export interface DayPlan {
  date: ISODate
  kind: ReturnType<typeof dayContext>['kind']
  /** Exam protocol: the day before an exam, exam day, the day after, or a normal day. */
  type: DayType
  /** What the student chose after a light-day offer today. */
  mode: 'full' | 'light' | 'essentials' | 'rest'
  /** The student's stated minutes for the day (plus extra time agreed in rescue mode). */
  available: number
  tasks: Task[]
  /** Minutes busy time takes from the day ("Lecture 10–12" → 30). */
  busy: number
  /** Due fixes and retests that didn't fit today: moved to the next day, never dropped. */
  moved: Task[]
  /** Uni goals whose wind-down is on today (board goals: Anki only). */
  windDown: string[]
  /** The exam(s) that make today an eve, an exam day or a rest day. */
  sittings: Sitting[]
  notes: DayNote[]
  /** Commitments left too little room: study moved to the coming days (due fixes and retests stay). */
  squeezed: boolean
  /** Deadline work that doesn't fit the days before its deadline. */
  overloaded: string[]
}

export interface BuildOptions {
  /** "Do more": plan as if the day had this much more time. */
  extraMinutes?: number
  /** "Do more": the study time to plan with, instead of the day's own. */
  roomMinutes?: number
  /** Ignore an accepted light day (to see what the full day would have been). */
  ignoreLight?: boolean
  /** Study minutes already started or done today (a re-plan mid-day): they come out of the room. */
  spentMinutes?: number
}

/**
 * Pure: (state, date) → that day's plan. One function per step, in the order of docs/ENGINE_SPEC.md section 3:
 * day type → capacity → deadline work → exam eve → Anki → due retests → due fixes → goal study shared by need →
 * leftover grows a question block → an accepted light day cuts the list.
 * Everything except deadline work fits inside the day; what doesn't fit moves to the next day.
 */
export function buildDay(s: EngineState, date: ISODate, opts: BuildOptions = {}): DayPlan {
  const c = openDay(s, date, opts)                  // steps 1–3: day type, capacity, deadline work
  if (c.info.type === 'exam' || c.info.type === 'rest') return quietDay(c)
  if (c.info.type === 'eve') return eveDay(c)       // step 4
  const anki = ankiStep(c)                          // step 5
  const loop = loopStep(c)                          // steps 6–7
  const needs = needsStep(c)
  const budgets = shareStep(c, needs)               // step 8: share the time, then each goal's work
  const { work, blocks } = studyStep(c, needs, budgets)
  growStep(c, blocks, work)                         // step 9
  return finishDay(c, anki, loop, work)             // step 10
}

export function totalMinutes(tasks: Task[]): number {
  return tasks.reduce((n, t) => n + t.minutes, 0)
}

/**
 * After videos are ticked or unticked: today's pending topic tasks are re-sliced
 * within the time they already had. A topic with nothing left drops out.
 */
export function refreshTopicTasks(s: EngineState, tasks: Task[], date: ISODate): Task[] {
  const factor = estimates(s).topic
  return tasks.flatMap((task) => {
    if (task.status !== 'pending' || !task.topicId) return [task]
    const t = s.topics.find((x) => x.id === task.topicId)
    const slice = t ? sliceTopic(t, task.minutes, factor, true) : null
    return t && slice ? [topicTask(s, t, slice, date)] : []
  })
}
