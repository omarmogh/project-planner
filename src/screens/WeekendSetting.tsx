import { useCallback, useState } from 'react'
import { WEEKDAYS_SHORT } from '../data/templates'
import { weekendLabel } from '../data/weekends'
import { useDemo } from '../store/demoStore'
import { Chip } from '../ui/Chip'
import { Sheet } from '../ui/Sheet'

/**
 * "Weekend: Fri–Sat · Change". Today shows it on the first day, so a wrong guess from the country is caught at once;
 * the Week tab keeps it, so it can be changed any time after that.
 */
export function WeekendLine() {
  const { plan, setWeekend } = useDemo()
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const days = plan!.availability.weekendDays
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="mt-1 inline-flex min-h-11 items-center gap-1 text-callout text-muted active:opacity-60">
        Weekend: <span className="font-medium text-fg">{weekendLabel(days)}</span>
        <span className="text-accent">· Change</span>
      </button>
      {open && (
        <Sheet title="Weekend days" onClose={close}>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS_SHORT.map((d, dow) => (
              <Chip key={d} check={false} selected={days.includes(dow)} onClick={() => setWeekend(days.includes(dow) ? days.filter((x) => x !== dow) : [...days, dow])}>
                <span className="inline-block min-w-8 text-center">{d}</span>
              </Chip>
            ))}
          </div>
          <p className="mt-4 text-callout text-muted">Weekend days use your weekend hours.</p>
        </Sheet>
      )}
    </>
  )
}
