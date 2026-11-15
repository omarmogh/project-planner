import { describe, expect, it } from 'vitest'
import { addDays, overconfidence, rateConfident, CONFIDENCE_REVIEW_MINUTES, CONFIDENCE_WINDOW_DAYS } from '..'
import { linaState } from '../../data/demo'

const T = '2026-11-15'
const HF = 'cardio-heart-failure'

describe('overconfidence', () => {
  const base = linaState(T)
  const s = { ...base, confident: rateConfident([], HF, true, addDays(T, -3)) }

  it('"Had it", then under 60% → one gentle note and a short review tomorrow', () => {
    const o = overconfidence(s, [{ topicId: HF, score: 40 }], T)
    expect(o.note).toEqual({ topicId: HF, name: 'Heart failure', score: 40 })
    expect(o.review).toMatchObject({ kind: 'fix', date: addDays(T, 1), minutes: CONFIDENCE_REVIEW_MINUTES, topicIds: [HF], title: 'Short review: Heart failure' })
    expect(o.confident[0].noted).toBe(true)
    // Shown once.
    expect(overconfidence({ ...s, confident: o.confident }, [{ topicId: HF, score: 30 }], T).note).toBeNull()
  })

  it('no review when a fix from the block already covers it', () => {
    const o = overconfidence(s, [{ topicId: HF, score: 40 }], T, [HF])
    expect(o.note).not.toBeNull()
    expect(o.review).toBeNull()
  })

  it('nothing at 60% or more, for topics not rated "Had it", or long after the sweep', () => {
    expect(overconfidence(s, [{ topicId: HF, score: 60 }], T).note).toBeNull()
    expect(overconfidence(s, [{ topicId: 'cardio-arrhythmias', score: 20 }], T).note).toBeNull()
    expect(overconfidence(s, [{ topicId: HF, score: 20 }], addDays(T, CONFIDENCE_WINDOW_DAYS)).note).toBeNull()
  })

  it('re-rating Fuzzy/Blank in the sweep removes it', () => {
    const c = rateConfident(s.confident, HF, false, T)
    expect(c).toEqual([])
  })
})
