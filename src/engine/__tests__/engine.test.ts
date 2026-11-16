// The rules added with docs/ENGINE_SPEC.md: exam protocol, wind-down, sharing, papers, fix-loop limits,
// rescue mode, day start / end and "Do more". The simulator (tests/sim) checks the invariants over weeks;
// these pin each rule down on one day.

import { describe, expect, it } from 'vitest'
import {
  MAX_RETEST_FAILS, PARK_DAYS, RESCUE_COOLDOWN_DAYS, RETEST_AFTER_FIX_DAYS, TOPIC_TASK_MAX_MINUTES, UNI_REVIEW_MINUTES,
  addDays, answerLight, daysBetween, applyRescue, buildDay, dayInfo, doMore, endDay, goalMinutesLeft, isPaused, narrow, paperDueDate, papersWindowShare,
  ANKI_MAX_NEW_PER_DAY, dismissRescue, statedMinutes, rescueCheck, reportTask, retestTask, fixTask, rotationEnded, startDay, studyDay, totalMinutes, windDownDaysFor, windDownGoals,
  type EngineState, type Goal, type Task,
} from '..'
import { DEMO_TODAY, linaState } from '../../data/demo'
import { buildPlanState, defaultAnswers, nextRotation, startBreak, subjectFor, timeNote } from '../../data/setup'
import { GLOBAL_DEFAULT, MUTAH, templateFor } from '../../data/universities'

const T = DEMO_TODAY // Sunday 15 Nov 2026
const lina = linaState(T) // IM exam T+12 (wind-down 7 days), Step 1 T+58
const im = lina.goals.find((g) => g.id === 'uni-im')!
const step1 = lina.goals.find((g) => g.id === 'step1')!
const kinds = (s: EngineState, d: string) => buildDay(s, d).tasks.map((t) => t.kind)

describe('the study day', () => {
  it('ends at 4 AM: 1 AM still belongs to the day before', () => {
    expect(studyDay(new Date(2026, 10, 16, 1, 30))).toBe('2026-11-15')
    expect(studyDay(new Date(2026, 10, 16, 4, 0))).toBe('2026-11-16')
  })
  it('unanswered tasks close as skipped at day end, flagged auto; nothing else changes', () => {
    const tasks = buildDay(lina, T).tasks
    const after = endDay(lina, tasks, T)
    expect(after.outcomes!.filter((o) => o.date === T && o.auto).length).toBe(tasks.length)
    expect(after.topics).toBe(lina.topics)
    expect(after.scheduled).toBe(lina.scheduled)
  })
  it('a day with nothing planned is a day off, not a missed day', () => {
    expect(endDay(lina, [], T).daysOff).toEqual([T])
  })
  it('"no idea" dates follow the pace each morning and never pass; a passed rough date becomes projected', () => {
    const goals: Goal[] = lina.goals.map((g) => (g.id === 'step1' ? { ...g, dateSource: 'projected', examDate: addDays(T, -3) } : g))
    const s = startDay({ ...lina, goals }, T)
    expect(s.goals.find((g) => g.id === 'step1')!.examDate > T).toBe(true)
    const rough = startDay({ ...lina, goals: lina.goals.map((g) => (g.id === 'step1' ? { ...g, dateSource: 'rough' as const, examDate: T } : g)) }, T)
    expect(rough.goals.find((g) => g.id === 'step1')!.dateSource).toBe('projected')
  })
  it('after a uni exam its pending fixes and retests are dropped; board ones stay', () => {
    const uniFix: Task = { id: 'u1', date: T, kind: 'fix', goalId: 'uni-im', title: 'Review lecture', reason: '', minutes: 20, status: 'pending' }
    const s = startDay({ ...lina, scheduled: [...lina.scheduled, uniFix] }, addDays(im.examDate, 1))
    expect(s.scheduled.some((t) => t.id === 'u1')).toBe(false)
    expect(s.scheduled.some((t) => t.id === 'seed-retest-acid')).toBe(true)
  })
})

describe('the three days around an exam', () => {
  it('eve: one light review and nothing else; exam day and the day after: nothing', () => {
    const eve = buildDay(lina, addDays(im.examDate, -1))
    expect(eve.type).toBe('eve')
    expect(eve.tasks.map((t) => t.kind)).toEqual(['review'])
    expect(eve.tasks[0].minutes).toBeLessThanOrEqual(60)
    expect(buildDay(lina, im.examDate)).toMatchObject({ type: 'exam', tasks: [] })
    expect(buildDay(lina, addDays(im.examDate, 1))).toMatchObject({ type: 'rest', tasks: [] })
  })
  it('exam day beats eve, eve beats rest; an OSCE is a sitting too', () => {
    const goals: Goal[] = [
      { id: 'a', kind: 'uni', label: 'ENT exam', examDate: addDays(T, 9), dateSource: 'set', parts: [{ label: 'OSCE', date: addDays(T, 13) }] },
      { id: 'b', kind: 'uni', label: 'Eye exam', examDate: addDays(T, 11), dateSource: 'set' },
    ]
    expect(dayInfo(goals, addDays(T, 10)).type).toBe('eve') // rest after ENT, but Eye is tomorrow
    expect(dayInfo(goals, addDays(T, 12)).type).toBe('eve') // the OSCE's eve
    expect(dayInfo(goals, addDays(T, 13)).sittings[0].label).toBe('ENT exam OSCE')
    expect(dayInfo(goals, addDays(T, 14)).type).toBe('rest')
  })
  it('rough and projected dates get no protocol', () => {
    const goals: Goal[] = [{ id: 'x', kind: 'step1', label: 'Step 1', examDate: addDays(T, 1), dateSource: 'rough' }]
    expect(dayInfo(goals, T).type).toBe('normal')
  })
})

describe('wind-down before a uni exam', () => {
  it('scales with the rotation: 7 days from 4 weeks up, a third below, at least 2', () => {
    expect([8, 4, 3, 2, 1].map((w) => windDownDaysFor(w))).toEqual([7, 7, 7, 5, 2])
  })
  it('board work shrinks to Anki only; its due retests wait and come back after the rest day', () => {
    const d = addDays(im.examDate, -5)
    expect(windDownGoals(lina.goals, d).map((g) => g.id)).toEqual(['uni-im'])
    expect(isPaused(lina, step1, d)).toBe(true)
    const day = buildDay(lina, d)
    expect(day.tasks.filter((t) => t.goalId === 'step1').map((t) => t.kind)).toEqual(['anki'])
    expect(day.notes).toContain('paused')
    expect(day.moved).toEqual([])
    const after = buildDay(startDay(lina, addDays(im.examDate, 2)), addDays(im.examDate, 2))
    expect(after.tasks.some((t) => t.id === 'seed-retest-acid')).toBe(true)
  })
})

describe('the day never exceeds its time', () => {
  it('holds on every day of the demo student for 8 weeks, with what is due listed as moved', () => {
    for (let i = 0; i < 56; i++) {
      const d = buildDay(lina, addDays(T, i))
      expect(totalMinutes(d.tasks), d.date).toBeLessThanOrEqual(d.available)
    }
  })
  it('Anki is shortened before it is cut, with no new cards', () => {
    const s = { ...lina, availability: { ...lina.availability, weekdayMinutes: 20 } }
    const anki = buildDay(s, T).tasks[0]
    expect(anki).toMatchObject({ kind: 'anki', minutes: 20, amount: 0 })
    expect(buildDay(s, T).notes).toEqual(expect.arrayContaining(['ankiShortened', 'ankiFillsDay']))
  })
  it('a topic task is at most 90 min; a longer topic continues as parts', () => {
    const s = buildPlanState({ ...defaultAnswers(), stage: 'graduated', goals: ['step1'], dates: { step1: { kind: 'date', date: addDays(T, 200) } }, resources: ['uworld', 'bnb', 'firstaid'], weekdayHours: 8, weekendHours: 8 }, T)
    const day = buildDay(s, T)
    const topics = day.tasks.filter((t) => t.topicId)
    expect(topics.every((t) => t.minutes <= TOPIC_TASK_MAX_MINUTES)).toBe(true)
    expect(new Set(topics.map((t) => t.topicId)).size).toBeLessThanOrEqual(4)
    expect(totalMinutes(day.tasks)).toBeLessThanOrEqual(480)
    expect(totalMinutes(day.tasks)).toBeGreaterThan(360)
  })
})

describe('uni goals: lectures, past papers, recall', () => {
  it('templates: Mutah differs from the global default only in data', () => {
    expect(templateFor('Mutah University')).toBe(MUTAH)
    expect(templateFor('Somewhere Else')).toBe(GLOBAL_DEFAULT)
    expect(MUTAH.rotation.majorWeeks).toBe(8)
    expect(GLOBAL_DEFAULT.pastPapers.defaultCount).toBe(3)
  })
  it('papers are spread over a window before the exam and get denser toward it', () => {
    expect(papersWindowShare(8)).toBe(1 / 2)
    expect(papersWindowShare(40)).toBeCloseTo(1 / 3)
    const r = { ...lina.resources.find((x) => x.type === 'papers')!, totalUnits: 4, prepFrom: T, windowShare: 0.5 }
    const exam = addDays(T, 42)
    const due = [1, 2, 3, 4].map((k) => paperDueDate(r, exam, k))
    expect(due[3]).toBe(addDays(exam, -2))
    expect(due[0] >= addDays(T, 20)).toBe(true)
    const gaps = [1, 2, 3].map((i) => new Date(due[i]).getTime() - new Date(due[i - 1]).getTime())
    expect(gaps[0]).toBeGreaterThanOrEqual(gaps[2])
  })
  it('everything done before the exam → a short daily self-test, not empty days', () => {
    const s: EngineState = { ...lina, resources: lina.resources.map((r) => (r.goalId === 'uni-im' ? { ...r, doneUnits: r.totalUnits } : r)) }
    const t = buildDay(s, T).tasks.find((x) => x.goalId === 'uni-im')!
    expect(t.title).toMatch(/recall your lectures/)
    expect(t.minutes).toBe(UNI_REVIEW_MINUTES)
  })
})

describe('fix → retest loop', () => {
  const hf = lina.topics.find((t) => t.id === 'cardio-heart-failure')!
  const fix = fixTask('f1', T, 'step1', 'Cardio', [hf], { action: 'reviewWrong', title: 'Review', minutes: 15 }, 'r', T)
  const retest = retestTask('r1', addDays(T, 1), 'step1', 'Cardio', [hf], T, 1, 'f1')
  const s: EngineState = { ...lina, scheduled: [fix, retest] }

  it('a retest is never due before its fix is done, and waits 3 days from the day it was done', () => {
    expect(buildDay(s, addDays(T, 2)).tasks.some((t) => t.id === 'r1')).toBe(false)
    const done = reportTask(s, { ...fix, date: addDays(T, 2) }, { result: 'done' }, addDays(T, 2)).state
    expect(done.scheduled.find((t) => t.id === 'r1')!.date).toBe(addDays(T, 2 + RETEST_AFTER_FIX_DAYS))
  })
  it('a topic with an open loop never gets a second one', () => {
    const block: Task = { id: 'b', date: T, kind: 'study', goalId: 'step1', resourceId: 'uworld', system: 'Cardio', title: 'b', reason: '', minutes: 60, amount: 20, status: 'pending' }
    const out = reportTask(s, block, { result: 'done', questions: 20, percent: 40, weakTopicIds: [hf.id] }, T)
    expect(out.state.scheduled.filter((t) => t.kind === 'retest' && t.topicIds?.includes(hf.id)).length).toBe(1)
  })
  it('a failed retest gets a different fix; after three in a row the topic rests', () => {
    let state: EngineState = { ...s, scheduled: [{ ...fix, status: 'done' }, retest], topics: s.topics.map((t) => (t.id === hf.id ? { ...t, lastFix: 'reviewAndCards' as const } : t)) }
    let current = retest
    const actions: string[] = []
    for (let i = 0; i < MAX_RETEST_FAILS; i++) {
      const out = reportTask(state, current, { result: 'done', questions: 10, percent: 40 }, addDays(T, 5 + i * 5))
      if (out.outcome.kind !== 'retestFail') throw new Error('expected a failed retest')
      actions.push(out.outcome.fix.fixAction!)
      if (i === MAX_RETEST_FAILS - 1) expect(out.outcome.fix.date).toBe(addDays(T, 5 + i * 5 + PARK_DAYS))
      const { fix: nextFix, retest: nextRetest } = out.outcome
      state = { ...out.state, scheduled: out.state.scheduled.map((t) => (t.id === nextFix.id ? { ...t, status: 'done' as const } : t)) }
      current = nextRetest
    }
    expect(actions[0]).not.toBe('reviewAndCards')
    expect(actions[1]).not.toBe(actions[0])
  })
})

describe('rescue mode', () => {
  const behind = buildPlanState({
    ...defaultAnswers(), stage: 'graduated', goals: ['step1'], dates: { step1: { kind: 'date', date: addDays(T, 40) } },
    // 4 h a day: far enough behind to need rescue, close enough that moving the date (59 days) is a real option.
    resources: ['uworld', 'bnb', 'firstaid'], weekdayHours: 4, weekendHours: 4,
  }, T)

  it('offers three options with their cost when the work cannot fit; never for rough or projected dates', () => {
    const offer = rescueCheck(behind, T)!
    expect(offer.goal.id).toBe('step1')
    expect(offer.options.map((o) => o.kind)).toEqual(['move', 'narrow', 'time'])
    expect(offer.options.every((o) => o.cost.length > 0)).toBe(true)
    const rough = { ...behind, goals: behind.goals.map((g) => ({ ...g, dateSource: 'rough' as const })) }
    expect(rescueCheck(rough, T)).toBeNull()
  })
  it('is not offered when a little extra time is enough', () => {
    expect(rescueCheck(lina, T)?.goal.id).not.toBe('uni-im')
  })
  it('narrowing: questions only first, then at most 30% of topics dropped; the work left shrinks', () => {
    const n = narrow(behind, behind.goals[0], T)
    const topics = n.state.topics.filter((t) => t.items?.length)
    expect(topics.some((t) => t.questionsOnly)).toBe(true)
    expect(topics.filter((t) => t.dropped).length / topics.length).toBeLessThanOrEqual(0.3)
    expect(goalMinutesLeft(n.state, n.state.goals[0])).toBeLessThan(goalMinutesLeft(behind, behind.goals[0]))
    expect(buildDay(n.state, T).tasks.every((t) => !n.state.topics.find((x) => x.id === t.topicId)?.dropped)).toBe(true)
  })
  it('a uni exam is never moved: lectures from summaries, then fewer papers', () => {
    const s = buildPlanState({
      ...defaultAnswers(), stage: 'clinical', university: { name: 'Mutah University', country: 'JO' }, goals: ['uni'], resources: ['slides'],
      rotation: { subjects: [{ ...subjectFor('surgery'), lecturesLeft: 45 }], end: { date: addDays(T, 12) } }, weekdayHours: 1, weekendHours: 1,
    }, T)
    const offer = rescueCheck(s, T)!
    expect(offer.options.some((o) => o.kind === 'move')).toBe(false)
    const after = applyRescue(s, offer.goal.id, 'narrow', T)
    expect(after.resources.find((r) => r.type === 'slides')!.fromSummary).toBe(true)
    expect(after.resources.find((r) => r.type === 'papers')!.totalUnits).toBeGreaterThanOrEqual(1)
  })
  it('each choice changes the plan and holds the offer back; "add time" raises the daily cap', () => {
    const moved = applyRescue(behind, 'step1', 'move', T)
    expect(moved.goals[0].examDate > behind.goals[0].examDate).toBe(true)
    expect(rescueCheck(moved, addDays(T, 1))).toBeNull()
    const more = applyRescue(behind, 'step1', 'time', T)
    expect(buildDay(more, T).available).toBeGreaterThan(buildDay(behind, T).available)
    expect(rescueCheck(more, addDays(T, RESCUE_COOLDOWN_DAYS - 1))).toBeNull()
  })
})

describe('"Do more", light days, and what comes after a rotation', () => {
  it('"Do more" adds the next task and never brings a retest forward', () => {
    const tasks = buildDay(lina, T).tasks
    const more = doMore(lina, tasks, T)!
    expect(more.extra).toBe(true)
    expect(tasks.some((t) => t.id === more.id)).toBe(false)
    expect(more.kind).not.toBe('retest')
    expect(doMore(lina, [], im.examDate)).toBeNull()
  })
  it('an accepted light day is applied by buildDay: Anki stays; a rest day clears the day and counts as planned', () => {
    const light = answerLight(lina, T, 'light')
    expect(buildDay(light, T)).toMatchObject({ mode: 'light' })
    expect(kinds(light, T)).toEqual(['anki'])
    const rest = answerLight(lina, T, 'rest')
    expect(buildDay(rest, T)).toMatchObject({ mode: 'rest', tasks: [] })
    expect(rest.daysOff).toEqual([T])
  })
  it('"What\'s next?" is asked once after the rotation ends; the answer is a rotation or a break', () => {
    const after = addDays(lina.rotation!.until, 1)
    expect(rotationEnded(lina, T)).toBe(false)
    expect(rotationEnded(lina, after)).toBe(true)
    const next = nextRotation(lina, { subjects: [subjectFor('derm')], end: { weeks: 2 } }, { name: 'Mutah University', country: 'JO' }, after)
    expect(next.goals.find((g) => g.id === 'uni-derm')).toMatchObject({ label: 'Dermatology exam', windDownDays: 7 })
    expect(next.rotation!.systems).toEqual(['Derm'])
    expect(rotationEnded(next, after)).toBe(false)
    const onBreak = startBreak(lina, { weekdayHours: 6, weekendHours: 6 }, after)
    expect(rotationEnded(onBreak, after)).toBe(false)
    expect(onBreak.availability.weekdayMinutes).toBe(360)
  })
})

describe('found by the independent reviews', () => {
  const block = (id: string): Task => ({ id, date: T, kind: 'study', goalId: 'step1', resourceId: 'uworld', system: 'Mixed', title: id, reason: '', minutes: 60, amount: 20, status: 'pending' })
  const clean: EngineState = { ...lina, scheduled: [] }

  it('two weak mixed blocks on one day get two different fixes', () => {
    const a = reportTask(clean, block('b1'), { result: 'done', questions: 20, percent: 40 }, T).state
    const b = reportTask(a, block('b2'), { result: 'done', questions: 20, percent: 45 }, T).state
    const ids = b.scheduled.map((t) => t.id)
    expect(ids.length).toBe(2)
    expect(new Set(ids).size).toBe(2)
  })
  it('a mixed block tapping a system that already has a loop adds one only for the other system', () => {
    const a = reportTask(clean, block('b1'), { result: 'done', questions: 20, percent: 50, weakTopicIds: ['Renal'] }, T).state
    const b = reportTask(a, block('b2'), { result: 'done', questions: 20, percent: 50, weakTopicIds: ['Renal', 'GI'] }, T).state
    expect(b.topics.some((t) => t.id.startsWith('sys-sys'))).toBe(false)
    expect(b.scheduled.filter((t) => t.kind === 'retest').map((t) => t.topicIds)).toEqual([['sys-renal'], ['sys-gi']])
  })
  it('new Anki cards: never more than the cap, spread out for a date that is not firm, none right before a firm exam', () => {
    const many: EngineState = { ...lina, anki: { ...lina.anki!, newCardsLeft: 9000 } }
    expect(buildDay(many, T).tasks[0].amount).toBe(ANKI_MAX_NEW_PER_DAY)
    const soon: EngineState = { ...lina, goals: lina.goals.map((g) => (g.id === 'step1' ? { ...g, dateSource: 'projected' as const, examDate: addDays(T, 1) } : g)) }
    expect(buildDay(soon, T).tasks[0].amount).toBeLessThanOrEqual(Math.ceil(1150 / 30))
    const week: EngineState = { ...lina, goals: lina.goals.filter((g) => g.id === 'step1').map((g) => ({ ...g, examDate: addDays(T, 6) })) }
    expect(buildDay(week, T).tasks[0]).toMatchObject({ kind: 'anki', amount: 0 })
  })
  it('on a light or rest day, and on an exam eve, due retests are listed as moved', () => {
    for (const answer of ['light', 'rest'] as const) {
      const day = buildDay(answerLight(lina, T, answer), T)
      expect(day.moved.some((t) => t.id === 'seed-retest-acid'), answer).toBe(true)
    }
    const eve: EngineState = { ...lina, goals: lina.goals.map((g) => (g.id === 'uni-im' ? { ...g, examDate: addDays(T, 1), windDownDays: 0 } : g)) }
    expect(buildDay(eve, T)).toMatchObject({ type: 'eve' })
    expect(buildDay(eve, T).moved.some((t) => t.id === 'seed-retest-acid')).toBe(true)
  })
  it('extra time from rescue never lands on a day the student said has no time', () => {
    const a = { ...lina.availability, weekendMinutes: 0, extra: { minutes: 60, until: addDays(T, 30) } }
    expect(statedMinutes(a, addDays(T, 5))).toBe(0) // Friday
    expect(statedMinutes(a, T)).toBe(240)
  })
  it('a fix answered "Partly" twice is closed, and its retest follows', () => {
    const fix = lina.scheduled.find((t) => t.id === 'seed-fix-glom')!
    const once = reportTask(lina, fix, { result: 'partly' }, T).state
    const shorter = once.scheduled.find((t) => t.id === fix.id)!
    expect(shorter).toMatchObject({ status: 'pending', minutes: 10, date: addDays(T, 1) })
    const twice = reportTask(once, shorter, { result: 'partly' }, addDays(T, 1)).state
    expect(twice.scheduled.find((t) => t.id === fix.id)!.status).toBe('done')
    expect(twice.scheduled.find((t) => t.id === 'seed-retest-glom')!.date).toBe(addDays(T, 1 + RETEST_AFTER_FIX_DAYS))
  })
  it('a topic that rested and then missed three more times gets no further loop', () => {
    const hf = lina.topics.find((t) => t.id === 'cardio-heart-failure')!
    const retest = retestTask('r9', T, 'step1', 'Cardio', [hf], T)
    const s: EngineState = { ...lina, scheduled: [retest], topics: lina.topics.map((t) => (t.id === hf.id ? { ...t, fails: MAX_RETEST_FAILS - 1, parks: 1 } : t)) }
    const out = reportTask(s, retest, { result: 'done', questions: 10, percent: 40 }, T)
    expect(out.outcome.kind).toBe('retestStopped')
    expect(out.state.scheduled.filter((t) => t.status === 'pending').length).toBe(0)
    expect(out.state.topics.find((t) => t.id === hf.id)!.status).toBe('weak')
  })
  it('"not now" holds a rescue offer back; "Do more" plans one hour at most', () => {
    const behind = buildPlanState({ ...defaultAnswers(), stage: 'graduated', goals: ['step1'], dates: { step1: { kind: 'date', date: addDays(T, 40) } }, resources: ['uworld', 'bnb'], weekdayHours: 2, weekendHours: 2 }, T)
    expect(rescueCheck(behind, T)).not.toBeNull()
    expect(rescueCheck(dismissRescue(behind, 'step1', T), addDays(T, 5))).toBeNull()
    expect(doMore(lina, buildDay(lina, T).tasks, T)!.minutes).toBeLessThanOrEqual(60)
  })
})

describe('follow-ups from the report: wording, limits, close calls', () => {
  const hf = lina.topics.find((t) => t.id === 'cardio-heart-failure')!

  it('a retest says what it is: one-week check, postponed instead of "due today"', async () => {
    const { reasons } = await import('..')
    expect(reasons.retestDue(T, T)).toBe('Retest due today')
    expect(reasons.retestDue(T, T, 2)).toBe('One-week check due today')
    expect(reasons.retestDue(addDays(T, -11), T)).toMatch(/^Retest, postponed from /)
    expect(reasons.retestDue(addDays(T, -1), T, 2)).toBe('One-week check, postponed from yesterday')
  })

  it('"move the date" is only offered between 3 and 60 days', () => {
    const far = buildPlanState({ ...defaultAnswers(), stage: 'graduated', goals: ['step1'], dates: { step1: { kind: 'date', date: addDays(T, 20) } }, resources: ['uworld', 'bnb', 'firstaid'], weekdayHours: 0.5, weekendHours: 0.5 }, T)
    const offer = rescueCheck(far, T)!
    expect(offer).not.toBeNull()
    expect(offer.options.some((o) => o.kind === 'move')).toBe(false) // hundreds of days later: not a real option
    const near = buildPlanState({ ...defaultAnswers(), stage: 'graduated', goals: ['step1'], dates: { step1: { kind: 'date', date: addDays(T, 40) } }, resources: ['uworld', 'bnb', 'firstaid'], weekdayHours: 2, weekendHours: 2 }, T)
    const move = rescueCheck(near, T)?.options.find((o) => o.kind === 'move')
    if (move) expect(daysBetween(near.goals[0].examDate, move.newDate!)).toBeLessThanOrEqual(60)
  })

  describe('a retest one question from the line is confirmed, not decided', () => {
    const retest = retestTask('r1', T, 'step1', 'Cardio', [hf], T, 1, 'f1')
    const s: EngineState = { ...lina, scheduled: [{ ...fixTask('f1', T, 'step1', 'Cardio', [hf], { action: 'reviewWrong', title: 'Review', minutes: 15 }, 'r', T), status: 'done' }, retest], topics: lina.topics.map((t) => (t.id === hf.id ? { ...t, status: 'fixing' as const } : t)) }

    it('6 or 7 of 10: nothing changes yet; 5 more questions tomorrow', () => {
      for (const correct of [6, 7]) {
        const out = reportTask(s, retest, { result: 'done', questions: 10, percent: correct * 10 }, T)
        expect(out.outcome.kind, `${correct}/10`).toBe('retestBorderline')
        expect(out.state.topics.find((t) => t.id === hf.id)!.status).toBe('fixing')
        const more = out.state.scheduled.find((t) => t.id === 'r1-confirm')!
        expect(more).toMatchObject({ date: addDays(T, 1), amount: 5, status: 'pending', carry: { questions: 10, correct } })
      }
    })
    it('5 or 8 of 10 are clear: a fail and a pass', () => {
      expect(reportTask(s, retest, { result: 'done', questions: 10, percent: 50 }, T).outcome.kind).toBe('retestFail')
      expect(reportTask(s, retest, { result: 'done', questions: 10, percent: 80 }, T).outcome.kind).toBe('retestAgain')
    })
    it('the five questions count together with the first ten: 7/10 + 4/5 passes, 7/10 + 3/5 does not', () => {
      const first = reportTask(s, retest, { result: 'done', questions: 10, percent: 70 }, T).state
      const confirm = first.scheduled.find((t) => t.id === 'r1-confirm')!
      expect(reportTask(first, confirm, { result: 'done', questions: 5, percent: 80 }, addDays(T, 1)).outcome.kind).toBe('retestAgain') // 11 of 15
      expect(reportTask(first, confirm, { result: 'done', questions: 5, percent: 60 }, addDays(T, 1)).outcome.kind).toBe('retestFail') // 10 of 15
    })
    it('a confirming retest is never itself confirmed again', () => {
      const first = reportTask(s, retest, { result: 'done', questions: 10, percent: 70 }, T).state
      const confirm = first.scheduled.find((t) => t.id === 'r1-confirm')!
      const out = reportTask(first, confirm, { result: 'done', questions: 5, percent: 80 }, addDays(T, 1))
      expect(out.outcome.kind).not.toBe('retestBorderline')
    })
  })

  it('setup says one honest thing about the time: Anki taking the day, or an exam that will not fit', () => {
    const base = { ...defaultAnswers(), stage: 'graduated' as const, goals: ['step1' as const], resources: ['uworld' as const, 'bnb' as const, 'anki' as const], ankiReviewMinutes: 30, dates: { step1: { kind: 'unknown' as const } } }
    expect(timeNote({ ...base, weekdayHours: 0.5, weekendHours: 0.5 }, T)).toMatch(/Anki reviews take about 30 min of your 30 min/)
    const behind = { ...base, weekdayHours: 1, weekendHours: 1, dates: { step1: { kind: 'date' as const, date: addDays(T, 40) } } }
    expect(timeNote(behind, T)).toMatch(/Step 1 is about \d+ days short/)
    expect(timeNote({ ...base, weekdayHours: 6, weekendHours: 6, dates: { step1: { kind: 'date' as const, date: addDays(T, 400) } } }, T)).toBeNull()
  })
})
