// What a finished task does to the state: one pure function for every kind of task.
// The app and the simulator both go through reportTask, so they can't drift apart.

import { pct } from './accuracy'
import { FIX_MOVE_MAX_DAYS, MIN_TASK_MINUTES, MIXED_SYSTEM, RETEST_AFTER_FIX_DAYS } from './config'
import { capacity } from './commitments'
import { addDays } from './dates'
import { dayType } from './exams'
import { overconfidence, type TopicScore } from './confidence'
import { fixOptions, goalMaterial, openLoopTopicIds, planFix, systemTopicId, topicPhrase, type FixOption, type FixPlan } from './fixes'
import { applyCompletion } from './progress'
import { uniSubject, uniTopicChoices, uniTopicId } from './uni'
import { applyRetest, markWeak } from './retest'
import { fitRetests } from './planEdits'
import type { Completion, EngineState, ISODate, Session, Task } from './types'

export type Outcome =
  | { kind: 'fix'; system: string; score: number; plan: FixPlan }
  | { kind: 'clean'; system: string; score: number }
  /** One question from the line: a few more questions next day decide. */
  | { kind: 'retestBorderline'; score: number; name: string; next: ISODate; more: number }
  /** `pooled` on a confirming retest: both results counted together, e.g. "6/10 + 4/5 = 10/15". */
  | { kind: 'retestPass'; score: number; name: string; pooled?: string }
  | { kind: 'retestAgain'; score: number; name: string; next: ISODate; pooled?: string }
  /** `retest` is missing when no retest fits before a firm exam (RETEST_BEFORE_EXAM_DAYS). */
  | { kind: 'retestFail'; score: number; name: string; fix: Task; retest?: Task; options: FixOption[]; parked?: boolean; pooled?: string }
  /** Missed again after a rest and a fresh pass: no further loop for now. */
  | { kind: 'retestStopped'; score: number; name: string; pooled?: string }
  | { kind: 'fixDone'; name: string; retestDate?: ISODate }
  /** Done / Partly / Didn't get to it, for a topic, lectures, a paper, a fix or deadline work. `score` when questions were entered. */
  | { kind: 'progress'; result: Completion; score?: number }
  | { kind: 'ankiDone'; cards: number | null; newLeft: number }

export interface TaskReport {
  result: Completion
  /** Minutes from the timer. Defaults to the planned minutes. */
  minutes?: number
  /** Done without the timer ("Done already"): the planned minutes count as studied, but never tune the estimates. */
  untimed?: boolean
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
    planned: r.result === 'done' && !r.untimed ? task.minutes : undefined,
    ...extra,
  }
  return {
    ...s,
    outcomes: [...(s.outcomes ?? []), { date: today, taskId: task.id, result: r.result, ...(task.extra ? { extra: true } : {}) }],
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
function reportRaw(s: EngineState, task: Task, r: TaskReport, today: ISODate, opts: { fixLoop?: boolean } = {}): Reported {
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
    const pooled = task.carry ? pooledLine(task.carry, r.questions!, correct!) : undefined
    const p = pooled ? { pooled } : {}
    if (o.result === 'borderline') {
      return {
        state: { ...next, scheduled: [...next.scheduled, o.retest!] },
        outcome: { kind: 'retestBorderline', score: o.score, name, next: o.retest!.date, more: o.retest!.amount ?? 0 },
        ...none,
      }
    }
    if (o.result === 'solid') return { state: { ...next, topics: o.topics }, outcome: { kind: 'retestPass', score: o.score, name, ...p }, ...none }
    if (o.result === 'again') {
      return {
        state: { ...next, topics: o.topics, scheduled: [...next.scheduled, o.retest!] },
        outcome: { kind: 'retestAgain', score: o.score, name, next: o.retest!.date, ...p },
        ...none,
      }
    }
    const options = fixOptions(name, goalMaterial(next, task.goalId))
    // After a rest and another run of misses the loop stops: the topic stays weak on Pace, with no more retests.
    if (!o.fix || !o.retest) return { state: { ...next, topics: o.topics }, outcome: { kind: 'retestStopped', score: o.score, name, ...p }, ...none }
    return {
      state: { ...next, topics: o.topics, scheduled: [...next.scheduled, o.fix, o.retest] },
      outcome: { kind: 'retestFail', score: o.score, name, fix: o.fix, retest: o.retest, options, parked: o.parked, ...p },
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

  const plain = task.kind === 'study' && !task.topicId && !task.commitmentId
  // A uni goal's past paper is scored like a question block: its weak topics are the subject or its lectures.
  const paper = plain && next.resources.some((x) => x.id === task.resourceId && x.type === 'papers')
  const isBlock = plain && (paper || next.resources.some((x) => x.id === task.resourceId && x.type === 'qbank'))
  if (scored && fixLoop && (isBlock || task.topicId) && task.kind === 'study') {
    const goal = next.goals.find((g) => g.id === task.goalId)
    const choices = paper ? uniTopicChoices(next, task.goalId) : []
    const system = paper && goal ? uniSubject(goal) : task.system ?? MIXED_SYSTEM
    const score = pct(correct!, r.questions!)
    const subjectTopic = paper && goal ? { ...(next.topics.find((t) => t.id === uniTopicId(goal.id)) ?? { id: uniTopicId(goal.id), system, name: system, status: 'weak' as const, wholeSystem: true }) } : undefined
    const base = { date: today, goalId: task.goalId, resourceId: task.resourceId, system, questions: r.questions!, correct: correct!, blockId: task.id, subjectTopic }
    let tapped = isBlock ? r.weakTopicIds ?? [] : []
    if (paper) {
      // Only the goal's own topics can be tapped; they join the topic list the first time.
      tapped = tapped.filter((id) => choices.some((t) => t.id === id))
      const add = choices.filter((t) => tapped.includes(t.id) && !next.topics.some((x) => x.id === t.id))
      if (add.length) next = { ...next, topics: [...next.topics, ...add] }
    }
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

/**
 * Apply one answer (see reportRaw), then keep every retest before its exam: a retest past
 * RETEST_BEFORE_EXAM_DAYS before a firm date moves earlier, and one just created that can't fit is left out.
 * The outcome shows the dates that were kept.
 */
export function reportTask(s: EngineState, task: Task, r: TaskReport, today: ISODate, opts: { fixLoop?: boolean } = {}): Reported {
  const out = reportRaw(s, task, r, today, opts)
  const before = new Set(s.scheduled.map((t) => t.id))
  const added = new Set(out.state.scheduled.filter((t) => !before.has(t.id)).map((t) => t.id))
  const scheduled = fitRetests(out.state, roomForFixes(out.state, out.state.scheduled, added), today, added)
  const same = scheduled.length === out.state.scheduled.length && scheduled.every((t, i) => t === out.state.scheduled[i])
  if (same) return out
  const kept = new Map(scheduled.map((t) => [t.id, t]))
  const fresh = (t?: Task) => (t ? kept.get(t.id) : undefined)
  const state = { ...out.state, scheduled }
  const o = out.outcome
  let outcome: Outcome = o
  if (o.kind === 'fix') outcome = { ...o, plan: { ...o.plan, fix: fresh(o.plan.fix) ?? o.plan.fix, retest: fresh(o.plan.retest) } }
  else if (o.kind === 'retestFail') outcome = { ...o, fix: fresh(o.fix) ?? o.fix, retest: fresh(o.retest) }
  else if (o.kind === 'fixDone' && o.retestDate) {
    const t = scheduled.find((x) => x.kind === 'retest' && x.status === 'pending' && x.fixId === task.id)
    outcome = { ...o, retestDate: t?.date }
  } else if (o.kind === 'retestAgain' || o.kind === 'retestBorderline') {
    const t = scheduled.find((x) => added.has(x.id) && x.kind === 'retest')
    // No room for the confirming retest before the exam: the result stands as it is.
    outcome = t ? { ...o, next: t.date } : { kind: 'progress', result: 'done', score: o.score }
  }
  return { ...out, state, outcome }
}

/**
 * A fix just added never lands on a day with no study time (busy all day, an exam or rest day): it moves to the
 * next day with at least MIN_TASK_MINUTES, up to FIX_MOVE_MAX_DAYS on, and its retest keeps its gap after it.
 */
function roomForFixes(s: EngineState, scheduled: Task[], added: Set<string>): Task[] {
  const free = (d: ISODate) => dayType(s.goals, d) === 'normal' && capacity(s, d) >= MIN_TASK_MINUTES
  const moved = new Map<string, ISODate>()
  const out = scheduled.map((t) => {
    if (!added.has(t.id) || t.kind !== 'fix' || free(t.date)) return t
    for (let i = 1; i <= FIX_MOVE_MAX_DAYS; i++) {
      const d = addDays(t.date, i)
      if (free(d)) { moved.set(t.id, d); return { ...t, date: d } }
    }
    return t
  })
  if (moved.size === 0) return scheduled
  return out.map((t) => {
    const fixDay = t.kind === 'retest' && t.fixId ? moved.get(t.fixId) : undefined
    const earliest = fixDay ? addDays(fixDay, RETEST_AFTER_FIX_DAYS) : undefined
    return earliest && t.date < earliest ? { ...t, date: earliest } : t
  })
}

/** A confirming retest's line: the earlier result plus this one, e.g. "6/10 + 4/5 = 10/15". */
export function pooledLine(carry: { questions: number; correct: number }, questions: number, correct: number): string {
  const a = Math.round(carry.correct)
  const b = Math.round(correct)
  return `${a}/${carry.questions} + ${b}/${questions} = ${a + b}/${carry.questions + questions}`
}
