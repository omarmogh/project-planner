// One-line "why" copy. Built only from things we actually know:
// accuracy, pace, days until exam, open fixes, retests due. Nothing made up.
// English only for now; Phase 1 moves these to i18n keys with params.

import { WELL_AHEAD_DAYS } from './config'
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
  /** A near uni exam with the board exam undated or far: it comes first, and the line says so. */
  /** The early loop's first short block. */
  earlyBlock: () => 'A short first block: your score shows what to fix first',
  uniLeads: (label: string, daysLeft: number) => `${label} ${inDays(daysLeft)}: it comes first until then`,
  examSoon: (label: string, daysLeft: number, assumed = false, term = 'rotation') => (assumed ? `${label}: date not out yet, planned for the ${term}'s end (${inDays(daysLeft)})` : `${label} ${inDays(daysLeft)}`),
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
  paperScore: (subject: string, pct: number) => `${subject} paper: ${pct}%`,
  topicScore: (topic: string, pct: number) => `${topic} questions: ${pct}%`,
  /** A result from outside the plan, in the student's own words: "NBME 1: 52%". */
  resultScore: (label: string, pct: number) => `${label}: ${pct}%`,
  /** "Retest due today", "One-week check due today", "Retest, postponed from Tuesday": a late one never says "due today". */
  retestDue: (date: ISODate, today: ISODate, round: 1 | 2 = 1) => {
    const what = round === 2 ? 'One-week check' : 'Retest'
    if (date < today) return `${what}, postponed from ${dayName(date, today)}`
    return `${what} due ${date === today ? 'today' : dayName(date, today)}`
  },
  /** `unsure`: the deck size is a default, so the line can't claim it finishes the deck. */
  ankiNew: (perDay: number, unsure = false) =>
    perDay <= 0 ? "Just clear today's due cards"
      : unsure ? `About ${perDay} new cards a day keeps your deck moving`
        : `${perDay} new cards a day finishes your deck in time`,
  topicNext: (system: string) => `Next in ${system}`,
  /** Only a task stopped half-way "picks up where you left off"; the next slice of a finished part is just the next part. */
  topicContinue: (leftOff = false) => (leftOff ? 'Picks up where you left off' : 'Next part of this topic'),
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
/** After a missed day, once: what happened to the work, nothing about the student. */
export function missedLine(days: number): string {
  return days === 1
    ? 'Yesterday’s tasks are spread over the coming days. Nothing is lost.'
    : `The last ${days} days’ tasks are spread over the coming days. Nothing is lost.`
}

/** The first day back after a long gap: it starts small on its own. */
export function returnLine(days: number): string {
  return `Welcome back. After ${days} days away, today starts small. The rest is spread over the coming days. Nothing is lost.`
}

/** "40 min", "3 h", "1 h 30 min": rounded so it never sounds more exact than it is. */
export function workTime(min: number): string {
  if (min < 60) return `${Math.max(5, Math.round(min / 5) * 5)} min`
  if (min < 180) {
    const half = Math.round(min / 30) * 30
    return half % 60 ? `${Math.floor(half / 60)} h 30 min` : `${half / 60} h`
  }
  return `${Math.round(min / 60)} h`
}

export function verdict(r: Readiness, lectures?: number): Verdict {
  const { goal } = r
  if (r.minutesLeft === 0) return { headline: `${goal.label}: everything covered.`, detail: 'Questions and retests from here.' }
  if (goal.dateSource === 'projected' && r.readyOn) {
    return {
      headline: `${goal.label}: no date yet.`,
      detail: `At your pace you'd be ready around ${monthYear(r.readyOn)}. Set a date when you book it.`,
      canLock: true,
    }
  }
  // "Don't know yet": the date is a stand-in. Nothing is judged against it.
  if (!r.dateKnown) {
    return {
      headline: `${goal.label}: date not known yet.`,
      detail: 'Planned steadily for now. Add the date when it\'s out and Pace will check it.',
    }
  }
  if (r.daysShort > 0) {
    // Said in time, never in days: "days short" grew past the days left and read as nonsense.
    return {
      headline: `${goal.label}: about ${workTime(r.minutesShort)} more work than time before it.`,
      detail: r.closable
        ? `+${r.extraPerDay} min a day closes the gap.`
        : "That's more than extra time can close. Leaving some of it out or moving the date are the real options.",
    }
  }
  // Some amounts were "Not sure": the app can't see all the work, so it never says "on track".
  if (r.amountUnsure) {
    return {
      headline: `${goal.label}: planned with a usual amount for now.`,
      detail: 'Add your real count when you know it and Pace will check the date.',
    }
  }
  if (lectures !== undefined) {
    const perDay = Math.ceil(lectures / Math.max(1, r.daysLeft))
    return { headline: `${goal.label}: on track.`, detail: `${count(lectures, 'lecture')} left, ${perDay} a day is enough.` }
  }
  const spare = r.readyOn ? daysBetween(r.readyOn, goal.examDate) : 0
  return {
    headline: `${goal.label}: on track.`,
    detail: !r.readyOn || spare <= 0 ? 'Ready right around the exam.'
      : spare > WELL_AHEAD_DAYS ? `Ready around ${monthYear(r.readyOn)}, well before the exam.`
      : `Ready around ${shortDate(r.readyOn)}, ${count(spare, 'day')} before the exam.`,
  }
}
