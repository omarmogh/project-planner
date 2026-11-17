// Mutah University. From Omar's own experience there (Nov 2026); TODO(placeholder) marks
// what he wasn't sure of or what still needs checking with classmates.

import { GLOBAL_DEFAULT } from './default'
import type { UniversityTemplate } from './types'

export const MUTAH: UniversityTemplate = {
  ...GLOBAL_DEFAULT,
  id: 'mutah',
  name: 'Mutah University',
  aliases: ['Mutah', 'Muta', 'مؤتة', 'جامعة مؤتة'],
  rotation: {
    // "Major rotations (IM, Surgery, Pediatrics, OB-GYN) last about 8 weeks."
    majorWeeks: 8,
    // "Minors last about 2–4 weeks." TODO(placeholder): 3 is the middle; per-rotation lengths not known yet.
    minorWeeks: 3,
    majors: ['im', 'surgery', 'peds', 'obgyn'],
    // "Every rotation ends with an exam: yes."
    examAtEnd: true,
  },
  // "MCQ or written Mini-OSCE, and majors have OSCE as well." TODO(placeholder): which minors use which.
  exam: { major: ['mcq', 'mini-osce', 'osce'], minor: ['mcq', 'mini-osce'] },
  pastPapers: {
    ...GLOBAL_DEFAULT.pastPapers,
    // Past papers carry a large share of prep at Mutah, so one more than the global default.
    // TODO(placeholder): chosen by the engine's author, not measured. Ask classmates how many they do.
    defaultCount: 4,
  },
  // TODO(placeholder): lecture counts when "Not sure"; a major rotation has many more than a minor.
  lectures: { unsureMajor: 30, unsureMinor: 12 },
  // TODO(placeholder): carried over from the first prototype.
  blockExamInDays: 12,
}
