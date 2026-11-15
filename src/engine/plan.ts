import { recentAccuracy } from './accuracy'
import { dayContext, statedMinutes } from './availability'
import { commitmentDay } from './commitments'
import {
  ANKI_MIN_MINUTES, BACKLOG_LIMIT_FACTOR, CLOSE_EXAMS_DAYS, EVE_MAX_MINUTES, EVE_MAX_SHARE, EVE_MIN_MINUTES, FIXLOOP_SHARE, FIXLOOP_SHARE_BACKLOG, MAX_BLOCKS_PER_DAY,
  MAX_FIXES_PER_DAY, MAX_GOAL_SKIP_DAYS, MAX_NEW_TOPICS_PER_DAY, MAX_OPEN_LOOPS, MAX_RETESTS_PER_DAY, MIN_GOAL_CHUNK,
  MIN_TASK_MINUTES, MIXED_SYSTEM, QBANK_MAX, QBANK_MIN, SOONEST_MAX_SHARE, TOPIC_TASK_MAX_MINUTES,
} from './config'
import { addDays, daysBetween } from './dates'
import { activeGoals, dayInfo, isPaused, studies, windDownGoals, type DayType, type Sitting } from './exams'
import { openLoopTopicIds, retestReady } from './fixes'
import { lightTasks } from './lightday'
import { goalNeeds, unitsLeft } from './pace'
import { inSentence, listJoin, reasons } from './reasons'
import { estimates } from './estimates'
import { applyTopicCompletion, isAllWatched, isStarted, sliceTopic, type TopicSlice, stepLines, topicProgress, topicQueue, topicTitle } from './topics'
import { lectureMinutes as lectureMin, lecturesLeft as lecturesRemaining, uniWork } from './uni'
import { isFirm, type EngineState, type Goal, type ISODate, type Resource, type Task, type Topic } from './types'

export { lectureMinutes, lecturesLeft, lecturesTitle } from './uni'

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
  /** Ignore an accepted light day (to see what the full day would have been). */
  ignoreLight?: boolean
}

const floorTo5 = (n: number) => Math.floor(n / 5) * 5
/** Minutes for a block of n questions, rounded up to 5. */
const blockMinutes = (n: number, perQ: number) => Math.ceil((n * perQ) / 5 - 1e-9) * 5

/** Days since a fixed date: a stable counter for "every 2nd / 3rd day" decisions. */
const dayNumber = (date: ISODate) => daysBetween('2000-01-01', date)

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

/** The smallest budget that holds one task for this goal: a lecture for a uni goal, MIN_GOAL_CHUNK otherwise. */
function minChunk(s: EngineState, goal: Goal, lectureFactor: number): number {
  const slides = s.resources.filter((r) => r.goalId === goal.id && r.type === 'slides' && lecturesRemaining(r) > 0)
  return Math.max(MIN_GOAL_CHUNK, ...slides.map((r) => lectureMin(r, 1, lectureFactor)))
}

/** The light review on the day before an exam (spec 5.1). */
function eveTasks(s: EngineState, date: ISODate, sittings: Sitting[], stated: number, left: number): Task[] {
  const goals = [...new Map(sittings.map((x) => [x.goal.id, x])).values()]
  const each = Math.min(EVE_MAX_MINUTES, floorTo5((stated * EVE_MAX_SHARE) / goals.length), floorTo5(left / goals.length))
  if (each < EVE_MIN_MINUTES) return []
  return goals.map(({ goal, label }) => {
    const weak = s.topics.filter((t) => !t.dropped && !t.wholeSystem && (t.status === 'weak' || t.status === 'fixing'))
    const board = goal.id === s.topicGoalId
    const names = weak.slice(0, 3).map((t) => inSentence(t.name))
    return {
      id: `${date}-eve-${goal.id}`,
      date,
      kind: 'review' as const,
      goalId: goal.id,
      topicIds: board ? weak.slice(0, 3).map((t) => t.id) : undefined,
      title: board && names.length ? `Light review: ${listJoin(names)}` : board ? 'Light review: what felt shaky this week' : 'Light review: your past-paper mistakes and your own notes',
      detail: 'Then stop for the day',
      reason: `${label} is tomorrow`,
      minutes: each,
      status: 'pending' as const,
    }
  })
}

/**
 * Pure: (state, date) → that day's plan. The steps, in order (docs/ENGINE_SPEC.md section 3):
 * day type → capacity → deadline work → exam eve → Anki → due retests → due fixes → goal study
 * shared by need → leftover grows a question block → an accepted light day cuts the list.
 * Everything except deadline work fits inside the day; what doesn't fit moves to the next day.
 */
export function buildDay(s: EngineState, date: ISODate, opts: BuildOptions = {}): DayPlan {
  const ctx = dayContext(s.availability, date)
  const stated = statedMinutes(s.availability, date)
  const info = dayInfo(s.goals, date)
  // Commitments come first: busy time shrinks the day, deadline work takes its share.
  const cday = commitmentDay(s, date)
  const committed = cday.tasks.reduce((n, t) => n + t.minutes, 0)
  const plan: DayPlan = {
    date, kind: ctx.kind, type: info.type, mode: 'full', available: stated, tasks: [...cday.tasks], busy: cday.busy,
    moved: [], windDown: windDownGoals(s.goals, date).map((g) => g.id), sittings: info.sittings, notes: [], squeezed: false, overloaded: cday.overloaded,
  }
  // Exam day and the day after: nothing planned.
  if (info.type === 'exam' || info.type === 'rest') return plan

  let left = Math.max(0, stated - cday.busy - committed) + (opts.extraMinutes ?? 0)
  // The day before an exam: one light review, nothing else.
  if (info.type === 'eve') {
    plan.tasks = [...cday.tasks, ...eveTasks(s, date, info.sittings, stated, left)]
    return plan
  }

  const goals = activeGoals(s.goals, date).filter((g) => studies(g, date))
  const byId = new Map(goals.map((g) => [g.id, g]))
  const paused = (goalId: string) => !byId.has(goalId) || isPaused(s, byId.get(goalId)!, date)
  const est = estimates(s)
  const perQ = (r: Resource) => r.minutesPerUnit * est.questions

  // 1. Anki: Anki decides what's due; we reserve the time. The last thing cut: shortened before it's dropped.
  const anki: Task[] = []
  if (s.anki && byId.has(s.anki.goalId) && stated > 0) {
    const goal = byId.get(s.anki.goalId)!
    const minutes = Math.min(s.anki.reviewMinutes, floorTo5(left))
    if (minutes >= Math.min(ANKI_MIN_MINUTES, s.anki.reviewMinutes)) {
      const short = minutes < s.anki.reviewMinutes
      const perDay = short || paused(goal.id) ? 0 : Math.ceil(s.anki.newCardsLeft / Math.max(1, daysBetween(date, goal.examDate)))
      anki.push({
        id: `${date}-anki`,
        date,
        kind: 'anki',
        goalId: goal.id,
        title: 'Anki reviews',
        detail: perDay > 0 ? `+ ${perDay} new cards` : short ? 'Reviews only today' : undefined,
        reason: short ? 'As much as fits today; no new cards' : reasons.ankiNew(perDay),
        minutes,
        amount: perDay,
        status: 'pending',
      })
      left -= minutes
      if (short) plan.notes.push('ankiShortened')
      if (left < MIN_TASK_MINUTES) plan.notes.push('ankiFillsDay')
    }
  }

  // 2. Fixes and retests that are due. Overdue ones roll forward; paused goals' wait for the exam to pass.
  const dueAll = s.scheduled.filter((t) => t.status === 'pending' && t.date <= date && (t.kind === 'fix' || t.kind === 'retest'))
  if (dueAll.some((t) => byId.has(t.goalId) && paused(t.goalId))) plan.notes.push('paused')
  const due = dueAll
    .filter((t) => byId.has(t.goalId) && !paused(t.goalId) && (t.kind !== 'retest' || retestReady(t, s.scheduled)))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => ({ ...t, date, reason: t.kind === 'retest' ? reasons.retestDue(t.date, date, t.retestRound) : t.reason }))
  const nearest = goals.find(isFirm)
  const open = openLoopTopicIds(s.scheduled).size
  const backlog = open > MAX_OPEN_LOOPS
  const loopBudget = left * (backlog ? FIXLOOP_SHARE_BACKLOG : FIXLOOP_SHARE)
  const limit = backlog ? BACKLOG_LIMIT_FACTOR : 1
  const fixes: Task[] = []
  const retests: Task[] = []
  let loopUsed = 0
  const take = (t: Task, list: Task[]) => {
    list.push(t)
    left -= t.minutes
    loopUsed += t.minutes
  }
  // Due retests for the nearest exam are protected: they only need to fit in the day.
  for (const t of due.filter((x) => x.kind === 'retest' && x.goalId === nearest?.id)) if (t.minutes <= left) take(t, retests)
  const within = (t: Task) => t.minutes <= left && loopUsed + t.minutes <= loopBudget
  for (const t of due.filter((x) => x.kind === 'retest' && !retests.includes(x))) if (retests.length < MAX_RETESTS_PER_DAY * limit && within(t)) take(t, retests)
  for (const t of due.filter((x) => x.kind === 'fix')) if (fixes.length < MAX_FIXES_PER_DAY * limit && within(t)) take(t, fixes)
  // A short day whose share never holds one item: every other day the oldest one goes first, so nothing waits forever.
  if (fixes.length + retests.length === 0 && due.length > 0 && dayNumber(date) % 2 === 0) {
    const t = due.find((x) => x.minutes <= left)
    if (t) take(t, t.kind === 'fix' ? fixes : retests)
  }
  plan.moved = due.filter((t) => !fixes.includes(t) && !retests.includes(t)).map((t) => ({ ...t, date: addDays(date, 1) }))
  if (plan.moved.length) plan.notes.push('moved')

  // 3. Goal study, shared by urgency (spec 4): the nearest firm exam takes what it needs per day first,
  //    up to SOONEST_MAX_SHARE of what's left; then the next; the last goal takes the rest.
  const needs = goalNeeds(s, date)
    .filter((n) => !paused(n.goal.id) && (n.left > 0 || n.reviewOnly))
    .sort((a, b) => Number(!isFirm(a.goal)) - Number(!isFirm(b.goal)) || a.goal.examDate.localeCompare(b.goal.examDate))
  const budgets = new Map<string, number>()
  if (left >= MIN_TASK_MINUTES) {
    // Firm exams within CLOSE_EXAMS_DAYS of each other form one group and split its time by need.
    const groups: (typeof needs)[] = []
    for (const n of needs) {
      const g = groups.at(-1)
      if (g && isFirm(n.goal) && isFirm(g[0].goal) && daysBetween(g[0].goal.examDate, n.goal.examDate) <= CLOSE_EXAMS_DAYS) g.push(n)
      else groups.push([n])
    }
    let pool = left
    groups.forEach((group, gi) => {
      const need = group.reduce((m, n) => m + n.need, 0)
      const last = gi === groups.length - 1
      const total = last ? pool : Math.min(Math.ceil(need / 5) * 5, pool * SOONEST_MAX_SHARE)
      let used = 0
      group.forEach((n, i) => {
        const room = pool - used
        let mine = Math.min(room, i === group.length - 1 ? Math.max(0, total - used) : need > 0 ? (total * n.need) / need : 0)
        // A share too small to hold one task is saved up: planned every k-th day with a task's worth.
        const chunk = Math.min(room, minChunk(s, n.goal, est.lectures))
        if (mine < chunk && !(last && group.length === 1)) {
          const k = Math.min(MAX_GOAL_SKIP_DAYS + 1, Math.ceil(chunk / Math.max(1, mine)))
          mine = (dayNumber(date) + i) % k === 0 ? chunk : 0
        }
        budgets.set(n.goal.id, mine)
        used += mine
      })
      pool -= used
    })
  }

  const work = new Map<string, Task[]>()
  const blocks: { task: Task; resource: Resource }[] = []
  // Goals with counted material (lectures, papers) take what they need first; what they can't use
  // passes on, and the topic goal, which can always use time, goes last.
  const capped = (g: Goal) => s.resources.some((r) => r.goalId === g.id && (r.type === 'slides' || r.type === 'papers'))
  const order = [...needs].sort((a, b) => Number(!capped(a.goal) || a.goal.id === s.topicGoalId) - Number(!capped(b.goal) || b.goal.id === s.topicGoalId))
  let carry = 0
  for (const { goal, days } of order) {
    let budget = Math.min(left, (budgets.get(goal.id) ?? 0) + carry)
    const start = budget
    const list: Task[] = []
    const examReason = reasons.examSoon(goal.label, daysBetween(date, goal.examDate))

    if (capped(goal)) {
      const uni = uniWork(s.resources, goal, date, budget, days, est.lectures, examReason, needs.length === 1 ? (plan.windDown.includes(goal.id) ? 'windDown' : 'alone') : 'shared')
      list.push(...uni.tasks)
      budget -= uni.used
    }

    const qbank = s.resources.find((x) => x.goalId === goal.id && x.type === 'qbank' && unitsLeft(x) > 0)
    let topicsLeft = false
    if (goal.id === s.topicGoalId) {
      const queue = topicQueue(s, date)
      let started = 0
      for (const t of queue) {
        if (budget < MIN_TASK_MINUTES) break
        const fresh = !isStarted(t)
        if (fresh && started >= MAX_NEW_TOPICS_PER_DAY) break
        // A long topic is planned in parts of at most TOPIC_TASK_MAX_MINUTES, back to back while the day has room.
        let cur = t
        let n = 0
        for (;;) {
          // Only the day's first topic may split a long item; later ones wait for a day they fit.
          const slice = sliceTopic(cur, Math.min(budget, TOPIC_TASK_MAX_MINUTES), est.topic, list.length === 0)
          if (!slice || slice.minutes > budget) break
          const task = topicTask(s, cur, slice, date)
          if (n > 0) task.id = `${task.id}-p${n + 1}`
          list.push(task)
          budget -= slice.minutes
          n++
          if (slice.ends || slice.partialMinutes !== undefined || budget < MIN_TASK_MINUTES) break
          cur = applyTopicCompletion(cur, task, 'done', est.topic)
        }
        if (n === 0) break
        if (fresh) started++
      }
      // Topics still to study and the day isn't long → no separate question block today.
      topicsLeft = queue.length > 0 && started < MAX_NEW_TOPICS_PER_DAY
    }

    // Question blocks: once topics are covered, on long days, or for students who study by questions only.
    if (qbank && !topicsLeft) {
      let remaining = unitsLeft(qbank) - list.reduce((n, t) => n + (t.resourceId === qbank.id ? t.amount ?? 0 : 0), 0)
      for (let i = 0; i < MAX_BLOCKS_PER_DAY; i++) {
        let n = Math.min(QBANK_MAX, floorTo5(budget / perQ(qbank)), remaining)
        while (n > 0 && blockMinutes(n, perQ(qbank)) > budget) n -= Math.min(n, 5)
        if (!(n >= QBANK_MIN || (n > 0 && n >= remaining))) break
        const pick = pickSystem(s, date)
        const task: Task = {
          id: `${date}-${qbank.id}${i ? `-${i + 1}` : ''}`,
          date,
          kind: 'study',
          goalId: goal.id,
          resourceId: qbank.id,
          system: i === 0 ? pick.system : MIXED_SYSTEM,
          title: blockTitle(qbank, n, i === 0 ? pick.system : MIXED_SYSTEM),
          detail: i > 0 || pick.system === MIXED_SYSTEM ? 'Mixed, all systems · timed' : 'Timed block',
          reason: i === 0 ? pick.reason : 'A second block, mixed: switching between systems is how the exam asks',
          minutes: blockMinutes(n, perQ(qbank)),
          amount: n,
          status: 'pending',
        }
        list.push(task)
        blocks.push({ task, resource: qbank })
        budget -= task.minutes
        remaining -= n
      }
    }
    work.set(goal.id, list)
    left -= start - budget
    carry = budget
  }

  // 4. Leftover time grows the first question block.
  for (const { task, resource } of blocks) {
    if (left < perQ(resource) * 5) break
    const room = floorTo5(left / perQ(resource))
    const planned = blocks.filter((b) => b.resource.id === resource.id).reduce((n, b) => n + (b.task.amount ?? 0), 0)
    const extra = Math.min(room, QBANK_MAX - (task.amount ?? 0), unitsLeft(resource) - planned)
    if (extra <= 0) continue
    const grown = blockMinutes((task.amount ?? 0) + extra, perQ(resource))
    if (grown - task.minutes > left) continue
    left -= grown - task.minutes
    task.amount = (task.amount ?? 0) + extra
    task.minutes = grown
    task.title = blockTitle(resource, task.amount, task.system ?? MIXED_SYSTEM)
  }

  // On screen: Anki → deadline work → the nearest exam's study → fixes → retests → later exams' study.
  const first = goals[0] ? work.get(goals[0].id) ?? [] : []
  const later = goals.slice(1).flatMap((g) => work.get(g.id) ?? [])
  const study = [...first, ...later]
  plan.squeezed = cday.busy + committed > 0 && left < MIN_TASK_MINUTES && study.length === 0
  if (plan.squeezed) plan.notes.push('squeezed')
  plan.tasks = [...anki, ...cday.tasks, ...first, ...fixes, ...retests, ...later]

  // 5. An accepted light day cuts the list; what's cut stays in the state for the coming days.
  const offer = opts.ignoreLight ? undefined : (s.lightOffers ?? []).find((o) => o.date === date && (o.answer === 'light' || o.answer === 'rest'))
  if (offer?.answer === 'rest') {
    plan.mode = 'rest'
    plan.tasks = [...cday.tasks]
  } else if (offer && offer.kind !== 'firstOnly') {
    plan.mode = offer.kind === 'essentials' ? 'essentials' : 'light'
    plan.tasks = lightTasks(s, plan.tasks, offer.kind)
  }
  return plan
}

export function totalMinutes(tasks: Task[]): number {
  return tasks.reduce((n, t) => n + t.minutes, 0)
}

/** One topic task from a slice. A fully watched topic is a short check: just its questions. */
export function topicTask(s: EngineState, t: Topic, slice: TopicSlice, date: ISODate): Task {
  const qbank = s.resources.find((x) => x.goalId === s.topicGoalId && x.type === 'qbank' && x.doneUnits < x.totalUnits)
  const check = isAllWatched(t) && slice.items.every((x) => x.source === 'qbank')
  // An unfinished topic comes back as "part 2", "part 3", with how far it is.
  const part = slice.continues ? Math.max(2, (t.parts ?? 0) + 1) : undefined
  const p = topicProgress(t)
  const progress = slice.continues ? `${p.done} of ${p.total} steps done` : undefined
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
    detail: part ? `Part ${part} · ${progress}` : slice.ends ? undefined : 'Continues next time',
    part,
    progress,
    partialMinutes: slice.partialMinutes,
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
    const slice = t ? sliceTopic(t, task.minutes, factor, true) : null
    return t && slice ? [topicTask(s, t, slice, date)] : []
  })
}
