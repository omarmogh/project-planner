// "Log a result" (batch 3): an exam, NBME, quiz or colloquium score feeds the same fix → retest loop.
import { describe, expect, it } from 'vitest'
import { DEMO_TODAY, linaState } from '../../data/demo'
import {
  accuracyBySystem, addDays, estimates, isTestLike, reportOutside, resultPrompt, roughPatch, studiedOn, uniAccuracy,
  MIXED_SYSTEM, OUTSIDE_DEFAULT_QUESTIONS, type Commitment, type EngineState,
} from '..'

const T = DEMO_TODAY

describe('reportOutside', () => {
  it('a low board result adds one fix and one retest, and moves no material', () => {
    const s = linaState(T)
    const out = reportOutside(s, { goalId: 'step1', label: 'NBME 1', questions: 50, percent: 48, minutes: 120 }, T)
    expect(out.outcome.kind).toBe('fix')
    if (out.outcome.kind !== 'fix') return
    expect(out.outcome.plan.fix.reason).toBe('NBME 1: 48%')
    expect(out.added).toContain(out.outcome.plan.fix.id)
    expect(out.state.scheduled.length).toBeGreaterThan(s.scheduled.length)
    expect(out.state.resources).toEqual(s.resources)
    expect(out.state.outcomes).toEqual(s.outcomes)
    expect(out.task.system).toBe(MIXED_SYSTEM)
    const session = out.state.sessions.at(-1)!
    expect(session).toMatchObject({ outside: 'NBME 1', questions: 50, minutes: 120, goalId: 'step1' })
    expect(session.planned).toBeUndefined()
    expect(studiedOn(out.state.sessions, T) - studiedOn(s.sessions, T)).toBe(120)
    expect(estimates(out.state)).toEqual(estimates(s))
  })
  it('systems tapped after a board result become the fix topics', () => {
    const out = reportOutside(linaState(T), { goalId: 'step1', label: 'UWSA 1', questions: 40, percent: 70, weakTopicIds: ['Renal'] }, T)
    expect(out.outcome.kind).toBe('fix')
    if (out.outcome.kind === 'fix') expect(out.outcome.plan.fix.system).toBe('Renal')
  })
  it('a uni result is scored like a paper and counts in the subject’s accuracy', () => {
    const s = linaState(T)
    const out = reportOutside(s, { goalId: 'uni-im', label: 'IM quiz', percent: 45 }, T)
    expect(out.outcome.kind).toBe('fix')
    expect(out.state.sessions.at(-1)!.questions).toBe(OUTSIDE_DEFAULT_QUESTIONS)
    const before = uniAccuracy(s, 'uni-im', addDays(T, 1))
    const after = uniAccuracy(out.state, 'uni-im', addDays(T, 1))
    expect(after).not.toEqual(before)
  })
  it('a good result is clean; no score logs the minutes only', () => {
    const s = linaState(T)
    expect(reportOutside(s, { goalId: 'step1', label: 'NBME 2', questions: 50, percent: 78 }, T).outcome.kind).toBe('clean')
    const plain = reportOutside(s, { goalId: 'step1', label: 'Mock', minutes: 60 }, T)
    expect(plain.outcome).toEqual({ kind: 'progress', result: 'done', score: undefined })
    expect(plain.state.scheduled).toEqual(s.scheduled)
    expect(plain.state.sessions.length).toBe(s.sessions.length + 1)
  })
  it('two results on one day never share an id', () => {
    const a = reportOutside(linaState(T), { goalId: 'step1', label: 'A', questions: 20, percent: 40 }, T)
    const b = reportOutside(a.state, { goalId: 'step1', label: 'B', questions: 20, percent: 40 }, T)
    expect(a.task.id).not.toBe(b.task.id)
    expect(new Set(b.state.sessions.map((x) => x.id)).size).toBe(b.state.sessions.length)
  })
  it('a bad exam score never reads as a rough patch', () => {
    const s = linaState(T)
    const out = reportOutside(s, { goalId: 'step1', label: 'NBME 1', questions: 50, percent: 20 }, T)
    expect(roughPatch(out.state, T)?.scoreDrop ?? null).toEqual(roughPatch(s, T)?.scoreDrop ?? null)
    expect(accuracyBySystem(out.state.sessions, addDays(T, -30), T)).toEqual(accuracyBySystem(s.sessions, addDays(T, -30), T))
  })
})

describe('resultPrompt', () => {
  const busy = (c: Partial<Commitment>): Commitment => ({ id: 'c1', kind: 'busy', title: 'Physics colloquium', tag: 'uni', date: addDays(T, -1), from: '10:00', to: '12:00', createdOn: addDays(T, -5), ...c })
  const withC = (c: Commitment, extra: Partial<EngineState> = {}): EngineState => ({ ...linaState(T), commitments: [c], ...extra })
  it('test words are recognised in English and Arabic; plain busy time is not', () => {
    for (const t of ['Physics colloquium', 'NBME 3', 'Cardio quiz', 'Oral exam', 'UWSA 2', 'كويز باطني', 'امتحان شفوي']) expect(isTestLike(t)).toBe(true)
    for (const t of ['Lecture 10–12', 'Gym 6pm', 'Ward round']) expect(isTestLike(t)).toBe(false)
  })
  it('asks once after a quiz, for the nearest uni exam still ahead', () => {
    expect(resultPrompt(withC(busy({})), T)).toEqual({ key: 'c:c1', label: 'Physics colloquium', goalId: 'uni-im' })
    expect(resultPrompt(withC(busy({}), { resultsAsked: ['c:c1'] }), T)).toBeNull()
  })
  it('today only once its end time has passed; never days later or for weekly things', () => {
    const today = busy({ date: T })
    expect(resultPrompt(withC(today), T, 11 * 60)).toBeNull()
    expect(resultPrompt(withC(today), T, 12 * 60 + 5)?.key).toBe('c:c1')
    expect(resultPrompt(withC(busy({ date: addDays(T, -5) })), T)).toBeNull()
    expect(resultPrompt(withC(busy({ repeat: [0] })), T)).toBeNull()
    expect(resultPrompt(withC(busy({ title: 'Lecture' })), T)).toBeNull()
  })
  it('a board test goes to the board goal; a personal one asks nothing', () => {
    expect(resultPrompt(withC(busy({ title: 'NBME 1', tag: 'usmle' })), T)?.goalId).toBe('step1')
    expect(resultPrompt(withC(busy({ tag: 'personal' })), T)).toBeNull()
  })
  it('never for the exam itself, which is over', () => {
    const s = linaState(T)
    const examDay = s.goals.find((g) => g.id === 'uni-im')!.examDate
    const after = addDays(examDay, 1)
    const c = busy({ title: 'IM exam', date: examDay })
    expect(resultPrompt({ ...s, commitments: [c] }, after)).toBeNull()
  })
})
