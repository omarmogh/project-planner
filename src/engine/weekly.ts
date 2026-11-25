import { accuracyBySystem, pct, recentAccuracy } from './accuracy'
import { RETEST_PASS } from './config'
import { addDays, daysBetween } from './dates'
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
  /** Weakest system, from the same figures as Pace's accuracy bars (so the two never disagree). */
  weakest?: { system: string; pct: number }
  topicsFixed: number
  hasData: boolean
  /** The student has used Locus for a whole week (first session 7+ days ago). Before that there is no card. */
  fullWeek: boolean
  /** Days until the first card, when it isn't a full week yet (1–7). */
  firstIn: number
  /** Something on the card is good news (a gain or a fixed topic): only then is it worth sharing. */
  shareable: boolean
}

/** The 7 days before `today` (today isn't finished yet) vs the 7 before that. */
export function weeklyReport(all: Session[], topics: Topic[], today: ISODate): WeeklyReport {
  // Imported results happened before Locus: they're not this week's work.
  const sessions = all.filter((s) => !s.imported)
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
  // A card on day 3 compares a partial week with nothing: it waits until the first week is whole.
  const first = sessions.reduce<ISODate | undefined>((d, x) => (!d || x.date < d ? x.date : d), undefined)
  const used = first ? daysBetween(first, today) : 0
  const fullWeek = used >= 7
  return {
    from,
    to,
    minutes,
    questions,
    accuracy: questions > 0 ? pct(correct, questions) : null,
    biggestGain,
    weakest: weakestOf(recentAccuracy(all, today), justPassed(week)),
    topicsFixed,
    hasData: week.length > 0,
    fullWeek,
    firstIn: fullWeek ? 0 : 7 - used,
    shareable: !!biggestGain || topicsFixed > 0,
  }
}

/**
 * Weak topics fixed in the last `days` days and still open. `live` (see liveTopics) limits "open" to goals whose
 * exam is still ahead: a topic of a finished exam is history, not open work. Fixed counts keep every goal.
 */
export function topicCounts(topics: Topic[], today: ISODate, days = 30, live: Topic[] = topics) {
  const since = addDays(today, -(days - 1))
  return {
    fixed: topics.filter((t) => t.status === 'solid' && t.fixedOn && t.fixedOn >= since).length,
    open: live.filter((t) => t.status === 'weak' || t.status === 'fixing'),
  }
}

/** Systems with a retest passed this week: never "still your weakest" right after "Passed". */
function justPassed(week: Session[]): Set<string> {
  return new Set(week.filter((x) => x.kind === 'retest' && x.system && x.questions && pct(x.correct ?? 0, x.questions) >= RETEST_PASS).map((x) => x.system!))
}

/** Pace's lowest bar: the last 30 days, imports included, skipping a system the student just passed a retest in. */
function weakestOf(acc: { system: string; pct: number }[], skip: Set<string>): WeeklyReport['weakest'] {
  const w = acc.find((a) => !skip.has(a.system))
  return w ? { system: w.system, pct: w.pct } : undefined
}
