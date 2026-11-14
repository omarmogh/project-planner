import { addDays, weekday } from './dates'
import type { Availability, ISODate } from './types'

export type DayKind = 'normal' | 'weekend' | 'call' | 'postCall'

export interface DayContext {
  kind: DayKind
  minutes: number
}

/** Share of a normal day left after a night on call. */
export const POST_CALL_FACTOR = 0.7
/** On a call day there is only room for Anki. */
export const CALL_DAY_MINUTES = 30

export function roundTo5(n: number): number {
  return Math.round(n / 5) * 5
}

export function dayContext(a: Availability, date: ISODate): DayContext {
  const dow = weekday(date)
  const base = a.weekendDays.includes(dow) ? a.weekendMinutes : a.weekdayMinutes
  if (a.callDays.includes(dow)) return { kind: 'call', minutes: Math.min(base, CALL_DAY_MINUTES) }
  if (a.callDays.includes(weekday(addDays(date, -1)))) {
    return { kind: 'postCall', minutes: roundTo5(base * POST_CALL_FACTOR) }
  }
  return { kind: a.weekendDays.includes(dow) ? 'weekend' : 'normal', minutes: base }
}
