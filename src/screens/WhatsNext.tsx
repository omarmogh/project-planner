import { ChevronLeft } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import {
  addCustomSubject, customSubject, rotationEnd, rotationEndAnswered, rotationName, subjectFor, toggleSubject,
  type RotationAnswer, type Subject,
} from '../data/setup'
import { BASIC_SUBJECTS, MAX_ROTATION_SUBJECTS, MINOR_ROTATIONS, ROTATIONS, ROTATION_END_WEEKS, LECTURES_LEFT_UNSURE } from '../data/templates'
import { MAX_LECTURES, addDays, daysBetween, inDays, type ISODate } from '../engine'
import { duration, longDate } from '../lib/format'
import { useDemo } from '../store/demoStore'
import { Button } from '../ui/Button'
import { Chip } from '../ui/Chip'
import { Page } from '../ui/Page'
import { Stepper } from '../ui/Stepper'

const Wrap = ({ children }: { children: ReactNode }) => <div className="flex flex-wrap gap-2.5">{children}</div>

function Heading({ title, sub }: { title: string; sub?: string }) {
  return (
    <header className="pt-3">
      <h1 className="text-large-title leading-tight font-semibold tracking-display text-balance">{title}</h1>
      {sub && <p className="mt-2 text-body-sm text-muted">{sub}</p>}
    </header>
  )
}

function Frame({ onBack, footer, children }: { onBack: () => void; footer?: ReactNode; children: ReactNode }) {
  return (
    <Page
      top={
        <div className="flex h-14 items-center px-2">
          <button type="button" onClick={onBack} className="flex size-11 items-center justify-center text-muted" aria-label="Back">
            <ChevronLeft className="size-icon-xl" />
          </button>
        </div>
      }
      footer={footer}
    >
      {children}
    </Page>
  )
}

/** Basic-year if any of the student's exams is a basic-science subject; otherwise clinical subjects first. */
function useBasicDefault(): boolean {
  const plan = useDemo((s) => s.plan)!
  const basic = new Set(BASIC_SUBJECTS.map((b) => `uni-${b.id}`))
  return [...plan.goals, ...(plan.pastGoals ?? [])].some((g) => [...basic].some((id) => g.id === id || g.id.startsWith(`${id}-`)))
}

function DateField({ label, value, onChange, today }: { label: string; value: string; onChange: (d: string) => void; today: ISODate }) {
  const days = value ? daysBetween(today, value) : 0
  return (
    <label className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 border-y border-line py-2">
      <span className="flex-1">
        <span className="block text-body font-medium">{label}</span>
        {value && <span className={`block text-subhead ${days > 0 ? 'text-muted' : 'text-weak'}`}>{days > 0 ? inDays(days) : 'Pick a future date'}</span>}
      </span>
      <input
        type="date"
        value={value}
        min={addDays(today, 1)}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        className="tnum min-h-11 min-w-0 max-w-full rounded-md bg-surface px-3 text-body-sm text-fg"
      />
    </label>
  )
}

/** Lectures left for one subject: a count, or "Not sure" (the app assumes a usual number and says so). */
function LecturesRow({ sub, onChange }: { sub: Subject; onChange: (n: number | 'not-sure') => void }) {
  const unsure = sub.lecturesLeft === 'not-sure'
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
      <span className="text-body">{sub.name}<span className="block text-subhead text-muted">Lectures left</span></span>
      <div className="flex flex-wrap items-center gap-3">
        {!unsure && (
          <Stepper label={`${sub.name} lectures left`} value={sub.lecturesLeft as number} min={0} max={MAX_LECTURES} typeable adaptive onChange={onChange} />
        )}
        <button
          type="button"
          aria-pressed={unsure}
          onClick={() => onChange(unsure ? LECTURES_LEFT_UNSURE : 'not-sure')}
          className={`min-h-11 rounded-full px-3 text-callout font-medium hover:opacity-70 active:opacity-60 ${unsure ? 'bg-accent-soft text-fg' : 'text-muted'}`}
        >
          Not sure
        </button>
      </div>
    </div>
  )
}

/** Subject chips: clinical rotations or basic sciences, plus "Type your own". `single` = pick one. */
function SubjectPicker({ rotation, setRotation, single }: { rotation: RotationAnswer; setRotation: (r: RotationAnswer) => void; single?: boolean }) {
  const [basic, setBasic] = useState(useBasicDefault())
  const [typed, setTyped] = useState('')
  const list = basic ? BASIC_SUBJECTS : [...ROTATIONS, ...MINOR_ROTATIONS]
  const has = (k: string) => rotation.subjects.some((x) => x.key === k)
  const pick = (k: string) => (single ? setRotation({ ...rotation, subjects: has(k) ? [] : [subjectFor(k)] }) : setRotation(toggleSubject(rotation, k)))
  const addTyped = () => {
    if (!typed.trim()) return
    setRotation(single ? { ...rotation, subjects: [customSubject(typed)] } : addCustomSubject(rotation, typed))
    setTyped('')
  }
  const customs = rotation.subjects.filter((x) => x.key.startsWith('custom-'))
  return (
    <>
      <Wrap>
        {list.map((r) => <Chip key={r.id} selected={has(r.id)} onClick={() => pick(r.id)}>{r.name}</Chip>)}
        {customs.map((x) => <Chip key={x.key} selected onClick={() => pick(x.key)}>{x.name}</Chip>)}
      </Wrap>
      <button type="button" onClick={() => setBasic(!basic)} className="mt-3 inline-flex min-h-11 items-center text-callout font-medium text-accent hover:opacity-70 active:opacity-60">
        {basic ? 'Show clinical rotations' : 'Show basic sciences'}
      </button>
      <form className="mt-2 flex items-end gap-3" onSubmit={(e) => { e.preventDefault(); addTyped() }}>
        <label className="min-w-0 flex-1">
          <span className="mb-2 block text-callout font-medium text-muted">Not listed? Type it</span>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value.slice(0, 30))}
            placeholder="e.g. Dermatology"
            className="min-h-11 w-full min-w-40 rounded-md bg-surface px-3 py-2 text-body"
          />
        </label>
        <button type="submit" disabled={!typed.trim() || (!single && rotation.subjects.length >= MAX_ROTATION_SUBJECTS)} className="inline-flex min-h-11 items-center px-2 text-body font-semibold text-accent hover:opacity-70 active:opacity-60 disabled:text-on-disabled">
          Add
        </button>
      </form>
    </>
  )
}

const setLectures = (r: RotationAnswer, key: string, n: number | 'not-sure'): RotationAnswer => ({
  ...r, subjects: r.subjects.map((x) => (x.key === key ? { ...x, lecturesLeft: n } : x)),
})

/** The next rotation or block: its subjects and exams are added; everything learnt so far stays. */
export function NextBlockScreen() {
  const { today, plan, closeFlow, startNextBlock } = useDemo()
  const [r, setR] = useState<RotationAnswer>({ subjects: [] })
  const end = r.end
  const picking = !!end && 'date' in end
  const ready = r.subjects.length > 0 && rotationEndAnswered(end, today)
  const until = ready ? rotationEnd({ rotation: r, university: null, weekendDays: plan?.availability.weekendDays }, today) : null
  return (
    <Frame
      onBack={closeFlow}
      footer={<Button disabled={!ready} onClick={() => startNextBlock(r)}>Start {ready ? rotationName(r) : 'the next block'}</Button>}
    >
      <Heading title="What are you studying next?" sub="Your progress, weak topics and Anki stay as they are. Pick the subjects that have an exam." />
      <div className="mt-6">
        <SubjectPicker rotation={r} setRotation={setR} />
      </div>
      {r.subjects.length > 0 && (
        <section className="anim-fade mt-8">
          <p className="mb-3 text-callout font-medium text-muted">When does it end?</p>
          <Wrap>
            {ROTATION_END_WEEKS.map((w) => {
              const on = !!end && 'weeks' in end && end.weeks === w
              return <Chip key={w} selected={on} onClick={() => setR({ ...r, end: on ? undefined : { weeks: w } })}>{w === 0 ? 'This week' : w === 1 ? '1 week' : w === 4 ? '4+ weeks' : `${w} weeks`}</Chip>
            })}
            <Chip selected={picking} onClick={() => setR({ ...r, end: picking ? undefined : { date: '' } })}>Pick date</Chip>
          </Wrap>
          {picking && (
            <div className="anim-fade mt-6">
              <DateField label="Block end" today={today} value={end.date} onChange={(d) => setR({ ...r, end: { date: d } })} />
            </div>
          )}
          {until && <p className="mt-3 text-callout text-muted">Exams at the end, around {longDate(until)}. You can change a date later in Your plan.</p>}
          <div className="mt-6 divide-y divide-line border-t border-line">
            {r.subjects.map((x) => <LecturesRow key={x.key} sub={x} onChange={(n) => setR(setLectures(r, x.key, n))} />)}
          </div>
        </section>
      )}
    </Frame>
  )
}

/** One more exam: a subject, its date (or "Don't know yet") and its lectures. */
export function AddExamScreen() {
  const { today, plan, closeFlow, addExam } = useDemo()
  const [r, setR] = useState<RotationAnswer>({ subjects: [] })
  const [date, setDate] = useState('')
  const [unknown, setUnknown] = useState(false)
  const sub = r.subjects[0]
  const dateOk = unknown || (!!date && date > today)
  const ready = !!sub && dateOk
  const blockEnd = plan?.rotation && plan.rotation.until > today ? plan.rotation.until : addDays(today, 28)
  const go = () => {
    if (!sub) return
    if (unknown) addExam({ ...sub, examAtEnd: false, examDate: 'dont-know' }, blockEnd)
    else addExam({ ...sub, examAtEnd: false, examDate: date }, date)
  }
  return (
    <Frame onBack={closeFlow} footer={<Button disabled={!ready} onClick={go}>{sub ? `Add ${sub.name} exam` : 'Add the exam'}</Button>}>
      <Heading title="Add an exam" sub="Everything you've done so far stays. The plan makes room for it." />
      <div className="mt-6">
        <SubjectPicker rotation={r} setRotation={setR} single />
      </div>
      {sub && (
        <section className="anim-fade mt-8">
          <p className="mb-3 text-callout font-medium text-muted">When is it?</p>
          <Wrap>
            <Chip selected={unknown} onClick={() => setUnknown(!unknown)} hint="Planned for the end of the block until you know">Don't know yet</Chip>
          </Wrap>
          {!unknown && <div className="mt-4"><DateField label={`${sub.name} exam date`} today={today} value={date} onChange={setDate} /></div>}
          <div className="mt-4 border-t border-line">
            <LecturesRow sub={sub} onChange={(n) => setR(setLectures(r, sub.key, n))} />
          </div>
        </section>
      )}
    </Frame>
  )
}

/** A break or a dedicated period: no rotation, its own hours. */
export function BreakScreen() {
  const { plan, closeFlow, startBreakNow } = useDemo()
  const a = plan!.availability
  const [week, setWeek] = useState(Math.round(a.weekdayMinutes / 30) * 30 || 120)
  const [end, setEnd] = useState(Math.round(a.weekendMinutes / 30) * 30 || 240)
  return (
    <Frame onBack={closeFlow} footer={<Button onClick={() => startBreakNow({ weekdayHours: week / 60, weekendHours: end / 60 })}>Plan around these hours</Button>}>
      <Heading title="A break, or a study period" sub="How much time do you want for study now? You can change it any time in Your plan." />
      <div className="mt-6 divide-y divide-line border-y border-line">
        {([['Weekdays', week, setWeek], ['Weekends', end, setEnd]] as const).map(([label, v, set]) => (
          <div key={label} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
            <span className="text-body">{label}</span>
            <Stepper label={`${label.toLowerCase()} study time`} value={v} min={0} max={12 * 60} step={30} format={duration} onChange={set} />
          </div>
        ))}
      </div>
    </Frame>
  )
}

/** The question on Today when nothing is planned ahead. One tap each; "Not now" asks again tomorrow. */
export function NextPrompt({ reason }: { reason: 'rotationEnded' | 'noExam' }) {
  const { openFlow, dismissNext } = useDemo()
  const btn = 'flex min-h-12 w-full items-center rounded-lg border border-line px-4 text-start text-body-sm font-medium active:bg-surface'
  return (
    <section className="anim-rise mt-8">
      <p className="text-title-2 font-semibold tracking-tight">What's next?</p>
      <p className="mt-1 text-body-sm text-muted">
        {reason === 'rotationEnded' ? 'Your block is over. Tell Locus what comes next and it plans around it.' : 'No exam is coming up yet. Add one, or plan a break.'}
      </p>
      <div className="mt-4 flex flex-col gap-2.5">
        <button type="button" onClick={() => openFlow('next')} className={btn}>The next rotation or block</button>
        <button type="button" onClick={() => openFlow('exam')} className={btn}>Add an exam</button>
        <button type="button" onClick={() => openFlow('break')} className={btn}>A break or a study period</button>
      </div>
      <button type="button" onClick={dismissNext} className="mt-1 inline-flex min-h-11 items-center text-callout font-medium text-muted hover:opacity-70 active:opacity-60">Not now</button>
    </section>
  )
}

/** Renders the open plan-change screen. */
export function PlanFlowScreen() {
  const flow = useDemo((s) => s.flow)
  if (flow === 'next') return <NextBlockScreen />
  if (flow === 'exam') return <AddExamScreen />
  if (flow === 'break') return <BreakScreen />
  return null
}
