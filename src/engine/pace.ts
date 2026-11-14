import { dayContext } from './availability'
import { LECTURE_MINUTES, PROJECTION_DAYS } from './config'
import { addDays, daysBetween } from './dates'
import { plannedTopics, remainingItems, systemProgress, systemQueue, timerFactor, topicMinutesLeft } from './topics'
import type { EngineState, Goal, ISODate, Resource } from './types'

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

// ── Readiness: what's left ÷ the time you actually have ───────────────────

/**
 * Minutes of work left for a goal.
 * Topic goal: every uncovered topic item, plus the qbank questions that no topic task will cover.
 * Other goals: lectures left.
 */
export function goalMinutesLeft(s: EngineState, goal: Goal): number {
  const factor = timerFactor(s.sessions)
  let total = 0
  for (const r of s.resources.filter((x) => x.goalId === goal.id && x.type === 'slides')) {
    total += Math.max(0, r.totalUnits - r.doneUnits) * LECTURE_MINUTES
  }
  if (goal.id === s.topicGoalId) {
    let topicQuestions = 0
    for (const t of plannedTopics(s.topics)) {
      for (const r of remainingItems(t, factor)) {
        total += r.minutes
        topicQuestions += r.item.questions ?? 0
      }
    }
    const qbank = s.resources.find((x) => x.goalId === goal.id && x.type === 'qbank')
    if (qbank) total += Math.max(0, qbank.totalUnits - qbank.doneUnits - topicQuestions) * qbank.minutesPerUnit
  } else {
    for (const r of s.resources.filter((x) => x.goalId === goal.id && x.type === 'qbank')) {
      total += Math.max(0, r.totalUnits - r.doneUnits) * r.minutesPerUnit
    }
  }
  return Math.round(total)
}

/**
 * Average minutes a day this goal gets over the next PROJECTION_DAYS:
 * the day's time, minus Anki, minus what sooner exams need each day until they're over.
 */
export function goalMinutesPerDay(s: EngineState, goal: Goal, today: ISODate): number {
  let sum = 0
  for (let i = 1; i <= PROJECTION_DAYS; i++) sum += goalMinutesOn(s, goal, today, addDays(today, i))
  return sum / PROJECTION_DAYS
}

/** Minutes this goal gets on one day: the day's time, minus Anki, minus what sooner exams need each day until they're over. */
export function goalMinutesOn(s: EngineState, goal: Goal, today: ISODate, date: ISODate): number {
  let m = dayContext(s.availability, date).minutes
  if (s.anki) m -= s.anki.reviewMinutes
  for (const g of s.goals) {
    if (g.id === goal.id || g.examDate <= today || g.examDate >= goal.examDate || date >= g.examDate) continue
    m -= goalMinutesLeft(s, g) / Math.max(1, daysBetween(today, g.examDate))
  }
  return Math.max(0, m)
}

export interface Readiness {
  goal: Goal
  minutesLeft: number
  perDay: number
  /** When everything left would be done at this pace; null if there's no time at all. */
  readyOn: ISODate | null
  daysLeft: number
  /** >0 = the exam comes this many days before you'd be ready. */
  daysShort: number
  /** Extra minutes a day (rounded up to 5) that close the gap. */
  extraPerDay: number
}

export function readiness(s: EngineState, goal: Goal, today: ISODate): Readiness {
  const minutesLeft = goalMinutesLeft(s, goal)
  const perDay = goalMinutesPerDay(s, goal, today)
  const daysLeft = daysBetween(today, goal.examDate)
  const readyOn = minutesLeft === 0 ? today : perDay > 0 ? addDays(today, Math.ceil(minutesLeft / perDay)) : null
  const daysShort = readyOn ? Math.max(0, daysBetween(goal.examDate, readyOn)) : daysLeft
  const extraPerDay = daysShort > 0 && daysLeft > 0 ? Math.ceil((minutesLeft / daysLeft - perDay) / 5) * 5 : 0
  return { goal, minutesLeft, perDay, readyOn, daysLeft, daysShort, extraPerDay }
}

/** "No idea" exam date: the ready-by date at the current pace (falls back to a year out). */
export function projectedExamDate(s: EngineState, goal: Goal, today: ISODate): ISODate {
  return readiness(s, goal, today).readyOn ?? addDays(today, 365)
}

/** "about 5 days left" for one system, at the time the topic goal gets each day. */
export function systemDaysLeft(s: EngineState, system: string, today: ISODate): number | null {
  const goal = s.goals.find((g) => g.id === s.topicGoalId)
  if (!goal) return null
  const factor = timerFactor(s.sessions)
  const left = plannedTopics(s.topics, system).reduce((n, t) => n + remainingItems(t, factor).reduce((m, r) => m + r.minutes, 0), 0)
  const perDay = goalMinutesPerDay(s, goal, today)
  return perDay > 0 ? Math.ceil(left / perDay) : null
}

// ── What if: more time a day, or a day off ────────────────────────────────

export interface WhatIf {
  /** Extra minutes every day. */
  extraPerDay?: number
  /** Days off starting tomorrow (1 = "if I skip tomorrow"). */
  skipDays?: number
}

/** The ready-by date with a change to the daily time. Same math as readiness(). */
export function readyOnWith(s: EngineState, goal: Goal, today: ISODate, w: WhatIf = {}): ISODate | null {
  const left = goalMinutesLeft(s, goal)
  if (left === 0) return today
  const perDay = goalMinutesPerDay(s, goal, today) + (w.extraPerDay ?? 0)
  if (perDay <= 0) return null
  let lost = 0
  for (let i = 1; i <= (w.skipDays ?? 0); i++) lost += goalMinutesOn(s, goal, today, addDays(today, i)) + (w.extraPerDay ?? 0)
  return addDays(today, Math.ceil((left + lost) / perDay))
}

/** How many days earlier (<0: later) the ready-by date moves with the change. null when there's no date either way. */
export function whatIfDays(s: EngineState, goal: Goal, today: ISODate, w: WhatIf): number | null {
  const base = readyOnWith(s, goal, today)
  const changed = readyOnWith(s, goal, today, w)
  return base && changed ? daysBetween(changed, base) : null
}

// ── Daily load ────────────────────────────────────────────────────────────

export interface DailyLoad {
  /** Average minutes a day the dated exams need (plus Anki reviews). null when no exam has a date. */
  needed: number | null
  /** Average minutes a day the student has, over the next PROJECTION_DAYS. */
  available: number
}

export function dailyLoad(s: EngineState, today: ISODate): DailyLoad {
  let available = 0
  for (let i = 1; i <= PROJECTION_DAYS; i++) available += dayContext(s.availability, addDays(today, i)).minutes
  available /= PROJECTION_DAYS
  const dated = s.goals.filter((g) => g.examDate > today && g.dateSource !== 'projected')
  if (dated.length === 0) return { needed: null, available: Math.round(available) }
  let needed = s.anki?.reviewMinutes ?? 0
  for (const g of dated) needed += goalMinutesLeft(s, g) / Math.max(1, daysBetween(today, g.examDate))
  return { needed: Math.round(needed), available: Math.round(available) }
}

// ── The road to the exam ──────────────────────────────────────────────────

export interface RoadSegment {
  /** One system, or two studied together. */
  systems: string[]
  from: ISODate
  to: ISODate
  covered: number
  total: number
  /** Being studied now. */
  now: boolean
  /** Ends after the exam date. */
  afterExam: boolean
}

export interface Road {
  goal: Goal
  segments: RoadSegment[]
  readyOn: ISODate | null
}

/**
 * The topic goal's systems in planned order, each with the dates it takes at the
 * time the goal gets a day. Questions outside topic tasks are done alongside every
 * system, so each system's share is stretched by total ÷ topic minutes; the last
 * segment then ends the day before readiness().readyOn.
 */
export function roadToExam(s: EngineState, today: ISODate): Road | null {
  const goal = s.goals.find((g) => g.id === s.topicGoalId)
  if (!goal) return null
  const factor = timerFactor(s.sessions)
  const total = goalMinutesLeft(s, goal)
  const perDay = goalMinutesPerDay(s, goal, today)
  const readyOn = total === 0 ? today : perDay > 0 ? addDays(today, Math.ceil(total / perDay)) : null
  const groups = systemQueue(s, today).map((systems) => ({
    systems,
    minutes: systems.reduce((n, x) => n + plannedTopics(s.topics, x).reduce((m, t) => m + topicMinutesLeft(t, factor), 0), 0),
  }))
  const topicMinutes = groups.reduce((n, g) => n + g.minutes, 0)
  if (!readyOn || perDay <= 0 || topicMinutes === 0) return { goal, segments: [], readyOn }
  const stretch = total / topicMinutes
  const segments: RoadSegment[] = []
  let done = 0
  groups.forEach((g, i) => {
    const before = done
    done += g.minutes * stretch
    const fromDay = Math.floor(before / perDay)
    const toDay = Math.max(fromDay, Math.ceil(done / perDay) - 1)
    const progress = g.systems.map((x) => systemProgress(s.topics, x))
    const to = addDays(today, toDay)
    segments.push({
      systems: g.systems,
      from: addDays(today, fromDay),
      to,
      covered: progress.reduce((n, p) => n + p.covered, 0),
      total: progress.reduce((n, p) => n + p.total, 0),
      now: i === 0,
      afterExam: to >= goal.examDate,
    })
  })
  return { goal, segments, readyOn }
}
