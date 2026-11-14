// Generates src/data/universities.json from the open Hipo "university-domains-list"
// dataset (MIT License, Copyright (c) 2014-2025 Hipo,
// https://github.com/Hipo/university-domains-list). Keeps name + country only.
//
//   curl -sSL https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json -o world.json
//   node scripts/trim-universities.mjs world.json
//
// Output: { countries: { "JO": "Jordan", … }, unis: { "JO": ["Mutah University", …], … } }
import { readFileSync, writeFileSync } from 'node:fs'

const file = process.argv[2]
if (!file) throw new Error('usage: node scripts/trim-universities.mjs <world.json>')
const data = JSON.parse(readFileSync(file, 'utf8'))

/** One display name per country code (the dataset spells a few two ways). */
const COUNTRY_NAME = { VN: 'Vietnam', PS: 'Palestine', SY: 'Syria', BN: 'Brunei', IR: 'Iran', KR: 'South Korea', KP: 'North Korea', RU: 'Russia', TW: 'Taiwan', TZ: 'Tanzania', BO: 'Bolivia', VE: 'Venezuela', MD: 'Moldova', LA: 'Laos', TR: 'Türkiye', CD: 'DR Congo', VA: 'Vatican City', VG: 'British Virgin Islands' }
/** Spelling fixes for names students will search for. */
const NAME_FIX = { "Mu' tah University": 'Mutah University' }

const countries = {}
const unis = {}
for (const u of data) {
  const code = u.alpha_two_code
  const raw = String(u.name ?? '').replace(/\s+/g, ' ').trim()
  const name = NAME_FIX[raw] ?? raw
  if (!code || !name) continue
  countries[code] ??= COUNTRY_NAME[code] ?? u.country
  ;(unis[code] ??= new Set()).add(name)
}
const out = { countries: {}, unis: {} }
for (const code of Object.keys(countries).sort()) {
  out.countries[code] = countries[code]
  out.unis[code] = [...unis[code]].sort((a, b) => a.localeCompare(b))
}
writeFileSync('src/data/universities.json', JSON.stringify(out) + '\n')
console.log(`${Object.keys(out.countries).length} countries, ${data.length} entries`)
