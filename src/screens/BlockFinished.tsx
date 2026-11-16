import { Check, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  MAX_LECTURES, MIXED_SYSTEM, WEAK_BELOW, addDays, count, dayName, daysBetween, deadlinePlan, remainingMinutes, isCovered, isSystemDone, lecturesLeft, recentAccuracy, systemProgress,
  type Completion, type FixOption, type Task,
} from '../engine'
import { isEnabled } from '../lib/features'
import { duration } from '../lib/format'
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
  if (task.kind === 'retest' || (resource?.type === 'qbank' && !task.topicId)) return <QuestionsReport task={task} />
  if (task.kind === 'anki') return s.ankiConnected ? <AutoReport run={() => s.reportAnki(MOCK_DUE_TODAY - 2)} /> : <AnkiReport />
  return <CompletionReport task={task} />
}

const COMPLETION: { id: Completion; label: string }[] = [
  { id: 'done', label: 'Done' },
  { id: 'partly', label: 'Partly' },
  { id: 'skipped', label: "Didn't get to it" },
]

/** The one completion question. A topic with questions asks for the score next (skippable). */
function CompletionReport({ task }: { task: Task }) {
  const s = useDemo()
  const [result, setResult] = useState<Completion | null>(null)
  const asksScore = !!task.topicId && (task.amount ?? 0) > 0

  if (result && asksScore) {
    return (
      <ScoreForm
        title={`How did the ${count(task.amount ?? 0, 'question')} go?`}
        sub={`${task.title} · skip if you didn't get to them`}
        initialQuestions={result === 'partly' ? Math.max(1, Math.round((task.amount ?? 10) / 2)) : task.amount ?? 10}
        onSubmit={(questions, percent) => s.reportCompletion(result, { questions, percent })}
        onSkip={() => s.reportCompletion(result)}
      />
    )
  }

  const pick = (r: Completion) => {
    if (r !== 'skipped' && asksScore) setResult(r)
    else s.reportCompletion(r)
  }
  return (
    <Shell footer={null}>
      <Heading title="How did it go?" sub={`${task.title} · ${duration(s.finishing!.minutes)}`} />
      <div className="mt-8 flex flex-col gap-2.5" role="group" aria-label="How did it go?">
        {COMPLETION.map((c) => (
          <Chip key={c.id} block check={false} selected={false} onClick={() => pick(c.id)}>{c.label}</Chip>
        ))}
      </div>
    </Shell>
  )
}

/** Questions + % correct, used for topic questions. */
function ScoreForm({
  title, sub, initialQuestions, onSubmit, onSkip,
}: { title: string; sub: string; initialQuestions: number; onSubmit: (q: number, p: number) => void; onSkip: () => void }) {
  const [questions, setQuestions] = useState(initialQuestions)
  const [percent, setPercent] = useState('')
  const p = Number(percent)
  const valid = percent !== '' && p >= 0 && p <= 100
  const submit = () => valid && onSubmit(questions, p)
  return (
    <Shell
      footer={
        <div className="flex flex-col gap-1">
          <Button onClick={submit} disabled={!valid}>Save</Button>
          <Button variant="plain" onClick={onSkip}>Skip</Button>
        </div>
      }
    >
      <Heading title={title} sub={sub} />
      <ScoreFields questions={questions} setQuestions={setQuestions} percent={percent} setPercent={setPercent} onSubmit={submit} />
      {percent !== '' && !valid && <p className="mt-3 text-callout text-weak">Enter a number from 0 to 100.</p>}
    </Shell>
  )
}

function ScoreFields({
  questions, setQuestions, percent, setPercent, onSubmit,
}: { questions: number; setQuestions: (n: number) => void; percent: string; setPercent: (v: string) => void; onSubmit: () => void }) {
  return (
    <form
      className="mt-10 divide-y divide-line border-y border-line"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <div className="flex min-h-20 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
        <span className="text-body font-medium">Questions</span>
        <Stepper label="questions" value={questions} min={1} max={120} typeable onChange={setQuestions} />
      </div>
      <label className="flex min-h-20 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
        <span className="text-body font-medium">Correct</span>
        <span className="flex items-baseline gap-1">
          <input
            inputMode="numeric"
            enterKeyHint="done"
            autoFocus
            placeholder="—"
            value={percent}
            onChange={(e) => setPercent(e.target.value.replace(/\D/g, '').slice(0, 3))}
            aria-label="Percent correct"
            className="tnum min-h-11 w-24 rounded-md bg-surface px-3 py-2 text-end text-title-1 font-semibold placeholder:text-faint"
          />
          <span className="text-title-2 font-semibold text-muted">%</span>
        </span>
      </label>
    </form>
  )
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
  const note = useDemo((x) => x.confidenceNote)
  return (
    <Page footer={footer ?? undefined}>
      <div className="anim-fade pt-16">
        {children}
        {note && (
          // Felt sure in the sweep, scored low: said once, gently. Not a warning.
          <p className="mt-8 border-t border-line pt-4 text-callout leading-relaxed text-muted">
            You felt sure about {note.name}, but scored {note.score}%. {note.reviewed ? 'Added a short review.' : 'The fix above covers it.'}
          </p>
        )}
      </div>
    </Page>
  )
}

function Heading({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  return (
    <>
      <h1 className="text-title-1 leading-tight font-semibold tracking-tight text-balance">{title}</h1>
      {sub && <p className="mt-2 text-body leading-relaxed text-muted">{sub}</p>}
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
      <ScoreFields questions={questions} setQuestions={setQuestions} percent={percent} setPercent={setPercent} onSubmit={submit} />
      {percent !== '' && !valid && <p className="mt-3 text-callout text-weak">Enter a number from 0 to 100.</p>}
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
      <button type="button" onClick={() => s.openAnki()} className="mt-6 inline-flex min-h-11 items-center text-callout font-medium text-accent active:opacity-60">
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
    case 'retestStopped':
      return (
        <Shell footer={done}>
          <Heading title={`${capital(o.name)} stays on your weak list.`} sub={`${o.score}% on the retest. No more retests on it for now: it comes back when you study that system again.`} />
        </Shell>
      )
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
          ? o.parked
            ? `${o.score}% on the retest. It rests for a while, then gets a fresh pass with a different approach.`
            : `${o.score}% on the retest. A different fix this time, then another retest.`
          : task.topicId
            ? `Below ${WEAK_BELOW}%, so it gets a fix and a retest.`
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
            <div className="anim-rise mt-8 rounded-lg bg-surface p-5" style={{ animationDelay: '120ms' }}>
              <p className="text-footnote font-semibold tracking-wide text-accent uppercase">Added to {dayName(fix.date, s.today)}</p>
              <p className="mt-2 text-body-lg leading-snug font-medium">{fix.title}</p>
              <p className="tnum mt-1 text-callout text-muted">{fix.minutes} min · {goalLabel}</p>
              {retest && (
                <div className="mt-4 flex gap-3 border-t border-line pt-4">
                  <RotateCcw className="size-icon-sm mt-0.5 shrink-0 text-muted" aria-hidden />
                  <p className="text-callout leading-snug text-muted">
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

    case 'progress':
      return <ProgressOutcome result={o.result} score={o.score} task={task} done={done} />

    case 'ankiDone':
      return (
        <Shell footer={done}>
          <Heading
            title="Anki done."
            sub={
              s.ankiConnected
                ? `Anki says ${count(o.cards ?? 0, 'card')} reviewed today. ${count(o.newLeft, 'new card')} left.`
                : `${o.cards ? `About ${count(o.cards, 'card')} reviewed. ` : ''}${count(o.newLeft, 'new card')} left.`
            }
          />
        </Shell>
      )
  }
}

function ProgressOutcome({ result, score, task, done }: { result: Completion; score?: number; task: Task; done: ReactNode }) {
  const s = useDemo()
  const plan = s.plan!
  const goalLabel = plan.goals.find((g) => g.id === task.goalId)?.label ?? ''
  let title: ReactNode
  let sub: ReactNode
  let extra: ReactNode = null

  if (task.commitmentId) {
    const c = plan.commitments?.find((x) => x.id === task.commitmentId)
    const due = c ? dayName(c.date, s.today) : ''
    const next = c && !c.done ? deadlinePlan(plan, addDays(s.today, 1)).chunks.find((x) => x.commitmentId === c.id) : undefined
    const left = c ? remainingMinutes(c) : 0
    const nextLine = next ? `${duration(left)} left, planned for ${dayName(next.date, s.today)}.` : `${duration(left)} left before it's due ${due}.`
    if (!c || c.done) {
      title = `${task.title}: done.`
      sub = c && daysBetween(s.today, c.date) >= 2 ? 'All prepared, a day early.' : 'All prepared.'
    } else if (result === 'done') {
      title = `${task.title}: this part's done.`
      sub = nextLine
    } else if (result === 'partly') {
      title = `${task.title}: partly done.`
      sub = nextLine
    } else {
      title = `${task.title} moves to the coming days.`
      sub = next ? `Still ready before ${due}.` : `It's due ${due}, so it comes first.`
    }
  } else if (task.topicId) {
    const topic = plan.topics.find((t) => t.id === task.topicId)!
    const prog = systemProgress(plan.topics, topic.system)
    const scoreLine = score !== undefined ? ` ${score}% on the questions.` : ''
    if (result === 'done' && isSystemDone(plan.topics, topic.system)) {
      title = `${topic.system} is done.`
      sub = `All ${count(prog.total, 'topic')} covered.${scoreLine} Today shows what's next.`
    } else if (result === 'done') {
      const covered = isCovered(topic)
      title = covered ? `${topic.name}: covered.` : `${topic.name}: this part's done.`
      sub = `${topic.system}: ${prog.watched} of ${count(prog.total, 'topic')} watched · ${prog.solid} solid.${scoreLine}${covered ? '' : ' The rest comes next time.'}`
    } else if (result === 'partly') {
      title = `${topic.name}: partly done.`
      sub = `The rest comes first next time.${scoreLine}`
    } else {
      title = `${topic.name} moves to the coming days.`
      sub = "No problem. Tomorrow's plan already has it."
    }
  } else if (task.kind === 'fix') {
    title = 'Fix moved to tomorrow.'
    sub = result === 'partly' ? "With less time, since you've started it." : "No problem. It's first in line tomorrow."
  } else if (task.kind === 'review') {
    // The day before an exam: whatever the answer, the day is over.
    title = result === 'skipped' ? 'No problem.' : "That's it for today."
    sub = 'Rest matters more than one more page tonight. Good luck tomorrow.'
  } else if (!task.resourceId) {
    title = result === 'skipped' ? 'Moved to tomorrow.' : result === 'done' ? 'Done.' : 'Partly done.'
    sub = result === 'skipped' ? 'No problem.' : 'What you could recall is what stays. The gaps are what to look at next time.'
  } else if (plan.resources.find((x) => x.id === task.resourceId)?.type === 'papers') {
    const r = plan.resources.find((x) => x.id === task.resourceId)!
    const papers = Math.max(0, Math.ceil(r.totalUnits - r.doneUnits - 1e-9))
    if (result === 'skipped') {
      title = 'The paper moves to the coming days.'
      sub = 'No problem. The plan spreads it out.'
    } else {
      title = result === 'done' ? 'Paper done.' : 'Paper partly done.'
      sub = papers > 0 ? `${count(papers, 'past paper')} left before the ${goalLabel}. Keep a note of what you missed.` : `That was the last past paper before the ${goalLabel}.`
    }
  } else {
    const r = plan.resources.find((x) => x.id === task.resourceId)
    const left = r ? lecturesLeft(r) : 0
    if (result === 'skipped') {
      title = `${task.title} moves to tomorrow.`
      sub = 'No problem. The plan spreads it out.'
    } else {
      title = result === 'done' ? `${task.title}: done.` : `${task.title}: partly done.`
      sub = left > 0 ? `${count(left, 'lecture')} left before the ${goalLabel}.` : `That's every lecture before the ${goalLabel}.`
      if (r) extra = <LecturesLeft resourceId={r.id} left={left} />
    }
  }
  return (
    <Shell footer={done}>
      <Heading title={title} sub={sub} />
      {extra}
    </Shell>
  )
}

/** "Not right?" → correct the lectures left (no titles, just the count). */
function LecturesLeft({ resourceId, left }: { resourceId: string; left: number }) {
  const setLecturesLeft = useDemo((s) => s.setLecturesLeft)
  const [editing, setEditing] = useState(false)
  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="mt-4 inline-flex min-h-11 items-center text-callout font-medium text-accent active:opacity-60">
        Not right? Change it
      </button>
    )
  }
  return (
    <div className="anim-fade mt-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-y border-line py-3">
      <span className="text-body font-medium">Lectures left</span>
      <Stepper label="lectures left" value={left} min={0} max={MAX_LECTURES} typeable onChange={(n) => setLecturesLeft(resourceId, n)} />
    </div>
  )
}

function FixPicker({ options, current, onPick }: { options: FixOption[]; current?: string; onPick: (o: FixOption) => void }) {
  return (
    <div className="anim-fade mt-8">
      <p className="mb-3 text-callout text-muted">Pick the fix that works for you:</p>
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
      <Check className="size-icon-2xl" strokeWidth={3} />
    </span>
  )
}

function capital(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
