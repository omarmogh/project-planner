import { count, dayName, lecturesLeft, weeklyReport } from '../engine'
import { isEnabled } from '../lib/features'
import { duration, num, range } from '../lib/format'
import { useDemo } from '../store/demoStore'
import { Page } from '../ui/Page'
import { ThemeSwitch } from '../ui/ThemeSwitch'
import { PlanLine } from './PlanSettings'
import { WeekendLine } from './WeekendSetting'

export function Weekly() {
  const { plan, today } = useDemo()
  const w = weeklyReport(plan!.sessions, plan!.topics, today)
  // University work first-class: past papers scored this week, lectures left, the next exam. Questions are board-bank questions only.
  const paperIds = new Set(plan!.resources.filter((r) => r.type === 'papers').map((r) => r.id))
  // Before the first full week, "So far" includes today, so it matches what Today shows as done.
  const early = !isEnabled('weeklyReport') || !w.hasData || !w.fullWeek
  const upTo = early && !w.fullWeek ? today : w.to
  const sessions = plan!.sessions.filter((x) => !x.imported && x.date >= w.from && x.date <= upTo)
  const soFarMin = sessions.reduce((n, x) => n + x.minutes, 0)
  const week = sessions.filter((x) => x.questions)
  const papers = week.filter((x) => x.resourceId && paperIds.has(x.resourceId) && x.kind === 'study')
  const bank = week.filter((x) => !papers.includes(x))
  const bankQ = bank.reduce((n, x) => n + (x.questions ?? 0), 0)
  const bankPct = bankQ > 0 ? Math.round((bank.reduce((n, x) => n + (x.correct ?? 0), 0) * 100) / bankQ) : null
  const paperQ = papers.reduce((n, x) => n + (x.questions ?? 0), 0)
  const paperPct = paperQ > 0 ? Math.round((papers.reduce((n, x) => n + (x.correct ?? 0), 0) * 100) / paperQ) : null
  const lectures = plan!.resources.filter((r) => r.type === 'slides' && !r.unitsUnsure && plan!.goals.some((g) => g.id === r.goalId && g.examDate > today))
  const lecturesToGo = lectures.reduce((n, r) => n + lecturesLeft(r), 0)
  const nextExam = [...plan!.goals].filter((g) => g.kind === 'uni' && g.examDate > today && g.dateSource !== 'assumed').sort((a, b) => a.examDate.localeCompare(b.examDate))[0]

  if (early) {
    const soFar = !w.fullWeek && soFarMin > 0
    return (
      <Page withTabs>
        <div className="pt-12">
          <p className="text-callout font-medium text-muted">Week</p>
          <h1 className="mt-1 text-title-1 leading-tight font-semibold tracking-display">
            {w.fullWeek ? 'Nothing logged in the last 7 days.' : w.firstIn === 1 ? 'Your first weekly report comes tomorrow.' : `Your first weekly report comes in ${w.firstIn} days.`}
          </h1>
          <p className="mt-2 text-body text-muted">
            {soFar
              ? <>So far: <span className="tnum text-fg">{duration(soFarMin)}</span> studied{bankQ > 0 && <>, <span className="tnum text-fg">{num(bankQ)}</span> questions</>}{papers.length > 0 && <>, <span className="tnum text-fg">{papers.length}</span> {papers.length === 1 ? 'paper' : 'papers'} scored</>}. The report compares whole weeks.</>
              : w.fullWeek ? 'The report fills in as you study again.' : 'It shows your hours, questions, and what improved.'}
          </p>
        </div>
        <section className="mt-16" aria-labelledby="week-settings">
          <h2 id="week-settings" className="mb-1 text-footnote font-semibold tracking-wide text-muted uppercase">Settings</h2>
          <PlanLine />
          <WeekendLine />
          <ThemeSwitch />
        </section>
      </Page>
    )
  }

  const rows: [string, React.ReactNode][] = []
  if (w.biggestGain) {
    rows.push(['Biggest gain', <>{w.biggestGain.system} <span className="tnum">{w.biggestGain.from}% → <span className="text-good">{w.biggestGain.to}%</span></span></>])
  }
  if (w.topicsFixed > 0) rows.push(['Weak topics fixed', <span className="tnum">{w.topicsFixed}</span>])
  if (w.weakest) rows.push(['Next week', <>{w.weakest.system}, still your weakest</>])
  if (lectures.length > 0 && lecturesToGo > 0) rows.push(['Lectures left', <span className="tnum">{count(lecturesToGo, 'lecture')}</span>])
  if (nextExam) rows.push(['Next exam', <>{nextExam.label} <span className="text-muted">{dayName(nextExam.examDate, today)}</span></>])

  return (
    <Page withTabs>
      <div className="pt-12">
        <p className="text-callout font-medium text-muted">Week</p>
      </div>

      <article className="anim-rise mt-4 rounded-xl bg-surface p-7" aria-label="Weekly report">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-subhead text-muted">
          <span className="font-medium">Last 7 days</span>
          <span className="tnum">{range(w.from, w.to)}</span>
        </div>

        <p className="tnum mt-8 text-display leading-none font-semibold tracking-display">{duration(w.minutes)}</p>
        <p className="mt-2 text-body text-muted">
          studied
          {bankQ > 0 && <> · <span className="tnum text-fg">{num(bankQ)}</span> {bankQ === 1 ? 'question' : 'questions'}{bankPct !== null && <> · <span className="tnum text-fg">{bankPct}%</span> correct</>}</>}
          {papers.length > 0 && <> · <span className="tnum text-fg">{papers.length}</span> {papers.length === 1 ? 'paper' : 'papers'} scored{paperPct !== null && <> · <span className="tnum text-fg">{paperPct}%</span> correct</>}</>}
        </p>

        {rows.length > 0 && <dl className="mt-8 divide-y divide-line border-t border-line">
          {rows.map(([k, v]) => (
            <div key={k} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3.5">
              <dt className="text-callout text-muted">{k}</dt>
              <dd className="text-end text-body-sm font-medium">{v}</dd>
            </div>
          ))}
        </dl>}

        <p className="mt-8 text-callout font-semibold tracking-tight text-muted">Locus</p>
      </article>

      {w.shareable && <p className="mt-4 text-center text-subhead text-faint">Screenshot to share.</p>}
      <section className="mt-16" aria-labelledby="week-settings">
        <h2 id="week-settings" className="mb-1 text-footnote font-semibold tracking-wide text-muted uppercase">Settings</h2>
        <PlanLine />
        <WeekendLine />
        <ThemeSwitch />
      </section>
    </Page>
  )
}
