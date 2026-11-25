// After an exam (batch 3): a fix is never dated after its own exam, and a finished exam's topics are history.
import { describe, expect, it } from 'vitest'
import { DEMO_TODAY, linaState } from '../../data/demo'
import { addDays, isWatchedTopic, liveTopics, reportOutside, topicCounts, uniGoalOfTopic, type EngineState, type Topic } from '..'

const T = DEMO_TODAY

function withExam(s: EngineState, goalId: string, examDate: string): EngineState {
  return { ...s, goals: s.goals.map((g) => (g.id === goalId ? { ...g, examDate } : g)) }
}

describe('fixes never land after their exam', () => {
  it('a low uni result the day before its exam adds no fix and says why', () => {
    const s = withExam(linaState(T), 'uni-im', addDays(T, 1))
    const out = reportOutside(s, { goalId: 'uni-im', label: 'IM quiz', percent: 40 }, T)
    expect(out.outcome).toMatchObject({ kind: 'progress', score: 40, examSoon: s.goals.find((g) => g.id === 'uni-im')!.label })
    const after = out.state.scheduled.filter((x) => x.goalId === 'uni-im' && (x.kind === 'fix' || x.kind === 'retest') && !s.scheduled.some((o) => o.id === x.id))
    expect(after).toEqual([])
  })
  it('with days left, every new fix and retest is dated before the exam', () => {
    const exam = addDays(T, 6)
    const s = withExam(linaState(T), 'uni-im', exam)
    const out = reportOutside(s, { goalId: 'uni-im', label: 'IM quiz', percent: 40 }, T)
    expect(out.outcome.kind).toBe('fix')
    for (const id of out.added) {
      const t = out.state.scheduled.find((x) => x.id === id)
      if (t) expect(t.date < exam).toBe(true)
    }
  })
})

describe('liveTopics', () => {
  const topic = (id: string, status: Topic['status'] = 'weak'): Topic => ({ id, name: id, system: 'IM', status })
  const base = linaState(T)
  it('drops topics of a uni exam already sat or retired, keeps live ones and the board', () => {
    const s = {
      ...base,
      goals: [...base.goals, { ...base.goals.find((g) => g.id === 'uni-im')!, id: 'uni-im-2', examDate: addDays(T, -3) }],
      topics: [topic('uni-uni-im-cirrhosis'), topic('uni-uni-im-2-acs'), topic('uni-gone-x'), topic('cardio-hf')],
    }
    expect(liveTopics(s, T).map((t) => t.id)).toEqual(['uni-uni-im-cirrhosis', 'cardio-hf'])
    expect(uniGoalOfTopic(s.goals, 'uni-uni-im-2-acs')).toBe('uni-im-2')
    expect(topicCounts(s.topics, T, 30, liveTopics(s, T)).open.map((t) => t.id)).toEqual(['uni-uni-im-cirrhosis', 'cardio-hf'])
  })
  it('board topics go quiet once the board exam is over', () => {
    const s = { ...withExam(base, base.topicGoalId!, addDays(T, -1)), topics: [topic('cardio-hf')] }
    expect(liveTopics(s, T)).toEqual([])
  })
})

describe('isWatchedTopic', () => {
  it('counts reading as studied, never questions alone', () => {
    const t = (doneItems: number): Topic => ({
      id: 'x', name: 'x', system: 'Cardio', status: 'unknown', doneItems,
      items: [{ minutes: 20, source: 'firstaid', title: 'Reading' }, { minutes: 30, questions: 10, source: 'qbank', title: 'UWorld' }],
    })
    expect(isWatchedTopic(t(0))).toBe(false)
    expect(isWatchedTopic(t(1))).toBe(true)
  })
})
