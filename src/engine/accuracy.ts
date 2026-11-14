import { addDays } from './dates'
import type { ISODate, Session } from './types'

export interface SystemAccuracy {
  system: string
  attempted: number
  correct: number
  /** 0–100, rounded. */
  pct: number
}

export type Band = 'solid' | 'borderline' | 'weak'

/** Below this a block triggers a fix when no topic was tapped. */
export const WEAK_BELOW = 60
/** Retest score that moves a topic weak → solid. */
export const RETEST_PASS = 70

export function band(pct: number): Band {
  if (pct >= WEAK_BELOW) return 'solid'
  if (pct >= 55) return 'borderline'
  return 'weak'
}

export function pct(correct: number, attempted: number): number {
  return attempted === 0 ? 0 : Math.round((correct * 100) / attempted)
}

/** Accuracy per system from question sessions in [from, to] (inclusive). */
export function accuracyBySystem(sessions: Session[], from: ISODate, to: ISODate): SystemAccuracy[] {
  const by = new Map<string, { attempted: number; correct: number }>()
  for (const s of sessions) {
    if (!s.system || !s.questions || s.date < from || s.date > to) continue
    const cur = by.get(s.system) ?? { attempted: 0, correct: 0 }
    cur.attempted += s.questions
    cur.correct += s.correct ?? 0
    by.set(s.system, cur)
  }
  return [...by.entries()]
    .map(([system, v]) => ({ system, ...v, pct: pct(v.correct, v.attempted) }))
    .sort((a, b) => a.pct - b.pct || a.system.localeCompare(b.system))
}

/** Default window used on Today and Pace. */
export const ACCURACY_WINDOW_DAYS = 30

export function recentAccuracy(sessions: Session[], today: ISODate): SystemAccuracy[] {
  return accuracyBySystem(sessions, addDays(today, -(ACCURACY_WINDOW_DAYS - 1)), today)
}
