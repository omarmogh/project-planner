import { describe, expect, it } from 'vitest'
import type { EngineState, Resource } from '..'
import { planSweep } from '../../data/sweep'

const T = '2026-11-15'
const slides: Resource = { id: 'im-slides', goalId: 'im', type: 'slides', name: 'IM slides', totalUnits: 4, doneUnits: 0, unit: ['lecture', 'lectures'], minutesPerUnit: 60, doneItems: [0, 2], itemNames: ['Heart failure', 'Asthma', 'DKA', 'AKI'] }
const state = (extra: Partial<EngineState> = {}, resources: Resource[] = [slides]): EngineState =>
  ({ goals: [{ id: 'im', kind: 'uni', label: 'IM exam' }], resources, ...extra }) as unknown as EngineState

describe('Recall Sweep is the default for uni-only students', () => {
  it('lists finished, titled lectures', () => {
    const s = planSweep(state(), T, {})
    expect(s?.items.map((i) => i.id)).toEqual(['lecture-im-slides-0', 'lecture-im-slides-2'])
  })
  it('skips a lecture until its re-sweep is due', () => {
    const s = planSweep(state({ sweepDue: { 'lecture-im-slides-0': '2026-11-18' } }), T, {})
    expect(s?.items.map((i) => i.id)).toEqual(['lecture-im-slides-2'])
  })
  it('stays out of the way when the student has a QBank', () => {
    const qbank = { ...slides, id: 'uw', type: 'qbank', itemNames: undefined } as Resource
    expect(planSweep(state({}, [slides, qbank]), T, {})).toBeNull()
  })
})
