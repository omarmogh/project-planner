import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TIMER, addTime, addToQueue, beginBreak, breakLeft, dropFromQueue, endBreak, focusLeft, lapMinutes, openIds,
  pauseRun, resumeRun, startRun, switchTask, taskMs, tickCurrent, tickOther, worked,
} from './session'

const MIN = 60_000
const POMO = { ...DEFAULT_TIMER, mode: 'pomodoro' as const }

describe('session timer', () => {
  it('ticks tasks one by one, each with its own time', () => {
    let r = startRun(['a', 'b', 'c'], 0, DEFAULT_TIMER)
    const t1 = tickCurrent(r, 10 * MIN)
    expect(t1.next).toBe('b')
    r = t1.run
    expect(r.laps).toEqual([{ taskId: 'a', at: 10 * MIN, ms: 10 * MIN }])
    expect(taskMs(r, 25 * MIN)).toBe(15 * MIN)
    r = tickCurrent(r, 25 * MIN).run
    const end = tickCurrent(r, 30 * MIN)
    expect(end.next).toBeNull()
    expect(end.run.laps!.map((l) => l.ms)).toEqual([10 * MIN, 15 * MIN, 5 * MIN])
  })

  it('pauses do not count', () => {
    let r = startRun(['a'], 0, DEFAULT_TIMER)
    r = pauseRun(r, 5 * MIN)
    r = resumeRun(r, 20 * MIN)
    expect(worked(r, 25 * MIN)).toBe(10 * MIN)
  })

  it('switching keeps the time with the task that was left', () => {
    let r = startRun(['a', 'b'], 0, DEFAULT_TIMER)
    r = switchTask(r, 'b', 4 * MIN)
    expect(taskMs(r, 10 * MIN)).toBe(6 * MIN)
    r = switchTask(r, 'a', 10 * MIN)
    expect(taskMs(r, 12 * MIN)).toBe(6 * MIN) // 4 earlier + 2 now
    const { run, next } = tickCurrent(r, 12 * MIN)
    expect(next).toBe('b')
    expect(taskMs(run, 12 * MIN)).toBe(6 * MIN) // b's earlier stretch is still there
  })

  it('ticks another task without moving the timer, and wraps to the first open one', () => {
    let r = startRun(['a', 'b', 'c'], 0, DEFAULT_TIMER)
    r = switchTask(r, 'c', 0)
    r = tickOther(r, 'b', 1 * MIN)
    expect(r.taskId).toBe('c')
    expect(openIds(r)).toEqual(['a', 'c'])
    expect(tickCurrent(r, 5 * MIN).next).toBe('a')
  })

  it('adds and drops tasks, never the current or a ticked one', () => {
    let r = startRun(['a', 'b'], 0, DEFAULT_TIMER)
    r = addToQueue(r, 'c')
    expect(r.queue).toEqual(['a', 'b', 'c'])
    expect(dropFromQueue(r, 'a')).toBe(r)
    expect(dropFromQueue(r, 'c').queue).toEqual(['a', 'b'])
    expect(addTime(addTime(r, 'a', 5), 'a', 5).extra).toEqual({ a: 10 })
  })

  it('under a minute counts the planned minutes', () => {
    expect(lapMinutes(20_000, 30)).toBe(30)
    expect(lapMinutes(14.6 * MIN, 30)).toBe(15)
  })

  it('pomodoro: breaks never count as study time; long break every N', () => {
    let r = startRun(['a'], 0, POMO)
    expect(focusLeft(r, 10 * MIN, POMO)).toBe(15 * 60)
    for (let i = 1; i <= 4; i++) {
      const at = r.startedAt + r.pausedMs + i * 25 * MIN
      r = beginBreak(r, at, POMO)
      const b = r.pomo!.breakMin!
      expect(b).toBe(i === 4 ? 15 : 5)
      expect(breakLeft(r, at + MIN)).toBe((b - 1) * 60)
      r = endBreak(r, at + b * MIN)
      expect(focusLeft(r, at + b * MIN, POMO)).toBe(25 * 60)
    }
    expect(worked(r, r.startedAt + r.pausedMs + 100 * MIN)).toBe(100 * MIN)
  })
})

describe('ending a session is honest', () => {
  const prefs = { mode: 'timer' as const, focus: 25, short: 5, long: 15, every: 4, autoFocus: false }
  const min = 60_000
  const planned: Record<string, number> = { a: 40, b: 30, c: 20 }
  const of = (id: string) => planned[id]
  it('a task ticked well before its time asks how far; one near its time is done', async () => {
    const { startRun, tickCurrent, sessionReports } = await import('./session')
    let r = startRun(['a', 'b', 'c'], 0, prefs)
    r = tickCurrent(r, 10 * min).run // a: 10 of 40 min
    r = tickCurrent(r, 38 * min).run // b: 28 of 30 min
    const out = sessionReports(r, 38 * min, of)
    expect(out[0]).toMatchObject({ taskId: 'a', minutes: 10, ticked: true, early: true })
    expect(out[1]).toMatchObject({ taskId: 'b', minutes: 28, ticked: true })
    expect(out[1].early).toBeUndefined()
  })
  it('End session keeps the current task\'s time; a false start saves nothing', async () => {
    const { startRun, tickCurrent, sessionReports, savesSomething } = await import('./session')
    const r0 = startRun(['a', 'b'], 0, prefs)
    expect(savesSomething(r0, 2 * min)).toBe(false)
    expect(sessionReports(r0, 2 * min, of)).toEqual([])
    expect(sessionReports(r0, 15 * min, of)).toEqual([{ taskId: 'a', minutes: 15, ticked: false }])
    const r = tickCurrent(r0, 30 * min).run
    expect(sessionReports(r, 42 * min, of).map((x) => [x.taskId, x.ticked, x.minutes])).toEqual([['a', true, 30], ['b', false, 12]])
  })
  it('a tick under a minute is done some other way: planned minutes, not early', async () => {
    const { startRun, tickCurrent, sessionReports } = await import('./session')
    const r = tickCurrent(startRun(['a'], 0, prefs), 20_000).run
    expect(sessionReports(r, 20_000, of)).toEqual([{ taskId: 'a', minutes: 40, ticked: true }])
  })
})
