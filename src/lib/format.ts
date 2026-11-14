import { toDate, type ISODate } from '../engine'

/** 125 → "2 h 05 min", 40 → "40 min". */
export function duration(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')} min`
}

/** "Sunday, 15 November". */
export function longDate(iso: ISODate): string {
  return toDate(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
}

/** "8–14 Nov". */
export function range(from: ISODate, to: ISODate): string {
  const a = toDate(from)
  const b = toDate(to)
  const m = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })
  return m(a) === m(b)
    ? `${a.getUTCDate()}–${b.getUTCDate()} ${m(b)}`
    : `${a.getUTCDate()} ${m(a)} – ${b.getUTCDate()} ${m(b)}`
}

/** mm:ss, or h:mm:ss past an hour. */
export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

export function num(n: number): string {
  return n.toLocaleString('en-US')
}
