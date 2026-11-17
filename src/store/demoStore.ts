// Demo state, kept in localStorage so a refresh keeps the student's plan.
// ?reset, long-pressing the wordmark and "Use demo student" start clean.
// All planning decisions are delegated to the pure engine; this file only wires results together.

import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import {
  answerLight as engineAnswerLight, applyImport, type SystemResult, buildDay, changeFix as engineChangeFix, doMore as engineDoMore, endDay, isSystemDone,
  isLateStart, lightTasks, previewTomorrow, projectedExamDate, refreshTopicTasks, lightDayNote, reportTask, setWatched, startDay, studyDay, todayOffer,
  type Completion, type DayKind, type DayNote, type DayPlan, type EngineState, type FixOption, type ISODate,
  type LightOffer, type Outcome, type Task, type TaskReport,
  sweepOutcome, sweepTaskId, withSweepTasks, type Recall, type SweepItem,
  commitmentDay, daysBetween, missedLine, rateConfident, type Commitment,
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

export type { Outcome }

interface DemoState {
  today: ISODate
  plan: EngineState | null
  todayTasks: Task[]
  dayKind: DayKind
  available: number
  /** Exam protocol for today: a normal day, the day before an exam, exam day, or the day after. */
  dayType: DayPlan['type']
  /** One calm line each: what moved, what is paused, why the day is short. */
  dayNotes: DayNote[]
  /** Due fixes and retests that didn't fit today and moved to tomorrow. */
  movedTasks: Task[]
  /** The demo student's day is pinned; real users roll over at the end of the study day (4 AM). */
  pinned: boolean
  dayMode: DayMode
  /** After a light or rest day: what moved to the coming days. */
  lightNote: { perDay: number; days: number } | null
  /** Set on the first open after a missed day (or days never opened): one quiet line for that day, then gone. */
  missedNote: string | null
  /** Setup finished late in the evening: today is one short task, the full plan starts tomorrow. */
  firstNight: boolean
  tab: Tab
  overlay: Overlay
  selectedId: string | null
  running: Running | null
  /** Minutes for the task being reported. */
  finishing: { taskId: string; minutes: number; untimed?: boolean } | null
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
  /** "You felt sure about X, but scored Y%." Shown once on the block screen. */
  confidenceNote: { name: string; score: number; reviewed: boolean } | null

  /** `today` is pinned for the demo student; real users get the real date. */
  startApp: (plan: EngineState, ankiConnected: boolean, today?: ISODate) => void
  reset: () => void
  setTab: (t: Tab) => void
  select: (id: string) => void
  start: (id?: string) => void
  /** Already did it without the timer: straight to the report, the planned minutes count. */
  doneAlready: (id: string) => void
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
  /** "Do more": add the next task on request, outside the day's cap. */
  doMore: () => void
  /** A new study day has started (after 4 AM): close yesterday, start today. No-op on the same day or for the pinned demo. */
  syncDay: (now?: Date) => void
  /** Things the student has to do. They only take time from the plan; today re-plans around them. */
  addCommitment: (c: Omit<Commitment, 'id' | 'createdOn'>) => void
  updateCommitment: (id: string, patch: Partial<Commitment>) => void
  removeCommitment: (id: string) => void
  /** Done = it disappears. */
  completeCommitment: (id: string) => void
}

const initial = () => ({
  today: studyDay(),
  plan: null,
  todayTasks: [],
  dayKind: 'normal' as DayKind,
  available: 0,
  dayType: 'normal' as DayPlan['type'],
  dayNotes: [] as DayNote[],
  movedTasks: [] as Task[],
  pinned: false,
  dayMode: 'full' as DayMode,
  lightNote: null as DemoState['lightNote'],
  missedNote: null as string | null,
  firstNight: false,
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
  confidenceNote: null as DemoState['confidenceNote'],
})

/** Planned minutes if under a minute passed (demo), else real minutes. */
export function recordedMinutes(r: Running, planned: number, now = Date.now()): number {
  const ms = (r.pausedAt ?? now) - r.startedAt - r.pausedMs
  return ms < 60_000 ? planned : Math.max(1, Math.round(ms / 60_000))
}

/** Bump when the saved shape changes: an old save is dropped, not migrated. */
export const STORE_VERSION = 4
export const STORE_KEY = 'locus-demo'

/** localStorage that never throws (private mode, blocked storage): the app just doesn't remember. */
const safeStorage: StateStorage = {
  getItem: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  setItem: (k, v) => { try { localStorage.setItem(k, v) } catch { /* not remembered */ } },
  removeItem: (k) => { try { localStorage.removeItem(k) } catch { /* nothing to remove */ } },
}

type Saved = Pick<DemoState, 'today' | 'plan' | 'todayTasks' | 'dayKind' | 'available' | 'dayType' | 'dayNotes' | 'movedTasks' | 'pinned' | 'dayMode' | 'lightNote' | 'missedNote' | 'firstNight' | 'tab' | 'ankiConnected' | 'newIds' | 'datePromptDismissed' | 'sweepRatings' | 'overlay' | 'running' | 'finishing' | 'outcome' | 'confidenceNote'>

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
  const current = () => {
    const s = get()
    const task = s.todayTasks.find((t) => t.id === s.finishing?.taskId)
    if (!task || !s.plan) throw new Error('No task being reported')
    return { task, plan: s.plan, today: s.today }
  }

  /** One answer → the engine's reportTask → the new plan, the outcome on screen, and the task's status on today's list. */
  const report = (r: TaskReport) => {
    const { task, plan, today } = current()
    const out = reportTask(plan, task, { ...r, minutes: get().finishing?.minutes ?? task.minutes, untimed: get().finishing?.untimed }, today, { fixLoop: isEnabled('fixLoop') })
    const status = out.state.outcomes?.at(-1)?.result ?? r.result
    set((s) => ({
      plan: out.state,
      outcome: out.outcome,
      confidenceNote: out.confidenceNote,
      newIds: [...s.newIds, ...out.added],
      todayTasks: s.todayTasks.map((t) => (t.id === task.id ? { ...t, status } : t)),
    }))
  }

  /** The offer on screen counts as answered once the student just starts working. */
  const settleOffer = () => {
    const s = get()
    if (s.plan && todayOffer(s.plan, s.today)) set({ plan: engineAnswerLight(s.plan, s.today, 'full') })
  }

  /** A first night stays one short task whatever re-plans it. */
  const firstNightCut = (s: DemoState, plan: EngineState, tasks: Task[]) => (s.firstNight ? lightTasks(plan, tasks, 'light') : tasks)

  /** What a built day shows besides its tasks. */
  const dayFields = (day: DayPlan) => ({
    dayKind: day.kind, available: day.available, dayType: day.type, dayNotes: day.notes, movedTasks: day.moved,
    dayMode: (day.mode === 'full' ? 'full' : day.mode) as DayMode,
  })

  /** Commitments changed → re-plan what's left of today around them. Done tasks stay as they were. */
  const withCommitments = (commitments: Commitment[]) =>
    set((s) => {
      if (!s.plan) return {}
      const plan = { ...s.plan, commitments }
      const touched = s.todayTasks.filter((t) => t.status !== 'pending')
      const fresh = (tasks: Task[]) => tasks.filter((t) => !touched.some((d) => d.id === t.id))
      if (s.dayMode !== 'full' || s.firstNight) {
        // A light day (or a first night) stays light: only the commitment work is refreshed.
        const keep = s.todayTasks.filter((t) => t.status !== 'pending' || !t.commitmentId)
        return { plan, todayTasks: [...keep, ...fresh(commitmentDay(plan, s.today).tasks).filter((t) => !keep.some((k) => k.id === t.id))] }
      }
      const day = buildDay(plan, s.today)
      return { plan, ...dayFields(day), todayTasks: [...touched, ...fresh(day.tasks)] }
    })

  return {
    ...initial(),

    startApp: (plan, ankiConnected, pinned) => {
      const today = pinned ?? studyDay()
      const started = startDay(plan, today)
      const day = buildDay(started, today)
      // Set up late at night: one short task (the light-day cut), the full plan starts tomorrow.
      const firstNight = !pinned && isLateStart(new Date().getHours()) && day.tasks.length > 0
      const todayTasks = firstNight ? lightTasks(started, day.tasks, 'light') : day.tasks
      useDemo.persist.clearStorage()
      set({ ...initial(), today, plan: started, ankiConnected, todayTasks, ...dayFields(day), pinned: !!pinned, intro: true, firstNight })
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
      set({ overlay: 'block', finishing: { taskId: task.id, minutes: recordedMinutes(s.running, task.minutes) }, running: null, outcome: null, confidenceNote: null })
    },

    doneAlready: (id) => {
      const s = get()
      const task = s.todayTasks.find((t) => t.id === id && t.status === 'pending')
      if (!task || s.running) return
      settleOffer()
      set({ overlay: 'block', finishing: { taskId: task.id, minutes: task.minutes, untimed: true }, outcome: null, confidenceNote: null })
    },

    reportCompletion: (result, score) => report({ result, questions: score?.questions, percent: score?.percent }),
    reportQuestions: (questions, percent, weakTopicIds) => report({ result: 'done', questions, percent, weakTopicIds }),
    reportRetest: (questions, percent) => report({ result: 'done', questions, percent }),
    reportAnki: (cards) => report({ result: 'done', cards }),

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

    closeBlock: () => {
      set({ overlay: null, finishing: null, outcome: null, confidenceNote: null })
      // A block reported after 4 AM belonged to yesterday; the new day starts now.
      get().syncDay()
    },
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
        return { plan, todayTasks: firstNightCut(s, plan, [...touched, ...fresh]), newIds: [...s.newIds, ...added] }
      }),

    answerLight: (answer) =>
      set((s) => {
        if (!s.plan) return {}
        const offer = todayOffer(s.plan, s.today)
        if (!offer) return {}
        // The engine records the answer; buildDay then cuts (or clears) the day.
        const plan = engineAnswerLight(s.plan, s.today, answer)
        const got = (plan.lightOffers ?? []).find((o) => o.date === s.today)?.answer
        if (got === 'full' || offer.kind === 'firstOnly') return { plan }
        const keep = got === 'rest' ? s.todayTasks.filter((t) => t.status !== 'pending' || t.commitmentId) : lightTasks(plan, s.todayTasks, offer.kind)
        const kept = new Set(keep.map((t) => t.id))
        const dropped = s.todayTasks.filter((t) => t.status === 'pending' && !kept.has(t.id))
        const re = lightDayNote(plan, dropped, s.today)
        return {
          plan,
          todayTasks: keep,
          dayMode: got === 'rest' ? 'rest' : offer.kind === 'essentials' ? 'essentials' : 'light',
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
        return { plan, ...dayFields(day), todayTasks: firstNightCut(s, plan, [...touched, ...fresh]), lightNote: null }
      }),

    rateSweep: (items, id, r) =>
      set((s) => {
        if (!s.plan) return {}
        const sweepRatings = { ...s.sweepRatings, [id]: r }
        const { tasks } = sweepOutcome(items, sweepRatings, s.today)
        const sweepIds = new Set(items.map(sweepTaskId))
        const item = items.find((x) => x.id === id)
        const confident = item?.kind === 'topic' && item.topicId ? rateConfident(s.plan.confident ?? [], item.topicId, r === 'had', s.today) : s.plan.confident
        return {
          sweepRatings,
          plan: { ...s.plan, confident, scheduled: withSweepTasks(s.plan.scheduled, items, tasks) },
          newIds: [...s.newIds.filter((x) => !sweepIds.has(x)), ...tasks.map((t) => t.id)],
        }
      }),

    doMore: () => {
      const s = get()
      if (!s.plan) return
      const more = engineDoMore(s.plan, s.todayTasks, s.today)
      if (more) set({ todayTasks: [...s.todayTasks, more], selectedId: more.id })
    },

    syncDay: (now) => {
      const s = get()
      // Never roll the day under a running timer or an open report: they belong to the day they started.
      if (!s.plan || s.pinned || s.running || s.finishing) return
      const today = studyDay(now)
      if (today <= s.today) return
      // Yesterday closes (unanswered tasks count as "didn't get to it"), today starts.
      const plan = startDay(endDay(s.plan, s.todayTasks, s.today), today)
      const day = buildDay(plan, today)
      // A day with work and nothing done (not a planned rest), plus days the app wasn't opened: said once, calmly.
      const offDay = s.dayMode === 'rest' || (s.plan.daysOff ?? []).includes(s.today)
      // A first night left undone isn't a missed day: the plan only really started the next morning.
      const idle = !s.firstNight && s.todayTasks.some((t) => !t.commitmentId) && s.todayTasks.every((t) => t.status === 'pending' || t.status === 'skipped') && !offDay
      const missed = (idle ? 1 : 0) + Math.max(0, daysBetween(s.today, today) - 1)
      // The first open of a new day is on Today, whatever tab was last used.
      set({ today, plan, todayTasks: day.tasks, ...dayFields(day), lightNote: null, missedNote: missed > 0 && day.tasks.length > 0 ? missedLine(missed) : null, firstNight: false, newIds: [], selectedId: null, sweepRatings: {}, tab: 'today' })
    },

    addCommitment: (c) => {
      const s = get()
      if (!s.plan) return
      const id = `c${Date.now().toString(36)}`
      withCommitments([...(s.plan.commitments ?? []), { ...c, id, createdOn: s.today }])
    },
    updateCommitment: (id, patch) => {
      const s = get()
      if (!s.plan) return
      withCommitments((s.plan.commitments ?? []).map((c) => (c.id === id ? { ...c, ...patch, id } : c)))
    },
    removeCommitment: (id) => {
      const s = get()
      if (!s.plan) return
      withCommitments((s.plan.commitments ?? []).filter((c) => c.id !== id))
    },
    completeCommitment: (id) => {
      const s = get()
      if (!s.plan) return
      withCommitments((s.plan.commitments ?? []).map((c) => (c.id === id ? { ...c, done: true } : c)))
    },
  }
}, {
  name: STORE_KEY,
  version: STORE_VERSION,
  storage: createJSONStorage(() => safeStorage),
  // A running timer and a half-reported block survive a refresh (the student leaves Locus to study,
  // and phones discard background tabs). Only the Anki setup sheet is not reopened.
  partialize: (s): Saved => ({
    overlay: s.overlay === 'anki' ? s.ankiReturn : s.overlay, running: s.running, finishing: s.finishing, outcome: s.outcome, confidenceNote: s.confidenceNote,
    today: s.today, plan: s.plan, todayTasks: s.todayTasks, dayKind: s.dayKind, available: s.available, dayType: s.dayType, dayNotes: s.dayNotes, movedTasks: s.movedTasks, pinned: s.pinned, dayMode: s.dayMode, lightNote: s.lightNote, missedNote: s.missedNote, firstNight: s.firstNight,
    tab: s.tab, ankiConnected: s.ankiConnected, newIds: s.newIds, datePromptDismissed: s.datePromptDismissed,
    sweepRatings: s.sweepRatings,
  }),
  // Different version → start clean.
  migrate: () => initial() as unknown as DemoState,
  merge: (saved, current) => (looksValid(saved) ? { ...current, ...saved } : current),
}))

/**
 * Tomorrow, assuming today's remaining tasks get done. Re-plans live after Partly / Didn't get to it.
 * Kept per list of tasks (any answer makes a new list), so switching tabs and back costs nothing.
 */
const tomorrowCache = new WeakMap<Task[], { plan: EngineState; today: ISODate; value: ReturnType<typeof previewTomorrow> }>()
export function tomorrowPlan(plan: EngineState, todayTasks: Task[], today: ISODate) {
  const hit = tomorrowCache.get(todayTasks)
  if (hit && hit.plan === plan && hit.today === today) return hit.value
  const value = previewTomorrow(plan, todayTasks, today)
  tomorrowCache.set(todayTasks, { plan, today, value })
  return value
}

/** Today's light-day offer, kept per plan object and day (it runs a day plan and a pace estimate). */
const offerCache = new WeakMap<EngineState, { today: ISODate; value: ReturnType<typeof todayOffer> }>()
export function offerFor(plan: EngineState, today: ISODate) {
  const hit = offerCache.get(plan)
  if (hit && hit.today === today) return hit.value
  const value = todayOffer(plan, today)
  offerCache.set(plan, { today, value })
  return value
}

/** True when every focus system is covered: time to suggest the next one. */
export function focusFinished(plan: EngineState): boolean {
  return !!plan.topicGoalId && plan.focus.length > 0 && plan.focus.every((x) => isSystemDone(plan.topics, x))
}
