import { describe, expect, it } from 'vitest'
import {
  addDays, applyCompletion, applyTopicCompletion, buildDay, count, isCovered, isSystemDone, planFix, previewTomorrow,
  sliceTopic, stepLines, suggestNextSystem, topicQueue, totalMinutes,
  isAllWatched, refreshTopicTasks, remainingItems, setWatched, systemProgress, watchedIds,
  MIN_TASK_MINUTES, type EngineState, type StudyItem, type Task, type Topic,
} from '..'
import {
  addCustomSubject, buildPlanState, checklistIds, defaultAnswers, watchChecklist, dropSubjects, subjectLabel, toggleSubject, type Answers, type RotationAnswer,
} from '../../data/setup'
import { BNB, BNB_NEEDS_REVIEW } from '../../data/resources/bnb'
import { FIRST_AID } from '../../data/resources/firstaid'
import { SYSTEMS, TOPICS, topicId } from '../../data/topics'
import { roughDate } from '../../data/templates'

const T = '2026-11-15' // a Sunday

const items: StudyItem[] = [
  { source: 'bnb', title: 'Heart Failure Basics', minutes: 20 },
  { source: 'bnb', title: 'Acute Heart Failure', minutes: 20 },
  { source: 'firstaid', title: 'Heart failure', minutes: 20 },
  { source: 'qbank', title: 'UWorld', minutes: 30, questions: 10 },
]
const hf: Topic = { id: 'hf', system: 'Cardio', name: 'Heart failure', status: 'unknown', items, doneItems: 0, partialMin: 0 }

describe('topic tasks', () => {
  it('steps name the topic\'s own videos and sections, never numbers', () => {
    expect(stepLines(items)).toEqual([
      'B&B: Heart Failure Basics, Acute Heart Failure',
      'First Aid: Heart failure',
      'Then 10 UWorld questions on it',
    ])
  })
  it('a slice takes whole items that fit, and never goes under the minimum', () => {
    expect(sliceTopic(hf, 90)).toMatchObject({ from: 0, to: 4, minutes: 90, questions: 10, ends: true })
    expect(sliceTopic(hf, 70)).toMatchObject({ from: 0, to: 3, minutes: 60, questions: 0, ends: false })
    expect(sliceTopic(hf, 10)).toBeNull()
    const nearlyDone = { ...hf, doneItems: 2, partialMin: 15 }
    // 5 min of First Aid left: shown as a 15-min task, never "5 min".
    expect(sliceTopic(nearlyDone, 15)).toMatchObject({ from: 2, to: 3, minutes: MIN_TASK_MINUTES })
  })
  it('Done covers the slice; Partly counts half and keeps the rest first; Didn\'t changes nothing', () => {
    const task = { itemFrom: 0, itemTo: 3, minutes: 60 } as Task
    expect(applyTopicCompletion(hf, task, 'done')).toMatchObject({ doneItems: 3, partialMin: 0 })
    expect(applyTopicCompletion(hf, task, 'partly')).toMatchObject({ doneItems: 1, partialMin: 10 })
    expect(applyTopicCompletion(hf, task, 'skipped')).toBe(hf)
    expect(isCovered(applyTopicCompletion(hf, { itemFrom: 0, itemTo: 4, minutes: 90 } as Task, 'done'))).toBe(true)
  })
})

// A student on Step 1 + IM, with B&B, First Aid, UWorld and slides.
function answers(patch: Partial<Answers> = {}): Answers {
  return {
    ...defaultAnswers(),
    goals: ['uni', 'step1'],
    dates: { step1: { kind: 'date', date: addDays(T, 200) } },
    rotation: { subjects: [{ key: 'im', name: 'IM', examAtEnd: false, examDate: addDays(T, 20), lecturesLeft: 8 }], end: { date: addDays(T, 25) } },
    resources: ['uworld', 'bnb', 'firstaid'],
    uworldDone: 0,
    systemsNow: ['Cardio'],
    systemsNowUnsure: false,
    weekdayHours: 3,
    weekendHours: 4,
    ...patch,
  }
}

describe('planning by topic', () => {
  const s = buildPlanState(answers(), T)
  const mon = '2026-11-16'

  it('a study task is one topic, with its resources inside, never resource units', () => {
    const d = buildDay(s, mon)
    const topic = d.tasks.find((t) => t.topicId)!
    expect(topic.title).toBe('Cardio: Cardiac anatomy & physiology')
    expect(topic.steps![0]).toMatch(/^B&B: Cardiac Anatomy, Cardiac Physiology/)
    for (const t of d.tasks) expect(t.title).not.toMatch(/video \d|page \d|lecture \d|chapter \d/i)
  })
  it('no study task under 15 minutes', () => {
    for (let i = 0; i < 14; i++) {
      for (const t of buildDay(s, addDays(mon, i)).tasks) {
        if (t.kind === 'study') expect(t.minutes).toBeGreaterThanOrEqual(MIN_TASK_MINUTES)
      }
    }
  })
  it('tomorrow assumes today gets done: the next lectures and topics, never a repeat', () => {
    const today = buildDay(s, mon)
    const tomorrow = previewTomorrow(s, today.tasks, mon)
    const todayTopics = today.tasks.filter((t) => t.topicId && !t.detail).map((t) => t.topicId)
    for (const t of tomorrow.tasks) expect(todayTopics).not.toContain(t.topicId)
    // The IM exam (20 days) leads a Step 1 that is 200 days out: lectures run ahead, at most LECTURES_AHEAD × the pace
    // (8 lectures over 16 lecture days = 1 a day → 2), and Step 1 keeps its small share.
    const slides = [today, tomorrow].map((d) => d.tasks.find((t) => t.resourceId === 'slides-im')?.amount ?? 0)
    expect(slides).toEqual([2, 2])
    expect(today.tasks.find((t) => t.resourceId === 'slides-im')!.reason).toMatch(/it comes first until then/)
    expect(today.tasks.some((t) => t.goalId === 'step1')).toBe(true)
  })
  it('Partly or Didn\'t get to it → tomorrow re-plans with that work first', () => {
    const today = buildDay(s, mon)
    const task = today.tasks.find((t) => t.topicId)!
    for (const result of ['partly', 'skipped'] as const) {
      const after = applyCompletion(s, task, result, mon)
      const tasks = today.tasks.map((t) => (t.id === task.id ? { ...t, status: result } : t))
      const tomorrow = previewTomorrow(after, tasks, mon)
      const first = tomorrow.tasks.find((t) => t.topicId)!
      expect(first.topicId).toBe(task.topicId)
      if (result === 'partly') expect(first.reason).toBe('Picks up where you left off')
    }
  })
  it('Didn\'t get to it on slides keeps the lecture; Partly makes it shorter', () => {
    const today = buildDay(s, mon)
    const slides = today.tasks.find((t) => t.resourceId === 'slides-im')!
    const partly = applyCompletion(s, slides, 'partly', mon)
    expect(partly.resources.find((r) => r.id === 'slides-im')!.doneUnits).toBe(slides.amount! / 2)
    const skipped = applyCompletion(s, slides, 'skipped', mon)
    expect(skipped.resources.find((r) => r.id === 'slides-im')!.doneUnits).toBe(0)
  })
  it('a topic\'s questions under 60% → a fix and retest for that topic', () => {
    const task = buildDay(s, mon).tasks.find((t) => t.topicId)!
    const f = planFix({ date: mon, goalId: 'step1', system: 'Cardio', questions: 10, correct: 5, weakTopicIds: [], topicId: task.topicId }, s)!
    expect(f.topicIds).toEqual([task.topicId])
    expect(f.fix.reason).toBe('Cardiac anatomy & physiology questions: 50%')
    expect(f.retest!.title).toBe('Retest: 10 cardiac anatomy & physiology questions')
    expect(planFix({ date: mon, goalId: 'step1', system: 'Cardio', questions: 10, correct: 7, weakTopicIds: [], topicId: task.topicId }, s)).toBeNull()
  })
  it('two systems at once alternate topics', () => {
    const two = buildPlanState(answers({ systemsNow: ['Cardio', 'Renal'] }), T)
    const q = topicQueue(two, mon).slice(0, 4).map((t) => t.system)
    expect(q).toEqual(['Cardio', 'Renal', 'Cardio', 'Renal'])
  })
})

describe('next system', () => {
  it('not-started systems first, in the map\'s order; then the weakest by accuracy', () => {
    const s = buildPlanState(answers({ systemsNow: ['Cardio'], systemsDone: ['Resp'], systemsDoneNone: false }), T)
    expect(suggestNextSystem(s, T, ['Cardio'])).toBe('Renal')
    const allStarted: EngineState = {
      ...s,
      topics: s.topics.map((t) => (t.system === 'Renal' || t.system === 'GI' ? t : { ...t, doneItems: t.items!.length })),
    }
    const started: EngineState = {
      ...allStarted,
      topics: allStarted.topics.map((t) => (t.system === 'Renal' || t.system === 'GI') && t.name === TOPICS[t.system][0] ? { ...t, doneItems: t.items!.length } : t),
      sessions: [
        { id: 'a', date: T, kind: 'study', goalId: 'step1', system: 'Renal', minutes: 30, questions: 10, correct: 7 },
        { id: 'b', date: T, kind: 'study', goalId: 'step1', system: 'GI', minutes: 30, questions: 10, correct: 4 },
      ],
    }
    expect(suggestNextSystem(started, T)).toBe('GI')
  })
  it('once the focus system is done, the plan moves on to the suggestion by itself', () => {
    const s = buildPlanState(answers(), T)
    const done = { ...s, topics: s.topics.map((t) => (t.system === 'Cardio' ? { ...t, doneItems: t.items!.length } : t)) }
    expect(isSystemDone(done.topics, 'Cardio')).toBe(true)
    const task = buildDay(done, '2026-11-16').tasks.find((t) => t.topicId)!
    expect(task.title.startsWith('Resp: ')).toBe(true)
    expect(task.reason).toBe('Next system: Resp')
  })
})

describe('onboarding: only what students know, "Not sure" everywhere', () => {
  it('the uni goal is named after the rotation subject', () => {
    expect(subjectLabel({ name: 'IM' })).toBe('IM exam')
    const s = buildPlanState(answers(), T)
    expect(s.goals[0]).toMatchObject({ id: 'uni-im', label: 'IM exam' })
    expect(s.rotation).toMatchObject({ short: 'IM' })
  })
  it('uni exam "Don\'t know yet" → the end of the rotation, marked as assumed', () => {
    const s = buildPlanState(answers({ rotation: { subjects: [{ key: 'im', name: 'IM', examAtEnd: false, examDate: 'dont-know', lecturesLeft: 8 }], end: { date: addDays(T, 25) } } }), T)
    expect(s.goals[0]).toMatchObject({ label: 'IM exam', examDate: addDays(T, 25), dateSource: 'assumed' })
  })
  it('Step 1 not booked: "Mid 2027" plans for mid-July; "No idea" projects a ready-by date', () => {
    expect(roughDate('mid', T)).toBe('2027-07-15')
    const rough = buildPlanState(answers({ dates: { step1: { kind: 'rough', when: 'mid' } } }), T)
    expect(rough.goals[1]).toMatchObject({ examDate: '2027-07-15', dateSource: 'rough' })
    const idea = buildPlanState(answers({ dates: { step1: { kind: 'unknown' } } }), T)
    expect(idea.goals[1].dateSource).toBe('projected')
    expect(idea.goals[1].examDate > T).toBe(true)
    expect(idea.goals[1].examDate < addDays(T, 730)).toBe(true)
  })
  it('Not sure → sensible defaults: 0 UWorld questions, 15 lectures, a suggested system', () => {
    const s = buildPlanState(answers({
      uworldDone: null, systemsNow: [], systemsNowUnsure: true,
      rotation: { subjects: [{ key: 'im', name: 'IM', examAtEnd: false, examDate: addDays(T, 20), lecturesLeft: 'not-sure' }], end: undefined },
    }), T)
    expect(s.resources.find((r) => r.id === 'uworld')!.doneUnits).toBe(0)
    expect(s.resources.find((r) => r.id === 'slides-im')).toMatchObject({ name: 'IM slides', totalUnits: 15, doneUnits: 0 })
    expect(s.rotation!.until).toBe(addDays(T, 42))
    expect(s.focus).toEqual(['Cardio'])
  })
  it('"already done" systems start covered; B&B / First Aid ask no progress at all', () => {
    const s = buildPlanState(answers({ systemsDone: ['Renal'], systemsDoneNone: false }), T)
    expect(s.topics.filter((t) => t.system === 'Renal').every(isCovered)).toBe(true)
    expect(s.topics.filter((t) => t.system === 'Cardio').some(isCovered)).toBe(false)
    expect(s.resources.map((r) => r.id).sort()).toEqual(['papers-im', 'slides-im', 'uworld'])
    expect(s.materials).toEqual(['bnb', 'firstaid'])
  })
})

describe('combined rotations: one goal per subject', () => {
  const ent = { key: 'ent', name: 'ENT', examAtEnd: false, examDate: addDays(T, 10), lecturesLeft: 6 } as const
  const eye = { key: 'ophtho', name: 'Ophthalmology', examAtEnd: false, examDate: 'dont-know', lecturesLeft: 'not-sure' } as const
  const s = buildPlanState(answers({ rotation: { subjects: [ent, eye], end: { date: addDays(T, 14) } } }), T)

  it('each subject is its own goal, with its own exam and lectures', () => {
    expect(s.rotation).toMatchObject({ name: 'ENT + Ophthalmology', until: addDays(T, 14) })
    expect(s.goals.map((g) => [g.id, g.label, g.examDate, g.dateSource])).toEqual([
      ['uni-ent', 'ENT exam', addDays(T, 10), 'set'],
      ['uni-ophtho', 'Ophthalmology exam', addDays(T, 14), 'assumed'],
      ['step1', 'Step 1', addDays(T, 200), 'set'],
    ])
    expect(s.resources.filter((r) => r.type === 'slides').map((r) => [r.name, r.goalId, r.totalUnits])).toEqual([
      ['ENT slides', 'uni-ent', 6],
      ['Ophthalmology slides', 'uni-ophtho', 15],
    ])
  })
  it('Today labels each task with its own exam', () => {
    const d = buildDay(s, '2026-11-16')
    const slides = d.tasks.filter((t) => t.resourceId?.startsWith('slides-')).map((t) => [t.title.replace(/next .*$/, 'next'), t.reason])
    expect(slides).toEqual([
      ['ENT slides: next', 'ENT exam in 9 days'],
      // Not announced yet: the end of the rotation is a guess, and the reason says so.
      // "Not sure" on lectures: no lecture count is named in the title.
      ['Ophthalmology: next', "Ophthalmology exam: date not out yet, planned for the rotation's end (in 13 days)"],
    ])
  })
  it('"No exam for this rotation": no goal, no slides, no papers for that subject', () => {
    const none = { key: 'peds', name: 'Pediatrics', examAtEnd: false, noExam: true, lecturesLeft: 'not-sure' } as const
    const p = buildPlanState(answers({ rotation: { subjects: [ent, none], end: { date: addDays(T, 14) } } }), T)
    expect(p.goals.filter((g) => g.kind === 'uni').map((g) => g.id)).toEqual(['uni-ent'])
    expect(p.resources.some((r) => r.goalId === 'uni-peds')).toBe(false)
    expect(buildDay(p, '2026-11-16').tasks.some((t) => /Pediatrics/.test(t.title + t.reason))).toBe(false)
  })
  it('a custom subject works like any other ("Subsurgery")', () => {
    const r = addCustomSubject({ subjects: [], end: undefined }, 'Subsurgery')
    const p = buildPlanState(answers({ rotation: { ...r, subjects: r.subjects.map((x) => ({ ...x, examDate: addDays(T, 9) })) } }), T)
    expect(p.goals[0]).toMatchObject({ label: 'Subsurgery exam' })
    expect(p.resources.some((x) => x.name === 'Subsurgery slides')).toBe(true)
  })
})

describe('two exams on the same day share the time', () => {
  it('in a real day: same-day exams split instead of the first one taking everything', () => {
    const both = buildPlanState(answers({
      weekdayHours: 1.5,
      resources: [],
      rotation: {
        subjects: [
          { key: 'ent', name: 'ENT', examAtEnd: false, examDate: addDays(T, 3), lecturesLeft: 9 },
          { key: 'ophtho', name: 'Ophthalmology', examAtEnd: false, examDate: addDays(T, 3), lecturesLeft: 3 },
        ],
        end: { date: addDays(T, 5) },
      },
    }), T)
    // T is the first day: the eve (T+2) and the exam day (T+3) aren't study days, so both need all they can get.
    const d = buildDay(both, T)
    const lectures = (id: string) => d.tasks.find((t) => t.goalId === id && t.resourceId?.startsWith('slides'))?.amount ?? 0
    // 90 min split by what each has left (9 vs 3 lectures, plus papers): neither is starved.
    expect(lectures('uni-ent')).toBeGreaterThanOrEqual(1)
    expect(lectures('uni-ophtho')).toBeGreaterThanOrEqual(1)
    expect(totalMinutes(d.tasks)).toBeLessThanOrEqual(d.available)
  })
})

describe('onboarding deselect', () => {
  const r0: RotationAnswer = { subjects: [], end: undefined }
  it('tapping a selected rotation unselects it; at most 5', () => {
    let r = toggleSubject(r0, 'im')
    expect(r.subjects.map((x) => x.key)).toEqual(['im'])
    r = toggleSubject(r, 'im')
    expect(r.subjects).toEqual([])
    // A year-end exam with several papers (IM, Surgery, Peds, OB/GYN) fits; a sixth is refused.
    r = ['im', 'surgery', 'peds', 'obgyn', 'ent', 'ophtho'].reduce(toggleSubject, r0)
    expect(r.subjects.map((x) => x.key)).toEqual(['im', 'surgery', 'peds', 'obgyn', 'ent'])
  })
  it('closing "Minor rotation" clears its picks; closing "Type your own" clears typed ones', () => {
    let r = ['surgery', 'ent'].reduce(toggleSubject, r0)
    r = addCustomSubject(r, 'Subsurgery')
    expect(dropSubjects(r, 'minor').subjects.map((x) => x.name)).toEqual(['Surgery', 'Subsurgery'])
    expect(dropSubjects(r, 'custom').subjects.map((x) => x.name)).toEqual(['Surgery', 'ENT'])
  })
  it('"Not yet" booked without a rough answer still plans (as No idea); "None yet" ignores stale picks', () => {
    const s = buildPlanState(answers({ dates: { step1: { kind: 'notYet' } }, systemsDone: ['Renal'], systemsDoneNone: true }), T)
    expect(s.goals.find((g) => g.id === 'step1')!.dateSource).toBe('projected')
    expect(s.topics.filter((t) => t.system === 'Renal').some(isCovered)).toBe(false)
  })
})

describe('resource structure', () => {
  const ids = new Set(Object.entries(TOPICS).flatMap(([sys, names]) => names.map((n) => topicId(sys, n))))
  it('every B&B video maps to an existing topic, and every topic has B&B', () => {
    expect(BNB.length).toBe(475)
    for (const v of BNB) for (const t of v.topicIds) expect(ids.has(t), v.title).toBe(true)
    for (const id of ids) expect(BNB.some((v) => v.topicIds.includes(id)), id).toBe(true)
    expect(BNB_NEEDS_REVIEW.filter((x) => x.startsWith('Unmapped'))).toEqual([])
  })
  it('titles only: no numbers standing in for content, no page numbers', () => {
    for (const v of [...BNB, ...FIRST_AID]) expect(v.title).not.toMatch(/\bp(age|\.)\s*\d|\(\d+ ?min/i)
  })
  it('every system in the map has topics', () => {
    for (const s of SYSTEMS) expect(TOPICS[s.id].length).toBeGreaterThan(0)
  })
})

describe('plurals', () => {
  it('1 task, 2 tasks', () => {
    expect(count(1, 'task')).toBe('1 task')
    expect(count(2, 'task')).toBe('2 tasks')
    expect(count(1, 'question')).toBe('1 question')
  })
})

describe('no exam weights anywhere in the engine', () => {
  it('the daily plan never uses made-up weights (only rescue ranks systems: imported question counts, else map order)', () => {
    const files = import.meta.glob('../*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    for (const [name, src] of Object.entries(files)) if (!name.endsWith('rescue.ts')) expect(src, name).not.toMatch(/weight/i)
  })
  it('a day never exceeds its time', () => {
    const s = buildPlanState(answers(), T)
    for (let i = 0; i < 21; i++) {
      const d = buildDay(s, addDays(T, i))
      expect(totalMinutes(d.tasks)).toBeLessThanOrEqual(d.available)
    }
  })
})

describe('already watched (ticks)', () => {
  const ids = (t: Topic) => (t.items ?? []).filter((x) => x.source === 'bnb').map((x) => x.id!)
  const base = buildPlanState(answers(), T)
  const hfId = topicId('Cardio', 'Heart failure')
  const heart = base.topics.find((t) => t.id === hfId)!
  const mon = '2026-11-16'

  it('ticked videos are left out of the topic task; the rest stays in order', () => {
    const [first, ...rest] = ids(heart)
    const s = { ...base, topics: setWatched(base.topics, [first], true) }
    const t = s.topics.find((x) => x.id === hfId)!
    const left = remainingItems(t).map((r) => r.item)
    expect(left.some((x) => x.id === first)).toBe(false)
    expect(left.filter((x) => x.source === 'bnb').map((x) => x.id)).toEqual(rest)
    expect(left.some((x) => x.source === 'firstaid')).toBe(true)
    expect(isAllWatched(t)).toBe(rest.length === 0)
  })

  it('a fully watched topic becomes a short check: only its questions, no videos', () => {
    const s: EngineState = { ...base, topics: setWatched(base.topics, ids(heart), true) }
    const t = s.topics.find((x) => x.id === hfId)!
    expect(isAllWatched(t)).toBe(true)
    expect(remainingItems(t).map((r) => r.item.source)).toEqual(['qbank'])
    // Put it first in the queue to see its task.
    const only = { ...s, topics: s.topics.map((x) => (x.system === 'Cardio' && x.id !== hfId ? { ...x, doneItems: x.items!.length } : x)) }
    const task = buildDay(only, mon).tasks.find((x) => x.topicId === hfId)!
    expect(task.title).toBe('Heart failure: 10 UWorld questions')
    expect(task.steps).toBeUndefined()
    expect(task.amount).toBe(10)
    expect(task.minutes).toBe(30)
  })

  it('ticks never mark a topic solid; only questions and retests do', () => {
    const all = base.topics.filter((t) => t.system === 'Cardio').flatMap(ids)
    const s = { ...base, topics: setWatched(base.topics, all, true) }
    const p = systemProgress(s.topics, 'Cardio')
    expect(p.watched).toBe(p.total - s.topics.filter((t) => t.system === 'Cardio' && ids(t).length === 0).length)
    expect(p.solid).toBe(0)
    expect(s.topics.filter((t) => t.system === 'Cardio').every((t) => t.status === 'unknown')).toBe(true)
    // The checks are still planned: watched topics aren't covered until their questions are done.
    expect(isCovered(s.topics.find((t) => t.id === hfId)!)).toBe(false)
  })

  it('untick puts the video back; doneItems and partial time are untouched', () => {
    const [first] = ids(heart)
    const on = setWatched(base.topics, [first], true)
    const off = setWatched(on, [first], false)
    expect(remainingItems(off.find((x) => x.id === hfId)!)).toEqual(remainingItems(heart))
    const started = { ...heart, doneItems: 1, partialMin: 5 }
    expect(setWatched([started], [first], true)[0]).toMatchObject({ doneItems: 1, partialMin: 5 })
  })

  it('Done and Partly step over watched videos', () => {
    const t = setWatched([{ ...hf, items: items.map((x, i) => ({ ...x, id: `v${i}` })) }], ['v1'], true)[0]
    const slice = sliceTopic(t, 90)!
    expect(slice.items.map((x) => x.title)).toEqual(['Heart Failure Basics', 'Heart failure', 'UWorld'])
    expect(slice.minutes).toBe(70)
    const task = { itemFrom: slice.from, itemTo: slice.to, minutes: slice.minutes } as Task
    expect(isCovered(applyTopicCompletion(t, task, 'done'))).toBe(true)
    // Partly: 20 of 40 min counts → the first video, then the ticked one is passed for free.
    const partly = applyTopicCompletion(t, { itemFrom: 0, itemTo: 3, minutes: 40 } as Task, 'partly')
    expect(partly.doneItems).toBe(2)
    expect(remainingItems(partly).map((r) => r.item.title)).toEqual(['Heart failure', 'UWorld'])
  })

  it('videos done in the plan never turn the topic into a check', () => {
    expect(isAllWatched({ ...hf, doneItems: 2 })).toBe(false)
    expect(sliceTopic({ ...hf, doneItems: 2 }, 30)).toMatchObject({ from: 2, to: 3 })
  })

  it('onboarding ticks only count for the systems studied now', () => {
    const cardio = ids(heart)[0]
    const renal = BNB.find((v) => v.system === 'Renal')!.id
    const s = buildPlanState(answers({ watched: [cardio, renal] }), T)
    expect(watchedIds(s.topics)).toEqual([cardio])
    expect(checklistIds('Cardio')).toContain(cardio)
    expect(watchChecklist('Cardio').every((g) => g.videos.length > 0)).toBe(true)
  })

  it('ticking on Today re-slices pending topic tasks within their time', () => {
    const day = buildDay(base, mon)
    const task = day.tasks.find((x) => x.topicId)!
    const t = base.topics.find((x) => x.id === task.topicId)!
    const s = { ...base, topics: setWatched(base.topics, ids(t), true) }
    const next = refreshTopicTasks(s, day.tasks, mon).find((x) => x.topicId === task.topicId)!
    expect(next.steps).toBeUndefined()
    expect(next.title).toBe(`${t.name}: 10 UWorld questions`)
    expect(next.minutes).toBeLessThanOrEqual(task.minutes)
    // Done tasks are left as they were.
    const done = day.tasks.map((x) => (x.id === task.id ? { ...x, status: 'done' as const } : x))
    expect(refreshTopicTasks(s, done, mon).find((x) => x.id === task.id)).toBe(done.find((x) => x.id === task.id))
  })
})
