import { weekday } from './dates'
import type { Availability, ISODate } from './types'

export type DayKind = 'normal' | 'weekend'

export interface DayContext {
  kind: DayKind
  minutes: number
}

export function roundTo5(n: number): number {
  return Math.round(n / 5) * 5
}

/** Which days are the weekend comes from the student's country (src/data/weekends.ts), never hardcoded here. */
export function dayContext(a: Availability, date: ISODate): DayContext {
  const weekend = a.weekendDays.includes(weekday(date))
  return { kind: weekend ? 'weekend' : 'normal', minutes: weekend ? a.weekendMinutes : a.weekdayMinutes }
}

/** The student's stated minutes for a day, plus extra time they agreed to in rescue mode. */
export function statedMinutes(a: Availability, date: ISODate): number {
  const base = dayContext(a, date).minutes
  // Extra time is added to study days only: a day the student said has no time stays free.
  const extra = base > 0 && a.extra && date <= a.extra.until ? a.extra.minutes : 0
  return base + extra
}
