// University search over the bundled Hipo list (MIT; see README). Loaded lazily:
// ~340 KB of names stays out of the first page load. No API calls.

import { UNIVERSITIES } from './registry'

export interface UniversityData {
  /** "JO" → "Jordan". */
  countries: Record<string, string>
  /** "JO" → university names. */
  unis: Record<string, string[]>
}

export interface UniversityPick {
  name: string
  /** ISO 3166 alpha-2, e.g. "JO". Sets the weekend. */
  country: string
}

let cache: Promise<UniversityData> | undefined
export function loadUniversities(): Promise<UniversityData> {
  cache ??= import('./universities.json').then((m) => m.default as UniversityData)
  return cache
}

/**
 * "Mu'tah  Univ." → "mutahuniv". Accents, spaces and punctuation don't matter.
 * Arabic spelling variants match too: أ/إ/آ → ا, ة → ه, ى → ي, and tashkeel is dropped ("مؤتة" = "موته").
 */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

/** A leading "university" / "جامعة" is skipped, so "جامعة مؤتة" finds Mutah like "مؤتة" does. */
const LEADING = ['جامعه', 'universityof', 'university']

/** Countries by name, for the "type your university" fallback. */
export function countryList(data: UniversityData): { code: string; name: string }[] {
  return Object.entries(data.countries).map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name))
}

/** The device's region ("en-US" → "US"), to rank the student's own country first. '' when unknown. */
export function deviceRegion(): string {
  try {
    const tag = typeof navigator !== 'undefined' ? navigator.language : ''
    const region = new Intl.Locale(tag || 'und').maximize().region
    return region && /^[A-Z]{2}$/.test(region) ? region : ''
  } catch {
    return ''
  }
}

/** Small words left out of initials: "University of California, Los Angeles" → "ucla". */
const MINOR = new Set(['of', 'the', 'and', 'for', 'at', 'in', 'de', 'la', 'del', 'des', 'du', 'di', 'da', 'do', 'y', 'e', 'et', 'und', '&'])

/** First letters of a name's words, with and without the small words ("JUST", "UCLA", "MIT"). */
export function initials(name: string): string[] {
  const words = name.split(/[\s\-/(),.']+/).filter(Boolean)
  const first = (ws: string[]) => normalize(ws.map((w) => w[0]).join(''))
  return [...new Set([first(words.filter((w) => !MINOR.has(w.toLowerCase()))), first(words)])].filter((x) => x.length >= 2)
}

/**
 * Best matches first: known short names ("JUST"), then a name whose initials are the query ("UCLA"),
 * then names starting with the query, then a word starting with it, then anywhere. Every word typed must match.
 * `prefer` (the student's country, from their device's region) breaks ties; none by default.
 */
export function searchUniversities(data: UniversityData, query: string, limit = 8, prefer = ''): UniversityPick[] {
  const words = query.split(/\s+/).map(normalize).filter(Boolean)
  const q = words.join('')
  if (q.length < 2) return []
  const scored: { pick: UniversityPick; score: number }[] = []
  const seen = new Set<string>()
  for (const t of UNIVERSITIES) {
    const bare = LEADING.reduce((x, w) => (x.startsWith(w) && x.length > w.length ? x.slice(w.length) : x), q)
    if (!t.aliases.some((x) => normalize(x).startsWith(q) || normalize(x).startsWith(bare))) continue
    const country = Object.keys(data.unis).find((c) => data.unis[c].includes(t.name))
    if (!country) continue
    scored.push({ pick: { name: t.name, country }, score: -1 })
    seen.add(`${country}|${t.name}`)
  }
  for (const [country, names] of Object.entries(data.unis)) {
    for (const name of names) {
      const n = normalize(name)
      if (seen.has(`${country}|${name}`)) continue
      const near = country === prefer ? 0 : 0.5
      if (q.length >= 2 && q.length <= 8 && words.length === 1 && initials(name).includes(q)) {
        scored.push({ pick: { name, country }, score: 0.25 + near / 2 })
        continue
      }
      if (!words.every((w) => n.includes(w))) continue
      const wordStart = name.split(/[\s\-/(),.&']+/).some((part) => normalize(part).startsWith(words[0]))
      const score = (n.startsWith(q) ? 0.5 : wordStart ? 1 : 2) + near
      scored.push({ pick: { name, country }, score })
    }
  }
  return scored
    .sort((a, b) => a.score - b.score || a.pick.name.length - b.pick.name.length || a.pick.name.localeCompare(b.pick.name))
    .slice(0, limit)
    .map((x) => x.pick)
}
