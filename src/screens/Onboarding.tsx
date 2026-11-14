import { ChevronDown, ChevronLeft } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { DEMO_TODAY, linaState } from '../data/demo'
import {
  addCustomSubject, buildPlanState, checklistIds, defaultAnswers, dropSubjects, goalChoices, goalLabel, offersWatched, pickUniversity, plansByTopic, rotationEndAnswered,
  subjectLabel, toggleSubject, usesSubjects, type Answers, type DateAnswer, type Subject,
} from '../data/setup'
import {
  ANKI_NEW_UNSURE, ANKI_REVIEW_CHOICES, LECTURES_LEFT_UNSURE, MAX_ROTATION_SUBJECTS, MINOR_ROTATIONS, RESOURCES, ROTATION_END_WEEKS, ROTATIONS, STAGES,
  UWORLD_TOTAL, UWORLD_TOTAL_DEFAULT, roughYear, type ResourceKey, type RoughWhen,
} from '../data/templates'
import { SYSTEMS } from '../data/topics'
import { countryList, loadUniversities, searchUniversities, type UniversityData, type UniversityPick } from '../data/universities'
import { addDays, daysBetween, inDays, type GoalKind } from '../engine'
import { isEnabled } from '../lib/features'
import { duration, num } from '../lib/format'
import { useDemo } from '../store/demoStore'
import { Button } from '../ui/Button'
import { Chip } from '../ui/Chip'
import { Page } from '../ui/Page'
import { ProgressBar } from '../ui/ProgressBar'
import { Stepper } from '../ui/Stepper'
import { UworldImport } from '../ui/UworldImport'
import { WatchedChecklist } from '../ui/WatchedChecklist'
import { AnkiConnect } from './AnkiConnect'

type StepId =
  | 'stage' | 'university' | 'goals' | 'rotation' | `subject-${string}` | `date-${GoalKind}`
  | 'resources' | 'uworldImport' | 'numbers' | 'systemsNow' | 'systemsDone' | 'time' | 'anki'

/** Only ask what changes the plan; skip what doesn't apply. */
function stepsFor(a: Answers): StepId[] {
  const s: StepId[] = ['stage']
  if (a.stage !== 'graduated') s.push('university')
  s.push('goals')
  if (a.stage === 'clinical') s.push('rotation')
  for (const g of a.goals) {
    if (g === 'uni' && usesSubjects(a)) for (const sub of a.rotation.subjects) s.push(`subject-${sub.key}`)
    else s.push(`date-${g}`)
  }
  s.push('resources')
  if (a.resources.includes('uworld')) s.push('uworldImport')
  if (a.resources.some((r) => r === 'uworld' || r === 'anki' || (r === 'slides' && !usesSubjects(a)))) s.push('numbers')
  if (plansByTopic(a)) s.push('systemsNow', 'systemsDone')
  s.push('time')
  if (a.resources.includes('anki') && isEnabled('ankiConnect')) s.push('anki')
  return s
}

const AUTO_ADVANCE_MS = 220

export function Onboarding() {
  const today = useDemo((s) => s.today)
  const startApp = useDemo((s) => s.startApp)
  const [a, setA] = useState<Answers>(defaultAnswers)
  const [answered, setAnswered] = useState<Set<StepId>>(new Set())
  const [i, setI] = useState(0)
  const [ankiConnected, setAnkiConnected] = useState(false)
  const advancing = useRef(false)
  /** The "Already watched some of X?" row that's open, if any. Collapsed by default. */
  const [watchOpen, setWatchOpen] = useState<string | null>(null)

  const steps = stepsFor(a)
  const step = steps[Math.min(i, steps.length - 1)]
  const isLast = i >= steps.length - 1

  const update = (patch: Partial<Answers>) => setA((prev) => ({ ...prev, ...patch }))
  const finish = (connected = ankiConnected) => startApp(buildPlanState(a, today), connected)
  const next = () => {
    setAnswered((s) => new Set(s).add(step))
    if (isLast) finish()
    else setI((n) => n + 1)
  }
  const back = () => setI((n) => Math.max(0, n - 1))
  /** Single-choice questions advance on tap, after a beat so the selection is seen. Tapping the chosen one unselects it. */
  const pick = (patch: Partial<Answers>, selected: boolean) => {
    if (selected) {
      setAnswered((s) => {
        const n = new Set(s)
        n.delete(step)
        return n
      })
      return
    }
    update(patch)
    if (advancing.current) return
    advancing.current = true
    window.setTimeout(() => {
      advancing.current = false
      setAnswered((s) => new Set(s).add(step))
      setI((n) => n + 1)
    }, AUTO_ADVANCE_MS)
  }
  const chosen = (id: StepId) => answered.has(id)

  if (step === 'anki') {
    return (
      <AnkiConnect
        mode="onboarding"
        connected={ankiConnected}
        newCards={a.ankiNewLeft ?? 0}
        onConnectedChange={setAnkiConnected}
        onDone={() => finish()}
        onBack={back}
      />
    )
  }

  let title = ''
  let hint: string | undefined
  let body: ReactNode = null
  let canContinue = true
  /** Shown under a disabled Continue: why it's disabled. */
  let why = ''
  let multi = true
  /** Footer label when it isn't Continue (an optional step reads "Skip" until it's used). */
  let label: string | undefined

  const setDate = (kind: GoalKind, d: DateAnswer | undefined) => update({ dates: { ...a.dates, [kind]: d } })

  if (step.startsWith('subject-')) {
    const key = step.slice(8)
    const sub = a.rotation.subjects.find((x) => x.key === key)!
    const setSub = (patch: Partial<Subject>) =>
      update({ rotation: { ...a.rotation, subjects: a.rotation.subjects.map((x) => (x.key === key ? { ...x, ...patch } : x)) } })
    const label = subjectLabel(sub)
    title = `${label} at the end of the rotation?`
    const date = sub.examDate && sub.examDate !== 'dont-know' ? sub.examDate : ''
    body = (
      <>
        <Wrap>
          <Chip selected={sub.examAtEnd} onClick={() => setSub({ examAtEnd: true, examDate: undefined })}>Yes</Chip>
          <Chip selected={!sub.examAtEnd} onClick={() => setSub({ examAtEnd: false })}>No</Chip>
        </Wrap>
        {!sub.examAtEnd && (
          <div className="anim-fade mt-8">
            <p className="mb-3 text-callout font-medium text-muted">When is it? Not out yet is fine.</p>
            <DateRow label={label} today={today} value={date} onChange={(d) => setSub({ examDate: d || undefined })} />
            <div className="mt-4">
              <Chip selected={sub.examDate === 'dont-know'} onClick={() => setSub({ examDate: sub.examDate === 'dont-know' ? undefined : 'dont-know' })}>
                Don't know yet
              </Chip>
            </div>
          </div>
        )}
        <div className="mt-10 border-y border-line">
          <NumberRow
            label={`Lectures you still need to study for ${sub.name}`}
            unsure={sub.lecturesLeft === 'not-sure'}
            onUnsure={() => setSub({ lecturesLeft: sub.lecturesLeft === 'not-sure' ? LECTURES_LEFT_UNSURE : 'not-sure' })}
          >
            <Stepper
              label={`${sub.name} lectures left`}
              value={sub.lecturesLeft === 'not-sure' ? LECTURES_LEFT_UNSURE : sub.lecturesLeft}
              min={0}
              max={60}
              onChange={(v) => setSub({ lecturesLeft: v })}
            />
          </NumberRow>
        </div>
      </>
    )
    canContinue = sub.examAtEnd || !sub.examDate || sub.examDate === 'dont-know' || date > today
    why = 'Pick a date after today'
  } else if (step.startsWith('date-')) {
    const kind = step.slice(5) as GoalKind
    const label = goalLabel(kind)
    const ans = a.dates[kind]
    if (kind === 'uni') {
      title = `When is your ${label}?`
      hint = "Not out yet? We'll plan with a usual date and ask again later."
      body = (
        <>
          <DateRow
            label={label}
            today={today}
            value={ans?.kind === 'date' ? ans.date : ''}
            onChange={(date) => setDate(kind, date ? { kind: 'date', date } : undefined)}
          />
          <div className="mt-4">
            <Chip selected={ans?.kind === 'unknown'} onClick={() => setDate(kind, ans?.kind === 'unknown' ? undefined : { kind: 'unknown' })}>Don't know yet</Chip>
          </div>
        </>
      )
      canContinue = ans?.kind === 'unknown' || (ans?.kind === 'date' && ans.date > today)
      why = "Pick a date, or Don't know yet"
    } else {
      const year = roughYear(today)
      const booked = ans?.kind === 'date'
      const notYet = ans?.kind === 'notYet' || ans?.kind === 'rough' || ans?.kind === 'unknown'
      title = `Have you booked ${label}?`
      body = (
        <>
          <Wrap>
            <Chip selected={booked} onClick={() => setDate(kind, booked ? undefined : { kind: 'date', date: '' })}>Yes</Chip>
            <Chip selected={notYet} onClick={() => setDate(kind, notYet ? undefined : { kind: 'notYet' })}>Not yet</Chip>
          </Wrap>
          {booked && (
            <div className="anim-fade mt-8">
              <DateRow label={label} today={today} value={ans.date} onChange={(date) => setDate(kind, { kind: 'date', date })} />
            </div>
          )}
          {notYet && (
            <div className="anim-fade mt-8">
              <p className="mb-3 text-callout font-medium text-muted">Roughly when?</p>
              <Wrap>
                {(['early', 'mid', 'late'] as RoughWhen[]).map((w) => {
                  const on = ans?.kind === 'rough' && ans.when === w
                  return (
                    <Chip key={w} selected={on} onClick={() => setDate(kind, on ? { kind: 'notYet' } : { kind: 'rough', when: w })}>
                      {w === 'early' ? 'Early' : w === 'mid' ? 'Mid' : 'Late'} {year}
                    </Chip>
                  )
                })}
                <Chip selected={ans?.kind === 'unknown'} onClick={() => setDate(kind, ans?.kind === 'unknown' ? { kind: 'notYet' } : { kind: 'unknown' })}>No idea</Chip>
              </Wrap>
              {ans?.kind === 'unknown' && (
                <p className="anim-fade mt-4 text-callout text-muted">We'll work out when you'd be ready at your pace.</p>
              )}
            </div>
          )}
        </>
      )
      canContinue = ans?.kind === 'rough' || ans?.kind === 'unknown' || (booked && ans.date > today)
      why = booked ? 'Pick the date' : notYet ? 'Pick roughly when, or No idea' : 'Pick Yes or Not yet'
    }
  } else {
    switch (step) {
      case 'stage':
        title = 'Where are you in med school?'
        multi = false
        body = (
          <Choices>
            {STAGES.map((s) => (
              <Chip key={s.id} block hint={s.hint} selected={chosen('stage') && a.stage === s.id} onClick={() => pick({ stage: s.id }, chosen('stage') && a.stage === s.id)}>
                {s.label}
              </Chip>
            ))}
          </Choices>
        )
        break

      case 'university':
        title = 'Which university?'
        multi = false
        body = (
          <UniversityStep
            value={a.university}
            onPick={(u) => pick(pickUniversity(u), chosen('university') && a.university?.name === u.name && a.university.country === u.country)}
            onType={(u) => update(u ? pickUniversity(u) : { university: null })}
          />
        )
        // Search picks advance by themselves; a typed name needs Continue.
        canContinue = !!a.university?.name.trim()
        why = 'Search for it, or type its name'
        break

      case 'goals': {
        title = 'What are you preparing for?'
        hint = 'Pick all that apply.'
        const toggle = (kind: GoalKind) => {
          const has = a.goals.includes(kind)
          update({ goals: has ? a.goals.filter((g) => g !== kind) : [...a.goals, kind] })
        }
        body = (
          <Wrap>
            {goalChoices(a.stage).map((g) => (
              <Chip key={g.kind} selected={a.goals.includes(g.kind)} onClick={() => toggle(g.kind)}>
                {g.label}
              </Chip>
            ))}
          </Wrap>
        )
        canContinue = a.goals.length > 0
        why = 'Pick at least one exam'
        break
      }

      case 'rotation':
        title = 'Which rotation are you on?'
        hint = `Pick up to ${MAX_ROTATION_SUBJECTS} if it combines subjects, like ENT + Ophthalmology.`
        body = <RotationStep a={a} update={update} today={today} />
        canContinue = a.rotation.subjects.length > 0 && rotationEndAnswered(a.rotation.end, today)
        why = a.rotation.subjects.length === 0 ? 'Pick at least one rotation' : 'Pick when it ends'
        break

      case 'resources': {
        title = 'What do you study with?'
        hint = 'Pick all that apply.'
        const toggle = (key: ResourceKey) => {
          const has = a.resources.includes(key)
          update({ resources: has ? a.resources.filter((r) => r !== key) : [...a.resources, key] })
        }
        body = (
          <Wrap>
            {RESOURCES.filter((r) => r.key !== 'slides' || (a.goals.includes('uni') && !usesSubjects(a))).map((r) => (
              <Chip key={r.key} selected={a.resources.includes(r.key)} onClick={() => toggle(r.key)}>
                {r.label ?? r.name}
              </Chip>
            ))}
          </Wrap>
        )
        canContinue = a.resources.length > 0
        why = 'Pick at least one'
        break
      }

      case 'uworldImport':
        title = 'Bring in your UWorld results?'
        hint = "Optional. Your plan starts on your weakest system from day one."
        body = (
          <UworldImport
            value={a.uworldImport}
            onChange={(rows) => {
              const used = rows.reduce((n, r) => n + r.used, 0)
              // Prefill "questions done" on the next step; never lower what the student typed.
              update({ uworldImport: rows, uworldDone: rows.length ? Math.max(a.uworldDone ?? 0, used) : a.uworldDone })
            }}
          />
        )
        if (!a.uworldImport.length) label = 'Skip'
        break

      case 'numbers':
        title = 'A few numbers'
        hint = 'Only what you know off the top of your head.'
        body = <NumbersStep a={a} update={update} />
        break

      case 'systemsNow': {
        title = 'Which system are you studying now?'
        hint = 'Pick one or two.'
        const toggle = (id: string) => {
          const has = a.systemsNow.includes(id)
          const now = has ? a.systemsNow.filter((x) => x !== id) : [...a.systemsNow, id].slice(-2)
          // A system that's no longer "now" loses its ticks: only the current systems get a checklist.
          const keep = new Set(now.flatMap(checklistIds))
          update({
            systemsNow: now, systemsNowUnsure: false,
            systemsDone: a.systemsDone.filter((x) => !now.includes(x)),
            watched: a.watched.filter((w) => keep.has(w)),
          })
          if (watchOpen && !now.includes(watchOpen)) setWatchOpen(null)
        }
        const tick = (ids: string[], on: boolean) =>
          update({ watched: on ? [...new Set([...a.watched, ...ids])] : a.watched.filter((w) => !ids.includes(w)) })
        body = (
          <>
            <Wrap>
              {SYSTEMS.map((x) => (
                <Chip key={x.id} selected={a.systemsNow.includes(x.id)} onClick={() => toggle(x.id)}>{x.id}</Chip>
              ))}
              <Chip selected={a.systemsNowUnsure} onClick={() => { update({ systemsNowUnsure: !a.systemsNowUnsure, systemsNow: [], watched: [] }); setWatchOpen(null) }}>Not sure</Chip>
            </Wrap>
            {offersWatched(a) && a.systemsNow.length > 0 && (
              <div className="mt-8 border-y border-line">
                {a.systemsNow.map((sys) => {
                  const open = watchOpen === sys
                  const n = checklistIds(sys).filter((id) => a.watched.includes(id)).length
                  return (
                    <div key={sys} className="border-b border-line last:border-b-0">
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setWatchOpen(open ? null : sys)}
                        className="flex min-h-13 w-full items-center gap-3 py-3 text-start active:opacity-60"
                      >
                        <span className="flex-1">
                          <span className="block text-body-sm font-medium">Already watched some of {sys}?</span>
                          <span className="block text-subhead text-muted">{n ? `${n} ticked · watched, not mastered` : 'Optional'}</span>
                        </span>
                        <ChevronDown className={`size-icon-sm shrink-0 text-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`} aria-hidden />
                      </button>
                      {open && (
                        <div className="anim-fade pb-3">
                          <p className="text-subhead text-muted">Tick the B&amp;B videos you've seen. They leave the plan; the topic still gets its questions.</p>
                          <WatchedChecklist system={sys} watched={a.watched} onChange={tick} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )
        canContinue = a.systemsNowUnsure || a.systemsNow.length > 0
        why = 'Pick a system, or Not sure'
        break
      }

      case 'systemsDone': {
        title = 'Any systems already done?'
        hint = 'Studied at least once. The plan starts from what\'s left.'
        const toggle = (id: string) =>
          update({ systemsDone: a.systemsDone.includes(id) ? a.systemsDone.filter((x) => x !== id) : [...a.systemsDone, id], systemsDoneNone: false })
        body = (
          <Wrap>
            {SYSTEMS.filter((x) => !a.systemsNow.includes(x.id)).map((x) => (
              <Chip key={x.id} selected={a.systemsDone.includes(x.id)} onClick={() => toggle(x.id)}>{x.id}</Chip>
            ))}
            <Chip selected={a.systemsDoneNone} onClick={() => update({ systemsDoneNone: !a.systemsDoneNone, systemsDone: [] })}>None yet</Chip>
          </Wrap>
        )
        canContinue = a.systemsDoneNone || a.systemsDone.length > 0
        why = 'Pick the systems you\'ve done, or None yet'
        break
      }

      case 'time':
        title = 'How much time can you study?'
        hint = 'After hospital and lectures. Be honest — the plan fits what you give it.'
        body = (
          <div className="divide-y divide-line border-y border-line">
            {([['weekdayHours', 'Weekdays'], ['weekendHours', 'Weekend']] as const).map(([k, label]) => (
              <div key={k} className="flex min-h-18 flex-wrap items-center gap-x-4 gap-y-2 py-3">
                <span className="flex-1 text-body font-medium">{label}</span>
                <Stepper label={label} value={a[k]} min={0.5} max={12} step={0.5} format={(h) => duration(h * 60)} onChange={(v) => update({ [k]: v })} />
              </div>
            ))}
          </div>
        )
        break
    }
  }

  return (
    <Page
      top={
        <div className="flex h-14 items-center gap-2 px-2">
          <button
            type="button"
            onClick={back}
            className={`flex size-11 items-center justify-center text-accent ${i === 0 ? 'invisible' : ''}`}
            aria-label="Back"
          >
            <ChevronLeft className="size-icon-2xl rtl:-scale-x-100" />
          </button>
          <div className="flex-1 pe-5">
            <ProgressBar value={(i + 1) / (steps.length + 1)} label="Setup progress" />
          </div>
        </div>
      }
      footer={
        multi ? (
          <div>
            <Button onClick={next} disabled={!canContinue} aria-describedby={!canContinue && why ? 'continue-why' : undefined}>
              {isLast ? 'Build my plan' : label ?? 'Continue'}
            </Button>
            {!canContinue && why && <p id="continue-why" className="mt-2 text-center text-subhead text-muted">{why}</p>}
          </div>
        ) : i === 0 ? (
          <Button variant="plain" onClick={() => startApp(linaState(DEMO_TODAY), false, DEMO_TODAY)}>Use demo student</Button>
        ) : undefined
      }
    >
      <div key={step} className="anim-fade pt-4">
        {i === 0 && <p className="mb-2 text-callout font-medium text-muted">Let's build your plan. About a minute.</p>}
        <h1 className="text-title-1 leading-tight font-semibold tracking-tight">{title}</h1>
        {hint && <p className="mt-2 text-body-sm leading-relaxed text-muted">{hint}</p>}
        <div className="mt-8">{body}</div>
      </div>
    </Page>
  )
}

function Choices({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2.5">{children}</div>
}

function Wrap({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2.5">{children}</div>
}

function DateRow({ label, today, value, onChange }: { label: string; today: string; value: string; onChange: (d: string) => void }) {
  const days = value ? daysBetween(today, value) : 0
  return (
    <label className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 border-y border-line py-2">
      <span className="flex-1">
        <span className="block text-body font-medium">Date</span>
        {value && <span className={`block text-subhead ${days > 0 ? 'text-muted' : 'text-weak'}`}>{days > 0 ? inDays(days) : 'Pick a future date'}</span>}
      </span>
      <input
        type="date"
        value={value}
        min={addDays(today, 1)}
        aria-label={`${label} date`}
        onChange={(e) => onChange(e.target.value)}
        className="tnum min-w-0 max-w-full rounded-md bg-surface px-3 text-body-sm text-fg"
      />
    </label>
  )
}

/**
 * Majors and minors can be combined (up to MAX_ROTATION_SUBJECTS); each becomes a subject with its own exam.
 * "Minor rotation" opens the minors (tap again to close and clear them); "Type your own" adds a custom subject.
 */
function RotationStep({ a, update, today }: { a: Answers; update: (p: Partial<Answers>) => void; today: string }) {
  const subjects = a.rotation.subjects
  const isMinor = (key: string) => MINOR_ROTATIONS.some((r) => r.id === key)
  const isCustom = (key: string) => key.startsWith('custom-')
  const [minor, setMinor] = useState(subjects.some((x) => isMinor(x.key)))
  const [typing, setTyping] = useState(subjects.some((x) => isCustom(x.key)))
  const [typed, setTyped] = useState('')
  const full = subjects.length >= MAX_ROTATION_SUBJECTS
  const setRotation = (r: Answers['rotation']) => update({ rotation: r })
  const has = (key: string) => subjects.some((x) => x.key === key)
  const toggle = (key: string) => setRotation(toggleSubject(a.rotation, key))
  const add = () => {
    setRotation(addCustomSubject(a.rotation, typed))
    setTyped('')
  }
  const end = a.rotation.end
  const picking = !!end && 'date' in end
  const setEnd = (e: Answers['rotation']['end']) => update({ rotation: { ...a.rotation, end: e } })
  return (
    <>
      <Wrap>
        {ROTATIONS.map((r) => (
          <Chip key={r.id} selected={has(r.id)} onClick={() => toggle(r.id)}>{r.name}</Chip>
        ))}
        <Chip
          selected={minor}
          onClick={() => {
            if (minor) setRotation(dropSubjects(a.rotation, 'minor'))
            setMinor(!minor)
          }}
        >
          Minor rotation
        </Chip>
        <Chip
          selected={typing}
          onClick={() => {
            if (typing) setRotation(dropSubjects(a.rotation, 'custom'))
            setTyping(!typing)
          }}
        >
          Type your own
        </Chip>
      </Wrap>
      {minor && (
        <div className="anim-fade mt-6">
          <p className="mb-3 text-callout font-medium text-muted">Which ones?</p>
          <Wrap>
            {MINOR_ROTATIONS.map((r) => (
              <Chip key={r.id} selected={has(r.id)} onClick={() => toggle(r.id)}>{r.name}</Chip>
            ))}
          </Wrap>
        </div>
      )}
      {typing && (
        <div className="anim-fade mt-6">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              add()
            }}
          >
            <label className="min-w-0 flex-1">
              <span className="mb-2 block text-callout font-medium text-muted">Subject name</span>
              <input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value.slice(0, 30))}
                placeholder="e.g. Subsurgery"
                className="min-h-11 w-full min-w-40 rounded-md bg-surface px-3 py-2 text-body"
              />
            </label>
            <button type="submit" disabled={!typed.trim() || full} className="inline-flex min-h-11 items-center px-2 text-body font-semibold text-accent active:opacity-60 disabled:text-on-disabled">
              Add
            </button>
          </form>
          {subjects.some((x) => isCustom(x.key)) && (
            <div className="mt-4">
              <Wrap>
                {subjects.filter((x) => isCustom(x.key)).map((x) => (
                  <Chip key={x.key} selected onClick={() => toggle(x.key)}>{x.name}</Chip>
                ))}
              </Wrap>
            </div>
          )}
        </div>
      )}
      {full && <p className="mt-4 text-callout text-muted">Up to {MAX_ROTATION_SUBJECTS} subjects in one rotation. Tap one to remove it.</p>}
      {subjects.length > 0 && (
        <div className="anim-fade mt-8">
          <p className="mb-3 text-callout font-medium text-muted">When does it end?</p>
          <Wrap>
            {ROTATION_END_WEEKS.map((w) => {
              const on = !!end && 'weeks' in end && end.weeks === w
              return (
                <Chip key={w} selected={on} onClick={() => setEnd(on ? undefined : { weeks: w })}>
                  {w === 1 ? '1 week' : w === 4 ? '4+ weeks' : `${w} weeks`}
                </Chip>
              )
            })}
            <Chip selected={picking} onClick={() => setEnd(picking ? undefined : { date: '' })}>Pick date</Chip>
          </Wrap>
          {picking && (
            <div className="anim-fade mt-6">
              <DateRow label="Rotation end" today={today} value={end.date} onChange={(d) => setEnd({ date: d })} />
            </div>
          )}
        </div>
      )}
    </>
  )
}

/**
 * Search the bundled university list (Hipo, MIT). A pick sets the university and its
 * country's weekend. Not listed → type the name and pick the country.
 */
function UniversityStep({ value, onPick, onType }: {
  value: UniversityPick | null
  onPick: (u: UniversityPick) => void
  onType: (u: UniversityPick | null) => void
}) {
  const [data, setData] = useState<UniversityData | null>(null)
  const [query, setQuery] = useState(value?.name ?? '')
  const [typing, setTyping] = useState(false)
  useEffect(() => {
    let live = true
    loadUniversities().then((d) => live && setData(d))
    return () => { live = false }
  }, [])
  const results = data ? searchUniversities(data, query) : []
  const country = value?.country ?? 'JO'

  if (typing) {
    return (
      <div className="anim-fade">
        <label className="block">
          <span className="mb-2 block text-callout font-medium text-muted">University name</span>
          <input
            autoFocus
            value={value?.name ?? ''}
            onChange={(e) => onType({ name: e.target.value.slice(0, 80), country })}
            className="min-h-11 w-full rounded-md bg-surface px-3 py-2 text-body"
          />
        </label>
        <label className="mt-6 block">
          <span className="mb-2 block text-callout font-medium text-muted">Country</span>
          <select
            value={country}
            onChange={(e) => onType({ name: value?.name ?? '', country: e.target.value })}
            className="min-h-11 w-full rounded-md bg-surface px-3 py-2 text-body"
          >
            {data ? countryList(data).map(({ code, name }) => <option key={code} value={code}>{name}</option>) : <option value={country}>{country}</option>}
          </select>
        </label>
        <button type="button" onClick={() => { setTyping(false); onType(null) }} className="mt-6 inline-flex min-h-11 items-center text-body font-medium text-accent active:opacity-60">
          Search instead
        </button>
      </div>
    )
  }

  return (
    <div>
      <input
        autoFocus
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search, e.g. Mutah"
        aria-label="Search universities"
        className="min-h-11 w-full rounded-md bg-surface px-3 py-2 text-body"
      />
      {results.length > 0 && (
        <div className="mt-4">
          <Choices>
            {results.map((u) => {
              const on = value?.name === u.name && value.country === u.country
              return (
                <Chip key={`${u.country}-${u.name}`} block hint={data!.countries[u.country]} selected={on} onClick={() => onPick(u)}>
                  {u.name}
                </Chip>
              )
            })}
          </Choices>
        </div>
      )}
      {data && query.trim().length >= 2 && results.length === 0 && (
        <p className="mt-4 text-callout text-muted">No match in the list.</p>
      )}
      <button
        type="button"
        onClick={() => { setTyping(true); onType({ name: query.trim(), country }) }}
        className="mt-6 inline-flex min-h-11 items-center text-body font-medium text-accent active:opacity-60"
      >
        Can't find it? Type your university
      </button>
    </div>
  )
}

/** UWorld questions done, Anki, lectures left. Each with "Not sure". */
function NumbersStep({ a, update }: { a: Answers; update: (p: Partial<Answers>) => void }) {
  const board = a.goals.find((g) => g !== 'uni')
  const uworldTotal = (board && UWORLD_TOTAL[board]) ?? UWORLD_TOTAL_DEFAULT
  return (
    <div className="divide-y divide-line border-y border-line">
      {a.resources.includes('uworld') && (
        <NumberRow
          label="UWorld questions done"
          unsure={a.uworldDone === null}
          onUnsure={() => update({ uworldDone: a.uworldDone === null ? 0 : null })}
        >
          <Stepper label="UWorld questions done" value={a.uworldDone ?? 0} min={0} max={uworldTotal} step={50} format={num} onChange={(v) => update({ uworldDone: v })} />
        </NumberRow>
      )}
      {a.resources.includes('anki') && (
        <div className="py-4">
          <NumberRow label="Anki new cards left" unsure={a.ankiNewLeft === null} onUnsure={() => update({ ankiNewLeft: a.ankiNewLeft === null ? ANKI_NEW_UNSURE : null })} flush>
            <input
              inputMode="numeric"
              aria-label="Anki new cards left"
              value={a.ankiNewLeft ? num(a.ankiNewLeft) : ''}
              placeholder="—"
              onChange={(e) => {
                const v = Number(e.target.value.replace(/\D/g, '')) || 0
                update({ ankiNewLeft: e.target.value === '' ? null : Math.min(30000, v) })
              }}
              className="tnum min-h-11 w-28 rounded-md bg-surface px-3 py-2 text-end text-body font-semibold placeholder:text-faint"
            />
          </NumberRow>
          <div className="mt-4 mb-2 text-callout text-muted">Reviews usually take</div>
          <div className="flex flex-wrap gap-2">
            {ANKI_REVIEW_CHOICES.map((m) => (
              <Chip key={m} check={false} selected={a.ankiReviewMinutes === m} onClick={() => update({ ankiReviewMinutes: a.ankiReviewMinutes === m ? null : m })}>
                {m === 60 ? '1 h' : `${m} min`}
              </Chip>
            ))}
          </div>
        </div>
      )}
      {a.resources.includes('slides') && !usesSubjects(a) && (
        <NumberRow
          label="Lectures you still need to study for this exam"
          unsure={a.lecturesLeft === null}
          onUnsure={() => update({ lecturesLeft: a.lecturesLeft === null ? LECTURES_LEFT_UNSURE : null })}
        >
          <Stepper label="lectures left" value={a.lecturesLeft ?? LECTURES_LEFT_UNSURE} min={0} max={60} onChange={(v) => update({ lecturesLeft: v })} />
        </NumberRow>
      )}
    </div>
  )
}

function NumberRow({ label, unsure, onUnsure, children, flush = false }: { label: string; unsure: boolean; onUnsure: () => void; children: ReactNode; flush?: boolean }) {
  return (
    <div className={flush ? '' : 'py-4'}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <span className="text-body font-medium">{label}</span>
        <span className={unsure ? 'opacity-50' : ''}>{children}</span>
      </div>
      <div className="mt-3">
        <Chip check={false} selected={unsure} onClick={onUnsure}>Not sure</Chip>
      </div>
    </div>
  )
}
