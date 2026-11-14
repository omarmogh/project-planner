// Light days: when the last days were rough, Today offers a lighter day once.
// Pure. All numbers live in config.ts. Copy is never guilt-based.

import {
  ESSENTIAL_TASKS, EXAM_PROTECT_DAYS, LIGHT_DAY_MINUTES, LIGHT_OFFERS_PER_WEEK, ROUGH_BASELINE_DAYS,
  ROUGH_LOOKBACK_DAYS, ROUGH_MIN_QUESTIONS, ROUGH_MISSES, ROUGH_SCORE_DROP,
} from './config'
import { addDays, daysBetween } from './dates'
import { readyOnWith } from './pace'
import type { EngineState, ISODate, LightOfferKind, Session, Task } from './types'

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
  const misses = (s.outcomes ?? []).filter((o) => inWindow(o.date) && o.result !== 'done').length

  const live = s.sessions.filter((x) => !x.imported && x.questions)
  const recent = scoreOf(live.filter((x) => inWindow(x.date)))
  const usual = scoreOf(live.filter((x) => x.date < from && x.date >= addDays(from, -ROUGH_BASELINE_DAYS)))
  const scoreDrop = recent !== null && usual !== null ? Math.round(usual - recent) : null

  const active = (d: ISODate) => s.sessions.some((x) => !x.imported && x.date === d) || (s.outcomes ?? []).some((o) => o.date === d)
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
  return s.goals.some((g) => g.examDate >= today && daysBetween(today, g.examDate) <= EXAM_PROTECT_DAYS)
}

/** Ahead of schedule: a day off still leaves every dated exam ready before its date. */
export function aheadOfSchedule(s: EngineState, today: ISODate): boolean {
  const dated = s.goals.filter((g) => g.examDate > today && g.dateSource !== 'projected')
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
  if (offers.some((o) => o.date === today)) return null
  if (!roughPatch(s, today)) return null
  const lastWeek = offers.filter((o) => o.date > addDays(today, -7) && o.date < today && o.kind !== 'firstOnly').length
  if (lastWeek >= LIGHT_OFFERS_PER_WEEK) return { kind: 'firstOnly', restAllowed: false }
  if (examIsClose(s, today)) return { kind: 'essentials', restAllowed: false }
  return { kind: 'light', restAllowed: aheadOfSchedule(s, today) }
}

/** Highest impact first: retests, fixes, Anki (reviews pile up), question blocks, topics, slides. */
export function taskImpact(s: EngineState, t: Task): number {
  if (t.kind === 'retest') return 0
  if (t.kind === 'fix') return 1
  if (t.kind === 'anki') return 2
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
  const ranked = [...pending].sort((a, b) => taskImpact(s, a) - taskImpact(s, b))
  let keep: Task[]
  if (kind === 'essentials') keep = ranked.slice(0, ESSENTIAL_TASKS)
  else {
    keep = []
    let used = 0
    for (const t of ranked) {
      if (used + t.minutes <= LIGHT_DAY_MINUTES) {
        keep.push(t)
        used += t.minutes
      }
    }
    if (keep.length === 0) keep = [ranked[0]]
  }
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
 * Re-plan the rest of the week after a light (or rest) day. Topic, slides and question
 * work isn't advanced, so the next plans pick it up by themselves; dropped fixes and
 * retests are spread one per day from tomorrow so they don't all land on one day.
 */
export function replanAfterLightDay(s: EngineState, dropped: Task[], today: ISODate): Replan {
  let i = 1
  const pinned = new Map<string, ISODate>()
  for (const t of dropped) if (t.kind === 'fix' || t.kind === 'retest') pinned.set(t.id, addDays(today, i++))
  const scheduled = s.scheduled.map((t) => (pinned.has(t.id) ? { ...t, date: pinned.get(t.id)! } : t))
  const moved = dropped.filter((t) => t.kind !== 'anki').reduce((n, t) => n + t.minutes, 0)
  const soonest = s.goals.filter((g) => g.examDate > today).map((g) => daysBetween(today, g.examDate)).sort((a, b) => a - b)[0]
  const days = Math.max(1, Math.min(7, (soonest ?? 8) - 1))
  return { state: { ...s, scheduled }, moved, perDay: moved > 0 ? ceilTo5(moved / days) : 0, days }
}
