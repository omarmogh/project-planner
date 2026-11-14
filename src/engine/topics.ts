// Topic coverage: what's covered, what's next, and how a topic is split into tasks.
// Pure. A topic is "covered" once all of its items (videos, sections, questions) are done;
// that is known only from the Done / Partly / Didn't get to it answer after each task.

import { recentAccuracy } from './accuracy'
import {
  MIN_TASK_MINUTES, PARTLY_SHARE, TIMER_FACTOR_MAX, TIMER_FACTOR_MIN, TIMER_MIN_SESSIONS,
} from './config'
import { inSentence } from './reasons'
import type { Completion, EngineState, ISODate, Session, StudyItem, Task, Topic } from './types'

const ceilTo5 = (n: number) => Math.ceil(n / 5) * 5

export function hasItems(t: Topic): boolean {
  return !!t.items && t.items.length > 0
}

export function isCovered(t: Topic): boolean {
  return hasItems(t) && (t.doneItems ?? 0) >= t.items!.length
}

export function isStarted(t: Topic): boolean {
  return hasItems(t) && !isCovered(t) && ((t.doneItems ?? 0) > 0 || (t.partialMin ?? 0) > 0)
}

/** Planned topics only (whole-system fix topics are not studied by item). */
export function plannedTopics(topics: Topic[], system?: string): Topic[] {
  return topics.filter((t) => hasItems(t) && !t.wholeSystem && (!system || t.system === system))
}

/** Systems in the order their topics appear (the topic map's recommended order). */
export function systemsInOrder(topics: Topic[]): string[] {
  return [...new Set(plannedTopics(topics).map((t) => t.system))]
}

export interface SystemProgress {
  system: string
  covered: number
  total: number
}

export function systemProgress(topics: Topic[], system: string): SystemProgress {
  const mine = plannedTopics(topics, system)
  return { system, covered: mine.filter(isCovered).length, total: mine.length }
}

export function isSystemDone(topics: Topic[], system: string): boolean {
  const p = systemProgress(topics, system)
  return p.total > 0 && p.covered === p.total
}

/**
 * Minutes the student really takes vs the estimate, from finished topic tasks.
 * 1 until there are TIMER_MIN_SESSIONS of them; then clamped to [TIMER_FACTOR_MIN, TIMER_FACTOR_MAX].
 */
export function timerFactor(sessions: Session[]): number {
  const timed = sessions.filter((s) => s.topicIds?.length && s.planned && s.kind === 'study')
  if (timed.length < TIMER_MIN_SESSIONS) return 1
  const planned = timed.reduce((n, s) => n + s.planned!, 0)
  const actual = timed.reduce((n, s) => n + s.minutes, 0)
  return Math.min(TIMER_FACTOR_MAX, Math.max(TIMER_FACTOR_MIN, actual / planned))
}

/** The items still to do, with the first one shortened by any partial time. */
export function remainingItems(t: Topic, factor = 1): { item: StudyItem; index: number; minutes: number }[] {
  if (!hasItems(t)) return []
  const from = t.doneItems ?? 0
  return t.items!.slice(from).map((item, i) => {
    const full = item.minutes * factor
    return { item, index: from + i, minutes: i === 0 ? Math.max(0, full - (t.partialMin ?? 0)) : full }
  })
}

export function topicMinutesLeft(t: Topic, factor = 1): number {
  return remainingItems(t, factor).reduce((n, r) => n + r.minutes, 0)
}

/**
 * Which system to suggest next: not-started systems first (in the map's order),
 * then started-but-unfinished ones, weakest UWorld accuracy first.
 */
export function suggestNextSystem(s: Pick<EngineState, 'topics' | 'sessions'>, today: ISODate, exclude: string[] = []): string | undefined {
  const systems = systemsInOrder(s.topics).filter((x) => !exclude.includes(x) && !isSystemDone(s.topics, x))
  const fresh = systems.filter((x) => plannedTopics(s.topics, x).every((t) => !isCovered(t) && !isStarted(t)))
  if (fresh.length) return fresh[0]
  const acc = recentAccuracy(s.sessions, today)
  const pctOf = (x: string) => acc.find((a) => a.system === x)?.pct ?? 101
  return [...systems].sort((a, b) => pctOf(a) - pctOf(b))[0]
}

/** The systems the plan is working on now: the student's focus, or the suggestion once those are done. */
export function activeSystems(s: Pick<EngineState, 'topics' | 'sessions' | 'focus'>, today: ISODate): string[] {
  const open = s.focus.filter((x) => !isSystemDone(s.topics, x))
  if (open.length) return open
  const next = suggestNextSystem(s, today)
  return next ? [next] : []
}

/**
 * Topics in the order they'll be studied: anything already started first,
 * then the active systems' topics (alternating when there are two).
 */
export function topicQueue(s: Pick<EngineState, 'topics' | 'sessions' | 'focus'>, today: ISODate): Topic[] {
  const started = plannedTopics(s.topics).filter(isStarted)
  const lists = activeSystems(s, today).map((sys) => plannedTopics(s.topics, sys).filter((t) => !isCovered(t) && !isStarted(t)))
  const rest: Topic[] = []
  for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length) rest.push(l[i])
  return [...started, ...rest]
}

export interface TopicSlice {
  items: StudyItem[]
  from: number
  to: number
  minutes: number
  questions: number
  /** True when this slice finishes the topic. */
  ends: boolean
  /** True when the topic was already started. */
  continues: boolean
}

/**
 * The biggest run of whole items that fits `room`. Never cuts an item.
 * Minutes are rounded up to 5 and never under MIN_TASK_MINUTES, so no "9 min" tasks.
 */
export function sliceTopic(t: Topic, room: number, factor = 1): TopicSlice | null {
  const left = remainingItems(t, factor)
  const taken: typeof left = []
  let sum = 0
  for (const r of left) {
    if (Math.max(MIN_TASK_MINUTES, ceilTo5(sum + r.minutes)) > room) break
    taken.push(r)
    sum += r.minutes
  }
  if (taken.length === 0) return null
  return {
    items: taken.map((r) => r.item),
    from: taken[0].index,
    to: taken[taken.length - 1].index + 1,
    minutes: Math.max(MIN_TASK_MINUTES, ceilTo5(sum)),
    questions: taken.reduce((n, r) => n + (r.item.questions ?? 0), 0),
    ends: taken.length === left.length,
    continues: isStarted(t),
  }
}

const SOURCE: Record<StudyItem['source'], string> = {
  bnb: 'B&B', firstaid: 'First Aid', pathoma: 'Pathoma', amboss: 'AMBOSS', qbank: '',
}

/**
 * Display lines for a slice, by source:
 * "B&B: Heart Failure Basics, Acute Heart Failure", "First Aid: Heart failure", "Then 10 UWorld questions on it".
 * `qbankName` is the student's question bank ("UWorld").
 */
export function stepLines(items: StudyItem[], qbankName = 'UWorld'): string[] {
  const lines: string[] = []
  let i = 0
  while (i < items.length) {
    const src = items[i].source
    const group: StudyItem[] = []
    while (i < items.length && items[i].source === src) group.push(items[i++])
    if (src === 'qbank') {
      const q = group.reduce((n, x) => n + (x.questions ?? 0), 0)
      lines.push(`${lines.length ? 'Then ' : ''}${q} ${qbankName} ${q === 1 ? 'question' : 'questions'} on it`)
    } else {
      lines.push(`${SOURCE[src]}: ${group.map((x) => x.title).join(', ')}`)
    }
  }
  return lines
}

/** "Cardio: Heart failure". */
export function topicTitle(t: Topic): string {
  return `${t.system}: ${t.name}`
}

/**
 * Apply the one completion answer to a topic task.
 * done    → the task's items are finished;
 * partly  → PARTLY_SHARE of the task's minutes counts, item by item; the rest comes first next time;
 * skipped → nothing changes, so the same work goes back into the coming days.
 */
export function applyTopicCompletion(t: Topic, task: Task, result: Completion, factor = 1): Topic {
  if (result === 'skipped' || task.itemTo === undefined) return t
  if (result === 'done') return { ...t, doneItems: Math.max(t.doneItems ?? 0, task.itemTo), partialMin: 0 }
  let credit = task.minutes * PARTLY_SHARE
  let doneItems = t.doneItems ?? 0
  let partialMin = t.partialMin ?? 0
  while (doneItems < task.itemTo && credit > 0) {
    const need = t.items![doneItems].minutes * factor - partialMin
    if (credit >= need) {
      credit -= need
      doneItems++
      partialMin = 0
    } else {
      partialMin += credit
      credit = 0
    }
  }
  return { ...t, doneItems, partialMin: Math.round(partialMin) }
}

/** "heart failure" for sentences. */
export function topicName(t: Topic): string {
  return inSentence(t.name)
}
