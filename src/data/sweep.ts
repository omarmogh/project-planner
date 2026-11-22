// Recall Sweep: the demo (behind ?idea=1) and the real one for students without a question bank.
import { doneLectures, sweepItems, type EngineState, type ISODate, type LectureSource, type Recall, type SweepItem } from '../engine'

// TODO(placeholder): lectures Lina already studied. Real students would pick theirs once; titles only.
const IM_LECTURES_DONE = [
  'Community-acquired pneumonia', 'Diabetic ketoacidosis', 'Acute kidney injury', 'Upper GI bleeding', 'Anemia workup',
]

/** Today's sweep: covered topics in the system the student is on, plus a couple of uni lectures. */
export function demoSweep(plan: EngineState): { system: string; items: SweepItem[] } {
  const system = plan.focus[0] ?? 'Cardio'
  const uni = plan.goals.find((g) => g.kind === 'uni')
  const lectures: LectureSource[] = uni ? [{ goalId: uni.id, short: uni.label.replace(/ exam$/, ''), titles: IM_LECTURES_DONE }] : []
  return { system, items: sweepItems(plan.topics, system, plan.topicGoalId ?? 'step1', lectures, plan.goals.find((g) => g.id === (plan.topicGoalId ?? 'step1'))?.label) }
}

/**
 * The real sweep for a uni-only student (no question bank): the titled lectures they finished, at most
 * SWEEP.lectures, skipping ones not due again yet (EngineState.sweepDue). Ones rated today stay, so the
 * sweep doesn't shrink while it's open. Untitled lectures are never swept ("Lecture 4" means nothing to recall).
 */
export function planSweep(plan: EngineState, today: ISODate, ratedToday: Record<string, Recall>): { system: string; items: SweepItem[] } | null {
  if (plan.resources.some((r) => r.type === 'qbank')) return null
  const lectures: LectureSource[] = plan.goals.filter((g) => g.kind === 'uni').flatMap((g) => {
    const titles: string[] = []
    const keys: string[] = []
    for (const r of plan.resources.filter((x) => x.goalId === g.id && x.type === 'slides' && x.itemNames?.length)) {
      for (const i of [...doneLectures(r)].sort((a, b) => a - b)) {
        const title = r.itemNames?.[i]
        const key = `lecture-${r.id}-${i}`
        if (!title || (!ratedToday[key] && (plan.sweepDue?.[key] ?? '') > today)) continue
        titles.push(title)
        keys.push(key)
      }
    }
    return titles.length ? [{ goalId: g.id, short: g.label.replace(/ exam$/, ''), titles, keys }] : []
  })
  const items = sweepItems([], '', '', lectures)
  return items.length ? { system: '', items } : null
}
