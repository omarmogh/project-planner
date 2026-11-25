import { describe, expect, it } from 'vitest'
import { applyCompletion, chooseLectures, doneLectures, lectureQueue, lecturesTitle, lecturesTitleFor, setLectureDone, switchLectureTask, uniWork } from '../index'
import type { EngineState, Goal, Resource, Task } from '../types'

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

describe('"Not right? Change it" corrects progress, not the course', () => {
  const two = setLectureDone(setLectureDone(slides, 0, true), 1, true)
  it('more left unticks the latest done lectures; the total stays', async () => {
    const { correctLecturesLeft } = await import('../index')
    const r = correctLecturesLeft(two, 4)
    expect(r.totalUnits).toBe(5)
    expect([...doneLectures(r)]).toEqual([0])
  })
  it('fewer left ticks the next ones', async () => {
    const { correctLecturesLeft } = await import('../index')
    const r = correctLecturesLeft(two, 1)
    expect(r.totalUnits).toBe(5)
    expect(r.doneUnits).toBe(4)
  })
  it('more left than the course has: nothing done, a bigger course', async () => {
    const { correctLecturesLeft } = await import('../index')
    const r = correctLecturesLeft(two, 8)
    expect(r.totalUnits).toBe(8)
    expect(r.doneUnits).toBe(0)
  })
  it('a guessed course size is replaced', async () => {
    const { correctLecturesLeft } = await import('../index')
    const r = correctLecturesLeft({ ...two, unitsUnsure: true }, 10)
    expect(r.totalUnits).toBe(12)
    expect(r.unitsUnsure).toBeUndefined()
  })
})

describe('switch lectures: fewer is fine', () => {
  const D = '2026-11-22'
  const task: Task = {
    id: 'lec', date: D, kind: 'study', goalId: 'im', resourceId: slides.id, title: lecturesTitle(slides, 2),
    reason: '', minutes: 120, amount: 2, items: [0, 1], status: 'pending',
  }

  it('a 2-lecture task switched to one covers just that one and gets shorter', () => {
    const out = switchLectureTask(slides, task, [3], D)
    expect(out.task).toMatchObject({ amount: 1, items: [3], minutes: 60, title: 'Lecture 4: AKI' })
    expect(out.resource.capToday).toEqual({ date: D, n: 1 })
    expect(lectureQueue(out.resource)[0]).toBe(3)
  })

  it('the same number keeps the time and sets no cap', () => {
    const out = switchLectureTask(slides, task, [4, 2], D)
    expect(out.task).toMatchObject({ amount: 2, items: [4, 2], minutes: 120 })
    expect(out.resource.capToday).toBeUndefined()
  })

  it('never more than the task held; nothing picked changes nothing', () => {
    expect(switchLectureTask(slides, task, [4, 3, 2], D).task.amount).toBe(2)
    expect(switchLectureTask(slides, task, [], D)).toEqual({ resource: slides, task })
  })

  it('the cap holds only that day: a re-plan does not grow the task back', () => {
    const capped = switchLectureTask(slides, task, [3], D).resource
    const goal = { id: 'im', kind: 'uni', label: 'IM exam', examDate: '2026-12-01', priority: 1 } as unknown as Goal
    expect(uniWork([capped], goal, D, 300, 9, 1, '', 'alone').tasks[0]).toMatchObject({ amount: 1, items: [3] })
    expect(uniWork([capped], goal, '2026-11-23', 300, 8, 1, '', 'alone').tasks[0].amount).toBeGreaterThan(1)
  })

  it('a hand-picked lecture is named by its number when the list has no titles', () => {
    const plain = { ...slides, itemNames: undefined }
    expect(lecturesTitleFor(plain, [0])).toBe('IM slides: next lecture')
    expect(lecturesTitleFor(plain, [3])).toBe('IM slides: lecture 4')
  })
})
