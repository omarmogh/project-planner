import type { ISODate } from './types'

// Dates are handled as UTC midnights so day arithmetic never drifts with DST.

export function toDate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function toISO(d: Date): ISODate {
  return d.toISOString().slice(0, 10)
}

/** Today's local calendar date as ISO. Not pure: only call from the app shell. */
export function localToday(now = new Date()): ISODate {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(iso: ISODate, n: number): ISODate {
  const d = toDate(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return toISO(d)
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86_400_000)
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(iso: ISODate): number {
  return toDate(iso).getUTCDay()
}
