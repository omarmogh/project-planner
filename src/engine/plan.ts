import { recentAccuracy } from './accuracy'
import { dayContext } from './availability'
import { daysBetween } from './dates'
import { resourcePace } from './pace'
import { reasons } from './reasons'
import type { EngineState, Goal, ISODate, Resource, Task } from './types'

export const QBANK_MIN = 10
export const QBANK_MAX = 40

export interface DayPlan {
  date: ISODate
  kind: ReturnType<typeof dayContext>['kind']
  available: number
  tasks: Task[]
}

const floorTo5 = (n: number) => Math.floor(n / 5) * 5
const ceilTo5 = (n: number) => Math.ceil(n / 5) * 5

/** Systems we know about, in a stable order (from the topic list). */
function systemsOf(s: EngineState): string[] {
  return [...new Set(s.topics.filter((t) => !t.wholeSystem).map((t) => t.system))]
}

/** Lowest accuracy first; systems with no data yet come before everything. */
function pickSystem(s: EngineState, date: ISODate): { system: string; reason: string } {
  const acc = recentAccuracy(s.sessions, date)
  const noData = systemsOf(s).find((sys) => !acc.some((a) => a.system === sys))
  if (noData) return { system: noData, reason: reasons.noData(noData) }
  if (acc.length > 0) return { system: acc[0].system, reason: reasons.lowestAccuracy(acc[0].pct) }
  return { system: 'Mixed', reason: 'Mixed block' }
}

function unitRange(r: Resource, n: number): string {
  const from = r.doneUnits + 1
  if (n <= 1) return `${r.unit[0]} ${from}`
  return `${r.unit[1]} ${from}–${from + n - 1}`
}

/**
 * Pure: (goals, resources, availability, topics, sessions, scheduled, date) → that day's tasks.
 * Order on screen: Anki → soonest goal's work → fixes → retests → later goals' work.
 * Budget: Anki, fixes and retests are reserved first; then each goal, soonest first,
 * gets what it needs per day; leftover time grows the question block up to QBANK_MAX.
 */
export function buildDay(s: EngineState, date: ISODate): DayPlan {
  const ctx = dayContext(s.availability, date)
  let left = ctx.minutes
  const goals = s.goals.filter((g) => g.examDate > date).sort((a, b) => a.examDate.localeCompare(b.examDate))
  const active = new Set(goals.map((g) => g.id))

  // 1. Anki: Anki decides what's due; we reserve the time.
  const anki: Task[] = []
  if (s.anki && active.has(s.anki.goalId)) {
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
    .map((t) => ({ ...t, date, reason: t.kind === 'retest' ? reasons.retestDue(t.date, date) : t.reason }))
  const fixes = due.filter((t) => t.kind === 'fix')
  const retests = due.filter((t) => t.kind === 'retest')
  for (const t of due) left -= t.minutes

  // 3. Goal work, soonest goal first.
  const work = new Map<string, Task[]>()
  const qbankTasks: { task: Task; resource: Resource }[] = []
  const soonest: Goal | undefined = goals[0]

  for (const goal of goals) {
    const list: Task[] = []
    const mine = s.resources
      .filter((r) => r.goalId === goal.id && r.type !== 'anki' && r.doneUnits < r.totalUnits)
      // Non-question material first so a qbank doesn't eat the whole budget.
      .sort((a, b) => Number(a.type === 'qbank') - Number(b.type === 'qbank'))

    for (const r of mine) {
      if (left <= 0) break
      const pace = resourcePace(r, goal.examDate, date)
      const goalReason = goal.id === soonest?.id && goals.length > 1
        ? reasons.examSoon(goal.label, daysBetween(date, goal.examDate))
        : pace.daysLate > 0 ? reasons.behindCatchUp(r) : reasons.examSoon(goal.label, daysBetween(date, goal.examDate))

      if (r.type === 'qbank') {
        const want = Math.min(QBANK_MAX, Math.max(QBANK_MIN, ceilTo5(pace.requiredPerDay)), pace.remaining)
        const fits = floorTo5(left / r.minutesPerUnit)
        const n = Math.min(want, fits)
        if (n < QBANK_MIN && n < pace.remaining) continue
        const pick = pickSystem(s, date)
        const task: Task = {
          id: `${date}-${r.id}`,
          date,
          kind: 'study',
          goalId: goal.id,
          resourceId: r.id,
          system: pick.system,
          title: `${r.name}: ${n} ${pick.system} questions`,
          detail: 'Timed block',
          reason: pick.reason,
          minutes: n * r.minutesPerUnit,
          amount: n,
          status: 'pending',
        }
        list.push(task)
        qbankTasks.push({ task, resource: r })
        left -= task.minutes
      } else {
        const need = Math.max(1, pace.requiredPerDay)
        const n = Math.min(need, Math.floor(left / r.minutesPerUnit), pace.remaining)
        if (n < 1) continue
        list.push({
          id: `${date}-${r.id}`,
          date,
          kind: 'study',
          goalId: goal.id,
          resourceId: r.id,
          title: `${r.name}: ${unitRange(r, n)}`,
          detail: `${pace.remaining - n} left after this`,
          reason: goalReason,
          minutes: n * r.minutesPerUnit,
          amount: n,
          status: 'pending',
        })
        left -= n * r.minutesPerUnit
      }
    }
    work.set(goal.id, list)
  }

  // 4. Leftover time grows the first question block.
  for (const { task, resource } of qbankTasks) {
    if (left < resource.minutesPerUnit * 5) break
    const room = floorTo5(left / resource.minutesPerUnit)
    const remaining = resource.totalUnits - resource.doneUnits
    const extra = Math.min(room, QBANK_MAX - (task.amount ?? 0), remaining - (task.amount ?? 0))
    if (extra <= 0) continue
    task.amount = (task.amount ?? 0) + extra
    task.minutes = task.amount * resource.minutesPerUnit
    task.title = `${resource.name}: ${task.amount} ${task.system} questions`
    left -= extra * resource.minutesPerUnit
  }

  const first = soonest ? work.get(soonest.id) ?? [] : []
  const later = goals.slice(1).flatMap((g) => work.get(g.id) ?? [])
  return { date, kind: ctx.kind, available: ctx.minutes, tasks: [...anki, ...first, ...fixes, ...retests, ...later] }
}

export function totalMinutes(tasks: Task[]): number {
  return tasks.reduce((n, t) => n + t.minutes, 0)
}
