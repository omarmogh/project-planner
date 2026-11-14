import { describe, expect, it } from 'vitest'
import { DEMO_TODAY, linaState } from '../../data/demo'
import { weekdayName, buildDay, goalPace, recentAccuracy, topicCounts, totalMinutes, verdict, weeklyReport, addDays } from '..'

// Lina's story must hold on any date the demo is opened, so check several.
const dates = ['2026-11-15', '2026-11-19', '2026-12-02']

describe.each(dates)('Lina on %s', (today) => {
  const s = linaState(today)
  it('today is post-call and fits the time', () => {
    const d = buildDay(s, today)
    expect(d.kind).toBe('postCall')
    expect(totalMinutes(d.tasks)).toBeLessThanOrEqual(d.available)
    const kinds = d.tasks.map((t) => t.kind)
    expect(kinds).toContain('fix')
    expect(kinds).toContain('retest')
    expect(d.tasks.find((t) => t.kind === 'retest')!.reason).toBe('Retest due today')
  })
  it('pace verdicts', () => {
    const [im, step1] = s.goals.map((g) => verdict(goalPace(g, s.resources, today)))
    expect(im.headline).toBe('IM exam: on track.')
    expect(step1.headline).toBe('Step 1: 4 days behind on UWorld.')
    expect(step1.detail).toBe('+2 questions a day fixes it.')
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

it('the pinned post-call Sunday plan: 2 h 05 min, exactly', () => {
  const d = buildDay(linaState(DEMO_TODAY), DEMO_TODAY)
  expect(d.kind).toBe('postCall')
  expect(d.available).toBe(125)
  expect(totalMinutes(d.tasks)).toBe(125)
  expect(d.tasks.map((t) => [t.title, t.minutes, t.reason])).toEqual([
    ['Anki reviews', 30, '20 new cards a day finishes your deck in time'],
    ['IM slides: lecture 14', 30, 'IM exam in 12 days'],
    ['Review your wrong glomerular disease answers and make 5 Anki cards', 20, "From Thursday's Renal block"],
    ['Retest: 10 acid–base questions', 15, 'Retest due today'],
    ['UWorld: 10 Cardio questions + review', 30, 'Your lowest accuracy (52%)'],
  ])
})
