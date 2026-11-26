import { describe, expect, it } from 'vitest'
import { DEMO_TODAY, linaState } from '../../data/demo'
import {
  addDays, blendEstimate, buildDay, estimates, firstNightTasks, lightDayOffer, lightTasks, lightDayNote, roughPatch,
  ESSENTIAL_TASKS, ESTIMATE_MAX_STEP, LIGHT_DAY_MINUTES, LIGHT_OFFERS_PER_WEEK,
  type EngineState, type LightOffer, type Session, type TaskOutcome,
} from '..'

const T = DEMO_TODAY
const lina = linaState(T)
// Lina with nothing going wrong: no skipped or partly-done tasks.
const calm: EngineState = { ...lina, outcomes: [] }
const missed = (date: string, n: number): TaskOutcome[] =>
  Array.from({ length: n }, (_, i) => ({ date, taskId: `${date}-t${i}`, result: i % 2 ? 'skipped' : 'partly' }))

describe('rough patch detection', () => {
  it('a normal stretch is not rough', () => {
    expect(roughPatch(calm, T)).toBeNull()
    expect(lightDayOffer(calm, T)).toBeNull()
  })
  it('two skipped / partly answers in the last 2 days', () => {
    expect(roughPatch({ ...calm, outcomes: missed(addDays(T, -2), 2) }, T)).toMatchObject({ misses: 2 })
    // Older than the window: forgotten.
    expect(roughPatch({ ...calm, outcomes: missed(addDays(T, -3), 3) }, T)).toBeNull()
  })
  it('a one-off long shift today or yesterday; a repeating one is just the normal week', () => {
    const shift = { id: 's', kind: 'busy' as const, title: 'Shift', tag: 'uni' as const, date: addDays(T, -1), from: '20:00', to: '08:00', createdOn: T }
    expect(roughPatch({ ...calm, commitments: [shift] }, T)).toMatchObject({ longShift: true })
    expect(roughPatch({ ...calm, commitments: [{ ...shift, date: addDays(T, -2) }] }, T)).toBeNull()
    expect(roughPatch({ ...calm, commitments: [{ ...shift, repeat: [1, 2, 3] }] }, T)).toBeNull()
  })
  it('a clear score drop against the usual %', () => {
    const bad: Session = { id: 'bad', date: addDays(T, -1), kind: 'study', goalId: 'step1', resourceId: 'uworld', system: 'Renal', minutes: 60, questions: 20, correct: 6 }
    expect(roughPatch({ ...calm, sessions: [...calm.sessions, bad] }, T)?.scoreDrop).toBeGreaterThanOrEqual(15)
  })
  it('two quiet days after a busy week', () => {
    const sessions = calm.sessions.filter((x) => x.date < addDays(T, -2))
    expect(roughPatch({ ...calm, sessions }, T)).toMatchObject({ missedDays: true })
  })
})

describe('light-day limits', () => {
  const offer = (daysAgo: number, kind: LightOffer['kind'] = 'light'): LightOffer => ({ date: addDays(T, -daysAgo), kind, answer: 'light' })
  it('offered once a day', () => {
    expect(lightDayOffer({ ...lina, lightOffers: [{ date: T, kind: 'light', answer: 'full' }] }, T)).toBeNull()
  })
  it(`at most ${LIGHT_OFFERS_PER_WEEK} light days in 7 days; after that, encouragement instead`, () => {
    expect(lightDayOffer({ ...lina, lightOffers: [offer(2)] }, T)?.kind).toBe('light')
    expect(lightDayOffer({ ...lina, lightOffers: [offer(2), offer(4)] }, T)).toEqual({ kind: 'firstOnly', restAllowed: false })
    // A week later the limit is back.
    expect(lightDayOffer({ ...lina, lightOffers: [offer(7), offer(9)] }, T)?.kind).toBe('light')
    // "Just the first task" doesn't count toward the limit.
    expect(lightDayOffer({ ...lina, lightOffers: [offer(2), offer(3, 'firstOnly')] }, T)?.kind).toBe('light')
  })
  it('within 5 days of an exam: never a break, essentials only', () => {
    const goals = lina.goals.map((g) => (g.id === 'uni-im' ? { ...g, examDate: addDays(T, 5) } : g))
    expect(lightDayOffer({ ...lina, goals }, T)).toEqual({ kind: 'essentials', restAllowed: false })
    const later = lina.goals.map((g) => (g.id === 'uni-im' ? { ...g, examDate: addDays(T, 6) } : g))
    expect(lightDayOffer({ ...lina, goals: later }, T)?.kind).toBe('light')
  })
  it('a rest day only when ahead of schedule', () => {
    expect(lightDayOffer(lina, T)?.restAllowed).toBe(true)
    // 100 lectures left for an exam in 12 days: not ahead.
    const resources = lina.resources.map((r) => (r.id === 'slides-im' ? { ...r, totalUnits: 100, doneUnits: 0 } : r))
    expect(lightDayOffer({ ...lina, resources }, T)).toEqual({ kind: 'light', restAllowed: false })
  })
})

describe('light-day plans', () => {
  const tasks = buildDay(lina, T).tasks
  it(`light: Anki is the last thing cut; then whatever still fits about ${LIGHT_DAY_MINUTES} min`, () => {
    const kept = lightTasks(lina, tasks, 'light')
    expect(kept.map((t) => t.kind)).toEqual(['anki'])
    // Without Anki, the due retest is what stays.
    const noAnki = tasks.filter((t) => t.kind !== 'anki')
    const light = lightTasks(lina, noAnki, 'light')
    expect(light.map((t) => t.kind)).toEqual(['retest'])
    expect(light.reduce((n, t) => n + t.minutes, 0)).toBeLessThanOrEqual(LIGHT_DAY_MINUTES)
  })
  it(`essentials: the ${ESSENTIAL_TASKS} highest-impact tasks`, () => {
    // Anki, then the nearest exam's own work (the IM lecture), before another goal's retest.
    const kept = lightTasks(lina, tasks, 'essentials')
    expect(kept.map((t) => t.kind)).toEqual(['anki', 'study'])
    expect(kept[1].goalId).toBe('uni-im')
  })
  it('first night: one short task, but never only Anki when an exam is close', () => {
    expect(firstNightTasks(lina, tasks, T).map((t) => t.kind)).toEqual(['anki'])
    const goals = lina.goals.map((g) => (g.id === 'uni-im' ? { ...g, examDate: addDays(T, 2) } : g))
    const close = { ...lina, goals }
    const kept = firstNightTasks(close, buildDay(close, T).tasks, T)
    expect(kept.map((t) => t.kind)).toEqual(['anki', 'study'])
    expect(kept[1].goalId).toBe('uni-im')
  })
  it('first task only: the plan stays as it is', () => {
    expect(lightTasks(lina, tasks, 'firstOnly')).toBe(tasks)
  })
  it('a light day cuts the day and says how much moved: nothing is rescheduled by hand, dropped work stays due and the next day picks it up', () => {
    const kept = new Set(lightTasks(lina, tasks, 'light').map((t) => t.id))
    const dropped = tasks.filter((t) => !kept.has(t.id))
    const r = lightDayNote(lina, dropped, T)
    expect(dropped.some((t) => t.id === 'seed-fix-glom')).toBe(true)
    expect(buildDay(lina, addDays(T, 1)).tasks.some((t) => t.id === 'seed-fix-glom')).toBe(true)
    expect(r.moved).toBe(dropped.filter((t) => t.kind !== 'anki').reduce((n, t) => n + t.minutes, 0))
    expect(r.days).toBe(7)
    expect(r.perDay * r.days).toBeGreaterThanOrEqual(r.moved)
    expect(r.perDay % 5).toBe(0)
  })
})

describe('time estimates blend toward real timer minutes', () => {
  const start = { factor: 1, n: 0 }
  it('moves toward the real time, a little each session', () => {
    let b = start
    const seen: number[] = []
    for (let i = 0; i < 12; i++) {
      b = blendEstimate(b, 45, Math.round(30 * b.factor))
      seen.push(b.factor)
    }
    expect(seen[0]).toBeGreaterThan(1)
    expect(seen.every((f, i) => i === 0 || f >= seen[i - 1] - 0.01)).toBe(true)
    expect(seen.at(-1)!).toBeGreaterThan(1.35)
    expect(seen.at(-1)!).toBeLessThanOrEqual(1.5 + 0.05)
  })
  it('never jumps more than the step cap per session', () => {
    const b = blendEstimate(start, 85, 30)
    expect(b.factor - 1).toBeLessThanOrEqual(ESTIMATE_MAX_STEP + 1e-9)
    expect(1 - blendEstimate(start, 12, 30).factor).toBeLessThanOrEqual(ESTIMATE_MAX_STEP + 1e-9)
  })
  it('ignores outliers: a task left running for 3 hours', () => {
    expect(blendEstimate(start, 180, 30)).toEqual(start)
    expect(blendEstimate(start, 2, 30)).toEqual(start)
  })
  it('Pace and plans always use the current estimate, from finished tasks only', () => {
    expect(estimates(lina)).toEqual({ topic: 1, lectures: 1, questions: 1 })
    const slow: Session[] = Array.from({ length: 6 }, (_, i) => ({
      id: `s${i}`, date: addDays(T, -6 + i), kind: 'study', goalId: 'uni-im', resourceId: 'slides-im', minutes: 45, planned: 30,
    }))
    const e = estimates({ ...lina, sessions: [...lina.sessions, ...slow] })
    expect(e.lectures).toBeGreaterThan(1.2)
    expect(e.topic).toBe(1)
    const imported = slow.map((x) => ({ ...x, imported: true }))
    expect(estimates({ ...lina, sessions: imported }).lectures).toBe(1)
  })
})
