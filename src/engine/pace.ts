import { daysBetween } from './dates'
import type { Goal, ISODate, Resource } from './types'

export interface ResourcePace {
  resourceId: string
  remaining: number
  daysLeft: number
  /** Units per day so far; null when there's no history yet. */
  perDay: number | null
  /** Units per day needed to finish by the exam. */
  requiredPerDay: number
  /** >0 = behind by this many days at the current pace. */
  daysLate: number
  /** Extra units per day that close the gap (0 when on track). */
  extraPerDay: number
}

// From the brief:
//   pace_per_day  = items_done / days_elapsed
//   days_needed   = ceil(items_remaining / pace_per_day)
//   days_late     = days_needed - days_until_exam
//   required_pace = ceil(items_remaining / days_until_exam)
export function resourcePace(r: Resource, examDate: ISODate, today: ISODate): ResourcePace {
  const remaining = Math.max(0, r.totalUnits - r.doneUnits)
  const daysLeft = Math.max(1, daysBetween(today, examDate))
  const requiredPerDay = Math.ceil(remaining / daysLeft)
  const elapsed = r.startedOn ? daysBetween(r.startedOn, today) : 0
  const perDay = elapsed > 0 && r.doneUnits > 0 ? r.doneUnits / elapsed : null

  if (perDay === null || remaining === 0) {
    return { resourceId: r.id, remaining, daysLeft, perDay, requiredPerDay, daysLate: 0, extraPerDay: 0 }
  }
  const daysNeeded = Math.ceil(remaining / perDay)
  const daysLate = Math.max(0, daysNeeded - daysLeft)
  const extraPerDay = daysLate > 0 ? Math.max(1, Math.ceil(requiredPerDay - perDay)) : 0
  return { resourceId: r.id, remaining, daysLeft, perDay, requiredPerDay, daysLate, extraPerDay }
}

export type GoalStatus = 'onTrack' | 'behind' | 'noData'

export interface GoalPace {
  goal: Goal
  status: GoalStatus
  daysLeft: number
  /** The resource that's furthest behind (or the main one when on track). */
  worst?: { resource: Resource; pace: ResourcePace }
}

/** Anki is excluded: Anki itself decides what's due. */
export function goalPace(goal: Goal, resources: Resource[], today: ISODate): GoalPace {
  const daysLeft = daysBetween(today, goal.examDate)
  const mine = resources.filter((r) => r.goalId === goal.id && r.type !== 'anki')
  const paces = mine.map((resource) => ({ resource, pace: resourcePace(resource, goal.examDate, today) }))
  if (paces.length === 0) return { goal, status: 'noData', daysLeft }

  const behind = paces.filter((p) => p.pace.daysLate > 0).sort((a, b) => b.pace.daysLate - a.pace.daysLate)
  if (behind.length > 0) return { goal, status: 'behind', daysLeft, worst: behind[0] }

  const withData = paces.filter((p) => p.pace.perDay !== null)
  if (withData.length === 0) return { goal, status: 'noData', daysLeft, worst: paces[0] }
  return { goal, status: 'onTrack', daysLeft, worst: withData[0] }
}
