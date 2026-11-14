import { describe, expect, it } from 'vitest'
import {
  accuracyBySystem, addDays, applyFixDone, applyRetest, band, buildDay, changeFix, dayContext,
  daysBetween, goalPace, planFix, resourcePace, systemTopicId, totalMinutes, verdict, weeklyReport,
  type Availability, type Resource, type Session, type Topic,
} from '..'

const T = '2026-11-15' // a Sunday

const avail: Availability = { weekdayMinutes: 180, weekendMinutes: 300, callDays: [6, 3], weekendDays: [5, 6] }

describe('dates', () => {
  it('adds and diffs days across month ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(daysBetween(T, '2027-01-12')).toBe(58)
  })
})

describe('dayContext', () => {
  it('post-call day gets 70% of a weekday, rounded to 5', () => {
    expect(dayContext(avail, T)).toEqual({ kind: 'postCall', minutes: 125 })
  })
  it('call day only leaves Anki time', () => {
    expect(dayContext(avail, '2026-11-18').kind).toBe('call')
    expect(dayContext(avail, '2026-11-18').minutes).toBe(30)
  })
  it('weekend uses weekend hours', () => {
    expect(dayContext(avail, '2026-11-20')).toEqual({ kind: 'weekend', minutes: 300 })
  })
})

const uworld: Resource = {
  id: 'uworld', goalId: 'step1', type: 'qbank', name: 'UWorld', totalUnits: 3600, doneUnits: 2150,
  unit: ['question', 'questions'], minutesPerUnit: 2, startedOn: addDays(T, -91),
}

describe('pace', () => {
  it('follows the brief formulas', () => {
    const p = resourcePace(uworld, '2027-01-12', T)
    expect(p.remaining).toBe(1450)
    expect(p.requiredPerDay).toBe(25)
    expect(p.daysLate).toBe(4)
    expect(p.extraPerDay).toBe(2)
  })
  it('has no pace without history', () => {
    const p = resourcePace({ ...uworld, startedOn: undefined }, '2027-01-12', T)
    expect(p.perDay).toBeNull()
    expect(p.daysLate).toBe(0)
  })
  it('verdict reads as one sentence + fix', () => {
    const v = verdict(goalPace({ id: 'step1', kind: 'step1', label: 'Step 1', examDate: '2027-01-12' }, [uworld], T))
    expect(v.headline).toBe('Step 1: 4 days behind on UWorld.')
    expect(v.detail).toBe('+2 questions a day fixes it.')
  })
})

describe('accuracy', () => {
  const s: Session[] = [
    { id: '1', date: T, kind: 'study', goalId: 'g', system: 'Cardio', minutes: 40, questions: 20, correct: 10 },
    { id: '2', date: T, kind: 'study', goalId: 'g', system: 'Renal', minutes: 40, questions: 20, correct: 15 },
  ]
  it('sorts lowest first', () => {
    expect(accuracyBySystem(s, T, T).map((a) => [a.system, a.pct])).toEqual([['Cardio', 50], ['Renal', 75]])
  })
  it('bands', () => {
    expect(band(52)).toBe('weak')
    expect(band(57)).toBe('borderline')
    expect(band(60)).toBe('solid')
  })
})

const topics: Topic[] = [
  { id: 'hf', system: 'Cardio', name: 'Heart failure', status: 'unknown' },
  { id: 'arr', system: 'Cardio', name: 'Arrhythmias', status: 'unknown' },
]
const ctx = { topics, resources: [uworld], anki: { goalId: 'step1', name: 'Anki', newCardsLeft: 1000, reviewMinutes: 25 } }

describe('planFix', () => {
  const block = { date: T, goalId: 'step1', system: 'Cardio', questions: 20, correct: 10 }
  it('tapped topics become the fix, tomorrow; retest 3 days after', () => {
    const f = planFix({ ...block, weakTopicIds: ['hf'] }, ctx)!
    expect(f.scope).toBe('topics')
    expect(f.fix.date).toBe('2026-11-16')
    expect(f.retest.date).toBe('2026-11-19')
    expect(f.fix.reason).toBe('You marked heart failure as weak')
    expect(f.fix.title).toBe('Review your wrong heart failure answers and make 5 Anki cards')
    expect(f.retest.title).toBe('Retest: 10 heart failure questions')
  })
  it('no taps and < 60% → whole system, never claims a topic', () => {
    const f = planFix({ ...block, weakTopicIds: [] }, ctx)!
    expect(f.scope).toBe('system')
    expect(f.topicIds).toEqual([systemTopicId('Cardio')])
    expect(f.fix.reason).toBe('Cardio block: 50%')
    expect(f.fix.title).toBe('Review your wrong Cardio answers and make 5 Anki cards')
  })
  it('no taps and ≥ 60% → nothing to fix', () => {
    expect(planFix({ ...block, correct: 13, weakTopicIds: [] }, ctx)).toBeNull()
  })
  it('change fix swaps action but keeps reason and date', () => {
    const f = planFix({ ...block, weakTopicIds: ['hf'] }, ctx)!
    const c = changeFix(f.fix, f.options[1])
    expect(c.fixAction).toBe('reviewWrong')
    expect(c.reason).toBe(f.fix.reason)
    expect(c.date).toBe(f.fix.date)
  })
})

describe('retest loop', () => {
  const f = planFix({ date: T, goalId: 'step1', system: 'Cardio', questions: 20, correct: 10, weakTopicIds: ['hf'] }, ctx)!
  const weak = topics.map((t) => (t.id === 'hf' ? { ...t, status: 'weak' as const } : t))
  it('fix done → fixing', () => {
    expect(applyFixDone(weak, f.fix).find((t) => t.id === 'hf')!.status).toBe('fixing')
  })
  it('≥ 70% → solid', () => {
    const o = applyRetest(f.retest, 10, 8, '2026-11-19', { ...ctx, topics: weak })
    expect(o.passed).toBe(true)
    expect(o.topics.find((t) => t.id === 'hf')).toMatchObject({ status: 'solid', fixedOn: '2026-11-19' })
  })
  it('< 70% → weak again, new fix + retest', () => {
    const o = applyRetest(f.retest, 10, 5, '2026-11-19', { ...ctx, topics: weak })
    expect(o.passed).toBe(false)
    expect(o.fix!.date).toBe('2026-11-20')
    expect(o.retest!.date).toBe('2026-11-23')
  })
})

describe('buildDay', () => {
  const state = {
    goals: [
      { id: 'uni', kind: 'uni' as const, label: 'IM exam', examDate: addDays(T, 12) },
      { id: 'step1', kind: 'step1' as const, label: 'Step 1', examDate: addDays(T, 58) },
    ],
    resources: [
      uworld,
      { id: 'slides', goalId: 'uni', type: 'slides' as const, name: 'IM slides', totalUnits: 18, doneUnits: 13, unit: ['lecture', 'lectures'] as [string, string], minutesPerUnit: 30, startedOn: addDays(T, -21) },
    ],
    anki: { goalId: 'step1', name: 'Anki', newCardsLeft: 1150, reviewMinutes: 25 },
    availability: avail,
    topics: [...topics, { id: 'acid', system: 'Renal', name: 'Acid–base', status: 'fixing' as const }],
    sessions: [] as Session[],
    scheduled: [],
  }
  it('fits the post-call budget and puts the sooner exam first', () => {
    const d = buildDay(state, T)
    expect(d.available).toBe(125)
    expect(totalMinutes(d.tasks)).toBeLessThanOrEqual(125)
    expect(d.tasks[0].kind).toBe('anki')
    expect(d.tasks[1]).toMatchObject({ goalId: 'uni', title: 'IM slides: lecture 14', reason: 'IM exam in 12 days' })
    const q = d.tasks.find((t) => t.resourceId === 'uworld')!
    expect(q.amount).toBe(35) // nothing else due → leftover grows the block to fill the day
    expect(totalMinutes(d.tasks)).toBe(125)
  })
  it('call day only plans Anki', () => {
    const d = buildDay(state, '2026-11-18')
    expect(d.tasks.map((t) => t.kind)).toEqual(['anki'])
  })
  it('drops goals whose exam has passed', () => {
    const d = buildDay(state, addDays(T, 13))
    expect(d.tasks.every((t) => t.goalId === 'step1')).toBe(true)
  })
})

describe('weeklyReport', () => {
  it('compares the last 7 days with the 7 before', () => {
    const s: Session[] = [
      { id: '1', date: addDays(T, -10), kind: 'study', goalId: 'g', system: 'Renal', minutes: 40, questions: 20, correct: 11 },
      { id: '2', date: addDays(T, -3), kind: 'study', goalId: 'g', system: 'Renal', minutes: 40, questions: 20, correct: 14 },
      { id: '3', date: T, kind: 'study', goalId: 'g', system: 'Renal', minutes: 40, questions: 20, correct: 0 },
    ]
    const w = weeklyReport(s, [], T)
    expect(w.questions).toBe(20)
    expect(w.biggestGain).toEqual({ system: 'Renal', from: 55, to: 70 })
  })
})

describe('typed percent edge', () => {
  it('59% on 40 questions still triggers a fix', () => {
    const f = planFix({ date: T, goalId: 'step1', system: 'Cardio', questions: 40, correct: (40 * 59) / 100, weakTopicIds: [] }, ctx)
    expect(f?.fix.reason).toBe('Cardio block: 59%')
  })
})
