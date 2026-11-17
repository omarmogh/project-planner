import { describe, expect, it } from 'vitest'
import { DEMO_TODAY, linaState } from '../../data/demo'
import {
  addDays, buildDay, lightDayOffer, lightTasks, previewTomorrow, readiness, recentAccuracy, systemProgress, topicCounts, totalMinutes, verdict,
  weekdayName, weeklyReport, MIN_TASK_MINUTES,
} from '..'

// Lina's story must hold on any date the demo is opened, so check several.
const dates = ['2026-11-15', '2026-11-19', '2026-12-02']

describe.each(dates)('Lina on %s', (today) => {
  const s = linaState(today)
  it('today is a weekday and fits the time', () => {
    const d = buildDay(s, today)
    expect(d.kind).toBe('normal')
    expect(totalMinutes(d.tasks)).toBeLessThanOrEqual(d.available)
    const kinds = d.tasks.map((t) => t.kind)
    expect(kinds).toContain('fix')
    expect(kinds).toContain('retest')
    expect(d.tasks.find((t) => t.kind === 'retest')!.reason).toBe('Retest due today')
  })
  it('pace verdicts come from what is left and the time she has, never from exam weights', () => {
    const [im, step1] = s.goals.map((g) => verdict(readiness(s, g, today), g.id === 'uni-im' ? 5 : undefined))
    expect(im.headline).toBe('IM exam: on track.')
    expect(im.detail).toBe('5 lectures left, 1 a day is enough.')
    expect(step1.headline).toMatch(/^Step 1: (on track\.|about \d+ days? short\.)$/)
  })
  it('Cardio: 6 of 15 topics, watched 6, 1 solid (from a retest)', () => {
    expect(systemProgress(s.topics, 'Cardio')).toEqual({ system: 'Cardio', covered: 6, watched: 6, solid: 1, total: 15 })
  })
  it('Cardio is the lowest accuracy, 52%', () => {
    expect(recentAccuracy(s.sessions, today)[0]).toMatchObject({ system: 'Cardio', pct: 52 })
  })
  it('weekly: 180 questions, Renal 58% → 71%', () => {
    const w = weeklyReport(s.sessions, s.topics, today)
    expect(w.questions).toBe(180)
    expect(w.biggestGain).toEqual({ system: 'Renal', from: 58, to: 71 })
    expect(w.topicsFixed).toBe(2)
  })
  it('7 fixed, 3 open', () => {
    const c = topicCounts(s.topics, today)
    expect(c.fixed).toBe(7)
    expect(c.open).toHaveLength(3)
    expect(addDays(today, 0)).toBe(today)
  })
})

it('the demo is pinned to Sunday 15 Nov 2026', () => {
  expect(DEMO_TODAY).toBe('2026-11-15')
  expect(weekdayName(DEMO_TODAY)).toBe('Sunday')
})

it('the pinned Sunday plan: 2 h 45 min of her 3 h, planned by topic', () => {
  const d = buildDay(linaState(DEMO_TODAY), DEMO_TODAY)
  expect(d.kind).toBe('normal')
  expect(d.available).toBe(180)
  expect(totalMinutes(d.tasks)).toBe(165)
  expect(d.tasks.map((t) => [t.title, t.minutes, t.reason])).toEqual([
    ['Anki reviews', 30, '20 new cards a day finishes your deck in time'],
    ['IM slides: next lecture', 30, 'IM exam in 12 days'],
    ['Review your wrong glomerular disease answers and make 5 Anki cards', 20, "From Thursday's Renal block"],
    ['Retest: 10 acid–base questions', 15, 'Retest due today'],
    ['Cardio: Heart sounds & murmurs, part 2', 30, 'Next part of this topic'],
    ['Cardio: Heart failure', 40, 'Next in Cardio'],
  ])
  expect(d.tasks[4].steps).toEqual(['10 UWorld questions on it'])
})

it("Monday's preview assumes Sunday gets done: next lecture, the rest of heart failure, then the next topic", () => {
  const s = linaState(DEMO_TODAY)
  const sunday = buildDay(s, DEMO_TODAY)
  const monday = previewTomorrow(s, sunday.tasks, DEMO_TODAY)
  const hf = monday.tasks.find((t) => t.title === 'Cardio: Heart failure, part 2')!
  // Sunday covered the first half of heart failure; Monday finishes it.
  expect(hf.steps).toEqual([
    'B&B: Acute Heart Failure, Chronic Heart Failure',
    'First Aid: Heart failure',
    'Then 10 UWorld questions on it',
  ])
  expect(monday.tasks.find((t) => t.title === 'Cardio: Cardiomyopathies')?.detail).toBe('Continues next time')
  expect(monday.tasks.some((t) => t.title.startsWith('Cardio: Heart sounds & murmurs'))).toBe(false)
  expect(monday.tasks.every((t) => t.kind !== 'study' || t.minutes >= MIN_TASK_MINUTES)).toBe(true)
})

it('after a rough Saturday, Sunday offers a light day once; she is ahead, so a rest day is allowed', () => {
  const s = linaState(DEMO_TODAY)
  expect(lightDayOffer(s, DEMO_TODAY)).toEqual({ kind: 'light', restAllowed: true })
  const light = lightTasks(s, buildDay(s, DEMO_TODAY).tasks, 'light').filter((t) => t.status === 'pending')
  // Anki reviews are the last thing cut, even on a light day.
  expect(light.map((t) => t.title)).toEqual(['Anki reviews'])
  const answered = { ...s, lightOffers: [{ date: DEMO_TODAY, kind: 'light' as const, answer: 'full' as const }] }
  expect(lightDayOffer(answered, DEMO_TODAY)).toBeNull()
})
