// Writes the saved state of a uni-only student (no question bank) for the browser tests.
// Does nothing in a normal `vitest run`: tests/e2e/run.mjs sets E2E_FIXTURE_OUT and runs it.

import { writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { addDays, buildDay } from '../../src/engine'
import { buildPlanState, defaultAnswers, subjectFor } from '../../src/data/setup'
import { STORE_KEY, STORE_VERSION } from '../../src/store/demoStore'

it.skipIf(!process.env.E2E_FIXTURE_OUT)('uni-only student, saved as the app stores it', () => {
  const T = '2026-11-15'
  const a = {
    ...defaultAnswers(), stage: 'clinical' as const, university: { name: 'Mutah University', country: 'JO' }, weekendDays: [5, 6],
    goals: ['uni' as const], resources: ['slides' as const], weekdayHours: 2, weekendHours: 4,
    rotation: { subjects: [{ ...subjectFor('im'), lecturesLeft: 80 }, { ...subjectFor('surgery'), examAtEnd: false, examDate: addDays(T, 30), lecturesLeft: 40 }], end: { date: addDays(T, 20) } },
  }
  const plan = buildPlanState(a, T)
  const day = buildDay(plan, T)
  const state = {
    today: T, plan, todayTasks: day.tasks, dayKind: day.kind, available: day.available, dayType: day.type, dayNotes: day.notes, movedTasks: day.moved,
    pinned: true, dayMode: 'full', lightNote: null, tab: 'pace', ankiConnected: false, newIds: [], datePromptDismissed: [], sweepRatings: {},
  }
  writeFileSync(process.env.E2E_FIXTURE_OUT!, JSON.stringify({ key: STORE_KEY, saved: { state, version: STORE_VERSION } }))
})
