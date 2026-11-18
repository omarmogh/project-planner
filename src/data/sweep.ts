// Recall Sweep demo data (idea prototype, behind ?idea=1).
import { sweepItems, type EngineState, type LectureSource, type SweepItem } from '../engine'

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
