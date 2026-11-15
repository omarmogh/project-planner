import { GLOBAL_DEFAULT } from './default'
import { MUTAH } from './mutah'
import type { UniversityTemplate } from './types'

/** A university we only know by name: the global default, findable by its short names. */
const named = (id: string, name: string, aliases: string[], over: Partial<UniversityTemplate> = {}): UniversityTemplate =>
  ({ ...GLOBAL_DEFAULT, ...over, id, name, aliases })

// TODO(placeholder): the other Jordanian universities only have names and aliases so far.
// Their rotation lengths below are carried over from the first prototype and unverified.
const weeks = (majorWeeks: number): Partial<UniversityTemplate> => ({ rotation: { ...GLOBAL_DEFAULT.rotation, majorWeeks } })

export const UNIVERSITIES: UniversityTemplate[] = [
  MUTAH,
  named('just', 'Jordan University of Science and Technology', ['JUST'], weeks(8)),
  named('uj', 'University of Jordan', ['UJ', 'JU'], weeks(8)),
  named('hu', 'Hashemite University', ['HU']),
  named('yu', 'Yarmouk University', ['YU']),
  named('bau', 'Al-Balqa Applied University', ['BAU', 'Balqa']),
]

/** The template for a university by its listed name; anyone else gets the global default. */
export function templateFor(name: string | undefined | null): UniversityTemplate {
  return UNIVERSITIES.find((t) => t.name === name) ?? GLOBAL_DEFAULT
}
