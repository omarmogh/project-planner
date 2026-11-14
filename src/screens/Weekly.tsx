import { weeklyReport } from '../engine'
import { isEnabled } from '../lib/features'
import { duration, num, range } from '../lib/format'
import { useDemo } from '../store/demoStore'
import { Page } from '../ui/Page'
import { ThemeSwitch } from '../ui/ThemeSwitch'

export function Weekly() {
  const { plan, today } = useDemo()
  const w = weeklyReport(plan!.sessions, plan!.topics, today)

  if (!isEnabled('weeklyReport') || !w.hasData) {
    return (
      <Page withTabs>
        <div className="pt-12">
          <p className="text-callout font-medium text-muted">Week</p>
          <h1 className="mt-1 text-title-1 leading-tight font-semibold tracking-tight">Your first weekly report comes in 7 days.</h1>
          <p className="mt-2 text-body text-muted">It shows your hours, questions, and what improved.</p>
        </div>
        <div className="mt-16">
          <ThemeSwitch />
        </div>
      </Page>
    )
  }

  const rows: [string, React.ReactNode][] = []
  if (w.biggestGain) {
    rows.push(['Biggest gain', <>{w.biggestGain.system} <span className="tnum">{w.biggestGain.from}% → <span className="text-good">{w.biggestGain.to}%</span></span></>])
  }
  rows.push(['Weak topics fixed', <span className="tnum">{w.topicsFixed}</span>])
  if (w.weakest) rows.push(['Next week', <>{w.weakest.system}, still your weakest</>])

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

        <p className="tnum mt-8 text-display leading-none font-semibold tracking-tight">{duration(w.minutes)}</p>
        <p className="mt-2 text-body text-muted">
          studied · <span className="tnum text-fg">{num(w.questions)}</span> {w.questions === 1 ? 'question' : 'questions'}
          {w.accuracy !== null && <> · <span className="tnum text-fg">{w.accuracy}%</span> correct</>}
        </p>

        <dl className="mt-8 divide-y divide-line border-t border-line">
          {rows.map(([k, v]) => (
            <div key={k} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3.5">
              <dt className="text-callout text-muted">{k}</dt>
              <dd className="text-end text-body-sm font-medium">{v}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-8 text-callout font-semibold tracking-tight text-faint">Locus</p>
      </article>

      <p className="mt-4 text-center text-subhead text-faint">Screenshot to share.</p>
      <div className="mt-16">
        <ThemeSwitch />
      </div>
    </Page>
  )
}
