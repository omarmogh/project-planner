// The global default: conservative values that are reasonable for a typical medical school
// anywhere. None of these come from one university. Each is an estimate until a template says otherwise.

import {
  PAPER_MINUTES, PAPERS_WINDOW_LARGE, PAPERS_WINDOW_SMALL, WIND_DOWN_FULL_WEEKS, WIND_DOWN_MAX_DAYS, WIND_DOWN_MIN_DAYS, WIND_DOWN_SHARE,
} from '../../engine'
import type { UniversityTemplate } from './types'

export const GLOBAL_DEFAULT: UniversityTemplate = {
  id: 'default',
  name: '',
  aliases: [],
  rotation: {
    majorWeeks: 6,
    minorWeeks: 2,
    majors: ['im', 'surgery', 'peds', 'obgyn'],
    examAtEnd: true,
  },
  // A written paper is the safe assumption; in-person parts are added only when a template knows them.
  exam: { major: ['mcq'], minor: ['mcq'] },
  pastPapers: {
    // Enough to learn how the exam asks without assuming papers are easy to get. Estimate.
    defaultCount: 3,
    minutes: PAPER_MINUTES,
    windowSmall: PAPERS_WINDOW_SMALL,
    windowLarge: PAPERS_WINDOW_LARGE,
  },
  lectures: { unsureMajor: 15, unsureMinor: 15 },
  windDown: { maxDays: WIND_DOWN_MAX_DAYS, fullWeeks: WIND_DOWN_FULL_WEEKS, share: WIND_DOWN_SHARE, minDays: WIND_DOWN_MIN_DAYS },
  blockExamInDays: 14,
}

/**
 * Board systems that match a rotation, so the suggested next system follows the ward.
 * Medical content, not institution-specific, so it lives with the default. Rotations with no
 * single matching system (IM, surgery, pediatrics, ENT…) are left out on purpose.
 * TODO(review): Omar to check the pairs.
 */
export const ROTATION_SYSTEMS: Record<string, string[]> = {
  ophtho: ['Neuro'],
  neuro: ['Neuro'],
  psych: ['Psych'],
  derm: ['Derm'],
  obgyn: ['Repro'],
  ortho: ['MSK'],
  urology: ['Renal', 'Repro'],
}
