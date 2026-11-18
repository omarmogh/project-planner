// Rescue mode: when the work left can't fit before a firm exam date even with reasonable
// extra time, the engine stops packing days and offers three honest options with their cost.
// Pure. See docs/ENGINE_SPEC.md section 9.

import { recentAccuracy } from './accuracy'
import {
  RESCUE_COOLDOWN_DAYS, RESCUE_COOLDOWN_FACTOR, RESCUE_DISMISS_DAYS, RESCUE_EXTRA_MINUTES, RESCUE_MAX_DROP_SHARE, RESCUE_MAX_MOVE_DAYS, RESCUE_MIN_DAYS_LEFT, RESCUE_MIN_MOVE_DAYS, WEAK_BELOW, RESCUE_EXTRA_STEP, RESCUE_MAX_EXTRA, RESCUE_MIN_SHORT_MINUTES,
} from './config'
import { addDays, daysBetween } from './dates'
import { estimates } from './estimates'
import { activeGoals, dayType, studies, studyDaysLeft } from './exams'
import { openLoopTopicIds } from './fixes'
import { goalMinutesLeft, goalMinutesUntilExam, readiness, unitsLeft } from './pace'
import { isCovered, isStarted, plannedTopics, remainingItems, systemsInOrder } from './topics'
import { lecturesLeft, summarySaving } from './uni'
import { type EngineState, type Goal, type ISODate, type RescueChoice, type Topic } from './types'

export interface RescueOption {
  kind: RescueChoice
  /** One line: what this option costs the student. */
  cost: string
  /** False when even this option doesn't close the whole gap (it still helps). */
  fits: boolean
  /** move: the new exam date. */
  newDate?: ISODate
  /** time: extra minutes a day until the exam. */
  minutes?: number
  /** narrow: share of the material still covered, 0–100. */
  coverage?: number
}

export interface RescueOffer {
  goal: Goal
  /** Minutes of work that don't fit before the exam at the current daily time. */
  short: number
  options: RescueOption[]
}

/** Minutes short for a goal at its current daily time (≤ 0 = it fits). */
export function minutesShort(s: EngineState, goal: Goal, today: ISODate, extraPerDay = 0): number {
  // Amounts after "Not sure" are defaults: never a reason for rescue.
  return goalMinutesLeft(s, goal, { sureOnly: true }) - goalMinutesUntilExam(s, goal, today, extraPerDay)
}

/**
 * The nearest firm exam that can't be reached even with RESCUE_EXTRA_MINUTES more a day.
 * Rough and projected dates never trigger it. Not repeated within RESCUE_COOLDOWN_DAYS of an answer.
 */
export function rescueCheck(s: EngineState, today: ISODate): RescueOffer | null {
  // Never on an exam day, an eve or a rest day: those days have one job.
  if (dayType(s.goals, today) !== 'normal') return null
  for (const goal of activeGoals(s.goals, today)) {
    // In the last few study days nothing an option changes can still help.
    // Only a date the student gave: an assumed one ("Don't know yet") is never judged.
    if (goal.dateSource !== 'set' || !studies(goal, today) || studyDaysLeft(s, goal, today) < RESCUE_MIN_DAYS_LEFT) continue
    // Each answer multiplies the wait before the next offer for the same exam, so it never becomes a weekly
    // question. "Not now" waits RESCUE_DISMISS_DAYS.
    const mine = (s.rescues ?? []).filter((r) => r.goalId === goal.id)
    const answered = mine.filter((r) => r.choice)
    const last = mine.at(-1)
    const wait = last?.choice ? RESCUE_COOLDOWN_DAYS * RESCUE_COOLDOWN_FACTOR ** (answered.length - 1) : RESCUE_DISMISS_DAYS
    if (last && daysBetween(last.date, today) < wait) continue
    if (minutesShort(s, goal, today, RESCUE_EXTRA_MINUTES) < RESCUE_MIN_SHORT_MINUTES) continue
    const options = rescueOptions(s, goal, today)
    // Already answered once and nothing left can close the gap: asking again would only repeat bad news.
    // Pace keeps showing the honest ready-by date.
    if (answered.length > 0 && !options.some((o) => o.fits)) continue
    return { goal, short: Math.round(minutesShort(s, goal, today)), options }
  }
  return null
}

const hours = (min: number) => (min < 60 ? `${min} min` : min % 60 === 0 ? `${min / 60} h` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`)

export function rescueOptions(s: EngineState, goal: Goal, today: ISODate): RescueOption[] {
  const out: RescueOption[] = []
  const short = minutesShort(s, goal, today)

  // Move the date: only an exam the student books. A uni exam isn't theirs to move.
  if (goal.kind !== 'uni') {
    const ready = readiness(s, goal, today).readyOn
    const later = ready ? daysBetween(goal.examDate, ready) : 0
    if (ready && later >= RESCUE_MIN_MOVE_DAYS && later <= RESCUE_MAX_MOVE_DAYS) {
      const days = later
      out.push({ kind: 'move', newDate: ready, fits: true, cost: `Keeps everything. ${goal.label} moves ${days} ${days === 1 ? 'day' : 'days'} later.` })
    }
  }

  // Narrow the scope: only when something is left to narrow.
  const narrowed = narrow(s, goal, today)
  if (narrowed.changed) out.push({ kind: 'narrow', fits: narrowed.fits, coverage: narrowed.coverage, cost: narrowed.fits ? narrowed.cost : `${narrowed.cost} Not enough by itself.` })

  const days = studyDaysLeft(s, goal, today)
  const need = Math.ceil(short / days / RESCUE_EXTRA_STEP) * RESCUE_EXTRA_STEP
  // What's already been added counts toward the most a day can take.
  const have = s.availability.extra && s.availability.extra.until >= today ? s.availability.extra.minutes : 0
  const minutes = Math.min(RESCUE_MAX_EXTRA - have, Math.max(RESCUE_EXTRA_STEP, need))
  if (minutes >= RESCUE_EXTRA_STEP) out.push({
    kind: 'time', minutes, fits: need <= minutes,
    cost: need <= minutes ? `Keeps everything and the date. ${hours(minutes)} more a day until the exam.` : `${hours(minutes)} more a day until the exam, and it still won't all fit.`,
  })
  return out
}

interface Narrowed {
  /** False when there was nothing left to narrow. */
  changed: boolean
  state: EngineState
  fits: boolean
  coverage: number
  cost: string
}

/** Systems from least to most exam weight: questions per system in imported stats, else the map's order, last first. */
export function systemsByWeight(s: EngineState): string[] {
  const systems = systemsInOrder(s.topics)
  const imported = new Map<string, number>()
  for (const x of s.sessions) if (x.imported && x.system && x.questions) imported.set(x.system, (imported.get(x.system) ?? 0) + x.questions)
  if (imported.size > 0) return [...systems].sort((a, b) => (imported.get(a) ?? 0) - (imported.get(b) ?? 0))
  // TODO(placeholder): real exam weights per system. Until then the map's order, last first.
  return [...systems].reverse()
}

/**
 * Narrow the scope until the plan fits (or nothing is left to narrow).
 * Board goal: 1. not-started topics → questions only; 2. not-started topics dropped, lowest-weight
 * system first; 3. question review of the best-accuracy systems left out.
 * Uni goal: remaining lectures from summaries, then fewer past papers (never under one).
 */
export function narrow(s: EngineState, goal: Goal, today: ISODate): Narrowed {
  const have = goalMinutesUntilExam(s, goal, today)
  let gap = goalMinutesLeft(s, goal) - have
  let state = s
  const parts: string[] = []

  if (goal.id !== s.topicGoalId) {
    const est = estimates(s).lectures
    const slides = s.resources.filter((r) => r.goalId === goal.id && r.type === 'slides' && !r.fromSummary && lecturesLeft(r) > 0)
    if (gap > 0 && slides.length) {
      const n = slides.reduce((m, r) => m + lecturesLeft(r), 0)
      gap -= slides.reduce((m, r) => m + summarySaving(r, est), 0)
      state = { ...state, resources: state.resources.map((r) => (slides.some((x) => x.id === r.id) ? { ...r, fromSummary: true } : r)) }
      parts.push(`the ${n} ${n === 1 ? 'lecture' : 'lectures'} left from summaries`)
    }
    const papers = state.resources.find((r) => r.goalId === goal.id && r.type === 'papers')
    if (gap > 0 && papers) {
      const floor = Math.max(1, Math.ceil(papers.doneUnits))
      let total = papers.totalUnits
      while (gap > 0 && total > floor) {
        total--
        gap -= papers.minutesPerUnit
      }
      const cut = papers.totalUnits - total
      if (cut > 0) {
        state = { ...state, resources: state.resources.map((r) => (r.id === papers.id ? { ...r, totalUnits: total } : r)) }
        parts.push(`${cut} fewer past ${cut === 1 ? 'paper' : 'papers'}`)
      }
    }
    const lectures = s.resources.filter((r) => r.goalId === goal.id && r.type === 'slides').reduce((m, r) => m + r.totalUnits, 0)
    return {
      changed: parts.length > 0, state, fits: gap <= 0, coverage: 100,
      cost: parts.length ? `${cap(parts.join(', '))}. ${lectures > 0 ? 'Every lecture is still covered.' : ''}`.trim() : 'Nothing left to narrow.',
    }
  }

  // Board goal. Topics from the end of the plan first: lowest-weight systems, and the current systems last.
  const factor = estimates(s).topic
  const weightOrder = systemsByWeight(s)
  const rank = (t: Topic) => (s.focus.includes(t.system) ? 1000 : 0) + weightOrder.indexOf(t.system)
  const open = openLoopTopicIds(s.scheduled)
  const fresh = plannedTopics(s.topics).filter((t) => !isStarted(t) && !isCovered(t) && !open.has(t.id)).sort((a, b) => rank(a) - rank(b))
  const total = plannedTopics(s.topics).length
  const change = new Map<string, Partial<Topic>>()

  // 1. Questions only: retrieval practice is what's kept when time is short.
  let qOnly = 0
  for (const t of fresh) {
    if (gap <= 0) break
    if (t.questionsOnly) continue
    const saved = remainingItems(t, factor).filter((r) => r.item.source !== 'qbank').reduce((n, r) => n + r.minutes, 0)
    if (saved <= 0) continue
    change.set(t.id, { questionsOnly: true })
    gap -= saved
    qOnly++
  }
  // 2. Dropped: lowest-weight system first, never more than RESCUE_MAX_DROP_SHARE of the topics.
  const droppedSystems = new Set<string>()
  let dropped = 0
  const already = s.topics.filter((t) => t.dropped).length
  // Leaving topics out needs a real idea of what the exam asks least. Without the student's own question
  // counts per system there is none, so nothing is dropped: questions-only is as far as it goes.
  const known = s.sessions.some((x) => x.imported && x.system && x.questions)
  const maxDrop = known ? Math.max(0, Math.floor((total + already) * RESCUE_MAX_DROP_SHARE) - already) : 0
  for (const t of fresh) {
    if (gap <= 0 || dropped >= maxDrop) break
    const left = remainingItems({ ...t, questionsOnly: true }, factor).reduce((n, r) => n + r.minutes, 0)
    change.set(t.id, { questionsOnly: true, dropped: true })
    gap -= left
    dropped++
    droppedSystems.add(t.system)
  }
  state = { ...state, topics: state.topics.map((t) => (change.has(t.id) ? { ...t, ...change.get(t.id) } : t)) }

  // 3. Best accuracy: leave out the question review of the systems the student already answers well.
  const qbank = state.resources.find((r) => r.goalId === goal.id && r.type === 'qbank')
  let skippedSystems: string[] = []
  if (gap > 0 && qbank) {
    const topicQuestions = plannedTopics(state.topics).reduce((n, t) => n + remainingItems(t, factor).reduce((m, r) => m + (r.item.questions ?? 0), 0), 0)
    const review = Math.max(0, unitsLeft(qbank) - topicQuestions)
    const systems = systemsInOrder(s.topics)
    const per = systems.length ? review / systems.length : 0
    const perMinutes = per * qbank.minutesPerUnit * estimates(s).questions
    // Only systems the student already answers well: never the weak ones.
    const best = recentAccuracy(s.sessions, today).filter((a) => a.pct >= WEAK_BELOW).sort((a, b) => b.pct - a.pct).map((a) => a.system).filter((x) => systems.includes(x))
    let skip = 0
    for (const sys of best) {
      if (gap <= 0 || perMinutes <= 0) break
      skip += per
      gap -= perMinutes
      skippedSystems.push(sys)
    }
    if (skip > 0) state = { ...state, resources: state.resources.map((r) => (r.id === qbank.id ? { ...r, skipUnits: Math.round((r.skipUnits ?? 0) + skip) } : r)) }
  }

  if (qOnly - dropped > 0) parts.push(`${qOnly - dropped} ${qOnly - dropped === 1 ? 'topic' : 'topics'} by questions only`)
  if (dropped > 0) parts.push(`${dropped} ${dropped === 1 ? 'topic' : 'topics'} left out (${[...droppedSystems].slice(0, 3).join(', ')}${droppedSystems.size > 3 ? '…' : ''})`)
  if (skippedSystems.length) parts.push(`no second pass of questions for ${skippedSystems.slice(0, 3).join(', ')}${skippedSystems.length > 3 ? '…' : ''}`)
  const coverage = total + already > 0 ? Math.round((100 * (total - dropped)) / (total + already)) : 100
  return {
    changed: parts.length > 0, state, fits: gap <= 0, coverage,
    cost: parts.length ? `${cap(parts.join('; '))}. Covers ${coverage}% of topics.` : 'Nothing left to narrow.',
  }
}

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)

/** Apply the student's choice. The record keeps the offer from coming back for RESCUE_COOLDOWN_DAYS. */
export function applyRescue(s: EngineState, goalId: string, choice: RescueChoice, today: ISODate): EngineState {
  const goal = s.goals.find((g) => g.id === goalId)
  if (!goal) return s
  const option = rescueOptions(s, goal, today).find((o) => o.kind === choice)
  if (!option) return s
  let next = s
  if (choice === 'move' && option.newDate) {
    next = { ...s, goals: s.goals.map((g) => (g.id === goalId ? { ...g, examDate: option.newDate!, dateSource: 'set' as const } : g)) }
  } else if (choice === 'narrow') {
    next = narrow(s, goal, today).state
  } else if (choice === 'time' && option.minutes) {
    const until = addDays(goal.examDate, -1)
    const cur = s.availability.extra && s.availability.extra.until >= today ? s.availability.extra : undefined
    next = {
      ...s,
      availability: { ...s.availability, extra: { minutes: Math.min(RESCUE_MAX_EXTRA, (cur?.minutes ?? 0) + option.minutes), until: cur && cur.until > until ? cur.until : until } },
    }
  }
  return { ...next, rescues: [...(s.rescues ?? []), { goalId, date: today, choice }] }
}

/** "Not now": the offer was seen and left unanswered. It comes back after RESCUE_DISMISS_DAYS. */
export function dismissRescue(s: EngineState, goalId: string, today: ISODate): EngineState {
  return { ...s, rescues: [...(s.rescues ?? []), { goalId, date: today }] }
}
