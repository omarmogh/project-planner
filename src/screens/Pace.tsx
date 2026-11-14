import { useState } from 'react'
import {
  WEAK_BELOW, band, dailyLoad, dayName, importedResults, isCovered, lecturesLeft, plannedTopics, readiness, readyOnWith, recentAccuracy,
  roadToExam, shortDate, topicCounts, verdict, whatIfDays, count, type EngineState, type Goal, type ISODate, type RoadSegment, type Task, type Topic,
} from '../engine'
import { duration, num, range } from '../lib/format'
import { useDemo } from '../store/demoStore'
import { Chip } from '../ui/Chip'
import { Page } from '../ui/Page'
import { Sheet } from '../ui/Sheet'
import { UworldImport } from '../ui/UworldImport'

const BAND_BAR = { solid: 'bg-good', borderline: 'bg-warn', weak: 'bg-weak' } as const
/** Systems shown on the road before "Show the whole road". */
const ROAD_PREVIEW = 5
/** Question blocks before accuracy by system shows (an import shows it at once). */
const ACCURACY_MIN_BLOCKS = 2

/** "Am I on track?": the verdict, the road to the exam, what a change would do, and accuracy once there is some. */
export function Pace() {
  const { plan, today, lockTarget } = useDemo()
  const p = plan!
  const [importing, setImporting] = useState(false)
  const goals = p.goals.filter((g) => g.examDate > today).sort((a, b) => a.examDate.localeCompare(b.examDate))
  const slidesLeft = (goalId: string) => {
    const r = p.resources.find((x) => x.goalId === goalId && x.type === 'slides')
    return r ? lecturesLeft(r) : undefined
  }
  // Lead with what needs attention: a projected date first, then most days short.
  const ordered = goals
    .map((g) => readiness(p, g, today))
    .sort((a, b) => Number(b.goal.dateSource === 'projected') - Number(a.goal.dateSource === 'projected') || b.daysShort - a.daysShort)
    .map((r) => ({ goal: r.goal, r, v: verdict(r, slidesLeft(r.goal.id)) }))
  const [lead, ...rest] = ordered
  const road = roadToExam(p, today)
  const qbank = p.resources.find((r) => r.type === 'qbank')
  // What-if runs on the long exam when there is one, else the lead.
  const whatIfGoal = road?.goal ?? lead?.goal
  const whatIfReady = whatIfGoal ? readiness(p, whatIfGoal, today) : null

  return (
    <Page withTabs>
      <div className="pt-12">
        <p className="text-callout font-medium text-muted">Pace</p>
        {lead ? (
          <>
            <h1 className="mt-1 text-title-1 leading-tight font-semibold tracking-tight text-balance">{lead.v.headline}</h1>
            <p className={`mt-2 text-title-4 leading-snug ${lead.v.canLock ? 'text-muted' : 'text-accent'}`}>{lead.v.detail}</p>
            {lead.v.canLock && (
              <button type="button" onClick={() => lockTarget(lead.goal.id)} className="mt-3 inline-flex min-h-11 items-center text-body font-semibold text-accent active:opacity-60">
                Make it my target date
              </button>
            )}
          </>
        ) : (
          <h1 className="mt-1 text-title-1 font-semibold tracking-tight">No exams ahead.</h1>
        )}
        {rest.map(({ goal, v }) => (
          <p key={goal.id} className="mt-4 text-body-sm leading-snug">
            {v.headline} <span className="text-muted">{v.detail}</span>
            {v.canLock && (
              <button type="button" onClick={() => lockTarget(goal.id)} className="ms-2 inline-flex min-h-11 items-center font-semibold text-accent active:opacity-60">
                Make it my target
              </button>
            )}
          </p>
        ))}
      </div>

      {road && road.segments.length > 0 && <Road p={p} today={today} goals={goals} segments={road.segments} goal={road.goal} readyOn={road.readyOn} />}

      <Load p={p} today={today} />

      {whatIfGoal && whatIfReady?.readyOn && whatIfReady.minutesLeft > 0 && <WhatIf p={p} today={today} goal={whatIfGoal} />}

      <Accuracy p={p} today={today} onImport={qbank ? () => setImporting(true) : undefined} />

      <WeakTopics p={p} today={today} />

      {importing && (
        <Sheet title="UWorld results" onClose={() => setImporting(false)}>
          <div className="py-5">
            <p className="mb-5 text-body-sm text-muted">Your accuracy by system and the first fix start from these.</p>
            <ImportFromPace onDone={() => setImporting(false)} />
          </div>
        </Sheet>
      )}
    </Page>
  )
}

function ImportFromPace({ onDone }: { onDone: () => void }) {
  const { plan, importUworld } = useDemo()
  return (
    <UworldImport
      value={importedResults(plan!)}
      onChange={(rows) => {
        importUworld(rows)
        onDone()
      }}
    />
  )
}

type RoadRow =
  | { kind: 'segment'; seg: RoadSegment }
  | { kind: 'exam'; goal: Goal; date: ISODate; main: boolean }

/** The systems in planned order with their dates, and exams placed where they fall. */
function Road({ p, today, goals, segments, goal, readyOn }: {
  p: EngineState; today: ISODate; goals: Goal[]; segments: RoadSegment[]; goal: Goal; readyOn: ISODate | null
}) {
  const [all, setAll] = useState(false)
  const shown = all ? segments : segments.slice(0, ROAD_PREVIEW)
  const lastShown = shown[shown.length - 1].to
  const rows: RoadRow[] = shown.map((seg) => ({ kind: 'segment', seg }))
  // Exams on the stretch shown; the main exam always.
  const exams = goals.filter((g) => g.id === goal.id || g.examDate <= lastShown)
  for (const g of exams) {
    const main = g.id === goal.id
    if (main && g.dateSource === 'projected') continue // its date *is* the end of the road
    const at = rows.findIndex((r) => r.kind === 'segment' && r.seg.from > g.examDate)
    const row: RoadRow = { kind: 'exam', goal: g, date: g.examDate, main }
    if (at === -1) {
      if (main && !all && segments.length > shown.length && g.examDate > lastShown) continue
      rows.push(row)
    } else rows.splice(at, 0, row)
  }
  const topics = plannedTopics(p.topics)
  const qbank = p.resources.find((r) => r.type === 'qbank' && r.goalId === goal.id)
  return (
    <section className="mt-12">
      <h2 className="text-body font-semibold">Your road to {goal.label}</h2>
      <p className="mt-1 text-subhead text-muted">
        {topics.filter(isCovered).length} of {num(topics.length)} topics covered
        {qbank && ` · ${qbank.name} ${num(qbank.doneUnits)} of ${num(qbank.totalUnits)}`}
      </p>
      <ol className="mt-4">
        {rows.map((r) =>
          r.kind === 'segment' ? (
            <li key={r.seg.systems.join('+')} className={`relative flex gap-4 ${r.seg.afterExam ? 'opacity-50' : ''}`}>
              <Rail dot={r.seg.now ? 'now' : 'next'} />
              <div className="flex min-h-13 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2.5">
                <span className={`text-body-sm ${r.seg.now ? 'font-semibold' : 'font-medium'}`}>{r.seg.systems.join(' + ')}</span>
                <span className="tnum text-subhead text-muted">
                  {r.seg.now ? `until ${shortDate(r.seg.to)}` : r.seg.from === r.seg.to ? shortDate(r.seg.from) : range(r.seg.from, r.seg.to)}
                  {r.seg.covered > 0 && ` · ${r.seg.covered} of ${r.seg.total}`}
                </span>
              </div>
            </li>
          ) : (
            <li key={`exam-${r.goal.id}`} className="relative flex gap-4">
              <Rail dot="exam" />
              <div className="flex min-h-11 flex-1 flex-wrap items-baseline justify-between gap-x-3 py-2.5">
                <span className="text-body-sm font-semibold">{r.goal.label}</span>
                <span className="tnum text-subhead font-medium">{dayName(r.date, today)}</span>
              </div>
            </li>
          ),
        )}
      </ol>
      {segments.length > ROAD_PREVIEW && (
        <button type="button" onClick={() => setAll(!all)} className="mt-1 inline-flex min-h-11 items-center text-callout font-medium text-accent active:opacity-60">
          {all ? 'Show less' : `Show the whole road (${segments.length} stops)`}
        </button>
      )}
      {readyOn && segments.some((x) => x.afterExam) && goal.dateSource !== 'projected' && (
        <p className="mt-2 text-footnote text-muted">Faded stops come after the exam at today's pace.</p>
      )}
    </section>
  )
}

/** The line and its dot, on the start side. */
function Rail({ dot }: { dot: 'now' | 'next' | 'exam' }) {
  return (
    <span className="relative flex w-3 shrink-0 justify-center" aria-hidden>
      <span className="absolute inset-y-0 w-px bg-line" />
      <span
        className={`relative mt-[1.05rem] size-2.5 rounded-full ${
          dot === 'now' ? 'bg-accent' : dot === 'exam' ? 'bg-fg' : 'border border-faint bg-bg'
        }`}
      />
    </span>
  )
}

/** Hours a day needed vs hours a day the student has. One sentence. */
function Load({ p, today }: { p: EngineState; today: ISODate }) {
  const load = dailyLoad(p, today)
  if (load.available === 0 && load.needed === null) return null
  const over = load.needed !== null && load.needed > load.available
  return (
    <section className="mt-12">
      <h2 className="text-body font-semibold">Daily load</h2>
      <dl className="mt-3 divide-y divide-line border-y border-line">
        {load.needed !== null && (
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 py-3">
            <dt className="text-body-sm">Needed, on average</dt>
            <dd className={`tnum text-body-sm font-semibold ${over ? 'text-weak' : ''}`}>{duration(load.needed)} a day</dd>
          </div>
        )}
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 py-3">
          <dt className="text-body-sm">You have</dt>
          <dd className="tnum text-body-sm font-semibold">{duration(load.available)} a day</dd>
        </div>
      </dl>
      <p className="mt-2 text-footnote text-muted">
        {load.needed === null
          ? 'Set an exam date and you’ll see what it needs each day.'
          : over
            ? 'More than you have. The plan fits what it can and Pace shows the gap.'
            : 'Averaged over the next 4 weeks, call days and weekends included.'}
      </p>
    </section>
  )
}

/** One slider (extra minutes a day) and one toggle (skip tomorrow) → how the ready-by date moves. */
function WhatIf({ p, today, goal }: { p: EngineState; today: ISODate; goal: Goal }) {
  const [extra, setExtra] = useState(0)
  const [skip, setSkip] = useState(false)
  const w = { extraPerDay: extra, skipDays: skip ? 1 : 0 }
  const moved = whatIfDays(p, goal, today, w)
  const ready = readyOnWith(p, goal, today, w)
  const changed = extra > 0 || skip
  let line = `Ready around ${ready ? shortDate(ready) : '—'} at today's pace.`
  if (changed && moved !== null && ready) {
    const what = [extra > 0 && `+${extra} min a day`, skip && 'skipping tomorrow'].filter(Boolean).join(' and ')
    line = moved === 0
      ? `${capital(what)}: no change, ready around ${shortDate(ready)}.`
      : `${capital(what)}: ready ${count(Math.abs(moved), 'day')} ${moved > 0 ? 'earlier' : 'later'}, around ${shortDate(ready)}.`
  }
  return (
    <section className="mt-12">
      <h2 className="text-body font-semibold">What if</h2>
      <label className="mt-3 block">
        <span className="flex items-baseline justify-between text-body-sm">
          <span>Extra time a day</span>
          <span className="tnum font-semibold">{extra === 0 ? 'none' : `+${extra} min`}</span>
        </span>
        <input
          type="range"
          min={0}
          max={120}
          step={15}
          value={extra}
          aria-label="Extra minutes a day"
          onChange={(e) => setExtra(Number(e.target.value))}
          style={{ '--fill': `${(extra / 120) * 100}%` } as React.CSSProperties}
        />
      </label>
      <div className="mt-2">
        <Chip selected={skip} onClick={() => setSkip(!skip)}>If I skip tomorrow</Chip>
      </div>
      <p role="status" className="mt-4 text-body-sm leading-snug font-medium">{line}</p>
      <p className="mt-1 text-footnote text-muted">For {goal.label}. Nothing changes until you study it.</p>
    </section>
  )
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function Accuracy({ p, today, onImport }: { p: EngineState; today: ISODate; onImport?: () => void }) {
  const imported = p.sessions.some((x) => x.imported)
  // One block is a noisy number: wait for two, unless results were brought in.
  const blocks = p.sessions.filter((x) => !x.imported && x.questions).length
  const ready = imported || blocks >= ACCURACY_MIN_BLOCKS
  const acc = ready ? recentAccuracy(p.sessions, today).sort((a, b) => b.pct - a.pct) : []
  return (
    <section className="mt-12">
      <h2 className="flex flex-wrap items-baseline justify-between gap-x-3 text-body font-semibold">
        Accuracy by system {acc.length > 0 && <span className="text-subhead font-normal text-muted">last 30 days</span>}
      </h2>
      {acc.length === 0 ? (
        <p className="mt-3 text-body-sm text-muted">
          {ready
            ? 'Your blocks so far were mixed. A block on one system shows its accuracy here.'
            : `After ${ACCURACY_MIN_BLOCKS - blocks === 1 ? 'one more UWorld block' : `${ACCURACY_MIN_BLOCKS} UWorld blocks`} you'll see your accuracy by system here.`}
        </p>
      ) : (
        <>
          <ul className="mt-4 space-y-4">
            {acc.map((a) => {
              const b = band(a.pct)
              return (
                <li key={a.system}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-callout">
                    <span>{a.system}</span>
                    <span className={`tnum font-semibold ${b === 'weak' ? 'text-weak' : b === 'borderline' ? 'text-warn' : ''}`}>{a.pct}%</span>
                  </div>
                  <div className="relative mt-1.5 h-1.5 rounded-full bg-line">
                    <div className={`h-full rounded-full ${BAND_BAR[b]}`} style={{ width: `${a.pct}%` }} />
                    <span className="absolute -top-1 -bottom-1 w-px bg-faint" style={{ insetInlineStart: `${WEAK_BELOW}%` }} aria-hidden />
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="mt-4 text-footnote text-faint">
            The line marks {WEAK_BELOW}%. Below it, a block gets a fix.{imported && ' Includes your UWorld results.'}
          </p>
        </>
      )}
      {onImport && (
        <button type="button" onClick={onImport} className="mt-2 inline-flex min-h-11 items-center text-callout font-medium text-accent active:opacity-60">
          {imported ? 'Update UWorld results' : 'Bring in your UWorld results'}
        </button>
      )}
    </section>
  )
}

function WeakTopics({ p, today }: { p: EngineState; today: ISODate }) {
  const topics = topicCounts(p.topics, today)
  if (topics.fixed === 0 && topics.open.length === 0) return null
  return (
    <section className="mt-12">
      <h2 className="text-body font-semibold">Weak topics</h2>
      <p className="mt-1 text-body-sm text-muted">
        <span className="tnum font-semibold text-good">{topics.fixed}</span> fixed in the last 30 days ·{' '}
        <span className="tnum font-semibold text-fg">{topics.open.length}</span> still open
      </p>
      {topics.open.length > 0 && (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {topics.open.map((t) => (
            <li key={t.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-3">
              <span className="text-body-sm">
                {t.name} {!t.wholeSystem && <span className="text-muted">· {t.system}</span>}
              </span>
              <span className="shrink-0 text-subhead text-muted">{nextStep(t, p.scheduled, today)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function nextStep(t: Topic, scheduled: Task[], today: string): string {
  const pending = scheduled
    .filter((x) => x.status === 'pending' && x.topicIds?.includes(t.id))
    .sort((a, b) => a.date.localeCompare(b.date))
  const kind = t.status === 'weak' ? 'fix' : 'retest'
  const next = pending.find((x) => x.kind === kind) ?? pending[0]
  if (!next) return t.status === 'weak' ? 'Weak' : 'Fixing'
  const when = next.date <= today ? 'today' : dayName(next.date, today)
  return `${next.kind === 'fix' ? 'Fix' : 'Retest'} ${when}`
}
