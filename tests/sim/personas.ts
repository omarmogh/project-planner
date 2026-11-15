// The simulated students. Each is built through the real onboarding (buildPlanState), so setup is tested too.

import { addDays, weekday, type EngineState, type ISODate } from '../../src/engine'
import { buildPlanState, defaultAnswers, nextRotation, startBreak, subjectFor, type Answers, type RotationAnswer } from '../../src/data/setup'
import { SYSTEM_IDS } from '../../src/data/topics'
import type { Persona } from './sim'

/** A Sunday, so weeks line up with the Jordanian week. */
export const START: ISODate = '2026-11-15'
const MUTAH = { name: 'Mutah University', country: 'JO' }

const answers = (over: Partial<Answers>): Answers => ({ ...defaultAnswers(), university: MUTAH, weekendDays: [5, 6], ...over })
const sub = (key: string, over: Partial<ReturnType<typeof subjectFor>> = {}) => ({ ...subjectFor(key), ...over })
const rotation = (keys: string[], weeks: 1 | 2 | 3 | 4): RotationAnswer => ({ subjects: keys.map((k) => sub(k)), end: { weeks } })

/** A 5th-year on an IM rotation with Step 1 ahead: the example user. */
const clinical = (over: Partial<Answers> = {}): Answers => answers({
  stage: 'clinical',
  goals: ['uni', 'step1'],
  dates: { step1: { kind: 'date', date: addDays(START, 150) } },
  rotation: { subjects: [sub('im', { lecturesLeft: 12 })], end: { date: addDays(START, 24) } },
  resources: ['uworld', 'bnb', 'firstaid', 'anki'],
  uworldDone: 600,
  ankiNewLeft: 1500,
  ankiReviewMinutes: 30,
  systemsNow: ['Cardio'],
  systemsNowUnsure: false,
  systemsDone: [],
  systemsDoneNone: true,
  weekdayHours: 2.5,
  weekendHours: 5,
  ...over,
})

const dedicated = (over: Partial<Answers> = {}): Answers => answers({
  stage: 'graduated',
  university: null,
  goals: ['step1'],
  dates: { step1: { kind: 'date', date: addDays(START, 80) } },
  resources: ['uworld', 'bnb', 'firstaid', 'anki'],
  uworldDone: 0,
  ankiNewLeft: 2000,
  ankiReviewMinutes: 30,
  systemsNowUnsure: true,
  weekdayHours: 4,
  weekendHours: 4,
  ...over,
})

const build = (a: Answers) => (today: ISODate): EngineState => buildPlanState(a, today)

/** Rotations that follow one another: majors and minors, each ending in its exam. */
const chain = (list: [string[], 1 | 2 | 3 | 4][]) => (s: EngineState, today: ISODate, n: number): EngineState =>
  n < list.length ? nextRotation(s, rotation(...list[n]), MUTAH, today) : { ...s, nextAsked: s.rotation!.until }

const afterIM = chain([[['surgery'], 4], [['derm'], 2]])

export const PERSONAS: Persona[] = [
  {
    id: '01-perfect', name: 'Follows the plan exactly: IM rotation, then surgery; Step 1 in 5 months', seed: 1, weeks: 12, start: START,
    build: build(clinical()), next: afterIM,
  },
  {
    id: '02-skips-two-days', name: 'Skips two days every week', seed: 2, weeks: 12, start: START,
    build: build(clinical()), next: afterIM,
    away: (i) => [2, 4].includes(i % 7),
  },
  {
    id: '03-always-partly', name: 'Answers "Partly" to everything', seed: 3, weeks: 10, start: START,
    build: build(clinical()), next: afterIM,
    answer: (t) => (t.kind === 'anki' ? 'done' : 'partly'),
  },
  {
    id: '04-two-exams-one-week', name: 'ENT exam on Tuesday and Ophthalmology on Thursday of the same week', seed: 4, weeks: 8, start: START,
    build: build(clinical({
      rotation: {
        subjects: [
          sub('ent', { examAtEnd: false, examDate: addDays(START, 16), lecturesLeft: 10 }),
          sub('ophtho', { examAtEnd: false, examDate: addDays(START, 18), lecturesLeft: 8 }),
        ],
        end: { date: addDays(START, 18) },
      },
    })),
    next: chain([[['peds'], 4]]),
  },
  {
    id: '05-combined-ent-ophtho', name: 'Combined ENT + Ophthalmology rotation, both exams at its end; Step 1 "late next year"', seed: 5, weeks: 9, start: START,
    build: build(clinical({ dates: { step1: { kind: 'rough', when: 'late' } }, rotation: rotation(['ent', 'ophtho'], 3) })),
    next: chain([[['psych'], 2], [['im'], 4]]),
  },
  {
    id: '06-thirty-minutes', name: '30 minutes a day, Step 1 only, 15 minutes of Anki reviews', seed: 6, weeks: 12, start: START,
    build: build(dedicated({ weekdayHours: 0.5, weekendHours: 0.5, ankiReviewMinutes: 15, dates: { step1: { kind: 'rough', when: 'late' } } })),
  },
  {
    id: '07-eight-hours', name: 'Dedicated period: 8 hours a day, Step 1 in 8 weeks', seed: 7, weeks: 9, start: START,
    build: build(dedicated({ weekdayHours: 8, weekendHours: 8, ankiReviewMinutes: 60, resources: ['uworld', 'bnb', 'firstaid', 'pathoma', 'anki'], dates: { step1: { kind: 'date', date: addDays(START, 56) } } })),
    doMore: 0.2,
  },
  {
    id: '08-basic-sciences', name: 'Basic-sciences student: a module exam in a month, Step 1 far away', seed: 8, weeks: 10, start: START,
    build: build(answers({
      stage: 'basic', goals: ['uni', 'step1'],
      dates: { uni: { kind: 'date', date: addDays(START, 30) }, step1: { kind: 'rough', when: 'late' } },
      resources: ['slides', 'uworld', 'bnb', 'anki'], lecturesLeft: 24, uworldDone: 0, ankiNewLeft: 3000,
      systemsNow: ['Cardio'], systemsNowUnsure: false, weekdayHours: 3, weekendHours: 5,
    })),
  },
  {
    id: '09-no-dates', name: 'No exam dates known: Step 1 "no idea", rotation exam not announced', seed: 9, weeks: 10, start: START,
    build: build(clinical({
      dates: { step1: { kind: 'unknown' } },
      rotation: { subjects: [sub('surgery', { examAtEnd: false, examDate: 'dont-know' })], end: { weeks: 4 } },
    })),
    next: chain([[['fm'], 2]]),
  },
  {
    id: '10-weak-in-everything', name: 'Scores around 45% on everything', seed: 10, weeks: 10, start: START,
    build: build(clinical()), next: afterIM, accuracy: 45, retestAccuracy: 66,
  },
  {
    id: '11-fails-retests', name: 'Keeps failing retests', seed: 11, weeks: 12, start: START,
    build: build(dedicated()), accuracy: 55, retestAccuracy: 52,
  },
  {
    id: '12-big-uworld-history', name: 'Brings 2,800 UWorld questions of history and most systems studied once', seed: 12, weeks: 8, start: START,
    build: build(clinical({
      uworldDone: 2800,
      uworldImport: SYSTEM_IDS.slice(0, 12).map((system, i) => ({ system, used: 150 + i * 20, pct: 48 + ((i * 7) % 30) })),
      systemsNow: ['Micro'], systemsDone: SYSTEM_IDS.slice(0, 9), systemsDoneNone: false,
      dates: { step1: { kind: 'date', date: addDays(START, 70) } },
    })),
    next: afterIM,
  },
  {
    id: '13-far-behind-narrows', name: 'Far behind for a booked Step 1 date; picks "narrow the scope"', seed: 13, weeks: 8, start: START,
    build: build(dedicated({ weekdayHours: 2, weekendHours: 3, dates: { step1: { kind: 'date', date: addDays(START, 49) } } })),
    away: (i) => [1, 3, 5].includes(i % 7), rescue: 'narrow',
  },
  {
    id: '14-overconfident-sweeper', name: 'Rates every recall-sweep topic "Had it", then misses them in blocks', seed: 14, weeks: 10, start: START,
    build: build(dedicated({ systemsNow: ['Renal'], systemsNowUnsure: false, systemsDone: ['Cardio', 'Resp'], systemsDoneNone: false, uworldDone: 900 })),
    overconfident: true, accuracy: 52,
  },
  {
    id: '15-heavy-week-seminar', name: 'A week of extra lectures, evening clinics, a seminar on DKA and an assignment', seed: 15, weeks: 8, start: START,
    build: build(clinical()), next: afterIM,
    commitments: (i, date) => {
      const out: ReturnType<NonNullable<Persona['commitments']>> = []
      if (i === 7) {
        out.push({ kind: 'deadline', title: 'Seminar on DKA', tag: 'uni', date: addDays(date, 4), minutes: 180, topicId: 'endo-diabetes' })
        out.push({ kind: 'deadline', title: 'Case report', tag: 'uni', date: addDays(date, 6), minutes: 240 })
      }
      if (i >= 7 && i < 14 && ![5, 6].includes(weekday(date))) {
        out.push({ kind: 'busy', title: 'Lecture', tag: 'uni', date, from: '10:00', to: '12:00' })
        if (i % 2 === 1) out.push({ kind: 'busy', title: 'Evening clinic', tag: 'uni', date, from: '17:00', to: '19:00' })
      }
      if (i === 30) out.push({ kind: 'deadline', title: 'Presentation', tag: 'uni', date: addDays(date, 1), minutes: 300 })
      return out
    },
  },
  {
    id: '16-far-behind-moves-date', name: 'Far behind for Step 1; picks "move the date"', seed: 16, weeks: 8, start: START,
    build: build(dedicated({ weekdayHours: 2, weekendHours: 3, dates: { step1: { kind: 'date', date: addDays(START, 49) } } })),
    rescue: 'move',
  },
  {
    id: '17-far-behind-adds-time', name: 'Far behind for Step 1; picks "add time"', seed: 17, weeks: 8, start: START,
    build: build(dedicated({ weekdayHours: 2, weekendHours: 3, dates: { step1: { kind: 'date', date: addDays(START, 49) } } })),
    rescue: 'time',
  },
  {
    id: '18-uni-only-osce', name: 'Uni exams only: IM written exam, OSCE three days later, no board exam', seed: 18, weeks: 8, start: START,
    build: build(answers({
      stage: 'clinical', goals: ['uni'], resources: ['slides'],
      rotation: { subjects: [sub('im', { lecturesLeft: 30, osceDate: addDays(START, 31) })], end: { date: addDays(START, 28) } },
      weekdayHours: 2, weekendHours: 4,
    })),
    next: chain([[['obgyn'], 4]]),
  },
  {
    id: '19-minor-rotations', name: 'Two-week minor rotations back to back, Step 1 booked', seed: 19, weeks: 12, start: START,
    build: build(clinical({ rotation: rotation(['derm'], 2) })),
    next: chain([[['ortho'], 2], [['urology'], 2], [['anesthesia'], 2], [['radiology'], 2], [['em'], 2]]),
  },
  {
    id: '20-comes-back', name: 'Disappears for ten days in week three, then comes back', seed: 20, weeks: 10, start: START,
    build: build(clinical()), next: afterIM,
    away: (i) => i >= 15 && i < 25,
  },
  {
    id: '21-ignores-rescue', name: 'Far behind and never answers the rescue question', seed: 21, weeks: 8, start: START,
    build: build(dedicated({ weekdayHours: 1.5, weekendHours: 2, dates: { step1: { kind: 'date', date: addDays(START, 45) } } })),
    rescue: 'ignore',
  },
  {
    id: '22-rough-days-rests', name: 'Skips and half-finishes often, and takes every rest day offered', seed: 22, weeks: 10, start: START,
    build: build(clinical()), next: afterIM, light: 'rest',
    answer: (t, r) => (t.kind === 'anki' ? 'done' : r() < 0.3 ? 'skipped' : r() < 0.3 ? 'partly' : 'done'),
  },
  {
    id: '23-rotation-then-break', name: 'Rotation ends, then a break with 6 hours a day', seed: 23, weeks: 8, start: START,
    build: build(clinical({ rotation: { subjects: [sub('peds', { lecturesLeft: 10 })], end: { weeks: 2 } } })),
    next: (s, today) => startBreak(s, { weekdayHours: 6, weekendHours: 6 }, today),
  },
  {
    id: '24-slow-and-uni-rescue', name: 'Works at half speed with 40 lectures left two weeks before a uni exam', seed: 24, weeks: 8, start: START,
    build: build(clinical({ rotation: { subjects: [sub('surgery', { lecturesLeft: 40 })], end: { date: addDays(START, 13) } }, weekdayHours: 1.5, weekendHours: 2 })),
    next: afterIM, speed: 1.7, rescue: 'narrow',
  },
  {
    id: '25-weekends-off', name: 'No study on weekends, 12 minutes of Anki, and deadline work always answered "Partly"', seed: 25, weeks: 8, start: START,
    build: build(clinical({ weekendHours: 0, ankiReviewMinutes: 12 })), next: afterIM, rescue: 'time',
    answer: (t) => (t.commitmentId ? 'partly' : 'done'),
    commitments: (i, date) => (i % 14 === 3 ? [{ kind: 'deadline' as const, title: 'Case presentation', tag: 'uni' as const, date: addDays(date, 4), minutes: 90 }] : []),
  },
  {
    id: '26-almost-done-no-date', name: 'Nearly finished, Step 1 date "no idea", a big Anki deck left', seed: 26, weeks: 8, start: START,
    build: build(dedicated({
      dates: { step1: { kind: 'unknown' } }, uworldDone: 3560, ankiNewLeft: 1150,
      systemsNow: ['Behavioral'], systemsNowUnsure: false, systemsDone: SYSTEM_IDS.filter((x) => x !== 'Behavioral'), systemsDoneNone: false,
    })),
  },
  {
    id: '27-questions-all-day', name: 'Six hours a day of question blocks after covering everything, scoring low on mixed blocks', seed: 27, weeks: 8, start: START,
    build: build(dedicated({
      weekdayHours: 6, weekendHours: 6, uworldDone: 1200, systemsDone: [...SYSTEM_IDS], systemsDoneNone: false,
      dates: { step1: { kind: 'date', date: addDays(START, 60) } },
    })),
    accuracy: 50, retestAccuracy: 72,
  },
]
