import { useId, useState } from 'react'
import { parseUworldReport } from '../data/uworldImport'
import { SYSTEMS } from '../data/topics'
import { WEAK_BELOW, type SystemResult } from '../engine'
import { num } from '../lib/format'
import { Button } from './Button'
import { Chip } from './Chip'

type Mode = 'choose' | 'paste' | 'preview' | 'manual' | 'done'

/** One manual row while typing: empty strings = not filled. */
type Draft = Record<string, { used: string; pct: string }>

const toDraft = (rows: SystemResult[]): Draft =>
  Object.fromEntries(rows.map((r) => [r.system, { used: String(r.used), pct: r.pct === null ? '' : String(r.pct) }]))

const fromDraft = (d: Draft): SystemResult[] =>
  SYSTEMS.flatMap(({ id }) => {
    const row = d[id]
    const used = Number(row?.used || 0)
    if (!row || used <= 0) return []
    return [{ system: id, used, pct: row.pct === '' ? null : Math.min(100, Number(row.pct)) }]
  })

const digits = (v: string, max: number) => {
  const d = v.replace(/\D/g, '')
  return d === '' ? '' : String(Math.min(max, Number(d)))
}

/**
 * Bring in UWorld results: paste the "performance by system" report (preview → Confirm / Fix),
 * or type questions used and % correct per system. Skipping lives with the caller.
 */
export function UworldImport({ value, onChange }: { value: SystemResult[]; onChange: (rows: SystemResult[]) => void }) {
  const [mode, setMode] = useState<Mode>(value.length ? 'done' : 'choose')
  const [text, setText] = useState('')
  const [found, setFound] = useState<SystemResult[] | null>(null)
  const [draft, setDraft] = useState<Draft>(() => toDraft(value))
  const pasteId = useId()

  const confirm = (rows: SystemResult[]) => {
    onChange(rows)
    setMode(rows.length ? 'done' : 'choose')
  }

  if (mode === 'choose') {
    return (
      <div className="flex flex-col gap-2.5">
        <Chip block check={false} selected={false} onClick={() => setMode('paste')} hint="Copy the Performance by system page and paste it here">
          Paste my report
        </Chip>
        <Chip block check={false} selected={false} onClick={() => setMode('manual')} hint="Questions used and % correct, any systems you know">
          Type the numbers
        </Chip>
      </div>
    )
  }

  if (mode === 'paste') {
    const read = () => {
      const rows = parseUworldReport(text)
      setFound(rows)
      if (rows.length) setMode('preview')
    }
    return (
      <div>
        <label htmlFor={pasteId} className="mb-2 block text-callout font-medium text-muted">
          In UWorld: Performance → Reports → by system, for all time. Select all, copy, paste. It counts as your history until your own blocks add up.
        </label>
        <textarea
          id={pasteId}
          value={text}
          onChange={(e) => { setText(e.target.value); setFound(null) }}
          rows={7}
          placeholder={'Cardiovascular System\nUsage 120/254\nCorrect Q 62 (52%)\n…'}
          className="block w-full resize-y rounded-md border border-line bg-surface p-3 text-body-sm text-fg placeholder:text-faint"
        />
        {found && !found.length && (
          <p role="status" className="mt-3 text-subhead text-muted">
            We couldn't find any systems in that text. Try copying the whole page, or type the numbers instead.
          </p>
        )}
        <div className="mt-4 flex flex-col gap-1">
          <Button variant="secondary" onClick={read} disabled={!text.trim()}>Read my results</Button>
          <Button variant="plain" onClick={() => setMode('manual')}>Type the numbers instead</Button>
        </div>
      </div>
    )
  }

  if (mode === 'preview' && found) {
    return (
      <div>
        <p className="mb-2 text-callout font-medium text-muted">We found:</p>
        <ResultTable rows={found} />
        <div className="mt-4 flex flex-col gap-1">
          <Button variant="secondary" onClick={() => confirm(found)}>Confirm</Button>
          <Button variant="plain" onClick={() => { setDraft(toDraft(found)); setMode('manual') }}>Fix</Button>
        </div>
      </div>
    )
  }

  if (mode === 'manual') {
    const set = (system: string, key: 'used' | 'pct', v: string) =>
      setDraft((d) => ({ ...d, [system]: { used: d[system]?.used ?? '', pct: d[system]?.pct ?? '', [key]: digits(v, key === 'pct' ? 100 : 9999) } }))
    const rows = fromDraft(draft)
    return (
      <div>
        <p className="mb-2 text-callout text-muted">Fill only the systems you know.</p>
        <div className="flex items-end gap-2 border-b border-line pb-2 text-footnote font-medium text-muted">
          <span className="flex-1">System</span>
          <span className="w-20 text-end">Questions used</span>
          <span className="w-16 text-end">% correct</span>
        </div>
        <div className="divide-y divide-line">
          {SYSTEMS.map(({ id }) => (
            <div key={id} className="flex min-h-13 items-center gap-2 py-1.5">
              <span className="min-w-0 flex-1 truncate text-body-sm font-medium">{id}</span>
              <input
                inputMode="numeric"
                aria-label={`${id} questions used`}
                value={draft[id]?.used ?? ''}
                placeholder="—"
                onChange={(e) => set(id, 'used', e.target.value)}
                className="tnum min-h-11 w-20 rounded-md bg-surface px-2 text-end text-body-sm placeholder:text-faint"
              />
              <input
                inputMode="numeric"
                aria-label={`${id} percent correct`}
                value={draft[id]?.pct ?? ''}
                placeholder="—"
                onChange={(e) => set(id, 'pct', e.target.value)}
                className="tnum min-h-11 w-16 rounded-md bg-surface px-2 text-end text-body-sm placeholder:text-faint"
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-1">
          <Button variant="secondary" onClick={() => confirm(rows)} disabled={!rows.length && !value.length}>
            {rows.length || !value.length ? 'Use these numbers' : 'Remove my results'}
          </Button>
        </div>
      </div>
    )
  }

  // done
  const total = value.reduce((n, r) => n + r.used, 0)
  const weakest = value.filter((r) => r.pct !== null && r.pct < WEAK_BELOW).sort((x, y) => x.pct! - y.pct!)[0]
  return (
    <div>
      <p className="text-body font-medium">
        {value.length} {value.length === 1 ? 'system' : 'systems'}, {num(total)} questions
      </p>
      <p className="mt-1 text-subhead text-muted">
        {weakest ? `${weakest.system} (${weakest.pct}%) gets a fix first.` : 'Your plan starts from these numbers.'}
      </p>
      <div className="mt-4">
        <ResultTable rows={value} />
      </div>
      <div className="mt-2">
        <Button variant="plain" onClick={() => { setDraft(toDraft(value)); setMode('manual') }}>Change</Button>
      </div>
    </div>
  )
}

function ResultTable({ rows }: { rows: SystemResult[] }) {
  return (
    <table className="w-full text-body-sm">
      <thead className="sr-only">
        <tr><th>System</th><th>Questions used</th><th>% correct</th></tr>
      </thead>
      <tbody className="divide-y divide-line border-y border-line">
        {rows.map((r) => (
          <tr key={r.system}>
            <td className="py-2.5 font-medium">{r.system}</td>
            <td className="tnum py-2.5 text-end text-muted">{num(r.used)} used</td>
            <td className={`tnum w-28 py-2.5 text-end font-medium ${r.pct === null ? 'text-faint' : r.pct < WEAK_BELOW ? 'text-weak' : ''}`}>
              {r.pct === null ? 'no %' : `${r.pct}% correct`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
