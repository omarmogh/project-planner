// Time estimates that learn from the timer. No calibration mode: every finished
// task nudges its kind's estimate a little (formula and numbers in config.ts).
// An estimate is a factor on the config defaults: 1 = as configured, 1.2 = 20% slower.

import { ESTIMATE_MAX, ESTIMATE_MAX_STEP, ESTIMATE_MIN, ESTIMATE_OUTLIER_RATIO, ESTIMATE_PRIOR_SESSIONS } from './config'
import type { EngineState, Session } from './types'

/** Topic tasks (videos + reading + questions), uni lectures, and question blocks learn separately. */
export type EstimateKind = 'topic' | 'lectures' | 'questions'

export type Estimates = Record<EstimateKind, number>

export const DEFAULT_ESTIMATES: Estimates = { topic: 1, lectures: 1, questions: 1 }

export interface Blend {
  factor: number
  /** Sessions counted so far (outliers aren't). */
  n: number
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

/**
 * One finished task → the next estimate.
 * `actual` and `planned` are the task's timer and planned minutes. `planned` already
 * included the estimate of the day, so the ratio is scaled back to the config default.
 */
export function blendEstimate(prev: Blend, actual: number, planned: number): Blend {
  if (!(actual > 0) || !(planned > 0)) return prev
  const raw = actual / planned
  // Left running (lunch, a night) or stopped right away: not a real measurement.
  if (raw > ESTIMATE_OUTLIER_RATIO || raw < 1 / ESTIMATE_OUTLIER_RATIO) return prev
  const n = prev.n + 1
  const target = raw * prev.factor
  const step = clamp((target - prev.factor) / (ESTIMATE_PRIOR_SESSIONS + n), -ESTIMATE_MAX_STEP, ESTIMATE_MAX_STEP)
  return { factor: clamp(prev.factor + step, ESTIMATE_MIN, ESTIMATE_MAX), n }
}

/** Which estimate a session teaches; null for Anki, fixes, retests and untimed (imported, partly) sessions. */
export function sessionEstimateKind(s: Session, slidesIds: Set<string>): EstimateKind | null {
  if (s.kind !== 'study' || !s.planned || s.imported) return null
  if (s.topicIds?.length) return 'topic'
  if (s.resourceId && slidesIds.has(s.resourceId)) return 'lectures'
  if (s.resourceId && s.questions) return 'questions'
  return null
}

/** The current blended estimates, replayed from every finished task in order. */
export function estimates(s: Pick<EngineState, 'sessions' | 'resources'>): Estimates {
  const slides = new Set(s.resources.filter((r) => r.type === 'slides').map((r) => r.id))
  const blends: Record<EstimateKind, Blend> = { topic: { factor: 1, n: 0 }, lectures: { factor: 1, n: 0 }, questions: { factor: 1, n: 0 } }
  const ordered = s.sessions.map((x, i) => ({ x, i })).sort((a, b) => a.x.date.localeCompare(b.x.date) || a.i - b.i)
  for (const { x } of ordered) {
    const kind = sessionEstimateKind(x, slides)
    if (kind) blends[kind] = blendEstimate(blends[kind], x.minutes, x.planned!)
  }
  return { topic: blends.topic.factor, lectures: blends.lectures.factor, questions: blends.questions.factor }
}
