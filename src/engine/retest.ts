import { pct } from './accuracy'
import {
  CONFIRM_RETEST_AFTER_DAYS, FIX_AFTER_BLOCK_DAYS, MAX_PARKS, MAX_RETEST_FAILS, PARK_DAYS, RETEST_AFTER_FIX_DAYS, RETEST_BORDERLINE_QUESTIONS, RETEST_CONFIRM_DELAY_DAYS,
  RETEST_CONFIRM_MINUTES, RETEST_CONFIRM_QUESTIONS, RETEST_PASS,
} from './config'
import { addDays } from './dates'
import { fixOptions, fixTask, goalMaterial, retestTask, topicPhrase, type FixContext, type FixOption } from './fixes'
import type { FixAction, ISODate, Task, Topic } from './types'

export interface RetestOutcome {
  /**
   * 'borderline' = too close to call (one question from the line): a few more questions tomorrow decide.
   * 'again'  = first retest passed: one more retest in CONFIRM_RETEST_AFTER_DAYS.
   * 'solid'  = second retest passed: weak → solid.
   * 'failed' = back to weak, with a new fix and a new first retest.
   */
  result: 'borderline' | 'again' | 'solid' | 'failed'
  score: number
  topics: Topic[]
  fix?: Task
  retest?: Task
  /** Failed MAX_RETEST_FAILS times in a row: the new fix waits PARK_DAYS. */
  parked?: boolean
}

/** The fix after a failed retest: the first option that isn't what was just tried. */
export function nextFixOption(options: FixOption[], last?: FixAction): FixOption {
  const i = options.findIndex((o) => o.action === last)
  if (i < 0 || options.length === 1) return options[0]
  return options[(i + 1) % options.length]
}

/** A result on the pass line or `RETEST_BORDERLINE_QUESTIONS` below it (7 or 6 of 10): one question decides. */
export function isBorderline(questions: number, correct: number): boolean {
  const need = Math.ceil((RETEST_PASS / 100) * questions - 1e-9)
  return correct >= need - RETEST_BORDERLINE_QUESTIONS && correct <= need
}

/** The few extra questions that settle a close call. Counts together with the result it confirms. */
function confirmRetest(retest: Task, topics: Topic[], questions: number, correct: number, today: ISODate): Task {
  const base = retestTask(`${retest.id}-confirm`, addDays(today, RETEST_CONFIRM_DELAY_DAYS), retest.goalId, retest.system ?? '', topics, retest.sourceDate ?? today, retest.retestRound ?? 1)
  return {
    ...base,
    title: `Retest: ${RETEST_CONFIRM_QUESTIONS} more ${topicPhrase(topics)} questions`,
    detail: 'Close to the line: a few more questions to be sure',
    minutes: RETEST_CONFIRM_MINUTES,
    amount: RETEST_CONFIRM_QUESTIONS,
    carry: { questions, correct },
  }
}

/** Fix done → its topics move weak → fixing. */
export function applyFixDone(topics: Topic[], fix: Task): Topic[] {
  const ids = fix.topicIds ?? []
  return topics.map((t) => (ids.includes(t.id) ? { ...t, status: t.status === 'weak' ? 'fixing' : t.status, lastFix: fix.fixAction ?? t.lastFix } : t))
}

/** A fix done today pushes its retest to RETEST_AFTER_FIX_DAYS from now when it was done late: the gap is the point. */
export function retestAfterFix(scheduled: Task[], fix: Task, today: ISODate): Task[] {
  const earliest = addDays(today, RETEST_AFTER_FIX_DAYS)
  return scheduled.map((t) => (t.kind === 'retest' && t.status === 'pending' && t.fixId === fix.id && t.date < earliest ? { ...t, date: earliest } : t))
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
  // A confirming retest counts together with the result it confirms.
  const total = questions + (retest.carry?.questions ?? 0)
  const score = pct(correct + (retest.carry?.correct ?? 0), total)
  const ids = retest.topicIds ?? []
  const system = retest.system ?? ''
  const key = `${today}-${ids.join('+')}`
  const set = (status: Topic['status'], fixedOn?: ISODate) =>
    ctx.topics.map((t) => (ids.includes(t.id) ? { ...t, status, fixedOn: fixedOn ?? t.fixedOn } : t))

  // One question from the line is noise: ask a few more instead of deciding. The topic stays as it is.
  if (!retest.carry && isBorderline(questions, correct)) {
    const mine = ctx.topics.filter((t) => ids.includes(t.id))
    return { result: 'borderline', score, topics: ctx.topics, retest: confirmRetest(retest, mine, questions, correct, today) }
  }

  if (score >= RETEST_PASS) {
    if ((retest.retestRound ?? 1) === 1) {
      const topics = set('fixing').map((t) => (ids.includes(t.id) ? { ...t, fails: 0 } : t))
      const mine = topics.filter((t) => ids.includes(t.id))
      const next = retestTask(`retest2-${key}`, addDays(today, CONFIRM_RETEST_AFTER_DAYS), retest.goalId, system, mine, retest.sourceDate ?? today, 2)
      return { result: 'again', score, topics, retest: next }
    }
    return { result: 'solid', score, topics: set('solid', today).map((t) => (ids.includes(t.id) ? { ...t, fails: 0 } : t)) }
  }

  // Failed: a different fix than last time. After MAX_RETEST_FAILS in a row the topic rests, then gets a fresh pass.
  const before = ctx.topics.filter((t) => ids.includes(t.id))
  const fails = Math.max(0, ...before.map((t) => t.fails ?? 0)) + 1
  const parked = fails >= MAX_RETEST_FAILS
  // Already rested once and missed MAX_RETEST_FAILS more times: stop looping. The topic stays weak.
  const parks = Math.max(0, ...before.map((t) => t.parks ?? 0))
  if (parked && parks >= MAX_PARKS) {
    return { result: 'failed', score, topics: set('weak').map((t) => (ids.includes(t.id) ? { ...t, fails: 0 } : t)) }
  }
  const material = goalMaterial(ctx, retest.goalId)
  const options = fixOptions(topicPhrase(before), material)
  const last = before.find((t) => t.lastFix)?.lastFix
  const option = nextFixOption(options, last)
  const topics = set('weak').map((t) => (ids.includes(t.id) ? { ...t, fails: parked ? 0 : fails, parks: parked ? parks + 1 : t.parks, lastFix: option.action } : t))
  const mine = topics.filter((t) => ids.includes(t.id))
  const fixDate = addDays(today, parked ? PARK_DAYS : FIX_AFTER_BLOCK_DAYS)
  const reason = parked ? `${MAX_RETEST_FAILS} retests under ${RETEST_PASS}%: a fresh pass after a break` : `Retest: ${score}%`
  return {
    result: 'failed',
    score,
    topics,
    parked,
    fix: fixTask(`fix-${key}`, fixDate, retest.goalId, system, mine, option, reason, today),
    retest: retestTask(`retest-${key}`, addDays(fixDate, RETEST_AFTER_FIX_DAYS), retest.goalId, system, mine, today, 1, `fix-${key}`),
  }
}
