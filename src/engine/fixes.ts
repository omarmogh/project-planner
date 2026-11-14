import { WEAK_BELOW, pct } from './accuracy'
import { addDays } from './dates'
import { inSentence, listJoin, reasons } from './reasons'
import type { AnkiDeck, FixAction, ISODate, Resource, Task, Topic } from './types'

/** Days from the fix to its retest. */
export const RETEST_AFTER_FIX_DAYS = 3
export const RETEST_QUESTIONS = 10
export const RETEST_MINUTES = 15

export interface BlockResult {
  date: ISODate
  goalId: string
  resourceId?: string
  system: string
  questions: number
  correct: number
  /** Topics the student tapped as weak. May be empty. */
  weakTopicIds: string[]
}

export interface FixOption {
  action: FixAction
  title: string
  minutes: number
}

export interface FixPlan {
  /** 'topics' = she tapped topics; 'system' = no taps but score < 60%. */
  scope: 'topics' | 'system'
  topicIds: string[]
  /** Whole-system pseudo-topics that need to be added to the topic list. */
  newTopics: Topic[]
  fix: Task
  retest: Task
  options: FixOption[]
}

export function systemTopicId(system: string): string {
  return `sys-${system.toLowerCase()}`
}

export function systemTopic(system: string): Topic {
  return { id: systemTopicId(system), system, name: `${system}, overall`, status: 'weak', wholeSystem: true }
}

/** "heart failure", "heart failure and arrhythmias", or the system name. */
export function topicPhrase(topics: Topic[]): string {
  if (topics.length === 1 && topics[0].wholeSystem) return topics[0].system
  return listJoin(topics.map((t) => inSentence(t.name)))
}

/** The fixes this student can actually do, given the resources they have. Best first. */
export function fixOptions(phrase: string, resources: Resource[], anki?: AnkiDeck): FixOption[] {
  const has = (t: Resource['type']) => resources.find((r) => r.type === t)
  const out: FixOption[] = []
  const qbank = has('qbank')
  if (qbank && anki) {
    out.push({ action: 'reviewAndCards', title: `Review your wrong ${phrase} answers and make 5 Anki cards`, minutes: 20 })
  }
  if (qbank) out.push({ action: 'reviewWrong', title: `Review your wrong ${phrase} answers`, minutes: 15 })
  if (anki) out.push({ action: 'makeCards', title: `Make 5 Anki cards on ${phrase}`, minutes: 15 })
  const slides = has('slides')
  if (slides) out.push({ action: 'rereadSlides', title: `Re-read the ${slides.name} on ${phrase}`, minutes: 25 })
  const video = has('video')
  if (video) out.push({ action: 'watchVideo', title: `Watch the ${video.name} video on ${phrase}`, minutes: 15 })
  const reading = has('reading')
  if (reading) out.push({ action: 'readChapter', title: `Read the ${reading.name} section on ${phrase}`, minutes: 20 })
  if (out.length === 0) out.push({ action: 'reviewWrong', title: `Review your notes on ${phrase}`, minutes: 15 })
  return out
}

export function retestTask(id: string, date: ISODate, goalId: string, system: string, topics: Topic[], sourceDate: ISODate): Task {
  return {
    id,
    date,
    kind: 'retest',
    goalId,
    system,
    topicIds: topics.map((t) => t.id),
    title: `Retest: ${RETEST_QUESTIONS} ${topicPhrase(topics)} questions`,
    reason: 'Retest',
    minutes: RETEST_MINUTES,
    amount: RETEST_QUESTIONS,
    status: 'pending',
    sourceDate,
  }
}

export function fixTask(id: string, date: ISODate, goalId: string, system: string, topics: Topic[], option: FixOption, reason: string, sourceDate: ISODate): Task {
  return {
    id,
    date,
    kind: 'fix',
    goalId,
    system,
    topicIds: topics.map((t) => t.id),
    title: option.title,
    reason,
    minutes: option.minutes,
    status: 'pending',
    sourceDate,
    fixAction: option.action,
  }
}

/**
 * Decide whether a finished block needs a fix.
 * - Tapped topics become the weak topics.
 * - No taps and < 60% → the fix covers the whole system.
 * - Otherwise nothing to fix.
 * The fix lands tomorrow, the retest RETEST_AFTER_FIX_DAYS after that.
 */
export function planFix(
  result: BlockResult,
  ctx: { topics: Topic[]; resources: Resource[]; anki?: AnkiDeck },
): FixPlan | null {
  const score = pct(result.correct, result.questions)
  let topics: Topic[]
  let newTopics: Topic[] = []
  let scope: FixPlan['scope']
  let reason: string

  if (result.weakTopicIds.length > 0) {
    topics = ctx.topics.filter((t) => result.weakTopicIds.includes(t.id))
    scope = 'topics'
    reason = reasons.markedWeak(topics.map((t) => t.name))
  } else if (score < WEAK_BELOW) {
    const existing = ctx.topics.find((t) => t.id === systemTopicId(result.system))
    const topic = existing ?? systemTopic(result.system)
    if (!existing) newTopics = [topic]
    topics = [topic]
    scope = 'system'
    reason = reasons.blockScore(result.system, score)
  } else {
    return null
  }

  const fixDate = addDays(result.date, 1)
  const retestDate = addDays(fixDate, RETEST_AFTER_FIX_DAYS)
  const options = fixOptions(topicPhrase(topics), ctx.resources, ctx.anki)
  const key = `${result.date}-${result.system.toLowerCase()}-${topics.map((t) => t.id).join('+')}`
  return {
    scope,
    topicIds: topics.map((t) => t.id),
    newTopics,
    fix: fixTask(`fix-${key}`, fixDate, result.goalId, result.system, topics, options[0], reason, result.date),
    retest: retestTask(`retest-${key}`, retestDate, result.goalId, result.system, topics, result.date),
    options,
  }
}

/** "Change fix": swap the action, keep date, reason and topics. */
export function changeFix(fix: Task, option: FixOption): Task {
  return { ...fix, title: option.title, minutes: option.minutes, fixAction: option.action }
}
