import { ChevronLeft } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { DEMO_TODAY, linaState } from '../data/demo'
import {
  buildPlanState, defaultAnswers, goalChoices, goalLabel, plansByTopic, rotationEnd, type Answers, type DateAnswer,
} from '../data/setup'
import {
  ANKI_REVIEW_CHOICES, LECTURES_LEFT_UNSURE, MINOR_ROTATIONS, RESOURCES, ROTATIONS, STAGES, UNIVERSITIES, UWORLD_TOTAL,
  UWORLD_TOTAL_DEFAULT, WEEKDAYS_SHORT, roughYear, type ResourceKey, type RoughWhen,
} from '../data/templates'
import { SYSTEMS } from '../data/topics'
import { addDays, daysBetween, inDays, type GoalKind } from '../engine'
import { isEnabled } from '../lib/features'
import { duration, num } from '../lib/format'
import { useDemo } from '../store/demoStore'
import { Button } from '../ui/Button'
import { Chip } from '../ui/Chip'
import { Page } from '../ui/Page'
import { ProgressBar } from '../ui/ProgressBar'
import { Stepper } from '../ui/Stepper'
import { AnkiConnect } from './AnkiConnect'

type StepId =
  | 'stage' | 'university' | 'goals' | 'rotation' | `date-${GoalKind}`
  | 'resources' | 'numbers' | 'systemsNow' | 'systemsDone' | 'time' | 'calls' | 'anki'

/** Only ask what changes the plan; skip what doesn't apply. */
function stepsFor(a: Answers): StepId[] {
  const s: StepId[] = ['stage']
  if (a.stage !== 'graduated') s.push('university')
  s.push('goals')
  if (a.stage === 'clinical') s.push('rotation')
  for (const g of a.goals) s.push(`date-${g}`)
  s.push('resources')
  if (a.resources.some((r) => r === 'uworld' || r === 'anki' || r === 'slides')) s.push('numbers')
  if (plansByTopic(a)) s.push('systemsNow', 'systemsDone')
  s.push('time')
  if (a.stage === 'clinical') s.push('calls')
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
  /** Single-choice questions advance on tap, after a beat so the selection is seen. */
  const pick = (patch: Partial<Answers>) => {
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
  let multi = true

  const setDate = (kind: GoalKind, d: DateAnswer | undefined) => update({ dates: { ...a.dates, [kind]: d } })

  if (step.startsWith('date-')) {
    const kind = step.slice(5) as GoalKind
    const label = goalLabel(kind, a)
    const ans = a.dates[kind]
    if (kind === 'uni') {
      title = `When is your ${label}?`
      hint = a.stage === 'clinical' ? "Not out yet? We'll plan for the end of your rotation and ask again later." : "Not out yet? We'll plan with a usual date and ask again later."
      body = (
        <>
          <DateRow
            label={label}
            today={today}
            value={ans?.kind === 'date' ? ans.date : ''}
            onChange={(date) => setDate(kind, { kind: 'date', date })}
          />
          <div className="mt-4">
            <Chip selected={ans?.kind === 'unknown'} onClick={() => setDate(kind, { kind: 'unknown' })}>Don't know yet</Chip>
          </div>
        </>
      )
      canContinue = ans?.kind === 'unknown' || (ans?.kind === 'date' && ans.date > today)
    } else {
      const year = roughYear(today)
      const booked = ans?.kind === 'date'
      const notYet = ans?.kind === 'rough' || ans?.kind === 'unknown'
      title = `Have you booked ${label}?`
      body = (
        <>
          <Wrap>
            <Chip selected={booked} onClick={() => setDate(kind, { kind: 'date', date: ans?.kind === 'date' ? ans.date : '' })}>Yes</Chip>
            <Chip selected={notYet} onClick={() => setDate(kind, { kind: 'unknown' })}>Not yet</Chip>
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
                {(['early', 'mid', 'late'] as RoughWhen[]).map((w) => (
                  <Chip key={w} selected={ans?.kind === 'rough' && ans.when === w} onClick={() => setDate(kind, { kind: 'rough', when: w })}>
                    {w === 'early' ? 'Early' : w === 'mid' ? 'Mid' : 'Late'} {year}
                  </Chip>
                ))}
                <Chip selected={ans?.kind === 'unknown'} onClick={() => setDate(kind, { kind: 'unknown' })}>No idea</Chip>
              </Wrap>
              {ans?.kind === 'unknown' && (
                <p className="anim-fade mt-4 text-callout text-muted">We'll work out when you'd be ready at your pace.</p>
              )}
            </div>
          )}
        </>
      )
      canContinue = notYet || (booked && ans.date > today)
    }
  } else {
    switch (step) {
      case 'stage':
        title = 'Where are you in med school?'
        multi = false
        body = (
          <Choices>
            {STAGES.map((s) => (
              <Chip key={s.id} block hint={s.hint} selected={chosen('stage') && a.stage === s.id} onClick={() => pick({ stage: s.id })}>
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
          <Choices>
            {UNIVERSITIES.map((u) => (
              <Chip key={u.id} block selected={chosen('university') && a.university === u.id} onClick={() => pick({ university: u.id })}>
                {u.name}
              </Chip>
            ))}
          </Choices>
        )
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
        break
      }

      case 'rotation':
        title = 'Which rotation are you on?'
        hint = 'Your uni exam plan follows the rotation.'
        body = <RotationStep a={a} update={update} today={today} />
        canContinue = (!!a.rotation || !!a.rotationCustom?.trim()) && (a.rotationUntil === undefined || a.rotationUntil >= today)
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
            {RESOURCES.filter((r) => r.key !== 'slides' || a.goals.includes('uni')).map((r) => (
              <Chip key={r.key} selected={a.resources.includes(r.key)} onClick={() => toggle(r.key)}>
                {r.label ?? r.name}
              </Chip>
            ))}
          </Wrap>
        )
        canContinue = a.resources.length > 0
        break
      }

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
          update({ systemsNow: now, systemsDone: a.systemsDone.filter((x) => !now.includes(x)) })
        }
        body = (
          <Wrap>
            {SYSTEMS.map((x) => (
              <Chip key={x.id} selected={a.systemsNow.includes(x.id)} onClick={() => toggle(x.id)}>{x.id}</Chip>
            ))}
            <Chip selected={a.systemsNow.length === 0} onClick={() => update({ systemsNow: [] })}>Not sure</Chip>
          </Wrap>
        )
        break
      }

      case 'systemsDone': {
        title = 'Any systems already done?'
        hint = 'Studied at least once. The plan starts from what\'s left.'
        const toggle = (id: string) =>
          update({ systemsDone: a.systemsDone.includes(id) ? a.systemsDone.filter((x) => x !== id) : [...a.systemsDone, id] })
        body = (
          <Wrap>
            {SYSTEMS.filter((x) => !a.systemsNow.includes(x.id)).map((x) => (
              <Chip key={x.id} selected={a.systemsDone.includes(x.id)} onClick={() => toggle(x.id)}>{x.id}</Chip>
            ))}
            <Chip selected={a.systemsDone.length === 0} onClick={() => update({ systemsDone: [] })}>None yet</Chip>
          </Wrap>
        )
        break
      }

      case 'time':
        title = 'How much time can you study?'
        hint = 'After hospital and lectures. Be honest — the plan fits what you give it.'
        body = (
          <>
            <div className="divide-y divide-line border-y border-line">
              {([['weekdayHours', 'Weekdays'], ['weekendHours', 'Weekend']] as const).map(([k, label]) => (
                <div key={k} className="flex min-h-18 flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <span className="flex-1 text-body font-medium">{label}</span>
                  <Stepper label={label} value={a[k]} min={0.5} max={12} step={0.5} format={(h) => duration(h * 60)} onChange={(v) => update({ [k]: v })} />
                </div>
              ))}
            </div>
            <p className="mt-8 mb-3 text-callout font-medium text-muted">Weekend days</p>
            <Wrap>
              {WEEKDAYS_SHORT.map((d, dow) => (
                <Chip
                  key={d}
                  check={false}
                  selected={a.weekendDays.includes(dow)}
                  onClick={() =>
                    update({ weekendDays: a.weekendDays.includes(dow) ? a.weekendDays.filter((x) => x !== dow) : [...a.weekendDays, dow].sort() })
                  }
                >
                  <span className="inline-block min-w-8 text-center">{d}</span>
                </Chip>
              ))}
            </Wrap>
          </>
        )
        break

      case 'calls':
        title = 'Which days are you on call?'
        hint = 'The day after a call gets a lighter plan. No calls? Just continue.'
        body = (
          <Wrap>
            {WEEKDAYS_SHORT.map((d, dow) => (
              <Chip
                key={d}
                check={false}
                selected={a.callDays.includes(dow)}
                onClick={() => update({ callDays: a.callDays.includes(dow) ? a.callDays.filter((x) => x !== dow) : [...a.callDays, dow] })}
              >
                <span className="inline-block min-w-8 text-center">{d}</span>
              </Chip>
            ))}
          </Wrap>
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
          <Button onClick={next} disabled={!canContinue}>{isLast ? 'Build my plan' : 'Continue'}</Button>
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

/** Majors as chips; "Minor rotation" opens the minors; "Type your own" opens a text field. */
function RotationStep({ a, update, today }: { a: Answers; update: (p: Partial<Answers>) => void; today: string }) {
  const isMinor = MINOR_ROTATIONS.some((r) => r.id === a.rotation)
  const [minor, setMinor] = useState(isMinor)
  const [typing, setTyping] = useState(!!a.rotationCustom)
  const choose = (id: string) => {
    update({ rotation: id, rotationCustom: undefined })
    setTyping(false)
  }
  const any = !!a.rotation || !!a.rotationCustom?.trim()
  return (
    <>
      <Wrap>
        {ROTATIONS.map((r) => (
          <Chip key={r.id} selected={a.rotation === r.id} onClick={() => { choose(r.id); setMinor(false) }}>{r.name}</Chip>
        ))}
        <Chip selected={minor || isMinor} onClick={() => { setMinor(true); setTyping(false) }}>Minor rotation</Chip>
        <Chip selected={typing} onClick={() => { setTyping(true); setMinor(false); update({ rotation: undefined }) }}>Type your own</Chip>
      </Wrap>
      {minor && (
        <div className="anim-fade mt-6">
          <p className="mb-3 text-callout font-medium text-muted">Which one?</p>
          <Wrap>
            {MINOR_ROTATIONS.map((r) => (
              <Chip key={r.id} selected={a.rotation === r.id} onClick={() => choose(r.id)}>{r.name}</Chip>
            ))}
          </Wrap>
        </div>
      )}
      {typing && (
        <label className="anim-fade mt-6 block">
          <span className="mb-2 block text-callout font-medium text-muted">Rotation name</span>
          <input
            autoFocus
            value={a.rotationCustom ?? ''}
            onChange={(e) => update({ rotationCustom: e.target.value.slice(0, 30) })}
            placeholder="e.g. Neurosurgery"
            className="min-h-11 w-full rounded-md bg-surface px-3 py-2 text-body"
          />
        </label>
      )}
      {any && (
        <div className="anim-fade mt-8">
          <div className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 border-y border-line py-2">
            <span className="flex-1 text-body font-medium">Until when?</span>
            <input
              type="date"
              value={a.rotationUntil ?? ''}
              min={today}
              aria-label="Rotation ends"
              onChange={(e) => update({ rotationUntil: e.target.value || undefined })}
              className="tnum min-w-0 max-w-full rounded-md bg-surface px-3 text-body-sm text-fg"
            />
          </div>
          <div className="mt-4">
            <Chip selected={a.rotationUntil === undefined} onClick={() => update({ rotationUntil: undefined })}>Not sure</Chip>
          </div>
          {a.rotationUntil === undefined && (
            <p className="mt-3 text-callout text-muted">We'll plan for {inDays(daysBetween(today, rotationEnd(a, today)))}, a usual rotation.</p>
          )}
        </div>
      )}
    </>
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
          onUnsure={() => update({ uworldDone: null })}
        >
          <Stepper label="UWorld questions done" value={a.uworldDone ?? 0} min={0} max={uworldTotal} step={50} format={num} onChange={(v) => update({ uworldDone: v })} />
        </NumberRow>
      )}
      {a.resources.includes('anki') && (
        <div className="py-4">
          <NumberRow label="Anki new cards left" unsure={a.ankiNewLeft === null} onUnsure={() => update({ ankiNewLeft: null })} flush>
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
              <Chip key={m} check={false} selected={a.ankiReviewMinutes === m} onClick={() => update({ ankiReviewMinutes: m })}>
                {m === 60 ? '1 h' : `${m} min`}
              </Chip>
            ))}
          </div>
        </div>
      )}
      {a.resources.includes('slides') && (
        <NumberRow
          label="Lectures you still need to study for this exam"
          unsure={a.lecturesLeft === null}
          onUnsure={() => update({ lecturesLeft: null })}
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
