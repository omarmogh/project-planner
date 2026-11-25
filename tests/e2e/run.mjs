// Browser tests for the screens, at phone width: `npm run e2e`.
//
// What it checks: the demo path (Today → a task from Start to its report), the commitments sheet,
// typing a lecture count, Pace for the demo student and for a student with no question bank, the
// weekend setting, repeating busy time, the "Your plan" sheet, keyboard shortcuts and university search by initials. It starts its own dev server and a headless Chromium (Playwright). One-time setup on a
// new machine: `npx playwright install chromium`.
//
// Exit code 0 = every check passed, 1 = something failed.

import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'

const PORT = 5199
const URL = `http://localhost:${PORT}/`

// 1. The saved state of a uni-only student, made by the real engine.
const dir = mkdtempSync(join(tmpdir(), 'locus-e2e-'))
const fixtureFile = join(dir, 'uni-only.json')
const made = spawnSync('npx', ['vitest', 'run', 'tests/e2e/fixture.test.ts'], { env: { ...process.env, E2E_FIXTURE_OUT: fixtureFile }, encoding: 'utf8' })
if (made.status !== 0) { console.error(made.stdout, made.stderr); process.exit(1) }
const fixture = JSON.parse(readFileSync(fixtureFile, 'utf8'))

// 2. The dev server.
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true })
const stop = () => { try { process.kill(-server.pid) } catch { /* already gone */ } }
process.on('exit', stop)
for (let i = 0; ; i++) {
  try { if ((await fetch(URL)).ok) break } catch { /* not up yet */ }
  if (i > 60) { console.error('The dev server did not start.'); process.exit(1) }
  await new Promise((r) => setTimeout(r, 500))
}

const browser = await chromium.launch()
let failed = 0
const text = async (page) => (await page.locator('body').innerText()).replace(/\s+/g, ' ')

async function check(name, run) {
  const page = await browser.newPage({ viewport: { width: 375, height: 800 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  try {
    await run(page)
    if (errors.length) throw new Error(`console errors: ${errors.join(' | ')}`)
    console.log(`  ok   ${name}`)
  } catch (e) {
    failed++
    console.log(`  FAIL ${name}\n       ${String(e.message).split('\n')[0]}`)
  } finally {
    await page.close()
  }
}
// Screens change through View Transitions, so a click's update can land a frame or two later: poll briefly.
const settle = async (page, ok) => {
  let t = ''
  for (let i = 0; i < 20; i++) {
    t = await text(page)
    if (ok(t)) return t
    await page.waitForTimeout(100)
  }
  return t
}
const expectText = async (page, ...parts) => {
  const t = await settle(page, (t) => parts.every((p) => t.includes(p)))
  for (const p of parts) if (!t.includes(p)) throw new Error(`expected "${p}" on the page, got: ${t.slice(0, 260)}`)
}
const expectNoText = async (page, ...parts) => {
  const t = await settle(page, (t) => !parts.some((p) => t.includes(p)))
  for (const p of parts) if (t.includes(p)) throw new Error(`did not expect "${p}" on the page`)
}
async function demo(page) {
  await page.goto(URL)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: 'Use demo student' }).click()
  await page.getByText('Anki reviews').first().waitFor()
}

console.log('Locus browser tests (phone width)')

await check('demo student: Today shows the day and its tasks', async (page) => {
  await demo(page)
  await expectText(page, 'Sunday 15 November', 'Anki reviews', 'IM slides', 'Retest: 10 acid–base questions')
})

await check('a task runs from Start to its report and back', async (page) => {
  await demo(page)
  await page.getByRole('button', { name: /^Start/ }).first().click()
  // A session runs every chosen task; tick the first, then end the session: its report comes up.
  await page.getByRole('button', { name: /Finish|Done|End/ }).first().click()
  await page.getByRole('button', { name: 'End session', exact: true }).click()
  await expectText(page, 'About how many did you review?')
  await page.getByRole('button', { name: 'Skip', exact: true }).click()
  await expectNoText(page, 'About how many did you review?')
})

await check('commitments: a lecture takes study time, a seminar becomes tasks', async (page) => {
  await demo(page)
  const add = async (line) => {
    await page.getByRole('button', { name: 'Add something you have to do' }).click()
    await page.getByRole('textbox').first().fill(line)
  }
  await add('Lecture 10–12')
  await expectText(page, "Takes 30 min from today's study time")
  await page.getByRole('button', { name: /^Add$/ }).click()
  await expectText(page, 'Lecture 10–12', '2 h 30 min of study time instead of 3 h')
  await add('Seminar on DKA Thursday 3h')
  await expectText(page, 'Counts as studying Diabetes this week')
  await page.getByRole('button', { name: /^Add$/ }).click()
  await expectText(page, 'Seminar on DKA', 'Uni', 'Due Thursday')
})

await check('a lecture count can be typed (and is capped at 200)', async (page) => {
  await demo(page)
  await page.getByText('IM slides: next lecture').first().click()
  await page.getByRole('button', { name: /^Start/ }).first().click()
  await page.getByRole('button', { name: /Finish|Done|End/ }).first().click()
  await page.getByRole('button', { name: 'End session', exact: true }).click()
  // Ticked = done: no "Done / Partly / Didn't" question, straight to the outcome.
  await page.getByRole('button', { name: /Not right/ }).click()
  const open = page.getByRole('button', { name: /lectures left: .* Tap to type/ })
  await open.click()
  await page.getByRole('textbox', { name: /Type lectures left/ }).fill('80')
  await page.keyboard.press('Enter')
  if ((await page.getByRole('button', { name: /lectures left: / }).innerText()) !== '80') throw new Error('80 was not accepted')
  await open.click()
  await page.getByRole('textbox').fill('500')
  await page.keyboard.press('Enter')
  if ((await page.getByRole('button', { name: /lectures left: / }).innerText()) !== '200') throw new Error('500 was not capped at 200')
})

await check('Pace for the demo student: university, accuracy, and the details behind one tap', async (page) => {
  await demo(page)
  await page.getByRole('button', { name: 'Pace', exact: true }).click()
  await expectText(page, 'University', 'IM exam', 'Accuracy by system')
  await expectNoText(page, 'You have', 'Extra time a day')
  await page.getByRole('button', { name: 'Daily load and what if' }).click()
  await expectText(page, 'You have', 'Extra time a day')
})

await check('Pace for a student with no question bank: no accuracy, a full University section', async (page) => {
  await page.goto(URL)
  await page.evaluate(({ key, saved }) => localStorage.setItem(key, JSON.stringify(saved)), { key: fixture.key, saved: fixture.saved })
  await page.reload()
  await page.getByRole('button', { name: 'Pace', exact: true }).click()
  await page.getByText('University').first().waitFor()
  await expectText(page, 'IM exam', 'Surgery exam', '0 of 80 lectures', 'Past papers 0 of 4')
  await expectNoText(page, 'Accuracy by system', 'UWorld')
})

await check('the weekend can be changed from the Week tab', async (page) => {
  await demo(page)
  await page.getByRole('button', { name: 'Week', exact: true }).click()
  await expectText(page, 'Weekend:', 'Fri–Sat')
  await page.getByRole('button', { name: /Weekend:/ }).click()
  await expectText(page, 'Weekend days')
})

await check('commitments: repeating ward hours, until deleted', async (page) => {
  await demo(page)
  await page.getByRole('button', { name: 'Add something you have to do' }).click()
  await page.getByRole('textbox').first().fill('Ward Sun-Thu 8-2')
  await expectText(page, 'Weekdays, until you delete it')
  await page.getByRole('button', { name: /^Add$/ }).click()
  await expectText(page, 'Ward')
})

await check('your plan: less daily time re-plans Today', async (page) => {
  await demo(page)
  await page.getByRole('button', { name: 'Week', exact: true }).click()
  await page.getByRole('button', { name: /Your plan:/ }).click()
  await expectText(page, 'Exam dates', 'Study time a day', 'Add an exam')
  const less = page.getByRole('button', { name: 'Less weekdays study time' })
  for (let i = 0; i < 8; i++) await less.click()
  await page.getByRole('button', { name: /^Done$/ }).click()
  await page.getByRole('button', { name: 'Today', exact: true }).click()
  await expectText(page, '1 h planned')
})

await check('keyboard: N adds something you have to do, S starts, Space pauses the timer', async (page) => {
  await demo(page)
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('n')
  await page.getByRole('dialog').waitFor()
  await page.keyboard.press('Escape')
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('s')
  await page.getByRole('button', { name: /Finish|Done|End/ }).first().waitFor()
  await page.locator('body').click({ position: { x: 5, y: 400 } })
  await page.keyboard.press(' ')
  await expectText(page, 'Paused')
  await page.keyboard.press(' ')
  await expectNoText(page, 'Paused')
})

await check('university search matches initials', async (page) => {
  await page.goto(URL)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByText('Clinical', { exact: true }).click()
  const cont = page.getByRole('button', { name: 'Continue' })
  if (await cont.isVisible()) await cont.click()
  await page.getByRole('searchbox', { name: 'Search universities' }).fill('just')
  await page.getByText('Jordan University of Science and Technology').first().waitFor({ timeout: 5000 })
})

await browser.close()
stop()
console.log(failed === 0 ? '\nAll browser checks passed.' : `\n${failed} browser check(s) failed.`)
process.exit(failed === 0 ? 0 : 1)
