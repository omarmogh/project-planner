import { recentAccuracy } from './accuracy'
import { dayContext } from './availability'
import { commitmentDay } from './commitments'
import { CLOSE_EXAMS_DAYS, LECTURE_MINUTES, MIN_TASK_MINUTES, MIXED_SYSTEM, QBANK_MAX, QBANK_MIN } from './config'
import { daysBetween } from './dates'
import { resourcePace } from './pace'
import { reasons } from './reasons'
import { estimates } from './estimates'
import { isAllWatched, sliceTopic, type TopicSlice, stepLines, topicQueue, topicTitle } from './topics'
import type { EngineState, Goal, ISODate, Resource, Task, Topic } from './types'

export interface DayPlan {
  date: ISODate
  kind: ReturnType<typeof dayContext>['kind']
  available: number
  tasks: Task[]
  /** Minutes busy time takes from the day ("Lecture 10–12" → 30). */
  busy: number
  /** Commitments left too little room: study moved to the coming days (due fixes and retests stay). */
  squeezed: boolean
  /** Deadline work that doesn't fit the days before its deadline. */
  overloaded: string[]
}

const floorTo5 = (n: number) => Math.floor(n / 5) * 5
const ceilTo5 = (n: number) => Math.ceil(n / 5) * 5

/**
 * Which system a standalone question block targets.
 * No accuracy data yet → a mixed block across all systems (how most students use UWorld).
 * With data → the lowest-accuracy system. Systems without data are never targeted.
 */
function pickSystem(s: EngineState, date: ISODate): { system: string; reason: string } {
  const acc = recentAccuracy(s.sessions, date)
  if (acc.length > 0) return { system: acc[0].system, reason: reasons.lowestAccuracy(acc[0].pct) }
  return { system: MIXED_SYSTEM, reason: reasons.noAccuracyYet() }
}

/** "UWorld: 20 Cardio questions + review", "UWorld: 20 mixed questions + review". */
function blockTitle(r: Resource, n: number, system: string): string {
  return `${r.name}: ${n} ${system === MIXED_SYSTEM ? 'mixed' : system} questions + review`
}

/** "Heart failure: 10 UWorld questions". */
export function checkTitle(name: string, questions: number, qbankName = 'UWorld'): string {
  return `${name}: ${questions} ${qbankName} ${questions === 1 ? 'question' : 'questions'}`
}

/** "IM slides: next lecture", "IM slides: next 2 lectures". Lecture titles aren't known, so no numbers. */
export function lecturesTitle(r: Resource, n: number): string {
  return n === 1 ? `${r.name}: next lecture` : `${r.name}: next ${n} lectures`
}

/** Lectures still to study; a half-done lecture ("Partly") counts as one. */
export function lecturesLeft(r: Resource): number {
  return Math.max(0, Math.ceil(r.totalUnits - r.doneUnits - 1e-9))
}

/** Minutes for the next n lectures; a half-done lecture ("Partly") is shorter. `factor` = the lectures estimate. */
export function lectureMinutes(r: Resource, n: number, factor = 1): number {
  if (n <= 0) return 0
  const part = (r.totalUnits - r.doneUnits) % 1
  return ceilTo5(Math.max(MIN_TASK_MINUTES, (n - (part > 0 ? 1 - part : 0)) * LECTURE_MINUTES * factor))
}

/**
 * Lectures per subject today. Each wants what finishes it by its exam.
 * If that doesn't fit, the time is split in proportion to the lectures each has left,
 * then any spare goes to the sooner exam first. Pass items soonest exam first.
 */
export function splitLectures(items: { r: Resource; examDate: ISODate }[], budget: number, date: ISODate, factor = 1): Map<string, number> {
  const out = new Map<string, number>()
  const rows = items.map(({ r, examDate }) => {
    const rem = Math.max(0, r.totalUnits - r.doneUnits)
    const need = rem > 0 ? Math.min(lecturesLeft(r), Math.max(1, Math.ceil(rem / Math.max(1, daysBetween(date, examDate))))) : 0
    return { r, rem, need, n: need }
  })
  const lm = (r: Resource, n: number) => lectureMinutes(r, n, factor)
  const total = (xs: typeof rows) => xs.reduce((m, x) => m + lm(x.r, x.n), 0)
  if (total(rows) > budget) {
    const allRem = rows.reduce((m, x) => m + x.rem, 0) || 1
    for (const x of rows) {
      const share = (budget * x.rem) / allRem
      x.n = 0
      while (x.n < x.need && lm(x.r, x.n + 1) <= share) x.n++
    }
    // Spare minutes, one lecture at a time: to whoever is furthest below their share; ties → sooner exam.
    const share = new Map(rows.map((x) => [x, (budget * x.rem) / allRem]))
    for (;;) {
      const fits = rows.filter((x) => x.n < x.need && total(rows) - lm(x.r, x.n) + lm(x.r, x.n + 1) <= budget)
      if (fits.length === 0) break
      const gap = (x: (typeof rows)[number]) => share.get(x)! - lm(x.r, x.n)
      const best = fits.reduce((a, b) => (gap(b) > gap(a) ? b : a))
      best.n++
    }
  }
  for (const x of rows) out.set(x.r.id, x.n)
  return out
}

/**
 * Pure: (goals, resources, availability, topics, sessions, scheduled, date) → that day's tasks.
 * Order on screen: Anki → soonest goal's work → fixes → retests → later goals' work.
 * Budget: Anki, fixes and retests are reserved first; then each goal, soonest first.
 * The topic goal fills its time with topic tasks; a question block only runs
 * when there's no topic left to study (or the student studies by questions only).
 */
export function buildDay(s: EngineState, date: ISODate): DayPlan {
  const ctx = dayContext(s.availability, date)
  // 0. Commitments come first: busy time shrinks the day, deadline work takes its share.
  const cday = commitmentDay(s, date)
  const committed = cday.tasks.reduce((n, t) => n + t.minutes, 0)
  let left = ctx.minutes - cday.busy - committed
  const goals = s.goals.filter((g) => g.examDate > date).sort((a, b) => a.examDate.localeCompare(b.examDate))
  const active = new Set(goals.map((g) => g.id))
  const est = estimates(s)
  const factor = est.topic
  /** Minutes per question in a question block, as this student really takes them. */
  const perQ = (r: Resource) => r.minutesPerUnit * est.questions

  // 1. Anki: Anki decides what's due; we reserve the time.
  const anki: Task[] = []
  if (s.anki && active.has(s.anki.goalId) && ctx.minutes > 0) {
    const goal = goals.find((g) => g.id === s.anki!.goalId)!
    const perDay = Math.ceil(s.anki.newCardsLeft / Math.max(1, daysBetween(date, goal.examDate)))
    anki.push({
      id: `${date}-anki`,
      date,
      kind: 'anki',
      goalId: goal.id,
      title: 'Anki reviews',
      detail: perDay > 0 ? `+ ${perDay} new cards` : undefined,
      reason: reasons.ankiNew(perDay),
      minutes: s.anki.reviewMinutes,
      amount: perDay,
      status: 'pending',
    })
    left -= s.anki.reviewMinutes
  }

  // 2. Fixes and retests that are due (overdue ones roll forward to today).
  const due = s.scheduled
    .filter((t) => t.status === 'pending' && t.date <= date && active.has(t.goalId))
    .map((t) => ({ ...t, date, reason: t.kind === 'retest' ? reasons.retestDue(t.date, date, t.retestRound) : t.reason }))
  const fixes = due.filter((t) => t.kind === 'fix')
  const retests = due.filter((t) => t.kind === 'retest')
  for (const t of due) left -= t.minutes

  // 3. Goal work, soonest goal first.
  const work = new Map<string, Task[]>()
  const blocks: { task: Task; resource: Resource }[] = []
  /** Lectures per slides resource, decided per group of close exams (time already reserved). */
  const lectures = new Map<string, number>()
  const soonest: Goal | undefined = goals[0]

  for (const goal of goals) {
    const list: Task[] = []
    const examReason = reasons.examSoon(goal.label, daysBetween(date, goal.examDate))

    // Uni slides. Subjects whose exams are close together are split in one go.
    for (const r of s.resources.filter((x) => x.goalId === goal.id && x.type === 'slides')) {
      if (!lectures.has(r.id)) {
        const group = goals
          .filter((g) => g.examDate >= goal.examDate && daysBetween(goal.examDate, g.examDate) <= CLOSE_EXAMS_DAYS)
          .flatMap((g) => s.resources.filter((x) => x.goalId === g.id && x.type === 'slides' && !lectures.has(x.id)).map((x) => ({ r: x, examDate: g.examDate })))
        const split = splitLectures(group, Math.max(0, left), date, est.lectures)
        for (const [id, n] of split) {
          lectures.set(id, n)
          left -= lectureMinutes(group.find((x) => x.r.id === id)!.r, n, est.lectures)
        }
      }
      const n = lectures.get(r.id) ?? 0
      if (n < 1) continue
      list.push({
        id: `${date}-${r.id}`,
        date,
        kind: 'study',
        goalId: goal.id,
        resourceId: r.id,
        title: lecturesTitle(r, n),
        reason: examReason,
        minutes: lectureMinutes(r, n, est.lectures),
        amount: n,
        status: 'pending',
      })
    }

    const qbank = s.resources.find((x) => x.goalId === goal.id && x.type === 'qbank' && x.doneUnits < x.totalUnits)

    // Topic tasks for the topic goal.
    if (goal.id === s.topicGoalId) {
      for (const t of topicQueue(s, date)) {
        if (left < MIN_TASK_MINUTES) break
        const slice = sliceTopic(t, left, factor)
        if (!slice) break // the next item doesn't fit today; topics stay in order
        list.push(topicTask(s, t, slice, date))
        left -= slice.minutes
      }
      // Topics left to study → no separate question block today.
      if (topicQueue(s, date).length > 0) {
        work.set(goal.id, list)
        continue
      }
    }

    // A question block: review once topics are covered, or for students who study by questions only.
    if (qbank && left > 0) {
      const pace = resourcePace(qbank, goal.examDate, date)
      const want = Math.min(QBANK_MAX, Math.max(QBANK_MIN, ceilTo5(pace.requiredPerDay)), pace.remaining)
      const n = Math.min(want, floorTo5(left / perQ(qbank)))
      if (n >= QBANK_MIN || (n > 0 && n >= pace.remaining)) {
        const pick = pickSystem(s, date)
        const task: Task = {
          id: `${date}-${qbank.id}`,
          date,
          kind: 'study',
          goalId: goal.id,
          resourceId: qbank.id,
          system: pick.system,
          title: blockTitle(qbank, n, pick.system),
          detail: pick.system === MIXED_SYSTEM ? 'Mixed, all systems · timed' : 'Timed block',
          reason: pick.reason,
          minutes: Math.round(n * perQ(qbank)),
          amount: n,
          status: 'pending',
        }
        list.push(task)
        blocks.push({ task, resource: qbank })
        left -= task.minutes
      }
    }
    work.set(goal.id, list)
  }

  // 4. Leftover time grows the first question block.
  for (const { task, resource } of blocks) {
    if (left < perQ(resource) * 5) break
    const room = floorTo5(left / perQ(resource))
    const remaining = resource.totalUnits - resource.doneUnits
    const extra = Math.min(room, QBANK_MAX - (task.amount ?? 0), remaining - (task.amount ?? 0))
    if (extra <= 0) continue
    task.amount = (task.amount ?? 0) + extra
    task.minutes = Math.round(task.amount * perQ(resource))
    task.title = blockTitle(resource, task.amount, task.system ?? MIXED_SYSTEM)
    left -= extra * perQ(resource)
  }

  const first = soonest ? work.get(soonest.id) ?? [] : []
  const later = goals.slice(1).flatMap((g) => work.get(g.id) ?? [])
  const study = [...first, ...later]
  const squeezed = cday.busy + committed > 0 && left < MIN_TASK_MINUTES && study.length === 0
  return {
    date,
    kind: ctx.kind,
    available: ctx.minutes,
    tasks: [...anki, ...cday.tasks, ...first, ...fixes, ...retests, ...later],
    busy: cday.busy,
    squeezed,
    overloaded: cday.overloaded,
  }
}

export function totalMinutes(tasks: Task[]): number {
  return tasks.reduce((n, t) => n + t.minutes, 0)
}

/** One topic task from a slice. A fully watched topic is a short check: just its questions. */
export function topicTask(s: EngineState, t: Topic, slice: TopicSlice, date: ISODate): Task {
  const qbank = s.resources.find((x) => x.goalId === s.topicGoalId && x.type === 'qbank' && x.doneUnits < x.totalUnits)
  const check = isAllWatched(t) && slice.items.every((x) => x.source === 'qbank')
  return {
    id: `${date}-topic-${t.id}`,
    date,
    kind: 'study',
    goalId: s.topicGoalId!,
    resourceId: slice.questions > 0 ? qbank?.id : undefined,
    system: t.system,
    topicIds: [t.id],
    topicId: t.id,
    title: check ? checkTitle(t.name, slice.questions, qbank?.name) : topicTitle(t),
    steps: check ? undefined : stepLines(slice.items, qbank?.name),
    detail: slice.ends ? undefined : 'Continues next time',
    reason: check ? reasons.topicCheck() : slice.continues ? reasons.topicContinue() : s.focus.includes(t.system) ? reasons.topicNext(t.system) : reasons.nextSystem(t.system),
    minutes: slice.minutes,
    amount: slice.questions || undefined,
    itemFrom: slice.from,
    itemTo: slice.to,
    status: 'pending',
  }
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
    const slice = t ? sliceTopic(t, task.minutes, factor) : null
    return t && slice ? [topicTask(s, t, slice, date)] : []
  })
}
