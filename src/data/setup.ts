// Onboarding answers → the student's plan. Pure; reused in Phase 1.
// Only asks what students know without checking anything; every "Not sure" has a default here.

import {
  AMBOSS_MINUTES_PER_TOPIC, BNB_MINUTES_PER_VIDEO, FIRST_AID_MINUTES_PER_SECTION, PATHOMA_MINUTES_PER_TOPIC,
  LECTURE_MINUTES, QBANK_MINUTES_PER_QUESTION, TOPIC_QUESTIONS, addDays, applyImport, papersWindowShare, projectedExamDate, setWatched, suggestNextSystem,
  windDownDaysFor, SETUP_NOTE_MIN_SHORT_MINUTES, workTime, isFirm, monthYear, readiness, addGoal, startNextRotation,
} from '../engine'
import type { EngineState, Goal, SystemResult, GoalKind, ISODate, Material, Resource, StudyItem, StudyWindow, Topic } from '../engine'
import { BNB } from './resources/bnb'
import { FIRST_AID } from './resources/firstaid'
import {
  ANKI_NEW_UNSURE, ANKI_REVIEW_DEFAULT, DEFAULT_WEEKEND_COUNTRY, MAX_ROTATION_SUBJECTS, MINOR_ROTATIONS, GOALS, LECTURES_LEFT_UNSURE, PATHOMA_SYSTEMS, RESOURCES,
  QBANK_TOTAL_UNSURE, UWORLD_DONE_UNSURE, UWORLD_TOTAL, UWORLD_TOTAL_DEFAULT, rotationById, roughDate,
  ROTATION_END_WEEKS, type ResourceKey, type RoughWhen, type Stage,
} from './templates'
import { SYSTEMS, TOPICS, topicId } from './topics'
import { ROTATION_SYSTEMS, templateFor, type UniversityPick, type UniversityTemplate } from './universities'
import { weekendFor } from './weekends'

/** How the student answered "when is it?". */
export type DateAnswer =
  | { kind: 'date'; date: ISODate }
  /** "Not yet" booked, "roughly when?" not answered yet. */
  | { kind: 'notYet' }
  | { kind: 'rough'; when: RoughWhen }
  /** Board: "No idea" → projected. Uni: "Don't know yet" → a usual date. */
  | { kind: 'unknown' }

/** One subject of a rotation, with its own exam. */
export interface Subject {
  /** Template id ("ent") or "custom-<slug>" for a typed one. */
  key: string
  /** "IM", "ENT", "Subsurgery". The exam is "<name> exam". */
  name: string
  /** "Exam at the end of the rotation?" Yes (default) → the rotation's end date. */
  examAtEnd: boolean
  /** Only when examAtEnd is false. Empty or "dont-know" → planned for the rotation's end, asked again later. */
  examDate?: ISODate | 'dont-know'
  /** "No exam for this rotation": no goal, no lectures, no papers. Board study gets the time. */
  noExam?: boolean
  lecturesLeft: number | 'not-sure'
  /** Past papers the student wants to do. Missing or 'not-sure' → the university template's default. */
  pastPapers?: number | 'not-sure'
  /** A part sat in person on its own day (OSCE, viva), when the student knows the date. */
  osceDate?: ISODate
  /** Optional lecture titles (or oral-exam questions), one per line, in order. Tasks name them. */
  lectureTitles?: string[]
}

/** "When does your rotation end?": 1 / 2 / 3 / 4+ weeks, or a picked date ('' until picked). */
export type RotationEnd = { weeks: (typeof ROTATION_END_WEEKS)[number] } | { date: ISODate | '' }

/** A rotation: one or more subjects (ENT + Ophthalmology), one end. */
export interface RotationAnswer {
  subjects: Subject[]
  /** undefined = not answered yet. */
  end?: RotationEnd
}

export interface Answers {
  stage: Stage
  /** From the search (or typed, with a country). null = not answered / graduated. */
  university: UniversityPick | null
  goals: GoalKind[]
  dates: Partial<Record<GoalKind, DateAnswer>>
  rotation: RotationAnswer
  resources: ResourceKey[]
  /** null = "Not sure". Questions done in the question bank (UWorld or another). */
  uworldDone: number | null
  /** Another question bank only: how many questions it has. null = "Not sure" → the UWorld size. */
  qbankTotal?: number | null
  /** UWorld results by system, pasted or typed (optional). Seeds accuracy and the first fix. */
  uworldImport: SystemResult[]
  ankiNewLeft: number | null
  /** null = unselected → ANKI_REVIEW_DEFAULT. */
  ankiReviewMinutes: number | null
  /** Uni slides outside a rotation (basic sciences). Rotation subjects carry their own. */
  lecturesLeft: number | null
  /** Systems studied now (1–2). */
  systemsNow: string[]
  /** "Not sure" which system: the app suggests one. */
  systemsNowUnsure: boolean
  /** B&B videos already watched in the systems studied now (optional). Ids, e.g. "bnb-heart-failure-basics". */
  watched: string[]
  /** Systems already studied at least once. */
  systemsDone: string[]
  /** "None yet". */
  systemsDoneNone: boolean
  weekdayHours: number
  weekendHours: number
  /** "When do you usually study?" One tap; missing or 'not-sure' → 'evening' (the timer refines it: learnStudyWindow). */
  studyWindow?: StudyWindow | 'not-sure'
  /** 0 = Sunday … 6 = Saturday. Never asked: set from the university's country, changeable on the first day. */
  weekendDays: number[]
}

/** `region`: the device's country, for the weekend until a university sets it (graduates never pick one). */
export function defaultAnswers(region?: string): Answers {
  return {
    stage: 'clinical',
    university: null,
    goals: [],
    dates: {},
    rotation: { subjects: [] },
    resources: [],
    uworldDone: null,
    uworldImport: [],
    ankiNewLeft: null,
    ankiReviewMinutes: 30,
    lecturesLeft: null,
    systemsNow: [],
    systemsNowUnsure: true,
    watched: [],
    systemsDone: [],
    systemsDoneNone: true,
    weekdayHours: 2,
    weekendHours: 4,
    weekendDays: weekendFor(region || DEFAULT_WEEKEND_COUNTRY),
  }
}

/** Usual rotation length and block-exam timing for a university (known ones by name, the rest a default). */
export function university(u: UniversityPick | null): UniversityTemplate {
  return templateFor(u?.name)
}

/** A subject is a major rotation at this university, or a minor (typed ones count as minor). */
export function isMajor(tpl: UniversityTemplate, subjectKey: string): boolean {
  return tpl.rotation.majors.includes(subjectKey)
}

/** The usual length of this subject's rotation, from the template. */
export function subjectWeeks(tpl: UniversityTemplate, subjectKey: string): number {
  return isMajor(tpl, subjectKey) ? tpl.rotation.majorWeeks : tpl.rotation.minorWeeks
}

/** Picking a university also sets the weekend from its country. */
export function pickUniversity(u: UniversityPick): Pick<Answers, 'university' | 'weekendDays'> {
  return { university: u, weekendDays: weekendFor(u.country) }
}

/** Which goals make sense for this stage. */
export function goalChoices(stage: Stage) {
  return GOALS.filter((g) => !(stage === 'graduated' && g.kind === 'uni'))
}

/** A subject from a template chip, or one the student typed. */
export function subjectFor(key: string, typed?: string): Subject {
  const name = rotationById(key)?.short ?? typed?.trim() ?? key
  return { key, name, examAtEnd: true, lecturesLeft: 'not-sure' }
}

export function customSubject(name: string): Subject {
  const clean = name.trim().slice(0, 30)
  return subjectFor(`custom-${clean.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, clean)
}

/** Tap a rotation chip: selected → unselected; otherwise added, up to MAX_ROTATION_SUBJECTS. */
export function toggleSubject(r: RotationAnswer, key: string): RotationAnswer {
  if (r.subjects.some((x) => x.key === key)) return { ...r, subjects: r.subjects.filter((x) => x.key !== key) }
  if (r.subjects.length >= MAX_ROTATION_SUBJECTS) return r
  return { ...r, subjects: [...r.subjects, subjectFor(key)] }
}

/** "Type your own": adds a custom subject (no duplicates, same cap). */
export function addCustomSubject(r: RotationAnswer, name: string): RotationAnswer {
  const sub = customSubject(name)
  if (!name.trim() || r.subjects.some((x) => x.key === sub.key) || r.subjects.length >= MAX_ROTATION_SUBJECTS) return r
  return { ...r, subjects: [...r.subjects, sub] }
}

/** Closing "Minor rotation" or "Type your own" clears what was picked inside it. */
export function dropSubjects(r: RotationAnswer, which: 'minor' | 'custom'): RotationAnswer {
  const minor = (k: string) => MINOR_ROTATIONS.some((m) => m.id === k)
  return { ...r, subjects: r.subjects.filter((x) => (which === 'minor' ? !minor(x.key) : !x.key.startsWith('custom-'))) }
}

/** "ENT exam", "Subsurgery exam". Never "Rotation exam". */
export function subjectLabel(sub: Pick<Subject, 'name'>): string {
  return `${sub.name} exam`
}

/** "IM", "ENT + Ophthalmology". */
export function rotationName(r: RotationAnswer): string {
  return r.subjects.map((x) => x.name).join(' + ')
}

/** Questions in the student's bank: UWorld's size for the exam, or what they said for another bank. */
export function bankSize(a: Pick<Answers, 'goals' | 'resources' | 'qbankTotal'>): number {
  if (!a.resources.includes('uworld') && a.qbankTotal) return a.qbankTotal
  // "Not sure" on another bank: a modest stand-in, flagged unsure (never UWorld's size, never shown).
  if (bankSizeUnsure(a)) return QBANK_TOTAL_UNSURE
  const board = a.goals.find((g) => g !== 'uni')
  return (board && UWORLD_TOTAL[board]) ?? UWORLD_TOTAL_DEFAULT
}

/** Another question bank whose size the student didn't know: the bank's total is a stand-in. Show "Not sure", not a number. */
export function bankSizeUnsure(a: Pick<Answers, 'resources' | 'qbankTotal'>): boolean {
  return !a.resources.includes('uworld') && a.resources.includes('qbank') && !a.qbankTotal
}

/** UWorld, or another question bank. */
export function hasQbank(resources: ResourceKey[]): boolean {
  return resources.includes('uworld') || resources.includes('qbank')
}

/** The name in task titles: "UWorld: 20 Cardio questions", or "QBank: …" for any other bank. */
export function qbankName(resources: ResourceKey[]): string {
  return resources.includes('uworld') ? 'UWorld' : 'QBank'
}

/** Rotation subjects become their own uni goals; otherwise one "University exam". */
export function usesSubjects(a: Pick<Answers, 'stage' | 'goals' | 'rotation'>): boolean {
  // Any stage: a basic-year block or semester with subjects works the same as a rotation.
  return a.stage !== 'graduated' && a.goals.includes('uni') && a.rotation.subjects.length > 0
}

export function goalLabel(kind: GoalKind): string {
  return kind === 'uni' ? 'University exam' : GOALS.find((g) => g.kind === kind)!.label
}

/** Weeks a chip stands for: "4+" = the university's usual length, at least 4. */
export function endWeeks(weeks: number, u: UniversityPick | null): number {
  return weeks >= 4 ? Math.max(4, university(u).rotation.majorWeeks) : weeks
}

export function rotationEnd(a: Pick<Answers, 'rotation' | 'university'>, today: ISODate): ISODate {
  const end = a.rotation.end
  if (end && 'date' in end && end.date) return end.date
  const weeks = end && 'weeks' in end ? endWeeks(end.weeks, a.university) : university(a.university).rotation.majorWeeks
  return addDays(today, weeks * 7)
}

/** The rotation question is answered: a chip, or a picked date that isn't in the past. */
export function rotationEndAnswered(end: RotationEnd | undefined, today: ISODate): boolean {
  return !!end && ('weeks' in end || (!!end.date && end.date >= today))
}

/** A subject's exam date: the rotation's end, a date the student gave, or (not known yet) the end, assumed. */
export function subjectExam(sub: Subject, rotationUntil: ISODate): { date: ISODate; source: 'set' | 'assumed' } {
  if (sub.examAtEnd) return { date: rotationUntil, source: 'set' }
  if (sub.examDate && sub.examDate !== 'dont-know') return { date: sub.examDate, source: 'set' }
  return { date: rotationUntil, source: 'assumed' }
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
  return !!boardGoal(a.goals) && (selectedMaterials(a.resources).length > 0 || hasQbank(a.resources))
}

/** How a topic is studied with this student's resources: watch → read → questions. */
export function topicItems(system: string, name: string, materials: Material[], qbankName?: string): StudyItem[] {
  const id = topicId(system, name)
  const items: StudyItem[] = []
  if (materials.includes('bnb')) {
    for (const v of BNB.filter((x) => x.topicIds.includes(id))) items.push({ id: v.id, source: 'bnb', title: v.title, minutes: BNB_MINUTES_PER_VIDEO })
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
export function allTopics(a?: Pick<Answers, 'resources' | 'systemsDone' | 'systemsDoneNone' | 'goals'>): Topic[] {
  const byTopic = a ? plansByTopic(a) : false
  const materials = a ? selectedMaterials(a.resources) : []
  const qbank = a && hasQbank(a.resources) ? qbankName(a.resources) : undefined
  return SYSTEMS.flatMap(({ id: system }) =>
    TOPICS[system].map((name) => {
      const items = byTopic ? topicItems(system, name, materials, qbank) : []
      const done = !!a && !a.systemsDoneNone && a.systemsDone.includes(system)
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

const slug = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, '-')

export function buildPlanState(a: Answers, today: ISODate): EngineState {
  const board = boardGoal(a.goals)
  const rotationUntil = a.stage !== 'graduated' && a.rotation.subjects.length ? rotationEnd(a, today) : undefined
  // Placeholder for "No idea" until the projection below.
  const far = addDays(today, 730)
  const subjects = usesSubjects(a) ? a.rotation.subjects : []
  const tpl = university(a.university)

  const goals: Goal[] = []
  const resources: Resource[] = []
  for (const kind of a.goals) {
    if (kind === 'uni' && subjects.length) {
      // One goal per subject, each with its own exam and lectures.
      for (const sub of subjects) {
        if (sub.noExam) continue
        const e = subjectGoal(sub, rotationUntil!, a.university, today)
        goals.push(e.goal)
        resources.push(...e.resources)
      }
      continue
    }
    const answer = a.dates[kind] ?? { kind: 'unknown' }
    const base = { id: kind, kind, label: goalLabel(kind) }
    if (answer.kind === 'date') goals.push({ ...base, examDate: answer.date, dateSource: 'set' })
    else if (answer.kind === 'rough') goals.push({ ...base, examDate: roughDate(answer.when, today), dateSource: 'rough' })
    else if (kind === 'uni') goals.push({ ...base, examDate: addDays(today, tpl.blockExamInDays), dateSource: 'assumed' })
    else goals.push({ ...base, examDate: far, dateSource: 'projected' })
    if (kind === 'uni') goals[goals.length - 1].windDownDays = tpl.windDown.maxDays
    if (kind === 'uni' && a.resources.includes('slides')) {
      const lectures = a.lecturesLeft ?? LECTURES_LEFT_UNSURE
      resources.push(slidesFor('slides', 'uni', 'Uni', lectures, a.lecturesLeft == null))
      resources.push(papersFor('papers', 'uni', 'Uni', undefined, lectures, tpl, today))
    }
  }

  const uni = goals.find((g) => g.kind === 'uni')
  const boardG = goals.find((g) => g.kind === board)
  if (hasQbank(a.resources) && (boardG ?? uni)) {
    const goal = boardG ?? uni!
    const total = bankSize(a)
    resources.unshift({
      // One question bank per student; the id stays 'uworld' so saved plans and imports keep working.
      id: 'uworld', goalId: goal.id, type: 'qbank', name: qbankName(a.resources), totalUnits: total,
      doneUnits: Math.min(total, a.uworldDone ?? UWORLD_DONE_UNSURE),
      unit: ['question', 'questions'], minutesPerUnit: QBANK_MINUTES_PER_QUESTION,
      // Size or progress was "Not sure": what's left is a stand-in, so pace never judges it.
      ...(bankSizeUnsure(a) || a.uworldDone == null ? { unitsUnsure: true } : {}),
    })
  }

  const ankiGoal = boardG ?? uni
  const anki = a.resources.includes('anki') && ankiGoal
    ? { goalId: ankiGoal.id, name: 'Anki', newCardsLeft: a.ankiNewLeft ?? ANKI_NEW_UNSURE, ...(a.ankiNewLeft == null ? { newCardsUnsure: true } : {}), reviewMinutes: a.ankiReviewMinutes ?? ANKI_REVIEW_DEFAULT }
    : undefined

  const topics = allTopics(a)
  const byTopic = plansByTopic(a) && !!boardG
  const rotName = rotationName(a.rotation)
  let state: EngineState = {
    goals,
    resources,
    materials: selectedMaterials(a.resources),
    anki,
    availability: {
      weekdayMinutes: Math.round(a.weekdayHours * 60),
      weekendMinutes: Math.round(a.weekendHours * 60),
      weekendDays: [...a.weekendDays],
      ...(a.studyWindow && a.studyWindow !== 'not-sure' ? { studyWindow: a.studyWindow } : {}),
    },
    rotation: rotationUntil && rotName
      ? { name: rotName, short: rotName, until: rotationUntil, systems: [...new Set(a.rotation.subjects.flatMap((x) => ROTATION_SYSTEMS[x.key] ?? []))] }
      : undefined,
    topicGoalId: byTopic ? boardG!.id : undefined,
    focus: [],
    topics,
    sessions: [],
    scheduled: [],
  }

  // Imported results first, so the suggested system and today's plan already use them.
  if (a.uworldImport.length) state = applyImport(state, a.uworldImport, today)

  if (byTopic) {
    const now = a.systemsNowUnsure ? [] : a.systemsNow.filter((x) => !a.systemsDone.includes(x)).slice(0, 2)
    const next = now.length ? now : [suggestNextSystem(state, today)].filter((x): x is string => !!x)
    state.focus = next
    // Ticked videos count only for the systems studied now.
    const ids = a.watched.filter((id) => BNB.some((v) => v.id === id && now.includes(v.system)))
    if (ids.length) state.topics = setWatched(state.topics, ids, true)
  }

  // "No idea" → the ready-by date at this pace. Shown on Pace with a way to lock it in.
  for (const g of state.goals) {
    if (g.dateSource === 'projected') g.examDate = projectedExamDate(state, g, today)
  }
  return state
}

/** Past papers for one subject: how many (the template's default when not sure) and the window they're spread over. */
function papersFor(id: string, goalId: string, name: string, count: number | 'not-sure' | undefined, lectures: number, tpl: UniversityTemplate, today: ISODate): Resource {
  const n = count === undefined || count === 'not-sure' ? tpl.pastPapers.defaultCount : count
  return {
    id, goalId, type: 'papers', name: name === 'Uni' ? 'Past papers' : `${name} past papers`,
    totalUnits: n, doneUnits: 0, unit: ['paper', 'papers'], minutesPerUnit: tpl.pastPapers.minutes,
    // An explicit "Not sure" is a default, never judged. Not asked at all = the university's usual count.
    ...(count === 'not-sure' ? { unitsUnsure: true } : {}),
    prepFrom: today, windowShare: papersWindowShare(lectures, { small: tpl.pastPapers.windowSmall, large: tpl.pastPapers.windowLarge }),
  }
}

function slidesFor(id: string, goalId: string, name: string, left: number, unsure = false): Resource {
  return {
    id, goalId, type: 'slides', name: name === 'Uni' ? 'Uni slides' : `${name} slides`,
    totalUnits: left, doneUnits: 0, unit: ['lecture', 'lectures'], minutesPerUnit: LECTURE_MINUTES, ...(unsure ? { unitsUnsure: true } : {}),
  }
}

/** A topic's videos in the "already watched" checklist. */
export interface WatchGroup {
  topicId: string
  topic: string
  videos: { id: string; title: string }[]
}

/** The B&B checklist for one system, grouped under its topics in map order. Only for the systems studied now. */
export function watchChecklist(system: string): WatchGroup[] {
  return (TOPICS[system] ?? []).flatMap((name) => {
    const id = topicId(system, name)
    const videos = BNB.filter((v) => v.topicIds.includes(id)).map((v) => ({ id: v.id, title: v.title }))
    return videos.length ? [{ topicId: id, topic: name, videos }] : []
  })
}

/** Video ids in a system's checklist. */
export function checklistIds(system: string): string[] {
  return [...new Set(watchChecklist(system).flatMap((g) => g.videos.map((v) => v.id)))]
}

/** The "already watched" checklist only makes sense with B&B and a topic plan. */
export function offersWatched(a: Pick<Answers, 'goals' | 'resources'>): boolean {
  return plansByTopic(a) && a.resources.includes('bnb')
}

/** One subject's exam: its goal (with the usual wind-down and an OSCE part) and its lectures and papers. */
export function subjectGoal(sub: Subject, until: ISODate, uni: UniversityPick | null, today: ISODate): { goal: Goal; resources: Resource[] } {
  const tpl = university(uni)
  const id = `uni-${slug(sub.key)}`
  const exam = subjectExam(sub, until)
  const goal: Goal = {
    id, kind: 'uni', label: subjectLabel(sub), examDate: exam.date, dateSource: exam.source,
    windDownDays: windDownDaysFor(subjectWeeks(tpl, sub.key), tpl.windDown),
    parts: sub.osceDate && sub.osceDate !== exam.date ? [{ label: 'OSCE', date: sub.osceDate }] : undefined,
  }
  const lectures = sub.lecturesLeft === 'not-sure' ? (isMajor(tpl, sub.key) ? tpl.lectures.unsureMajor : tpl.lectures.unsureMinor) : sub.lecturesLeft
  const slides = slidesFor(`slides-${slug(sub.key)}`, id, sub.name, lectures, sub.lecturesLeft === 'not-sure')
  if (sub.lectureTitles?.length) slides.itemNames = sub.lectureTitles.slice(0, lectures)
  return { goal, resources: [slides, papersFor(`papers-${slug(sub.key)}`, id, sub.name, sub.pastPapers, lectures, tpl, today)] }
}

/**
 * "What's next?" → a new rotation or block: its subjects become goals with their lectures and papers.
 * Nothing is reset: sessions, topics, retests and Anki stay (planEdits.startNextRotation). A subject seen
 * before gets a new goal id, so the finished exam keeps its history.
 */
export function nextRotation(state: EngineState, rotation: RotationAnswer, uni: UniversityPick | null, today: ISODate): EngineState {
  const until = rotationEnd({ rotation, university: uni }, today)
  const name = rotationName(rotation)
  return startNextRotation(state, {
    name, until,
    systems: [...new Set(rotation.subjects.flatMap((x) => ROTATION_SYSTEMS[x.key] ?? []))],
    exams: rotation.subjects.filter((x) => !x.noExam).map((sub) => subjectGoal(sub, until, uni, today)),
  }, today)
}

/** "Add an exam" mid-block: one more subject exam, everything else kept. `until` is the block's end (the exam's default date). */
export function addExam(state: EngineState, sub: Subject, until: ISODate, uni: UniversityPick | null, today: ISODate): EngineState {
  const e = subjectGoal(sub, until, uni, today)
  return addGoal(state, e.goal, e.resources, today)
}

/** "What's next?" → a break or a dedicated period: no rotation, its own daily hours. */
export function startBreak(state: EngineState, hours: { weekdayHours: number; weekendHours: number }, today: ISODate): EngineState {
  return {
    ...state,
    availability: { ...state.availability, weekdayMinutes: Math.round(hours.weekdayHours * 60), weekendMinutes: Math.round(hours.weekendHours * 60) },
    nextAsked: state.rotation?.until ?? today,
    rotation: state.rotation ? { ...state.rotation, systems: [] } : undefined,
  }
}

/**
 * One honest sentence for the "how much time" step, or null when the time is plenty.
 * A dated exam the time can't cover comes first, then Anki taking most of the day, then the ready-by month for a date that isn't set.
 */
export function timeNote(a: Answers, today: ISODate): string | null {
  if (a.goals.length === 0) return null
  const s = buildPlanState(a, today)
  const reads = s.goals.filter((g) => g.examDate > today).map((g) => readiness(s, g, today))
  const short = reads.filter((r) => r.dateKnown && r.minutesShort >= SETUP_NOTE_MIN_SHORT_MINUTES).sort((x, y) => y.minutesShort - x.minutesShort)[0]
  if (short) return `At this time, ${short.goal.label} has about ${workTime(short.minutesShort)} more work than time before it. You can add time later, or Locus will show you what to leave out.`
  const weekday = s.availability.weekdayMinutes
  if (s.anki && weekday > 0 && s.anki.reviewMinutes * 2 >= weekday) {
    const rest = Math.max(0, weekday - s.anki.reviewMinutes)
    return `Anki reviews take about ${mins(s.anki.reviewMinutes)} of your ${mins(weekday)}, so about ${mins(rest)} a day is left for everything else.`
  }
  const open = reads.find((r) => !isFirm(r.goal) && r.readyOn)
  // "No idea" next to a dated uni exam: the uni exam leads, so a ready-by month now would only move later. Say what happens instead.
  if (open && open.goal.dateSource === 'projected' && s.goals.some((g) => g.kind === 'uni' && isFirm(g) && g.examDate > today)) {
    return `Your uni exams come first. ${open.goal.label} gets a smaller share each day until you set a date.`
  }
  if (open?.readyOn) return `At this pace you'd be ready for ${open.goal.label} around ${monthYear(open.readyOn)}.`
  return null
}

const mins = (m: number) => (m < 60 ? `${m} min` : m % 60 === 0 ? `${m / 60} h` : `${Math.floor(m / 60)} h ${m % 60} min`)
