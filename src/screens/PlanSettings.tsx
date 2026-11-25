import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { addDays, ANKI_NEW_PER_DAY_UNSURE, type Goal } from '../engine'
import { ANKI_REVIEW_CHOICES, roughLabel } from '../data/templates'
import { duration, num } from '../lib/format'
import { useDemo } from '../store/demoStore'
import { Chip } from '../ui/Chip'
import { Sheet } from '../ui/Sheet'
import { Stepper } from '../ui/Stepper'
import { RestoreBackup, SaveBackup } from '../ui/Backup'

const MIN_DAY = 15
const MAX_DAY = 12 * 60

/**
 * "Your plan · Change" on the Week tab: the few answers from setup that change during the year
 * (an exam date comes out, a rotation is extended, evenings get busier). Each change re-plans Today at once.
 * Exams are added, removed and moved in place; the next rotation or block is one tap. Nothing logged is lost.
 * Only "Start over" (the last option) clears the plan.
 */

/**
 * A date field that keeps what is typed. It saves as soon as the date is a real future one (so the first try
 * saves), and puts the saved date back when the field is left with something that isn't.
 */
/** What kind of date this is, in one line: the student should never mistake an estimate for a real date. */
function dateNote(g: Goal): string {
  if (g.dateSource === 'projected') return 'No date yet · the date shown follows your pace.'
  if (g.dateSource === 'rough') return `Rough: ${roughLabel(g.examDate)}. Set the day once you book it.`
  return "Estimated. Set it once it's out."
}

function DateField({ value, min, label, today, onSave }: { value: string; min: string; label: string; today: string; onSave: (d: string) => void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const valid = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d > today
  return (
    <input
      type="date"
      value={draft}
      min={min}
      aria-label={label}
      onChange={(e) => {
        setDraft(e.target.value)
        if (valid(e.target.value) && e.target.value !== value) onSave(e.target.value)
      }}
      onBlur={() => !valid(draft) && setDraft(value)}
      className="tnum min-h-11 min-w-0 max-w-full rounded-md bg-surface px-3 text-body-sm text-fg"
    />
  )
}

/**
 * "Your plan · Change": opens the plan settings. On Week it's a settings line; on Today (`label` given) the
 * goals line itself opens them, so settings are one tap from either tab.
 */
export function PlanLine({ label, className }: { label?: ReactNode; className?: string } = {}) {
  const { plan, today, editPlan, reset, openFlow, removeExam } = useDemo()
  const [open, setOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const close = useCallback(() => { setOpen(false); setConfirmReset(false); setRemoving(null) }, [])
  const go = (f: 'exam' | 'next') => { close(); openFlow(f) }
  const p = plan!
  const goals = p.goals.filter((g) => g.examDate >= today)
  const rotation = p.rotation && p.rotation.until >= today ? p.rotation : null
  const tomorrow = addDays(today, 1)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`block min-h-11 py-2.5 text-start text-muted hover:opacity-70 active:opacity-60 ${className ?? 'text-callout'}`}>
        {label ?? <>Your plan: <span className="font-medium text-fg">{goals.map((g) => g.label).join(' + ') || 'no exam set'}</span></>}{' '}
        <span className="whitespace-nowrap text-accent">· Change</span>
      </button>
      {open && (
        <Sheet title="Your plan" onClose={close}>
          {goals.length > 0 && (
            <section className="pt-5">
              <h3 className="text-callout font-medium text-muted">Exam dates</h3>
              <ul className="mt-2 divide-y divide-line">
                {goals.map((g) => (
                  <li key={g.id} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                      <span className="text-body">
                        {g.label}
                        {g.dateSource !== 'set' && <span className="block text-subhead text-muted">{dateNote(g)}</span>}
                      </span>
                      <DateField value={g.examDate} min={tomorrow} today={today} label={`${g.label} date`} onSave={(d) => editPlan({ examDates: { [g.id]: d } })} />
                    </div>
                    {removing === g.id ? (
                      <div className="mt-1">
                        <p className="text-callout text-muted">Its fixes and retests go. What you studied stays.</p>
                        <div className="flex flex-wrap gap-x-4">
                          <button type="button" onClick={() => { removeExam(g.id); setRemoving(null) }} className="inline-flex min-h-11 items-center text-callout font-semibold text-accent hover:opacity-70 active:opacity-60">Remove {g.label}</button>
                          <button type="button" onClick={() => setRemoving(null)} className="inline-flex min-h-11 items-center text-callout font-medium text-muted hover:opacity-70 active:opacity-60">Keep it</button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setRemoving(g.id)} className="inline-flex min-h-11 items-center text-callout font-medium text-muted hover:opacity-70 active:opacity-60">Remove</button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {rotation && (
            <section className="pt-5">
              <h3 className="text-callout font-medium text-muted">{rotation.term === 'block' ? 'Block' : 'Rotation'}</h3>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
                <span className="text-body">{rotation.name} ends</span>
                <DateField value={rotation.until} min={tomorrow} today={today} label={`${rotation.name} ${rotation.term ?? 'rotation'} end`} onSave={(d) => editPlan({ rotationUntil: d })} />
              </div>
            </section>
          )}

          <section className="pt-5">
            <h3 className="text-callout font-medium text-muted">Study time a day</h3>
            <div className="mt-2 divide-y divide-line">
              {([['Weekdays', 'weekdayMinutes'], ['Weekends', 'weekendMinutes']] as const).map(([label, key]) => (
                <div key={key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
                  <span className="text-body">{label}</span>
                  <Stepper
                    label={`${label.toLowerCase()} study time`}
                    value={p.availability[key]}
                    min={MIN_DAY}
                    max={MAX_DAY}
                    step={15}
                    format={duration}
                    onChange={(n) => editPlan({ [key]: n })}
                  />
                </div>
              ))}
            </div>
          </section>

          {p.anki && <AnkiSettings />}

          <section className="pt-5">
            <h3 className="text-callout font-medium text-muted">Change the plan</h3>
            <div className="mt-1 flex flex-col items-start">
              <button type="button" onClick={() => go('exam')} className="inline-flex min-h-11 items-center text-body font-medium text-accent hover:opacity-70 active:opacity-60">Add an exam</button>
              <button type="button" onClick={() => go('next')} className="inline-flex min-h-11 items-center text-body font-medium text-accent hover:opacity-70 active:opacity-60">Next rotation or block</button>
            </div>
            <p className="text-subhead text-muted">Everything you've logged stays.</p>
          </section>

          <section className="border-t border-line pt-4 mt-6">
            <div className="flex flex-wrap gap-x-4">
              <SaveBackup />
              <RestoreBackup />
            </div>
            <p className="text-subhead text-muted">One file with your plan and everything you've logged. Keep it to move to another browser or phone.</p>
          </section>

          <section className="border-t border-line pt-4 pb-2 mt-6">
            {confirmReset ? (
              <>
                <p className="text-callout text-muted">Starting over clears the plan and everything you've logged. To change exams or start the next block, use the options above instead.</p>
                <div className="mt-1 flex flex-wrap gap-x-4">
                  <button type="button" onClick={reset} className="inline-flex min-h-11 items-center text-callout font-semibold text-accent hover:opacity-70 active:opacity-60">Set up again</button>
                  <button type="button" onClick={() => setConfirmReset(false)} className="inline-flex min-h-11 items-center text-callout font-medium text-muted hover:opacity-70 active:opacity-60">Keep my plan</button>
                </div>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmReset(true)} className="inline-flex min-h-11 items-center text-callout font-medium text-muted hover:opacity-70 active:opacity-60">
                Start over…
              </button>
            )}
          </section>
        </Sheet>
      )}
    </>
  )
}

/** Anki: the two numbers from setup, plus "Behind on reviews?" for a backlog (a week of longer reviews, no new cards). */
function AnkiSettings() {
  const { plan, today, editPlan } = useDemo()
  const anki = plan!.anki!
  const [text, setText] = useState(anki.newCardsUnsure ? '' : String(anki.newCardsLeft))
  const catching = !!anki.catchUpUntil && anki.catchUpUntil >= today
  const save = (v: string) => {
    const n = Number(v.replace(/\D/g, ''))
    // Emptied = "Not sure" again; anything else is their number.
    editPlan({ anki: { newCardsLeft: v.trim() === '' ? null : Math.min(30000, n) } })
  }
  return (
    <section className="pt-5">
      <h3 className="text-callout font-medium text-muted">Anki</h3>
      <div className="mt-2 divide-y divide-line">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
          <span className="text-body">
            New cards left
            {anki.newCardsUnsure && <span className="block text-subhead text-muted">Not sure: about {ANKI_NEW_PER_DAY_UNSURE} new cards a day</span>}
          </span>
          <input
            inputMode="numeric"
            aria-label="Anki new cards left"
            value={text ? num(Number(text.replace(/\D/g, '')) || 0) : ''}
            placeholder="Not sure"
            onChange={(e) => setText(e.target.value.replace(/\D/g, ''))}
            onBlur={() => save(text)}
            className="tnum min-h-11 w-28 rounded-md bg-surface px-3 py-2 text-end text-body font-semibold placeholder:text-faint"
          />
        </div>
        <div className="py-3">
          <div className="text-body">Reviews usually take</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {ANKI_REVIEW_CHOICES.map((m) => (
              <Chip key={m} check={false} selected={anki.reviewMinutes === m} onClick={() => editPlan({ anki: { reviewMinutes: m } })}>
                {m === 60 ? '1 h' : `${m} min`}
              </Chip>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
          <span className="text-body">
            {catching ? 'Catching up on reviews' : 'Behind on reviews?'}
            <span className="block text-subhead text-muted">{catching ? 'Longer reviews and no new cards until the pile is down.' : 'A week of longer reviews and no new cards.'}</span>
          </span>
          <button type="button" onClick={() => editPlan({ anki: { catchUp: !catching } })} className="inline-flex min-h-11 items-center text-callout font-medium text-accent hover:opacity-70 active:opacity-60">
            {catching ? 'Caught up' : 'Catch up'}
          </button>
        </div>
      </div>
    </section>
  )
}
