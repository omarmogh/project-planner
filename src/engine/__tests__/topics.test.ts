import { describe, expect, it } from 'vitest'
import {
  addDays, applyCompletion, applyTopicCompletion, buildDay, count, isCovered, isSystemDone, planFix, previewTomorrow,
  sliceTopic, stepLines, suggestNextSystem, timerFactor, topicQueue, totalMinutes,
  MIN_TASK_MINUTES, type EngineState, type Session, type StudyItem, type Task, type Topic,
} from '..'
import { buildPlanState, defaultAnswers, goalLabel, type Answers } from '../../data/setup'
import { BNB, BNB_NEEDS_REVIEW } from '../../data/resources/bnb'
import { FIRST_AID } from '../../data/resources/firstaid'
import { SYSTEMS, TOPICS, topicId } from '../../data/topics'
import { roughDate } from '../../data/templates'

const T = '2026-11-15' // a Sunday

const items: StudyItem[] = [
  { source: 'bnb', title: 'Heart Failure Basics', minutes: 20 },
  { source: 'bnb', title: 'Acute Heart Failure', minutes: 20 },
  { source: 'firstaid', title: 'Heart failure', minutes: 20 },
  { source: 'qbank', title: 'UWorld', minutes: 30, questions: 10 },
]
const hf: Topic = { id: 'hf', system: 'Cardio', name: 'Heart failure', status: 'unknown', items, doneItems: 0, partialMin: 0 }

describe('topic tasks', () => {
  it('steps name the topic\'s own videos and sections, never numbers', () => {
    expect(stepLines(items)).toEqual([
      'B&B: Heart Failure Basics, Acute Heart Failure',
      'First Aid: Heart failure',
      'Then 10 UWorld questions on it',
    ])
  })
  it('a slice takes whole items that fit, and never goes under the minimum', () => {
    expect(sliceTopic(hf, 90)).toMatchObject({ from: 0, to: 4, minutes: 90, questions: 10, ends: true })
    expect(sliceTopic(hf, 70)).toMatchObject({ from: 0, to: 3, minutes: 60, questions: 0, ends: false })
    expect(sliceTopic(hf, 10)).toBeNull()
    const nearlyDone = { ...hf, doneItems: 2, partialMin: 15 }
    // 5 min of First Aid left: shown as a 15-min task, never "5 min".
    expect(sliceTopic(nearlyDone, 15)).toMatchObject({ from: 2, to: 3, minutes: MIN_TASK_MINUTES })
  })
  it('Done covers the slice; Partly counts half and keeps the rest first; Didn\'t changes nothing', () => {
    const task = { itemFrom: 0, itemTo: 3, minutes: 60 } as Task
    expect(applyTopicCompletion(hf, task, 'done')).toMatchObject({ doneItems: 3, partialMin: 0 })
    expect(applyTopicCompletion(hf, task, 'partly')).toMatchObject({ doneItems: 1, partialMin: 10 })
    expect(applyTopicCompletion(hf, task, 'skipped')).toBe(hf)
    expect(isCovered(applyTopicCompletion(hf, { itemFrom: 0, itemTo: 4, minutes: 90 } as Task, 'done'))).toBe(true)
  })
  it('the timer tunes estimates after enough finished topic tasks, within limits', () => {
    const s = (minutes: number, planned: number): Session => ({ id: String(Math.random()), date: T, kind: 'study', goalId: 'step1', topicIds: ['hf'], minutes, planned })
    expect(timerFactor([s(60, 30)])).toBe(1)
    expect(timerFactor(Array.from({ length: 5 }, () => s(36, 30)))).toBeCloseTo(1.2)
    expect(timerFactor(Array.from({ length: 5 }, () => s(90, 30)))).toBe(1.5)
  })
})

// A student on Step 1 + IM, with B&B, First Aid, UWorld and slides.
function answers(patch: Partial<Answers> = {}): Answers {
  return {
    ...defaultAnswers(),
    goals: ['uni', 'step1'],
    dates: { uni: { kind: 'date', date: addDays(T, 20) }, step1: { kind: 'date', date: addDays(T, 200) } },
    rotation: 'im',
    rotationUntil: addDays(T, 25),
    resources: ['uworld', 'bnb', 'firstaid', 'slides'],
    uworldDone: 0,
    lecturesLeft: 8,
    systemsNow: ['Cardio'],
    weekdayHours: 3,
    weekendHours: 4,
    callDays: [],
    ...patch,
  }
}

describe('planning by topic', () => {
  const s = buildPlanState(answers(), T)
  const mon = '2026-11-16'

  it('a study task is one topic, with its resources inside, never resource units', () => {
    const d = buildDay(s, mon)
    const topic = d.tasks.find((t) => t.topicId)!
    expect(topic.title).toBe('Cardio: Cardiac anatomy & physiology')
    expect(topic.steps![0]).toMatch(/^B&B: Cardiac Anatomy, Cardiac Physiology/)
    for (const t of d.tasks) expect(t.title).not.toMatch(/video \d|page \d|lecture \d|chapter \d/i)
  })
  it('no study task under 15 minutes', () => {
    for (let i = 0; i < 14; i++) {
      for (const t of buildDay(s, addDays(mon, i)).tasks) {
        if (t.kind === 'study') expect(t.minutes).toBeGreaterThanOrEqual(MIN_TASK_MINUTES)
      }
    }
  })
  it('tomorrow assumes today gets done: the next lectures and topics, never a repeat', () => {
    const today = buildDay(s, mon)
    const tomorrow = previewTomorrow(s, today.tasks, mon)
    const todayTopics = today.tasks.filter((t) => t.topicId && !t.detail).map((t) => t.topicId)
    for (const t of tomorrow.tasks) expect(todayTopics).not.toContain(t.topicId)
    const slidesToday = today.tasks.find((t) => t.resourceId === 'slides')!
    const left = 8 - slidesToday.amount!
    const slidesTomorrow = tomorrow.tasks.find((t) => t.resourceId === 'slides')!
    expect(slidesTomorrow.amount).toBe(Math.max(1, Math.ceil(left / 19)))
  })
  it('Partly or Didn\'t get to it → tomorrow re-plans with that work first', () => {
    const today = buildDay(s, mon)
    const task = today.tasks.find((t) => t.topicId)!
    for (const result of ['partly', 'skipped'] as const) {
      const after = applyCompletion(s, task, result, mon)
      const tasks = today.tasks.map((t) => (t.id === task.id ? { ...t, status: result } : t))
      const tomorrow = previewTomorrow(after, tasks, mon)
      const first = tomorrow.tasks.find((t) => t.topicId)!
      expect(first.topicId).toBe(task.topicId)
      if (result === 'partly') expect(first.reason).toBe('Picks up where you left off')
    }
  })
  it('Didn\'t get to it on slides keeps the lecture; Partly makes it shorter', () => {
    const today = buildDay(s, mon)
    const slides = today.tasks.find((t) => t.resourceId === 'slides')!
    const partly = applyCompletion(s, slides, 'partly', mon)
    expect(partly.resources.find((r) => r.id === 'slides')!.doneUnits).toBe(slides.amount! / 2)
    const skipped = applyCompletion(s, slides, 'skipped', mon)
    expect(skipped.resources.find((r) => r.id === 'slides')!.doneUnits).toBe(0)
  })
  it('a topic\'s questions under 60% → a fix and retest for that topic', () => {
    const task = buildDay(s, mon).tasks.find((t) => t.topicId)!
    const f = planFix({ date: mon, goalId: 'step1', system: 'Cardio', questions: 10, correct: 5, weakTopicIds: [], topicId: task.topicId }, s)!
    expect(f.topicIds).toEqual([task.topicId])
    expect(f.fix.reason).toBe('Cardiac anatomy & physiology questions: 50%')
    expect(f.retest!.title).toBe('Retest: 10 cardiac anatomy & physiology questions')
    expect(planFix({ date: mon, goalId: 'step1', system: 'Cardio', questions: 10, correct: 7, weakTopicIds: [], topicId: task.topicId }, s)).toBeNull()
  })
  it('two systems at once alternate topics', () => {
    const two = buildPlanState(answers({ systemsNow: ['Cardio', 'Renal'] }), T)
    const q = topicQueue(two, mon).slice(0, 4).map((t) => t.system)
    expect(q).toEqual(['Cardio', 'Renal', 'Cardio', 'Renal'])
  })
})

describe('next system', () => {
  it('not-started systems first, in the map\'s order; then the weakest by accuracy', () => {
    const s = buildPlanState(answers({ systemsNow: ['Cardio'], systemsDone: ['Resp'] }), T)
    expect(suggestNextSystem(s, T, ['Cardio'])).toBe('Renal')
    const allStarted: EngineState = {
      ...s,
      topics: s.topics.map((t) => (t.system === 'Renal' || t.system === 'GI' ? t : { ...t, doneItems: t.items!.length })),
    }
    const started: EngineState = {
      ...allStarted,
      topics: allStarted.topics.map((t) => (t.system === 'Renal' || t.system === 'GI') && t.name === TOPICS[t.system][0] ? { ...t, doneItems: t.items!.length } : t),
      sessions: [
        { id: 'a', date: T, kind: 'study', goalId: 'step1', system: 'Renal', minutes: 30, questions: 10, correct: 7 },
        { id: 'b', date: T, kind: 'study', goalId: 'step1', system: 'GI', minutes: 30, questions: 10, correct: 4 },
      ],
    }
    expect(suggestNextSystem(started, T)).toBe('GI')
  })
  it('once the focus system is done, the plan moves on to the suggestion by itself', () => {
    const s = buildPlanState(answers(), T)
    const done = { ...s, topics: s.topics.map((t) => (t.system === 'Cardio' ? { ...t, doneItems: t.items!.length } : t)) }
    expect(isSystemDone(done.topics, 'Cardio')).toBe(true)
    const task = buildDay(done, '2026-11-16').tasks.find((t) => t.topicId)!
    expect(task.title.startsWith('Resp: ')).toBe(true)
    expect(task.reason).toBe('Next system: Resp')
  })
})

describe('onboarding: only what students know, "Not sure" everywhere', () => {
  it('the uni goal is named after the rotation', () => {
    expect(goalLabel('uni', { stage: 'clinical', rotation: 'im' })).toBe('IM exam')
    expect(goalLabel('uni', { stage: 'clinical', rotation: 'fm' })).toBe('Family medicine exam')
    expect(goalLabel('uni', { stage: 'clinical', rotationCustom: 'Neurosurgery' })).toBe('Neurosurgery exam')
    expect(goalLabel('uni', { stage: 'basic' })).toBe('Uni exam')
  })
  it('uni exam "Don\'t know yet" → the end of the rotation, marked as assumed', () => {
    const s = buildPlanState(answers({ dates: { uni: { kind: 'unknown' }, step1: { kind: 'date', date: addDays(T, 200) } } }), T)
    expect(s.goals[0]).toMatchObject({ label: 'IM exam', examDate: addDays(T, 25), dateSource: 'assumed' })
  })
  it('Step 1 not booked: "Mid 2027" plans for mid-July; "No idea" projects a ready-by date', () => {
    expect(roughDate('mid', T)).toBe('2027-07-15')
    const rough = buildPlanState(answers({ dates: { uni: { kind: 'unknown' }, step1: { kind: 'rough', when: 'mid' } } }), T)
    expect(rough.goals[1]).toMatchObject({ examDate: '2027-07-15', dateSource: 'rough' })
    const idea = buildPlanState(answers({ dates: { uni: { kind: 'unknown' }, step1: { kind: 'unknown' } } }), T)
    expect(idea.goals[1].dateSource).toBe('projected')
    expect(idea.goals[1].examDate > T).toBe(true)
    expect(idea.goals[1].examDate < addDays(T, 730)).toBe(true)
  })
  it('Not sure → sensible defaults: 0 UWorld questions, 15 lectures, a suggested system', () => {
    const s = buildPlanState(answers({ uworldDone: null, lecturesLeft: null, systemsNow: [] }), T)
    expect(s.resources.find((r) => r.id === 'uworld')!.doneUnits).toBe(0)
    expect(s.resources.find((r) => r.id === 'slides')).toMatchObject({ name: 'IM slides', totalUnits: 15, doneUnits: 0 })
    expect(s.focus).toEqual(['Cardio'])
  })
  it('"already done" systems start covered; B&B / First Aid ask no progress at all', () => {
    const s = buildPlanState(answers({ systemsDone: ['Renal'] }), T)
    expect(s.topics.filter((t) => t.system === 'Renal').every(isCovered)).toBe(true)
    expect(s.topics.filter((t) => t.system === 'Cardio').some(isCovered)).toBe(false)
    expect(s.resources.map((r) => r.id).sort()).toEqual(['slides', 'uworld'])
    expect(s.materials).toEqual(['bnb', 'firstaid'])
  })
})

describe('resource structure', () => {
  const ids = new Set(Object.entries(TOPICS).flatMap(([sys, names]) => names.map((n) => topicId(sys, n))))
  it('every B&B video maps to an existing topic, and every topic has B&B', () => {
    expect(BNB.length).toBe(475)
    for (const v of BNB) for (const t of v.topicIds) expect(ids.has(t), v.title).toBe(true)
    for (const id of ids) expect(BNB.some((v) => v.topicIds.includes(id)), id).toBe(true)
    expect(BNB_NEEDS_REVIEW.filter((x) => x.startsWith('Unmapped'))).toEqual([])
  })
  it('titles only: no numbers standing in for content, no page numbers', () => {
    for (const v of [...BNB, ...FIRST_AID]) expect(v.title).not.toMatch(/\bp(age|\.)\s*\d|\(\d+ ?min/i)
  })
  it('every system in the map has topics', () => {
    for (const s of SYSTEMS) expect(TOPICS[s.id].length).toBeGreaterThan(0)
  })
})

describe('plurals', () => {
  it('1 task, 2 tasks', () => {
    expect(count(1, 'task')).toBe('1 task')
    expect(count(2, 'task')).toBe('2 tasks')
    expect(count(1, 'question')).toBe('1 question')
  })
})

describe('no exam weights anywhere in the engine', () => {
  it('the plan never uses made-up weights', () => {
    const files = import.meta.glob('../*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    for (const [name, src] of Object.entries(files)) expect(src, name).not.toMatch(/weight/i)
  })
  it('a day never exceeds its time', () => {
    const s = buildPlanState(answers(), T)
    for (let i = 0; i < 21; i++) {
      const d = buildDay(s, addDays(T, i))
      expect(totalMinutes(d.tasks)).toBeLessThanOrEqual(d.available)
    }
  })
})
