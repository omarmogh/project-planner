// Demo state, kept in localStorage so a refresh keeps the student's plan.
// ?reset, long-pressing the wordmark and "Use demo student" start clean.
// All planning decisions are delegated to the pure engine; this file only wires results together.

import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import {
  applyCompletion, applyImport, type SystemResult, applyRetest, buildDay, changeFix as engineChangeFix, fixOptions, goalMaterial, isSystemDone,
  lightDayOffer, lightTasks, localToday, markWeak, pct, planFix, previewTomorrow, projectedExamDate, refreshTopicTasks, replanAfterLightDay, setWatched, topicPhrase,
  MIXED_SYSTEM, type Completion, type DayKind, type EngineState, type FixOption, type FixPlan, type ISODate,
  type LightOffer, type Session, type Task,
  sweepOutcome, sweepTaskId, withSweepTasks, type Recall, type SweepItem,
} from '../engine'
import { isEnabled } from '../lib/features'

export type Tab = 'today' | 'pace' | 'week'
export type Overlay = 'running' | 'block' | 'anki' | null
/** How today runs after a rough patch: the full plan, a light day, essentials only, or a rest day. */
export type DayMode = 'full' | 'light' | 'essentials' | 'rest'

export interface Running {
  taskId: string
  startedAt: number
  pausedAt: number | null
  pausedMs: number
}

export type Outcome =
  | { kind: 'fix'; system: string; score: number; plan: FixPlan }
  | { kind: 'clean'; system: string; score: number }
  | { kind: 'retestPass'; score: number; name: string }
  | { kind: 'retestAgain'; score: number; name: string; next: ISODate }
  | { kind: 'retestFail'; score: number; name: string; fix: Task; retest: Task; options: FixOption[] }
  | { kind: 'fixDone'; name: string; retestDate?: ISODate }
  /** Done / Partly / Didn't get to it, for a topic, slides or a fix. `score` when questions were entered. */
  | { kind: 'progress'; result: Completion; score?: number }
  | { kind: 'ankiDone'; cards: number | null; newLeft: number }

interface DemoState {
  today: ISODate
  plan: EngineState | null
  todayTasks: Task[]
  dayKind: DayKind
  available: number
  dayMode: DayMode
  /** After a light or rest day: what moved to the coming days. */
  lightNote: { perDay: number; days: number } | null
  tab: Tab
  overlay: Overlay
  selectedId: string | null
  running: Running | null
  /** Minutes for the task being reported. */
  finishing: { taskId: string; minutes: number } | null
  outcome: Outcome | null
  ankiConnected: boolean
  /** Where "Connect Anki" returns to (Today, or the Anki report). */
  ankiReturn: Overlay
  /** Task ids added today, marked "New" in tomorrow's list. */
  newIds: string[]
  /** First visit after onboarding: plan builds in with a short animation. */
  intro: boolean
  /** Goals whose "is the date out yet?" prompt was answered "Not yet". */
  datePromptDismissed: string[]
  /** Recall Sweep (idea prototype): ratings given so far, by sweep item id. Kept when the sweep is closed early. */
  sweepRatings: Record<string, Recall>

  /** `today` is pinned for the demo student; real users get the real date. */
  startApp: (plan: EngineState, ankiConnected: boolean, today?: ISODate) => void
  reset: () => void
  setTab: (t: Tab) => void
  select: (id: string) => void
  start: (id?: string) => void
  pause: () => void
  resume: () => void
  cancelRun: () => void
  finish: () => void
  /** The one completion question. `score` only for topic tasks that had questions. */
  reportCompletion: (result: Completion, score?: { questions: number; percent: number }) => void
  reportQuestions: (questions: number, percent: number, weakTopicIds: string[]) => void
  reportRetest: (questions: number, percent: number) => void
  reportAnki: (cards: number | null) => void
  changeFix: (option: FixOption) => void
  setLecturesLeft: (resourceId: string, left: number) => void
  closeBlock: () => void
  openAnki: () => void
  closeAnki: () => void
  setAnkiConnected: (v: boolean) => void
  endIntro: () => void
  /** Pace: make the projected ready-by date the target. */
  lockTarget: (goalId: string) => void
  /** Today: "Is your IM exam date out yet?" */
  setExamDate: (goalId: string, date: ISODate) => void
  dismissDatePrompt: (goalId: string) => void
  /** Today: accept the suggested next system, or pick another. */
  chooseSystem: (system: string) => void
  /** System checklist: tick or untick videos as already watched. Today's pending topic tasks follow. */
  setWatched: (ids: string[], on: boolean) => void
  /** Pace: bring in (or redo) UWorld results. Today's untouched tasks re-plan around them. */
  importUworld: (rows: SystemResult[]) => void
  /** Today: answer the light-day offer. 'full' keeps the plan (also "Got it"). */
  answerLight: (answer: NonNullable<LightOffer['answer']>) => void
  /** Change the weekend days (detected from the university's country). Today re-plans. */
  setWeekend: (days: number[]) => void
  /** Recall Sweep: one rating. What it adds lands in the coming days at once, so closing early loses nothing. */
  rateSweep: (items: SweepItem[], id: string, r: Recall) => void
}

const initial = () => ({
  today: localToday(),
  plan: null,
  todayTasks: [],
  dayKind: 'normal' as DayKind,
  available: 0,
  dayMode: 'full' as DayMode,
  lightNote: null as DemoState['lightNote'],
  tab: 'today' as Tab,
  overlay: null as Overlay,
  selectedId: null,
  running: null,
  finishing: null,
  outcome: null,
  ankiConnected: false,
  ankiReturn: null as Overlay,
  newIds: [],
  intro: false,
  datePromptDismissed: [],
  sweepRatings: {} as Record<string, Recall>,
})

/** Planned minutes if under a minute passed (demo), else real minutes. */
export function recordedMinutes(r: Running, planned: number, now = Date.now()): number {
  const ms = (r.pausedAt ?? now) - r.startedAt - r.pausedMs
  return ms < 60_000 ? planned : Math.max(1, Math.round(ms / 60_000))
}

/** Bump when the saved shape changes: an old save is dropped, not migrated. */
export const STORE_VERSION = 2
export const STORE_KEY = 'locus-demo'

/** localStorage that never throws (private mode, blocked storage): the app just doesn't remember. */
const safeStorage: StateStorage = {
  getItem: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  setItem: (k, v) => { try { localStorage.setItem(k, v) } catch { /* not remembered */ } },
  removeItem: (k) => { try { localStorage.removeItem(k) } catch { /* nothing to remove */ } },
}

type Saved = Pick<DemoState, 'today' | 'plan' | 'todayTasks' | 'dayKind' | 'available' | 'dayMode' | 'lightNote' | 'tab' | 'ankiConnected' | 'newIds' | 'datePromptDismissed' | 'sweepRatings'>

/** A save that doesn't look like ours is ignored instead of crashing the app. */
function looksValid(x: unknown): x is Saved {
  if (!x || typeof x !== 'object') return false
  const v = x as Partial<Saved>
  if (typeof v.today !== 'string' || !Array.isArray(v.todayTasks)) return false
  if (v.plan === null) return true
  const p = v.plan as Partial<EngineState> | undefined
  return !!p && Array.isArray(p.goals) && Array.isArray(p.resources) && Array.isArray(p.topics) && Array.isArray(p.sessions) && Array.isArray(p.scheduled)
}

export const useDemo = create<DemoState>()(persist((set, get) => {
  /** Log the task's session and set its status on today's list. */
  const logSession = (task: Task, plan: EngineState, status: Task['status'], extra: Partial<Session> = {}): EngineState => {
    const minutes = get().finishing?.minutes ?? task.minutes
    const session: Session = {
      id: `s-${task.id}`,
      date: get().today,
      kind: task.kind,
      goalId: task.goalId,
      resourceId: task.resourceId,
      system: task.system,
      topicIds: task.topicIds,
      minutes,
      planned: status === 'done' ? task.minutes : undefined,
      ...extra,
    }
    set((s) => ({ todayTasks: s.todayTasks.map((t) => (t.id === task.id ? { ...t, status } : t)) }))
    // Every answer counts toward spotting a rough patch, "Didn't get to it" included.
    const outcomes = status === 'pending' ? plan.outcomes : [...(plan.outcomes ?? []), { date: get().today, taskId: task.id, result: status }]
    return {
      ...plan,
      outcomes,
      sessions: status === 'skipped' ? plan.sessions : [...plan.sessions, session],
      scheduled: status === 'done' ? plan.scheduled.map((t) => (t.id === task.id ? { ...t, status: 'done' } : t)) : plan.scheduled,
    }
  }

  const current = () => {
    const s = get()
    const task = s.todayTasks.find((t) => t.id === s.finishing?.taskId)
    if (!task || !s.plan) throw new Error('No task being reported')
    return { task, plan: s.plan, today: s.today }
  }

  /** The offer on screen counts as answered once the student just starts working. */
  const settleOffer = () => {
    const s = get()
    const offer = s.plan && lightDayOffer(s.plan, s.today)
    if (!s.plan || !offer) return
    set({ plan: { ...s.plan, lightOffers: [...(s.plan.lightOffers ?? []), { date: s.today, kind: offer.kind, answer: 'full' }] } })
  }

  /** A block or topic score → a fix when it's weak. */
  const addFix = (next: EngineState, fix: FixPlan, system: string, score: number) => {
    const plan = {
      ...next,
      topics: markWeak([...next.topics, ...fix.newTopics], fix.topicIds),
      scheduled: [...next.scheduled, fix.fix, ...(fix.retest ? [fix.retest] : [])],
    }
    set((s) => ({ plan, newIds: [...s.newIds, fix.fix.id], outcome: { kind: 'fix', system, score, plan: fix } }))
  }

  return {
    ...initial(),

    startApp: (plan, ankiConnected, pinned) => {
      const today = pinned ?? localToday()
      const day = buildDay(plan, today)
      useDemo.persist.clearStorage()
      set({ ...initial(), today, plan, ankiConnected, todayTasks: day.tasks, dayKind: day.kind, available: day.available, intro: true })
    },

    reset: () => {
      useDemo.persist.clearStorage()
      set(initial())
    },
    setTab: (tab) => set({ tab }),
    select: (id) => set({ selectedId: id }),

    start: (id) => {
      const s = get()
      const next = id ?? s.selectedId ?? s.todayTasks.find((t) => t.status === 'pending')?.id
      if (!next) return
      settleOffer()
      set({ overlay: 'running', selectedId: null, intro: false, running: { taskId: next, startedAt: Date.now(), pausedAt: null, pausedMs: 0 } })
    },
    pause: () => set((s) => (s.running && !s.running.pausedAt ? { running: { ...s.running, pausedAt: Date.now() } } : s)),
    resume: () =>
      set((s) =>
        s.running?.pausedAt
          ? { running: { ...s.running, pausedMs: s.running.pausedMs + Date.now() - s.running.pausedAt, pausedAt: null } }
          : s,
      ),
    cancelRun: () => set({ overlay: null, running: null }),
    finish: () => {
      const s = get()
      if (!s.running) return
      const task = s.todayTasks.find((t) => t.id === s.running!.taskId)!
      set({ overlay: 'block', finishing: { taskId: task.id, minutes: recordedMinutes(s.running, task.minutes) }, running: null, outcome: null })
    },

    reportCompletion: (result, score) => {
      const { task, plan, today } = current()
      const correct = score ? (score.questions * score.percent) / 100 : undefined
      const extra: Partial<Session> = score ? { questions: score.questions, correct } : {}
      let next = logSession(task, plan, result, extra)
      next = applyCompletion(next, task, result, today, score?.questions)

      if (task.kind === 'fix' && result === 'done') {
        const retest = task.topicIds?.length
          ? next.scheduled.find((t) => t.kind === 'retest' && t.status === 'pending' && t.topicIds?.join() === task.topicIds?.join())
          : undefined
        const mine = next.topics.filter((t) => task.topicIds?.includes(t.id))
        set({ plan: next, outcome: { kind: 'fixDone', name: mine.length ? topicPhrase(mine) : 'Mixed block review', retestDate: retest?.date } })
        return
      }

      // A topic's questions under the line → that topic gets a fix and a retest.
      if (score && correct !== undefined && task.topicId && isEnabled('fixLoop')) {
        const fix = planFix(
          { date: today, goalId: task.goalId, resourceId: task.resourceId, system: task.system ?? MIXED_SYSTEM, questions: score.questions, correct, weakTopicIds: [], topicId: task.topicId },
          next,
        )
        if (fix) return addFix(next, fix, task.system ?? MIXED_SYSTEM, pct(correct, score.questions))
      }
      set({ plan: next, outcome: { kind: 'progress', result, score: score ? Math.round(score.percent) : undefined } })
    },

    reportQuestions: (questions, percent, weakTopicIds) => {
      const { task, plan, today } = current()
      // Unrounded so the typed % is exactly what the engine sees (59% must stay < 60%).
      const correct = (questions * percent) / 100
      let next = logSession(task, plan, 'done', { questions, correct })
      next = applyCompletion(next, task, 'done', today, questions)
      const system = task.system ?? MIXED_SYSTEM
      const fix = isEnabled('fixLoop')
        ? planFix({ date: today, goalId: task.goalId, resourceId: task.resourceId, system, questions, correct, weakTopicIds }, next)
        : null
      if (!fix) {
        set({ plan: next, outcome: { kind: 'clean', system, score: pct(correct, questions) } })
        return
      }
      addFix(next, fix, system, pct(correct, questions))
    },

    reportRetest: (questions, percent) => {
      const { task, plan, today } = current()
      // Unrounded so the typed % is exactly what the engine sees (59% must stay < 60%).
      const correct = (questions * percent) / 100
      const next = logSession(task, plan, 'done', { questions, correct })
      const o = applyRetest(task, questions, correct, today, next)
      const name = topicPhrase(o.topics.filter((t) => task.topicIds?.includes(t.id)))
      if (o.result === 'solid') {
        set({ plan: { ...next, topics: o.topics }, outcome: { kind: 'retestPass', score: o.score, name } })
        return
      }
      if (o.result === 'again') {
        set({
          plan: { ...next, topics: o.topics, scheduled: [...next.scheduled, o.retest!] },
          outcome: { kind: 'retestAgain', score: o.score, name, next: o.retest!.date },
        })
        return
      }
      const options = fixOptions(name, goalMaterial(next, task.goalId))
      set((s) => ({
        plan: { ...next, topics: o.topics, scheduled: [...next.scheduled, o.fix!, o.retest!] },
        newIds: [...s.newIds, o.fix!.id],
        outcome: { kind: 'retestFail', score: o.score, name, fix: o.fix!, retest: o.retest!, options },
      }))
    },

    reportAnki: (cards) => {
      const { task, plan } = current()
      let next = logSession(task, plan, 'done', { cards: cards ?? undefined })
      const newLeft = Math.max(0, (next.anki?.newCardsLeft ?? 0) - (task.amount ?? 0))
      if (next.anki) next = { ...next, anki: { ...next.anki, newCardsLeft: newLeft } }
      set({ plan: next, outcome: { kind: 'ankiDone', cards, newLeft } })
    },

    changeFix: (option) => {
      const s = get()
      const o = s.outcome
      if (!s.plan || !o) return
      let outcome: Outcome
      let updated: Task
      if (o.kind === 'fix') {
        updated = engineChangeFix(o.plan.fix, option)
        outcome = { ...o, plan: { ...o.plan, fix: updated } }
      } else if (o.kind === 'retestFail') {
        updated = engineChangeFix(o.fix, option)
        outcome = { ...o, fix: updated }
      } else return
      const plan = { ...s.plan, scheduled: s.plan.scheduled.map((t) => (t.id === updated.id ? updated : t)) }
      set({ plan, outcome })
    },

    setLecturesLeft: (resourceId, left) =>
      set((s) => !s.plan ? {} : {
        plan: { ...s.plan, resources: s.plan.resources.map((r) => (r.id === resourceId ? { ...r, totalUnits: r.doneUnits + left } : r)) },
      }),

    closeBlock: () => set({ overlay: null, finishing: null, outcome: null }),
    openAnki: () => set((s) => ({ overlay: 'anki', ankiReturn: s.overlay })),
    closeAnki: () => set((s) => ({ overlay: s.ankiReturn, ankiReturn: null })),
    setAnkiConnected: (v) => set({ ankiConnected: v }),
    endIntro: () => set({ intro: false }),

    lockTarget: (goalId) =>
      set((s) => {
        if (!s.plan) return s
        const goals = s.plan.goals.map((g) =>
          g.id === goalId ? { ...g, examDate: projectedExamDate(s.plan!, g, s.today), dateSource: 'set' as const } : g)
        return { plan: { ...s.plan, goals } }
      }),

    setExamDate: (goalId, date) =>
      set((s) => !s.plan ? {} : {
        plan: { ...s.plan, goals: s.plan.goals.map((g) => (g.id === goalId ? { ...g, examDate: date, dateSource: 'set' as const } : g)) },
      }),
    dismissDatePrompt: (goalId) => set((s) => ({ datePromptDismissed: [...s.datePromptDismissed, goalId] })),

    chooseSystem: (system) => set((s) => !s.plan ? {} : { plan: { ...s.plan, focus: [system] } }),

    setWatched: (ids, on) =>
      set((s) => {
        if (!s.plan) return {}
        const plan = { ...s.plan, topics: setWatched(s.plan.topics, ids, on) }
        return { plan, todayTasks: refreshTopicTasks(plan, s.todayTasks, s.today) }
      }),

    importUworld: (rows) =>
      set((s) => {
        if (!s.plan) return {}
        const plan = applyImport(s.plan, rows, s.today)
        const before = new Set(s.plan.scheduled.map((t) => t.id))
        const added = plan.scheduled.filter((t) => !before.has(t.id)).map((t) => t.id)
        // Keep what the student already did or started; re-plan the rest of today.
        const touched = s.todayTasks.filter((t) => t.status !== 'pending')
        const day = buildDay(plan, s.today)
        const fresh = day.tasks.filter((t) => !touched.some((d) => d.id === t.id))
        return { plan, todayTasks: [...touched, ...fresh], newIds: [...s.newIds, ...added] }
      }),

    answerLight: (answer) =>
      set((s) => {
        if (!s.plan) return {}
        const offer = lightDayOffer(s.plan, s.today)
        if (!offer) return {}
        const record: LightOffer = { date: s.today, kind: offer.kind, answer }
        const plan = { ...s.plan, lightOffers: [...(s.plan.lightOffers ?? []), record] }
        if (answer === 'full' || offer.kind === 'firstOnly' || (answer === 'rest' && !offer.restAllowed)) return { plan }
        const keep = answer === 'rest' ? s.todayTasks.filter((t) => t.status !== 'pending') : lightTasks(plan, s.todayTasks, offer.kind)
        const kept = new Set(keep.map((t) => t.id))
        const dropped = s.todayTasks.filter((t) => t.status === 'pending' && !kept.has(t.id))
        const re = replanAfterLightDay(plan, dropped, s.today)
        return {
          plan: re.state,
          todayTasks: keep,
          dayMode: answer === 'rest' ? 'rest' : offer.kind === 'essentials' ? 'essentials' : 'light',
          lightNote: re.perDay > 0 ? { perDay: re.perDay, days: re.days } : null,
        }
      }),

    setWeekend: (days) =>
      set((s) => {
        if (!s.plan) return {}
        const plan = { ...s.plan, availability: { ...s.plan.availability, weekendDays: [...days].sort() } }
        const touched = s.todayTasks.filter((t) => t.status !== 'pending')
        const day = buildDay(plan, s.today)
        const fresh = day.tasks.filter((t) => !touched.some((d) => d.id === t.id))
        return { plan, dayKind: day.kind, available: day.available, todayTasks: [...touched, ...fresh], dayMode: 'full', lightNote: null }
      }),

    rateSweep: (items, id, r) =>
      set((s) => {
        if (!s.plan) return {}
        const sweepRatings = { ...s.sweepRatings, [id]: r }
        const { tasks } = sweepOutcome(items, sweepRatings, s.today)
        const sweepIds = new Set(items.map(sweepTaskId))
        return {
          sweepRatings,
          plan: { ...s.plan, scheduled: withSweepTasks(s.plan.scheduled, items, tasks) },
          newIds: [...s.newIds.filter((x) => !sweepIds.has(x)), ...tasks.map((t) => t.id)],
        }
      }),
  }
}, {
  name: STORE_KEY,
  version: STORE_VERSION,
  storage: createJSONStorage(() => safeStorage),
  // Overlays, a running timer and a half-reported block don't survive a refresh: the app opens on its tabs.
  partialize: (s): Saved => ({
    today: s.today, plan: s.plan, todayTasks: s.todayTasks, dayKind: s.dayKind, available: s.available, dayMode: s.dayMode, lightNote: s.lightNote,
    tab: s.tab, ankiConnected: s.ankiConnected, newIds: s.newIds, datePromptDismissed: s.datePromptDismissed,
    sweepRatings: s.sweepRatings,
  }),
  // Different version → start clean.
  migrate: () => initial() as unknown as DemoState,
  merge: (saved, current) => (looksValid(saved) ? { ...current, ...saved } : current),
}))

/** Tomorrow, assuming today's remaining tasks get done. Re-plans live after Partly / Didn't get to it. */
export function tomorrowPlan(plan: EngineState, todayTasks: Task[], today: ISODate) {
  return previewTomorrow(plan, todayTasks, today)
}

/** True when every focus system is covered: time to suggest the next one. */
export function focusFinished(plan: EngineState): boolean {
  return !!plan.topicGoalId && plan.focus.length > 0 && plan.focus.every((x) => isSystemDone(plan.topics, x))
}
