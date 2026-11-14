// In-memory demo state. Refresh = fresh demo. All planning decisions are
// delegated to the pure engine; this file only wires results together.

import { create } from 'zustand'
import {
  addDays, applyFixDone, applyRetest, buildDay, changeFix as engineChangeFix, fixOptions, localToday, markWeak, pct,
  planFix, topicPhrase, type DayKind, type EngineState, type FixOption, type FixPlan, type ISODate,
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
  | { kind: 'retestFail'; score: number; name: string; fix: Task; retest: Task; options: FixOption[] }
  | { kind: 'fixDone'; name: string; retestDate?: ISODate }
  | { kind: 'studyDone'; title: string; left: number; unit: [string, string]; goalLabel: string }
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

  startApp: (plan: EngineState, ankiConnected: boolean) => void
  reset: () => void
  setTab: (t: Tab) => void
  select: (id: string) => void
  start: (id?: string) => void
  pause: () => void
  resume: () => void
  cancelRun: () => void
  finish: () => void
  reportQuestions: (questions: number, percent: number, weakTopicIds: string[]) => void
  reportRetest: (questions: number, percent: number) => void
  reportDone: () => void
  reportAnki: (cards: number | null) => void
  changeFix: (option: FixOption) => void
  closeBlock: () => void
  openAnki: () => void
  closeAnki: () => void
  setAnkiConnected: (v: boolean) => void
  endIntro: () => void
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
})

/** Planned minutes if under a minute passed (demo), else real minutes. */
export function recordedMinutes(r: Running, planned: number, now = Date.now()): number {
  const ms = (r.pausedAt ?? now) - r.startedAt - r.pausedMs
  return ms < 60_000 ? planned : Math.max(1, Math.round(ms / 60_000))
}

export const useDemo = create<DemoState>((set, get) => {
  /** Mark a task done today and log its session. */
  const complete = (task: Task, plan: EngineState, extra: Partial<Session> = {}): EngineState => {
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
      ...extra,
    }
    set((s) => ({ todayTasks: s.todayTasks.map((t) => (t.id === task.id ? { ...t, status: 'done' } : t)) }))
    return {
      ...plan,
      sessions: [...plan.sessions, session],
      scheduled: plan.scheduled.map((t) => (t.id === task.id ? { ...t, status: 'done' } : t)),
    }
  }

  const current = () => {
    const s = get()
    const task = s.todayTasks.find((t) => t.id === s.finishing?.taskId)
    if (!task || !s.plan) throw new Error('No task being reported')
    return { task, plan: s.plan, today: s.today }
  }

  return {
    ...initial(),

    startApp: (plan, ankiConnected) => {
      const today = get().today
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

    reportQuestions: (questions, percent, weakTopicIds) => {
      const { task, plan, today } = current()
      // Unrounded so the typed % is exactly what the engine sees (59% must stay < 60%).
      const correct = (questions * percent) / 100
      let next = complete(task, plan, { questions, correct })
      next = {
        ...next,
        resources: next.resources.map((r) => (r.id === task.resourceId ? { ...r, doneUnits: Math.min(r.totalUnits, r.doneUnits + questions) } : r)),
      }
      const system = task.system ?? 'Mixed'
      const fix = isEnabled('fixLoop')
        ? planFix({ date: today, goalId: task.goalId, resourceId: task.resourceId, system, questions, correct, weakTopicIds }, next)
        : null
      if (!fix) {
        set({ plan: next, outcome: { kind: 'clean', system, score: pct(correct, questions) } })
        return
      }
      next = {
        ...next,
        topics: markWeak([...next.topics, ...fix.newTopics], fix.topicIds),
        scheduled: [...next.scheduled, fix.fix, fix.retest],
      }
      set((s) => ({
        plan: next,
        newIds: [...s.newIds, fix.fix.id],
        outcome: { kind: 'fix', system, score: pct(correct, questions), plan: fix },
      }))
    },

    reportRetest: (questions, percent) => {
      const { task, plan, today } = current()
      // Unrounded so the typed % is exactly what the engine sees (59% must stay < 60%).
      const correct = (questions * percent) / 100
      const next = complete(task, plan, { questions, correct })
      const o = applyRetest(task, questions, correct, today, next)
      const name = topicPhrase(o.topics.filter((t) => task.topicIds?.includes(t.id)))
      if (o.passed || !o.fix || !o.retest) {
        set({ plan: { ...next, topics: o.topics }, outcome: { kind: 'retestPass', score: o.score, name } })
        return
      }
      const options = fixOptions(name, next.resources, next.anki)
      set((s) => ({
        plan: { ...next, topics: o.topics, scheduled: [...next.scheduled, o.fix!, o.retest!] },
        newIds: [...s.newIds, o.fix!.id],
        outcome: { kind: 'retestFail', score: o.score, name, fix: o.fix!, retest: o.retest!, options },
      }))
    },

    reportDone: () => {
      const { task, plan } = current()
      let next = complete(task, plan)
      if (task.kind === 'fix') {
        next = { ...next, topics: applyFixDone(next.topics, task) }
        const retest = next.scheduled.find(
          (t) => t.kind === 'retest' && t.status === 'pending' && t.topicIds?.join() === task.topicIds?.join(),
        )
        const name = topicPhrase(next.topics.filter((t) => task.topicIds?.includes(t.id)))
        set({ plan: next, outcome: { kind: 'fixDone', name, retestDate: retest?.date } })
        return
      }
      const r = next.resources.find((x) => x.id === task.resourceId)
      next = {
        ...next,
        resources: next.resources.map((x) => (x.id === task.resourceId ? { ...x, doneUnits: Math.min(x.totalUnits, x.doneUnits + (task.amount ?? 1)) } : x)),
      }
      const left = r ? Math.max(0, r.totalUnits - r.doneUnits - (task.amount ?? 1)) : 0
      const goal = next.goals.find((g) => g.id === task.goalId)
      set({ plan: next, outcome: { kind: 'studyDone', title: task.title, left, unit: r?.unit ?? ['unit', 'units'], goalLabel: goal?.label ?? '' } })
    },

    reportAnki: (cards) => {
      const { task, plan } = current()
      let next = complete(task, plan, { cards: cards ?? undefined })
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

    closeBlock: () => set({ overlay: null, finishing: null, outcome: null }),
    openAnki: () => set((s) => ({ overlay: 'anki', ankiReturn: s.overlay })),
    closeAnki: () => set((s) => ({ overlay: s.ankiReturn, ankiReturn: null })),
    setAnkiConnected: (v) => set({ ankiConnected: v }),
    endIntro: () => set({ intro: false }),
  }
})

/** Tomorrow, computed live from the current state. */
export function tomorrowPlan(plan: EngineState, today: ISODate) {
  return buildDay(plan, addDays(today, 1))
}
