import { pct } from './accuracy'
import { CONFIRM_RETEST_AFTER_DAYS, FIX_AFTER_BLOCK_DAYS, RETEST_AFTER_FIX_DAYS, RETEST_PASS } from './config'
import { addDays } from './dates'
import { fixOptions, fixTask, goalMaterial, retestTask, topicPhrase, type FixContext } from './fixes'
import type { ISODate, Task, Topic } from './types'

export interface RetestOutcome {
  /**
   * 'again'  = first retest passed: one more retest in CONFIRM_RETEST_AFTER_DAYS.
   * 'solid'  = second retest passed: weak → solid.
   * 'failed' = back to weak, with a new fix and a new first retest.
   */
  result: 'again' | 'solid' | 'failed'
  score: number
  topics: Topic[]
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
 * Score a retest.
 * Round 1 passed → stays "fixing", second retest a week later.
 * Round 2 passed → solid (fixedOn = today).
 * Either round failed → weak again, new fix tomorrow, new first retest after it.
 */
export function applyRetest(retest: Task, questions: number, correct: number, today: ISODate, ctx: FixContext): RetestOutcome {
  const score = pct(correct, questions)
  const ids = retest.topicIds ?? []
  const system = retest.system ?? ''
  const key = `${today}-${ids.join('+')}`
  const set = (status: Topic['status'], fixedOn?: ISODate) =>
    ctx.topics.map((t) => (ids.includes(t.id) ? { ...t, status, fixedOn: fixedOn ?? t.fixedOn } : t))

  if (score >= RETEST_PASS) {
    if ((retest.retestRound ?? 1) === 1) {
      const topics = set('fixing')
      const mine = topics.filter((t) => ids.includes(t.id))
      const next = retestTask(`retest2-${key}`, addDays(today, CONFIRM_RETEST_AFTER_DAYS), retest.goalId, system, mine, retest.sourceDate ?? today, 2)
      return { result: 'again', score, topics, retest: next }
    }
    return { result: 'solid', score, topics: set('solid', today) }
  }

  const topics = set('weak')
  const mine = topics.filter((t) => ids.includes(t.id))
  const material = goalMaterial(ctx, retest.goalId)
  const options = fixOptions(topicPhrase(mine), material)
  const fixDate = addDays(today, FIX_AFTER_BLOCK_DAYS)
  return {
    result: 'failed',
    score,
    topics,
    fix: fixTask(`fix-${key}`, fixDate, retest.goalId, system, mine, options[0], `Retest: ${score}%`, today),
    retest: retestTask(`retest-${key}`, addDays(fixDate, RETEST_AFTER_FIX_DAYS), retest.goalId, system, mine, today),
  }
}
