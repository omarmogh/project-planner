// Rescue mode: when the work left can't fit before a firm exam date even with reasonable
// extra time, the engine stops packing days and offers three honest options with their cost.
// Pure. See docs/ENGINE_SPEC.md section 9.

import { recentAccuracy } from './accuracy'
import {
  RESCUE_COOLDOWN_DAYS, RESCUE_EXTRA_MINUTES, RESCUE_EXTRA_STEP, RESCUE_MAX_EXTRA, RESCUE_MIN_SHORT_MINUTES,
} from './config'
import { addDays, daysBetween } from './dates'
import { estimates } from './estimates'
import { activeGoals, studies, studyDaysLeft } from './exams'
import { goalMinutesLeft, goalMinutesUntilExam, readiness, unitsLeft } from './pace'
import { isCovered, isStarted, plannedTopics, remainingItems, systemsInOrder } from './topics'
import { lecturesLeft, summarySaving } from './uni'
import { isFirm, type EngineState, type Goal, type ISODate, type RescueChoice, type Topic } from './types'

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
  return goalMinutesLeft(s, goal) - goalMinutesUntilExam(s, goal, today, extraPerDay)
}

/**
 * The nearest firm exam that can't be reached even with RESCUE_EXTRA_MINUTES more a day.
 * Rough and projected dates never trigger it. Not repeated within RESCUE_COOLDOWN_DAYS of an answer.
 */
export function rescueCheck(s: EngineState, today: ISODate): RescueOffer | null {
  for (const goal of activeGoals(s.goals, today)) {
    if (!isFirm(goal) || !studies(goal, today) || daysBetween(today, goal.examDate) < 2) continue
    const recent = (s.rescues ?? []).some((r) => r.goalId === goal.id && r.choice && daysBetween(r.date, today) < RESCUE_COOLDOWN_DAYS)
    if (recent) continue
    if (minutesShort(s, goal, today, RESCUE_EXTRA_MINUTES) < RESCUE_MIN_SHORT_MINUTES) continue
    return { goal, short: Math.round(minutesShort(s, goal, today)), options: rescueOptions(s, goal, today) }
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
    if (ready && ready > goal.examDate) {
      const days = daysBetween(goal.examDate, ready)
      out.push({ kind: 'move', newDate: ready, fits: true, cost: `Keeps everything. ${goal.label} moves ${days} ${days === 1 ? 'day' : 'days'} later.` })
    }
  }

  const narrowed = narrow(s, goal, today)
  out.push({ kind: 'narrow', fits: narrowed.fits, coverage: narrowed.coverage, cost: narrowed.cost })

  const days = studyDaysLeft(s, goal, today)
  const need = Math.ceil(short / days / RESCUE_EXTRA_STEP) * RESCUE_EXTRA_STEP
  const minutes = Math.min(RESCUE_MAX_EXTRA, Math.max(RESCUE_EXTRA_STEP, need))
  out.push({
    kind: 'time', minutes, fits: need <= RESCUE_MAX_EXTRA,
    cost: need <= RESCUE_MAX_EXTRA ? `Keeps everything and the date. ${hours(minutes)} more a day until the exam.` : `${hours(minutes)} more a day until the exam, and it still won't all fit.`,
  })
  return out
}

interface Narrowed {
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
      state, fits: gap <= 0, coverage: 100,
      cost: parts.length ? `${cap(parts.join(', '))}. ${lectures > 0 ? 'Every lecture is still covered.' : ''}`.trim() : 'Nothing left to narrow.',
    }
  }

  // Board goal. Topics from the end of the plan first: lowest-weight systems, and the current systems last.
  const factor = estimates(s).topic
  const weightOrder = systemsByWeight(s)
  const rank = (t: Topic) => (s.focus.includes(t.system) ? 1000 : 0) + weightOrder.indexOf(t.system)
  const fresh = plannedTopics(s.topics).filter((t) => !isStarted(t) && !isCovered(t)).sort((a, b) => rank(a) - rank(b))
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
  // 2. Dropped: lowest-weight system first.
  const droppedSystems = new Set<string>()
  let dropped = 0
  for (const t of fresh) {
    if (gap <= 0) break
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
    const best = recentAccuracy(s.sessions, today).sort((a, b) => b.pct - a.pct).map((a) => a.system).filter((x) => systems.includes(x))
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
  if (skippedSystems.length) parts.push(`no extra question review for ${skippedSystems.slice(0, 3).join(', ')}${skippedSystems.length > 3 ? '…' : ''}`)
  const coverage = total > 0 ? Math.round((100 * (total - dropped)) / total) : 100
  return {
    state, fits: gap <= 0, coverage,
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
