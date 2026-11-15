import { describe, expect, it } from 'vitest'
import { addDays, sweepItems, sweepOutcome, withSweepTasks, SWEEP, QBANK_MINUTES_PER_QUESTION, type Topic } from '..'
import { linaState } from '../../data/demo'
import { demoSweep } from '../../data/sweep'

const T = '2026-11-15'

const topic = (name: string, done: boolean, status: Topic['status'] = 'unknown'): Topic => ({
  id: `Cardio-${name}`, system: 'Cardio', name, status, items: [{ source: 'bnb', title: name, minutes: 10 }], doneItems: done ? 1 : 0,
})

describe('sweepItems', () => {
  const topics = [topic('A', true), topic('B', true), topic('C', false), topic('D', true, 'fixing'), topic('E', true), topic('F', true), topic('G', true), topic('H', true)]
  const lectures = [{ goalId: 'uni-im', short: 'IM', titles: ['L1', 'L2', 'L3'] }]

  it('takes at most 6: covered topics not being fixed, plus 2 recent lectures in the middle', () => {
    const items = sweepItems(topics, 'Cardio', 'step1', lectures)
    expect(items).toHaveLength(SWEEP.max)
    expect(items.map((i) => i.title)).toEqual(['A', 'B', 'L2', 'E', 'L3', 'F'])
    expect(items.find((i) => i.title === 'L2')?.label).toBe('IM lecture')
    expect(items[0].label).toBe('Step 1 · Cardio')
  })

  it('works with topics only', () => {
    expect(sweepItems(topics, 'Cardio', 'step1', []).map((i) => i.title)).toEqual(['A', 'B', 'E', 'F', 'G', 'H'])
  })

  it('Lina gets 4 Cardio topics and 2 IM lectures', () => {
    const { items } = demoSweep(linaState(T))
    expect(items.filter((i) => i.kind === 'topic')).toHaveLength(4)
    expect(items.filter((i) => i.kind === 'lecture')).toHaveLength(2)
    expect(items.some((i) => i.title === 'Arrhythmias')).toBe(false) // being fixed
  })
})

describe('sweepOutcome', () => {
  const items = sweepItems([topic('A', true), topic('B', true), topic('E', true)], 'Cardio', 'step1', [{ goalId: 'uni-im', short: 'IM', titles: ['L1', 'L2'] }])
  const id = (title: string) => items.find((i) => i.title === title)!.id

  it('Step 1: blank → 10 questions tomorrow, fuzzy → 5 questions in 2 days, had it → spot-checked later', () => {
    const o = sweepOutcome(items, { [id('A')]: 'blank', [id('B')]: 'fuzzy', [id('E')]: 'had' }, T)
    expect(o.tasks.map((t) => [t.title, t.date, t.minutes])).toEqual([
      ['A: 10 questions', addDays(T, 1), 10 * QBANK_MINUTES_PER_QUESTION],
      ['B: 5 questions', addDays(T, 2), 5 * QBANK_MINUTES_PER_QUESTION],
    ])
    expect(o.had.map((i) => i.title)).toEqual(['E'])
    expect(o.tasks.every((t) => t.kind === 'fix' && t.status === 'pending')).toBe(true)
  })

  it('uni lecture: blank → review tomorrow + re-sweep in 3 days; fuzzy → 10-min skim in 2 days + re-sweep in 3; had it → in 10', () => {
    const o = sweepOutcome(items, { [id('L1')]: 'blank', [id('L2')]: 'had' }, T)
    expect(o.tasks.map((t) => [t.title, t.minutes, t.date])).toEqual([['Review lecture: L1', SWEEP.lectureReviewMinutes, addDays(T, 1)]])
    expect(o.resweep.map((r) => [r.item.title, r.date])).toEqual([['L1', addDays(T, 3)], ['L2', addDays(T, 10)]])
    const fuzzy = sweepOutcome(items, { [id('L2')]: 'fuzzy' }, T)
    expect(fuzzy.tasks.map((t) => [t.title, t.minutes, t.date])).toEqual([['Skim lecture: L2', SWEEP.lectureSkimMinutes, addDays(T, 2)]])
    expect(fuzzy.resweep[0].date).toBe(addDays(T, 3))
  })

  it('a partial sweep keeps what was rated; re-applying replaces instead of duplicating', () => {
    const first = sweepOutcome(items, { [id('A')]: 'blank' }, T)
    expect(first.rated).toBe(1)
    const s1 = withSweepTasks([], items, first.tasks)
    const second = sweepOutcome(items, { [id('A')]: 'fuzzy', [id('B')]: 'blank' }, T)
    const s2 = withSweepTasks(s1, items, second.tasks)
    expect(s2).toHaveLength(2)
    expect(s2.find((t) => t.title.startsWith('A'))?.amount).toBe(5)
  })
})
