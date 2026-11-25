// Commitments: "things you have to do". Not a to-do list: no backlog, nothing to manage.
// One text field, a preview with chips to correct, Add. The plan moves around them.

import { useCallback, useMemo, useState } from 'react'
import {
  addDays, busyContext, daysBetween, weekday, busyMinutes, busyReduction, busyOn, comingUp, dayContext, dayName, deadlinePlan, listJoin, parseCommitment,
  type Commitment, type CommitmentKind, type CommitmentTag, type ISODate, type ParsedCommitment,
} from '../engine'
import { TOPIC_ALIASES } from '../data/topicAliases'
import { duration } from '../lib/format'
import { useDemo } from '../store/demoStore'
import { Button } from '../ui/Button'
import { Sheet } from '../ui/Sheet'

export const TAG_LABEL: Record<CommitmentTag, string> = { uni: 'Uni', usmle: 'USMLE', personal: 'Personal' }
const TAGS: CommitmentTag[] = ['uni', 'usmle', 'personal']
const LENGTHS = [15, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480]

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)

/** "10–12", "6–7 pm", "9:30–11". Short, the way students write it. */
export function clockRange(from: string, to: string): string {
  const parts = (hm: string) => hm.split(':').map(Number)
  const [fh, fm] = parts(from)
  const [th, tm] = parts(to)
  const h12 = (h: number) => (h % 12 === 0 ? 12 : h % 12)
  const fmt = (h: number, m: number) => `${h12(h)}${m ? `:${String(m).padStart(2, '0')}` : ''}`
  const pm = fh >= 13 && th >= 13 ? ' pm' : ''
  return `${fmt(fh, fm)}–${fmt(th, tm)}${pm}`
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** "Every day", "Mon–Sat", "Mon, Wed", "Tuesdays". Consecutive days read as a range. */
export function repeatLabel(days: number[], weekend: number[] = []): string {
  const set = [...new Set(days)].sort((a, b) => a - b)
  if (set.length === 7) return 'Every day'
  const working = [0, 1, 2, 3, 4, 5, 6].filter((d) => !weekend.includes(d))
  if (weekend.length && set.length === working.length && set.every((d) => working.includes(d))) return 'Weekdays'
  if (set.length === 1) return `${DAY_SHORT[set[0]]}s`
  // Find a start so the days run in a row (Sat–Thu wraps over the week's end).
  for (const start of set) {
    const run = set.map((_, i) => (start + i) % 7)
    if (run.every((d) => set.includes(d))) return `${DAY_SHORT[start]}–${DAY_SHORT[run[run.length - 1]]}`
  }
  return set.map((d) => DAY_SHORT[d]).join(', ')
}

/** "10–12", "1 h", "whole day". */
const busyWhen = (c: Commitment) => (c.allDay ? 'whole day' : c.from && c.to ? clockRange(c.from, c.to) : duration(busyMinutes(c)))

/** "Lecture 10–12", "Gym 1 h", "Funeral whole day". */
export function busyLabel(c: Commitment): string {
  return `${c.title} ${busyWhen(c)}`
}

/** Named days in one week: "Tue", "Sun, Tue", "Mon–Wed" (no plural: it happens once). */
const onceDaysLabel = (days: number[]) => (days.length === 1 ? DAY_SHORT[days[0]] : repeatLabel(days))

/** The last day of a run of weekdays ("Sun–Thu" → Thu), or null when they don't run in a row. */
function runEnd(days: number[]): number | null {
  const set = [...new Set(days)]
  for (const start of set) {
    const run = set.map((_, i) => (start + i) % 7)
    if (run.every((d) => set.includes(d))) return run[run.length - 1]
  }
  return null
}

/** These weekdays once, from `date`: the first one on or after it, to the last one within that week (a range under way ends at its last day). */
function onceSpan(days: number[], date: ISODate): { date: ISODate; until: ISODate } {
  const off = (d: number, from: ISODate) => (d - weekday(from) + 7) % 7
  const end = runEnd(days)
  const start = days.includes(weekday(date)) ? date : addDays(date, Math.min(...days.map((d) => off(d, date))))
  const until = end !== null ? addDays(start, off(end, start)) : addDays(start, Math.max(...days.map((d) => off(d, start))))
  return { date: start, until }
}

/** A repeat that ends within its first week is "this week only"; one that ends later (or never) is every week. */
const weeklyRepeat = (d: { date: ISODate | null; until: ISODate | null }) => !d.until || !d.date || daysBetween(d.date, d.until) >= 7

/**
 * The same label for the screen: the title follows its own direction (Arabic reads right to left)
 * and the time range is always left to right, so "4–9" never shows as "9–4".
 */
export function BusyLabel({ c }: { c: Commitment }) {
  return (
    <>
      <bdi>{c.title}</bdi>{' '}
      <bdi dir="ltr" className="tnum">{busyWhen(c)}</bdi>
    </>
  )
}

type Draft = Omit<ParsedCommitment, 'kind' | 'tag'> & { kind: CommitmentKind | null; tag: CommitmentTag }

function fromCommitment(c: Commitment): Partial<Draft> {
  return { kind: c.kind, date: c.date, from: c.from ?? null, to: c.to ?? null, minutes: c.minutes ?? null, tag: c.tag, topicId: c.topicId ?? null, repeat: c.repeat ?? null, until: c.until ?? null, allDay: !!c.allDay }
}

function ready(d: Draft): d is Draft & { kind: CommitmentKind; date: ISODate } {
  if (!d.kind || !d.date) return false
  if (d.kind === 'busy') return d.allDay || !!(d.from && d.to) || !!d.minutes
  return !!d.minutes
}

function toCommitment(d: Draft & { kind: CommitmentKind; date: ISODate }): Omit<Commitment, 'id' | 'createdOn'> {
  const title = d.title || (d.kind === 'busy' ? 'Busy' : 'Deadline work')
  const busy = d.kind === 'busy'
  const allDay = busy && d.allDay
  const timed = busy && !allDay && d.from && d.to
  return {
    kind: d.kind, title, tag: d.tag, date: d.date,
    from: timed ? d.from! : undefined, to: timed ? d.to! : undefined,
    minutes: timed || allDay ? undefined : d.minutes ?? undefined,
    topicId: d.kind === 'deadline' ? d.topicId ?? undefined : undefined,
    repeat: busy && d.repeat?.length ? d.repeat : undefined,
    until: busy && d.until && (d.until > d.date || (d.repeat?.length && d.until >= d.date)) ? d.until : undefined,
    allDay: allDay || undefined,
  }
}

/** Add (no `editing`) or change one thing the student has to do. */
export function CommitmentSheet({ editing, onClose, onPickExisting, onLogResult }: { editing?: Commitment; onClose: () => void; onPickExisting?: () => void; onLogResult?: () => void }) {
  const { plan, today, addCommitment, updateCommitment, removeCommitment, completeCommitment } = useDemo()
  const p = plan!
  const [text, setText] = useState(editing?.title ?? '')
  const [over, setOver] = useState<Partial<Draft>>(editing ? fromCommitment(editing) : {})
  const topics = useMemo(() => p.topics.map((t) => ({ id: t.id, name: t.name })), [p.topics])
  const parsed = useMemo(() => parseCommitment(text, today, topics, TOPIC_ALIASES, p.availability.weekendDays), [text, today, topics, p.availability.weekendDays])
  const d: Draft = { ...parsed, ...over, title: parsed.title }
  const set = (patch: Partial<Draft>) => setOver((o) => ({ ...o, ...patch }))
  const topicName = d.topicId ? p.topics.find((t) => t.id === d.topicId)?.name : undefined
  const typed = text.trim().length > 0

  const effect = useMemo(() => {
    if (!ready(d)) return null
    const c = { ...toCommitment(d), id: editing?.id ?? 'draft', createdOn: editing?.createdOn ?? today } as Commitment
    if (c.kind === 'busy') {
      const day = dayContext(p.availability, c.date).minutes
      // What adding this item changes on its day, given the busy time already there.
      const others = (p.commitments ?? []).filter((x) => x.id !== c.id)
      const ctx = busyContext(p)
      const cost = busyReduction([...others, c], c.date, day, ctx) - busyReduction(others, c.date, day, ctx)
      const perDay = cost > 0 ? (c.allDay ? 'No study time those days; the study moves around them.' : `Takes about ${duration(cost)} a day from study time.`) : 'Leaves study time as it is.'
      if (c.repeat?.length) {
        const label = repeatLabel(c.repeat, p.availability.weekendDays)
        if (!c.until) return `${label}, until you delete it. ${perDay}`
        if (weeklyRepeat({ date: c.date, until: c.until })) return `${label}, until ${dayName(c.until, today)}. ${perDay}`
        return `${onceDaysLabel(c.repeat)}, this week only. ${perDay}`
      }
      if (c.until) return `${cap(dayName(c.date, today))} to ${dayName(c.until, today)}. ${perDay}`
      const when = c.date === today ? "today's" : `${cap(dayName(c.date, today))}'s`
      if (day === 0) return 'No study planned that day anyway.'
      if (cost <= 0) return `Leaves ${when} study time as it is.`
      return cost >= day
        ? `Takes all of ${when} study time. The study moves to the coming days; Today offers one short task if you find the time.`
        : `Takes ${duration(cost)} from ${when} study time.`
    }
    const others = (p.commitments ?? []).filter((x) => x.id !== c.id)
    const dp = deadlinePlan({ ...p, commitments: [...others, c] }, today)
    const mine = dp.chunks.filter((x) => x.commitmentId === c.id)
    if (c.date < today) return null
    if (mine.length === 0) return null
    const days = mine.map((x) => dayName(x.date, today))
    const split = mine.length === 1 ? `All of it ${days[0] === 'today' || days[0] === 'tomorrow' ? days[0] : `on ${days[0]}`}` : `Split over ${listJoin(days)}`
    if (dp.overloaded.includes(c.id)) return `${split}. Tight, so it comes before other study.`
    const early = mine[mine.length - 1].date < addDays(c.date, -1)
    return `${split}${early ? ', ready a day early' : ''}.`
  }, [d.kind, d.date, d.from, d.to, d.minutes, d.title, d.tag, d.topicId, d.repeat, d.until, d.allDay, p, today, editing])

  const save = () => {
    if (!ready(d)) return
    const c = toCommitment(d)
    if (editing) updateCommitment(editing.id, { ...c, from: c.from, to: c.to, minutes: c.minutes, topicId: c.topicId, repeat: c.repeat, until: c.until, allDay: c.allDay })
    else addCommitment(c)
    onClose()
  }

  const dayOptions = Array.from({ length: 21 }, (_, i) => addDays(today, i))
  const field = 'min-h-11 rounded-md bg-surface px-3 text-body-sm text-fg'
  const chip = (on: boolean) =>
    `inline-flex min-h-11 items-center rounded-full border px-3.5 text-subhead font-medium transition-colors ${on ? 'border-accent bg-accent-soft text-fg' : 'border-line text-muted active:bg-surface'}`

  return (
    <Sheet title={editing ? editing.title : 'Something you have to do'} onClose={onClose}>
      <form
        className="pt-4 pb-2"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <input
          autoFocus
          dir="auto"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 80))}
          placeholder="Lecture 10–12, Seminar on DKA Thursday 3h"
          aria-label="What do you have to do?"
          enterKeyHint="done"
          className="min-h-12 w-full rounded-md bg-surface px-3 py-2 text-body"
        />

        {(typed || editing) && (
          <div className="anim-fade mt-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Kind">
              <button type="button" aria-pressed={d.kind === 'busy'} onClick={() => set({ kind: 'busy', date: d.date ?? today })} className={chip(d.kind === 'busy')}>
                Busy time
              </button>
              <button type="button" aria-pressed={d.kind === 'deadline'} onClick={() => set({ kind: 'deadline' })} className={chip(d.kind === 'deadline')}>
                Work with a deadline
              </button>
            </div>

            {d.kind && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="c-day">{d.kind === 'deadline' ? 'Due' : 'Day'}</label>
                <select
                  id="c-day"
                  value={d.date ?? ''}
                  onChange={(e) => set({ date: e.target.value || null })}
                  className={`${field} ${d.date ? '' : 'text-muted'}`}
                >
                  {!d.date && <option value="">{d.kind === 'deadline' ? 'Due when?' : 'Which day?'}</option>}
                  {d.date && !dayOptions.includes(d.date) && <option value={d.date}>{cap(dayName(d.date, today))}</option>}
                  {dayOptions.map((x) => (
                    <option key={x} value={x}>{d.kind === 'deadline' ? 'Due ' : ''}{d.kind === 'deadline' ? dayName(x, today) : cap(dayName(x, today))}</option>
                  ))}
                </select>

                {d.kind === 'busy' && !d.repeat?.length && d.date && (d.allDay || d.until) && (
                  <>
                    <label className="sr-only" htmlFor="c-until">Until</label>
                    <select id="c-until" value={d.until ?? ''} onChange={(e) => set({ until: e.target.value || null })} className={field}>
                      <option value="">Just that day</option>
                      {Array.from({ length: 13 }, (_, i) => addDays(d.date!, i + 1)).map((x) => (
                        <option key={x} value={x}>Until {dayName(x, today)}</option>
                      ))}
                    </select>
                  </>
                )}

                {d.kind === 'busy' && !d.from && (
                  <button type="button" aria-pressed={d.allDay} onClick={() => set({ allDay: !d.allDay })} className={chip(d.allDay)}>
                    Whole day
                  </button>
                )}

                {d.kind === 'busy' && !d.allDay && (d.from || !d.minutes) && (
                  // A time range reads left to right in Arabic too: "From" stays first.
                  <span dir="ltr" className="inline-flex items-center gap-1.5">
                    <input type="time" aria-label="From" value={d.from ?? ''} onChange={(e) => set({ from: e.target.value || null })} className={`tnum ${field}`} />
                    <span className="text-muted" aria-hidden>–</span>
                    <input type="time" aria-label="To" value={d.to ?? ''} onChange={(e) => set({ to: e.target.value || null })} className={`tnum ${field}`} />
                  </span>
                )}

                {(d.kind === 'deadline' || (!d.from && !d.allDay)) && (
                  <>
                    <label className="sr-only" htmlFor="c-len">{d.kind === 'deadline' ? 'Work it needs' : 'How long'}</label>
                    <select
                      id="c-len"
                      value={d.minutes ?? ''}
                      onChange={(e) => set({ minutes: e.target.value ? Number(e.target.value) : null })}
                      className={`tnum ${field} ${d.minutes ? '' : 'text-muted'}`}
                    >
                      {!d.minutes && <option value="">{d.kind === 'deadline' ? 'Work it needs' : 'How long?'}</option>}
                      {d.minutes && !LENGTHS.includes(d.minutes) && <option value={d.minutes}>{duration(d.minutes)}</option>}
                      {LENGTHS.map((m) => <option key={m} value={m}>{duration(m)}</option>)}
                    </select>
                  </>
                )}

                {d.kind === 'busy' && d.repeat?.length ? (
                  weeklyRepeat(d) ? (
                    <button
                      type="button"
                      aria-pressed
                      onClick={() => d.date && set({ repeat: d.repeat, ...onceSpan(d.repeat!, d.date) })}
                      aria-label={`Repeats ${repeatLabel(d.repeat, p.availability.weekendDays)}, every week. Tap for this week only`}
                      className={chip(true)}
                    >
                      {repeatLabel(d.repeat, p.availability.weekendDays)}, every week
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-pressed
                      onClick={() => set({ repeat: d.repeat, until: null })}
                      aria-label={`${onceDaysLabel(d.repeat)}, this week only. Tap for every week`}
                      className={chip(true)}
                    >
                      {onceDaysLabel(d.repeat)}, this week only
                    </button>
                  )
                ) : null}

                <button
                  type="button"
                  onClick={() => set({ tag: TAGS[(TAGS.indexOf(d.tag) + 1) % TAGS.length] })}
                  aria-label={`Tag: ${TAG_LABEL[d.tag]}. Tap to change`}
                  className={chip(false)}
                >
                  {TAG_LABEL[d.tag]}
                </button>
              </div>
            )}

            {d.kind === 'deadline' && topicName && (
              <p className="mt-3 flex flex-wrap items-center gap-x-2 text-subhead text-muted">
                <span>Counts as studying <span className="font-medium text-fg">{topicName}</span> this week.</span>
                <button type="button" onClick={() => set({ topicId: null })} className="inline-flex min-h-11 items-center font-medium text-accent hover:opacity-70 active:opacity-60">
                  Not this topic
                </button>
              </p>
            )}

            <p className="mt-3 min-h-6 text-subhead text-muted" aria-live="polite">
              {effect ?? (d.kind ? '' : 'Is it a fixed time, or work to finish before a day?')}
            </p>
          </div>
        )}

        <div className="mt-4 space-y-1">
          <Button type="submit" disabled={!ready(d)}>{editing ? 'Save' : 'Add'}</Button>
          {/* Something already on the plan or the Board: one tap to the picker that "Do more" uses. */}
          {!editing && !typed && (onPickExisting || onLogResult) && (
            <div className="anim-fade flex flex-wrap justify-center gap-x-6">
              {onPickExisting && (
                <button type="button" onClick={onPickExisting} className="inline-flex min-h-11 items-center text-callout font-medium text-accent hover:opacity-70 active:opacity-60">
                  Or pick from your plan or Board
                </button>
              )}
              {/* An exam, NBME or quiz already done: its score goes into the fix loop. */}
              {onLogResult && (
                <button type="button" onClick={onLogResult} className="inline-flex min-h-11 items-center text-callout font-medium text-accent hover:opacity-70 active:opacity-60">
                  Log a result
                </button>
              )}
            </div>
          )}
          {editing && (
            <div className="flex flex-wrap justify-center gap-x-6">
              {editing.kind === 'deadline' && (
                <button type="button" onClick={() => { completeCommitment(editing.id); onClose() }} className="inline-flex min-h-11 items-center text-callout font-semibold text-accent hover:opacity-70 active:opacity-60">
                  It's done
                </button>
              )}
              <button type="button" onClick={() => { removeCommitment(editing.id); onClose() }} className="inline-flex min-h-11 items-center text-callout font-medium text-muted hover:opacity-70 active:opacity-60">
                Delete
              </button>
            </div>
          )}
        </div>
      </form>
    </Sheet>
  )
}

/** Today's one-line effects: busy time, deadlines coming up, and a calm note when commitments fill the day. */
export function CommitmentLines({ squeezed, retestsKept, onEdit }: { squeezed: boolean; retestsKept: boolean; onEdit: (c: Commitment) => void }) {
  const { plan, today, todayTasks } = useDemo()
  const p = plan!
  const all = p.commitments ?? []
  const busy = busyOn(all, today)
  const base = dayContext(p.availability, today).minutes
  const cost = busyReduction(all, today, base, busyContext(p))
  const coming = comingUp(all, today, todayTasks)
  const link = 'inline-flex min-h-11 items-center text-start hover:opacity-70 active:opacity-60'
  const squeezedByThem = squeezed && (busy.length > 0 || todayTasks.some((t) => t.commitmentId))
  if (!busy.length && !coming.length && !squeezedByThem) return null

  return (
    <div className="mt-6 text-callout text-muted">
      {busy.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-1">
          {busy.map((c, i) => (
            <span key={c.id} className="inline-flex items-center">
              <button type="button" onClick={() => onEdit(c)} className={`${link} font-medium text-fg`} aria-label={`Edit ${busyLabel(c)}`}>
                <BusyLabel c={c} />
              </button>
              {i < busy.length - 1 && <span aria-hidden>,</span>}
            </span>
          ))}
          <span className="tnum">
            → {cost >= base ? 'no study time left today' : `${duration(base - cost)} of study time instead of ${duration(base)}`}
          </span>
        </p>
      )}
      {coming.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-1">
          <span>Coming up:</span>
          {coming.map((c, i) => (
            <span key={c.id} className="inline-flex items-center">
              <button type="button" onClick={() => onEdit(c)} className={`${link} font-medium text-fg`}>
                <bdi>{c.title}</bdi>, {cap(dayName(c.date, today))}
              </button>
              {i < coming.length - 1 && <span aria-hidden>·</span>}
            </span>
          ))}
        </p>
      )}
      {squeezed && (busy.length > 0 || todayTasks.some((t) => t.commitmentId)) && (
        <p className="mt-1">
          Your commitments take today's study time. {retestsKept ? 'Retests stay; the rest moves to the coming days.' : 'Study moves to the coming days.'}
        </p>
      )}
    </div>
  )
}

/** Sheet state for Today: null = closed, 'new' = add, a commitment = edit. */
export function useCommitmentSheet() {
  const [open, setOpen] = useState<'new' | Commitment | null>(null)
  const close = useCallback(() => setOpen(null), [])
  return { open, setOpen, close }
}
