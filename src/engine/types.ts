// Core data model for the plan engine. Everything in src/engine is pure:
// no React, no store, no Date.now(). "Today" is always passed in as an ISO date.

/** Local calendar date, 'YYYY-MM-DD'. */
export type ISODate = string

export type GoalKind = 'uni' | 'step1' | 'step2' | 'plab' | 'smle' | 'board'

export interface Goal {
  id: string
  kind: GoalKind
  /** Short label shown on tasks: "IM exam", "Step 1". */
  label: string
  examDate: ISODate
}

export type ResourceType = 'qbank' | 'anki' | 'video' | 'reading' | 'slides'

export interface Resource {
  id: string
  goalId: string
  type: ResourceType
  /** "UWorld", "IM slides", "Pathoma". */
  name: string
  totalUnits: number
  doneUnits: number
  /** Singular / plural unit label: ["question", "questions"]. */
  unit: [string, string]
  /** Minutes one unit usually takes (qbank: per question incl. review). */
  minutesPerUnit: number
  /** When the student started this resource; used for pace. */
  startedOn?: ISODate
}

/** Anki is planned differently: Anki decides what's due, we only reserve time. */
export interface AnkiDeck {
  goalId: string
  name: string
  newCardsLeft: number
  reviewMinutes: number
}

export interface Availability {
  weekdayMinutes: number
  weekendMinutes: number
  /** 0 = Sunday … 6 = Saturday. */
  callDays: number[]
  /** Jordan: Friday + Saturday. */
  weekendDays: number[]
}

export interface Rotation {
  name: string
  /** "IM", used in short labels. */
  short: string
  until: ISODate
}

export type TopicStatus = 'unknown' | 'weak' | 'fixing' | 'solid'

export interface Topic {
  id: string
  system: string
  name: string
  status: TopicStatus
  /** True for a whole-system fix ("Cardio, overall"). */
  wholeSystem?: boolean
  /** Date it last moved weak → solid. */
  fixedOn?: ISODate
}

export interface Session {
  id: string
  date: ISODate
  kind: TaskKind
  goalId: string
  resourceId?: string
  system?: string
  topicIds?: string[]
  minutes: number
  questions?: number
  correct?: number
  /** Anki cards reviewed. */
  cards?: number
}

export type TaskKind = 'study' | 'fix' | 'retest' | 'anki'

export type FixAction =
  | 'reviewAndCards'
  | 'reviewWrong'
  | 'makeCards'
  | 'rereadSlides'
  | 'watchVideo'
  | 'readChapter'

export interface Task {
  id: string
  date: ISODate
  kind: TaskKind
  goalId: string
  resourceId?: string
  system?: string
  topicIds?: string[]
  title: string
  /** Secondary line under the title ("Timed block", "+ 20 new cards"). */
  detail?: string
  /** One short line: why this task is here. */
  reason: string
  minutes: number
  /** Planned questions (qbank / retest) or units (slides, chapters). */
  amount?: number
  status: 'pending' | 'done'
  /** For fixes and retests: the day of the block that triggered them. */
  sourceDate?: ISODate
  fixAction?: FixAction
}

export interface StudentPlan {
  goals: Goal[]
  resources: Resource[]
  anki?: AnkiDeck
  availability: Availability
  rotation?: Rotation
}

/** Everything the engine needs to plan a day. */
export interface EngineState extends StudentPlan {
  topics: Topic[]
  sessions: Session[]
  /** Fix and retest tasks, each pinned to a date. */
  scheduled: Task[]
}
