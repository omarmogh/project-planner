// Results the student brings in from their qbank (pasted or typed). Pure.
// They seed accuracy by system and questions done, so fixes and system order
// work from day one instead of after the first blocks.

import { WEAK_BELOW } from './config'
import { addDays } from './dates'
import { planFix } from './fixes'
import { markWeak } from './retest'
import type { EngineState, ISODate, Session } from './types'

export interface SystemResult {
  system: string
  /** Questions used. */
  used: number
  /** % correct; null = unknown (counts toward questions done only). */
  pct: number | null
  /** `used` is a stand-in size (a % with no question count): it counts toward accuracy, not toward questions done. */
  assumed?: boolean
}

/** Reason shown on the fix an import adds. */
export const importReason = (system: string, pct: number, bank = 'UWorld') => `From your ${resultsName(bank)}: ${system} ${pct}%`

/** "UWorld results", "question-bank results" (any other bank) or "past-paper results". */
function resultsName(bank: string): string {
  if (/^qbank$/i.test(bank) || /question/i.test(bank)) return 'question-bank results'
  if (/paper/i.test(bank)) return 'past-paper results'
  return `${bank} results`
}

/**
 * Seed the state from imported results. Replaces an earlier import.
 * - One imported session per system with a %: accuracy by system (and so block targeting) uses it.
 * - Questions done on the qbank: never lowered.
 * - The weakest system under WEAK_BELOW gets one fix, today, and its retest. Only one, so day one stays calm.
 */
export function applyImport(s: EngineState, rows: SystemResult[], today: ISODate): EngineState {
  // Any question bank; for a uni-only student, the past-papers resource takes its place.
  const qbank = s.resources.find((r) => r.type === 'qbank') ?? (s.goals.every((g) => g.kind === 'uni') ? s.resources.find((r) => r.type === 'papers') : undefined)
  if (!qbank) return s
  const clean = rows.filter((r) => r.used > 0)
  const sessions: Session[] = clean
    .filter((r) => r.pct !== null)
    .map((r) => ({
      id: `import-${r.system}`,
      date: today,
      kind: 'study',
      goalId: qbank.goalId,
      resourceId: qbank.id,
      system: r.system,
      minutes: 0,
      questions: r.used,
      correct: (r.used * r.pct!) / 100,
      imported: true,
    }))
  const used = clean.filter((r) => !r.assumed).reduce((n, r) => n + r.used, 0)
  let next: EngineState = {
    ...s,
    sessions: [...s.sessions.filter((x) => !x.imported), ...sessions],
    resources: s.resources.map((r) => (r.id === qbank.id && r.type === 'qbank' && used > 0 ? { ...r, doneUnits: Math.min(r.totalUnits, Math.max(r.doneUnits, used)) } : r)),
  }

  const weakest = clean
    .filter((r): r is SystemResult & { pct: number } => r.pct !== null && r.pct < WEAK_BELOW)
    .sort((a, b) => a.pct - b.pct || b.used - a.used)[0]
  const pendingFor = (system: string) => next.scheduled.some((t) => t.kind === 'fix' && t.status === 'pending' && t.system === system)
  if (weakest && !pendingFor(weakest.system)) {
    // Dated yesterday so the fix lands today: day one already works on the weakest system.
    const fix = planFix(
      { date: addDays(today, -1), goalId: qbank.goalId, resourceId: qbank.id, system: weakest.system, questions: weakest.used, correct: (weakest.used * weakest.pct) / 100, weakTopicIds: [] },
      next,
    )
    if (fix) {
      const reason = importReason(weakest.system, weakest.pct, qbank.name)
      next = {
        ...next,
        topics: markWeak([...next.topics, ...fix.newTopics], fix.topicIds),
        scheduled: [...next.scheduled, { ...fix.fix, reason }, ...(fix.retest ? [fix.retest] : [])],
      }
    }
  }
  return next
}

/** What was imported, for prefilling the form again. */
export function importedResults(s: EngineState): SystemResult[] {
  return s.sessions
    .filter((x) => x.imported && x.system && x.questions)
    .map((x) => ({ system: x.system!, used: x.questions!, pct: Math.round(((x.correct ?? 0) * 100) / x.questions!) }))
}
