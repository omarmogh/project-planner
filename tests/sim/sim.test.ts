// Runs every persona for 8–12 simulated weeks and checks every invariant on every day.
// SIM_DUMP=1 also writes each persona's days to tests/sim/out/ for reading.

import { mkdirSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PERSONAS } from './personas'
import { render, runPersona } from './sim'

const dump = !!process.env.SIM_DUMP
/** A persona lives 8–12 weeks day by day (and some run twice): well over vitest's default 5 s on a busy machine. */
const SIM_TIMEOUT_MS = 120_000

describe('simulated students', () => {
  const lines: string[] = []
  for (const p of PERSONAS) {
    it(`${p.id}: ${p.name}`, () => {
      const run = runPersona(p)
      if (dump) {
        mkdirSync('tests/sim/out', { recursive: true })
        writeFileSync(`tests/sim/out/${p.id}.md`, render(run))
      }
      lines.push(`${p.id} | days ${run.days.length} | violations ${run.violations.length} | ${Object.entries(run.stats).map(([k, v]) => `${k} ${v}`).join(', ')}`)
      if (dump) writeFileSync('tests/sim/out/_summary.txt', lines.join('\n') + '\n')
      const shown = run.violations.slice(0, 12).map((v) => `${v.id} ${v.date}: ${v.message}`).join('\n')
      expect(run.violations.length, shown).toBe(0)
      // Same seed, same weeks (re-run for a sample of personas; every day is also rebuilt once by I18).
      if (PERSONAS.indexOf(p) % 6 === 0) expect(JSON.stringify(runPersona(p).days)).toBe(JSON.stringify(run.days))
    }, SIM_TIMEOUT_MS)
  }
})
