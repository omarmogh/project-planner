// Runs the engine day by day for one persona, exactly as the app would: start the day,
// answer prompts, build the plan, answer each task, end the day. Every engine call gets a
// frozen state, so any mutation throws. Seeded: the same persona always lives the same weeks.

import {
  MIXED_SYSTEM, RETEST_PASS, addDays, answerLight, applyRescue, dismissRescue, buildDay, doMore, endDay, todayOffer, rateConfident, reportTask,
  rescueCheck, rotationEnded, startDay, sweepItems, goalMinutesLeft, activeGoals, studies,
  type Commitment, type Completion, type DayPlan, type EngineState, type ISODate, type RescueChoice, type Task,
} from '../../src/engine'
import { checkDay, checkLight, checkRescue, newMemory, type Violation } from './invariants'
import { around, rng, type Rng } from './rng'

export interface Persona {
  id: string
  /** One line: who this is. */
  name: string
  seed: number
  weeks: number
  start: ISODate
  build: (today: ISODate) => EngineState
  /** The app isn't opened that day. */
  away?: (i: number, date: ISODate, r: Rng) => boolean
  answer?: (task: Task, r: Rng, i: number) => Completion
  /** Mean % on question blocks and topic questions; retests default to 12 points higher. */
  accuracy?: number
  retestAccuracy?: number
  /** Timer minutes ÷ planned minutes. */
  speed?: number
  light?: 'light' | 'rest' | 'full'
  rescue?: RescueChoice | 'ignore'
  /** Rates everything "Had it" in a weekly recall sweep, then taps those topics as missed. */
  overconfident?: boolean
  commitments?: (i: number, date: ISODate) => Omit<Commitment, 'id' | 'createdOn'>[]
  /** "What's next?" after a rotation ends. */
  next?: (s: EngineState, today: ISODate, n: number) => EngineState
  /** Chance of pressing "Do more" after finishing the day. */
  doMore?: number
}

export interface TaskLog {
  title: string
  kind: string
  goal: string
  minutes: number
  reason: string
  detail?: string
  result: Completion | 'not opened'
  score?: number
  after?: string
}

export interface DayLog {
  date: ISODate
  type: DayPlan['type']
  mode: DayPlan['mode']
  kind: DayPlan['kind']
  available: number
  busy: number
  notes: string[]
  events: string[]
  tasks: TaskLog[]
  moved: string[]
}

export interface Run {
  persona: Persona
  days: DayLog[]
  violations: Violation[]
  final: EngineState
  stats: Record<string, number>
}

function deepFreeze<T>(x: T): T {
  if (x && typeof x === 'object' && !Object.isFrozen(x)) {
    Object.freeze(x)
    for (const v of Object.values(x as object)) deepFreeze(v)
  }
  return x
}

const hasQuestions = (s: EngineState, t: Task) =>
  t.kind === 'retest' || (t.kind === 'study' && !t.commitmentId && (t.amount ?? 0) > 0 && s.resources.some((r) => r.id === t.resourceId && r.type === 'qbank'))

export function runPersona(p: Persona): Run {
  const r = rng(p.seed)
  const mem = newMemory()
  const violations: Violation[] = []
  const days: DayLog[] = []
  const stats: Record<string, number> = { planned: 0, done: 0, fixes: 0, solid: 0, lightDays: 0, restDays: 0, rescues: 0, doMore: 0, retestFails: 0, parked: 0, notes: 0 }
  let s = deepFreeze(p.build(p.start))
  let rotations = 0
  let commitmentN = 0

  for (let i = 0; i < p.weeks * 7; i++) {
    const date = addDays(p.start, i)
    const events: string[] = []
    s = deepFreeze(startDay(s, date))

    if (rotationEnded(s, date)) {
      const before = s
      s = deepFreeze(p.next ? p.next(s, date, rotations++) : { ...s, nextAsked: s.rotation!.until })
      events.push(s.rotation && s.rotation.until !== before.rotation?.until ? `What's next? → ${s.rotation.name} until ${s.rotation.until}` : "What's next? → no new rotation")
    }

    for (const c of p.commitments?.(i, date) ?? []) {
      s = deepFreeze({ ...s, commitments: [...(s.commitments ?? []), { ...c, id: `c${++commitmentN}`, createdOn: date }] })
      events.push(`Added: ${c.title} (${c.kind}, ${c.date}${c.from ? ` ${c.from}–${c.to ?? ''}` : ''}${c.minutes ? ` ${c.minutes} min` : ''})`)
    }

    const away = p.away?.(i, date, r) ?? false

    const offer = rescueCheck(s, date)
    if (offer) {
      violations.push(...checkRescue(offer, date))
      events.push(`Rescue offered for ${offer.goal.label}: ${Math.round(offer.short / 60)} h short. ${offer.options.map((o) => `[${o.kind}] ${o.cost}`).join(' ')}`)
      const choice = p.rescue ?? 'narrow'
      if (!away && choice === 'ignore') {
        s = deepFreeze(dismissRescue(s, offer.goal.id, date))
        events.push('Answered: not now')
      } else if (!away) {
        const pick = offer.options.find((o) => o.kind === choice) ?? offer.options[0]
        s = deepFreeze(applyRescue(s, offer.goal.id, pick.kind, date))
        stats.rescues++
        events.push(`Chose: ${pick.kind}`)
      }
    }

    if (!away) {
      const light = todayOffer(s, date)
      if (light) {
        const answer = p.light ?? 'light'
        s = deepFreeze(answerLight(s, date, answer))
        const got = (s.lightOffers ?? []).find((o) => o.date === date)?.answer
        events.push(`Light-day offer (${light.kind}${light.restAllowed ? ', rest allowed' : ''}) → ${got}`)
        if (got === 'light' && light.kind !== 'firstOnly') stats.lightDays++
        if (got === 'rest') stats.restDays++
        violations.push(...checkLight(s, date))
      }
    }

    // A weekly recall sweep where everything "felt solid".
    if (p.overconfident && !away && i % 7 === 3 && s.topicGoalId) {
      for (const sys of s.focus) {
        for (const item of sweepItems(s.topics as never, sys, s.topicGoalId, [])) {
          if (item.topicId) s = deepFreeze({ ...s, confident: rateConfident(s.confident, item.topicId, true, date) })
        }
      }
      events.push('Recall sweep: rated everything "Had it"')
    }

    const plan = buildDay(s, date)
    violations.push(...checkDay(s, plan, date, mem))
    const log: DayLog = {
      date, type: plan.type, mode: plan.mode, kind: plan.kind, available: plan.available, busy: plan.busy, notes: [...plan.notes], events, tasks: [],
      moved: plan.moved.map((t) => t.title),
    }
    const tasks: Task[] = plan.tasks.map((t) => ({ ...t }))

    const doTask = (t: Task): TaskLog => {
      const goal = s.goals.find((g) => g.id === t.goalId)?.label ?? (t.tag ?? '')
      const entry: TaskLog = { title: t.title, kind: t.kind, goal, minutes: t.minutes, reason: t.reason, detail: t.detail ?? (t.steps ? t.steps.join(' · ') : undefined), result: 'not opened' }
      if (away) return entry
      let result = p.answer?.(t, r, i) ?? 'done'
      const scored = hasQuestions(s, t)
      if (t.kind === 'retest' && result === 'partly') result = 'done'
      const base = p.accuracy ?? 68
      const percent = scored && result !== 'skipped'
        ? Math.round(t.kind === 'retest' ? around(r, p.retestAccuracy ?? base + 12, 14) : around(r, base, 14))
        : undefined
      const questions = scored && result !== 'skipped' ? Math.max(1, Math.round((t.amount ?? 10) * (result === 'partly' ? 0.5 : 1))) : undefined
      // Topics tapped as missed after a weak system block: the ones the student felt sure about first.
      let weakTopicIds: string[] | undefined
      if (scored && !t.topicId && t.kind === 'study' && t.system && t.system !== MIXED_SYSTEM && percent !== undefined && percent < 65 && r() < 0.6) {
        const sure = new Set((s.confident ?? []).map((c) => c.topicId))
        const pool = s.topics.filter((x) => x.system === t.system && !x.wholeSystem && !x.dropped)
        const ranked = [...pool.filter((x) => sure.has(x.id)), ...pool.filter((x) => !sure.has(x.id))]
        weakTopicIds = ranked.slice(0, 1 + Math.floor(r() * 2)).map((x) => x.id)
      }
      const before = s
      const out = reportTask(s, t, {
        result, minutes: Math.max(1, Math.round(t.minutes * (p.speed ?? 1) * (0.9 + 0.2 * r()))), questions, percent, weakTopicIds,
        cards: t.kind === 'anki' ? 150 : undefined,
      }, date)
      s = deepFreeze(out.state)
      t.status = result
      entry.result = result
      entry.score = percent
      stats.planned++
      if (result === 'done') stats.done++

      // I4: solid only on a passed second retest.
      for (const topic of s.topics) {
        if (topic.status !== 'solid') continue
        const was = before.topics.find((x) => x.id === topic.id)
        if (was?.status === 'solid') continue
        const ok = t.kind === 'retest' && t.retestRound === 2 && (percent ?? 0) >= RETEST_PASS && (t.topicIds ?? []).includes(topic.id)
        if (!ok) violations.push({ id: 'I4', date, message: `${topic.name} became solid without a passed second retest` })
        stats.solid++
      }
      const o = out.outcome
      if (o.kind === 'fix') { stats.fixes++; entry.after = `Fix added: ${o.plan.fix.title} (${o.plan.fix.date})${o.plan.retest ? `; retest ${o.plan.retest.date}` : ''}` }
      if (o.kind === 'retestAgain') entry.after = `Passed. Second retest ${o.next}`
      if (o.kind === 'retestPass') entry.after = `${o.name}: solid`
      if (o.kind === 'retestFail') {
        stats.retestFails++
        if (o.parked) stats.parked++
        entry.after = `Not there yet. Next: ${o.fix.title} (${o.fix.date})${o.parked ? ' after a break' : ''}`
        // I19: not the same fix action twice in a row.
        const prev = before.topics.find((x) => (t.topicIds ?? []).includes(x.id))?.lastFix
        if (prev && o.options.length > 1 && o.fix.fixAction === prev) violations.push({ id: 'I19', date, message: `same fix (${prev}) again after a failed retest: ${o.name}` })
      }
      if (o.kind === 'retestStopped') { stats.retestFails++; entry.after = `Not there yet. No more retests on ${o.name} for now; it stays on your weak list` }
      if (o.kind === 'fixDone' && o.retestDate) entry.after = `Retest on ${o.retestDate}`
      if (out.confidenceNote) { stats.notes++; entry.after = `${entry.after ? `${entry.after}. ` : ''}Note: felt sure about ${out.confidenceNote.name}, scored ${out.confidenceNote.score}%` }
      return entry
    }

    for (const t of tasks) log.tasks.push(doTask(t))

    if (!away && p.doMore && tasks.length > 0 && tasks.every((t) => t.status === 'done') && r() < p.doMore) {
      const more = doMore(s, tasks, date)
      if (more) {
        if (more.kind === 'retest' && s.scheduled.some((x) => x.id === more.id.replace(/-more\d+$/, '') && x.date > date)) {
          violations.push({ id: 'I10', date, message: `"Do more" brought a retest forward: ${more.title}` })
        }
        tasks.push(more)
        const entry = doTask(more)
        entry.title = `Extra: ${entry.title}`
        log.tasks.push(entry)
        stats.doMore++
      }
    }

    s = deepFreeze(endDay(s, tasks, date))
    days.push(log)
  }

  // What's left at the end, for the one-line outcome.
  for (const g of activeGoals(s.goals, addDays(p.start, p.weeks * 7))) if (studies(g, addDays(p.start, p.weeks * 7))) stats[`left:${g.label}`] = Math.round(goalMinutesLeft(s, g) / 60)
  stats.openLoops = s.scheduled.filter((t) => t.status === 'pending' && t.kind === 'retest').length
  return { persona: p, days, violations, final: s, stats }
}

/** A readable log of a run, for people (and the student reviewer). */
export function render(run: Run): string {
  const out: string[] = [`# ${run.persona.id}: ${run.persona.name}`, '']
  for (const d of run.days) {
    const head = [d.date, new Date(`${d.date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }), d.kind === 'weekend' ? 'weekend' : '', d.type !== 'normal' ? d.type.toUpperCase() : '', d.mode !== 'full' ? `(${d.mode} day)` : '', `${d.available} min${d.busy ? `, busy −${d.busy}` : ''}`, d.notes.length ? `[${d.notes.join(', ')}]` : '']
    out.push(`## ${head.filter(Boolean).join(' · ')}`)
    for (const e of d.events) out.push(`  * ${e}`)
    if (d.tasks.length === 0) out.push('  (nothing planned)')
    for (const t of d.tasks) {
      out.push(`  - ${t.title} · ${t.minutes} min · ${t.goal} · why: ${t.reason}${t.detail ? ` · ${t.detail}` : ''} → ${t.result}${t.score !== undefined ? ` ${t.score}%` : ''}${t.after ? ` ⇒ ${t.after}` : ''}`)
    }
    if (d.moved.length) out.push(`  moved to tomorrow: ${d.moved.join('; ')}`)
    out.push('')
  }
  return out.join('\n')
}
