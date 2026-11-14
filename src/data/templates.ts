// Internal templates. Students never see the word "template": their onboarding
// answers pick these defaults. Every made-up number is marked
// "TODO(placeholder)": search for it and replace with real values from classmates.

import type { GoalKind, ISODate, Material } from '../engine'
import { addDays, toDate } from '../engine'

export { topicId } from './topics'

export type Stage = 'basic' | 'clinical' | 'graduated'

export const STAGES: { id: Stage; label: string; hint: string }[] = [
  { id: 'basic', label: 'Basic sciences', hint: 'Years 1–3' },
  { id: 'clinical', label: 'Clinical', hint: 'Years 4–6' },
  { id: 'graduated', label: 'Graduated', hint: 'Intern or after' },
]

export interface UniversityTemplate {
  id: string
  /** The name in the bundled university list (src/data/universities.json). */
  name: string
  /** Short names students type ("JUST", "UJ"). Matched in search. */
  aliases: string[]
  /** Typical rotation length: "4+ weeks" plans for at least this. */
  rotationWeeks: number
  /** Days from now to the next block exam, when there's no rotation to go by. */
  blockExamInDays: number
  /** Exact rotation names, so a university's own list can replace the generic one. */
  rotations?: string[]
}

// TODO(placeholder): rotationWeeks and blockExamInDays for every university below.
// TODO(placeholder): Mutah's exact rotation names (rotations: [...]) once Omar confirms them.
export const UNIVERSITIES: UniversityTemplate[] = [
  { id: 'mutah', name: 'Mutah University', aliases: ['Mutah', 'Muta'], rotationWeeks: 6, blockExamInDays: 12 },
  { id: 'just', name: 'Jordan University of Science and Technology', aliases: ['JUST'], rotationWeeks: 8, blockExamInDays: 14 },
  { id: 'uj', name: 'University of Jordan', aliases: ['UJ', 'JU'], rotationWeeks: 8, blockExamInDays: 14 },
  { id: 'hu', name: 'Hashemite University', aliases: ['HU'], rotationWeeks: 6, blockExamInDays: 14 },
  { id: 'yu', name: 'Yarmouk University', aliases: ['YU'], rotationWeeks: 6, blockExamInDays: 14 },
  { id: 'bau', name: 'Al-Balqa Applied University', aliases: ['BAU', 'Balqa'], rotationWeeks: 6, blockExamInDays: 14 },
]

/** Any other university (or none picked). TODO(placeholder). */
export const UNIVERSITY_DEFAULT = { rotationWeeks: 6, blockExamInDays: 14 }

export interface GoalTemplate {
  kind: GoalKind
  label: string
}

export const GOALS: GoalTemplate[] = [
  { kind: 'uni', label: 'Uni exams' },
  { kind: 'step1', label: 'Step 1' },
  { kind: 'step2', label: 'Step 2 CK' },
  { kind: 'plab', label: 'PLAB' },
  { kind: 'smle', label: 'SMLE' },
  { kind: 'board', label: 'Jordanian board' },
]

/** "Roughly when?" for an exam that isn't booked. */
export type RoughWhen = 'early' | 'mid' | 'late'

// TODO(placeholder): which day of the year each rough answer plans for.
const ROUGH_MONTH_DAY: Record<RoughWhen, [number, number]> = { early: [3, 15], mid: [7, 15], late: [10, 15] }

/** The year "early / mid / late" refers to: next year once we're past mid-year. */
export function roughYear(today: ISODate): number {
  const d = toDate(today)
  return d.getUTCMonth() >= 6 ? d.getUTCFullYear() + 1 : d.getUTCFullYear()
}

export function roughDate(when: RoughWhen, today: ISODate): ISODate {
  const [m, d] = ROUGH_MONTH_DAY[when]
  const date = `${roughYear(today)}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return date > today ? date : addDays(today, 30)
}

export interface RotationTemplate {
  id: string
  name: string
  /** Used in the uni goal label ("IM exam") and slides ("IM slides"). */
  short: string
}

/** Major rotations, shown first. */
export const ROTATIONS: RotationTemplate[] = [
  { id: 'im', name: 'Internal medicine', short: 'IM' },
  { id: 'surgery', name: 'Surgery', short: 'Surgery' },
  { id: 'peds', name: 'Pediatrics', short: 'Peds' },
  { id: 'obgyn', name: 'OB-GYN', short: 'OB-GYN' },
  { id: 'psych', name: 'Psychiatry', short: 'Psych' },
]

/** Behind the "Minor rotation" chip. Short = the name used in "<short> exam". */
export const MINOR_ROTATIONS: RotationTemplate[] = [
  { id: 'fm', name: 'Family medicine', short: 'Family medicine' },
  { id: 'radiology', name: 'Radiology', short: 'Radiology' },
  { id: 'derm', name: 'Dermatology', short: 'Dermatology' },
  { id: 'ent', name: 'ENT', short: 'ENT' },
  { id: 'ophtho', name: 'Ophthalmology', short: 'Ophthalmology' },
  { id: 'ortho', name: 'Orthopedics', short: 'Orthopedics' },
  { id: 'em', name: 'Emergency', short: 'Emergency' },
  { id: 'anesthesia', name: 'Anesthesia', short: 'Anesthesia' },
  { id: 'urology', name: 'Urology', short: 'Urology' },
  { id: 'neuro', name: 'Neurology', short: 'Neurology' },
]

/** A rotation can combine up to this many subjects (e.g. ENT + Ophthalmology), each with its own exam. */
export const MAX_ROTATION_SUBJECTS = 3

export function rotationById(id: string | undefined): RotationTemplate | undefined {
  return [...ROTATIONS, ...MINOR_ROTATIONS].find((r) => r.id === id)
}

export type ResourceKey = 'uworld' | 'amboss' | 'anki' | 'bnb' | 'pathoma' | 'firstaid' | 'slides'

export interface ResourceTemplate {
  key: ResourceKey
  name: string
  /** Chip label when it differs from the name. */
  label?: string
  /** qbank = questions done; anki = cards left; slides = lectures left; material = studied by topic, no numbers asked. */
  kind: 'qbank' | 'anki' | 'slides' | 'material'
  material?: Material
}

export const RESOURCES: ResourceTemplate[] = [
  { key: 'uworld', name: 'UWorld', kind: 'qbank' },
  { key: 'bnb', name: 'B&B', label: 'Boards & Beyond', kind: 'material', material: 'bnb' },
  { key: 'firstaid', name: 'First Aid', kind: 'material', material: 'firstaid' },
  { key: 'pathoma', name: 'Pathoma', kind: 'material', material: 'pathoma' },
  { key: 'amboss', name: 'AMBOSS', kind: 'material', material: 'amboss' },
  { key: 'anki', name: 'Anki', kind: 'anki' },
  { key: 'slides', name: 'Uni slides', kind: 'slides' },
]

// TODO(placeholder): UWorld totals per exam.
export const UWORLD_TOTAL: Partial<Record<GoalKind, number>> = { step1: 3600, step2: 3800 }
export const UWORLD_TOTAL_DEFAULT = 3600

/** "Not sure" defaults. */
export const UWORLD_DONE_UNSURE = 0
// TODO(placeholder): lectures a student still has when they're not sure.
export const LECTURES_LEFT_UNSURE = 15
// TODO(placeholder): new cards left when the student isn't sure.
export const ANKI_NEW_UNSURE = 3000

// TODO(placeholder): review-time choices offered in onboarding.
export const ANKI_REVIEW_CHOICES = [15, 30, 45, 60]
/** When no review time is picked. TODO(placeholder). */
export const ANKI_REVIEW_DEFAULT = 30

/** Pathoma covers pathology; these systems get a Pathoma step. TODO(placeholder): check against the chapters. */
export const PATHOMA_SYSTEMS = ['Pathology', 'Heme/Onc', 'Cardio', 'Resp', 'GI', 'Renal', 'Repro', 'Endo', 'Neuro', 'MSK', 'Derm']

export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
/**
 * Weekend before a university is picked (graduates skip that question): Jordan's.
 * Picking a university replaces it with its country's (src/data/weekends.ts); the
 * student can change it on the first day. The engine never assumes one.
 */
export const DEFAULT_WEEKEND_COUNTRY = 'JO'

/** Rotation end chips: 1, 2, 3 weeks, or "4+" (the university's usual length, at least 4). */
export const ROTATION_END_WEEKS = [1, 2, 3, 4] as const
