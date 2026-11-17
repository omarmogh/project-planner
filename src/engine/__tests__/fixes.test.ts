// Tests for the fixes from docs/STUDENT_SIM_REPORT.md section 9.
import { describe, expect, it } from 'vitest'
import { DEMO_TODAY, linaState } from '../../data/demo'
import { parseScore } from '../../lib/score'
import {
  addDays, buildDay, isLateStart, lecturesDetail, lightTasks, missedLine, readiness, studiedOn, workTime,
  DAY_ENDS_HOUR, FIRST_NIGHT_FROM_HOUR, GAP_MAX_EXTRA_PER_DAY, LIGHT_DAY_MINUTES,
  type Goal, type GoalNeed, type Resource, type Session,
} from '..'
import { leadingUni } from '../planSteps'

const T = DEMO_TODAY

describe('score entry (fix 7)', () => {
  it('reads a percent, a ratio and Arabic digits', () => {
    expect(parseScore('62')).toEqual({ ok: true, percent: 62 })
    expect(parseScore('62%')).toEqual({ ok: true, percent: 62 })
    expect(parseScore('7/10')).toEqual({ ok: true, percent: 70, questions: 10 })
    expect(parseScore('7 of 10')).toEqual({ ok: true, percent: 70, questions: 10 })
    expect(parseScore('٧/١٠')).toEqual({ ok: true, percent: 70, questions: 10 })
    expect(parseScore('٧ من ١٠')).toEqual({ ok: true, percent: 70, questions: 10 })
  })
  it('never fixes a value silently', () => {
    expect(parseScore('')).toBeNull()
    expect(parseScore('120')).toMatchObject({ ok: false })
    expect(parseScore('11/10')).toMatchObject({ ok: false })
    expect(parseScore('-5')).toMatchObject({ ok: false })
    expect(parseScore('3/0')).toMatchObject({ ok: false })
  })
})

describe('studied minutes (fix 5)', () => {
  it('counts the day’s sessions, not imported results', () => {
    const s = (minutes: number, extra: Partial<Session> = {}): Session => ({ id: `s${minutes}`, date: T, kind: 'study', goalId: 'step1', minutes, ...extra })
    expect(studiedOn([s(30), s(45), s(60, { imported: true }), s(20, { date: addDays(T, -1) })], T)).toBe(75)
  })
})

describe('honest wording (fixes 4, 9, 11)', () => {
  it('a gap in time is rounded so it never sounds exact', () => {
    expect(workTime(12)).toBe('10 min')
    expect(workTime(2)).toBe('5 min')
    expect(workTime(100)).toBe('1 h 30 min')
    expect(workTime(130)).toBe('2 h')
    expect(workTime(400)).toBe('7 h')
  })
  it('a missed day is said about the work, once', () => {
    expect(missedLine(1)).toMatch(/^Yesterday’s tasks/)
    expect(missedLine(3)).toMatch(/^The last 3 days’ tasks/)
  })
  it('lecture progress is in the student’s own count, and hidden after "Not sure"', () => {
    const r: Resource = { id: 'im', goalId: 'im', type: 'slides', name: 'IM slides', totalUnits: 8, doneUnits: 0, unit: ['lecture', 'lectures'], minutesPerUnit: 60 }
    expect(lecturesDetail(r)).toBe('8 to go')
    expect(lecturesDetail({ ...r, doneUnits: 3 })).toBe('3 of 8 done')
    expect(lecturesDetail({ ...r, doneUnits: 3, unitsUnsure: true })).toBeUndefined()
    expect(lecturesDetail({ ...r, doneUnits: 3, unitsUnsure: true, fromSummary: true })).toBe('From the summary')
  })
})

describe('readiness in time (fix 4)', () => {
  it('a gap is minutes of work, closable only within the daily limit', () => {
    const s = linaState(T)
    for (const goal of s.goals) {
      const r = readiness(s, goal, T)
      expect(r.minutesShort).toBeGreaterThanOrEqual(0)
      expect(r.closable).toBe(r.extraPerDay <= GAP_MAX_EXTRA_PER_DAY)
      if (r.minutesShort === 0) expect(r.extraPerDay).toBe(0)
    }
  })
})

describe('the uni exam leads (fix 3)', () => {
  const goal = (id: string, kind: Goal['kind'], days: number, dateSource: Goal['dateSource'] = 'set'): Goal =>
    ({ id, kind, label: id, examDate: addDays(T, days), dateSource })
  const need = (g: Goal) => ({ goal: g, left: 600, days: 10, need: 60 }) as GoalNeed
  it('a near uni exam leads when the board exam is far or undated', () => {
    const im = goal('im', 'uni', 20)
    expect(leadingUni([need(im), need(goal('step1', 'step1', 200))], T)?.id).toBe('im')
    expect(leadingUni([need(im), need(goal('step1', 'step1', 40, 'projected'))], T)?.id).toBe('im')
  })
  it('not when the board exam is close after it, the uni exam is far, or it is alone', () => {
    expect(leadingUni([need(goal('im', 'uni', 20)), need(goal('step1', 'step1', 50))], T)).toBeUndefined()
    expect(leadingUni([need(goal('im', 'uni', 60)), need(goal('step1', 'step1', 300))], T)).toBeUndefined()
    expect(leadingUni([need(goal('im', 'uni', 20))], T)).toBeUndefined()
  })
})

describe('first night (fix 15)', () => {
  it('late evening and after midnight count, the afternoon does not', () => {
    expect(isLateStart(FIRST_NIGHT_FROM_HOUR)).toBe(true)
    expect(isLateStart(23)).toBe(true)
    expect(isLateStart(DAY_ENDS_HOUR - 1)).toBe(true)
    expect(isLateStart(DAY_ENDS_HOUR)).toBe(false)
    expect(isLateStart(FIRST_NIGHT_FROM_HOUR - 1)).toBe(false)
  })
  it('the first night is one short task, the highest-impact one first', () => {
    const s = linaState(T)
    const day = buildDay(s, T)
    const night = lightTasks(s, day.tasks, 'light')
    expect(night.length).toBeGreaterThanOrEqual(1)
    expect(night.length).toBeLessThan(day.tasks.length)
    const rest = night.slice(1).reduce((n, t) => n + t.minutes, night[0].minutes)
    expect(rest <= LIGHT_DAY_MINUTES || night.length === 1).toBe(true)
  })
})
