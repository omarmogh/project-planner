import { band, dayName, goalPace, recentAccuracy, topicCounts, verdict, type Task, type Topic } from '../engine'
import { useDemo } from '../store/demoStore'
import { Page } from '../ui/Page'

const BAND_BAR = { solid: 'bg-good', borderline: 'bg-warn', weak: 'bg-weak' } as const

export function Pace() {
  const { plan, today } = useDemo()
  const p = plan!
  const goals = p.goals.filter((g) => g.examDate > today).sort((a, b) => a.examDate.localeCompare(b.examDate))
  const paces = goals.map((g) => goalPace(g, p.resources, today))
  // Lead with what needs attention: most days behind first.
  const ordered = [...paces].sort((a, b) => (b.worst?.pace.daysLate ?? 0) - (a.worst?.pace.daysLate ?? 0))
  const [lead, ...rest] = ordered.map(verdict)
  const acc = recentAccuracy(p.sessions, today).sort((a, b) => b.pct - a.pct)
  const topics = topicCounts(p.topics, today)

  return (
    <Page withTabs>
      <div className="pt-12">
        <p className="text-[15px] font-medium text-muted">Pace</p>
        {lead ? (
          <>
            <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-tight text-balance">{lead.headline}</h1>
            <p className="mt-2 text-[19px] leading-snug text-accent">{lead.detail}</p>
          </>
        ) : (
          <h1 className="mt-1 text-[28px] font-semibold tracking-tight">No exams ahead.</h1>
        )}
        {rest.map((v) => (
          <p key={v.headline} className="mt-4 text-[16px] leading-snug">
            {v.headline} <span className="text-muted">{v.detail}</span>
          </p>
        ))}
      </div>

      <section className="mt-12">
        <h2 className="flex items-baseline justify-between text-[17px] font-semibold">
          Accuracy by system <span className="text-[14px] font-normal text-muted">last 30 days</span>
        </h2>
        {acc.length === 0 ? (
          <p className="mt-3 text-[16px] text-muted">Finish your first question block and your accuracy shows up here.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {acc.map((a) => {
              const b = band(a.pct)
              return (
                <li key={a.system}>
                  <div className="flex items-baseline justify-between text-[15px]">
                    <span>{a.system}</span>
                    <span className={`tnum font-semibold ${b === 'weak' ? 'text-weak' : b === 'borderline' ? 'text-warn' : ''}`}>{a.pct}%</span>
                  </div>
                  <div className="relative mt-1.5 h-1.5 rounded-full bg-line">
                    <div className={`h-full rounded-full ${BAND_BAR[b]}`} style={{ width: `${a.pct}%` }} />
                    <span className="absolute -top-1 bottom-[-4px] w-px bg-faint" style={{ insetInlineStart: '60%' }} aria-hidden />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {acc.length > 0 && <p className="mt-4 text-[13px] text-faint">The line marks 60%. Below it, a block gets a fix.</p>}
      </section>

      <section className="mt-12">
        <h2 className="text-[17px] font-semibold">Weak topics</h2>
        <p className="mt-1 text-[16px] text-muted">
          <span className="tnum font-semibold text-good">{topics.fixed}</span> fixed in the last 30 days ·{' '}
          <span className="tnum font-semibold text-fg">{topics.open.length}</span> still open
        </p>
        {topics.open.length > 0 && (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {topics.open.map((t) => (
              <li key={t.id} className="flex items-baseline justify-between gap-3 py-3">
                <span className="text-[16px]">
                  {t.name} {!t.wholeSystem && <span className="text-muted">· {t.system}</span>}
                </span>
                <span className="shrink-0 text-[14px] text-muted">{nextStep(t, p.scheduled, today)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
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
