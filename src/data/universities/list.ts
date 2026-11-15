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

/** "Mu'tah  Univ." → "mutahuniv". Accents, spaces and punctuation don't matter. */
export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]+/gu, '')
}

/** Countries by name, for the "type your university" fallback. */
export function countryList(data: UniversityData): { code: string; name: string }[] {
  return Object.entries(data.countries).map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Best matches first: known short names ("JUST"), then names starting with the
 * query, then a word starting with it, then anywhere. Every word typed must match.
 * `prefer` breaks ties by country (the students we start with).
 */
export function searchUniversities(data: UniversityData, query: string, limit = 8, prefer = 'JO'): UniversityPick[] {
  const words = query.split(/\s+/).map(normalize).filter(Boolean)
  const q = words.join('')
  if (q.length < 2) return []
  const scored: { pick: UniversityPick; score: number }[] = []
  const seen = new Set<string>()
  for (const t of UNIVERSITIES) {
    if (!t.aliases.some((x) => normalize(x).startsWith(q))) continue
    const country = Object.keys(data.unis).find((c) => data.unis[c].includes(t.name))
    if (!country) continue
    scored.push({ pick: { name: t.name, country }, score: -1 })
    seen.add(`${country}|${t.name}`)
  }
  for (const [country, names] of Object.entries(data.unis)) {
    for (const name of names) {
      const n = normalize(name)
      if (!words.every((w) => n.includes(w)) || seen.has(`${country}|${name}`)) continue
      const wordStart = name.split(/[\s\-/(),.&']+/).some((part) => normalize(part).startsWith(words[0]))
      const score = (n.startsWith(q) ? 0 : wordStart ? 1 : 2) + (country === prefer ? 0 : 0.5)
      scored.push({ pick: { name, country }, score })
    }
  }
  return scored
    .sort((a, b) => a.score - b.score || a.pick.name.length - b.pick.name.length || a.pick.name.localeCompare(b.pick.name))
    .slice(0, limit)
    .map((x) => x.pick)
}
