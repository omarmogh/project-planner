import { describe, expect, it } from 'vitest'
import { applyCompletion, chooseLectures, doneLectures, lectureQueue, lecturesTitle, setLectureDone } from '../index'
import type { EngineState, Resource, Task } from '../types'

const slides: Resource = {
  id: 'im-slides', goalId: 'im', type: 'slides', name: 'IM slides', totalUnits: 5, doneUnits: 0,
  unit: ['lecture', 'lectures'], minutesPerUnit: 60, itemNames: ['Heart failure', 'Asthma', 'COPD', 'AKI', 'DKA'],
}

describe('lectures ticked one by one (the Board)', () => {
  it('older saves count the first lectures as done', () => {
    expect([...doneLectures({ ...slides, doneUnits: 2 })]).toEqual([0, 1])
    expect(lectureQueue({ ...slides, doneUnits: 2 })).toEqual([2, 3, 4])
  })

  it('ticking a lecture out of order leaves it out of the plan and moves the count', () => {
    const r = setLectureDone(slides, 3, true)
    expect(r.doneUnits).toBe(1)
    expect(lectureQueue(r)).toEqual([0, 1, 2, 4])
    expect(lecturesTitle(r, 1)).toBe('Lecture 1: Heart failure')
    const back = setLectureDone(r, 3, false)
    expect(back.doneUnits).toBe(0)
    expect(lectureQueue(back)).toEqual([0, 1, 2, 3, 4])
  })

  it('ticking twice changes nothing', () => {
    const r = setLectureDone(slides, 1, true)
    expect(setLectureDone(r, 1, true)).toBe(r)
  })

  it('a half-done lecture keeps its half unless it is the one ticked', () => {
    const half = { ...slides, doneUnits: 0.5 }
    expect(setLectureDone(half, 2, true).doneUnits).toBe(1.5)
    expect(setLectureDone(half, 0, true).doneUnits).toBe(1)
  })
})

describe('switch lecture', () => {
  it('the chosen lectures go first, with their own numbers', () => {
    const r = chooseLectures(slides, [4])
    expect(lectureQueue(r)).toEqual([4, 0, 1, 2, 3])
    expect(lecturesTitle(r, 1)).toBe('Lecture 5: DKA')
    expect(lecturesTitle(r, 2)).toBe('Lectures 5, 1: DKA, Heart failure')
  })

  it('done lectures cannot be chosen', () => {
    expect(chooseLectures(setLectureDone(slides, 4, true), [4]).upNext).toBeUndefined()
  })

  it('finishing the task ticks the lectures it covered, not the first ones in the list', () => {
    const r = chooseLectures(slides, [4])
    const s = { resources: [r] } as unknown as EngineState
    const task: Task = {
      id: 't', date: '2026-11-22', kind: 'study', goalId: 'im', resourceId: r.id, title: lecturesTitle(r, 1),
      reason: '', minutes: 60, amount: 1, items: [4], status: 'pending',
    }
    const out = applyCompletion(s, task, 'done', '2026-11-22').resources[0]
    expect(out.doneUnits).toBe(1)
    expect([...doneLectures(out)]).toEqual([4])
    expect(out.upNext).toBeUndefined()
    expect(lectureQueue(out)).toEqual([0, 1, 2, 3])
  })
})
