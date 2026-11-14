import { Check, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MIXED_SYSTEM, WEAK_BELOW, dayName, plural, recentAccuracy, type FixOption, type Task } from '../engine'
import { isEnabled } from '../lib/features'
import { duration, num } from '../lib/format'
import { useDemo, type Outcome } from '../store/demoStore'
import { Button } from '../ui/Button'
import { Chip } from '../ui/Chip'
import { Page } from '../ui/Page'
import { Stepper } from '../ui/Stepper'
import { MOCK_DUE_TODAY } from './AnkiConnect'

const ANKI_CHOICES = [50, 100, 150, 200]

export function BlockFinished() {
  const s = useDemo()
  const task = s.todayTasks.find((t) => t.id === s.finishing?.taskId)
  if (!task || !s.plan) return null
  if (s.outcome) return <OutcomeView outcome={s.outcome} task={task} />

  const resource = s.plan.resources.find((r) => r.id === task.resourceId)
  if (task.kind === 'retest' || resource?.type === 'qbank') return <QuestionsReport task={task} />
  if (task.kind === 'anki') return s.ankiConnected ? <AutoReport run={() => s.reportAnki(MOCK_DUE_TODAY - 2)} /> : <AnkiReport />
  return <AutoReport run={s.reportDone} />
}

/** Tasks with nothing to enter report themselves. */
function AutoReport({ run }: { run: () => void }) {
  const ran = useRef(false)
  useEffect(() => {
    if (ran.current) return
    ran.current = true
    run()
  }, [run])
  return null
}

function Shell({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  return (
    <Page footer={footer}>
      <div className="anim-fade pt-16">{children}</div>
    </Page>
  )
}

function Heading({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  return (
    <>
      <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-balance">{title}</h1>
      {sub && <p className="mt-2 text-[17px] leading-relaxed text-muted">{sub}</p>}
    </>
  )
}

function QuestionsReport({ task }: { task: Task }) {
  const s = useDemo()
  const [step, setStep] = useState<'numbers' | 'topics'>('numbers')
  const [questions, setQuestions] = useState(task.amount ?? 20)
  const [percent, setPercent] = useState('')
  const [weak, setWeak] = useState<string[]>([])
  const p = Number(percent)
  const valid = percent !== '' && p >= 0 && p <= 100
  const isRetest = task.kind === 'retest'
  const resource = s.plan!.resources.find((r) => r.id === task.resourceId)
  const mixed = task.system === MIXED_SYSTEM
  // After a mixed block the chips are systems; after a system block, that system's topics.
  const topics = mixed
    ? [...new Set(s.plan!.topics.filter((t) => !t.wholeSystem).map((t) => t.system))].map((sys) => ({ id: sys, name: sys }))
    : s.plan!.topics.filter((t) => t.system === task.system && !t.wholeSystem)

  if (step === 'topics') {
    const toggle = (id: string) => setWeak((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]))
    return (
      <Shell
        footer={
          <Button onClick={() => s.reportQuestions(questions, p, weak)} variant={weak.length ? 'primary' : 'secondary'}>
            {weak.length ? `Mark ${weak.length} as weak` : 'Skip'}
          </Button>
        }
      >
        <Heading
          title="Anything feel weak?"
          sub={mixed ? 'Tap the systems you struggled with, or skip.' : `Tap the ${task.system} topics you struggled with, or skip.`}
        />
        <div className="mt-8 flex flex-wrap gap-2.5">
          {topics.map((t) => (
            <Chip key={t.id} selected={weak.includes(t.id)} onClick={() => toggle(t.id)}>{t.name}</Chip>
          ))}
        </div>
      </Shell>
    )
  }

  const submit = () => {
    if (!valid) return
    if (isRetest) s.reportRetest(questions, p)
    else if (isEnabled('weakTopics') && topics.length > 0) setStep('topics')
    else s.reportQuestions(questions, p, [])
  }

  return (
    <Shell footer={<Button onClick={submit} disabled={!valid}>{isRetest ? 'Save' : 'Continue'}</Button>}>
      <Heading
        title="How did it go?"
        sub={[isRetest ? 'Retest' : resource?.name, mixed ? 'Mixed' : task.system, `${duration(s.finishing!.minutes)} logged`].filter(Boolean).join(' · ')}
      />
      <form
        className="mt-10 divide-y divide-line border-y border-line"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="flex min-h-20 items-center justify-between gap-4 py-3">
          <span className="text-[17px] font-medium">Questions</span>
          <Stepper label="questions" value={questions} min={1} max={120} onChange={setQuestions} />
        </div>
        <label className="flex min-h-20 items-center justify-between gap-4 py-3">
          <span className="text-[17px] font-medium">Correct</span>
          <span className="flex items-baseline gap-1">
            <input
              inputMode="numeric"
              enterKeyHint="done"
              autoFocus
              placeholder="—"
              value={percent}
              onChange={(e) => setPercent(e.target.value.replace(/\D/g, '').slice(0, 3))}
              aria-label="Percent correct"
              className="tnum w-24 rounded-xl bg-surface px-3 py-2 text-end text-[28px] font-semibold placeholder:text-faint"
            />
            <span className="text-[22px] font-semibold text-muted">%</span>
          </span>
        </label>
      </form>
      {percent !== '' && !valid && <p className="mt-3 text-[15px] text-weak">Enter a number from 0 to 100.</p>}
    </Shell>
  )
}

function AnkiReport() {
  const s = useDemo()
  return (
    <Shell footer={<Button variant="secondary" onClick={() => s.reportAnki(null)}>Skip</Button>}>
      <Heading title="About how many did you review?" sub="One tap is enough. Anki keeps the real numbers." />
      <div className="mt-8 grid grid-cols-2 gap-2.5">
        {ANKI_CHOICES.map((n) => (
          <Chip key={n} block check={false} selected={false} onClick={() => s.reportAnki(n)}>
            <span className="tnum">{n === 200 ? '200+' : `~${n}`}</span>
          </Chip>
        ))}
      </div>
      <button type="button" onClick={() => s.openAnki()} className="mt-8 text-[15px] font-medium text-accent active:opacity-60">
        Connect Anki to skip this step
      </button>
    </Shell>
  )
}

function OutcomeView({ outcome: o, task }: { outcome: Outcome; task: Task }) {
  const s = useDemo()
  const [changing, setChanging] = useState(false)
  const done = <Button onClick={s.closeBlock}>Got it</Button>
  const goalLabel = s.plan!.goals.find((g) => g.id === task.goalId)?.label ?? ''

  switch (o.kind) {
    case 'fix':
    case 'retestFail': {
      const fix = o.kind === 'fix' ? o.plan.fix : o.fix
      const retest = o.kind === 'fix' ? o.plan.retest : o.retest
      const options = o.kind === 'fix' ? o.plan.options : o.options
      const blockName = o.kind === 'fix' && o.system === MIXED_SYSTEM ? 'Mixed' : o.kind === 'fix' ? o.system : ''
      const title =
        o.kind === 'retestFail'
          ? `${capital(o.name)} needs another pass.`
          : o.plan.scope === 'topics'
            ? `${fix.reason}.`
            : `${blockName} block: ${o.score}%.`
      const sub =
        o.kind === 'retestFail'
          ? `${o.score}% on the retest. One more fix, then another retest.`
          : o.plan.scope === 'topics'
            ? `${blockName} block: ${o.score}%. Here's the fix.`
            : o.plan.scope === 'block'
              ? `Below ${WEAK_BELOW}%, so you'll go back over your misses.`
              : `Below ${WEAK_BELOW}%, so the fix covers all of ${o.system}.`
      return (
        <Shell
          footer={
            changing ? (
              <Button variant="secondary" onClick={() => setChanging(false)}>Keep this fix</Button>
            ) : (
              <div className="flex flex-col gap-1">
                {done}
                {options.length > 1 && <Button variant="plain" onClick={() => setChanging(true)}>Change fix</Button>}
              </div>
            )
          }
        >
          <Heading title={title} sub={sub} />
          {changing ? (
            <FixPicker
              options={options}
              current={fix.fixAction}
              onPick={(opt) => {
                s.changeFix(opt)
                setChanging(false)
              }}
            />
          ) : (
            <div className="anim-rise mt-8 rounded-2xl bg-surface p-5" style={{ animationDelay: '120ms' }}>
              <p className="text-[13px] font-semibold tracking-wide text-accent uppercase">Added to {dayName(fix.date, s.today)}</p>
              <p className="mt-2 text-[18px] leading-snug font-medium">{fix.title}</p>
              <p className="tnum mt-1 text-[15px] text-muted">{fix.minutes} min · {goalLabel}</p>
              {retest && (
                <div className="mt-4 flex gap-3 border-t border-line pt-4">
                  <RotateCcw size={18} className="mt-0.5 shrink-0 text-muted" aria-hidden />
                  <p className="text-[15px] leading-snug text-muted">
                    <span className="font-medium text-fg">Retest {dayName(retest.date, s.today)}:</span> {retest.title.replace(/^Retest: /, '')}
                  </p>
                </div>
              )}
            </div>
          )}
        </Shell>
      )
    }

    case 'clean': {
      const acc = recentAccuracy(s.plan!.sessions, s.today).find((a) => a.system === o.system)
      return (
        <Shell footer={done}>
          <Heading
            title={`${o.system} block: ${o.score}%.`}
            sub={`Nothing to fix.${acc ? ` ${o.system} is now at ${acc.pct}% over the last 30 days.` : ''}`}
          />
        </Shell>
      )
    }

    case 'retestPass':
      return (
        <Shell footer={done}>
          <SolidMark />
          <Heading title={<>{capital(o.name)}: weak → <span className="text-good">solid</span>.</>} sub={`${o.score}% on the retest. Moving on.`} />
        </Shell>
      )

    case 'retestAgain':
      return (
        <Shell footer={done}>
          <Heading
            title={`${capital(o.name)}: ${o.score}%. Passed.`}
            sub={`One more retest ${dayName(o.next, s.today)} to make sure it sticks, then it counts as solid.`}
          />
        </Shell>
      )

    case 'fixDone':
      return (
        <Shell footer={done}>
          <Heading
            title={`${capital(o.name)}: fix done.`}
            sub={o.retestDate ? `Retest ${dayName(o.retestDate, s.today)} to check it stuck.` : 'Nice work.'}
          />
        </Shell>
      )

    case 'studyDone':
      return (
        <Shell footer={done}>
          <Heading
            title={`${o.title} done.`}
            sub={o.left > 0 ? `${plural(o.left, o.unit)} left before the ${o.goalLabel}.` : `That's all of it before the ${o.goalLabel}.`}
          />
        </Shell>
      )

    case 'ankiDone':
      return (
        <Shell footer={done}>
          <Heading
            title="Anki done."
            sub={
              s.ankiConnected
                ? `Anki says ${num(o.cards ?? 0)} cards reviewed today. ${num(o.newLeft)} new cards left.`
                : `${o.cards ? `About ${num(o.cards)} cards reviewed. ` : ''}${num(o.newLeft)} new cards left.`
            }
          />
        </Shell>
      )
  }
}

function FixPicker({ options, current, onPick }: { options: FixOption[]; current?: string; onPick: (o: FixOption) => void }) {
  return (
    <div className="anim-fade mt-8">
      <p className="mb-3 text-[15px] text-muted">Pick the fix that works for you:</p>
      <div className="flex flex-col gap-2.5">
        {options.map((opt) => (
          <Chip key={opt.action} block selected={opt.action === current} hint={`${opt.minutes} min`} onClick={() => onPick(opt)}>
            {opt.title}
          </Chip>
        ))}
      </div>
    </div>
  )
}

function SolidMark() {
  return (
    <span className="anim-rise mb-6 flex size-12 items-center justify-center rounded-full bg-good text-bg" aria-hidden>
      <Check size={26} strokeWidth={3} />
    </span>
  )
}

function capital(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
