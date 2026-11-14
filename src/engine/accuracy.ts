import { ACCURACY_WINDOW_DAYS, BORDERLINE_FROM, MIXED_SYSTEM, WEAK_BELOW } from './config'
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

export function band(pct: number): Band {
  if (pct >= WEAK_BELOW) return 'solid'
  if (pct >= BORDERLINE_FROM) return 'borderline'
  return 'weak'
}

export function pct(correct: number, attempted: number): number {
  return attempted === 0 ? 0 : Math.round((correct * 100) / attempted)
}

/** Accuracy per system from question sessions in [from, to] (inclusive). */
export function accuracyBySystem(sessions: Session[], from: ISODate, to: ISODate): SystemAccuracy[] {
  const by = new Map<string, { attempted: number; correct: number }>()
  for (const s of sessions) {
    if (!s.system || s.system === MIXED_SYSTEM || !s.questions || s.date < from || s.date > to) continue
    const cur = by.get(s.system) ?? { attempted: 0, correct: 0 }
    cur.attempted += s.questions
    cur.correct += s.correct ?? 0
    by.set(s.system, cur)
  }
  return [...by.entries()]
    .map(([system, v]) => ({ system, ...v, pct: pct(v.correct, v.attempted) }))
    .sort((a, b) => a.pct - b.pct || a.system.localeCompare(b.system))
}

export function recentAccuracy(sessions: Session[], today: ISODate): SystemAccuracy[] {
  return accuracyBySystem(sessions, addDays(today, -(ACCURACY_WINDOW_DAYS - 1)), today)
}
