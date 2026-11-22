// Recall Sweep (idea prototype, behind ?idea=1). Pure: no React, no store, no Date.now().
// The student sees up to 6 titles they already covered, thinks of 3 key points for each,
// and taps Had it / Fuzzy / Blank. Nothing is typed, nothing is checked.
// Ratings become small, concrete items in the coming days.

import { QBANK_MINUTES_PER_QUESTION } from './config'
import { addDays } from './dates'
import type { ISODate, Task, Topic } from './types'

export type Recall = 'had' | 'fuzzy' | 'blank'

export interface SweepItem {
  id: string
  /** A board topic is checked with questions; a uni lecture has no QBank, so it's re-read and re-swept. */
  kind: 'topic' | 'lecture'
  title: string
  goalId: string
  /** "Step 1 · Cardio" (the board goal's own label), "IM lecture". */
  label: string
  system?: string
  topicId?: string
}

/** One uni goal's lectures already studied, newest last. */
export interface LectureSource {
  goalId: string
  /** "IM": used as "IM lecture". */
  short: string
  titles: string[]
  /** Stable ids, one per title (a real lecture list); else ids follow the titles' places. */
  keys?: string[]
}

// TODO(review): placeholder numbers for the idea prototype.
export const SWEEP = {
  max: 6,
  /** Uni lectures in a sweep, when there are both kinds. */
  lectures: 2,
  /** Questions added for a Blank / Fuzzy board topic. */
  blankQuestions: 10,
  fuzzyQuestions: 5,
  /** Days until the task appears. Blank comes first. */
  blankInDays: 1,
  fuzzyInDays: 2,
  lectureReviewMinutes: 20,
  /** Fuzzy uni lecture: a short skim before it's swept again. */
  lectureSkimMinutes: 10,
  skimInDays: 2,
  /** Lectures come back in a later sweep. */
  resweepSoonDays: 3,
  resweepLaterDays: 10,
  /** Minutes the sweep row shows. */
  minutes: 4,
} as const

/**
 * The titles for today's sweep: board topics the student covered in the system they're on
 * (not ones already being fixed), plus a couple of uni lectures. At most SWEEP.max.
 */
export function sweepItems(topics: Topic[], system: string, goalId: string, lectures: LectureSource[], goalLabel = 'Step 1'): SweepItem[] {
  const lectureItems: SweepItem[] = lectures.flatMap((l) =>
    l.titles.slice(-SWEEP.lectures).map((title, i) => ({
      id: l.keys?.[Math.max(0, l.titles.length - SWEEP.lectures) + i] ?? `lecture-${l.goalId}-${l.titles.length - SWEEP.lectures + i}`,
      kind: 'lecture' as const,
      title,
      goalId: l.goalId,
      label: `${l.short} lecture`,
    })),
  ).slice(0, SWEEP.lectures)

  const covered = topics.filter(
    (t) => t.system === system && !t.wholeSystem && (t.items?.length ?? 0) > 0 && (t.doneItems ?? 0) >= (t.items?.length ?? 0)
      && t.status !== 'weak' && t.status !== 'fixing',
  )
  const topicItems: SweepItem[] = covered.slice(0, SWEEP.max - lectureItems.length).map((t) => ({
    id: `topic-${t.id}`, kind: 'topic', title: t.name, goalId, label: `${goalLabel} · ${system}`, system, topicId: t.id,
  }))

  // Lectures go in the middle, so the sweep doesn't feel like two separate lists.
  const out = [...topicItems]
  lectureItems.forEach((l, i) => out.splice(Math.min(out.length, 2 + i * 2), 0, l))
  return out.slice(0, SWEEP.max)
}

export interface SweepOutcome {
  /** New items in the coming days. Ids are stable per item, so re-applying replaces, never duplicates. */
  tasks: Task[]
  /** Lectures that come back in a later sweep. */
  resweep: { item: SweepItem; date: ISODate }[]
  /** Board topics that felt solid: spot-checked later by normal question blocks. */
  had: SweepItem[]
  rated: number
}

export const sweepTaskId = (item: SweepItem) => `sweep-${item.id}`

/** What the ratings given so far add. Unrated items add nothing (a partial sweep keeps what was rated). */
export function sweepOutcome(items: SweepItem[], ratings: Record<string, Recall>, today: ISODate): SweepOutcome {
  const out: SweepOutcome = { tasks: [], resweep: [], had: [], rated: 0 }
  for (const item of items) {
    const r = ratings[item.id]
    if (!r) continue
    out.rated++
    if (item.kind === 'topic') {
      if (r === 'had') { out.had.push(item); continue }
      const questions = r === 'blank' ? SWEEP.blankQuestions : SWEEP.fuzzyQuestions
      out.tasks.push({
        id: sweepTaskId(item),
        date: addDays(today, r === 'blank' ? SWEEP.blankInDays : SWEEP.fuzzyInDays),
        kind: 'fix',
        goalId: item.goalId,
        system: item.system,
        topicIds: item.topicId ? [item.topicId] : undefined,
        title: `${item.title}: ${questions} questions`,
        reason: r === 'blank' ? 'Blank in your recall sweep' : 'Fuzzy in your recall sweep',
        minutes: questions * QBANK_MINUTES_PER_QUESTION,
        amount: questions,
        status: 'pending',
        sourceDate: today,
      })
    } else {
      if (r === 'blank') {
        out.tasks.push({
          id: sweepTaskId(item),
          date: addDays(today, SWEEP.blankInDays),
          kind: 'fix',
          goalId: item.goalId,
          title: `Review lecture: ${item.title}`,
          reason: 'Blank in your recall sweep',
          minutes: SWEEP.lectureReviewMinutes,
          status: 'pending',
          sourceDate: today,
        })
      } else if (r === 'fuzzy') {
        out.tasks.push({
          id: sweepTaskId(item),
          date: addDays(today, SWEEP.skimInDays),
          kind: 'fix',
          goalId: item.goalId,
          title: `Skim lecture: ${item.title}`,
          reason: 'Fuzzy in your recall sweep',
          minutes: SWEEP.lectureSkimMinutes,
          status: 'pending',
          sourceDate: today,
        })
      }
      out.resweep.push({ item, date: addDays(today, r === 'had' ? SWEEP.resweepLaterDays : SWEEP.resweepSoonDays) })
    }
  }
  out.tasks.sort((a, b) => a.date.localeCompare(b.date))
  return out
}

/** Replace earlier sweep tasks with the current outcome (re-rating after closing early never duplicates). */
export function withSweepTasks(scheduled: Task[], items: SweepItem[], tasks: Task[]): Task[] {
  const ids = new Set(items.map(sweepTaskId))
  return [...scheduled.filter((t) => !ids.has(t.id)), ...tasks]
}
