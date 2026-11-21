import { ACCURACY_WINDOW_DAYS, BORDERLINE_FROM, IMPORT_REPLACED_BY_QUESTIONS, MIXED_SYSTEM, WEAK_BELOW } from './config'
import { addDays } from './dates'
import type { EngineState, ISODate, Session } from './types'

/**
 * Sessions that speak for the board exams: a uni goal's papers and retests are scored by the subject
 * ("IM", "Anatomy"), so they never steer which Step 1 system a block targets.
 */
export function boardSessions(s: Pick<EngineState, 'sessions'> & Partial<Pick<EngineState, 'goals' | 'pastGoals'>>): Session[] {
  const uni = new Set([...(s.goals ?? []), ...(s.pastGoals ?? [])].filter((g) => g.kind === 'uni').map((g) => g.id))
  return uni.size ? s.sessions.filter((x) => !uni.has(x.goalId)) : s.sessions
}

/** Accuracy by subject or lecture topic for one uni goal (Pace, Block finished). Same window as recentAccuracy. */
export function uniAccuracy(s: Pick<EngineState, 'sessions'>, goalId: string, today: ISODate): SystemAccuracy[] {
  return recentAccuracy(s.sessions.filter((x) => x.goalId === goalId), today)
}

export interface SystemAccuracy {
  system: string
  attempted: number
  correct: number
  /** 0–100, rounded. */
  pct: number
}

export type Band = 'solid' | 'borderline' | 'weak'

export function band(pct: number): Band {
  if (pct >= WEAK_BELOW) return 'solid'
  if (pct >= BORDERLINE_FROM) return 'borderline'
  return 'weak'
}

export function pct(correct: number, attempted: number): number {
  return attempted === 0 ? 0 : Math.round((correct * 100) / attempted)
}

/**
 * Accuracy per system from question sessions in [from, to] (inclusive).
 * Imported UWorld results are the student's history: they count whatever their date, until
 * the student's own blocks on that system reach IMPORT_REPLACED_BY_QUESTIONS in the window.
 */
export function accuracyBySystem(sessions: Session[], from: ISODate, to: ISODate): SystemAccuracy[] {
  const own = new Map<string, { attempted: number; correct: number }>()
  const history = new Map<string, { attempted: number; correct: number }>()
  const add = (m: typeof own, s: Session) => {
    const cur = m.get(s.system!) ?? { attempted: 0, correct: 0 }
    cur.attempted += s.questions!
    cur.correct += s.correct ?? 0
    m.set(s.system!, cur)
  }
  for (const s of sessions) {
    if (!s.system || s.system === MIXED_SYSTEM || !s.questions || s.date > to) continue
    if (s.imported) add(history, s)
    else if (s.date >= from) add(own, s)
  }
  const by = new Map(own)
  for (const [system, h] of history) {
    const mine = own.get(system)
    if (!mine || mine.attempted < IMPORT_REPLACED_BY_QUESTIONS) {
      by.set(system, { attempted: h.attempted + (mine?.attempted ?? 0), correct: h.correct + (mine?.correct ?? 0) })
    }
  }
  return [...by.entries()]
    .map(([system, v]) => ({ system, ...v, pct: pct(v.correct, v.attempted) }))
    .sort((a, b) => a.pct - b.pct || a.system.localeCompare(b.system))
}

export function recentAccuracy(sessions: Session[], today: ISODate): SystemAccuracy[] {
  return accuracyBySystem(sessions, addDays(today, -(ACCURACY_WINDOW_DAYS - 1)), today)
}
