import { describe, expect, it } from 'vitest'
import {
  addDays, applyCompletion, buildDay, busyReduction, capacity, deadlinePlan, linkedTopicIds, parseCommitment, previewTomorrow,
  topicQueue, totalMinutes, DEADLINE_MIN_CHUNK, type Commitment, type EngineState, type Task,
} from '..'
import { linaState } from '../../data/demo'
import { TOPICS, topicId } from '../../data/topics'
import { TOPIC_ALIASES } from '../../data/topicAliases'

const T = '2026-11-15' // Sunday; Lina has 3 h on weekdays, Fri–Sat weekend
const THU = '2026-11-19'

const busy = (p: Partial<Commitment>): Commitment => ({ id: 'b1', kind: 'busy', title: 'Lecture', tag: 'uni', date: T, createdOn: T, ...p })
const deadline = (p: Partial<Commitment>): Commitment => ({ id: 'd1', kind: 'deadline', title: 'Seminar on DKA', tag: 'uni', date: THU, minutes: 180, createdOn: T, ...p })
const withC = (s: EngineState, ...c: Commitment[]): EngineState => ({ ...s, commitments: c })

describe('busy time reduces capacity', () => {
  it('a daytime lecture costs a quarter of its length; evening time counts in full', () => {
    expect(busyReduction([busy({ from: '10:00', to: '12:00' })], T, 180)).toBe(30)
    expect(busyReduction([busy({ from: '18:00', to: '19:00' })], T, 180)).toBe(60)
    // 15:00–17:00: one hour before the evening window (15 min), one inside (60).
    expect(busyReduction([busy({ from: '15:00', to: '17:00' })], T, 180)).toBe(75)
  })

  it('no clock time → the whole length; never more than the day; only that day', () => {
    expect(busyReduction([busy({ minutes: 90 })], T, 180)).toBe(90)
    expect(busyReduction([busy({ minutes: 600 })], T, 180)).toBe(180)
    expect(busyReduction([busy({ minutes: 90 })], addDays(T, 1), 180)).toBe(0)
  })

  it("Lecture 10–12 → Lina's 3 h becomes 2 h 30 and the plan fits it", () => {
    const s = withC(linaState(T), busy({ from: '10:00', to: '12:00' }))
    const day = buildDay(s, T)
    expect(day.busy).toBe(30)
    expect(capacity(s, T)).toBe(150)
    expect(totalMinutes(day.tasks)).toBeLessThanOrEqual(150)
    expect(totalMinutes(day.tasks)).toBeLessThan(totalMinutes(buildDay(linaState(T), T).tasks))
    expect(day.squeezed).toBe(false)
  })
})

describe('deadline work is split across the days before it', () => {
  it('3 h due Thursday → even chunks Sun–Tue, done a day early', () => {
    const { chunks, overloaded } = deadlinePlan(withC(linaState(T), deadline({})), T)
    expect(chunks.map((c) => [c.date, c.minutes])).toEqual([[T, 60], [addDays(T, 1), 60], [addDays(T, 2), 60]])
    expect(overloaded).toEqual([])
  })

  it('no chunk under the minimum: 40 min is one sitting', () => {
    const { chunks } = deadlinePlan(withC(linaState(T), deadline({ minutes: 40 })), T)
    expect(chunks).toEqual([{ commitmentId: 'd1', date: T, minutes: 40 }])
    const big = deadlinePlan(withC(linaState(T), deadline({ minutes: 100 })), T).chunks
    expect(big.every((c) => c.minutes >= DEADLINE_MIN_CHUNK)).toBe(true)
    expect(big.reduce((n, c) => n + c.minutes, 0)).toBe(100)
  })

  it('done work is not planned again; the rest re-splits over the days left', () => {
    const s = withC(linaState(T), deadline({ doneMinutes: 60 }))
    const { chunks } = deadlinePlan(s, addDays(T, 1))
    expect(chunks.map((c) => [c.date, c.minutes])).toEqual([[addDays(T, 1), 60], [addDays(T, 2), 60]])
  })

  it('shows up on Today as a normal task with its tag, before goal work', () => {
    const day = buildDay(withC(linaState(T), deadline({})), T)
    const task = day.tasks.find((t) => t.commitmentId === 'd1')!
    expect(task).toMatchObject({ title: 'Seminar on DKA', tag: 'uni', minutes: 60, reason: 'Due Thursday', kind: 'study' })
    expect(day.tasks.findIndex((t) => t.commitmentId)).toBe(1) // right after Anki
    expect(totalMinutes(day.tasks)).toBeLessThanOrEqual(180)
  })

  it('a day with too little room after busy time is skipped', () => {
    const s = withC(linaState(T), deadline({ minutes: 120 }), busy({ id: 'b2', minutes: 170 }))
    const { chunks } = deadlinePlan(s, T)
    expect(chunks.some((c) => c.date === T)).toBe(false)
    expect(chunks.reduce((n, c) => n + c.minutes, 0)).toBe(120)
  })

  it('Done / Partly count toward the work; all of it done → it disappears', () => {
    const s = withC(linaState(T), deadline({}))
    const task = buildDay(s, T).tasks.find((t) => t.commitmentId)!
    const partly = applyCompletion(s, task, 'partly', T)
    expect(partly.commitments![0].doneMinutes).toBe(30)
    const last = applyCompletion(withC(s, deadline({ doneMinutes: 120 })), task, 'done', T)
    expect(last.commitments![0]).toMatchObject({ doneMinutes: 180, done: true })
    expect(buildDay(last, addDays(T, 1)).tasks.some((t) => t.commitmentId)).toBe(false)
    // Deadline work never touches topics or resources.
    expect(partly.topics).toBe(s.topics)
    expect(partly.resources).toBe(s.resources)
  })

  it("tomorrow's preview assumes today's chunk is done", () => {
    const s = withC(linaState(T), deadline({}))
    const today = buildDay(s, T).tasks
    const tomorrow = previewTomorrow(s, today, T)
    expect(tomorrow.tasks.find((t) => t.commitmentId)?.minutes).toBe(60)
    expect(previewTomorrow(s, [], T).tasks.find((t) => t.commitmentId)?.minutes).toBe(90)
  })
})

describe('topic link', () => {
  it('deadline work on a topic counts as studying it: not planned separately that week', () => {
    const s = linaState(T)
    const next = topicQueue(s, T)[0]
    const linked = withC(s, deadline({ title: 'Presentation on murmurs', topicId: next.id }))
    expect(topicQueue(linked, T).some((t) => t.id === next.id)).toBe(false)
    const day = buildDay(linked, T)
    expect(day.tasks.some((t) => t.topicId === next.id)).toBe(false)
    expect(day.tasks.find((t) => t.commitmentId)?.topicIds).toEqual([next.id])
  })

  it('the link lasts until a week after the deadline', () => {
    const c = [deadline({ topicId: 'x' })]
    expect(linkedTopicIds(c, T).has('x')).toBe(true)
    expect(linkedTopicIds(c, addDays(THU, 7)).has('x')).toBe(true)
    expect(linkedTopicIds(c, addDays(THU, 8)).has('x')).toBe(false)
  })

  it('"Seminar on DKA" links to Diabetes', () => {
    const topics = Object.entries(TOPICS).flatMap(([sys, names]) => names.map((name) => ({ id: topicId(sys, name), name })))
    expect(parseCommitment('Seminar on DKA Thursday 3h', T, topics, TOPIC_ALIASES).topicId).toBe(topicId('Endo', 'Diabetes'))
  })
})

describe('overload', () => {
  const retest: Task = { id: 'r-due', date: T, kind: 'retest', goalId: 'step1', title: 'Retest: 10 heart failure questions', reason: '', minutes: 15, amount: 10, status: 'pending', topicIds: ['cardio-heart-failure'] }

  it('commitments fill the day: study moves, due fixes and retests stay, and the day says so', () => {
    const base = linaState(T)
    const s = { ...withC(base, deadline({ date: addDays(T, 1), minutes: 300 })), scheduled: [...base.scheduled, retest] }
    const day = buildDay(s, T)
    expect(day.squeezed).toBe(true)
    expect(day.overloaded).toEqual(['d1'])
    expect(day.tasks.find((t) => t.commitmentId)?.minutes).toBe(300)
    expect(day.tasks.some((t) => t.id === 'r-due')).toBe(true)
    expect(day.tasks.some((t) => t.id === 'seed-retest-acid')).toBe(true)
    expect(day.tasks.some((t) => t.kind === 'study' && !t.commitmentId)).toBe(false)
  })

  it('a day fully busy still keeps due retests', () => {
    const day = buildDay(withC(linaState(T), busy({ minutes: 600 })), T)
    expect(day.busy).toBe(180)
    expect(day.squeezed).toBe(true)
    expect(day.tasks.some((t) => t.id === 'seed-retest-acid')).toBe(true)
  })
})
