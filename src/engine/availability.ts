import { CALL_DAY_MINUTES, POST_CALL_FACTOR } from './config'
import { addDays, weekday } from './dates'
import type { Availability, ISODate } from './types'

export type DayKind = 'normal' | 'weekend' | 'call' | 'postCall'

export interface DayContext {
  kind: DayKind
  minutes: number
}

export function roundTo5(n: number): number {
  return Math.round(n / 5) * 5
}

/** Which days are the weekend comes from the student's own answers, never hardcoded. */
export function dayContext(a: Availability, date: ISODate): DayContext {
  const dow = weekday(date)
  const base = a.weekendDays.includes(dow) ? a.weekendMinutes : a.weekdayMinutes
  if (a.callDays.includes(dow)) return { kind: 'call', minutes: Math.min(base, CALL_DAY_MINUTES) }
  if (a.callDays.includes(weekday(addDays(date, -1)))) {
    return { kind: 'postCall', minutes: roundTo5(base * POST_CALL_FACTOR) }
  }
  return { kind: a.weekendDays.includes(dow) ? 'weekend' : 'normal', minutes: base }
}
