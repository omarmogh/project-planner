import { useCallback, useState } from 'react'
import { addDays } from '../engine'
import { duration } from '../lib/format'
import { useDemo } from '../store/demoStore'
import { Sheet } from '../ui/Sheet'
import { Stepper } from '../ui/Stepper'

const MIN_DAY = 15
const MAX_DAY = 12 * 60

/**
 * "Your plan · Change" on the Week tab: the few answers from setup that change during the year
 * (an exam date comes out, a rotation is extended, evenings get busier). Each change re-plans Today at once.
 * Adding or removing a goal means setting up again, kept one step away because it starts the plan over.
 */
export function PlanLine() {
  const { plan, today, editPlan, reset } = useDemo()
  const [open, setOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const close = useCallback(() => { setOpen(false); setConfirmReset(false) }, [])
  const p = plan!
  const goals = p.goals.filter((g) => g.examDate >= today)
  const rotation = p.rotation && p.rotation.until >= today ? p.rotation : null
  const tomorrow = addDays(today, 1)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-11 items-center gap-1 text-start text-callout text-muted active:opacity-60">
        Your plan: <span className="font-medium text-fg">{goals.map((g) => g.label).join(' + ') || 'no exam set'}</span>
        <span className="text-accent">· Change</span>
      </button>
      {open && (
        <Sheet title="Your plan" onClose={close}>
          {goals.length > 0 && (
            <section className="pt-5">
              <h3 className="text-callout font-medium text-muted">Exam dates</h3>
              <ul className="mt-2 divide-y divide-line">
                {goals.map((g) => (
                  <li key={g.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
                    <span className="text-body">
                      {g.label}
                      {g.dateSource !== 'set' && <span className="block text-subhead text-muted">Estimated. Set it once it's out.</span>}
                    </span>
                    <input
                      type="date"
                      value={g.examDate}
                      min={tomorrow}
                      aria-label={`${g.label} date`}
                      onChange={(e) => e.target.value > today && editPlan({ examDates: { [g.id]: e.target.value } })}
                      className="tnum min-h-11 min-w-0 max-w-full rounded-md bg-surface px-3 text-body-sm text-fg"
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {rotation && (
            <section className="pt-5">
              <h3 className="text-callout font-medium text-muted">Rotation</h3>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
                <span className="text-body">{rotation.name} ends</span>
                <input
                  type="date"
                  value={rotation.until}
                  min={tomorrow}
                  aria-label={`${rotation.name} rotation end`}
                  onChange={(e) => e.target.value > today && editPlan({ rotationUntil: e.target.value })}
                  className="tnum min-h-11 min-w-0 max-w-full rounded-md bg-surface px-3 text-body-sm text-fg"
                />
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

          <section className="border-t border-line pt-4 pb-2 mt-6">
            {confirmReset ? (
              <>
                <p className="text-callout text-muted">Setting up again starts a new plan. What you've logged so far is cleared.</p>
                <div className="mt-1 flex flex-wrap gap-x-4">
                  <button type="button" onClick={reset} className="inline-flex min-h-11 items-center text-callout font-semibold text-accent active:opacity-60">Set up again</button>
                  <button type="button" onClick={() => setConfirmReset(false)} className="inline-flex min-h-11 items-center text-callout font-medium text-muted active:opacity-60">Keep my plan</button>
                </div>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmReset(true)} className="inline-flex min-h-11 items-center text-callout font-medium text-muted active:opacity-60">
                Add or remove an exam…
              </button>
            )}
          </section>
        </Sheet>
      )}
    </>
  )
}
