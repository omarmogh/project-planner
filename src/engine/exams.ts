// Exams: the three days around a firm exam, and the wind-down before a uni exam.
// Pure. See docs/ENGINE_SPEC.md section 5.

import { WIND_DOWN_FULL_WEEKS, WIND_DOWN_MAX_DAYS, WIND_DOWN_MIN_DAYS, WIND_DOWN_SHARE } from './config'
import { statedMinutes } from './availability'
import { addDays, daysBetween } from './dates'
import { isFirm, type EngineState, type Goal, type ISODate } from './types'

/** 'eve' = the day before an exam, 'exam' = exam day, 'rest' = the day after. */
export type DayType = 'normal' | 'eve' | 'exam' | 'rest'

export interface Sitting {
  goal: Goal
  date: ISODate
  /** "IM exam", "IM exam OSCE". */
  label: string
  /** A small test: see isSmallTest. */
  small: boolean
}

// "Forensic dept test", "Cardio quiz", "Physics colloquium", "كويز". A final, an OSCE, a viva or a board exam never is.
const SMALL_WORDS = /\b(quiz(zes)?|test|colloquium|kolloquium|mini|weekly|class test|dept test|spot test)\b|كويز|كوز|اختبار قصير|امتحان قصير|كولوكيوم/iu
const BIG_WORDS = /\b(final|finals|exam|osce|viva|oral|mid-?term|midterms?|step|board|boards|nbme|comlex|plab|smle|usmle|annual|professional|prof)\b|نهائي|نهائى|فاينل|امتحان|شفوي|اوسكي|أوسكي/iu

/**
 * A small test: what the student chose, else a guess from the label. Its eve is still a light review but
 * "Do more" stays open, the day after is a normal day, and it has no wind-down. Its result is asked for.
 */
export function isSmallTest(x: { label: string; small?: boolean }): boolean {
  if (x.small !== undefined) return x.small
  const l = x.label.toLowerCase()
  return SMALL_WORDS.test(l) && !BIG_WORDS.test(l.replace(/اختبار قصير|امتحان قصير/gu, ''))
}

/** Every sitting with a firm date: the exam itself and its parts (OSCE, viva). */
export function sittings(goals: Goal[]): Sitting[] {
  return goals.filter(isFirm).flatMap((g) => [
    { goal: g, date: g.examDate, label: g.label, small: isSmallTest(g) },
    ...(g.parts ?? []).map((p) => ({ goal: g, date: p.date, label: `${g.label} ${p.label}`, small: isSmallTest(p) })),
  ])
}

/** The last sitting of a goal: after it, the goal is over. */
export function lastSitting(g: Goal): ISODate {
  return [g.examDate, ...(g.parts ?? []).map((p) => p.date)].sort().at(-1)!
}

export interface DayInfo {
  type: DayType
  /** The sitting(s) that make it an eve or an exam day. */
  sittings: Sitting[]
  /** Every one of those sittings is a small test (an eve where "Do more" stays open). */
  small: boolean
}

/**
 * Exam day beats eve, eve beats rest. Rough and projected dates never count.
 * A small test gets the exam day and the light eve, but no rest day after it.
 */
export function dayInfo(goals: Goal[], date: ISODate): DayInfo {
  const all = sittings(goals)
  const on = (d: ISODate) => all.filter((x) => x.date === d)
  const small = (xs: Sitting[]) => xs.every((x) => x.small)
  const today = on(date)
  if (today.length) return { type: 'exam', sittings: today, small: small(today) }
  const tomorrow = on(addDays(date, 1))
  if (tomorrow.length) return { type: 'eve', sittings: tomorrow, small: small(tomorrow) }
  const yesterday = on(addDays(date, -1)).filter((x) => !x.small)
  if (yesterday.length) return { type: 'rest', sittings: yesterday, small: false }
  return { type: 'normal', sittings: [], small: false }
}

export function dayType(goals: Goal[], date: ISODate): DayType {
  return dayInfo(goals, date).type
}

/**
 * Days of wind-down for a rotation of this many weeks: the maximum for long rotations,
 * a share of the rotation for short ones. A template can pass its own numbers.
 */
export function windDownDaysFor(
  rotationWeeks: number,
  o: { maxDays?: number; fullWeeks?: number; share?: number; minDays?: number } = {},
): number {
  const max = o.maxDays ?? WIND_DOWN_MAX_DAYS
  if (rotationWeeks >= (o.fullWeeks ?? WIND_DOWN_FULL_WEEKS)) return max
  return Math.min(max, Math.max(o.minDays ?? WIND_DOWN_MIN_DAYS, Math.round(rotationWeeks * 7 * (o.share ?? WIND_DOWN_SHARE))))
}

/** Uni goals whose wind-down covers `date`: board goals shrink to Anki only. */
export function windDownGoals(goals: Goal[], date: ISODate): Goal[] {
  return goals.filter((g) => {
    if (g.kind !== 'uni' || !isFirm(g) || g.examDate <= date || isSmallTest(g)) return false
    return daysBetween(date, g.examDate) <= (g.windDownDays ?? WIND_DOWN_MAX_DAYS)
  })
}

/** A board goal is paused (Anki only) while any uni exam is winding down. */
export function isPaused(s: Pick<EngineState, 'goals'>, goal: Goal, date: ISODate): boolean {
  return goal.kind !== 'uni' && windDownGoals(s.goals, date).length > 0
}

/** Goals still running on `date`: the exam (and every part) is still ahead. Projected dates never run out. */
export function activeGoals(goals: Goal[], date: ISODate): Goal[] {
  return goals
    .filter((g) => g.dateSource === 'projected' || lastSitting(g) > date)
    .sort((a, b) => a.examDate.localeCompare(b.examDate))
}

/** A goal still takes study (not just a later OSCE): its written exam is ahead. */
export function studies(g: Goal, date: ISODate): boolean {
  return g.dateSource === 'projected' || g.examDate > date
}

/**
 * Days a goal can study from `from` (inclusive) until its exam: no exam days, rest days or eves,
 * and for a board goal no wind-down days. At least 1, so divisions stay sane.
 */
export function studyDaysLeft(s: Pick<EngineState, 'goals'> & Partial<Pick<EngineState, 'availability'>>, goal: Goal, from: ISODate): number {
  let n = 0
  for (let d = from; d < goal.examDate; d = addDays(d, 1)) {
    if (dayType(s.goals, d) !== 'normal') continue
    if (isPaused(s, goal, d)) continue
    // A day with no stated time (a weekend off) isn't a study day.
    if (s.availability && statedMinutes(s.availability, d) === 0) continue
    n++
  }
  return Math.max(1, n)
}
