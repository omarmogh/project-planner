// Lina: 5th year at Mutah, IM rotation, IM exam in 12 days, Step 1 in 58 days.
// The demo always opens on DEMO_TODAY (a Sunday after a rough Saturday), whatever the real date.
// Dates are still built relative to "today", so linaState works on any date in tests.

import { QBANK_MINUTES_PER_QUESTION, addDays, reasons, retestTask, fixTask } from '../engine'
import type { EngineState, ISODate, Session, Task, TaskOutcome, Topic } from '../engine'
import { buildPlanState, type Answers } from './setup'
import { SYSTEM_IDS, topicId } from './topics'

/** Lina's pinned day: Sunday 15 Nov 2026. Yesterday went badly, so Today offers a light day. Real users use the real date. */
export const DEMO_TODAY: ISODate = '2026-11-15'

export function linaAnswers(today: ISODate): Answers {
  return {
    stage: 'clinical',
    university: { name: 'Mutah University', country: 'JO' },
    goals: ['uni', 'step1'],
    dates: { step1: { kind: 'date', date: addDays(today, 58) } },
    rotation: {
      // The IM exam is 12 days out, before the rotation ends.
      subjects: [{ key: 'im', name: 'IM', examAtEnd: false, examDate: addDays(today, 12), lecturesLeft: 5 }],
      end: { date: addDays(today, 18) },
    },
    resources: ['uworld', 'bnb', 'firstaid', 'anki'],
    uworldDone: 2150,
    uworldImport: [],
    ankiNewLeft: 1150,
    lecturesLeft: null,
    ankiReviewMinutes: 30,
    // Late in her prep: everything but Cardio studied once; Cardio is where she is now.
    systemsNow: ['Cardio'],
    systemsNowUnsure: false,
    watched: [],
    systemsDone: SYSTEM_IDS.filter((x) => x !== 'Cardio'),
    systemsDoneNone: false,
    weekdayHours: 3,
    weekendHours: 5,
    weekendDays: [5, 6],
  }
}

// [days ago, system, questions, correct]
const BLOCKS: [number, string, number, number][] = [
  // Week before last
  [14, 'Renal', 20, 11], [13, 'Cardio', 20, 10], [12, 'Resp', 20, 12], [11, 'Renal', 20, 12],
  [10, 'GI', 20, 12], [9, 'Neuro', 20, 11], [8, 'Endo', 20, 13],
  // Last 7 days: 180 questions
  [7, 'Cardio', 20, 10], [7, 'GI', 20, 12], [6, 'Renal', 25, 18], [5, 'Resp', 20, 13], [5, 'Neuro', 20, 11],
  [4, 'GI', 20, 12], [4, 'Endo', 15, 10], [3, 'Renal', 20, 14], [2, 'Cardio', 20, 11],
]

// [system, topic, status, fixed days ago]
const TOPIC_STATE: [string, string, Topic['status'], number?][] = [
  ['Renal', 'Electrolytes', 'solid', 2],
  ['Resp', 'Asthma & COPD', 'solid', 5],
  ['Endo', 'Thyroid', 'solid', 9],
  ['Neuro', 'Stroke', 'solid', 12],
  ['GI', 'Liver disease', 'solid', 16],
  ['Cardio', 'Ischemic heart disease', 'solid', 20],
  ['Endo', 'Diabetes', 'solid', 25],
  ['Renal', 'Acid–base', 'fixing'],
  ['Renal', 'Glomerular disease', 'weak'],
  ['Cardio', 'Arrhythmias', 'fixing'],
]

function seedSessions(today: ISODate): Session[] {
  const out: Session[] = []
  BLOCKS.forEach(([ago, system, questions, correct], i) => {
    out.push({
      id: `seed-q${i}`, date: addDays(today, -ago), kind: 'study', goalId: 'step1', resourceId: 'uworld',
      system, minutes: questions * QBANK_MINUTES_PER_QUESTION, questions, correct,
    })
  })
  for (let ago = 1; ago <= 14; ago++) {
    out.push({ id: `seed-a${ago}`, date: addDays(today, -ago), kind: 'anki', goalId: 'step1', minutes: 30, cards: 180 + ((ago * 37) % 60) })
  }
  for (const ago of [2, 3, 4, 5, 6, 9, 10, 12]) {
    out.push({ id: `seed-s${ago}`, date: addDays(today, -ago), kind: 'study', goalId: 'uni-im', resourceId: 'slides-im', minutes: 30 })
  }
  return out
}

/** Cardio so far: the first 6 topics covered; Heart sounds & murmurs has only its questions left. */
const CARDIO_COVERED = 6
const CARDIO_IN_PROGRESS = 'Heart sounds & murmurs'

export function linaState(today: ISODate): EngineState {
  const base = buildPlanState(linaAnswers(today), today)
  const resources = base.resources.map((r) =>
    r.id === 'uworld' ? { ...r, startedOn: addDays(today, -91) }
      : r.id === 'slides-im' ? { ...r, startedOn: addDays(today, -21) }
        : r,
  )

  const cardio = base.topics.filter((t) => t.system === 'Cardio')
  const topics = base.topics.map((t) => {
    const n = t.items?.length ?? 0
    const i = cardio.indexOf(t)
    if (i >= 0 && i < CARDIO_COVERED) t = { ...t, doneItems: n }
    if (t.system === 'Cardio' && t.name === CARDIO_IN_PROGRESS) t = { ...t, doneItems: n - 1 }
    const s = TOPIC_STATE.find(([sys, name]) => topicId(sys, name) === t.id)
    if (!s) return t
    return { ...t, status: s[2], fixedOn: s[3] !== undefined ? addDays(today, -s[3]) : undefined }
  })
  const byId = (sys: string, name: string) => topics.find((t) => t.id === topicId(sys, name))!

  const glomerular = byId('Renal', 'Glomerular disease')
  const thursday = addDays(today, -3)
  const scheduled: Task[] = [
    fixTask('seed-fix-glom', today, 'step1', 'Renal', [glomerular],
      { action: 'reviewAndCards', title: 'Review your wrong glomerular disease answers and make 5 Anki cards', minutes: 20 },
      reasons.fromBlock('Renal', thursday, today), thursday),
    retestTask('seed-retest-glom', addDays(today, 3), 'step1', 'Renal', [glomerular], thursday),
    retestTask('seed-retest-acid', today, 'step1', 'Renal', [byId('Renal', 'Acid–base')], addDays(today, -5)),
    retestTask('seed-retest-arr', addDays(today, 3), 'step1', 'Cardio', [byId('Cardio', 'Arrhythmias')], addDays(today, -4)),
  ]

  // Yesterday: one task skipped, one only partly done → a rough patch.
  const yesterday = addDays(today, -1)
  const outcomes: TaskOutcome[] = [
    { date: yesterday, taskId: `${yesterday}-topic-seed`, result: 'partly' },
    { date: yesterday, taskId: `${yesterday}-slides-im`, result: 'skipped' },
  ]

  return { ...base, resources, topics, sessions: seedSessions(today), scheduled, outcomes, lightOffers: [] }
}
