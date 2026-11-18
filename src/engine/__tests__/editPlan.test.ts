import { describe, expect, it } from 'vitest'
import { DEMO_TODAY, linaState } from '../../data/demo'
import { useDemo } from '../../store/demoStore'
import { addDays, totalMinutes } from '..'

describe('Your plan: editing setup answers later', () => {
  const start = () => {
    useDemo.getState().startApp(linaState(DEMO_TODAY), false, DEMO_TODAY)
    useDemo.setState({ firstNight: false })
    return useDemo.getState()
  }

  it('less daily time re-plans today within the new time', () => {
    start().editPlan({ weekdayMinutes: 45 })
    const s = useDemo.getState()
    expect(s.plan!.availability.weekdayMinutes).toBe(45)
    expect(totalMinutes(s.todayTasks.filter((t) => t.status === 'pending'))).toBeLessThanOrEqual(s.available)
    expect(s.available).toBeLessThanOrEqual(45)
  })

  it('an exam date becomes set; a past or empty date is ignored', () => {
    const s = start()
    const g = s.plan!.goals[1]
    s.editPlan({ examDates: { [g.id]: addDays(DEMO_TODAY, 90) } })
    expect(useDemo.getState().plan!.goals[1]).toMatchObject({ examDate: addDays(DEMO_TODAY, 90), dateSource: 'set' })
    useDemo.getState().editPlan({ examDates: { [g.id]: DEMO_TODAY } })
    expect(useDemo.getState().plan!.goals[1].examDate).toBe(addDays(DEMO_TODAY, 90))
  })

  it('a later rotation end moves an exam that was only assumed at its end', () => {
    const s = start()
    const until = s.plan!.rotation!.until
    useDemo.setState({ plan: { ...s.plan!, goals: s.plan!.goals.map((g) => g.kind === 'uni' ? { ...g, examDate: until, dateSource: 'assumed' as const } : g) } })
    useDemo.getState().editPlan({ rotationUntil: addDays(until, 7) })
    const p = useDemo.getState().plan!
    expect(p.rotation!.until).toBe(addDays(until, 7))
    expect(p.goals.find((g) => g.kind === 'uni')!.examDate).toBe(addDays(until, 7))
  })
})
