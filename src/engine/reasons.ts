// One-line "why" copy. Built only from things we actually know:
// accuracy, pace, days until exam, open fixes, retests due. No made-up weights.
// English only for now; Phase 1 moves these to i18n keys with params.

import { daysBetween, toDate } from './dates'
import type { GoalPace } from './pace'
import type { ISODate, Resource } from './types'

export function plural(n: number, [one, many]: [string, string]): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`
}

/** "Heart failure" → "heart failure", but "AKI & CKD" stays. */
export function inSentence(name: string): string {
  if (name.length > 1 && name[1] === name[1].toUpperCase() && name[1] !== name[1].toLowerCase()) return name
  return name[0].toLowerCase() + name.slice(1)
}

/** "heart failure", "heart failure and arrhythmias", "a, b and c". */
export function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function weekdayName(date: ISODate): string {
  return WEEKDAYS[toDate(date).getUTCDay()]
}

export function shortDate(date: ISODate): string {
  const d = toDate(date)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

/** "today", "tomorrow", "Thursday", "Thursday 19 Nov". */
export function dayName(date: ISODate, today: ISODate): string {
  const diff = daysBetween(today, date)
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff === -1) return 'yesterday'
  if (diff > 1 && diff < 7) return weekdayName(date)
  if (diff < 0 && diff > -7) return weekdayName(date)
  return `${weekdayName(date)} ${shortDate(date)}`
}

export function inDays(n: number): string {
  if (n <= 0) return 'today'
  if (n === 1) return 'tomorrow'
  return `in ${n} days`
}

export const reasons = {
  examSoon: (label: string, daysLeft: number) => `${label} ${inDays(daysLeft)}`,
  lowestAccuracy: (pct: number) => `Your lowest accuracy (${pct}%)`,
  belowTarget: (system: string, pct: number) => `${system} is at ${pct}%`,
  noData: (system: string) => `No ${system} data yet`,
  fromBlock: (system: string, source: ISODate, today: ISODate) => {
    const d = dayName(source, today)
    return `From ${d === 'today' ? "today's" : d === 'yesterday' ? "yesterday's" : `${d}'s`} ${system} block`
  },
  markedWeak: (names: string[]) => `You marked ${listJoin(names.map(inSentence))} as weak`,
  blockScore: (system: string, pct: number) => `${system} block: ${pct}%`,
  retestDue: (date: ISODate, today: ISODate) =>
    date <= today ? 'Retest due today' : `Retest due ${dayName(date, today)}`,
  ankiNew: (perDay: number) =>
    perDay > 0 ? `${perDay} new cards a day finishes your deck in time` : 'Keep reviews at zero due',
  behindCatchUp: (r: Resource) => `Catching up on ${r.name}`,
}

export interface Verdict {
  headline: string
  detail: string
}

export function verdict(p: GoalPace): Verdict {
  const { goal, worst } = p
  if (p.status === 'behind' && worst) {
    const { pace, resource } = worst
    return {
      headline: `${goal.label}: ${plural(pace.daysLate, ['day', 'days'])} behind on ${resource.name}.`,
      detail: `+${plural(pace.extraPerDay, resource.unit)} a day fixes it.`,
    }
  }
  if (p.status === 'onTrack' && worst) {
    const { pace, resource } = worst
    return {
      headline: `${goal.label}: on track.`,
      detail: `${plural(pace.remaining, resource.unit)} left, ${pace.requiredPerDay} a day is enough.`,
    }
  }
  if (worst) {
    return {
      headline: `${goal.label}: your first week sets your pace.`,
      detail: `Aim for ${plural(worst.pace.requiredPerDay, worst.resource.unit)} a day.`,
    }
  }
  return { headline: `${goal.label}: ${inDays(p.daysLeft)}.`, detail: 'Add a resource to see your pace.' }
}
