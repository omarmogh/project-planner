// UWorld "performance by system" report → per-system numbers. Pure.
//
// Tolerant on purpose: the student copies the report page and pastes it, so the
// text can arrive one cell per line or one row per line (tabs), with headers,
// subjects, extra lines, systems in any order and systems missing.
//
// TODO(real sample): fixtures in __tests__ are synthetic until Omar pastes his
// own report text. Replace them with the real one and adjust ALIASES if needed.

import { SYSTEMS } from './topics'

export interface ImportedSystem {
  /** Our system id ("Cardio"). */
  system: string
  /** Questions used. */
  used: number
  /** % correct, 0–100. null = not found in the text. */
  pct: number | null
  /** True when the text had a % but no question count, so `used` is a stand-in weight (not counted as questions done). */
  assumed?: boolean
}

/**
 * UWorld system names (lower case, punctuation stripped) → our system id.
 * Matched as a prefix of the line, longest first, so "cardiovascular system" and
 * "cardiovascular" both work. Several UWorld systems can map to one of ours.
 */
const ALIASES: [string, string][] = [
  ['allergy immunology', 'Immuno'],
  ['immunology', 'Immuno'],
  ['rheumatology orthopedics', 'MSK'],
  ['rheumatology', 'Immuno'],
  ['musculoskeletal', 'MSK'],
  ['orthopedics', 'MSK'],
  ['cardiovascular', 'Cardio'],
  ['cardiology', 'Cardio'],
  ['cardio', 'Cardio'],
  ['pulmonary critical care', 'Resp'],
  ['pulmonary', 'Resp'],
  ['respiratory', 'Resp'],
  ['renal urinary', 'Renal'],
  ['renal', 'Renal'],
  ['gastrointestinal', 'GI'],
  ['gastroenterology', 'GI'],
  ['endocrine', 'Endo'],
  ['endocrinology', 'Endo'],
  ['hematology oncology', 'Heme/Onc'],
  ['hematology', 'Heme/Onc'],
  ['oncology', 'Heme/Onc'],
  ['nervous system', 'Neuro'],
  ['neurology', 'Neuro'],
  ['ophthalmology', 'Neuro'],
  ['female reproductive', 'Repro'],
  ['male reproductive', 'Repro'],
  ['reproductive', 'Repro'],
  ['pregnancy childbirth', 'Repro'],
  ['infectious diseases', 'Micro'],
  ['infectious disease', 'Micro'],
  ['microbiology', 'Micro'],
  ['psychiatric behavioral', 'Psych'],
  ['psychiatry', 'Psych'],
  ['dermatology', 'Derm'],
  ['pharmacology', 'Pharm'],
  ['biochemistry', 'Biochem'],
  ['genetics', 'Genetics'],
  ['general principles', 'Pathology'],
  ['pathology', 'Pathology'],
  ['biostatistics', 'Biostats'],
  ['epidemiology', 'Biostats'],
  ['social sciences', 'Behavioral'],
  ['behavioral science', 'Behavioral'],
  ['ethics', 'Behavioral'],
].sort((a, b) => b[0].length - a[0].length) as [string, string][]

/** Lines that hold a value, not a new row: "Correct Q", "Usage", "P-Rank"… */
const VALUE_LINE = /^(usage|used|total|correct|incorrect|omitted|p[\s-]?rank|score|q\b|questions?|%|\d)/i

const norm = (s: string) => s.toLowerCase().replace(/&/g, ' ').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim()

/** Our system id for a line that starts with a UWorld system name; undefined otherwise. */
export function systemFromLine(line: string): string | undefined {
  const n = norm(line.split(/\t|\d/)[0] ?? '')
  if (!n) return undefined
  return ALIASES.find(([alias]) => n === alias || n.startsWith(`${alias} `))?.[1]
}

interface Raw {
  used?: number
  total?: number
  correctN?: number
  pct?: number
  firstPct?: number
}

/** Read the numbers out of one chunk of text that belongs to a system row. */
function readValues(text: string, into: Raw) {
  // "120/254" or "120 / 254": used of total.
  const frac = text.match(/(\d[\d,]*)\s*\/\s*(\d[\d,]*)/)
  if (frac && into.used === undefined) {
    into.used = toInt(frac[1])
    into.total = toInt(frac[2])
  }
  const used = text.match(/(?:used|usage)\s*(?:q(?:uestions)?)?\s*[:\s]\s*(\d[\d,]*)/i)
  if (used && into.used === undefined) into.used = toInt(used[1])
  // "Correct Q 62 (52%)", "Correct: 52%", "Correct 62".
  const correct = text.match(/(?<!in)correct\s*(?:q(?:uestions)?)?\s*[:\s]\s*(\d[\d,]*(?:\.\d+)?)\s*(%)?(?:\s*\(\s*(\d+(?:\.\d+)?)\s*%\s*\))?/i)
  if (correct) {
    if (correct[2]) into.pct ??= Number(correct[1])
    else {
      into.correctN ??= toInt(correct[1])
      if (correct[3]) into.pct ??= Number(correct[3])
    }
  }
  const anyPct = text.match(/(\d+(?:\.\d+)?)\s*%/)
  if (anyPct) into.firstPct ??= Number(anyPct[1])
}

const toInt = (s: string) => Number(s.replace(/,/g, ''))

/**
 * Parse pasted report text. Returns one row per system we know, in our system order.
 * Rows with 0 questions used are dropped. Several UWorld systems that map to one of
 * ours are combined (questions add up, % is weighted).
 */
export function parseUworldReport(text: string): ImportedSystem[] {
  const rows = new Map<string, Raw[]>()
  let current: Raw | null = null
  // The report also lists Subjects (Pathology, Pharmacology…). Those overlap systems,
  // so a "Subjects" heading pauses reading until "Systems".
  let inSubjects = false
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const heading = norm(line)
    if (heading === 'subjects' || heading === 'subject') {
      inSubjects = true
      current = null
      continue
    }
    if (heading === 'systems' || heading === 'system') {
      inSubjects = false
      current = null
      continue
    }
    if (inSubjects) continue
    const system = systemFromLine(line)
    if (system) {
      current = {}
      rows.set(system, [...(rows.get(system) ?? []), current])
      // Values on the same line (a row copied with tabs).
      const rest = line.replace(/^[^\t\d]*/, '')
      if (rest) readValues(rest, current)
      continue
    }
    if (!current) continue
    // A new heading we don't know ("Subjects", "Anatomy", "Name") ends the row.
    if (!VALUE_LINE.test(line)) {
      current = null
      continue
    }
    readValues(line, current)
  }

  const out: ImportedSystem[] = []
  for (const def of SYSTEMS) {
    const parts = rows.get(def.id)
    if (!parts) continue
    let used = 0
    let correct = 0
    let withPct = 0
    for (const r of parts) {
      const u = r.used ?? 0
      if (u <= 0) continue
      used += u
      const p = r.pct ?? (r.correctN !== undefined ? (r.correctN * 100) / u : r.firstPct)
      if (p !== undefined && p >= 0 && p <= 100) {
        correct += (u * p) / 100
        withPct += u
      }
    }
    if (used <= 0) continue
    out.push({ system: def.id, used, pct: withPct > 0 ? Math.round((correct * 100) / withPct) : null })
  }
  return out
}

/** "Cardio 120 used, 52% correct" lines for the preview. */
export function importSummary(rows: ImportedSystem[]): string {
  return rows.map((r) => `${r.system} ${r.used} used${r.pct === null ? '' : `, ${r.pct}% correct`}`).join(' · ')
}
