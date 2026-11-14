// In-memory demo state. Refresh = fresh demo. All planning decisions are
// delegated to the pure engine; this file only wires results together.

import { create } from 'zustand'
import {
  applyCompletion, applyRetest, buildDay, changeFix as engineChangeFix, fixOptions, goalMaterial, isSystemDone,
  localToday, markWeak, pct, planFix, previewTomorrow, projectedExamDate, topicPhrase,
  MIXED_SYSTEM, type Completion, type DayKind, type EngineState, type FixOption, type FixPlan, type ISODate,
  type Session, type Task,
} from '../engine'
import { isEnabled } from '../lib/features'

export type Tab = 'today' | 'pace' | 'week'
export type Overlay = 'running' | 'block' | 'anki' | null

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
}

const initial = () => ({
  today: localToday(),
  plan: null,
  todayTasks: [],
  dayKind: 'normal' as DayKind,
  available: 0,
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
})

/** Planned minutes if under a minute passed (demo), else real minutes. */
export function recordedMinutes(r: Running, planned: number, now = Date.now()): number {
  const ms = (r.pausedAt ?? now) - r.startedAt - r.pausedMs
  return ms < 60_000 ? planned : Math.max(1, Math.round(ms / 60_000))
}

export const useDemo = create<DemoState>((set, get) => {
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
    return {
      ...plan,
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
      set({ ...initial(), today, plan, ankiConnected, todayTasks: day.tasks, dayKind: day.kind, available: day.available, intro: true })
    },

    reset: () => set(initial()),
    setTab: (tab) => set({ tab }),
    select: (id) => set({ selectedId: id }),

    start: (id) => {
      const s = get()
      const next = id ?? s.selectedId ?? s.todayTasks.find((t) => t.status === 'pending')?.id
      if (!next) return
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
  }
})

/** Tomorrow, assuming today's remaining tasks get done. Re-plans live after Partly / Didn't get to it. */
export function tomorrowPlan(plan: EngineState, todayTasks: Task[], today: ISODate) {
  return previewTomorrow(plan, todayTasks, today)
}

/** True when every focus system is covered: time to suggest the next one. */
export function focusFinished(plan: EngineState): boolean {
  return !!plan.topicGoalId && plan.focus.length > 0 && plan.focus.every((x) => isSystemDone(plan.topics, x))
}
