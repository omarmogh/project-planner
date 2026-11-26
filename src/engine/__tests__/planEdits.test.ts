// Plan edits without a reset (add / edit / remove an exam, the next rotation, retiring passed uni exams),
// the retest cap before an exam, unknown amounts and dates, scored uni papers and named lectures.

import { describe, expect, it } from 'vitest'
import {
  LECTURES_MAX_PER_DAY, RETEST_BEFORE_EXAM_DAYS, RETIRE_AFTER_DAYS,
  addDays, addGoal, editGoal, editResource, fitRetests, growUni, lecturesTitle, lastSitting, pooledLine, readiness, removeGoal, reportTask, retestLatest,
  retireGoals, startDay, startNextRotation, uniTopicChoices, uniTopicId, whatsNext, verdict,
  type EngineState, type Goal, type Task,
} from '..'
import { DEMO_TODAY, linaState } from '../../data/demo'
import { addExam, bankSizeUnsure, subjectFor, subjectGoal } from '../../data/setup'

const T = DEMO_TODAY
const lina = linaState(T)
const im = lina.goals.find((g) => g.id === 'uni-im')!
const step1 = lina.goals.find((g) => g.id === 'step1')!
const MUTAH = { name: 'Mutah University', country: 'JO' }

describe('adding, editing and removing an exam', () => {
  it('addGoal keeps everything and makes ids unique', () => {
    const e = subjectGoal(subjectFor('im'), addDays(T, 40), MUTAH, T)
    const s = addGoal(lina, e.goal, e.resources, T)
    const ids = s.goals.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(s.goals.length).toBe(lina.goals.length + 1)
    expect(new Set(s.resources.map((r) => r.id)).size).toBe(s.resources.length)
    expect(s.sessions).toBe(lina.sessions)
    expect(s.topics).toBe(lina.topics)
    const added = s.goals.at(-1)!
    expect(s.resources.filter((r) => r.goalId === added.id).length).toBe(e.resources.length)
  })
  it('addExam from setup adds a subject goal with its slides', () => {
    const s = addExam(lina, subjectFor('derm'), addDays(T, 20), MUTAH, T)
    const derm = s.goals.find((g) => g.id === 'uni-derm')!
    expect(derm.kind).toBe('uni')
    expect(s.resources.some((r) => r.goalId === 'uni-derm' && r.type === 'slides')).toBe(true)
  })
  it('removeGoal drops its material and pending loops; sessions and topics stay', () => {
    const s = removeGoal(lina, 'uni-im', T)
    expect(s.goals.some((g) => g.id === 'uni-im')).toBe(false)
    expect(s.resources.some((r) => r.goalId === 'uni-im' && r.type !== 'qbank')).toBe(false)
    expect(s.scheduled.some((t) => t.goalId === 'uni-im' && t.status === 'pending')).toBe(false)
    expect(s.sessions).toBe(lina.sessions)
    if (s.anki) expect(s.goals.some((g) => g.id === s.anki!.goalId)).toBe(true)
  })
  it('editGoal moves pending retests before the new date', () => {
    const retest: Task = { id: 'r1', date: addDays(T, 10), kind: 'retest', goalId: 'uni-im', title: 'Retest', reason: '', minutes: 15, status: 'pending' }
    const s = editGoal({ ...lina, scheduled: [...lina.scheduled, retest] }, 'uni-im', { examDate: addDays(T, 6), dateSource: 'set' }, T)
    expect(s.scheduled.find((t) => t.id === 'r1')!.date).toBe(addDays(T, 6 - RETEST_BEFORE_EXAM_DAYS))
  })
  it('editResource: a real count clears "Not sure" and done never passes the total', () => {
    const r = lina.resources[0]
    const s = editResource({ ...lina, resources: [{ ...r, unitsUnsure: true }, ...lina.resources.slice(1)] }, r.id, { totalUnits: 1 })
    expect(s.resources[0].unitsUnsure).toBeUndefined()
    expect(s.resources[0].doneUnits).toBeLessThanOrEqual(1)
  })
})

describe('the next rotation', () => {
  it('passed uni exams retire after their rest day; Anki and topics stay', () => {
    const day = addDays(lastSitting(im), RETIRE_AFTER_DAYS)
    const s = retireGoals(lina, day)
    expect(s.goals.some((g) => g.id === 'uni-im')).toBe(false)
    expect(s.pastGoals!.map((g) => g.id)).toContain('uni-im')
    expect(s.resources.some((r) => r.goalId === 'uni-im')).toBe(true)
    expect(retireGoals(lina, addDays(lastSitting(im), RETIRE_AFTER_DAYS - 1)).goals.some((g) => g.id === 'uni-im')).toBe(true)
    expect(startDay(lina, day).pastGoals?.some((g) => g.id === 'uni-im')).toBe(true)
  })
  it('startNextRotation adds the new exams and keeps sessions, topics and Anki', () => {
    const day = addDays(lastSitting(im), RETIRE_AFTER_DAYS)
    const e = subjectGoal(subjectFor('derm'), addDays(day, 28), MUTAH, day)
    const s = startNextRotation(lina, { name: 'Dermatology', until: addDays(day, 28), exams: [e] }, day)
    expect(s.rotation!.name).toBe('Dermatology')
    expect(s.goals.some((g) => g.id === 'uni-derm')).toBe(true)
    expect(s.sessions).toBe(lina.sessions)
    expect(s.topics).toBe(lina.topics)
    expect(s.anki?.newCardsLeft).toBe(lina.anki?.newCardsLeft)
    expect(whatsNext(s, day)).toBeNull()
  })
  it('a second exam with the same subject gets its own id', () => {
    const e = subjectGoal(subjectFor('im'), addDays(T, 60), MUTAH, T)
    const s = addGoal(lina, e.goal, e.resources, T)
    expect(s.goals.filter((g) => g.id.startsWith('uni-im')).length).toBe(2)
  })
  it('whatsNext: "noExam" with nothing ahead', () => {
    const s: EngineState = { ...lina, goals: [], rotation: undefined }
    expect(whatsNext(s, T)).toEqual({ reason: 'noExam' })
  })
})

describe('retests never on or after the exam', () => {
  const g: Goal = { ...im, examDate: addDays(T, 5), dateSource: 'set' }
  const r = (id: string, d: string): Task => ({ id, date: d, kind: 'retest', goalId: g.id, title: 'Retest', reason: '', minutes: 15, status: 'pending' })
  it('a late retest moves to the last day that fits; a new one that cannot fit is left out', () => {
    expect(retestLatest(g)).toBe(addDays(T, 5 - RETEST_BEFORE_EXAM_DAYS))
    expect(fitRetests({ goals: [g] }, [r('a', addDays(T, 7))], T)[0].date).toBe(retestLatest(g))
    const tight: Goal = { ...g, examDate: addDays(T, 2) }
    expect(fitRetests({ goals: [tight] }, [r('a', addDays(T, 4))], T, new Set(['a']))).toEqual([])
    expect(fitRetests({ goals: [tight] }, [r('a', addDays(T, 4))], T)).toHaveLength(1)
  })
  it('a "no idea" date has no cap', () => {
    expect(retestLatest({ ...g, dateSource: 'projected' })).toBeNull()
  })
  it('the pooled line says what decided it', () => {
    expect(pooledLine({ questions: 10, correct: 6 }, 5, 4)).toBe('6/10 first, then 4/5 on the deciding questions')
  })
})

describe('unknown amounts and dates are never judged', () => {
  it('readiness with a date not known says so and shows no shortfall', () => {
    const g: Goal = { ...step1, dateSource: 'assumed' }
    const rd = readiness({ ...lina, goals: lina.goals.map((x) => (x.id === g.id ? g : x)) }, g, T)
    expect(rd.dateKnown).toBe(false)
    expect(rd.daysShort).toBe(0)
    const v = verdict(rd)
    expect(`${v.headline} ${v.detail}`).toMatch(/date not known/)
  })
  it('a question bank with no size is flagged unsure', () => {
    expect(bankSizeUnsure({ resources: ['qbank'], qbankTotal: undefined } as never)).toBe(true)
    expect(bankSizeUnsure({ resources: ['uworld'], qbankTotal: undefined } as never)).toBe(false)
  })
})

describe('uni topics, scored papers and named lectures', () => {
  const sub = { ...subjectFor('im'), lecturesLeft: 3, lectureTitles: ['Heart failure', 'Asthma', 'DKA'], pastPapers: 2 }
  const e = subjectGoal(sub, addDays(T, 21), MUTAH, T)
  const s = addGoal({ ...lina, goals: lina.goals.filter((g) => g.id !== 'uni-im'), resources: lina.resources.filter((r) => r.goalId !== 'uni-im') }, e.goal, e.resources, T)
  const slides = s.resources.find((r) => r.goalId === 'uni-im' && r.type === 'slides')!
  const paper = s.resources.find((r) => r.goalId === 'uni-im' && r.type === 'papers')!

  it('topics come from the lecture titles', () => {
    expect(uniTopicChoices(s, 'uni-im').map((t) => t.name)).toEqual(['Heart failure', 'Asthma', 'DKA'])
    expect(uniTopicId('uni-im')).toBe('uni-uni-im-all')
  })
  it('lecture titles show in the task', () => {
    expect(lecturesTitle(slides, 1)).toMatch(/Heart failure/)
    expect(lecturesTitle(slides, 2)).toMatch(/Heart failure, Asthma/)
  })
  it('a low paper score adds a fix on the tapped uni topic', () => {
    const task: Task = { id: 'p1', date: T, kind: 'study', goalId: 'uni-im', resourceId: paper.id, title: 'Past paper', reason: '', minutes: 60, status: 'pending', amount: 1 }
    const topic = uniTopicChoices(s, 'uni-im')[0]
    const out = reportTask(s, task, { result: 'done', questions: 40, percent: 40, weakTopicIds: [topic.id] }, T)
    expect(out.outcome.kind).toBe('fix')
    expect(out.state.topics.find((t) => t.id === topic.id)?.status).toBe('weak')
  })
  it('growUni fills leftover time with whole lectures and never goes over the room', () => {
    const tasks: Task[] = []
    for (const room of [10, 45, 120, 400]) {
      const list: Task[] = []
      const used = growUni(s.resources, e.goal, T, list, room, 1, 'x')
      expect(used).toBeLessThanOrEqual(room)
      expect(list.reduce((a, t) => a + t.minutes, 0)).toBeLessThanOrEqual(room)
      for (const t of list) if (t.resourceId === slides.id) expect(t.amount!).toBeLessThanOrEqual(LECTURES_MAX_PER_DAY)
      tasks.push(...list)
    }
    expect(tasks.length).toBeGreaterThan(0)
  })
})
