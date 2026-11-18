// Changing the plan without starting over: add, edit or remove an exam, and start the next
// rotation or block. Sessions, topics, outcomes, retests, commitments and Anki are always kept.
// Pure functions: state in, state out.

import { RETEST_BEFORE_EXAM_DAYS, RETIRE_AFTER_DAYS } from './config'
import { addDays, daysBetween } from './dates'
import { activeGoals, lastSitting, studies } from './exams'
import { isFirm, type EngineState, type Goal, type ISODate, type Resource, type Rotation, type Task } from './types'

const taken = (s: EngineState) => new Set([...s.goals, ...(s.pastGoals ?? [])].map((g) => g.id))

/** An id not used by any goal, now or past: "uni-im", then "uni-im-2026-12-01", then "-2", "-3". */
export function freeGoalId(s: EngineState, id: string, today: ISODate): string {
  const used = taken(s)
  if (!used.has(id)) return id
  const base = `${id}-${today}`
  let out = base
  for (let i = 2; used.has(out); i++) out = `${base}-${i}`
  return out
}

function freeResourceId(used: Set<string>, id: string): string {
  let out = id
  for (let i = 2; used.has(out); i++) out = `${id}-${i}`
  used.add(out)
  return out
}

/** Anki (and a question bank) follow the nearest exam still ahead when their own exam is gone. */
function repoint(s: EngineState, today: ISODate): EngineState {
  const ahead = activeGoals(s.goals, today).filter((g) => studies(g, today))
  const alive = (id: string) => ahead.some((g) => g.id === id)
  const target = s.goals.find((g) => g.id === s.topicGoalId && alive(g.id)) ?? ahead[0]
  if (!target) return s
  let next = s
  if (s.anki && !alive(s.anki.goalId)) next = { ...next, anki: { ...s.anki, goalId: target.id } }
  // The question bank keeps its progress; it moves only to a goal that has none.
  const bank = next.resources.find((r) => r.type === 'qbank' && !alive(r.goalId))
  if (bank && !next.resources.some((r) => r.type === 'qbank' && r.goalId === target.id)) {
    next = { ...next, resources: next.resources.map((r) => (r.id === bank.id ? { ...r, goalId: target.id } : r)) }
  }
  return next
}

/**
 * Add an exam (a goal with its own material). The id is made unique against current and past goals;
 * resource ids too, and resources are re-pointed to the final goal id. Anki and the question bank move to it
 * when their own exam is over.
 */
export function addGoal(s: EngineState, goal: Goal, resources: Resource[], today: ISODate): EngineState {
  const id = freeGoalId(s, goal.id, today)
  const used = new Set(s.resources.map((r) => r.id))
  const mine = resources.map((r) => ({ ...r, id: freeResourceId(used, r.id), goalId: id }))
  return repoint({ ...s, goals: [...s.goals, { ...goal, id }], resources: [...s.resources, ...mine] }, today)
}

/**
 * Remove an exam the student no longer has. Its material and its pending fixes and retests go; what was
 * studied (sessions, topics, outcomes) stays. Anki follows the nearest exam still ahead.
 */
export function removeGoal(s: EngineState, goalId: string, today: ISODate): EngineState {
  const next: EngineState = {
    ...s,
    goals: s.goals.filter((g) => g.id !== goalId),
    resources: s.resources.filter((r) => r.goalId !== goalId || r.type === 'qbank'),
    scheduled: s.scheduled.filter((t) => !(t.goalId === goalId && t.status === 'pending')),
    topicGoalId: s.topicGoalId === goalId ? undefined : s.topicGoalId,
    focus: s.topicGoalId === goalId ? [] : s.focus,
  }
  return repoint(next, today)
}

export type GoalPatch = Partial<Pick<Goal, 'label' | 'examDate' | 'dateSource' | 'parts' | 'windDownDays'>>

/** Change an exam (its date, label, a part). Pending retests are moved before the new date (fitRetests). */
export function editGoal(s: EngineState, goalId: string, patch: GoalPatch, today: ISODate): EngineState {
  const goals = s.goals.map((g) => (g.id === goalId ? { ...g, ...patch } : g))
  return { ...s, goals, scheduled: fitRetests({ ...s, goals }, s.scheduled, today) }
}

export type ResourcePatch = Partial<Pick<Resource, 'name' | 'totalUnits' | 'doneUnits' | 'unitsUnsure' | 'itemNames' | 'minutesPerUnit'>>

/** Change one piece of material ("I have 22 lectures, not 15"). A real count clears "Not sure" unless the patch says otherwise. */
export function editResource(s: EngineState, id: string, patch: ResourcePatch): EngineState {
  return {
    ...s,
    resources: s.resources.map((r) => {
      if (r.id !== id) return r
      const next = { ...r, ...patch }
      if (patch.totalUnits !== undefined && patch.unitsUnsure === undefined) delete next.unitsUnsure
      next.doneUnits = Math.min(next.doneUnits, next.totalUnits)
      return next
    }),
  }
}

/**
 * Passed uni exams move to `pastGoals` once their rest day is over (RETIRE_AFTER_DAYS after the last sitting).
 * Their pending fixes and retests are already gone (spec: a uni exam's loops drop once it passes).
 * Their resources stay, so past sessions keep their names. Anki follows the next exam.
 */
export function retireGoals(s: EngineState, today: ISODate): EngineState {
  const old = s.goals.filter((g) => g.kind === 'uni' && daysBetween(lastSitting(g), today) >= RETIRE_AFTER_DAYS)
  if (old.length === 0) return s
  const ids = new Set(old.map((g) => g.id))
  return repoint({
    ...s,
    goals: s.goals.filter((g) => !ids.has(g.id)),
    pastGoals: [...(s.pastGoals ?? []), ...old],
    scheduled: s.scheduled.filter((t) => !(ids.has(t.goalId) && t.status === 'pending')),
  }, today)
}

export interface NextBlock {
  /** "Surgery", "ENT + Ophthalmology", "Semester 2". No hospital wording needed: a basic-year block works the same. */
  name: string
  short?: string
  until: ISODate
  /** Board systems that match it (suggested first). */
  systems?: string[]
  /** Its exams, each with its own material. Ids are made unique (addGoal). */
  exams: { goal: Goal; resources: Resource[] }[]
}

/** The next rotation or block: its exams are added, everything learnt so far is kept. */
export function startNextRotation(s: EngineState, block: NextBlock, today: ISODate): EngineState {
  let next = retireGoals(s, today)
  for (const e of block.exams) next = addGoal(next, e.goal, e.resources, today)
  const rotation: Rotation = { name: block.name, short: block.short ?? block.name, until: block.until, systems: block.systems ?? [] }
  return repoint({ ...next, rotation }, today)
}

/** The last day a retest for this goal may land on, or null when the date isn't firm. */
export function retestLatest(goal: Goal): ISODate | null {
  return isFirm(goal) ? addDays(goal.examDate, -RETEST_BEFORE_EXAM_DAYS) : null
}

/**
 * Retests never land on or after the exam's eve (spec 7.x). A pending retest past the line moves to the last
 * day that fits, but never before tomorrow or before its fix's day. One that can't fit: a retest in `added`
 * (just created) is left out; one that already existed stays where it is.
 */
export function fitRetests(s: Pick<EngineState, 'goals'>, scheduled: Task[], today: ISODate, added?: Set<string>): Task[] {
  const byId = new Map(s.goals.map((g) => [g.id, g]))
  const out: Task[] = []
  for (const t of scheduled) {
    const g = byId.get(t.goalId)
    const latest = g && t.kind === 'retest' && t.status === 'pending' ? retestLatest(g) : null
    if (!latest || t.date <= latest) { out.push(t); continue }
    const fix = t.fixId ? scheduled.find((x) => x.id === t.fixId && x.status === 'pending') : undefined
    const earliest = [addDays(today, 1), fix ? addDays(fix.date, 1) : ''].sort().at(-1)!
    if (latest >= earliest) out.push({ ...t, date: latest })
    else if (!added?.has(t.id)) out.push(t)
  }
  return out
}
