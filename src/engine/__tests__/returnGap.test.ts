import { describe, expect, it } from 'vitest'
import { DEMO_TODAY, linaState } from '../../data/demo'
import { useDemo } from '../../store/demoStore'
import { addDays, buildDay, RETURN_GAP_DAYS, totalMinutes } from '..'

const noon = (d: string) => new Date(`${d}T12:00:00`)

function back(after: number) {
  useDemo.getState().startApp(linaState(DEMO_TODAY), false, DEMO_TODAY)
  useDemo.setState({ firstNight: false, pinned: false })
  const day = addDays(DEMO_TODAY, after)
  useDemo.getState().syncDay(noon(day))
  return { s: useDemo.getState(), day }
}

describe('Back after a gap', () => {
  it(`after ${RETURN_GAP_DAYS}+ days away, the day starts light on its own, with one calm line`, () => {
    const { s, day } = back(9)
    expect(s.today).toBe(day)
    expect(buildDay(s.plan!, day).type).toBe('normal')
    expect(s.returning).toBe(true)
    expect(s.dayMode === 'light' || s.dayMode === 'essentials').toBe(true)
    expect(s.missedNote).toMatch(/^Welcome back\. After \d+ days away/)
    const full = buildDay(s.plan!, day)
    expect(totalMinutes(s.todayTasks)).toBeLessThan(totalMinutes(full.tasks))
  })

  it('one missed day keeps the full plan and the usual line', () => {
    const { s } = back(2)
    expect(s.returning).toBe(false)
    expect(s.dayMode).toBe('full')
  })

  it('"Do more" still works on the eased day', () => {
    const { s } = back(9)
    const n = s.todayTasks.length
    s.todayTasks.forEach((t) => t.status === 'pending' && useDemo.setState((x) => ({ todayTasks: x.todayTasks.map((y) => (y.id === t.id ? { ...y, status: 'done' as const } : y)) })))
    useDemo.getState().doMore()
    expect(useDemo.getState().todayTasks.length).toBe(n + 1)
  })
})
