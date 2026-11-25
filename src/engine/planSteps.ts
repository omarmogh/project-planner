// The steps of one day's plan (docs/ENGINE_SPEC.md section 3), one function each.
// buildDay (plan.ts) calls them in order. All of them share one DayCtx: the state, the date,
// what the day has left, and what the earlier steps decided. Pure: nothing here reads a clock.

import { boardSessions, recentAccuracy } from './accuracy'
import { dayContext, statedMinutes } from './availability'
import { commitmentDay, type CommitmentDay } from './commitments'
import {
  ANKI_MAX_NEW_PER_DAY, ANKI_MIN_MINUTES, ANKI_NEW_MIN_HORIZON_DAYS, ANKI_NO_NEW_BEFORE_EXAM_DAYS, BACKLOG_LIMIT_FACTOR, BACKLOG_NEW_TOPICS_PER_DAY,
  BLOCK_SAME_SYSTEM_DAYS, CLOSE_EXAMS_DAYS, EVE_MAX_MINUTES, EVE_MAX_SHARE, EVE_MIN_MINUTES, EVE_TOPICS, FIX_PARTLY_MIN_MINUTES, FIXLOOP_SHARE,
  FIXLOOP_SHARE_BACKLOG, MAX_BLOCKS_PER_DAY, MAX_FIXES_PER_DAY, MAX_GOAL_SKIP_DAYS, MAX_NEW_TOPICS_PER_DAY, MAX_OPEN_LOOPS, MAX_RETESTS_PER_DAY,
  MIN_GOAL_CHUNK, MIN_TASK_MINUTES, MIXED_SYSTEM, QBANK_MAX, QBANK_MIN, SOONEST_MAX_SHARE, TOPIC_TASK_MAX_MINUTES, WEAK_BELOW,
  BOARD_SHARE_WHILE_UNI_LEADS, EARLY_BLOCK_DAYS, EARLY_BLOCK_QUESTIONS,
} from './config'
import { addDays, daysBetween } from './dates'
import { estimates, type Estimates } from './estimates'
import { activeGoals, dayInfo, isPaused, studies, windDownGoals, type DayInfo, type Sitting } from './exams'
import { openLoopTopicIds, retestReady } from './fixes'
import { lightTasks } from './lightday'
import { goalNeeds, leadingUni, unitsLeft, type GoalNeed } from './pace'
import type { BuildOptions, DayPlan } from './plan'
import { inSentence, listJoin, reasons } from './reasons'
import {
  applyTopicCompletion, isAllWatched, isStarted, sliceTopic, stepLines, topicProgress, topicQueue, topicTitle, type TopicSlice,
} from './topics'
import { isFirm, type EngineState, type Goal, type ISODate, type Resource, type Task, type Topic } from './types'
import { growUni, liveTopics, lectureMinutes as lectureMin, lecturesLeft as lecturesRemaining, uniWork } from './uni'

const floorTo5 = (n: number) => Math.floor(n / 5) * 5
/** Minutes for a block of n questions, rounded up to 5. */
const blockMinutes = (n: number, perQ: number) => Math.ceil((n * perQ) / 5 - 1e-9) * 5
/** Days since a fixed date: a stable counter for "every 2nd / 3rd day" decisions. */
const dayNumber = (date: ISODate) => daysBetween('2000-01-01', date)

/** What every step of a day shares. `left` is the study time the day still has; steps spend it. */
export interface DayCtx {
  s: EngineState
  date: ISODate
  opts: BuildOptions
  /** The student's stated minutes for the day. */
  stated: number
  info: DayInfo
  cday: CommitmentDay
  /** Minutes of today's deadline work. */
  committed: number
  plan: DayPlan
  /** Goals still studying today, nearest exam first. */
  goals: Goal[]
  byId: Map<string, Goal>
  /** Not studying today: its exam is over, or a uni wind-down pauses it. */
  paused: (goalId: string) => boolean
  /** Fixes and retests that are due, whatever their goal. */
  dueAll: Task[]
  /** Due and allowed today (goal running, not paused, retest's fix done), oldest first. */
  due: Task[]
  /** The same tasks, dated tomorrow: what "moved" shows. */
  tomorrow: (list: Task[]) => Task[]
  est: Estimates
  perQ: (r: Resource) => number
  /** More topics are waiting for a fix or retest than MAX_OPEN_LOOPS. */
  backlog: boolean
  left: number
}

/** Step 0: the state of the day before any task is planned. */
export function openDay(s: EngineState, date: ISODate, opts: BuildOptions): DayCtx {
  const stated = statedMinutes(s.availability, date)
  const info = dayInfo(s.goals, date)
  // Commitments come first: busy time shrinks the day, deadline work takes its share.
  const cday = commitmentDay(s, date)
  const committed = cday.tasks.reduce((n, t) => n + t.minutes, 0)
  const plan: DayPlan = {
    date, kind: dayContext(s.availability, date).kind, type: info.type, mode: 'full', available: stated,
    tasks: [...cday.tasks], busy: cday.busy, moved: [], windDown: windDownGoals(s.goals, date).map((g) => g.id), sittings: info.sittings, notes: [],
    squeezed: false, overloaded: cday.overloaded,
  }
  const goals = activeGoals(s.goals, date).filter((g) => studies(g, date))
  const byId = new Map(goals.map((g) => [g.id, g]))
  const paused = (goalId: string) => !byId.has(goalId) || isPaused(s, byId.get(goalId)!, date)
  // Overdue fixes and retests roll forward; a paused goal's wait for the exam to pass.
  const dueAll = s.scheduled.filter((t) => t.status === 'pending' && t.date <= date && (t.kind === 'fix' || t.kind === 'retest'))
  const due = dueAll
    .filter((t) => byId.has(t.goalId) && !paused(t.goalId) && (t.kind !== 'retest' || retestReady(t, s.scheduled)))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => ({ ...t, date, reason: t.kind === 'retest' ? reasons.retestDue(t.date, date, t.retestRound) : t.reason }))
  const est = estimates(s)
  return {
    s, date, opts, stated, info, cday, committed, plan, goals, byId, paused, dueAll, due,
    tomorrow: (list) => list.map((t) => ({ ...t, date: addDays(date, 1) })),
    est, perQ: (r) => r.minutesPerUnit * est.questions,
    backlog: openLoopTopicIds(s.scheduled).size > MAX_OPEN_LOOPS,
    left: opts.roomMinutes ?? Math.max(0, stated - cday.busy - committed - (opts.spentMinutes ?? 0)) + (opts.extraMinutes ?? 0),
  }
}

/** Steps 1–2 on an exam day or the day after: nothing is planned, and what is due waits. */
export function quietDay(c: DayCtx): DayPlan {
  c.plan.moved = c.tomorrow(c.due)
  return c.plan
}

/** The light review on the day before an exam (spec 5.1). */
function eveTasks(s: EngineState, date: ISODate, sittings: Sitting[], stated: number, left: number): Task[] {
  const goals = [...new Map(sittings.map((x) => [x.goal.id, x])).values()]
  const each = Math.min(EVE_MAX_MINUTES, floorTo5((stated * EVE_MAX_SHARE) / goals.length), floorTo5(left / goals.length))
  if (each < EVE_MIN_MINUTES) return []
  return goals.map(({ goal, label }) => {
    // Only the board's own open topics: a uni topic (or one of an exam already sat) never names the board's review.
    const weak = liveTopics(s, date).filter((t) => !t.dropped && !t.wholeSystem && !t.id.startsWith('uni-') && (t.status === 'weak' || t.status === 'fixing'))
    const board = goal.id === s.topicGoalId
    const names = weak.slice(0, EVE_TOPICS).map((t) => inSentence(t.name))
    return {
      id: `${date}-eve-${goal.id}`,
      date,
      kind: 'review' as const,
      goalId: goal.id,
      topicIds: board ? weak.slice(0, EVE_TOPICS).map((t) => t.id) : undefined,
      title: board && names.length ? `Light review: ${listJoin(names)}` : board ? 'Light review: what felt shaky this week' : 'Light review: your past-paper mistakes and your own notes',
      detail: 'Then stop, and sleep early if you can',
      reason: `${label} is tomorrow`,
      minutes: each,
      status: 'pending' as const,
    }
  })
}

/** Step 4 (the day before an exam): one light review, nothing else. What is due waits. */
export function eveDay(c: DayCtx): DayPlan {
  c.plan.tasks = [...c.cday.tasks, ...eveTasks(c.s, c.date, c.info.sittings, c.stated, c.left)]
  c.plan.moved = c.tomorrow(c.due)
  return c.plan
}

/** Step 5: Anki. Anki decides what's due; we reserve the time. The last thing cut: shortened before it's dropped. */
export function ankiStep(c: DayCtx): Task[] {
  const { s, date, plan } = c
  const reviews = s.anki ? Math.ceil(s.anki.reviewMinutes / 5) * 5 : 0
  if (!s.anki || !c.byId.has(s.anki.goalId) || c.stated <= 0 || reviews <= 0) return []
  const goal = c.byId.get(s.anki.goalId)!
  const minutes = Math.min(reviews, floorTo5(c.left))
  if (minutes < Math.min(ANKI_MIN_MINUTES, reviews)) return []
  const short = minutes < reviews
  const daysToExam = daysBetween(date, goal.examDate)
  // New cards: spread to the exam (over a minimum horizon when the date isn't firm), never more than
  // fits the review time, and none on a short day, in a wind-down or right before a firm exam.
  const horizon = isFirm(goal) ? Math.max(1, daysToExam) : Math.max(ANKI_NEW_MIN_HORIZON_DAYS, daysToExam)
  const wanted = Math.ceil(s.anki.newCardsLeft / horizon)
  const none = short || c.paused(goal.id) || (isFirm(goal) && daysToExam <= ANKI_NO_NEW_BEFORE_EXAM_DAYS)
  const perDay = none ? 0 : Math.min(ANKI_MAX_NEW_PER_DAY, wanted)
  const capped = !none && wanted > ANKI_MAX_NEW_PER_DAY
  c.left -= minutes
  if (short) plan.notes.push('ankiShortened')
  if (c.left < MIN_TASK_MINUTES) plan.notes.push('ankiFillsDay')
  return [{
    id: `${date}-anki`,
    date,
    kind: 'anki',
    goalId: goal.id,
    title: 'Anki reviews',
    detail: perDay > 0 ? `+ ${perDay} new cards` : short ? 'Reviews only today' : undefined,
    reason: short ? 'As much as fits today; no new cards'
      : capped && !s.anki.newCardsUnsure ? `${perDay} new cards a day is what fits; the deck won't all be seen before the exam`
        : reasons.ankiNew(perDay, !!s.anki.newCardsUnsure),
    minutes,
    amount: perDay,
    status: 'pending',
  }]
}

/** Steps 6–7: due retests, then due fixes, inside their daily limits (spec 6). */
export function loopStep(c: DayCtx): { fixes: Task[]; retests: Task[] } {
  const { date, due, plan } = c
  if (c.dueAll.some((t) => c.byId.has(t.goalId) && c.paused(t.goalId))) plan.notes.push('paused')
  const nearest = c.goals.find(isFirm)
  const loopBudget = c.left * (c.backlog ? FIXLOOP_SHARE_BACKLOG : FIXLOOP_SHARE)
  const limit = BACKLOG_LIMIT_FACTOR
  const fixes: Task[] = []
  const retests: Task[] = []
  const guarded: Task[] = []
  let loopUsed = 0
  const take = (t: Task, list: Task[]) => {
    list.push(t)
    c.left -= t.minutes
    if (list !== guarded) loopUsed += t.minutes
  }
  // Due retests for the nearest exam are protected: outside the count and share limits, they only need to fit.
  for (const t of due.filter((x) => x.kind === 'retest' && x.goalId === nearest?.id)) if (t.minutes <= c.left) take(t, guarded)
  const within = (t: Task) => t.minutes <= c.left && loopUsed + t.minutes <= loopBudget
  for (const t of due.filter((x) => x.kind === 'retest' && !guarded.includes(x))) if (retests.length < MAX_RETESTS_PER_DAY * limit && within(t)) take(t, retests)
  for (const t of due.filter((x) => x.kind === 'fix')) if (fixes.length < MAX_FIXES_PER_DAY * limit && within(t)) take(t, fixes)
  // A short day whose share never holds one item: every other day the oldest one goes first, so nothing
  // waits forever. A fix too long for the whole day is shortened to what the day has.
  if (fixes.length + retests.length + guarded.length === 0 && due.length > 0 && dayNumber(date) % 2 === 0) {
    const t = due.find((x) => x.minutes <= c.left)
    const fix = due.find((x) => x.kind === 'fix')
    if (t) take(t, t.kind === 'fix' ? fixes : retests)
    else if (fix && floorTo5(c.left) >= FIX_PARTLY_MIN_MINUTES) take({ ...fix, minutes: floorTo5(c.left) }, fixes)
  }
  retests.unshift(...guarded)
  const taken = new Set([...fixes, ...retests].map((t) => t.id))
  plan.moved = c.tomorrow(due.filter((t) => !taken.has(t.id)))
  if (plan.moved.length) plan.notes.push('moved')
  return { fixes, retests }
}

/** Which goals have work today and how urgent it is: nearest firm exam first. */
export function needsStep(c: DayCtx): GoalNeed[] {
  return goalNeeds(c.s, c.date)
    .filter((n) => !c.paused(n.goal.id) && (n.left > 0 || n.reviewOnly))
    .sort((a, b) => Number(!isFirm(a.goal)) - Number(!isFirm(b.goal)) || a.goal.examDate.localeCompare(b.goal.examDate))
}

/** The smallest budget that holds one task for this goal: a lecture for a uni goal, MIN_GOAL_CHUNK otherwise. */
function minChunk(s: EngineState, goal: Goal, lectureFactor: number): number {
  const slides = s.resources.filter((r) => r.goalId === goal.id && r.type === 'slides' && lecturesRemaining(r) > 0)
  return Math.max(MIN_GOAL_CHUNK, ...slides.map((r) => lectureMin(r, 1, lectureFactor)))
}

export { leadingUni }

/**
 * Step 8a: share the time left between goals (spec 4). The nearest firm exam takes what it needs per day,
 * up to SOONEST_MAX_SHARE of what's left; exams close together split by need; the last goal takes the rest.
 */
export function shareStep(c: DayCtx, needs: GoalNeed[]): Map<string, number> {
  const budgets = new Map<string, number>()
  if (c.left < MIN_TASK_MINUTES) return budgets
  // Firm exams within CLOSE_EXAMS_DAYS of each other form one group and split its time by need.
  const groups: GoalNeed[][] = []
  for (const n of needs) {
    const g = groups.at(-1)
    if (g && isFirm(n.goal) && isFirm(g[0].goal) && daysBetween(g[0].goal.examDate, n.goal.examDate) <= CLOSE_EXAMS_DAYS) g.push(n)
    else groups.push([n])
  }
  let pool = c.left
  const lead = leadingUni(needs, c.date)
  groups.forEach((group, gi) => {
    const need = group.reduce((m, n) => m + n.need, 0)
    const last = gi === groups.length - 1
    // An exam that needs the whole day (or more) gets it: a later goal waits rather than take from it.
    // A leading uni exam may take all but the board goal's small share; what it can't use is passed on (studyStep).
    const cap = gi === 0 && lead ? Math.max(Math.ceil(need / 5) * 5, floorTo5(pool * (1 - BOARD_SHARE_WHILE_UNI_LEADS))) : Math.min(Math.ceil(need / 5) * 5, pool * SOONEST_MAX_SHARE)
    const total = last || need >= pool ? pool : Math.min(pool, cap)
    let used = 0
    group.forEach((n, i) => {
      const room = pool - used
      let mine = Math.min(room, i === group.length - 1 ? Math.max(0, total - used) : need > 0 ? (total * n.need) / need : 0)
      // A share too small to hold one task is saved up: planned every k-th day with a task's worth.
      const chunk = Math.min(room, minChunk(c.s, n.goal, c.est.lectures))
      if (mine < chunk && !(last && group.length === 1)) {
        const k = Math.min(MAX_GOAL_SKIP_DAYS + 1, Math.ceil(chunk / Math.max(1, mine)))
        mine = (dayNumber(c.date) + i) % k === 0 ? chunk : 0
      }
      budgets.set(n.goal.id, mine)
      used += mine
    })
    pool -= used
  })
  return budgets
}

/** Which system a standalone question block targets. Weak and not the same one day after day, else mixed. */
function pickSystem(s: EngineState, date: ISODate): { system: string; reason: string } {
  const acc = recentAccuracy(boardSessions(s), date)
  if (acc.length === 0) return { system: MIXED_SYSTEM, reason: reasons.noAccuracyYet() }
  const recent = (sys: string) => {
    let n = 0
    for (let i = 1; i <= BLOCK_SAME_SYSTEM_DAYS; i++) {
      if (s.sessions.some((x) => x.date === addDays(date, -i) && x.kind === 'study' && x.system === sys && !x.topicIds?.length && x.questions)) n++
    }
    return n >= BLOCK_SAME_SYSTEM_DAYS
  }
  const pick = acc.find((a) => a.pct < WEAK_BELOW && !recent(a.system))
  if (pick) return { system: pick.system, reason: reasons.lowestAccuracy(pick.pct) }
  return { system: MIXED_SYSTEM, reason: 'Mixed: every system gets a turn, the way the exam asks' }
}

/** "UWorld: 20 Cardio questions + review", "UWorld: 20 mixed questions + review". */
function blockTitle(r: Resource, n: number, system: string): string {
  return `${r.name}: ${n} ${system === MIXED_SYSTEM ? 'mixed' : system} questions + review`
}

/** "Heart failure: 10 UWorld questions". */
export function checkTitle(name: string, questions: number, qbankName = 'UWorld'): string {
  return `${name}: ${questions} ${qbankName} ${questions === 1 ? 'question' : 'questions'}`
}

/** A topic goal's topic tasks: topics in queue order, long ones in parts. Returns what is left of the budget. */
function topicStep(c: DayCtx, list: Task[], budget: number): { budget: number; topicsLeft: boolean } {
  const { s, date, est } = c
  const queue = topicQueue(s, date)
  let started = 0
  for (const t of queue) {
    if (budget < MIN_TASK_MINUTES) break
    const fresh = !isStarted(t)
    if (fresh && started >= (c.backlog ? BACKLOG_NEW_TOPICS_PER_DAY : MAX_NEW_TOPICS_PER_DAY)) break
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
  return { budget, topicsLeft: queue.length > 0 && started < MAX_NEW_TOPICS_PER_DAY && !c.backlog }
}

/** Question blocks: once topics are covered, on long days, or for students who study by questions only. */
function blockStep(c: DayCtx, goal: Goal, qbank: Resource, list: Task[], blocks: { task: Task; resource: Resource }[], budget: number): number {
  const { s, date } = c
  const perQ = c.perQ(qbank)
  let remaining = unitsLeft(qbank) - list.reduce((n, t) => n + (t.resourceId === qbank.id ? t.amount ?? 0 : 0), 0)
  for (let i = 0; i < MAX_BLOCKS_PER_DAY; i++) {
    let n = Math.min(QBANK_MAX, floorTo5(budget / perQ), remaining)
    while (n > 0 && blockMinutes(n, perQ) > budget) n -= Math.min(n, 5)
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
      minutes: blockMinutes(n, perQ),
      amount: n,
      status: 'pending',
    }
    list.push(task)
    blocks.push({ task, resource: qbank })
    budget -= task.minutes
    remaining -= n
  }
  return budget
}

/**
 * Early loop: no question block done in Locus yet on this qbank, and still within the goal's first
 * EARLY_BLOCK_DAYS study days. Then one short block is planned even while topics are still new.
 */
function wantsEarlyBlock(s: EngineState, goal: Goal, qbank: Resource, date: ISODate): boolean {
  // Only days studied in Locus count: an imported or outside result isn't a study day here.
  const mine = s.sessions.filter((x) => x.goalId === goal.id && !x.imported && !x.outside && x.date < date)
  if (mine.some((x) => x.resourceId === qbank.id && (x.questions ?? 0) > 0)) return false
  return new Set(mine.map((x) => x.date)).size < EARLY_BLOCK_DAYS
}

/**
 * Step 8b: each goal's own work, from its share of the time. Goals with counted material (lectures, papers)
 * go first and pass on what they can't use; the topic goal, which can always use time, goes last.
 */
export function studyStep(c: DayCtx, needs: GoalNeed[], budgets: Map<string, number>): { work: Map<string, Task[]>; blocks: { task: Task; resource: Resource }[] } {
  const { s, date, est } = c
  const work = new Map<string, Task[]>()
  const blocks: { task: Task; resource: Resource }[] = []
  const capped = (g: Goal) => s.resources.some((r) => r.goalId === g.id && (r.type === 'slides' || r.type === 'papers'))
  const order = [...needs].sort((a, b) => Number(!capped(a.goal) || a.goal.id === s.topicGoalId) - Number(!capped(b.goal) || b.goal.id === s.topicGoalId))
  let carry = 0
  const lead = leadingUni(needs, date)
  for (const { goal, days } of order) {
    let budget = Math.min(c.left, (budgets.get(goal.id) ?? 0) + carry)
    let start = budget
    const list: Task[] = []
    const examReason = reasons.examSoon(goal.label, daysBetween(date, goal.examDate), goal.dateSource === 'assumed')

    if (capped(goal)) {
      const mode = c.plan.windDown.includes(goal.id) && needs.length === 1 ? 'windDown' : needs.length === 1 || lead?.id === goal.id ? 'alone' : 'shared'
      const uni = uniWork(s.resources, goal, date, budget, days, est.lectures, lead?.id === goal.id ? reasons.uniLeads(goal.label, daysBetween(date, goal.examDate)) : examReason, mode)
      list.push(...uni.tasks)
      budget -= uni.used
    }

    const qbank = s.resources.find((x) => x.goalId === goal.id && x.type === 'qbank' && unitsLeft(x) > 0)
    let topicsLeft = false
    // Early loop: keep room for a short first block so the first fix comes from a real score.
    const earlyMin = qbank && goal.id === s.topicGoalId && wantsEarlyBlock(s, goal, qbank, date) ? blockMinutes(Math.min(EARLY_BLOCK_QUESTIONS, unitsLeft(qbank)), c.perQ(qbank)) : 0
    const reserve = earlyMin > 0 && earlyMin <= c.left ? earlyMin : 0
    if (reserve > budget) {
      start += reserve - budget
      budget = reserve
    }
    if (goal.id === s.topicGoalId) {
      const t = topicStep(c, list, budget - reserve)
      budget = t.budget + reserve
      topicsLeft = t.topicsLeft
    }
    if (qbank && !topicsLeft) budget = blockStep(c, goal, qbank, list, blocks, budget)
    else if (qbank && reserve) {
      const before = list.length
      budget = budget - reserve + blockStep(c, goal, qbank, list, blocks, reserve)
      for (const t of list.slice(before)) t.reason = reasons.earlyBlock()
    }

    work.set(goal.id, list)
    c.left -= start - budget
    carry = budget
  }
  return { work, blocks }
}

/**
 * Step 9: leftover time grows the first question block, then a uni goal's whole lectures and a past paper
 * (nearest exam first). The day never goes past its time.
 */
export function growStep(c: DayCtx, blocks: { task: Task; resource: Resource }[], work: Map<string, Task[]> = new Map()): void {
  growBlocks(c, blocks)
  for (const goal of c.goals) {
    if (c.left < MIN_TASK_MINUTES) break
    const list = work.get(goal.id)
    if (!list || !c.s.resources.some((r) => r.goalId === goal.id && (r.type === 'slides' || r.type === 'papers'))) continue
    c.left -= growUni(c.s.resources, goal, c.date, list, floorTo5(c.left), c.est.lectures, reasons.examSoon(goal.label, daysBetween(c.date, goal.examDate), goal.dateSource === 'assumed'))
  }
}

function growBlocks(c: DayCtx, blocks: { task: Task; resource: Resource }[]): void {
  for (const { task, resource } of blocks) {
    const perQ = c.perQ(resource)
    if (c.left < perQ * 5) break
    const room = floorTo5(c.left / perQ)
    const planned = blocks.filter((b) => b.resource.id === resource.id).reduce((n, b) => n + (b.task.amount ?? 0), 0)
    const extra = Math.min(room, QBANK_MAX - (task.amount ?? 0), unitsLeft(resource) - planned)
    if (extra <= 0) continue
    const grown = blockMinutes((task.amount ?? 0) + extra, perQ)
    if (grown - task.minutes > c.left) continue
    c.left -= grown - task.minutes
    task.amount = (task.amount ?? 0) + extra
    task.minutes = grown
    task.title = blockTitle(resource, task.amount, task.system ?? MIXED_SYSTEM)
  }
}

/** Step 10: put the day in screen order, note a squeezed day, and apply an accepted light day. */
export function finishDay(c: DayCtx, anki: Task[], loop: { fixes: Task[]; retests: Task[] }, work: Map<string, Task[]>): DayPlan {
  const { s, date, plan, cday } = c
  // On screen: Anki → deadline work → the nearest exam's study → fixes → retests → later exams' study.
  const first = c.goals[0] ? work.get(c.goals[0].id) ?? [] : []
  const later = c.goals.slice(1).flatMap((g) => work.get(g.id) ?? [])
  const study = [...first, ...later]
  plan.squeezed = cday.busy + c.committed > 0 && c.left < MIN_TASK_MINUTES && study.length === 0
  if (plan.squeezed) plan.notes.push('squeezed')
  plan.tasks = [...anki, ...cday.tasks, ...first, ...loop.fixes, ...loop.retests, ...later]

  // An accepted light day cuts the list; what's cut stays in the state for the coming days.
  const offer = c.opts.ignoreLight ? undefined : (s.lightOffers ?? []).find((o) => o.date === date && (o.answer === 'light' || o.answer === 'rest'))
  if (offer?.answer === 'rest') {
    plan.mode = 'rest'
    plan.tasks = [...cday.tasks]
  } else if (offer && offer.kind !== 'firstOnly') {
    plan.mode = offer.kind === 'essentials' ? 'essentials' : 'light'
    plan.tasks = lightTasks(s, plan.tasks, offer.kind)
  }
  // Fixes and retests a lighter day cuts are still due: listed as moved, like the ones that didn't fit.
  if (plan.mode !== 'full') {
    const kept = new Set(plan.tasks.map((t) => t.id))
    plan.moved = c.tomorrow(c.due.filter((t) => !kept.has(t.id)))
  }
  return plan
}

/** One topic task from a slice. A fully watched topic is a short check: just its questions. */
export function topicTask(s: EngineState, t: Topic, slice: TopicSlice, date: ISODate): Task {
  const qbank = s.resources.find((x) => x.goalId === s.topicGoalId && x.type === 'qbank' && x.doneUnits < x.totalUnits)
  const check = isAllWatched(t) && slice.items.every((x) => x.source === 'qbank')
  // An unfinished topic comes back as "part 2", "part 3", with how far it is.
  const part = slice.continues ? Math.max(2, (t.parts ?? 0) + 1) : undefined
  const p = topicProgress(t)
  const progress = !slice.continues ? undefined : p.done === 0 ? 'in progress' : p.done === p.total - 1 ? 'last step' : `${p.done} of ${p.total} steps done`
  return {
    id: `${date}-topic-${t.id}`,
    date,
    kind: 'study',
    goalId: s.topicGoalId!,
    resourceId: slice.questions > 0 ? qbank?.id : undefined,
    system: t.system,
    topicIds: [t.id],
    topicId: t.id,
    title: check ? checkTitle(t.name, slice.questions, qbank?.name) : part ? `${topicTitle(t)}, part ${part}` : topicTitle(t),
    steps: check ? undefined : stepLines(slice.items, qbank?.name),
    detail: part ? `Part ${part} · ${progress}` : slice.ends ? undefined : 'Continues next time',
    part,
    progress,
    partialMinutes: slice.partialMinutes,
    reason: check ? reasons.topicCheck() : slice.continues ? reasons.topicContinue((t.partialMin ?? 0) > 0 || t.partlyTo !== undefined) : s.focus.includes(t.system) || s.topics.some((x) => x.system === t.system && x.id !== t.id && ((x.doneItems ?? 0) > 0 || (x.partialMin ?? 0) > 0)) ? reasons.topicNext(t.system) : reasons.nextSystem(t.system),
    minutes: slice.minutes,
    amount: slice.questions || undefined,
    itemFrom: slice.from,
    itemTo: slice.to,
    status: 'pending',
  }
}

