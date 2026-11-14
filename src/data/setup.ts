// Onboarding answers → the student's plan. Pure; reused in Phase 1.

import { addDays } from '../engine'
import type { EngineState, Goal, GoalKind, ISODate, Resource, Topic } from '../engine'
import {
  GOALS, RESOURCES, ROTATIONS, TOPIC_CATALOG, UNIVERSITIES, WEEKEND_DAYS, topicId,
  type ResourceKey, type ResourceTemplate, type Stage,
} from './templates'

export interface Answers {
  stage: Stage
  university: string
  goals: GoalKind[]
  examDates: Partial<Record<GoalKind, ISODate>>
  rotation?: string
  rotationUntil?: ISODate
  resources: ResourceKey[]
  /** Per resource: units done, % done, or cards left (see template input kind). */
  amounts: Partial<Record<ResourceKey, number>>
  slidesTotal: number
  ankiReviewMinutes: number
  weekdayHours: number
  weekendHours: number
  callDays: number[]
}

export function defaultAnswers(): Answers {
  return {
    stage: 'clinical',
    university: 'mutah',
    goals: [],
    examDates: {},
    rotation: undefined,
    rotationUntil: undefined,
    resources: [],
    amounts: {},
    slidesTotal: 18,
    ankiReviewMinutes: 25,
    weekdayHours: 2,
    weekendHours: 4,
    callDays: [],
  }
}

export function university(id: string) {
  return UNIVERSITIES.find((u) => u.id === id) ?? UNIVERSITIES[UNIVERSITIES.length - 1]
}

/** Which goals make sense for this stage. */
export function goalChoices(stage: Stage) {
  return GOALS.filter((g) => !(stage === 'graduated' && g.kind === 'uni'))
}

export function defaultExamDate(kind: GoalKind, a: Pick<Answers, 'university'>, today: ISODate): ISODate {
  if (kind === 'uni') return addDays(today, university(a.university).blockExamInDays)
  return addDays(today, GOALS.find((g) => g.kind === kind)!.defaultInDays)
}

export function goalLabel(kind: GoalKind, a: Pick<Answers, 'stage' | 'rotation'>): string {
  if (kind !== 'uni') return GOALS.find((g) => g.kind === kind)!.label
  if (a.stage === 'clinical' && a.rotation) {
    return `${ROTATIONS.find((r) => r.id === a.rotation)?.short ?? 'Rotation'} exam`
  }
  return 'Uni exam'
}

export function resourceTotal(t: ResourceTemplate, goal: GoalKind | undefined): number {
  if (typeof t.total === 'number') return t.total
  return (goal && t.total[goal]) ?? Object.values(t.total)[0] ?? 0
}

/** Slides belong to the uni exam; everything else to the first board exam. */
function goalFor(key: ResourceKey, goals: Goal[]): Goal {
  const uni = goals.find((g) => g.kind === 'uni')
  const board = goals.find((g) => g.kind !== 'uni')
  if (key === 'slides') return uni ?? board!
  return board ?? uni!
}

export function allTopics(): Topic[] {
  return Object.entries(TOPIC_CATALOG).flatMap(([system, names]) =>
    names.map((name) => ({ id: topicId(system, name), system, name, status: 'unknown' as const })),
  )
}

export function buildPlanState(a: Answers): EngineState {
  const goals: Goal[] = a.goals.map((kind) => ({
    id: kind,
    kind,
    label: goalLabel(kind, a),
    examDate: a.examDates[kind]!,
  }))

  const resources: Resource[] = []
  let anki: EngineState['anki']
  for (const key of a.resources) {
    const t = RESOURCES.find((r) => r.key === key)!
    const goal = goalFor(key, goals)
    if (!goal) continue
    const amount = a.amounts[key] ?? t.defaultAmount
    if (t.type === 'anki') {
      anki = { goalId: goal.id, name: 'Anki', newCardsLeft: amount, reviewMinutes: a.ankiReviewMinutes }
      continue
    }
    const total = key === 'slides' ? a.slidesTotal : resourceTotal(t, goal.kind)
    const done = t.input.kind === 'percent' ? Math.round((total * amount) / 100) : Math.min(amount, total)
    const name = key === 'slides' && goal.kind === 'uni' ? `${goal.label.replace(/ exam$/, '')} slides` : t.name
    resources.push({
      id: key,
      goalId: goal.id,
      type: t.type,
      name,
      totalUnits: total,
      doneUnits: done,
      unit: t.unit,
      minutesPerUnit: t.minutesPerUnit,
    })
  }

  const rot = a.stage === 'clinical' ? ROTATIONS.find((r) => r.id === a.rotation) : undefined
  return {
    goals,
    resources,
    anki,
    availability: {
      weekdayMinutes: Math.round(a.weekdayHours * 60),
      weekendMinutes: Math.round(a.weekendHours * 60),
      callDays: a.stage === 'clinical' ? a.callDays : [],
      weekendDays: WEEKEND_DAYS,
    },
    rotation: rot && a.rotationUntil ? { name: rot.name, short: rot.short, until: a.rotationUntil } : undefined,
    topics: allTopics(),
    sessions: [],
    scheduled: [],
  }
}
