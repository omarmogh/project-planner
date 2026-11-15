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
  /**
   * Uni goals: days before the exam in which board goals shrink to Anki only.
   * Set at setup from the university template and the rotation's length (spec 5.2).
   */
  windDownDays?: number
  /** Extra sittings of the same exam with their own date (OSCE, viva). They get the exam-day protocol only. */
  parts?: ExamPart[]
}

export interface ExamPart {
  /** "OSCE", "Viva". */
  label: string
  date: ISODate
}

/** A firm date gets the exam protocol, the wind-down and rescue mode. Rough and projected dates never do. */
export function isFirm(g: Pick<Goal, 'dateSource'>): boolean {
  return g.dateSource === 'set' || g.dateSource === 'assumed'
}

/** 'papers' = past papers / practice papers in the exam's format. */
export type ResourceType = 'qbank' | 'slides' | 'papers'

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
  /** Qbank, after "narrow the scope": questions left out (the best-accuracy systems' share). */
  skipUnits?: number
  /** Slides, after "narrow the scope": the remaining lectures are studied from summaries (shorter). */
  fromSummary?: boolean
  /** Papers: the day prep for this exam started, so the papers window can be placed (spec 4.2). */
  prepFrom?: ISODate
  /** Papers: share of the prep time the papers are spread over (from the template and the amount of material). */
  windowShare?: number
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
  /** 0 = Sunday … 6 = Saturday. From the student's country (Jordan: Friday + Saturday); they can change it. */
  weekendDays: number[]
  /** Extra minutes a day the student agreed to in rescue mode, up to and including `until`. */
  extra?: { minutes: number; until: ISODate }
}

export interface Rotation {
  name: string
  /** "IM", used in short labels. */
  short: string
  until: ISODate
  /** Board systems that match this rotation (from the university template): suggested first. */
  systems?: string[]
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
  /** Minutes already spent on the next item (after a "Partly", or an item split over days). */
  partialMin?: number
  /** The day the last item was finished. A finished topic doesn't return as new study for TOPIC_REPEAT_DAYS. */
  coveredOn?: ISODate
  /** Days this topic had a study task so far ("part 2", "part 3"). */
  parts?: number
  /** Rescue, stage 1: only the topic's questions are planned. */
  questionsOnly?: boolean
  /** Rescue, stage 2–3: left out of the plan. */
  dropped?: boolean
  /** Retests failed in a row. Drives the next fix's action and the pause after MAX_RETEST_FAILS. */
  fails?: number
  /** The action of the last fix, so a failed retest gets a different one. */
  lastFix?: FixAction
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
  /** Seeded from a pasted / typed UWorld report, not a block done in Locus. Counts for accuracy only. */
  imported?: boolean
  /** Deadline work. Never tunes time estimates. */
  commitmentId?: string
}

/** The one completion question after a task. */
export type Completion = 'done' | 'partly' | 'skipped'

/** 'review' = the light review on the day before an exam. */
export type TaskKind = 'study' | 'fix' | 'retest' | 'anki' | 'review'

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
  /** Retests: the fix that must be done first. The retest is due RETEST_AFTER_FIX_DAYS after it. */
  fixId?: string
  /** Topic tasks: "part 2", "part 3" of an unfinished topic, and how far it is ("3 of 7 steps done"). */
  part?: number
  progress?: string
  /** Topic tasks that take only part of one long item: the minutes credited when done. */
  partialMinutes?: number
  /** Added by "Do more": outside the day's cap by the student's choice. */
  extra?: boolean
  /** Deadline work: the commitment this chunk belongs to. Shows the commitment's tag, not a goal. */
  commitmentId?: string
  tag?: CommitmentTag
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

/** How each finished or unfinished task went, skipped ones included. Drives the light-day offer. */
export interface TaskOutcome {
  date: ISODate
  taskId: string
  result: Completion
}

/** 'light' ≈ 20 min, 'essentials' = top tasks near an exam, 'firstOnly' = after the weekly limit. */
export type LightOfferKind = 'light' | 'essentials' | 'firstOnly'

export interface LightOffer {
  date: ISODate
  kind: LightOfferKind
  /** What the student chose; undefined until they answer. */
  answer?: 'light' | 'rest' | 'full'
}

export type RescueChoice = 'move' | 'narrow' | 'time'

/** A rescue offer and what the student chose (spec 9). */
export interface RescueRecord {
  goalId: string
  date: ISODate
  choice?: RescueChoice
}

/** Everything the engine needs to plan a day. */
export interface EngineState extends StudentPlan {
  topics: Topic[]
  sessions: Session[]
  /** Fix and retest tasks, each pinned to a date. */
  scheduled: Task[]
  outcomes?: TaskOutcome[]
  lightOffers?: LightOffer[]
  /** Things the student has to do. They only take time from the plan; see commitments.ts. */
  commitments?: Commitment[]
  /** Board topics rated "Had it" in a recall sweep; see confidence.ts. */
  confident?: Confident[]
  rescues?: RescueRecord[]
  /** Days the student planned to be off (an accepted rest day). Never counted as missed. */
  daysOff?: ISODate[]
  /** "What's next?" after a rotation ended was answered on this day (or the student is on a break). */
  nextAsked?: ISODate
}

/**
 * Busy time: fixed time on a day ("Lecture 10–12", "Gym 6pm 1h"). Reduces that day's study time.
 * Deadline work: a seminar, presentation or assignment with an estimated length, split across the days before it.
 */
export type CommitmentKind = 'busy' | 'deadline'
export type CommitmentTag = 'uni' | 'usmle' | 'personal'

export interface Commitment {
  id: string
  kind: CommitmentKind
  /** "Seminar on DKA", "Lecture". */
  title: string
  tag: CommitmentTag
  /** Busy: the day. Deadline: the day it's due. */
  date: ISODate
  /** Busy only, 'HH:MM' (24 h). */
  from?: string
  to?: string
  /** Busy: length when there's no end time. Deadline: estimated work. */
  minutes?: number
  /** Deadline work on this topic counts as studying it (e.g. DKA → Diabetes). */
  topicId?: string
  /** Deadline work already done. */
  doneMinutes?: number
  done?: boolean
  createdOn: ISODate
}

export interface Confident {
  topicId: string
  /** The sweep day. */
  date: ISODate
  /** The "you felt sure" note was shown; it's shown once. */
  noted?: boolean
}
