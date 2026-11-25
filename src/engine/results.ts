// "How did it go?": after a quiz, a colloquium, an NBME, an exam part or a small test set as an exam, Today asks once for the result,
// so it can feed the fix → retest loop (reportOutside). Pure.

import { isTestLike } from './commitmentParse'
import { clockMinutes } from './commitments'
import { RESULT_ASK_DAYS } from './config'
import { addDays } from './dates'
import { isSmallTest } from './exams'
import { isFirm, type Commitment, type EngineState, type Goal, type ISODate } from './types'

export interface ResultPrompt {
  /** Stored in `resultsAsked` once answered or dismissed. */
  key: string
  /** "Physics colloquium", "OSCE". */
  label: string
  /** The goal the result counts for. */
  goalId: string
}

const live = (goals: Goal[], today: ISODate) => goals.filter((g) => g.examDate >= today)

/**
 * The goal a test belongs to: a board test to the board goal; a uni test to the uni goal it names,
 * else the nearest uni exam still ahead. Never a goal whose own exam it was (that exam is over).
 */
function goalFor(s: EngineState, c: Commitment, ended: ISODate, today: ISODate): Goal | undefined {
  // It was a goal's own exam ("IM exam" on the IM exam day): that exam is over, nothing to feed.
  if (s.goals.some((g) => g.examDate === ended || (g.parts ?? []).some((p) => p.date === ended))) return undefined
  const goals = live(s.goals, today).filter((g) => g.examDate > ended)
  if (c.tag === 'usmle') return goals.find((g) => g.kind !== 'uni')
  if (c.tag !== 'uni') return undefined
  const uni = goals.filter((g) => g.kind === 'uni').sort((a, b) => a.examDate.localeCompare(b.examDate))
  const title = c.title.toLowerCase()
  return uni.find((g) => title.includes(g.label.replace(/ exam$/i, '').toLowerCase())) ?? uni[0]
}

/**
 * At most one prompt: the most recent test-like busy commitment (or exam part) that has ended in the last
 * RESULT_ASK_DAYS days, or today once its end time has passed, whose result hasn't been asked for yet.
 */
export function resultPrompt(s: EngineState, today: ISODate, nowMinutes?: number): ResultPrompt | null {
  const asked = new Set(s.resultsAsked ?? [])
  const from = addDays(today, -RESULT_ASK_DAYS)
  const over = (day: ISODate, to?: string, overnight?: boolean) =>
    (day >= from && day < today) || (day === today && !overnight && to !== undefined && nowMinutes !== undefined && nowMinutes >= clockMinutes(to))
  const found: (ResultPrompt & { day: ISODate })[] = []

  for (const c of s.commitments ?? []) {
    if (c.kind !== 'busy' || c.repeat?.length || !isTestLike(c.title)) continue
    const key = `c:${c.id}`
    const day = c.until ?? c.date
    const overnight = !!c.from && !!c.to && clockMinutes(c.to) <= clockMinutes(c.from)
    if (asked.has(key) || !over(day, c.allDay ? undefined : c.to, overnight)) continue
    const goal = goalFor(s, c, day, today)
    if (goal) found.push({ key, label: c.title, goalId: goal.id, day })
  }
  // An OSCE or viva before the written exam: its result still helps before the main sitting.
  for (const g of live(s.goals, today)) {
    for (const p of g.parts ?? []) {
      const key = `p:${g.id}:${p.label}`
      if (asked.has(key) || p.date >= today || p.date < from || g.examDate <= p.date) continue
      found.push({ key, label: p.label, goalId: g.id, day: p.date })
    }
  }
  // A small test that was a goal of its own (a dept test, a quiz): its result feeds the next exam of the same kind.
  for (const g of s.goals) {
    const key = `g:${g.id}`
    if (asked.has(key) || !isFirm(g) || !isSmallTest(g) || g.examDate >= today || g.examDate < from) continue
    const next = live(s.goals, today)
      .filter((x) => x.id !== g.id && (x.kind === 'uni') === (g.kind === 'uni') && x.examDate > g.examDate)
      .sort((a, b) => a.examDate.localeCompare(b.examDate))[0]
    if (next) found.push({ key, label: g.label, goalId: next.id, day: g.examDate })
  }
  found.sort((a, b) => b.day.localeCompare(a.day))
  const first = found[0]
  return first ? { key: first.key, label: first.label, goalId: first.goalId } : null
}
