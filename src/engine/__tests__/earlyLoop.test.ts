import { describe, expect, it } from 'vitest'
import { addDays, buildDay, EARLY_BLOCK_QUESTIONS, totalMinutes, type EngineState } from '..'
import { buildPlanState, defaultAnswers, subjectFor } from '../../data/setup'

const T = '2026-11-15'
const fresh = (): EngineState => buildPlanState({
  ...defaultAnswers(),
  university: { name: 'Mutah University', country: 'JO' },
  weekendDays: [5, 6],
  stage: 'clinical',
  goals: ['uni', 'step1'],
  dates: { step1: { kind: 'date', date: addDays(T, 150) } },
  rotation: { subjects: [{ ...subjectFor('im'), lecturesLeft: 12 }], end: { date: addDays(T, 24) } },
  resources: ['uworld', 'bnb', 'firstaid', 'anki'],
  uworldDone: 0,
  ankiNewLeft: 1500,
  ankiReviewMinutes: 30,
  systemsNow: ['Cardio'],
  systemsNowUnsure: false,
  systemsDone: [],
  systemsDoneNone: true,
  weekdayHours: 2.5,
  weekendHours: 5,
}, T)

const block = (s: EngineState, date: string) => buildDay(s, date).tasks.find((t) => t.resourceId && s.resources.find((r) => r.id === t.resourceId)?.type === 'qbank')

describe('early loop: a short first question block', () => {
  it('a new QBank student gets a 10-question block on day 1, even with a uni exam leading and topics still new', () => {
    const s = fresh()
    const b = block(s, T)
    expect(b?.amount).toBeGreaterThanOrEqual(EARLY_BLOCK_QUESTIONS)
    expect(totalMinutes(buildDay(s, T).tasks)).toBeLessThanOrEqual(150)
  })

  it('stops once a block is done in Locus, or after the first study days', () => {
    const s = fresh()
    const step1 = s.goals.find((g) => g.id === s.topicGoalId)!
    const qbank = s.resources.find((r) => r.type === 'qbank')!
    const done = { ...s, sessions: [{ id: 'q1', date: T, kind: 'study' as const, goalId: step1.id, resourceId: qbank.id, minutes: 30, questions: 10, correct: 5 }] }
    expect(block(done, addDays(T, 1))).toBeUndefined()
    const studied = { ...s, sessions: [0, 1].map((i) => ({ id: `t${i}`, date: addDays(T, i), kind: 'study' as const, goalId: step1.id, minutes: 40 })) }
    expect(block(studied, addDays(T, 2))).toBeUndefined()
  })
})
