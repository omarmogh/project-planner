// The invariants from docs/ENGINE_SPEC.md section 11, checked on every simulated day.

import {
  ANKI_MAX_NEW_PER_DAY, BACKLOG_LIMIT_FACTOR, MAX_OPEN_LOOPS, openLoopTopicIds, DEADLINE_MIN_CHUNK, EXAM_PROTECT_DAYS, LIGHT_OFFERS_PER_WEEK, MAX_FIXES_PER_DAY, MAX_RETESTS_PER_DAY, RETEST_MAX_WAIT_DAYS,
  isCovered, activeGoals, addDays, buildDay, dayInfo, daysBetween, goalMinutesLeft, isFirm, isPaused, lastSitting,
  remainingMinutes, retestReady, sittings, statedMinutes, studies, weekday, windDownGoals,
  type DayPlan, type EngineState, type ISODate, type RescueOffer, type Task,
} from '../../src/engine'

export interface Violation {
  id: string
  date: ISODate
  message: string
}

/** What the checker remembers between days. */
export interface Memory {
  /** Last day each goal had study planned. */
  lastStudy: Map<string, ISODate>
  /** Last day each retest was planned. */
  lastPlanned: Map<string, ISODate>
  /** Days counted toward a goal's stall (normal days with time, not paused). */
  stall: Map<string, number>
  /** Pending retest ids seen yesterday. */
  retests: Map<string, Task>
  /** Topic id → the action of its previous fix after a failed retest. */
  lastFixAction: Map<string, string>
}

export const newMemory = (): Memory => ({ lastStudy: new Map(), lastPlanned: new Map(), stall: new Map(), retests: new Map(), lastFixAction: new Map() })

const isStudy = (t: Task) => t.kind === 'study' && !t.commitmentId

/** Checks on the plan for one day, before the student does anything. `s` is the state the plan was built from. */
export function checkDay(s: EngineState, plan: DayPlan, date: ISODate, mem: Memory): Violation[] {
  const v: Violation[] = []
  const bad = (id: string, message: string) => v.push({ id, date, message })
  const tasks = plan.tasks
  const mine = tasks.filter((t) => !t.commitmentId)
  const byGoal = new Map(s.goals.map((g) => [g.id, g]))

  const nearest = activeGoals(s.goals, date).filter((g) => studies(g, date)).find(isFirm)

  // I1: nothing for a goal on or after its exam.
  for (const t of mine) {
    const g = byGoal.get(t.goalId)
    if (!g) { bad('I1', `task for unknown goal: ${t.title}`); continue }
    if (t.kind === 'review' ? lastSitting(g) <= date : !studies(g, date)) bad('I1', `${t.title} planned for ${g.label} on or after its exam (${g.examDate})`)
  }

  // I2: planned minutes (without deadline work) fit the day.
  const committed = tasks.filter((t) => t.commitmentId).reduce((n, t) => n + t.minutes, 0)
  const room = Math.max(0, plan.available - plan.busy - committed)
  const planned = mine.reduce((n, t) => n + t.minutes, 0)
  if (planned > room) bad('I2', `planned ${planned} min > room ${room} (available ${plan.available}, busy ${plan.busy}, deadline work ${committed})`)
  if (plan.available !== statedMinutes(s.availability, date)) bad('I2', `available ${plan.available} isn't the stated time`)

  // I3: a pending retest never disappears.
  const pendingNow = new Map(s.scheduled.filter((t) => t.kind === 'retest').map((t) => [t.id, t]))
  for (const [id, old] of mem.retests) {
    const now = pendingNow.get(id)
    const g = byGoal.get(old.goalId) ?? (s.pastGoals ?? []).find((x) => x.id === old.goalId)
    const uniOver = g?.kind === 'uni' && lastSitting(g) <= date
    if (!now && !uniOver) bad('I3', `retest ${id} disappeared`)
  }
  const due = s.scheduled.filter((t) => t.kind === 'retest' && t.status === 'pending' && t.date <= date && retestReady(t, s.scheduled))
  {
    // In every mode and on every kind of day: a due retest is planned or listed as moved.
    for (const t of due) {
      const g = byGoal.get(t.goalId)
      if (!g || !studies(g, date) || isPaused(s, g, date)) continue
      if (!tasks.some((x) => x.id === t.id) && !plan.moved.some((x) => x.id === t.id)) bad('I3', `due retest ${t.id} is neither planned nor listed as moved`)
    }
  }

  // I6: weekend days and time come from the student's settings.
  const weekend = s.availability.weekendDays.includes(weekday(date))
  if ((plan.kind === 'weekend') !== weekend) bad('I6', `day kind ${plan.kind} but weekday ${weekday(date)} with weekend ${s.availability.weekendDays}`)

  // I7: the three days around a firm exam.
  const info = dayInfo(s.goals, date)
  if (plan.type !== info.type) bad('I7', `plan type ${plan.type} ≠ ${info.type}`)
  if ((info.type === 'exam' || info.type === 'rest') && mine.length > 0) bad('I7', `${info.type} day has tasks: ${mine.map((t) => t.title).join('; ')}`)
  if (info.type === 'eve' && mine.some((t) => t.kind !== 'review')) bad('I7', `exam eve has more than the review: ${mine.map((t) => t.title).join('; ')}`)
  if (info.type !== 'eve' && mine.some((t) => t.kind === 'review')) bad('I7', 'a review task outside an exam eve')

  // I8: inside a uni wind-down, board goals have only Anki.
  if (windDownGoals(s.goals, date).length > 0) {
    for (const t of mine) {
      const g = byGoal.get(t.goalId)
      if (g && g.kind !== 'uni' && t.kind !== 'anki' && t.kind !== 'review') bad('I8', `${t.title} (${g.label}) planned during a uni wind-down`)
    }
  }

  // I9: Anki is the last thing cut. I20: no new cards when it was shortened.
  const anki = mine.find((t) => t.kind === 'anki')
  const ankiGoal = s.anki ? byGoal.get(s.anki.goalId) : undefined
  if (s.anki && ankiGoal && studies(ankiGoal, date) && plan.type === 'normal' && !anki && mine.length > 0) bad('I9', `Anki cut while other tasks stay: ${mine.map((t) => t.title).join('; ')}`)
  if (anki && s.anki && anki.minutes < s.anki.reviewMinutes && (anki.amount ?? 0) > 0) bad('I20', 'new Anki cards on a shortened Anki day')

  // I10: a retest is never early and never before its fix.
  for (const t of mine.filter((x) => x.kind === 'retest')) {
    const src = s.scheduled.find((x) => x.id === t.id)
    if (!src) { bad('I10', `retest ${t.id} isn't in the schedule`); continue }
    if (src.date > date) bad('I10', `retest ${t.id} planned ${date}, due ${src.date}`)
    if (!retestReady(src, s.scheduled)) bad('I10', `retest ${t.id} planned before its fix is done`)
  }

  // I11: a finished topic doesn't return as new study; one study task per topic a day.
  const seen = new Set<string>()
  for (const t of mine.filter((x) => isStudy(x) && x.topicId)) {
    // Parts of one topic may follow each other in a day; the same topic never appears in two separate places.
    const prev = mine.filter((x) => isStudy(x))[mine.filter((x) => isStudy(x)).indexOf(t) - 1]
    if (seen.has(t.topicId!) && prev?.topicId !== t.topicId) bad('I11', `topic ${t.topicId} in two separate places in one day`)
    seen.add(t.topicId!)
    const topic = s.topics.find((x) => x.id === t.topicId)
    if (topic && isCovered(topic)) bad('I11', `${topic.name} is finished (since ${topic.coveredOn ?? '?'}) but planned as new study on ${date}`)
    if (topic?.dropped) bad('I11', `dropped topic ${topic.name} planned`)
  }

  // I12: daily limits of the fix loop (protected retests excepted).
  const retests = mine.filter((t) => t.kind === 'retest' && t.goalId !== nearest?.id)
  const lim = openLoopTopicIds(s.scheduled).size > MAX_OPEN_LOOPS ? BACKLOG_LIMIT_FACTOR : 1
  if (retests.length > MAX_RETESTS_PER_DAY * lim) bad('I12', `${retests.length} unprotected retests in one day`)
  if (mine.filter((t) => t.kind === 'fix').length > MAX_FIXES_PER_DAY * lim) bad('I12', `${mine.filter((t) => t.kind === 'fix').length} fixes in one day`)

  // I13: deadline work.
  for (const t of tasks.filter((x) => x.commitmentId)) {
    const c = (s.commitments ?? []).find((x) => x.id === t.commitmentId)
    if (!c) { bad('I13', `chunk for unknown commitment ${t.commitmentId}`); continue }
    if (date > c.date) bad('I13', `${c.title} planned after its deadline`)
    if (t.minutes < DEADLINE_MIN_CHUNK && t.minutes < remainingMinutes(c)) bad('I13', `${c.title}: a ${t.minutes}-min chunk that doesn't finish it`)
  }

  // I14: one open loop per topic.
  const loops = new Map<string, number>()
  for (const t of s.scheduled.filter((x) => x.kind === 'retest' && x.status === 'pending')) for (const id of t.topicIds ?? []) loops.set(id, (loops.get(id) ?? 0) + 1)
  for (const [id, n] of loops) if (n > 1) bad('I14', `${n} pending retests for topic ${id}`)
  const fixLoops = new Map<string, number>()
  for (const t of s.scheduled.filter((x) => x.kind === 'fix' && x.fixAction && x.status === 'pending')) for (const id of t.topicIds ?? []) fixLoops.set(id, (fixLoops.get(id) ?? 0) + 1)
  for (const [id, n] of fixLoops) if (n > 1) bad('I14', `${n} pending fixes for topic ${id}`)
  const allIds = s.scheduled.map((t) => t.id)
  if (new Set(allIds).size !== allIds.length) bad('I15', 'two scheduled tasks share an id')
  // I12: the fix loop's share of the study time (protected retests aside; the every-other-day fallback is one item).
  const loopMin = mine.filter((t) => (t.kind === 'fix' || (t.kind === 'retest' && t.goalId !== nearest?.id))).reduce((n, t) => n + t.minutes, 0)
  const loopItems = mine.filter((t) => t.kind === 'fix' || (t.kind === 'retest' && t.goalId !== nearest?.id)).length
  const afterAnki = room - (mine.find((t) => t.kind === 'anki')?.minutes ?? 0) - mine.filter((t) => t.kind === 'retest' && t.goalId === nearest?.id).reduce((n, t) => n + t.minutes, 0)
  if (plan.mode === 'full' && loopItems > 1 && loopMin > afterAnki * 0.75 + 1e-6) bad('I12', `fixes and retests take ${loopMin} of ${afterAnki} min`)
  // I20: new Anki cards stay within what the review time can carry.
  if ((mine.find((t) => t.kind === 'anki')?.amount ?? 0) > ANKI_MAX_NEW_PER_DAY) bad('I20', 'more new Anki cards than the daily cap')

  // I15: sane minutes, unique ids.
  const ids = new Set<string>()
  for (const t of tasks) {
    if (!(t.minutes > 0) || t.minutes % 5 !== 0) bad('I15', `${t.title}: ${t.minutes} min`)
    if (ids.has(t.id)) bad('I15', `duplicate id ${t.id}`)
    ids.add(t.id)
  }

  // I17: no silent stalls.
  if (plan.type === 'normal' && plan.mode === 'full') {
    const ankiMinutes = anki?.minutes ?? 0
    const roomForStudy = room - ankiMinutes
    for (const g of activeGoals(s.goals, date).filter((x) => studies(x, date))) {
      const idle = isPaused(s, g, date) || goalMinutesLeft(s, g) < 15 || roomForStudy < 30
      if (mine.some((t) => isStudy(t) && t.goalId === g.id)) { mem.stall.set(g.id, 0); continue }
      if (idle) continue
      const n = (mem.stall.get(g.id) ?? 0) + 1
      mem.stall.set(g.id, n)
      if (n === 8) bad('I17', `${g.label} has work left but no study for 8 normal days`)
    }
    for (const t of tasks.filter((x) => x.kind === 'retest')) mem.lastPlanned.set(t.id, date)
    for (const t of due) {
      const g = byGoal.get(t.goalId)
      if (!g || !studies(g, date) || isPaused(s, g, date)) { mem.lastPlanned.set(t.id, date); continue }
      const last = mem.lastPlanned.get(t.id) ?? t.date
      if (daysBetween(last, date) > RETEST_MAX_WAIT_DAYS) bad('I17', `retest ${t.id} due since ${t.date}, not planned since ${last}`)
    }
  }

  // I18: deterministic and pure (the simulator freezes the state, so a mutation throws).
  const again = buildDay(s, date)
  if (JSON.stringify(again) !== JSON.stringify(plan)) bad('I18', 'buildDay gave a different plan for the same input')

  mem.retests = new Map([...pendingNow].filter(([, t]) => t.status === 'pending'))
  return v
}

/** I5: accepted lighter days stay inside the weekly limit; no rest day close to an exam. */
export function checkLight(s: EngineState, date: ISODate): Violation[] {
  const v: Violation[] = []
  const taken = (s.lightOffers ?? []).filter((o) => (o.answer === 'light' || o.answer === 'rest') && o.kind !== 'firstOnly')
  const week = taken.filter((o) => o.date > addDays(date, -7) && o.date <= date)
  if (week.length > LIGHT_OFFERS_PER_WEEK) v.push({ id: 'I5', date, message: `${week.length} lighter days in 7 days` })
  const today = taken.find((o) => o.date === date)
  if (today?.answer === 'rest' && sittings(s.goals).some((x) => x.date >= date && daysBetween(date, x.date) <= EXAM_PROTECT_DAYS)) {
    v.push({ id: 'I5', date, message: 'a rest day within the protected days before an exam' })
  }
  return v
}

/** I16: rescue offers are well-formed. */
export function checkRescue(offer: RescueOffer, date: ISODate): Violation[] {
  const v: Violation[] = []
  if (!isFirm(offer.goal)) v.push({ id: 'I16', date, message: `rescue for a ${offer.goal.dateSource} date` })
  if (offer.goal.kind === 'uni' && offer.options.some((o) => o.kind === 'move')) v.push({ id: 'I16', date, message: 'move-the-date offered for a uni exam' })
  if (offer.options.some((o) => !o.cost)) v.push({ id: 'I16', date, message: 'an option without a cost' })
  if (offer.options.length === 0) v.push({ id: 'I16', date, message: 'an offer with no options' })
  return v
}
