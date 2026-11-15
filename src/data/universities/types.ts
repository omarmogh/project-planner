// Everything institution-specific is data, never engine code: rotation lengths, exam formats,
// past papers, lecture counts. One template per university, plus a global default for everyone else.
// Weekends come from the country (src/data/weekends.ts).

/** How an exam is sat. 'mini-osce' = a written, station-style paper; 'osce' and 'viva' are in person. */
export type ExamFormat = 'mcq' | 'written' | 'mini-osce' | 'osce' | 'viva'

export interface UniversityTemplate {
  id: string
  /** The name in the bundled university list (universities.json). */
  name: string
  /** Short names students type ("JUST", "UJ"). Matched in search. */
  aliases: string[]
  rotation: {
    /** Typical length of a major and a minor rotation, in weeks. */
    majorWeeks: number
    minorWeeks: number
    /** Rotation ids (src/data/templates.ts) that are majors here. Everything else is a minor. */
    majors: string[]
    /** Every rotation ends with an exam. */
    examAtEnd: boolean
  }
  /** Exam formats by rotation size. Parts sat in person (OSCE, viva) can get their own date. */
  exam: { major: ExamFormat[]; minor: ExamFormat[] }
  pastPapers: {
    /** Papers planned when the student says "Not sure". */
    defaultCount: number
    /** Minutes for one paper, doing it and going over the misses. */
    minutes: number
    /** Share of the prep time the papers are spread over: for small and for large material. */
    windowSmall: number
    windowLarge: number
  }
  lectures: {
    /** Lectures left when the student says "Not sure". */
    unsureMajor: number
    unsureMinor: number
  }
  /** Board work shrinks to Anki only this long before a rotation exam (engine: windDownDaysFor). */
  windDown: { maxDays: number; fullWeeks: number; share: number; minDays: number }
  /** Days from now to the next block exam, when there's no rotation to go by. */
  blockExamInDays: number
  /** Exact rotation names, so a university's own list can replace the generic one. */
  rotations?: string[]
}
