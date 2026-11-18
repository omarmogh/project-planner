// Results from ANY question bank (or a uni past-paper results table) → per-subject numbers. Pure, local.
//
// Accepts what students actually have: a UWorld report, an AMBOSS / Kaplan / BoardVitals / local-bank
// table copied from the page, a CSV / TSV export, "Cardio 12/20" lines, a percent-only table, with or
// without a header row. Names we know map to our systems; every other name is kept as its own subject.
// Never throws; garbage gives an empty result and one clear sentence.

import { SYSTEMS } from './topics'
import { parseUworldReport, systemFromLine, type ImportedSystem } from './uworldImport'

export type { ImportedSystem }

export { PCT_ONLY_QUESTIONS } from '../engine/config'
import { PCT_ONLY_QUESTIONS } from '../engine/config'

export interface QbankParse {
  rows: ImportedSystem[]
  /** Set when nothing usable was found (or the text was empty): one calm sentence to show. */
  message: string | null
  /** Subjects we kept under the student's own name because they match none of our systems. */
  custom: string[]
  /** Lines with something that looked like a result but no subject we could read. */
  skipped: number
  /** True when at least one row had a % but no question count (we assumed PCT_ONLY_QUESTIONS). */
  assumedCounts: boolean
}

/** Extra names other banks use (lower case, letters only), on top of the UWorld list in uworldImport. */
const EXTRA_ALIASES: [string, string][] = [
  ['pulmonology', 'Resp'],
  ['pulmonary medicine', 'Resp'],
  ['lungs', 'Resp'],
  ['nephrology', 'Renal'],
  ['urology', 'Renal'],
  ['kidney', 'Renal'],
  ['gi', 'GI'],
  ['digestive', 'GI'],
  ['hepatology', 'GI'],
  ['endocrine diabetes metabolism', 'Endo'],
  ['hematology', 'Heme/Onc'],
  ['haematology', 'Heme/Onc'],
  ['heme onc', 'Heme/Onc'],
  ['blood', 'Heme/Onc'],
  ['neuroscience', 'Neuro'],
  ['neuro', 'Neuro'],
  ['ophthalmology', 'Neuro'],
  ['obstetrics gynecology', 'Repro'],
  ['obstetrics gynaecology', 'Repro'],
  ['obstetrics', 'Repro'],
  ['gynecology', 'Repro'],
  ['gynaecology', 'Repro'],
  ['ob gyn', 'Repro'],
  ['obgyn', 'Repro'],
  ['breast', 'Repro'],
  ['rheumatology', 'Immuno'],
  ['immunity', 'Immuno'],
  ['bacteriology', 'Micro'],
  ['virology', 'Micro'],
  ['infectious', 'Micro'],
  ['psychology', 'Psych'],
  ['psychiatric', 'Psych'],
  ['skin', 'Derm'],
  ['dermato', 'Derm'],
  ['pharmacotherapy', 'Pharm'],
  ['pharmacology', 'Pharm'],
  ['pathophysiology', 'Pathology'],
  ['ethics', 'Behavioral'],
  ['statistics', 'Biostats'],
  ['biostatistics', 'Biostats'],
  ['musculoskeletal', 'MSK'],
  ['msk', 'MSK'],
]

const norm = (s: string) => s.toLowerCase().replace(/&/g, ' ').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim()

/** Names that mean "the whole table", not a subject. */
const TOTAL_NAMES = /^(total|totals|overall|all|all subjects|all systems|average|mean|grand total|sum|summary|combined|everything)$/

/** Our system id for a name, or undefined. */
function knownSystem(name: string): string | undefined {
  const direct = SYSTEMS.find((s) => s.id.toLowerCase() === name.toLowerCase() || s.name.toLowerCase() === name.toLowerCase())
  if (direct) return direct.id
  const viaUworld = systemFromLine(name)
  if (viaUworld) return viaUworld
  const n = norm(name)
  if (!n) return undefined
  const hit = EXTRA_ALIASES.find(([a]) => n === a || n.startsWith(`${a} `))
  return hit?.[1]
}

/** Keep the student's own words, tidied. */
function customName(raw: string): string {
  const t = raw.replace(/\s+/g, ' ').replace(/^[\s\-–—:;,.•*#>|"']+|[\s\-–—:;,.•*|"']+$/g, '').trim()
  return t.length > 40 ? t.slice(0, 40).trim() : t
}

type Token = { kind: 'frac'; a: number; b: number } | { kind: 'pct'; v: number } | { kind: 'num'; v: number }

const toNum = (s: string) => Number(s.replace(/,/g, ''))

// "12/20", "12 of 20", "12 out of 20", "60%", "60.5 %", "1,200".
const TOKEN = /(\d[\d,]*(?:\.\d+)?)\s*(?:\/|\bout\s+of\b|\bof\b)\s*(\d[\d,]*)|(\d+(?:\.\d+)?)\s*%|(\d[\d,]*(?:\.\d+)?)/gi

function tokens(text: string): Token[] {
  const out: Token[] = []
  for (const m of text.matchAll(TOKEN)) {
    if (m[1] !== undefined) out.push({ kind: 'frac', a: toNum(m[1]), b: toNum(m[2]) })
    else if (m[3] !== undefined) out.push({ kind: 'pct', v: Number(m[3]) })
    else out.push({ kind: 'num', v: toNum(m[4]) })
  }
  return out
}

interface Nums {
  correct?: number
  total?: number
  wrong?: number
  pct?: number
}

/** Numbers named by a nearby word: "12 correct", "20 questions", "8 wrong". */
function keywordNums(text: string): Nums {
  const n: Nums = {}
  const grab = (re: RegExp) => {
    const m = text.match(re)
    return m ? toNum(m[1]) : undefined
  }
  n.correct = grab(/(\d[\d,]*)\s*(?:correct|right)\b/i) ?? grab(/\b(?:correct|right)\s*[:=]?\s*(\d[\d,]*)(?!\s*%)/i)
  n.wrong = grab(/(\d[\d,]*)\s*(?:incorrect|wrong)\b/i) ?? grab(/\b(?:incorrect|wrong)\s*[:=]?\s*(\d[\d,]*)(?!\s*%)/i)
  n.total = grab(/(\d[\d,]*)\s*(?:total|questions?|qs?|attempted|answered|items?)\b/i) ?? grab(/\b(?:total|attempted|answered|questions?)\s*[:=]?\s*(\d[\d,]*)(?!\s*%)/i)
  return n
}

/** Best reading of the numbers in a row with no header telling us which is which. */
function guessNums(text: string): Nums {
  const toks = tokens(text)
  const nums: Nums = {}
  const frac = toks.find((t): t is Extract<Token, { kind: 'frac' }> => t.kind === 'frac')
  const pct = toks.find((t): t is Extract<Token, { kind: 'pct' }> => t.kind === 'pct')
  const plain = toks.filter((t): t is Extract<Token, { kind: 'num' }> => t.kind === 'num').map((t) => t.v)
  if (pct) nums.pct = pct.v
  if (frac) {
    nums.correct = Math.min(frac.a, frac.b)
    nums.total = Math.max(frac.a, frac.b)
    return nums
  }
  if (plain.length >= 3) {
    const [a, b, c] = plain
    if (a + b === c) Object.assign(nums, { correct: a, wrong: b, total: c })
    else if (a === b + c) Object.assign(nums, { total: a, correct: b, wrong: c })
    else Object.assign(nums, { total: Math.max(...plain), correct: plain.find((v) => v <= Math.max(...plain)) })
  } else if (plain.length === 2) {
    nums.correct = Math.min(...plain)
    nums.total = Math.max(...plain)
    if (nums.pct !== undefined && plain[0] === plain[1]) nums.correct = (plain[0] * nums.pct) / 100
  } else if (plain.length === 1) {
    if (nums.pct !== undefined) nums.total = plain[0]
    else if (plain[0] <= 100) nums.pct = plain[0] // "Cardio 72": a percent-only table
    else nums.total = plain[0]
  }
  return nums
}

/** Combine whatever was found into one result row, or null when there is nothing usable. */
function finish(system: string, n: Nums): (ImportedSystem & { assumed: boolean }) | null {
  let total = n.total
  let correct = n.correct
  if (total === undefined && correct !== undefined && n.wrong !== undefined) total = correct + n.wrong
  if (correct === undefined && total !== undefined && n.wrong !== undefined) correct = total - n.wrong
  if (correct !== undefined && total !== undefined && correct > total) [correct, total] = [total, correct]
  let pct = n.pct ?? (correct !== undefined && total ? (correct * 100) / total : undefined)
  if (pct !== undefined && (pct < 0 || pct > 100)) pct = undefined
  if (total === undefined && pct === undefined) return null
  if (total !== undefined && total <= 0) return null
  const assumed = total === undefined
  return { system, used: total ?? PCT_ONLY_QUESTIONS, pct: pct === undefined ? null : Math.round(pct), assumed }
}

// ---- table handling ---------------------------------------------------------------------------

type Role = 'name' | 'correct' | 'wrong' | 'total' | 'pct' | 'used'

function headerRole(cell: string): Role | undefined {
  const c = cell.toLowerCase().trim()
  if (!c || /\d/.test(c)) return undefined
  if (/incorrect|wrong|missed/.test(c)) return 'wrong'
  if (/correct|right/.test(c) && !/%|percent|pct/.test(c)) return 'correct'
  if (/%|percent|pct|accuracy|score|average|mean/.test(c)) return 'pct'
  if (/usage|used/.test(c)) return 'used'
  if (/total|attempt|answered|taken|count|questions?|qs\b|number|items?/.test(c)) return 'total'
  if (/subject|system|topic|name|category|section|paper|course|module|discipline|specialty|specialism|block|area|unit/.test(c)) return 'name'
  return undefined
}

/** Split one delimited line; handles "quoted, cells" for CSV. */
function splitLine(line: string, delim: string): string[] {
  if (delim !== ',' && delim !== ';') return line.split(delim).map((c) => c.trim())
  const cells: string[] = []
  let cur = ''
  let quoted = false
  for (const ch of line) {
    if (ch === '"') quoted = !quoted
    else if (ch === delim && !quoted) {
      cells.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  cells.push(cur.trim())
  return cells
}

/** The delimiter used by most non-empty lines, if any ("\t" first, then "," ";" "|"). */
function detectDelimiter(lines: string[]): string | null {
  for (const d of ['\t', '|', ';', ',']) {
    // A comma inside a number ("1,200") is not a delimiter: only count commas next to a space-less letter run.
    const hits = lines.filter((l) => (d === ',' ? /[A-Za-z"][^,]*,/.test(l) : l.includes(d))).length
    if (hits >= Math.max(1, Math.ceil(lines.length * 0.6)) && hits >= 1) {
      // Needs at least one line that splits into 2+ cells with some text.
      if (lines.some((l) => splitLine(l, d).filter(Boolean).length >= 2)) return d
    }
  }
  return null
}

const isNumericCell = (c: string) => c !== '' && /^[\d\s.,/%()+-]*$/.test(c) && /\d/.test(c)

/** Strip filler words from a free-text line to leave the subject name. */
function nameFromFreeText(line: string): string {
  return line
    .replace(TOKEN, ' ')
    .replace(/\b(?:correct|incorrect|right|wrong|total|attempted|answered|questions?|qs?|score|scored|accuracy|got|items?)\b/gi, ' ')
    .replace(/[():=|,;]+/g, ' ')
    .replace(/\s+-\s+|\s+[–—]\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

interface Accum {
  correct: number
  total: number
  pctWeight: number
  assumed: boolean
  display: string
  system: string
}

/**
 * Read results from any question-bank text. Merges repeated subjects (questions add up, % weighted),
 * maps known names to our systems, keeps unknown names, returns rows in our system order, then customs
 * in the order met.
 */
export function parseQbankResults(text: string): QbankParse {
  const empty = (message: string): QbankParse => ({ rows: [], message, custom: [], skipped: 0, assumedCounts: false })
  const clean = (text ?? '').replace(/^﻿/, '')
  if (!clean.trim()) return empty('Paste your results or choose a file first.')
  if (clean.length > 400_000) return empty('That is too much text to read. Try one table at a time.')

  // A copied UWorld report has its own shape (one cell per line, Subjects vs Systems).
  if (/usage|p[\s-]?rank|correct q\b|omitted/i.test(clean)) {
    const uw = parseUworldReport(clean)
    if (uw.length) return { rows: uw, message: null, custom: [], skipped: 0, assumedCounts: false }
  }

  const lines = clean.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const delim = detectDelimiter(lines)
  const acc = new Map<string, Accum>()
  let skipped = 0

  const add = (rawName: string, n: Nums, rawRow: string) => {
    const name = customName(rawName)
    // Dates ("3/4/2027") and sentences are not result rows.
    if (!name || /^\d+$/.test(name) || /\d{1,4}[/.-]\d{1,2}[/.-]\d{2,4}/.test(rawRow) || name.split(' ').length > 6) { skipped++; return }
    if (TOTAL_NAMES.test(norm(name))) return
    const row = finish('', n)
    if (!row) { skipped++; return }
    const known = knownSystem(name)
    const key = known ?? `custom:${name.toLowerCase()}`
    const a = acc.get(key) ?? { correct: 0, total: 0, pctWeight: 0, assumed: false, display: known ?? name, system: known ?? name }
    a.total += row.used
    if (row.pct !== null) {
      a.correct += (row.used * row.pct) / 100
      a.pctWeight += row.used
    }
    a.assumed = a.assumed || row.assumed
    acc.set(key, a)
  }

  if (delim) {
    const rows = lines.map((l) => splitLine(l, delim))
    // Header: the first of the first few rows whose cells are all non-numeric and name a column.
    let headerAt = -1
    let roles: (Role | undefined)[] = []
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const rs = rows[i].map(headerRole)
      const nonEmpty = rows[i].filter(Boolean)
      if (rs.filter(Boolean).length >= 2 && nonEmpty.every((c) => !isNumericCell(c)) ) {
        headerAt = i
        roles = rs
        break
      }
    }
    const nameCol = roles.findIndex((r) => r === 'name')
    const hasRoles = roles.some((r) => r && r !== 'name')
    rows.forEach((cells, i) => {
      if (i === headerAt) return
      if (headerAt >= 0 && i < headerAt) return
      if (!cells.some(Boolean)) return
      const nameIdx = nameCol >= 0 ? nameCol : cells.findIndex((c) => c && !isNumericCell(c))
      if (nameIdx < 0) { skipped++; return }
      const rest = cells.filter((_, j) => j !== nameIdx)
      let nums: Nums = {}
      if (headerAt >= 0 && hasRoles) {
        cells.forEach((cell, j) => {
          const role = roles[j]
          if (!cell || j === nameIdx || !role || role === 'name') return
          const t = tokens(cell)
          const first = t[0]
          if (!first) return
          if (first.kind === 'frac') {
            if (role === 'used') nums.total ??= first.a
            else { nums.correct ??= Math.min(first.a, first.b); nums.total ??= Math.max(first.a, first.b) }
            return
          }
          const v = first.kind === 'pct' ? first.v : first.v
          if (role === 'pct') nums.pct ??= v
          else if (role === 'correct') nums.correct ??= v
          else if (role === 'wrong') nums.wrong ??= v
          else nums.total ??= v
        })
        // A "Score" column holding 12/20 or a % in a column we called correct is handled above; fall back otherwise.
        if (nums.total === undefined && nums.pct === undefined && nums.correct === undefined) nums = guessNums(rest.join(' '))
      } else {
        nums = { ...guessNums(rest.join(' ')), ...definedOnly(keywordNums(rest.join(' '))) }
      }
      add(cells[nameIdx], nums, cells.join(' '))
    })
  } else {
    for (const line of lines) {
      if (!/\d/.test(line)) continue // a heading or note
      const name = nameFromFreeText(line)
      add(name, { ...guessNums(line), ...definedOnly(keywordNums(line)) }, line)
    }
  }

  const keys = [...acc.keys()]
  const ordered = [
    ...SYSTEMS.map((s) => acc.get(s.id) && s.id).filter((x): x is string => !!x).map((id) => acc.get(id)!),
    ...keys.filter((k) => k.startsWith('custom:')).map((k) => acc.get(k)!),
  ]
  const rows: ImportedSystem[] = ordered
    .filter((a) => a.total > 0)
    .map((a) => ({
      system: a.system,
      used: Math.round(a.total),
      pct: a.pctWeight > 0 ? Math.round((a.correct * 100) / a.pctWeight) : null,
      ...(a.assumed ? { assumed: true } : {}),
    }))
  const custom = ordered.filter((a) => !SYSTEMS.some((s) => s.id === a.system)).map((a) => a.system)
  const assumedCounts = ordered.some((a) => a.assumed)

  if (!rows.length) {
    return empty('We could not find subjects with scores in that. Try a table with a name and either correct out of total or a percent, like "Cardio 12/20", or type the numbers instead.')
  }
  return { rows, message: null, custom, skipped, assumedCounts }
}

const definedOnly = (n: Nums): Nums => Object.fromEntries(Object.entries(n).filter(([, v]) => v !== undefined)) as Nums

/** "Cardio 120 used, 52% correct" lines for the preview. */
export { importSummary } from './uworldImport'
