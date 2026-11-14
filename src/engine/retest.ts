import { RETEST_PASS, pct } from './accuracy'
import { addDays } from './dates'
import { RETEST_AFTER_FIX_DAYS, fixOptions, fixTask, retestTask, topicPhrase } from './fixes'
import type { AnkiDeck, ISODate, Resource, Task, Topic } from './types'

export interface RetestOutcome {
  passed: boolean
  score: number
  topics: Topic[]
  /** When failed: a new fix tomorrow and a new retest after it. */
  fix?: Task
  retest?: Task
}

/** Fix done → its topics move weak → fixing. */
export function applyFixDone(topics: Topic[], fix: Task): Topic[] {
  const ids = fix.topicIds ?? []
  return topics.map((t) => (ids.includes(t.id) && t.status === 'weak' ? { ...t, status: 'fixing' } : t))
}

/** Topics a block marked weak. */
export function markWeak(topics: Topic[], ids: string[]): Topic[] {
  return topics.map((t) => (ids.includes(t.id) ? { ...t, status: 'weak' } : t))
}

/**
 * Retest scored → solid (≥ 70%) or back to weak with a new fix + retest.
 */
export function applyRetest(
  retest: Task,
  questions: number,
  correct: number,
  today: ISODate,
  ctx: { topics: Topic[]; resources: Resource[]; anki?: AnkiDeck },
): RetestOutcome {
  const score = pct(correct, questions)
  const ids = retest.topicIds ?? []
  const passed = score >= RETEST_PASS
  const topics = ctx.topics.map((t) =>
    ids.includes(t.id) ? { ...t, status: passed ? ('solid' as const) : ('weak' as const), fixedOn: passed ? today : t.fixedOn } : t,
  )
  if (passed) return { passed, score, topics }

  const mine = topics.filter((t) => ids.includes(t.id))
  const system = retest.system ?? mine[0]?.system ?? ''
  const options = fixOptions(topicPhrase(mine), ctx.resources, ctx.anki)
  const fixDate = addDays(today, 1)
  const key = `${today}-${ids.join('+')}`
  return {
    passed,
    score,
    topics,
    fix: fixTask(`fix-${key}`, fixDate, retest.goalId, system, mine, options[0], `Retest: ${score}%`, today),
    retest: retestTask(`retest-${key}`, addDays(fixDate, RETEST_AFTER_FIX_DAYS), retest.goalId, system, mine, today),
  }
}
