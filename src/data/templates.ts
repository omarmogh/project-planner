// Internal templates. Students never see the word "template": their onboarding
// answers pick these defaults. Every made-up number is marked
// "TODO(placeholder)": search for it and replace with real values from classmates.

import { QBANK_MINUTES_PER_QUESTION, type GoalKind, type ResourceType } from '../engine'

export type Stage = 'basic' | 'clinical' | 'graduated'

export const STAGES: { id: Stage; label: string; hint: string }[] = [
  { id: 'basic', label: 'Basic sciences', hint: 'Years 1–3' },
  { id: 'clinical', label: 'Clinical', hint: 'Years 4–6' },
  { id: 'graduated', label: 'Graduated', hint: 'Intern or after' },
]

export interface UniversityTemplate {
  id: string
  name: string
  /** typical rotation length, sets the "until when?" default. */
  rotationWeeks: number
  /** lectures in a typical clinical block. */
  lecturesPerBlock: number
  /** days from now to the next block exam, as a default. */
  blockExamInDays: number
}

// TODO(placeholder): rotationWeeks, lecturesPerBlock and blockExamInDays for every university below.
export const UNIVERSITIES: UniversityTemplate[] = [
  { id: 'mutah', name: 'Mutah', rotationWeeks: 6, lecturesPerBlock: 18, blockExamInDays: 12 },
  { id: 'just', name: 'JUST', rotationWeeks: 8, lecturesPerBlock: 20, blockExamInDays: 14 },
  { id: 'uj', name: 'UJ', rotationWeeks: 8, lecturesPerBlock: 20, blockExamInDays: 14 },
  { id: 'hu', name: 'Hashemite', rotationWeeks: 6, lecturesPerBlock: 18, blockExamInDays: 14 },
  { id: 'yu', name: 'Yarmouk', rotationWeeks: 6, lecturesPerBlock: 18, blockExamInDays: 14 },
  { id: 'bau', name: 'Balqa', rotationWeeks: 6, lecturesPerBlock: 18, blockExamInDays: 14 },
  { id: 'other', name: 'Other', rotationWeeks: 6, lecturesPerBlock: 18, blockExamInDays: 14 },
]

export interface GoalTemplate {
  kind: GoalKind
  label: string
  /** Default exam date offset in days. */
  defaultInDays: number
}

// TODO(placeholder): defaultInDays for each exam (only a starting value for the date picker).
export const GOALS: GoalTemplate[] = [
  { kind: 'uni', label: 'Uni exams', defaultInDays: 14 },
  { kind: 'step1', label: 'Step 1', defaultInDays: 90 },
  { kind: 'step2', label: 'Step 2 CK', defaultInDays: 120 },
  { kind: 'plab', label: 'PLAB', defaultInDays: 120 },
  { kind: 'smle', label: 'SMLE', defaultInDays: 120 },
  { kind: 'board', label: 'Jordanian board', defaultInDays: 120 },
]

export interface RotationTemplate {
  id: string
  name: string
  /** Used in the uni goal label: "IM exam". */
  short: string
}

export const ROTATIONS: RotationTemplate[] = [
  { id: 'im', name: 'Internal medicine', short: 'IM' },
  { id: 'surgery', name: 'Surgery', short: 'Surgery' },
  { id: 'peds', name: 'Pediatrics', short: 'Peds' },
  { id: 'obgyn', name: 'OB-GYN', short: 'OB-GYN' },
  { id: 'psych', name: 'Psychiatry', short: 'Psych' },
  { id: 'other', name: 'Other', short: 'Rotation' },
]

export type ResourceKey = 'uworld' | 'amboss' | 'anki' | 'bnb' | 'pathoma' | 'firstaid' | 'slides'

/** How the onboarding asks for progress on a resource. */
export type AmountInput =
  | { kind: 'done-of'; label: string; step: number } // "UWorld questions done" of total
  | { kind: 'percent'; label: string } // "How far into B&B?"
  | { kind: 'left'; label: string; max: number; step: number } // "Anki new cards left"
  | { kind: 'done-total'; label: string } // "Slides: lectures done / total"

export interface ResourceTemplate {
  key: ResourceKey
  name: string
  type: ResourceType
  unit: [string, string]
  minutesPerUnit: number
  /** Totals. Per goal where they differ. */
  total: number | Partial<Record<GoalKind, number>>
  input: AmountInput
  /** Default progress answer (units done, %, or cards left). */
  defaultAmount: number
}

export const RESOURCES: ResourceTemplate[] = [
  {
    key: 'uworld', name: 'UWorld', type: 'qbank', unit: ['question', 'questions'], minutesPerUnit: QBANK_MINUTES_PER_QUESTION,
    // TODO(placeholder): UWorld totals per exam.
    total: { step1: 3600, step2: 3800, uni: 3600 }, input: { kind: 'done-of', label: 'UWorld questions done', step: 50 }, defaultAmount: 0,
  },
  {
    key: 'amboss', name: 'AMBOSS', type: 'qbank', unit: ['question', 'questions'], minutesPerUnit: QBANK_MINUTES_PER_QUESTION,
    // TODO(placeholder): AMBOSS total.
    total: 2800, input: { kind: 'done-of', label: 'AMBOSS questions done', step: 50 }, defaultAmount: 0,
  },
  {
    key: 'anki', name: 'Anki', type: 'anki', unit: ['card', 'cards'], minutesPerUnit: 0,
    // TODO(placeholder): default new cards left (3000).
    total: 0, input: { kind: 'left', label: 'Anki new cards left', max: 30000, step: 50 }, defaultAmount: 3000,
  },
  {
    // TODO(placeholder): B&B video count (400) and minutes per video (15).
    key: 'bnb', name: 'B&B', type: 'video', unit: ['video', 'videos'], minutesPerUnit: 15,
    total: 400, input: { kind: 'percent', label: 'How far into B&B?' }, defaultAmount: 0,
  },
  {
    // TODO(placeholder): minutes per Pathoma chapter (45).
    key: 'pathoma', name: 'Pathoma', type: 'reading', unit: ['chapter', 'chapters'], minutesPerUnit: 45,
    total: 19, input: { kind: 'done-of', label: 'Pathoma chapters done', step: 1 }, defaultAmount: 0,
  },
  {
    // TODO(placeholder): First Aid page count (800) and minutes per page (3).
    key: 'firstaid', name: 'First Aid', type: 'reading', unit: ['page', 'pages'], minutesPerUnit: 3,
    total: 800, input: { kind: 'percent', label: 'How far into First Aid?' }, defaultAmount: 0,
  },
  {
    // TODO(placeholder): minutes per lecture of slides (30) and lectures per block (18).
    key: 'slides', name: 'Uni slides', type: 'slides', unit: ['lecture', 'lectures'], minutesPerUnit: 30,
    total: 18, input: { kind: 'done-total', label: 'Slides: lectures done' }, defaultAmount: 0,
  },
]

// TODO(placeholder): review-time choices offered in onboarding.
export const ANKI_REVIEW_CHOICES = [15, 30, 45, 60]

export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
/** Onboarding default only (Jordan: Fri + Sat). The student can change it; the engine never assumes it. */
export const DEFAULT_WEEKEND_DAYS = [5, 6]

/** Topics per system for the "anything feel weak?" chips (5–8 each). */
// TODO(placeholder): check the topic list per system with classmates.
export const TOPIC_CATALOG: Record<string, string[]> = {
  Cardio: ['Heart failure', 'Arrhythmias', 'Ischemic heart disease', 'Valvular disease', 'Hypertension', 'Cardiomyopathies', 'Pericardial disease'],
  Renal: ['Acid–base', 'Glomerular disease', 'Electrolytes', 'AKI & CKD', 'Diuretics', 'Kidney stones'],
  Resp: ['Asthma & COPD', 'Pneumonia', 'PE & DVT', 'Lung cancer', 'Interstitial lung disease', 'Pleural effusion'],
  GI: ['Liver disease', 'IBD', 'GI bleeding', 'Pancreatitis', 'Esophagus & stomach', 'Colorectal cancer'],
  Neuro: ['Stroke', 'Seizures', 'Headache', 'Movement disorders', 'Multiple sclerosis', 'Neuropathies'],
  Endo: ['Diabetes', 'Thyroid', 'Adrenal', 'Pituitary', 'Calcium & bone', 'MEN syndromes'],
}

export function topicId(system: string, name: string): string {
  return `${system}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}
