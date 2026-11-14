// Core data model for the plan engine. Everything in src/engine is pure:
// no React, no store, no Date.now(). "Today" is always passed in as an ISO date.

/** Local calendar date, 'YYYY-MM-DD'. */
export type ISODate = string

export type GoalKind = 'uni' | 'step1' | 'step2' | 'plab' | 'smle' | 'board'

/**
 * Where the exam date came from.
 * 'set'       = the student gave it (booked, or locked in from a projection);
 * 'rough'     = "roughly early / mid / late <year>";
 * 'projected' = "no idea": the engine's ready-by date, until the student locks it in;
 * 'assumed'   = uni exam not out yet: assumed at the end of the rotation.
 */
export type DateSource = 'set' | 'rough' | 'projected' | 'assumed'

export interface Goal {
  id: string
  kind: GoalKind
  /** Short label shown on tasks: "IM exam", "Step 1". */
  label: string
  examDate: ISODate
  dateSource: DateSource
}

export type ResourceType = 'qbank' | 'slides'

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
  /** From the student's answers (Jordan default: Friday + Saturday). Never hardcoded. */
  weekendDays: number[]
}

export interface Rotation {
  name: string
  /** "IM", used in short labels. */
  short: string
  until: ISODate
}

export type TopicStatus = 'unknown' | 'weak' | 'fixing' | 'solid'

/** Study material used inside topic tasks. Planned by topic, never by units. */
export type Material = 'bnb' | 'firstaid' | 'pathoma' | 'amboss'

/** One step of studying a topic: a video, a section to read, or the topic's questions. */
export interface StudyItem {
  /** Stable id for tickable items (B&B videos: "bnb-heart-failure-basics"). */
  id?: string
  source: Material | 'qbank'
  /** Video or section title. Never a number. */
  title: string
  minutes: number
  /** qbank only. */
  questions?: number
  /**
   * The student ticked it as already watched (onboarding or the system checklist).
   * Watched ≠ mastered: it only leaves the plan; status still comes from questions and retests.
   */
  watched?: boolean
}

export interface Topic {
  id: string
  system: string
  name: string
  status: TopicStatus
  /** True for a whole-system fix ("Cardio, overall"). */
  wholeSystem?: boolean
  /** Date it last moved to solid (after both retests passed). */
  fixedOn?: ISODate
  /** How this topic is studied with the student's own resources, in order. Empty = not planned by topic. */
  items?: StudyItem[]
  /** Items finished. Covered when doneItems >= items.length. */
  doneItems?: number
  /** Minutes already spent on the next item (after a "Partly"). */
  partialMin?: number
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
  /** Minutes the plan gave the task; with `minutes` this tunes future estimates. */
  planned?: number
  questions?: number
  correct?: number
  /** Anki cards reviewed. */
  cards?: number
}

/** The one completion question after a task. */
export type Completion = 'done' | 'partly' | 'skipped'

export type TaskKind = 'study' | 'fix' | 'retest' | 'anki'

export type FixAction =
  | 'reviewAndCards'
  | 'reviewWrong'
  | 'makeCards'
  | 'rereadSlides'
  | 'watchVideo'
  | 'readChapter'
  | 'readPathoma'
  | 'readAmboss'

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
  /** Planned questions (qbank / retest / a topic's questions) or lectures. */
  amount?: number
  /** pending → done, or partly / skipped (the rest is re-planned). */
  status: 'pending' | Completion
  /** Topic tasks: the topic, the steps as display lines, and which items this task covers. */
  topicId?: string
  steps?: string[]
  itemFrom?: number
  itemTo?: number
  /** For fixes and retests: the day of the block that triggered them. */
  sourceDate?: ISODate
  fixAction?: FixAction
  /** Retests: 1 = a few days after the fix, 2 = the confirming one a week later. */
  retestRound?: 1 | 2
}

export interface StudentPlan {
  goals: Goal[]
  /** Unit-counted resources only: the qbank (questions) and uni slides (lectures). */
  resources: Resource[]
  /** Topic material the student uses (B&B, First Aid…). Used by fixes; topics carry the items. */
  materials: Material[]
  anki?: AnkiDeck
  availability: Availability
  rotation?: Rotation
  /** The goal planned by topic (the board exam), if any. */
  topicGoalId?: string
  /** Systems the student is studying now (1–2). */
  focus: string[]
}

/** Everything the engine needs to plan a day. */
export interface EngineState extends StudentPlan {
  topics: Topic[]
  sessions: Session[]
  /** Fix and retest tasks, each pinned to a date. */
  scheduled: Task[]
}
