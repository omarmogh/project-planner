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

// University templates live in src/data/universities/ (a global default plus one file per university).
export { UNIVERSITIES, GLOBAL_DEFAULT as UNIVERSITY_DEFAULT, templateFor, type UniversityTemplate } from './universities'

export interface GoalTemplate {
  kind: GoalKind
  label: string
}

export const GOALS: GoalTemplate[] = [
  { kind: 'uni', label: 'University' },
  { kind: 'step1', label: 'Step 1' },
  { kind: 'step2', label: 'Step 2 CK' },
]

/** "Roughly when?" for an exam that isn't booked. */
export type RoughWhen = 'early' | 'mid' | 'late' | 'next'

// TODO(placeholder): which day of the year each rough answer plans for. 'next' = "the year after or later": mid that year.
const ROUGH_MONTH_DAY: Record<RoughWhen, [number, number]> = { early: [3, 15], mid: [7, 15], late: [10, 15], next: [7, 15] }

/** The months each rough answer covers, shown under the chip so "early" means the same to everyone. */
export const ROUGH_MONTHS: Record<Exclude<RoughWhen, 'next'>, string> = { early: 'Jan–Apr', mid: 'May–Aug', late: 'Sep–Dec' }

/** "early 2027" for a rough date: never a day, since the student never gave one. */
export function roughLabel(date: ISODate): string {
  const m = toDate(date).getUTCMonth()
  return `${m < 4 ? 'early' : m < 8 ? 'mid' : 'late'} ${toDate(date).getUTCFullYear()}`
}

/** The year "early / mid / late" refers to: next year once we're past mid-year. */
export function roughYear(today: ISODate): number {
  const d = toDate(today)
  return d.getUTCMonth() >= 6 ? d.getUTCFullYear() + 1 : d.getUTCFullYear()
}

export function roughDate(when: RoughWhen, today: ISODate): ISODate {
  const [m, d] = ROUGH_MONTH_DAY[when]
  const year = roughYear(today) + (when === 'next' ? 1 : 0)
  const date = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
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

/**
 * Basic-year subjects (no rotations): a block or semester with these exams works exactly like a rotation.
 * Their weak topics are the subject itself or its lecture titles, never Step 1 systems.
 */
export const BASIC_SUBJECTS: RotationTemplate[] = [
  { id: 'anatomy', name: 'Anatomy', short: 'Anatomy' },
  { id: 'physiology', name: 'Physiology', short: 'Physiology' },
  { id: 'biochemistry', name: 'Biochemistry', short: 'Biochemistry' },
  { id: 'histology', name: 'Histology', short: 'Histology' },
  { id: 'pathology', name: 'Pathology', short: 'Pathology' },
  { id: 'pharmacology', name: 'Pharmacology', short: 'Pharmacology' },
  { id: 'microbiology', name: 'Microbiology', short: 'Microbiology' },
  { id: 'immunology', name: 'Immunology', short: 'Immunology' },
  { id: 'embryology', name: 'Embryology', short: 'Embryology' },
  { id: 'genetics', name: 'Genetics', short: 'Genetics' },
  { id: 'community', name: 'Community medicine', short: 'Community medicine' },
  { id: 'behavioral', name: 'Behavioral science', short: 'Behavioral science' },
]

/** A rotation can combine up to this many subjects (e.g. ENT + Ophthalmology), each with its own exam. */
export const MAX_ROTATION_SUBJECTS = 5

export function rotationById(id: string | undefined): RotationTemplate | undefined {
  return [...ROTATIONS, ...MINOR_ROTATIONS, ...BASIC_SUBJECTS].find((r) => r.id === id)
}

export type ResourceKey = 'uworld' | 'qbank' | 'amboss' | 'anki' | 'bnb' | 'pathoma' | 'firstaid' | 'slides'

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
  // AMBOSS Qbank, Kaplan, TrueLearn, a local bank: planned the same way, under a neutral name.
  { key: 'qbank', name: 'Question bank', label: 'Another question bank', kind: 'qbank' },
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
// TODO(placeholder): another bank's size when the student isn't sure. Only plans the work; never shown,
// never judged against a date (the resource is flagged unitsUnsure).
export const QBANK_TOTAL_UNSURE = 1500

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

// Which topics get a Pathoma step: by chapter, in src/data/resources/pathoma.ts.


export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
/**
 * Weekend before a university is picked (graduates skip that question): none chosen, so the
 * global default (Sat–Sun, src/data/weekends.ts). Picking a university replaces it with its
 * country's; the student can change it on the first day. The engine never assumes one.
 */
export const DEFAULT_WEEKEND_COUNTRY: string | undefined = undefined

/** Rotation end chips: 1, 2, 3 weeks, or "4+" (the university's usual length, at least 4). */
/** 0 = "This week": the last workday before the student's weekend. */
export const ROTATION_END_WEEKS = [0, 1, 2, 3, 4] as const
