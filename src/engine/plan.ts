import { recentAccuracy } from './accuracy'
import { dayContext } from './availability'
import { LECTURE_MINUTES, MIN_TASK_MINUTES, MIXED_SYSTEM, QBANK_MAX, QBANK_MIN } from './config'
import { daysBetween } from './dates'
import { resourcePace } from './pace'
import { reasons } from './reasons'
import { sliceTopic, stepLines, timerFactor, topicQueue, topicTitle } from './topics'
import type { EngineState, Goal, ISODate, Resource, Task } from './types'

export interface DayPlan {
  date: ISODate
  kind: ReturnType<typeof dayContext>['kind']
  available: number
  tasks: Task[]
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

/** "IM slides: next lecture", "IM slides: next 2 lectures". Lecture titles aren't known, so no numbers. */
export function lecturesTitle(r: Resource, n: number): string {
  return n === 1 ? `${r.name}: next lecture` : `${r.name}: next ${n} lectures`
}

/** Lectures still to study; a half-done lecture ("Partly") counts as one. */
export function lecturesLeft(r: Resource): number {
  return Math.max(0, Math.ceil(r.totalUnits - r.doneUnits - 1e-9))
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
  let left = ctx.minutes
  const goals = s.goals.filter((g) => g.examDate > date).sort((a, b) => a.examDate.localeCompare(b.examDate))
  const active = new Set(goals.map((g) => g.id))
  const factor = timerFactor(s.sessions)

  // 1. Anki: Anki decides what's due; we reserve the time.
  const anki: Task[] = []
  if (s.anki && active.has(s.anki.goalId) && left > 0) {
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
  const soonest: Goal | undefined = goals[0]

  for (const goal of goals) {
    const list: Task[] = []
    const examReason = reasons.examSoon(goal.label, daysBetween(date, goal.examDate))

    // Uni slides: the lectures needed per day to finish by the exam.
    for (const r of s.resources.filter((x) => x.goalId === goal.id && x.type === 'slides')) {
      const remaining = r.totalUnits - r.doneUnits
      if (remaining <= 0 || left < MIN_TASK_MINUTES) continue
      const need = Math.max(1, Math.ceil(remaining / Math.max(1, daysBetween(date, goal.examDate))))
      // A half-done lecture is shorter; whole lectures after it.
      const part = remaining % 1
      const minutesFor = (n: number) => ceilTo5(Math.max(MIN_TASK_MINUTES, (n - (part > 0 ? 1 - part : 0)) * LECTURE_MINUTES))
      let n = Math.min(need, lecturesLeft(r))
      while (n > 0 && minutesFor(n) > left) n--
      if (n < 1) continue
      list.push({
        id: `${date}-${r.id}`,
        date,
        kind: 'study',
        goalId: goal.id,
        resourceId: r.id,
        title: lecturesTitle(r, n),
        reason: examReason,
        minutes: minutesFor(n),
        amount: n,
        status: 'pending',
      })
      left -= minutesFor(n)
    }

    const qbank = s.resources.find((x) => x.goalId === goal.id && x.type === 'qbank' && x.doneUnits < x.totalUnits)

    // Topic tasks for the topic goal.
    if (goal.id === s.topicGoalId) {
      for (const t of topicQueue(s, date)) {
        if (left < MIN_TASK_MINUTES) break
        const slice = sliceTopic(t, left, factor)
        if (!slice) break // the next item doesn't fit today; topics stay in order
        const steps = stepLines(slice.items, qbank?.name)
        list.push({
          id: `${date}-topic-${t.id}`,
          date,
          kind: 'study',
          goalId: goal.id,
          resourceId: slice.questions > 0 ? qbank?.id : undefined,
          system: t.system,
          topicIds: [t.id],
          topicId: t.id,
          title: topicTitle(t),
          steps,
          detail: slice.ends ? undefined : 'Continues next time',
          reason: slice.continues ? reasons.topicContinue() : s.focus.includes(t.system) ? reasons.topicNext(t.system) : reasons.nextSystem(t.system),
          minutes: slice.minutes,
          amount: slice.questions || undefined,
          itemFrom: slice.from,
          itemTo: slice.to,
          status: 'pending',
        })
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
      const n = Math.min(want, floorTo5(left / qbank.minutesPerUnit))
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
          minutes: n * qbank.minutesPerUnit,
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
    if (left < resource.minutesPerUnit * 5) break
    const room = floorTo5(left / resource.minutesPerUnit)
    const remaining = resource.totalUnits - resource.doneUnits
    const extra = Math.min(room, QBANK_MAX - (task.amount ?? 0), remaining - (task.amount ?? 0))
    if (extra <= 0) continue
    task.amount = (task.amount ?? 0) + extra
    task.minutes = task.amount * resource.minutesPerUnit
    task.title = blockTitle(resource, task.amount, task.system ?? MIXED_SYSTEM)
    left -= extra * resource.minutesPerUnit
  }

  const first = soonest ? work.get(soonest.id) ?? [] : []
  const later = goals.slice(1).flatMap((g) => work.get(g.id) ?? [])
  return { date, kind: ctx.kind, available: ctx.minutes, tasks: [...anki, ...first, ...fixes, ...retests, ...later] }
}

export function totalMinutes(tasks: Task[]): number {
  return tasks.reduce((n, t) => n + t.minutes, 0)
}
