import { describe, expect, it } from 'vitest'
import { DEMO_TODAY, linaState } from '../../data/demo'
import { useDemo } from '../../store/demoStore'
import { addDays, buildDay, dayInfo, doMore, isSmallTest, resultPrompt, windDownGoals, type EngineState } from '..'

// Lina's uni exam becomes a small dept test three days out (plus a later full exam to feed).
function withTest(small?: boolean): { s: EngineState; test: string; eve: string } {
  const base = linaState(DEMO_TODAY)
  const uni = base.goals.find((g) => g.kind === 'uni')!
  const test = addDays(DEMO_TODAY, 3)
  const goals = base.goals.map((g) => (g.id === uni.id ? { ...g, label: 'Forensic dept test', examDate: test, dateSource: 'set' as const, small } : g))
  goals.push({ ...uni, id: 'final', label: 'Phase II final', examDate: addDays(DEMO_TODAY, 60), dateSource: 'set', small: undefined })
  return { s: { ...base, goals }, test, eve: addDays(test, -1) }
}

describe('Small tests', () => {
  it('are guessed from the label; a final, an OSCE or a board exam never is; the student can override', () => {
    for (const l of ['Forensic dept test', 'Cardio quiz', 'Physics colloquium', 'كويز باطني', 'Weekly test']) expect(isSmallTest({ label: l })).toBe(true)
    for (const l of ['IM exam', 'Phase II final', 'Step 1', 'Mini-OSCE', 'Midterm test', 'امتحان نهائي', 'Surgery']) expect(isSmallTest({ label: l })).toBe(false)
    expect(isSmallTest({ label: 'IM exam', small: true })).toBe(true)
    expect(isSmallTest({ label: 'Cardio quiz', small: false })).toBe(false)
  })

  it('keep the exam day and the light eve, but no rest day after and no wind-down', () => {
    const { s, test, eve } = withTest()
    expect(dayInfo(s.goals, test).type).toBe('exam')
    expect(dayInfo(s.goals, eve)).toMatchObject({ type: 'eve', small: true })
    expect(dayInfo(s.goals, addDays(test, 1)).type).toBe('normal')
    expect(windDownGoals(s.goals, eve).map((g) => g.label)).not.toContain('Forensic dept test')
    expect(buildDay(s, eve).notes).toContain('smallTest')
  })

  it('a full exam keeps the rest day, the wind-down and the closed eve', () => {
    const { s, test, eve } = withTest(false)
    expect(dayInfo(s.goals, addDays(test, 1)).type).toBe('rest')
    expect(dayInfo(s.goals, eve).small).toBe(false)
    expect(buildDay(s, eve).notes).not.toContain('smallTest')
    const done = buildDay(s, eve).tasks.map((t) => ({ ...t, status: 'done' as const }))
    expect(doMore(s, done, eve)).toBeNull()
  })

  it('"Do more" stays open on the eve of a small test, after the light review', () => {
    const { s, eve } = withTest()
    const day = buildDay(s, eve)
    expect(day.type).toBe('eve')
    const done = day.tasks.map((t) => ({ ...t, status: 'done' as const }))
    const more = doMore(s, done, eve)
    expect(more).not.toBeNull()
    expect(more!.extra).toBe(true)
  })

  it('asks how it went the day after, feeding the next uni exam, once', () => {
    const { s, test } = withTest()
    const after = addDays(test, 1)
    expect(resultPrompt(s, after)).toMatchObject({ label: 'Forensic dept test', goalId: 'final' })
    const p = resultPrompt(s, after)!
    expect(resultPrompt({ ...s, resultsAsked: [p.key] }, after)).toBeNull()
    // A full exam set as its own goal isn't asked about this way.
    const full = withTest(false).s
    expect(resultPrompt(full, after)?.label).not.toBe('Forensic dept test')
  })

  it('"Your plan" can turn the guess around', () => {
    const { s } = withTest()
    useDemo.getState().startApp(s, false, DEMO_TODAY)
    useDemo.setState({ firstNight: false })
    const id = s.goals.find((g) => g.label === 'Forensic dept test')!.id
    useDemo.getState().editPlan({ small: { [id]: false } })
    expect(isSmallTest(useDemo.getState().plan!.goals.find((g) => g.id === id)!)).toBe(false)
  })
})
