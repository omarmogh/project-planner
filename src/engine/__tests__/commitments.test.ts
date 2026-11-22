import { describe, expect, it } from 'vitest'
import {
  addDays, applyCompletion, buildDay, busyCost, reportTask, busyReduction, capacity, learnStudyWindow, deadlinePlan, linkedTopicIds, parseCommitment, previewTomorrow,
  topicQueue, totalMinutes, DEADLINE_MIN_CHUNK, type Commitment, type EngineState, type Task,
} from '..'
import { linaState } from '../../data/demo'
import { TOPICS, topicId } from '../../data/topics'
import { TOPIC_ALIASES } from '../../data/topicAliases'

const T = '2026-11-15' // Sunday; Lina has 3 h on weekdays, Fri–Sat weekend
const THU = '2026-11-19'

const busy = (p: Partial<Commitment>): Commitment => ({ id: 'b1', kind: 'busy', title: 'Lecture', tag: 'uni', date: T, createdOn: T, ...p })
const deadline = (p: Partial<Commitment>): Commitment => ({ id: 'd1', kind: 'deadline', title: 'Seminar on DKA', tag: 'uni', date: THU, minutes: 180, createdOn: T, ...p })
const withC = (s: EngineState, ...c: Commitment[]): EngineState => ({ ...s, commitments: c })

describe('busy time reduces capacity', () => {
  it('busy time costs a quarter of its length while the evening still has room for the plan', () => {
    expect(busyReduction([busy({ from: '10:00', to: '12:00' })], T, 180)).toBe(30)
    expect(busyReduction([busy({ from: '18:00', to: '19:00' })], T, 180)).toBe(15)
    // 15:00–17:00: one hour before the evening window (15 min), one inside it with room left (15).
    expect(busyReduction([busy({ from: '15:00', to: '17:00' })], T, 180)).toBe(30)
  })

  it('cuts the plan only when the free part of the window is shorter than the plan', () => {
    // Late studier on a rotation (20:00–01:00 free), duty 18–22, 2 h plan: 3 h free after duty → 30 min (fatigue), not the whole day.
    expect(busyReduction([busy({ title: 'Duty', from: '18:00', to: '22:00' })], T, 120, { window: 'late', rotationUntil: '2026-11-30' })).toBe(30)
    // Evening, busy 16:00–23:00: 2 h free to 01:00 for a 3 h plan → 1 h cut, but never under a quarter of 7 h (105).
    expect(busyReduction([busy({ from: '16:00', to: '23:00' })], T, 180)).toBe(105)
    // Busy the whole free window → the whole day.
    expect(busyReduction([busy({ from: '16:00', to: '01:00' })], T, 180)).toBe(180)
  })

  it('two items at the same time are not counted twice', () => {
    const a = busy({ id: 'a', from: '16:00', to: '23:00' })
    const b = busy({ id: 'b', from: '17:00', to: '22:00' })
    expect(busyReduction([a, b], T, 180)).toBe(busyReduction([a], T, 180))
  })

  it('no clock time → half its length (day or evening: unknown); never more than the day; only that day', () => {
    expect(busyReduction([busy({ minutes: 90 })], T, 180)).toBe(45)
    expect(busyReduction([busy({ minutes: 600 })], T, 180)).toBe(180)
    expect(busyReduction([busy({ minutes: 90 })], addDays(T, 1), 180)).toBe(0)
  })

  it("Lecture 10–12 → Lina's 3 h becomes 2 h 30 and the plan fits it", () => {
    const s = withC(linaState(T), busy({ from: '10:00', to: '12:00' }))
    const day = buildDay(s, T)
    expect(day.busy).toBe(30)
    expect(capacity(s, T)).toBe(150)
    expect(totalMinutes(day.tasks)).toBeLessThanOrEqual(150)
    expect(totalMinutes(day.tasks)).toBeLessThan(totalMinutes(buildDay(linaState(T), T).tasks))
    expect(day.squeezed).toBe(false)
  })
})

describe('repeating busy time', () => {
  it('"Ward Mon–Sat 8–2" takes time on its weekdays from its first day on, until deleted', () => {
    const ward = busy({ from: '08:00', to: '14:00', repeat: [1, 2, 3, 4, 5, 6] })
    expect(busyReduction([ward], T, 180)).toBe(0) // Sunday: not one of its days
    expect(busyReduction([ward], addDays(T, 1), 180)).toBe(90)
    expect(busyReduction([ward], addDays(T, 8), 180)).toBe(90)
    expect(busyReduction([{ ...ward, date: addDays(T, 7) }], addDays(T, 1), 180)).toBe(0) // before it starts
  })

  it('parses ranges, lists and plurals in English and Arabic', () => {
    const r = (t: string) => parseCommitment(t, T, [], {}, [5, 6])
    expect(r('Ward Mon-Sat 8-2')).toMatchObject({ kind: 'busy', title: 'Ward', from: '08:00', to: '14:00', repeat: [1, 2, 3, 4, 5, 6] })
    expect(r('Lecture every Monday and Wednesday 10-12')).toMatchObject({ repeat: [1, 3], date: addDays(T, 1) })
    expect(r('Clinic Tuesdays 9-1')).toMatchObject({ title: 'Clinic', repeat: [2], from: '09:00', to: '13:00' })
    expect(r('Gym daily 6pm 1h').repeat).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(r('Shift weekdays 7-3')).toMatchObject({ repeat: [0, 1, 2, 3, 4], from: '07:00', to: '15:00' }) // a Fri–Sat weekend
    expect(r('دوام من الأحد للخميس 8-2')).toMatchObject({ repeat: [0, 1, 2, 3, 4], from: '08:00', to: '14:00' })
    expect(r('محاضرة كل اثنين 10-12')).toMatchObject({ repeat: [1] })
    expect(r('Seminar on DKA Thursday 3h').repeat).toBeNull()
  })

  it('a night shift runs past midnight', () => {
    expect(parseCommitment('Night shift 7pm-7am', T)).toMatchObject({ from: '19:00', to: '07:00' })
  })
})

describe('deadline work is split across the days before it', () => {
  it('3 h due Thursday → even chunks Sun–Tue, done a day early', () => {
    const { chunks, overloaded } = deadlinePlan(withC(linaState(T), deadline({})), T)
    expect(chunks.map((c) => [c.date, c.minutes])).toEqual([[T, 60], [addDays(T, 1), 60], [addDays(T, 2), 60]])
    expect(overloaded).toEqual([])
  })

  it('no chunk under the minimum: 40 min is one sitting', () => {
    const { chunks } = deadlinePlan(withC(linaState(T), deadline({ minutes: 40 })), T)
    expect(chunks).toEqual([{ commitmentId: 'd1', date: T, minutes: 40 }])
    const big = deadlinePlan(withC(linaState(T), deadline({ minutes: 100 })), T).chunks
    expect(big.every((c) => c.minutes >= DEADLINE_MIN_CHUNK)).toBe(true)
    expect(big.reduce((n, c) => n + c.minutes, 0)).toBe(100)
  })

  it('done work is not planned again; the rest re-splits over the days left', () => {
    const s = withC(linaState(T), deadline({ doneMinutes: 60 }))
    const { chunks } = deadlinePlan(s, addDays(T, 1))
    expect(chunks.map((c) => [c.date, c.minutes])).toEqual([[addDays(T, 1), 60], [addDays(T, 2), 60]])
  })

  it('shows up on Today as a normal task with its tag, before goal work', () => {
    const day = buildDay(withC(linaState(T), deadline({})), T)
    const task = day.tasks.find((t) => t.commitmentId === 'd1')!
    expect(task).toMatchObject({ title: 'Seminar on DKA', tag: 'uni', minutes: 60, reason: 'Due Thursday', kind: 'study' })
    expect(day.tasks.findIndex((t) => t.commitmentId)).toBe(1) // right after Anki
    expect(totalMinutes(day.tasks)).toBeLessThanOrEqual(180)
  })

  it('a day with too little room after busy time is skipped', () => {
    const s = withC(linaState(T), deadline({ minutes: 120 }), busy({ id: 'b2', minutes: 340 }))
    const { chunks } = deadlinePlan(s, T)
    expect(chunks.some((c) => c.date === T)).toBe(false)
    expect(chunks.reduce((n, c) => n + c.minutes, 0)).toBe(120)
  })

  it('Done / Partly count toward the work; all of it done → it disappears', () => {
    const s = withC(linaState(T), deadline({}))
    const task = buildDay(s, T).tasks.find((t) => t.commitmentId)!
    const partly = applyCompletion(s, task, 'partly', T)
    expect(partly.commitments![0].doneMinutes).toBe(30)
    const last = applyCompletion(withC(s, deadline({ doneMinutes: 120 })), task, 'done', T)
    expect(last.commitments![0]).toMatchObject({ doneMinutes: 180, done: true })
    expect(buildDay(last, addDays(T, 1)).tasks.some((t) => t.commitmentId)).toBe(false)
    // Deadline work never touches topics or resources.
    expect(partly.topics).toBe(s.topics)
    expect(partly.resources).toBe(s.resources)
  })

  it("tomorrow's preview assumes today's chunk is done", () => {
    const s = withC(linaState(T), deadline({}))
    const today = buildDay(s, T).tasks
    const tomorrow = previewTomorrow(s, today, T)
    expect(tomorrow.tasks.find((t) => t.commitmentId)?.minutes).toBe(60)
    expect(previewTomorrow(s, [], T).tasks.find((t) => t.commitmentId)?.minutes).toBe(90)
  })
})

describe('topic link', () => {
  it('deadline work on a topic counts as studying it: not planned separately that week', () => {
    const s = linaState(T)
    const next = topicQueue(s, T)[0]
    const linked = withC(s, deadline({ title: 'Presentation on murmurs', topicId: next.id }))
    expect(topicQueue(linked, T).some((t) => t.id === next.id)).toBe(false)
    const day = buildDay(linked, T)
    expect(day.tasks.some((t) => t.topicId === next.id)).toBe(false)
    expect(day.tasks.find((t) => t.commitmentId)?.topicIds).toEqual([next.id])
  })

  it('the link lasts until a week after the deadline', () => {
    const c = [deadline({ topicId: 'x' })]
    expect(linkedTopicIds(c, T).has('x')).toBe(true)
    expect(linkedTopicIds(c, addDays(THU, 7)).has('x')).toBe(true)
    expect(linkedTopicIds(c, addDays(THU, 8)).has('x')).toBe(false)
  })

  it('"Seminar on DKA" links to Diabetes', () => {
    const topics = Object.entries(TOPICS).flatMap(([sys, names]) => names.map((name) => ({ id: topicId(sys, name), name })))
    expect(parseCommitment('Seminar on DKA Thursday 3h', T, topics, TOPIC_ALIASES).topicId).toBe(topicId('Endo', 'Diabetes'))
  })
})

describe('overload', () => {
  const retest: Task = { id: 'r-due', date: T, kind: 'retest', goalId: 'step1', title: 'Retest: 10 heart failure questions', reason: '', minutes: 15, amount: 10, status: 'pending', topicIds: ['cardio-heart-failure'] }

  it('commitments fill the day: study moves, due fixes and retests move to tomorrow (never dropped), and the day says so', () => {
    const base = linaState(T)
    const s = { ...withC(base, deadline({ date: addDays(T, 1), minutes: 300 })), scheduled: [...base.scheduled, retest] }
    const day = buildDay(s, T)
    expect(day.squeezed).toBe(true)
    expect(day.overloaded).toEqual(['d1'])
    expect(day.tasks.find((t) => t.commitmentId)?.minutes).toBe(300)
    // The plan never exceeds the day: what's due is listed as moved, and is still due tomorrow.
    expect(day.tasks.every((t) => t.commitmentId)).toBe(true)
    expect(day.moved.map((t) => t.id)).toEqual(expect.arrayContaining(['r-due', 'seed-retest-acid']))
    expect(day.notes).toEqual(expect.arrayContaining(['squeezed', 'moved']))
    const after = { ...s, commitments: s.commitments!.map((c) => ({ ...c, done: true })) }
    expect(buildDay(after, addDays(T, 1)).tasks.some((t) => t.id === 'seed-retest-acid')).toBe(true)
  })

  it('a day fully busy plans nothing and moves due retests to tomorrow', () => {
    const day = buildDay(withC(linaState(T), busy({ minutes: 600 })), T)
    expect(day.busy).toBe(180)
    expect(day.squeezed).toBe(true)
    expect(day.tasks).toEqual([])
    expect(day.moved.some((t) => t.id === 'seed-retest-acid')).toBe(true)
  })
})

describe('adding a commitment mid-day never overshoots the day (store re-plan)', () => {
  it('done tasks keep their time; new deadline work squeezes what is left', async () => {
    const { replanToday } = await import('..')
    const s0 = linaState(T)
    const first = buildDay(s0, T).tasks
    // The student finished the first task, then adds a 3-h seminar due Thursday.
    const tasks: Task[] = first.map((t, i) => (i === 0 ? { ...t, status: 'done' } : t))
    const s1 = withC(s0, deadline({}))
    const out = replanToday(s1, tasks, T, false)
    const study = out.tasks.filter((t) => !t.commitmentId)
    const deadlineWork = totalMinutes(out.tasks.filter((t) => t.commitmentId))
    expect(totalMinutes(study)).toBeLessThanOrEqual(180 - deadlineWork)
    expect(out.tasks.some((t) => t.id === first[0].id && t.status === 'done')).toBe(true)
    expect(totalMinutes(out.tasks)).toBeLessThanOrEqual(180)
  })

  it('a light day stays within the day too', async () => {
    const { replanToday } = await import('..')
    const s0 = linaState(T)
    const tasks = buildDay(s0, T).tasks
    const out = replanToday(withC(s0, busy({ from: '16:00', to: '01:00' })), tasks, T, true)
    expect(totalMinutes(out.tasks.filter((t) => !t.commitmentId))).toBe(0)
  })
})

describe('when the student studies (study window)', () => {
  const at = (from: string, to: string, title = 'Lecture'): Commitment => ({ id: 'x', kind: 'busy', title, tag: 'uni', date: '2026-11-15', from, to, createdOn: '2026-11-15' })
  it('evening (default): a 10–12 lecture costs a quarter; 18–20 can cost in full', () => {
    expect(busyCost(at('10:00', '12:00'))).toBe(30)
    expect(busyCost(at('18:00', '20:00'))).toBe(120)
  })
  it('late: an 18–20 lecture is outside the window; early: a 9–11 lecture is inside', () => {
    expect(busyCost(at('18:00', '20:00'), { window: 'late' })).toBe(30)
    expect(busyCost(at('09:00', '11:00'), { window: 'early' })).toBe(120)
  })
  it('a daytime ward shift on a rotation day counts 0; after the rotation it is ordinary busy time', () => {
    expect(busyCost(at('08:00', '14:00', 'Ward'), { rotationUntil: '2026-11-30' })).toBe(0)
    expect(busyCost(at('08:00', '14:00', 'Ward'), { rotationUntil: '2026-11-01' })).toBe(90)
    expect(busyCost(at('14:00', '18:00', 'Ward'), { rotationUntil: '2026-11-30' })).toBe(120)
  })
  it('learns the window from timer start times', () => {
    expect(learnStudyWindow([22 * 60, 23 * 60])).toBeNull()
    expect(learnStudyWindow(Array(10).fill(23 * 60 + 30))).toBe('late')
    expect(learnStudyWindow([...Array(4).fill(60), ...Array(6).fill(17 * 60)])).toBe('evening')
    expect(learnStudyWindow(Array(12).fill(7 * 60))).toBe('early')
    expect(learnStudyWindow([...Array(5).fill(7 * 60), ...Array(5).fill(22 * 60)])).toBe('mixed')
  })
})

describe('deadline work, repeats and fixes on full days', () => {
  const lina = linaState('2026-11-15')
  const T = '2026-11-18'
  it('"Sun/Tue/Thu" repeats on all three days; a second day word stays out of the title', () => {
    expect(parseCommitment('Ward Sun/Tue/Thu 8-2', T).repeat).toEqual([0, 2, 4])
    expect(parseCommitment('Duty today 7am to 7am tomorrow', T)).toMatchObject({ title: 'Duty', date: T })
  })
  it('work due in two days is spread over today and tomorrow, never all of it tonight', () => {
    const c: Commitment = { id: 'c1', kind: 'deadline', title: 'Review epilepsy', tag: 'uni', date: addDays(T, 2), minutes: 120, createdOn: T }
    const chunks = deadlinePlan({ ...lina, commitments: [c] }, T).chunks
    expect(chunks.map((x) => x.date)).toEqual([T, addDays(T, 1)])
  })
  it('a new fix never lands on a day with no study time', () => {
    const block = buildDay(lina, T).tasks.find((t) => t.kind === 'study' && lina.resources.some((r) => r.id === t.resourceId && r.type === 'qbank'))!
    const full: Commitment = { id: 'b1', kind: 'busy', title: 'Family visit', tag: 'personal', date: addDays(T, 1), from: '14:00', to: '04:00', createdOn: T }
    const out = reportTask({ ...lina, commitments: [full] }, block, { result: 'done', questions: 20, percent: 40 }, T)
    expect(out.outcome.kind).toBe('fix')
    const fix = out.state.scheduled.find((t) => out.added.includes(t.id) && t.kind === 'fix')!
    expect(fix.date > addDays(T, 1)).toBe(true)
    if (out.outcome.kind === 'fix') expect(out.outcome.plan.fix.date).toBe(fix.date)
  })
})
