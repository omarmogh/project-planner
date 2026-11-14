// Onboarding answers → the student's plan. Pure; reused in Phase 1.
// Only asks what students know without checking anything; every "Not sure" has a default here.

import {
  AMBOSS_MINUTES_PER_TOPIC, BNB_MINUTES_PER_VIDEO, FIRST_AID_MINUTES_PER_SECTION, PATHOMA_MINUTES_PER_TOPIC,
  QBANK_MINUTES_PER_QUESTION, TOPIC_QUESTIONS, addDays, projectedExamDate, suggestNextSystem,
} from '../engine'
import type { EngineState, Goal, GoalKind, ISODate, Material, Resource, StudyItem, Topic } from '../engine'
import { BNB } from './resources/bnb'
import { FIRST_AID } from './resources/firstaid'
import {
  ANKI_NEW_UNSURE, DEFAULT_WEEKEND_DAYS, GOALS, LECTURES_LEFT_UNSURE, PATHOMA_SYSTEMS, RESOURCES, UNIVERSITIES,
  UWORLD_DONE_UNSURE, UWORLD_TOTAL, UWORLD_TOTAL_DEFAULT, rotationById, roughDate,
  type ResourceKey, type RoughWhen, type Stage,
} from './templates'
import { SYSTEMS, TOPICS, topicId } from './topics'

/** How the student answered "when is it?". */
export type DateAnswer =
  | { kind: 'date'; date: ISODate }
  | { kind: 'rough'; when: RoughWhen }
  /** Board: "No idea" → projected. Uni: "Don't know yet" → end of rotation. */
  | { kind: 'unknown' }

export interface Answers {
  stage: Stage
  university: string
  goals: GoalKind[]
  dates: Partial<Record<GoalKind, DateAnswer>>
  /** A rotation id from the templates, or undefined with `rotationCustom` typed in. */
  rotation?: string
  rotationCustom?: string
  /** undefined = "Not sure" → the university's usual rotation length. */
  rotationUntil?: ISODate
  resources: ResourceKey[]
  /** null = "Not sure". */
  uworldDone: number | null
  ankiNewLeft: number | null
  ankiReviewMinutes: number
  lecturesLeft: number | null
  /** Systems studied now (1–2). Empty = "Not sure": the app suggests one. */
  systemsNow: string[]
  /** Systems already studied at least once. Empty = "None yet". */
  systemsDone: string[]
  weekdayHours: number
  weekendHours: number
  /** 0 = Sunday … 6 = Saturday. Defaults to Fri + Sat. */
  weekendDays: number[]
  callDays: number[]
}

export function defaultAnswers(): Answers {
  return {
    stage: 'clinical',
    university: 'mutah',
    goals: [],
    dates: {},
    resources: [],
    uworldDone: null,
    ankiNewLeft: null,
    ankiReviewMinutes: 30,
    lecturesLeft: null,
    systemsNow: [],
    systemsDone: [],
    weekdayHours: 2,
    weekendHours: 4,
    weekendDays: [...DEFAULT_WEEKEND_DAYS],
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

/** "IM", "Family medicine", or what the student typed. */
export function rotationShort(a: Pick<Answers, 'rotation' | 'rotationCustom'>): string | undefined {
  return rotationById(a.rotation)?.short ?? (a.rotationCustom?.trim() || undefined)
}

/** The uni goal is named after the rotation: "IM exam", never "Rotation exam". */
export function goalLabel(kind: GoalKind, a: Pick<Answers, 'stage' | 'rotation' | 'rotationCustom'>): string {
  if (kind !== 'uni') return GOALS.find((g) => g.kind === kind)!.label
  const short = a.stage === 'clinical' ? rotationShort(a) : undefined
  return short ? `${short} exam` : 'Uni exam'
}

export function rotationEnd(a: Pick<Answers, 'rotationUntil' | 'university'>, today: ISODate): ISODate {
  return a.rotationUntil ?? addDays(today, university(a.university).rotationWeeks * 7)
}

/** The board exam planned by topic: the first non-uni goal. */
export function boardGoal(goals: GoalKind[]): GoalKind | undefined {
  return goals.find((g) => g !== 'uni')
}

export function selectedMaterials(keys: ResourceKey[]): Material[] {
  return RESOURCES.filter((r) => r.material && keys.includes(r.key)).map((r) => r.material!)
}

/** Topic-by-topic planning needs a board exam and something to study topics with. */
export function plansByTopic(a: Pick<Answers, 'goals' | 'resources'>): boolean {
  return !!boardGoal(a.goals) && (selectedMaterials(a.resources).length > 0 || a.resources.includes('uworld'))
}

/** How a topic is studied with this student's resources: watch → read → questions. */
export function topicItems(system: string, name: string, materials: Material[], qbankName?: string): StudyItem[] {
  const id = topicId(system, name)
  const items: StudyItem[] = []
  if (materials.includes('bnb')) {
    for (const v of BNB.filter((x) => x.topicIds.includes(id))) items.push({ source: 'bnb', title: v.title, minutes: BNB_MINUTES_PER_VIDEO })
  }
  if (materials.includes('pathoma') && PATHOMA_SYSTEMS.includes(system)) {
    items.push({ source: 'pathoma', title: name, minutes: PATHOMA_MINUTES_PER_TOPIC })
  }
  if (materials.includes('firstaid')) {
    for (const s of FIRST_AID.filter((x) => x.topicIds.includes(id))) items.push({ source: 'firstaid', title: s.title, minutes: FIRST_AID_MINUTES_PER_SECTION })
  }
  if (materials.includes('amboss')) items.push({ source: 'amboss', title: name, minutes: AMBOSS_MINUTES_PER_TOPIC })
  if (qbankName) {
    items.push({ source: 'qbank', title: qbankName, minutes: TOPIC_QUESTIONS * QBANK_MINUTES_PER_QUESTION, questions: TOPIC_QUESTIONS })
  }
  return items
}

/** Every topic in the map. With a topic plan: items from the student's resources; done systems start covered. */
export function allTopics(a?: Pick<Answers, 'resources' | 'systemsDone' | 'goals'>): Topic[] {
  const byTopic = a ? plansByTopic(a) : false
  const materials = a ? selectedMaterials(a.resources) : []
  const qbank = a?.resources.includes('uworld') ? 'UWorld' : undefined
  return SYSTEMS.flatMap(({ id: system }) =>
    TOPICS[system].map((name) => {
      const items = byTopic ? topicItems(system, name, materials, qbank) : []
      const done = !!a?.systemsDone.includes(system)
      return {
        id: topicId(system, name),
        system,
        name,
        status: 'unknown' as const,
        items,
        doneItems: done ? items.length : 0,
        partialMin: 0,
      }
    }),
  )
}

export function buildPlanState(a: Answers, today: ISODate): EngineState {
  const board = boardGoal(a.goals)
  const rotationUntil = a.stage === 'clinical' ? rotationEnd(a, today) : undefined
  // Placeholder for "No idea" until the projection below.
  const far = addDays(today, 730)

  const goals: Goal[] = a.goals.map((kind) => {
    const answer = a.dates[kind] ?? { kind: 'unknown' }
    const base = { id: kind, kind, label: goalLabel(kind, a) }
    if (answer.kind === 'date') return { ...base, examDate: answer.date, dateSource: 'set' }
    if (answer.kind === 'rough') return { ...base, examDate: roughDate(answer.when, today), dateSource: 'rough' }
    if (kind === 'uni') {
      return { ...base, examDate: rotationUntil ?? addDays(today, university(a.university).blockExamInDays), dateSource: 'assumed' }
    }
    return { ...base, examDate: far, dateSource: 'projected' }
  })

  const uni = goals.find((g) => g.kind === 'uni')
  const boardG = goals.find((g) => g.kind === board)
  const resources: Resource[] = []
  if (a.resources.includes('uworld') && (boardG ?? uni)) {
    const goal = boardG ?? uni!
    const total = UWORLD_TOTAL[goal.kind] ?? UWORLD_TOTAL_DEFAULT
    resources.push({
      id: 'uworld', goalId: goal.id, type: 'qbank', name: 'UWorld', totalUnits: total,
      doneUnits: Math.min(total, a.uworldDone ?? UWORLD_DONE_UNSURE),
      unit: ['question', 'questions'], minutesPerUnit: QBANK_MINUTES_PER_QUESTION,
    })
  }
  if (a.resources.includes('slides') && uni) {
    const short = uni.label.replace(/ exam$/, '')
    resources.push({
      id: 'slides', goalId: uni.id, type: 'slides', name: short === 'Uni' ? 'Uni slides' : `${short} slides`,
      totalUnits: a.lecturesLeft ?? LECTURES_LEFT_UNSURE, doneUnits: 0, unit: ['lecture', 'lectures'], minutesPerUnit: 30,
    })
  }

  const ankiGoal = boardG ?? uni
  const anki = a.resources.includes('anki') && ankiGoal
    ? { goalId: ankiGoal.id, name: 'Anki', newCardsLeft: a.ankiNewLeft ?? ANKI_NEW_UNSURE, reviewMinutes: a.ankiReviewMinutes }
    : undefined

  const topics = allTopics(a)
  const byTopic = plansByTopic(a) && !!boardG
  const rot = rotationById(a.rotation)
  const short = rotationShort(a)
  const state: EngineState = {
    goals,
    resources,
    materials: selectedMaterials(a.resources),
    anki,
    availability: {
      weekdayMinutes: Math.round(a.weekdayHours * 60),
      weekendMinutes: Math.round(a.weekendHours * 60),
      callDays: a.stage === 'clinical' ? a.callDays : [],
      weekendDays: [...a.weekendDays],
    },
    rotation: a.stage === 'clinical' && short && rotationUntil ? { name: rot?.name ?? short, short, until: rotationUntil } : undefined,
    topicGoalId: byTopic ? boardG!.id : undefined,
    focus: [],
    topics,
    sessions: [],
    scheduled: [],
  }

  if (byTopic) {
    const now = a.systemsNow.filter((x) => !a.systemsDone.includes(x)).slice(0, 2)
    const next = now.length ? now : [suggestNextSystem(state, today)].filter((x): x is string => !!x)
    state.focus = next
  }

  // "No idea" → the ready-by date at this pace. Shown on Pace with a way to lock it in.
  for (const g of state.goals) {
    if (g.dateSource === 'projected') g.examDate = projectedExamDate(state, g, today)
  }
  return state
}
