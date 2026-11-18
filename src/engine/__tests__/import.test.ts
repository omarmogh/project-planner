import { describe, expect, it } from 'vitest'
import {
  addDays, applyImport, buildDay, dailyLoad, daysBetween, importedResults, readiness, readyOnWith, recentAccuracy, roadToExam,
  suggestNextSystem, weeklyReport, whatIfDays, WEAK_BELOW, type EngineState,
} from '..'
import { buildPlanState, defaultAnswers, type Answers } from '../../data/setup'
import { importSummary, parseUworldReport, systemFromLine } from '../../data/uworldImport'
import { parseQbankResults } from '../../data/qbankImport'

const T = '2026-11-15' // a Sunday

// SYNTHETIC FIXTURES. These are NOT Omar's real UWorld report: they imitate the
// shapes a copied report can take (one cell per line, tab rows, headers, subjects).
// TODO(real sample): add the real pasted text as a fixture and keep these as extra cases.
const ONE_CELL_PER_LINE = `
Performance by System
Name
Usage
Correct Q
Incorrect Q
Omitted Q
P-Rank
Cardiovascular System
Usage 120/254
Correct Q 62 (52%)
Incorrect Q 55 (46%)
Omitted Q 3 (2%)
P-Rank 31st
Renal & Urinary System
Usage 80/180
Correct Q 52 (65%)
Incorrect Q 28 (35%)
Omitted Q 0 (0%)
Respiratory System
Usage 40/210
Correct Q 30 (75%)
`

const TAB_ROWS = [
  'Systems',
  'Name\tUsage\tCorrect Q\tIncorrect Q\tOmitted Q',
  'Gastrointestinal & Nutrition\t60/220\t27 (45%)\t33 (55%)\t0 (0%)',
  'Endocrine, Diabetes & Metabolism\t30/150\t21 (70%)\t9 (30%)\t0 (0%)',
  'Female Reproductive System & Breast\t20/120\t10 (50%)\t10 (50%)\t0 (0%)',
  'Male Reproductive System\t20/60\t14 (70%)\t6 (30%)\t0 (0%)',
  'Biostatistics & Epidemiology\t0/90\t0 (0%)\t0 (0%)\t0 (0%)',
].join('\n')

const WITH_SUBJECTS = `
Subjects
Pathology
Usage 300/1200
Correct Q 150 (50%)
Pharmacology
Usage 100/400
Correct Q 40 (40%)
Systems
Nervous System
Usage 50/250
Correct Q 35 (70%)
`

describe('UWorld report parser (synthetic fixtures)', () => {
  it('reads one-cell-per-line reports: questions used and % correct', () => {
    expect(parseUworldReport(ONE_CELL_PER_LINE)).toEqual([
      { system: 'Cardio', used: 120, pct: 52 },
      { system: 'Resp', used: 40, pct: 75 },
      { system: 'Renal', used: 80, pct: 65 },
    ])
  })
  it('reads tab rows, combines the two reproductive systems and drops unused ones', () => {
    expect(parseUworldReport(TAB_ROWS)).toEqual([
      { system: 'GI', used: 60, pct: 45 },
      { system: 'Endo', used: 30, pct: 70 },
      { system: 'Repro', used: 40, pct: 60 },
    ])
  })
  it('ignores the Subjects section, which overlaps systems', () => {
    expect(parseUworldReport(WITH_SUBJECTS)).toEqual([{ system: 'Neuro', used: 50, pct: 70 }])
  })
  it('tolerates any order, extra lines, Windows line ends and a missing %', () => {
    const text = 'Some header\r\nRespiratory System\r\nUsage 40/210\r\nnoise we do not know\r\nCardiovascular System\r\nUsage: 12\r\n'
    expect(parseUworldReport(text)).toEqual([
      { system: 'Cardio', used: 12, pct: null },
      { system: 'Resp', used: 40, pct: null },
    ])
  })
  it('works out % from a correct count when there is no %', () => {
    expect(parseUworldReport('Cardiovascular\nUsed 50\nCorrect 20')).toEqual([{ system: 'Cardio', used: 50, pct: 40 }])
  })
  it('finds nothing in unrelated text', () => {
    expect(parseUworldReport('Dear student, your subscription renews on 3/4')).toEqual([])
    expect(parseUworldReport('')).toEqual([])
  })
  it('maps names, not words that only contain them', () => {
    expect(systemFromLine('Cardiovascular System')).toBe('Cardio')
    expect(systemFromLine('Allergy & Immunology')).toBe('Immuno')
    expect(systemFromLine('Rheumatology/Orthopedics & Sport')).toBe('MSK')
    expect(systemFromLine('Correct Q 62 (52%)')).toBeUndefined()
  })
  it('summarises for the preview', () => {
    expect(importSummary([{ system: 'Cardio', used: 120, pct: 52 }, { system: 'Resp', used: 40, pct: null }])).toBe('Cardio 120 used, 52% correct · Resp 40 used')
  })
})

// A student on Step 1 + IM, with B&B, First Aid and UWorld.
function answers(patch: Partial<Answers> = {}): Answers {
  return {
    ...defaultAnswers(),
    goals: ['uni', 'step1'],
    dates: { step1: { kind: 'date', date: addDays(T, 200) } },
    rotation: { subjects: [{ key: 'im', name: 'IM', examAtEnd: false, examDate: addDays(T, 20), lecturesLeft: 8 }], end: { date: addDays(T, 25) } },
    resources: ['uworld', 'bnb', 'firstaid'],
    uworldDone: 0,
    systemsNowUnsure: true,
    weekdayHours: 3,
    weekendHours: 4,
    ...patch,
  }
}

const rows = [
  { system: 'Cardio', used: 120, pct: 52 },
  { system: 'Renal', used: 80, pct: 45 },
  { system: 'Resp', used: 40, pct: 75 },
  { system: 'GI', used: 30, pct: null },
]

describe('applying an import', () => {
  const base = buildPlanState(answers(), T)
  const s = applyImport(base, rows, T)

  it('seeds accuracy by system; a system without % only counts toward questions done', () => {
    expect(recentAccuracy(s.sessions, T).map((a) => [a.system, a.pct])).toEqual([['Renal', 45], ['Cardio', 52], ['Resp', 75]])
    expect(s.resources.find((r) => r.id === 'uworld')!.doneUnits).toBe(270)
  })
  it('never lowers questions done', () => {
    const ahead = { ...base, resources: base.resources.map((r) => (r.id === 'uworld' ? { ...r, doneUnits: 1000 } : r)) }
    expect(applyImport(ahead, rows, T).resources.find((r) => r.id === 'uworld')!.doneUnits).toBe(1000)
  })
  it('adds one fix, today, for the weakest system under the line, and its retest', () => {
    const fixes = s.scheduled.filter((t) => t.kind === 'fix')
    expect(fixes).toHaveLength(1)
    expect(fixes[0]).toMatchObject({ system: 'Renal', date: T, reason: 'From your UWorld results: Renal 45%' })
    expect(s.scheduled.some((t) => t.kind === 'retest' && t.system === 'Renal' && t.date > T)).toBe(true)
    expect(buildDay(s, T).tasks.some((t) => t.kind === 'fix' && t.system === 'Renal')).toBe(true)
  })
  it('a second import replaces the first and does not stack fixes', () => {
    const again = applyImport(s, [{ system: 'Renal', used: 100, pct: 50 }], T)
    expect(again.sessions.filter((x) => x.imported)).toHaveLength(1)
    expect(again.scheduled.filter((t) => t.kind === 'fix')).toHaveLength(1)
    expect(importedResults(again)).toEqual([{ system: 'Renal', used: 100, pct: 50 }])
  })
  it('no fix when nothing is under the line', () => {
    const fine = applyImport(base, [{ system: 'Cardio', used: 50, pct: WEAK_BELOW }], T)
    expect(fine.scheduled.filter((t) => t.kind === 'fix')).toHaveLength(0)
  })
  it('imported numbers are not counted as this week\'s work', () => {
    expect(weeklyReport(s.sessions, s.topics, T).questions).toBe(0)
  })
  it('onboarding with an import starts on the weakest system that has not been started', () => {
    const fresh = buildPlanState(answers({ uworldImport: rows }), T)
    expect(fresh.focus).toEqual(['Renal'])
    expect(suggestNextSystem(fresh, T, ['Renal'])).toBe('Cardio')
  })
  it('imported results are history: they keep counting after 30 days, until your own blocks on that system add up', () => {
    const later = addDays(T, 45)
    const renal = (xs: ReturnType<typeof recentAccuracy>) => xs.find((x) => x.system === 'Renal')
    // 45 days on, nothing of her own: the imported history still says what she knows.
    expect(renal(recentAccuracy(s.sessions, later))).toMatchObject({ pct: 45, attempted: 80 })
    // A few blocks of her own on Renal: history and recent work together.
    const few = [...s.sessions, { id: 'a', date: addDays(later, -2), kind: 'study' as const, goalId: 'step1', system: 'Renal', minutes: 30, questions: 20, correct: 16 }]
    expect(renal(recentAccuracy(few, later))).toMatchObject({ attempted: 100, correct: 52 })
    // Enough of her own: they speak for themselves.
    const many = [...few, { id: 'b', date: addDays(later, -1), kind: 'study' as const, goalId: 'step1', system: 'Renal', minutes: 30, questions: 30, correct: 24 }]
    expect(renal(recentAccuracy(many, later))).toMatchObject({ attempted: 50, correct: 40, pct: 80 })
  })
  it('does nothing without a qbank', () => {
    const none = buildPlanState(answers({ resources: ['bnb', 'firstaid'] }), T)
    expect(applyImport(none, rows, T)).toBe(none)
  })
})

describe('the road to the exam', () => {
  const s = buildPlanState(answers({ systemsNow: ['Cardio'], systemsNowUnsure: false }), T)
  const road = roadToExam(s, T)!

  it('starts with the system studied now and runs back-to-back to the ready-by date', () => {
    expect(road.segments[0]).toMatchObject({ systems: ['Cardio'], now: true, from: T })
    for (let i = 1; i < road.segments.length; i++) {
      expect(road.segments[i].from >= road.segments[i - 1].from).toBe(true)
      expect(daysBetween(road.segments[i - 1].to, road.segments[i].from)).toBeLessThanOrEqual(1)
    }
    expect(road.segments.at(-1)!.to).toBe(addDays(road.readyOn!, -1))
    expect(road.readyOn).toBe(readiness(s, road.goal, T).readyOn)
  })
  it('covers every system once', () => {
    const all = road.segments.flatMap((x) => x.systems)
    expect(new Set(all).size).toBe(all.length)
    expect(all.length).toBe(new Set(s.topics.map((t) => t.system)).size)
  })
  it('follows imported accuracy: the weakest not-started system comes next', () => {
    const imported = applyImport(s, [{ system: 'GI', used: 40, pct: 40 }], T)
    expect(roadToExam(imported, T)!.segments[1].systems).toEqual(['GI'])
  })
  it('marks stops after the exam when there isn\'t enough time', () => {
    const tight = buildPlanState(answers({ systemsNow: ['Cardio'], systemsNowUnsure: false, dates: { step1: { kind: 'date', date: addDays(T, 40) } } }), T)
    const r = roadToExam(tight, T)!
    expect(r.segments.some((x) => x.afterExam)).toBe(true)
    expect(r.segments[0].afterExam).toBe(false)
  })
  it('none for students who don\'t plan by topic', () => {
    expect(roadToExam(buildPlanState(answers({ goals: ['uni'], resources: [] }), T), T)).toBeNull()
  })
})

describe('what if', () => {
  const s = buildPlanState(answers({ systemsNow: ['Cardio'], systemsNowUnsure: false }), T)
  const goal = s.goals.find((g) => g.id === 'step1')!

  it('no change = today\'s ready-by date', () => {
    expect(readyOnWith(s, goal, T)).toBe(readiness(s, goal, T).readyOn)
    expect(whatIfDays(s, goal, T, {})).toBe(0)
  })
  it('more minutes a day moves the date earlier, more minutes more', () => {
    const d30 = whatIfDays(s, goal, T, { extraPerDay: 30 })!
    const d60 = whatIfDays(s, goal, T, { extraPerDay: 60 })!
    expect(d30).toBeGreaterThan(0)
    expect(d60).toBeGreaterThan(d30)
  })
  it('skipping tomorrow moves it later by about a day, never earlier', () => {
    const d = whatIfDays(s, goal, T, { skipDays: 1 })!
    expect(d).toBeLessThanOrEqual(0)
    expect(d).toBeGreaterThanOrEqual(-2)
  })
  it('null when there is no study time at all', () => {
    const none = { ...s, availability: { ...s.availability, weekdayMinutes: 0, weekendMinutes: 0 } }
    expect(readyOnWith(none, goal, T)).toBeNull()
    expect(whatIfDays(none, goal, T, { extraPerDay: 30 })).toBeNull()
  })
})

describe('daily load', () => {
  it('needed vs available, averaged over the coming weeks', () => {
    const s = buildPlanState(answers(), T)
    const load = dailyLoad(s, T)
    expect(load.available).toBeGreaterThan(180)
    expect(load.available).toBeLessThanOrEqual(240)
    expect(load.needed).toBeGreaterThan(0)
  })
  it('needed is unknown when no exam has a date', () => {
    const s: EngineState = buildPlanState(answers({ goals: ['step1'], dates: { step1: { kind: 'unknown' } } }), T)
    expect(dailyLoad(s, T).needed).toBeNull()
  })
  it('a closer exam needs more a day', () => {
    const far = dailyLoad(buildPlanState(answers({ goals: ['step1'] }), T), T).needed!
    const near = dailyLoad(buildPlanState(answers({ goals: ['step1'], dates: { step1: { kind: 'date', date: addDays(T, 60) } } }), T), T).needed!
    expect(near).toBeGreaterThan(far)
  })
})


describe('any question bank: parseQbankResults', () => {
  const rowsOf = (t: string) => parseQbankResults(t).rows
  it('reads a UWorld report the same way as before', () => {
    expect(rowsOf(ONE_CELL_PER_LINE)).toEqual(parseUworldReport(ONE_CELL_PER_LINE))
  })
  it('AMBOSS-style table with a header: Subject / Answered / Correct / Accuracy', () => {
    const t = ['Subject\tQuestions answered\tCorrect\tAccuracy', 'Cardiology\t120\t66\t55%', 'Nephrology\t80\t60\t75%', 'Total\t200\t126\t63%'].join('\n')
    expect(rowsOf(t)).toEqual([{ system: 'Cardio', used: 120, pct: 55 }, { system: 'Renal', used: 80, pct: 75 }])
  })
  it('generic CSV with correct and total, quoted names, and a total row left out', () => {
    const t = 'Category,Correct,Total\n"Pulmonary, critical care",30,50\nGastroenterology,18,40\nOverall,48,90'
    expect(rowsOf(t)).toEqual([{ system: 'Resp', used: 50, pct: 60 }, { system: 'GI', used: 40, pct: 45 }])
  })
  it('CSV with correct and wrong columns works out the total', () => {
    expect(rowsOf('Subject,Right,Wrong\nPsychiatry,14,6')).toEqual([{ system: 'Psych', used: 20, pct: 70 }])
  })
  it('percent-only table: a stand-in weight, flagged, not counted as questions', () => {
    const r = parseQbankResults('Subject\tScore %\nCardio\t72%\nRenal\t48%')
    expect(r.rows).toEqual([{ system: 'Cardio', used: 20, pct: 72, assumed: true }, { system: 'Renal', used: 20, pct: 48, assumed: true }])
    expect(r.assumedCounts).toBe(true)
  })
  it('"Cardio 12/20" line list, in any common spelling', () => {
    const t = 'Cardio 12/20\nRenal: 15 of 25\nResp - 60%\nGI 9 out of 30 (30%)'
    expect(rowsOf(t)).toEqual([
      { system: 'Cardio', used: 20, pct: 60 },
      { system: 'Resp', used: 20, pct: 60, assumed: true },
      { system: 'Renal', used: 25, pct: 60 },
      { system: 'GI', used: 30, pct: 30 },
    ])
  })
  it('header-less TSV: name, correct, total', () => {
    expect(rowsOf('Cardiology\t12\t20\nEndocrine\t7\t10')).toEqual([{ system: 'Cardio', used: 20, pct: 60 }, { system: 'Endo', used: 10, pct: 70 }])
  })
  it('unknown subject names are kept as custom subjects, after ours', () => {
    const r = parseQbankResults('Anatomy 14/20\nCardio 12/20\nHistology\t9/20\nMedical Law, 5/10')
    expect(r.rows.map((x) => x.system)).toEqual(['Cardio', 'Anatomy', 'Histology', 'Medical Law'])
    expect(r.custom).toContain('Anatomy')
    expect(r.rows.find((x) => x.system === 'Anatomy')).toEqual({ system: 'Anatomy', used: 20, pct: 70 })
  })
  it('merges repeated subjects, weighted', () => {
    expect(rowsOf('Cardio 10/20\nCardio 30/30')).toEqual([{ system: 'Cardio', used: 50, pct: 80 }])
  })
  it('garbage and empty input give a clear sentence, never a throw', () => {
    for (const t of ['', '   ', 'hello there', 'Dear student, your subscription renews on 3/4/2027', '\u0000\u0001 ???', '12 13 14']) {
      const r = parseQbankResults(t)
      expect(r.rows).toEqual([])
      expect(r.message).toEqual(expect.any(String))
      expect(r.message!.length).toBeGreaterThan(10)
    }
  })
})

describe('applying an import from another bank or papers', () => {
  const base = buildPlanState(answers({ resources: ['qbank', 'bnb'], qbankTotal: 2000 }), T)
  it('custom subjects count; the reason does not say UWorld', () => {
    const s = applyImport(base, [{ system: 'Anatomy', used: 20, pct: 40 }, { system: 'Cardio', used: 20, pct: 70 }], T)
    expect(s.sessions.filter((x) => x.imported).map((x) => x.system)).toEqual(['Anatomy', 'Cardio'])
    const fix = s.scheduled.find((t) => t.kind === 'fix')!
    expect(fix.system).toBe('Anatomy')
    expect(fix.reason).toBe('From your question-bank results: Anatomy 40%')
  })
  it('stand-in weights seed accuracy but are not questions done', () => {
    const s = applyImport(base, [{ system: 'Cardio', used: 20, pct: 70, assumed: true }], T)
    expect(s.resources.find((r) => r.type === 'qbank')!.doneUnits).toBe(base.resources.find((r) => r.type === 'qbank')!.doneUnits)
    expect(recentAccuracy(s.sessions, T).map((a) => a.system)).toEqual(['Cardio'])
  })
})

describe('past-paper results for a uni-only student', () => {
  it('seed accuracy on the papers resource with a neutral reason', () => {
    const uni = buildPlanState(answers({ goals: ['uni'], resources: [] }), T)
    expect(uni.resources.some((r) => r.type === 'papers')).toBe(true)
    const s = applyImport(uni, [{ system: 'Anatomy', used: 20, pct: 40 }], T)
    expect(s.sessions.filter((x) => x.imported)).toHaveLength(1)
    expect(s.scheduled.find((t) => t.kind === 'fix')?.reason).toBe('From your past-paper results: Anatomy 40%')
  })
})
