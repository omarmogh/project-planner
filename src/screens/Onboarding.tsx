import { ChevronLeft } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { DEMO_TODAY, linaState } from '../data/demo'
import {
  buildPlanState, defaultAnswers, defaultExamDate, goalChoices, goalLabel, resourceTotal, university, type Answers,
} from '../data/setup'
import {
  ANKI_REVIEW_CHOICES, RESOURCES, ROTATIONS, STAGES, UNIVERSITIES, WEEKDAYS_SHORT, type ResourceKey, type ResourceTemplate,
} from '../data/templates'
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

type StepId = 'stage' | 'university' | 'goals' | 'dates' | 'rotation' | 'resources' | 'amounts' | 'time' | 'calls' | 'anki'

/** Only ask what changes the plan; skip what doesn't apply. */
function stepsFor(a: Answers): StepId[] {
  const s: StepId[] = ['stage']
  if (a.stage !== 'graduated') s.push('university')
  s.push('goals', 'dates')
  if (a.stage === 'clinical') s.push('rotation')
  s.push('resources', 'amounts', 'time')
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
  const finish = (connected = ankiConnected) => startApp(buildPlanState(a), connected)
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
        newCards={a.amounts.anki ?? 0}
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
        const goals = has ? a.goals.filter((g) => g !== kind) : [...a.goals, kind]
        const examDates = { ...a.examDates }
        if (!has && !examDates[kind]) examDates[kind] = defaultExamDate(kind, a, today)
        update({ goals, examDates })
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

    case 'dates':
      title = a.goals.length > 1 ? 'When are your exams?' : 'When is your exam?'
      hint = 'Your best guess is fine. You can change it later.'
      body = (
        <div className="divide-y divide-line border-y border-line">
          {a.goals.map((kind) => {
            const date = a.examDates[kind] ?? ''
            const days = date ? daysBetween(today, date) : 0
            return (
              <label key={kind} className="flex min-h-16 items-center gap-4 py-2">
                <span className="flex-1">
                  <span className="block text-[17px] font-medium">{kind === 'uni' ? 'Next uni exam' : goalLabel(kind, a)}</span>
                  <span className={`block text-[14px] ${days > 0 ? 'text-muted' : 'text-weak'}`}>{days > 0 ? inDays(days) : 'Pick a future date'}</span>
                </span>
                <input
                  type="date"
                  value={date}
                  min={addDays(today, 1)}
                  onChange={(e) => update({ examDates: { ...a.examDates, [kind]: e.target.value } })}
                  className="tnum rounded-xl bg-surface px-3 text-[16px] text-fg"
                />
              </label>
            )
          })}
        </div>
      )
      canContinue = a.goals.every((k) => (a.examDates[k] ?? '') > today)
      break

    case 'rotation':
      title = 'Which rotation are you on?'
      hint = 'Your uni exam plan follows the rotation.'
      body = (
        <>
          <Wrap>
            {ROTATIONS.map((r) => (
              <Chip
                key={r.id}
                selected={a.rotation === r.id}
                onClick={() =>
                  update({ rotation: r.id, rotationUntil: a.rotationUntil ?? addDays(today, university(a.university).rotationWeeks * 7 - 21) })
                }
              >
                {r.name}
              </Chip>
            ))}
          </Wrap>
          {a.rotation && (
            <label className="anim-fade mt-8 flex min-h-16 items-center gap-4 border-y border-line py-2">
              <span className="flex-1 text-[17px] font-medium">Until when?</span>
              <input
                type="date"
                value={a.rotationUntil ?? ''}
                min={today}
                onChange={(e) => update({ rotationUntil: e.target.value })}
                className="tnum rounded-xl bg-surface px-3 text-[16px] text-fg"
              />
            </label>
          )}
        </>
      )
      canContinue = !!a.rotation && !!a.rotationUntil && a.rotationUntil >= today
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
              {r.key === 'bnb' ? 'Boards & Beyond' : r.name}
            </Chip>
          ))}
        </Wrap>
      )
      canContinue = a.resources.length > 0
      break
    }

    case 'amounts':
      title = 'Where are you with each?'
      hint = 'Rough numbers are fine.'
      body = (
        <div className="divide-y divide-line border-y border-line">
          {a.resources.map((key) => (
            <AmountRow key={key} t={RESOURCES.find((r) => r.key === key)!} a={a} update={update} />
          ))}
        </div>
      )
      break

    case 'time':
      title = 'How much time can you study?'
      hint = 'After hospital and lectures. Be honest — the plan fits what you give it.'
      body = (
        <>
          <div className="divide-y divide-line border-y border-line">
            {([['weekdayHours', 'Weekdays'], ['weekendHours', 'Weekend']] as const).map(([k, label]) => (
              <div key={k} className="flex min-h-18 items-center gap-4 py-3">
                <span className="flex-1 text-[17px] font-medium">{label}</span>
                <Stepper label={label} value={a[k]} min={0.5} max={12} step={0.5} format={(h) => duration(h * 60)} onChange={(v) => update({ [k]: v })} />
              </div>
            ))}
          </div>
          <p className="mt-8 mb-3 text-[15px] font-medium text-muted">Weekend days</p>
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
            <ChevronLeft size={26} className="rtl:-scale-x-100" />
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
        {i === 0 && <p className="mb-2 text-[15px] font-medium text-muted">Let's build your plan. About a minute.</p>}
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight">{title}</h1>
        {hint && <p className="mt-2 text-[16px] leading-relaxed text-muted">{hint}</p>}
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

function AmountRow({ t, a, update }: { t: ResourceTemplate; a: Answers; update: (p: Partial<Answers>) => void }) {
  const value = a.amounts[t.key] ?? t.defaultAmount
  const set = (v: number) => update({ amounts: { ...a.amounts, [t.key]: v } })
  const board = a.goals.find((g) => g !== 'uni')
  const input = t.input

  if (input.kind === 'done-total') {
    return (
      <div className="space-y-4 py-4">
        <div className="text-[17px] font-medium">Uni slides</div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[15px] text-muted">Lectures done</span>
          <Stepper label="lectures done" value={Math.min(value, a.slidesTotal)} max={a.slidesTotal} onChange={set} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[15px] text-muted">In this block</span>
          <Stepper label="lectures in total" value={a.slidesTotal} min={1} max={60} onChange={(v) => update({ slidesTotal: v, amounts: { ...a.amounts, slides: Math.min(value, v) } })} />
        </div>
      </div>
    )
  }

  if (input.kind === 'left') {
    const review = a.ankiReviewMinutes
    return (
      <div className="space-y-4 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[17px] font-medium">{input.label}</span>
          <input
            inputMode="numeric"
            aria-label={input.label}
            value={value === 0 ? '' : num(value)}
            placeholder="0"
            onChange={(e) => set(Math.min(input.max, Number(e.target.value.replace(/\D/g, '')) || 0))}
            className="tnum w-28 rounded-xl bg-surface px-3 py-2 text-end text-[17px] font-semibold"
          />
        </div>
        <div>
          <div className="mb-2 text-[15px] text-muted">Reviews usually take</div>
          <div className="flex flex-wrap gap-2">
            {ANKI_REVIEW_CHOICES.map((m) => (
              <Chip key={m} check={false} selected={review === m} onClick={() => update({ ankiReviewMinutes: m })}>
                {m === 60 ? '1 h' : `${m} min`}
              </Chip>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const total = input.kind === 'percent' ? 100 : resourceTotal(t, board ?? 'uni')
  const step = input.kind === 'percent' ? 5 : input.step
  const shown = input.kind === 'percent' ? `${value}%` : `${num(value)} of ${num(total)}`
  return (
    <div className="py-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[17px] font-medium">{input.label}</span>
        <span className="tnum text-[17px] font-semibold">{shown}</span>
      </div>
      <input
        type="range"
        min={0}
        max={total}
        step={step}
        value={value}
        aria-label={input.label}
        onChange={(e) => set(Number(e.target.value))}
        style={{ ['--fill' as string]: `${(value / total) * 100}%` }}
        className="mt-3"
      />
    </div>
  )
}
