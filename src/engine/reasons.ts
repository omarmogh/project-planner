// One-line "why" copy. Built only from things we actually know:
// accuracy, pace, days until exam, open fixes, retests due. Nothing made up.
// English only for now; Phase 1 moves these to i18n keys with params.

import { daysBetween, toDate } from './dates'
import type { Readiness } from './pace'
import type { ISODate } from './types'

export function plural(n: number, [one, many]: [string, string]): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`
}

/** plural() for the common English case: "1 task", "2 tasks". */
export function count(n: number, word: string, many = `${word}s`): string {
  return plural(n, [word, many])
}

/** "Heart failure" → "heart failure", but "AKI & CKD" stays. */
export function inSentence(name: string): string {
  if (name.length > 1 && name[1] === name[1].toUpperCase() && name[1] !== name[1].toLowerCase()) return name
  return name[0].toLowerCase() + name.slice(1)
}

/** "heart failure", "heart failure and arrhythmias", "a, b and c". */
export function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function weekdayName(date: ISODate): string {
  return WEEKDAYS[toDate(date).getUTCDay()]
}

export function shortDate(date: ISODate): string {
  const d = toDate(date)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "August 2027". */
export function monthYear(date: ISODate): string {
  const d = toDate(date)
  return `${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/** "today", "tomorrow", "Thursday", "Thursday 19 Nov". */
export function dayName(date: ISODate, today: ISODate): string {
  const diff = daysBetween(today, date)
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff === -1) return 'yesterday'
  if (diff > 1 && diff < 7) return weekdayName(date)
  if (diff < 0 && diff > -7) return weekdayName(date)
  return `${weekdayName(date)} ${shortDate(date)}`
}

export function inDays(n: number): string {
  if (n <= 0) return 'today'
  if (n === 1) return 'tomorrow'
  return `in ${n} days`
}

export const reasons = {
  /** `assumed` = the date isn't announced: the end of the rotation is a guess, and says so. */
  examSoon: (label: string, daysLeft: number, assumed = false) => (assumed ? `${label} in about ${daysLeft} days (end of rotation)` : `${label} ${inDays(daysLeft)}`),
  lowestAccuracy: (pct: number) => `Your lowest accuracy (${pct}%)`,
  belowTarget: (system: string, pct: number) => `${system} is at ${pct}%`,
  noAccuracyYet: () => 'No accuracy data yet',
  fromBlock: (system: string, source: ISODate, today: ISODate) => {
    const d = dayName(source, today)
    return `From ${d === 'today' ? "today's" : d === 'yesterday' ? "yesterday's" : `${d}'s`} ${system} block`
  },
  markedWeak: (names: string[]) => `You marked ${listJoin(names.map(inSentence))} as weak`,
  markedWeakSystems: (systems: string[]) => `You marked ${listJoin(systems)} as weak`,
  blockScore: (system: string, pct: number) => `${system} block: ${pct}%`,
  topicScore: (topic: string, pct: number) => `${topic} questions: ${pct}%`,
  retestDue: (date: ISODate, today: ISODate, round: 1 | 2 = 1) =>
    `${round === 2 ? 'Second retest' : 'Retest'} due ${date <= today ? 'today' : dayName(date, today)}`,
  ankiNew: (perDay: number) =>
    perDay > 0 ? `${perDay} new cards a day finishes your deck in time` : "Just clear today's due cards",
  topicNext: (system: string) => `Next in ${system}`,
  topicContinue: () => 'Picks up where you left off',
  topicCheck: () => "You've watched it. A short check that it stuck",
  nextSystem: (system: string) => `Next system: ${system}`,
}

export interface Verdict {
  headline: string
  detail: string
  /** True when the date is the engine's projection and can be locked in as the target. */
  canLock?: boolean
}

/**
 * One sentence + one fix, from what's left and the time the student has.
 * Uni goals talk in lectures; the topic goal in days.
 */
export function verdict(r: Readiness, lectures?: number): Verdict {
  const { goal } = r
  if (r.minutesLeft === 0) return { headline: `${goal.label}: everything covered.`, detail: 'Questions and retests from here.' }
  if (goal.dateSource === 'projected' && r.readyOn) {
    return {
      headline: `At your pace, you'd be ready for ${goal.label} around ${monthYear(r.readyOn)}.`,
      detail: 'Based on what\'s left and the time you have each day.',
      canLock: true,
    }
  }
  if (r.daysShort > 0) {
    return {
      headline: `${goal.label}: about ${count(r.daysShort, 'day')} short.`,
      detail: r.extraPerDay > 0 ? `+${r.extraPerDay} min a day closes the gap.` : 'A little more time each day closes the gap.',
    }
  }
  if (lectures !== undefined) {
    const perDay = Math.ceil(lectures / Math.max(1, r.daysLeft))
    return { headline: `${goal.label}: on track.`, detail: `${count(lectures, 'lecture')} left, ${perDay} a day is enough.` }
  }
  const spare = r.readyOn ? daysBetween(r.readyOn, goal.examDate) : 0
  return {
    headline: `${goal.label}: on track.`,
    detail: r.readyOn && spare > 0 ? `Ready around ${shortDate(r.readyOn)}, ${count(spare, 'day')} before the exam.` : 'Ready right around the exam.',
  }
}
