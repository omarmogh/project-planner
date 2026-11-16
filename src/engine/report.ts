// What a finished task does to the state: one pure function for every kind of task.
// The app and the simulator both go through reportTask, so they can't drift apart.

import { pct } from './accuracy'
import { MIXED_SYSTEM } from './config'
import { overconfidence, type TopicScore } from './confidence'
import { fixOptions, goalMaterial, openLoopTopicIds, planFix, systemTopicId, topicPhrase, type FixOption, type FixPlan } from './fixes'
import { applyCompletion } from './progress'
import { applyRetest, markWeak } from './retest'
import type { Completion, EngineState, ISODate, Session, Task } from './types'

export type Outcome =
  | { kind: 'fix'; system: string; score: number; plan: FixPlan }
  | { kind: 'clean'; system: string; score: number }
  /** One question from the line: a few more questions next day decide. */
  | { kind: 'retestBorderline'; score: number; name: string; next: ISODate; more: number }
  | { kind: 'retestPass'; score: number; name: string }
  | { kind: 'retestAgain'; score: number; name: string; next: ISODate }
  | { kind: 'retestFail'; score: number; name: string; fix: Task; retest: Task; options: FixOption[]; parked?: boolean }
  /** Missed again after a rest and a fresh pass: no further loop for now. */
  | { kind: 'retestStopped'; score: number; name: string }
  | { kind: 'fixDone'; name: string; retestDate?: ISODate }
  /** Done / Partly / Didn't get to it, for a topic, lectures, a paper, a fix or deadline work. `score` when questions were entered. */
  | { kind: 'progress'; result: Completion; score?: number }
  | { kind: 'ankiDone'; cards: number | null; newLeft: number }

export interface TaskReport {
  result: Completion
  /** Minutes from the timer. Defaults to the planned minutes. */
  minutes?: number
  /** Questions answered and % correct, when the task had questions. */
  questions?: number
  percent?: number
  /** Topics (or, after a mixed block, systems) the student tapped as missed. */
  weakTopicIds?: string[]
  /** Anki cards reviewed, when the student says. */
  cards?: number | null
}

export interface Reported {
  state: EngineState
  outcome: Outcome
  /** Ids of tasks this report added to the coming days. */
  added: string[]
  /** "You felt sure about X, but scored Y%." Shown once. */
  confidenceNote: { name: string; score: number; reviewed: boolean } | null
}

/** Log the session and the answer. A skipped task logs no session; every answer counts toward spotting a rough patch. */
function logged(s: EngineState, task: Task, r: TaskReport, today: ISODate, extra: Partial<Session> = {}): EngineState {
  const session: Session = {
    id: `s-${task.id}`,
    date: today,
    kind: task.kind,
    goalId: task.goalId,
    resourceId: task.resourceId,
    commitmentId: task.commitmentId,
    system: task.system,
    topicIds: task.topicIds,
    minutes: r.minutes ?? task.minutes,
    planned: r.result === 'done' ? task.minutes : undefined,
    ...extra,
  }
  return {
    ...s,
    outcomes: [...(s.outcomes ?? []), { date: today, taskId: task.id, result: r.result }],
    sessions: r.result === 'skipped' ? s.sessions : [...s.sessions, session],
    scheduled: r.result === 'done' ? s.scheduled.map((t) => (t.id === task.id ? { ...t, status: 'done' as const } : t)) : s.scheduled,
  }
}

function addFix(s: EngineState, fix: FixPlan): EngineState {
  return {
    ...s,
    topics: markWeak([...s.topics, ...fix.newTopics], fix.topicIds).map((t) => (fix.topicIds.includes(t.id) ? { ...t, lastFix: fix.fix.fixAction } : t)),
    scheduled: [...s.scheduled, fix.fix, ...(fix.retest ? [fix.retest] : [])],
  }
}

/**
 * Apply one answer: Done / Partly / Didn't get to it, with the score when there were questions.
 * - Anki: new cards left go down.
 * - Retest (done, with a score): pass → second retest or solid; fail → a different fix and a new retest.
 * - A question block or a topic's questions under the line → one fix and one retest (never a second loop for a topic).
 * - Everything else moves on by applyCompletion.
 */
export function reportTask(s: EngineState, task: Task, r: TaskReport, today: ISODate, opts: { fixLoop?: boolean } = {}): Reported {
  const fixLoop = opts.fixLoop ?? true
  const scored = r.questions !== undefined && r.percent !== undefined && r.questions > 0
  // Unrounded so the typed % is exactly what the engine sees (59% must stay < 60%).
  const correct = scored ? (r.questions! * r.percent!) / 100 : undefined
  const none = { added: [] as string[], confidenceNote: null }

  if (task.kind === 'anki') {
    let next = logged(s, task, r, today, { cards: r.cards ?? undefined })
    if (r.result !== 'done') return { state: next, outcome: { kind: 'progress', result: r.result }, ...none }
    const newLeft = Math.max(0, (next.anki?.newCardsLeft ?? 0) - (task.amount ?? 0))
    if (next.anki) next = { ...next, anki: { ...next.anki, newCardsLeft: newLeft } }
    return { state: next, outcome: { kind: 'ankiDone', cards: r.cards ?? null, newLeft }, ...none }
  }

  if (task.kind === 'retest') {
    // A retest only counts with a score; otherwise it stays due.
    if (r.result !== 'done' || !scored) {
      const skipped = { ...r, result: 'skipped' as const }
      return { state: logged(s, task, skipped, today), outcome: { kind: 'progress', result: 'skipped' }, ...none }
    }
    const next = logged(s, task, r, today, { questions: r.questions, correct })
    const o = applyRetest(task, r.questions!, correct!, today, next)
    const name = topicPhrase(o.topics.filter((t) => task.topicIds?.includes(t.id)))
    if (o.result === 'borderline') {
      return {
        state: { ...next, scheduled: [...next.scheduled, o.retest!] },
        outcome: { kind: 'retestBorderline', score: o.score, name, next: o.retest!.date, more: o.retest!.amount ?? 0 },
        ...none,
      }
    }
    if (o.result === 'solid') return { state: { ...next, topics: o.topics }, outcome: { kind: 'retestPass', score: o.score, name }, ...none }
    if (o.result === 'again') {
      return {
        state: { ...next, topics: o.topics, scheduled: [...next.scheduled, o.retest!] },
        outcome: { kind: 'retestAgain', score: o.score, name, next: o.retest!.date },
        ...none,
      }
    }
    const options = fixOptions(name, goalMaterial(next, task.goalId))
    // After a rest and another run of misses the loop stops: the topic stays weak on Pace, with no more retests.
    if (!o.fix || !o.retest) return { state: { ...next, topics: o.topics }, outcome: { kind: 'retestStopped', score: o.score, name }, ...none }
    return {
      state: { ...next, topics: o.topics, scheduled: [...next.scheduled, o.fix, o.retest] },
      outcome: { kind: 'retestFail', score: o.score, name, fix: o.fix, retest: o.retest, options, parked: o.parked },
      added: [o.fix.id],
      confidenceNote: null,
    }
  }

  const extra: Partial<Session> = scored ? { questions: r.questions, correct } : {}
  let next = logged(s, task, r, today, extra)
  next = applyCompletion(next, task, r.result, today, scored ? r.questions : undefined)

  if (task.kind === 'fix' && r.result === 'done') {
    const retest = task.topicIds?.length ? next.scheduled.find((t) => t.kind === 'retest' && t.status === 'pending' && t.fixId === task.id) : undefined
    const mine = next.topics.filter((t) => task.topicIds?.includes(t.id))
    return { state: next, outcome: { kind: 'fixDone', name: mine.length ? topicPhrase(mine) : 'Mixed block review', retestDate: retest?.date }, ...none }
  }

  const isBlock = task.kind === 'study' && !task.topicId && !task.commitmentId && next.resources.some((x) => x.id === task.resourceId && x.type === 'qbank')
  if (scored && fixLoop && (isBlock || task.topicId) && task.kind === 'study') {
    const system = task.system ?? MIXED_SYSTEM
    const score = pct(correct!, r.questions!)
    const base = { date: today, goalId: task.goalId, resourceId: task.resourceId, system, questions: r.questions!, correct: correct!, blockId: task.id }
    const tapped = isBlock ? r.weakTopicIds ?? [] : []
    // A topic (or, after a mixed block, a system) that already has an open loop never gets a second one.
    const open = openLoopTopicIds(next.scheduled)
    const weak = tapped.filter((id) => !open.has(system === MIXED_SYSTEM ? systemTopicId(id) : id))
    let fix = tapped.length > 0 && weak.length === 0 ? null : planFix({ ...base, weakTopicIds: weak, topicId: isBlock ? undefined : task.topicId }, next)
    if (fix && fix.topicIds.some((id) => open.has(id))) fix = null

    // Topics tapped as missed (or the topic just studied) get the score for the "felt sure" check.
    const scores: TopicScore[] = task.topicId ? [{ topicId: task.topicId, score }] : system === MIXED_SYSTEM ? [] : weak.map((topicId) => ({ topicId, score }))
    const o = scores.length ? overconfidence(next, scores, today, [...(fix?.topicIds ?? []), ...openLoopTopicIds(next.scheduled)]) : null
    const confidenceNote = o?.note ? { name: o.note.name, score: o.note.score, reviewed: !!o.review } : null
    const added: string[] = []
    if (o?.note) {
      next = { ...next, confident: o.confident, scheduled: o.review ? [...next.scheduled, o.review] : next.scheduled }
      if (o.review) added.push(o.review.id)
    }
    if (fix) return { state: addFix(next, fix), outcome: { kind: 'fix', system, score, plan: fix }, added: [...added, fix.fix.id], confidenceNote }
    if (isBlock && r.result === 'done') return { state: next, outcome: { kind: 'clean', system, score }, added, confidenceNote }
    return { state: next, outcome: { kind: 'progress', result: r.result, score: Math.round(r.percent!) }, added, confidenceNote }
  }
  return { state: next, outcome: { kind: 'progress', result: r.result, score: scored ? Math.round(r.percent!) : undefined }, ...none }
}
