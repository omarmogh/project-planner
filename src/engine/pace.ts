import { statedMinutes } from './availability'
import { capacity } from './commitments'
import { GAP_MAX_EXTRA_PER_DAY, LECTURE_MINUTES, LOOP_RESERVE_DAYS, PROJECTION_DAYS, READY_FALLBACK_DAYS, READY_HORIZON_DAYS, SUMMARY_SHARE, UNI_REVIEW_MINUTES } from './config'
import { activeGoals, dayType, isPaused, studies, studyDaysLeft } from './exams'
import { addDays, daysBetween } from './dates'
import { estimates } from './estimates'
import { plannedTopics, remainingItems, systemProgress, systemQueue, topicMinutesLeft } from './topics'
import { isFirm, type EngineState, type Goal, type ISODate, type Resource } from './types'

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
/** Units still to do; questions the student chose to skip in rescue mode are out. */
export function unitsLeft(r: Resource): number {
  return Math.max(0, r.totalUnits - r.doneUnits - (r.skipUnits ?? 0))
}

export function resourcePace(r: Resource, examDate: ISODate, today: ISODate): ResourcePace {
  const remaining = unitsLeft(r)
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

/** Minutes one lecture takes for this student: full, or from the summary after "narrow the scope". */
export function lectureUnitMinutes(r: Resource, factor = 1): number {
  return LECTURE_MINUTES * factor * (r.fromSummary ? SUMMARY_SHARE : 1)
}

/**
 * Minutes of work left for a goal.
 * Topic goal: every uncovered topic item (dropped topics are out; questions-only topics count their questions),
 * plus the qbank questions that no topic task will cover.
 * Uni goals: lectures left (shorter from summaries) and past papers left.
 */
export function goalMinutesLeft(s: EngineState, goal: Goal, opts: { sureOnly?: boolean } = {}): number {
  const est = estimates(s)
  const factor = est.topic
  let total = 0
  // sureOnly: amounts that are a default after "Not sure" are left out (never judged against a date).
  const mine = (x: Resource) => x.goalId === goal.id && !(opts.sureOnly && x.unitsUnsure)
  for (const r of s.resources.filter((x) => mine(x) && x.type === 'slides')) {
    total += Math.max(0, r.totalUnits - r.doneUnits) * lectureUnitMinutes(r, est.lectures)
  }
  for (const r of s.resources.filter((x) => mine(x) && x.type === 'papers')) {
    total += Math.max(0, r.totalUnits - r.doneUnits) * r.minutesPerUnit
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
    if (qbank && mine(qbank)) total += Math.max(0, unitsLeft(qbank) - topicQuestions) * qbank.minutesPerUnit * est.questions
  } else {
    for (const r of s.resources.filter((x) => mine(x) && x.type === 'qbank')) {
      total += unitsLeft(r) * r.minutesPerUnit * est.questions
    }
  }
  return Math.round(total)
}

const reserveCache = new WeakMap<object, Map<string, number>>()

/**
 * Minutes a day fixes and retests have really taken lately (the last LOOP_RESERVE_DAYS).
 * The board goal's projection sets this aside, so the ready-by date doesn't promise time the fix loop uses.
 */
export function loopReserve(s: EngineState, today: ISODate): number {
  let byDay = reserveCache.get(s.sessions)
  if (!byDay) reserveCache.set(s.sessions, (byDay = new Map()))
  const hit = byDay.get(today)
  if (hit !== undefined) return hit
  const from = addDays(today, -LOOP_RESERVE_DAYS)
  const minutes = s.sessions.filter((x) => (x.kind === 'fix' || x.kind === 'retest') && x.date >= from && x.date < today).reduce((n, x) => n + x.minutes, 0)
  const value = minutes / LOOP_RESERVE_DAYS
  byDay.set(today, value)
  return value
}

export interface GoalNeed {
  goal: Goal
  /** Minutes of work left. */
  left: number
  /** Study days left before its exam (no exam days, eves, rest days; no wind-down days for a board goal). */
  days: number
  /** left ÷ days: what the goal needs each study day to finish on time. */
  need: number
  /** A uni goal with lectures and papers all done: only a short daily self-test until the exam. */
  reviewOnly?: boolean
}

/** What every running goal needs per study day, as of `date`. The basis for sharing a day (spec 4). */
export function goalNeeds(s: EngineState, date: ISODate): GoalNeed[] {
  return activeGoals(s.goals, date).filter((g) => studies(g, date)).map((goal) => {
    const left = goalMinutesLeft(s, goal)
    const days = studyDaysLeft(s, goal, date)
    const counted = s.resources.some((r) => r.goalId === goal.id && (r.type === 'slides' || r.type === 'papers'))
    if (left === 0 && counted && isFirm(goal)) return { goal, left, days, need: UNI_REVIEW_MINUTES, reviewOnly: true }
    return { goal, left, days, need: left / days }
  })
}

/**
 * Minutes this goal gets on one day: the day's capacity (after busy time), minus Anki,
 * minus what the other firm goals need that day. None on exam days, eves, rest days,
 * and for a board goal none during a uni wind-down.
 */
export function goalMinutesOn(s: EngineState, goal: Goal, today: ISODate, date: ISODate, needs = goalNeeds(s, today)): number {
  if (dayType(s.goals, date) !== 'normal' || isPaused(s, goal, date)) return 0
  let m = capacity(s, date)
  if (s.anki && s.goals.some((g) => g.id === s.anki!.goalId && studies(g, date))) m -= s.anki.reviewMinutes
  if (goal.id === s.topicGoalId) m -= loopReserve(s, today)
  for (const n of needs) {
    if (n.goal.id === goal.id || !isFirm(n.goal) || date >= n.goal.examDate) continue
    if (isPaused(s, n.goal, date)) continue
    m -= n.need
  }
  return Math.max(0, m)
}

/** Average minutes a day this goal gets over the next PROJECTION_DAYS. */
export function goalMinutesPerDay(s: EngineState, goal: Goal, today: ISODate): number {
  const needs = goalNeeds(s, today)
  let sum = 0
  for (let i = 0; i < PROJECTION_DAYS; i++) sum += goalMinutesOn(s, goal, today, addDays(today, i), needs)
  return sum / PROJECTION_DAYS
}

/** Minutes the goal gets from today until its exam (exam day excluded). */
export function goalMinutesUntilExam(s: EngineState, goal: Goal, today: ISODate, extraPerDay = 0): number {
  const needs = goalNeeds(s, today)
  let sum = 0
  for (let d = today; d < goal.examDate; d = addDays(d, 1)) {
    const m = goalMinutesOn(s, goal, today, d, needs)
    sum += m + (extraPerDay > 0 && dayType(s.goals, d) === 'normal' && !isPaused(s, goal, d) ? extraPerDay : 0)
  }
  return sum
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
  /** Work (minutes) that doesn't fit in the time before the exam. This, not daysShort, is what the student sees. */
  minutesShort: number
  /** False when the extra a day it would take is more than a day can sensibly hold (GAP_MAX_EXTRA_PER_DAY). */
  closable: boolean
  /** The student gave the date ('set' or 'rough'). False: Pace says "date not known yet", no shortfall is judged. */
  dateKnown: boolean
  /** Some amounts are defaults after "Not sure": left out of the shortfall, and never called "on track". */
  amountUnsure: boolean
}

/** How far ahead the ready-by walk looks. */
const HORIZON_DAYS = READY_HORIZON_DAYS

/** Minutes the goal gets on each of the coming days (index 0 = today), ignoring its own exam date. */
function walkDays(s: EngineState, goal: Goal, today: ISODate, w: WhatIf = {}): (i: number) => number {
  // The exam date itself must not cap the walk: we're asking when the work would be done.
  const open: Goal = { ...goal, examDate: addDays(today, HORIZON_DAYS + 1), dateSource: 'projected' }
  const world = { ...s, goals: s.goals.map((g) => (g.id === goal.id ? open : g)) }
  const needs = goalNeeds(s, today).filter((n) => n.goal.id !== goal.id)
  return (i) => {
    if (i >= 1 && i <= (w.skipDays ?? 0)) return 0
    const d = addDays(today, i)
    const m = goalMinutesOn(world, open, today, d, needs)
    return m + (m > 0 || dayType(world.goals, d) === 'normal' ? w.extraPerDay ?? 0 : 0)
  }
}

/** The day the work left is done, walking the real days ahead (weekends, exams, wind-downs, busy time). */
function walkReady(s: EngineState, goal: Goal, today: ISODate, w: WhatIf = {}): ISODate | null {
  let left = goalMinutesLeft(s, goal)
  if (left === 0) return today
  const on = walkDays(s, goal, today, w)
  for (let i = 0; i < HORIZON_DAYS; i++) {
    left -= on(i)
    if (left <= 0) return addDays(today, i + 1)
  }
  return null
}

/** The student gave this date (booked, or "roughly"): pace may be judged against it. 'assumed' and 'projected' never are. */
export function dateKnown(goal: Pick<Goal, 'dateSource'>): boolean {
  return goal.dateSource === 'set' || goal.dateSource === 'rough'
}

/** Some of the goal's amounts are defaults after "Not sure": the shortfall is judged on the rest only. */
export function amountUnsure(s: EngineState, goal: Goal): boolean {
  return s.resources.some((r) => r.goalId === goal.id && r.unitsUnsure && unitsLeft(r) > 0)
}

export function readiness(s: EngineState, goal: Goal, today: ISODate): Readiness {
  const minutesLeft = goalMinutesLeft(s, goal)
  const perDay = goalMinutesPerDay(s, goal, today)
  const daysLeft = daysBetween(today, goal.examDate)
  const readyOn = walkReady(s, goal, today)
  const known = dateKnown(goal)
  const unsure = amountUnsure(s, goal)
  let daysShort = !known ? 0 : readyOn ? Math.max(0, daysBetween(goal.examDate, readyOn)) : daysLeft
  let extraPerDay = 0
  let minutesShort = 0
  if (daysShort > 0 && daysLeft > 0) {
    // One figure drives both lines: the work that doesn't fit, spread over the study days left.
    // Amounts the student wasn't sure of never count toward it.
    const gap = goalMinutesLeft(s, goal, { sureOnly: true }) - goalMinutesUntilExam(s, goal, today)
    if (gap <= 0) daysShort = 0
    else {
      minutesShort = Math.max(5, Math.ceil(gap / 5) * 5)
      extraPerDay = Math.max(5, Math.ceil(minutesShort / studyDaysLeft(s, goal, today) / 5) * 5)
    }
  }
  return { goal, minutesLeft, perDay, readyOn, daysLeft, daysShort, extraPerDay, minutesShort, closable: extraPerDay <= GAP_MAX_EXTRA_PER_DAY, dateKnown: known, amountUnsure: unsure }
}

/** "No idea" exam date: the ready-by date at the current pace (falls back to a year out). */
export function projectedExamDate(s: EngineState, goal: Goal, today: ISODate): ISODate {
  const ready = walkReady(s, goal, today)
  return ready && ready > today ? ready : addDays(today, ready ? 1 : READY_FALLBACK_DAYS)
}

/** "about 5 days left" for one system, at the time the topic goal gets each day. */
export function systemDaysLeft(s: EngineState, system: string, today: ISODate): number | null {
  const goal = s.goals.find((g) => g.id === s.topicGoalId)
  if (!goal) return null
  const factor = estimates(s).topic
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

/** The ready-by date with a change to the daily time. Same walk as readiness(). */
export function readyOnWith(s: EngineState, goal: Goal, today: ISODate, w: WhatIf = {}): ISODate | null {
  return walkReady(s, goal, today, w)
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
  for (let i = 1; i <= PROJECTION_DAYS; i++) available += statedMinutes(s.availability, addDays(today, i))
  available /= PROJECTION_DAYS
  // Only dates the student gave, and only amounts they were sure of: "Don't know yet" and "Not sure" are never judged.
  const dated = s.goals.filter((g) => g.examDate > today && dateKnown(g))
  if (dated.length === 0) return { needed: null, available: Math.round(available) }
  let needed = s.anki?.reviewMinutes ?? 0
  for (const g of dated) needed += goalMinutesLeft(s, g, { sureOnly: true }) / studyDaysLeft(s, g, today)
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
  const factor = estimates(s).topic
  const total = goalMinutesLeft(s, goal)
  const perDay = goalMinutesPerDay(s, goal, today)
  const readyOn = readiness(s, goal, today).readyOn
  const groups = systemQueue(s, today).map((systems) => ({
    systems,
    minutes: systems.reduce((n, x) => n + plannedTopics(s.topics, x).reduce((m, t) => m + topicMinutesLeft(t, factor), 0), 0),
  }))
  const topicMinutes = groups.reduce((n, g) => n + g.minutes, 0)
  if (!readyOn || perDay <= 0 || topicMinutes === 0) return { goal, segments: [], readyOn }
  const stretch = total / topicMinutes
  const segments: RoadSegment[] = []
  // Walk the real days once; each system ends on the day its share of the work is done.
  const on = walkDays(s, goal, today)
  let day = 0
  let cum = on(0)
  let done = 0
  groups.forEach((g, i) => {
    const fromDay = day
    done += g.minutes * stretch
    while (cum < done - 1e-6 && day < HORIZON_DAYS) cum += on(++day)
    const progress = g.systems.map((x) => systemProgress(s.topics, x))
    const to = addDays(today, day)
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
