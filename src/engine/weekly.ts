import { accuracyBySystem, pct } from './accuracy'
import { addDays } from './dates'
import type { ISODate, Session, Topic } from './types'

export interface WeeklyReport {
  from: ISODate
  to: ISODate
  minutes: number
  questions: number
  /** Overall accuracy for the week; null with no questions. */
  accuracy: number | null
  /** Biggest week-over-week accuracy gain (only when it improved). */
  biggestGain?: { system: string; from: number; to: number }
  /** Weakest system this week. */
  weakest?: { system: string; pct: number }
  topicsFixed: number
  hasData: boolean
}

/** The 7 days before `today` (today isn't finished yet) vs the 7 before that. */
export function weeklyReport(sessions: Session[], topics: Topic[], today: ISODate): WeeklyReport {
  const to = addDays(today, -1)
  const from = addDays(today, -7)
  const prevFrom = addDays(today, -14)
  const prevTo = addDays(today, -8)

  const week = sessions.filter((s) => s.date >= from && s.date <= to)
  const minutes = week.reduce((n, s) => n + s.minutes, 0)
  const questions = week.reduce((n, s) => n + (s.questions ?? 0), 0)
  const correct = week.reduce((n, s) => n + (s.correct ?? 0), 0)

  const now = accuracyBySystem(sessions, from, to)
  const before = accuracyBySystem(sessions, prevFrom, prevTo)
  let biggestGain: WeeklyReport['biggestGain']
  for (const a of now) {
    const b = before.find((x) => x.system === a.system)
    if (!b) continue
    const gain = a.pct - b.pct
    if (gain > 0 && (!biggestGain || gain > biggestGain.to - biggestGain.from)) {
      biggestGain = { system: a.system, from: b.pct, to: a.pct }
    }
  }

  const topicsFixed = topics.filter((t) => t.fixedOn && t.fixedOn >= from && t.fixedOn <= to).length
  return {
    from,
    to,
    minutes,
    questions,
    accuracy: questions > 0 ? pct(correct, questions) : null,
    biggestGain,
    weakest: now[0] ? { system: now[0].system, pct: now[0].pct } : undefined,
    topicsFixed,
    hasData: week.length > 0,
  }
}

/** Weak topics fixed in the last `days` days and still open. */
export function topicCounts(topics: Topic[], today: ISODate, days = 30) {
  const since = addDays(today, -(days - 1))
  return {
    fixed: topics.filter((t) => t.status === 'solid' && t.fixedOn && t.fixedOn >= since).length,
    open: topics.filter((t) => t.status === 'weak' || t.status === 'fixing'),
  }
}
