// Overconfidence check: a board topic rated "Had it" in a recall sweep that later scores
// under WEAK_BELOW in a question block gets one gentle note and a short review.
// Pure: no React, no store, no Date.now().

import { CONFIDENCE_REVIEW_MINUTES, CONFIDENCE_WINDOW_DAYS, WEAK_BELOW } from './config'
import { addDays, daysBetween } from './dates'
import type { Confident, EngineState, ISODate, Task } from './types'

export interface TopicScore {
  topicId: string
  /** Percent correct. */
  score: number
}

export interface Overconfidence {
  /** Shown once: "You felt sure about X, but scored Y%. Added a short review." */
  note: { topicId: string; name: string; score: number } | null
  confident: Confident[]
  /** Null when a fix already covers the topic, or there's no note. */
  review: Task | null
}

/**
 * The first topic in `scores` the student felt sure about (within CONFIDENCE_WINDOW_DAYS,
 * not noted yet) that scored under WEAK_BELOW. `covered` = topics a fix from this block already handles.
 */
export function overconfidence(s: EngineState, scores: TopicScore[], today: ISODate, covered: string[] = []): Overconfidence {
  const confident = s.confident ?? []
  const none = { note: null, confident, review: null }
  const hit = scores.find((x) => {
    const c = confident.find((y) => y.topicId === x.topicId)
    return !!c && !c.noted && x.score < WEAK_BELOW && c.date <= today && daysBetween(c.date, today) <= CONFIDENCE_WINDOW_DAYS
  })
  const topic = hit && s.topics.find((t) => t.id === hit.topicId)
  if (!hit || !topic || !s.topicGoalId) return none

  const score = Math.round(hit.score)
  const id = `review-${topic.id}-${today}`
  const review: Task | null = covered.includes(topic.id) || s.scheduled.some((t) => t.id === id) ? null : {
    id,
    date: addDays(today, 1),
    kind: 'fix',
    goalId: s.topicGoalId,
    system: topic.system,
    topicIds: [topic.id],
    title: `Short review: ${topic.name}`,
    reason: `Felt sure in your sweep, scored ${score}%`,
    minutes: CONFIDENCE_REVIEW_MINUTES,
    status: 'pending',
    sourceDate: today,
  }
  return {
    note: { topicId: topic.id, name: topic.name, score },
    confident: confident.map((c) => (c.topicId === topic.id ? { ...c, noted: true } : c)),
    review,
  }
}

/** Sweep ratings → the confident list. "Had it" adds the topic; re-rating today removes an un-noted entry. */
export function rateConfident(confident: Confident[] | undefined, topicId: string, had: boolean, today: ISODate): Confident[] {
  const rest = (confident ?? []).filter((c) => c.topicId !== topicId || c.noted)
  if (!had) return rest
  return [...rest.filter((c) => c.topicId !== topicId), { topicId, date: today }]
}
