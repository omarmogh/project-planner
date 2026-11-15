// Light days: when the last days were rough, Today offers a lighter day once.
// Pure. All numbers live in config.ts. Copy is never guilt-based.

import {
  ESSENTIAL_TASKS, EXAM_PROTECT_DAYS, OFFER_DECLINED_BACKOFF_DAYS, OFFER_GAP_DAYS, LIGHT_DAY_MINUTES, LIGHT_OFFERS_PER_WEEK, ROUGH_BASELINE_DAYS,
  ROUGH_LOOKBACK_DAYS, ROUGH_MIN_QUESTIONS, ROUGH_MISSES, ROUGH_SCORE_DROP,
} from './config'
import { addDays, daysBetween } from './dates'
import { statedMinutes } from './availability'
import { dayType, sittings } from './exams'
import { readyOnWith } from './pace'
import { isFirm, type EngineState, type ISODate, type LightOfferKind, type Session, type Task } from './types'

const ceilTo5 = (n: number) => Math.ceil(n / 5) * 5

export interface RoughPatch {
  /** Skipped + "Partly" answers in the window. */
  misses: number
  /** Points below the student's usual %, when there's enough data. */
  scoreDrop: number | null
  /** No study logged on any day in the window, after recent activity. */
  missedDays: boolean
}

const scoreOf = (xs: Session[]) => {
  const q = xs.reduce((n, x) => n + (x.questions ?? 0), 0)
  return q >= ROUGH_MIN_QUESTIONS ? (100 * xs.reduce((n, x) => n + (x.correct ?? 0), 0)) / q : null
}

/**
 * Over the last ROUGH_LOOKBACK_DAYS days and today: several tasks skipped or only partly done,
 * a clear drop in question %, or no study at all after recent activity. Null = no rough patch.
 */
export function roughPatch(s: EngineState, today: ISODate): RoughPatch | null {
  const from = addDays(today, -ROUGH_LOOKBACK_DAYS)
  const inWindow = (d: ISODate) => d >= from && d <= today
  const misses = (s.outcomes ?? []).filter((o) => inWindow(o.date) && o.result !== 'done' && !o.auto).length

  const live = s.sessions.filter((x) => !x.imported && x.questions)
  const recent = scoreOf(live.filter((x) => inWindow(x.date)))
  const usual = scoreOf(live.filter((x) => x.date < from && x.date >= addDays(from, -ROUGH_BASELINE_DAYS)))
  const scoreDrop = recent !== null && usual !== null ? Math.round(usual - recent) : null

  // Planned days off (exam, rest, an accepted rest day, a day with no time) are never "missed".
  const off = (d: ISODate) => dayType(s.goals, d) !== 'normal' || (s.daysOff ?? []).includes(d) || statedMinutes(s.availability, d) === 0
  const active = (d: ISODate) => off(d) || s.sessions.some((x) => !x.imported && x.date === d) || (s.outcomes ?? []).some((o) => o.date === d && !o.auto)
  let quiet = true
  for (let i = 1; i <= ROUGH_LOOKBACK_DAYS; i++) if (active(addDays(today, -i))) quiet = false
  let before = false
  for (let i = ROUGH_LOOKBACK_DAYS + 1; i <= ROUGH_LOOKBACK_DAYS + 7; i++) if (active(addDays(today, -i))) before = true
  const missedDays = quiet && before

  const rough = misses >= ROUGH_MISSES || (scoreDrop !== null && scoreDrop >= ROUGH_SCORE_DROP) || missedDays
  return rough ? { misses, scoreDrop, missedDays } : null
}

export interface LightDayOffer {
  kind: LightOfferKind
  /** A full rest day may be offered too: only when the student is ahead of schedule. */
  restAllowed: boolean
}

/** Soonest exam within EXAM_PROTECT_DAYS, if any. */
export function examIsClose(s: EngineState, today: ISODate): boolean {
  return sittings(s.goals).some((x) => x.date >= today && daysBetween(today, x.date) <= EXAM_PROTECT_DAYS)
}

/** Ahead of schedule: a day off still leaves every dated exam ready before its date. */
export function aheadOfSchedule(s: EngineState, today: ISODate): boolean {
  const dated = s.goals.filter((g) => g.examDate > today && isFirm(g))
  if (dated.length === 0) return false
  return dated.every((g) => {
    const ready = readyOnWith(s, g, today, { skipDays: 1 })
    return ready !== null && ready < g.examDate
  })
}

/**
 * What Today offers, once a day, after a rough patch.
 * - Weekly limit reached → 'firstOnly' ("Just the first task today. You can stop after it.").
 * - Exam within EXAM_PROTECT_DAYS → 'essentials': never a break.
 * - Otherwise → 'light' (about LIGHT_DAY_MINUTES); a rest day only when ahead of schedule.
 */
export function lightDayOffer(s: EngineState, today: ISODate): LightDayOffer | null {
  const offers = s.lightOffers ?? []
  // Once a day, and never on back-to-back days: an offer every morning would be nagging.
  if (offers.some((o) => o.date <= today && daysBetween(o.date, today) < OFFER_GAP_DAYS)) return null
  // Declined twice in a row ("Keep the full plan"): the student has answered. Ask again much later.
  const lastTwo = offers.slice(-2)
  if (lastTwo.length === 2 && lastTwo.every((o) => o.answer === 'full') && daysBetween(lastTwo[1].date, today) < OFFER_DECLINED_BACKOFF_DAYS) return null
  // Exam days, eves and rest days are already as light as they get.
  if (dayType(s.goals, today) !== 'normal') return null
  if (!roughPatch(s, today)) return null
  const lastWeek = offers.filter((o) => o.date > addDays(today, -7) && o.date < today && o.kind !== 'firstOnly').length
  // Past the weekly limit: one line of encouragement, once a week at most.
  if (lastWeek >= LIGHT_OFFERS_PER_WEEK) {
    return offers.some((o) => o.kind === 'firstOnly' && o.date > addDays(today, -7)) ? null : { kind: 'firstOnly', restAllowed: false }
  }
  if (examIsClose(s, today)) return { kind: 'essentials', restAllowed: false }
  return { kind: 'light', restAllowed: aheadOfSchedule(s, today) }
}

/**
 * Record the student's answer to today's offer. buildDay reads it: 'light' cuts the list,
 * 'rest' clears it (only when a rest day was really on offer), 'full' changes nothing.
 */
export function answerLight(s: EngineState, today: ISODate, answer: 'light' | 'rest' | 'full'): EngineState {
  const offer = lightDayOffer(s, today)
  if (!offer) return s
  const honoured = answer === 'rest' && !offer.restAllowed ? 'full' : answer
  return {
    ...s,
    lightOffers: [...(s.lightOffers ?? []), { date: today, kind: offer.kind, answer: honoured }],
    daysOff: honoured === 'rest' ? [...(s.daysOff ?? []), today] : s.daysOff,
  }
}

/**
 * What is kept first on a lighter day: deadline work (it has a deadline), then Anki (the last
 * thing cut: reviews pile up), retests, fixes, question blocks, topics, lectures.
 */
export function taskImpact(s: EngineState, t: Task): number {
  if (t.commitmentId) return -1
  if (t.kind === 'anki') return 0
  if (t.kind === 'retest') return 1
  if (t.kind === 'fix') return 2
  const r = s.resources.find((x) => x.id === t.resourceId)
  if (!t.topicId && r?.type === 'qbank') return 3
  if (t.topicId) return 4
  return 5
}

/**
 * The tasks kept on a lighter day, in their original order.
 * 'light': the highest-impact tasks that fit in about LIGHT_DAY_MINUTES (always at least one).
 * 'essentials': the ESSENTIAL_TASKS highest-impact tasks.
 * 'firstOnly': the plan is unchanged; the copy just says the first task is enough.
 */
export function lightTasks(s: EngineState, tasks: Task[], kind: LightOfferKind): Task[] {
  const pending = tasks.filter((t) => t.status === 'pending')
  if (kind === 'firstOnly' || pending.length === 0) return tasks
  // Deadline work is the student's own obligation: always kept, never counted against the light day.
  const own = pending.filter((t) => t.commitmentId)
  const ranked = pending.filter((t) => !t.commitmentId).sort((a, b) => taskImpact(s, a) - taskImpact(s, b))
  let keep: Task[]
  if (kind === 'essentials') {
    // Anki, then the nearest exam's own work before anything else: that is what's essential this close to it.
    const exam = sittings(s.goals).filter((x) => x.date > (pending[0]?.date ?? '')).sort((a, b) => a.date.localeCompare(b.date))[0]?.goal.id
    const first = ranked.filter((t) => t.kind === 'anki')
    const mine = ranked.filter((t) => t.kind !== 'anki' && t.goalId === exam)
    const rest = ranked.filter((t) => t.kind !== 'anki' && t.goalId !== exam)
    keep = [...first, ...mine, ...rest].slice(0, ESSENTIAL_TASKS)
  }
  else {
    // The highest-impact task always stays (Anki when there is one), then whatever still fits.
    keep = ranked.slice(0, 1)
    let used = keep.reduce((n, t) => n + t.minutes, 0)
    for (const t of ranked.slice(1)) {
      if (used + t.minutes <= LIGHT_DAY_MINUTES) {
        keep.push(t)
        used += t.minutes
      }
    }
  }
  keep = [...own, ...keep]
  const ids = new Set(keep.map((t) => t.id))
  return tasks.filter((t) => t.status !== 'pending' || ids.has(t.id))
}

export interface Replan {
  state: EngineState
  /** Minutes moved to the coming days. */
  moved: number
  /** About how much longer each of the next days gets (rounded up to 5). */
  perDay: number
  /** Over how many days. */
  days: number
}

/**
 * After a light (or rest) day: nothing is rescheduled by hand. Topic, lecture and question work
 * isn't advanced, and dropped fixes and retests stay due, so the next days pick everything up
 * inside their own limits (spec 6). This only says how much moved, for one calm line on Today.
 */
export function replanAfterLightDay(s: EngineState, dropped: Task[], today: ISODate): Replan {
  const moved = dropped.filter((t) => t.kind !== 'anki').reduce((n, t) => n + t.minutes, 0)
  const soonest = s.goals.filter((g) => g.examDate > today).map((g) => daysBetween(today, g.examDate)).sort((a, b) => a - b)[0]
  const days = Math.max(1, Math.min(7, (soonest ?? 8) - 1))
  return { state: s, moved, perDay: moved > 0 ? ceilTo5(moved / days) : 0, days }
}
