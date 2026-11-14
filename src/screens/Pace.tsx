import {
  WEAK_BELOW, band, count, dayName, lecturesLeft, plannedTopics, readiness, recentAccuracy, systemProgress, systemsInOrder,
  topicCounts, verdict, isCovered, type Task, type Topic,
} from '../engine'
import { num } from '../lib/format'
import { useDemo } from '../store/demoStore'
import { Page } from '../ui/Page'

const BAND_BAR = { solid: 'bg-good', borderline: 'bg-warn', weak: 'bg-weak' } as const

export function Pace() {
  const { plan, today, lockTarget } = useDemo()
  const p = plan!
  const goals = p.goals.filter((g) => g.examDate > today).sort((a, b) => a.examDate.localeCompare(b.examDate))
  const slidesLeft = (goalId: string) => {
    const r = p.resources.find((x) => x.goalId === goalId && x.type === 'slides')
    return r ? lecturesLeft(r) : undefined
  }
  // Lead with what needs attention: a projected date first, then most days short.
  const ordered = goals
    .map((g) => readiness(p, g, today))
    .sort((a, b) => Number(b.goal.dateSource === 'projected') - Number(a.goal.dateSource === 'projected') || b.daysShort - a.daysShort)
    .map((r) => ({ goalId: r.goal.id, v: verdict(r, slidesLeft(r.goal.id)) }))
  const [lead, ...rest] = ordered
  const acc = recentAccuracy(p.sessions, today).sort((a, b) => b.pct - a.pct)
  const topics = topicCounts(p.topics, today)

  return (
    <Page withTabs>
      <div className="pt-12">
        <p className="text-callout font-medium text-muted">Pace</p>
        {lead ? (
          <>
            <h1 className="mt-1 text-title-1 leading-tight font-semibold tracking-tight text-balance">{lead.v.headline}</h1>
            <p className={`mt-2 text-title-4 leading-snug ${lead.v.canLock ? 'text-muted' : 'text-accent'}`}>{lead.v.detail}</p>
            {lead.v.canLock && (
              <button type="button" onClick={() => lockTarget(lead.goalId)} className="mt-3 inline-flex min-h-11 items-center text-body font-semibold text-accent active:opacity-60">
                Make it my target date
              </button>
            )}
          </>
        ) : (
          <h1 className="mt-1 text-title-1 font-semibold tracking-tight">No exams ahead.</h1>
        )}
        {rest.map(({ goalId, v }) => (
          <p key={goalId} className="mt-4 text-body-sm leading-snug">
            {v.headline} <span className="text-muted">{v.detail}</span>
            {v.canLock && (
              <button type="button" onClick={() => lockTarget(goalId)} className="ms-2 inline-flex min-h-11 items-center font-semibold text-accent active:opacity-60">
                Make it my target
              </button>
            )}
          </p>
        ))}
      </div>

      <Progress />

      <section className="mt-12">
        <h2 className="flex flex-wrap items-baseline justify-between gap-x-3 text-body font-semibold">
          Accuracy by system <span className="text-subhead font-normal text-muted">last 30 days</span>
        </h2>
        {acc.length === 0 ? (
          <p className="mt-3 text-body-sm text-muted">Finish your first question block and your accuracy shows up here.</p>
        ) : (
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
        )}
        {acc.length > 0 && <p className="mt-4 text-footnote text-faint">The line marks {WEAK_BELOW}%. Below it, a block gets a fix.</p>}
      </section>

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
    </Page>
  )
}

/** (a) qbank questions done, (b) topics covered per system, (c) lectures left. */
function Progress() {
  const { plan } = useDemo()
  const p = plan!
  const rows: { label: string; value: string }[] = []
  for (const r of p.resources) {
    const goal = p.goals.find((g) => g.id === r.goalId)?.label
    if (r.type === 'qbank') rows.push({ label: r.name, value: `${num(r.doneUnits)} of ${num(r.totalUnits)} questions` })
    if (r.type === 'slides') rows.push({ label: `${r.name}${goal ? ` · ${goal}` : ''}`, value: `${count(lecturesLeft(r), 'lecture')} left` })
  }
  const topics = plannedTopics(p.topics)
  const systems = p.topicGoalId ? systemsInOrder(p.topics).map((x) => systemProgress(p.topics, x)) : []
  if (systems.length) rows.unshift({ label: 'Topics covered', value: `${topics.filter(isCovered).length} of ${num(topics.length)}` })
  if (rows.length === 0) return null
  return (
    <section className="mt-12">
      <h2 className="text-body font-semibold">Progress</h2>
      <dl className="mt-3 divide-y divide-line border-y border-line">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
            <dt className="text-body-sm">{r.label}</dt>
            <dd className="tnum text-body-sm text-muted">{r.value}</dd>
          </div>
        ))}
      </dl>
      {systems.length > 0 && (
        <details className="group mt-2">
          <summary className="flex min-h-11 cursor-pointer list-none items-center text-callout font-medium text-accent">
            Topics by system
          </summary>
          <ul className="mt-2 space-y-3 pb-2">
            {systems.map((x) => (
              <li key={x.system}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-callout">
                  <span>{x.system}</span>
                  <span className="tnum text-muted">{x.covered} of {x.total}</span>
                </div>
                <div className="mt-1.5 h-1 rounded-full bg-line">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(x.covered / Math.max(1, x.total)) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </details>
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
