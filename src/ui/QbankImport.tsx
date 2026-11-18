import { useId, useRef, useState } from 'react'
import { parseQbankResults, type QbankParse } from '../data/qbankImport'
import { SYSTEMS } from '../data/topics'
import { WEAK_BELOW, type SystemResult } from '../engine'
import { num } from '../lib/format'
import { Button } from './Button'
import { Chip } from './Chip'

type Mode = 'choose' | 'paste' | 'preview' | 'manual' | 'done'

/** One manual row while typing: empty strings = not filled. Keyed by subject name. */
type Draft = Record<string, { used: string; pct: string }>

const toDraft = (rows: SystemResult[]): Draft =>
  Object.fromEntries(rows.map((r) => [r.system, { used: String(r.used), pct: r.pct === null ? '' : String(r.pct) }]))

const fromDraft = (d: Draft): SystemResult[] =>
  Object.entries(d).flatMap(([system, row]) => {
    const used = Number(row.used || 0)
    if (used <= 0) return []
    return [{ system, used, pct: row.pct === '' ? null : Math.min(100, Number(row.pct)) }]
  })

const digits = (v: string, max: number) => {
  const d = v.replace(/\D/g, '')
  return d === '' ? '' : String(Math.min(max, Number(d)))
}

/** Biggest file we read: a results export is a few KB; this just stops a wrong pick. */
const MAX_FILE_BYTES = 1_000_000

export interface QbankImportProps {
  value: SystemResult[]
  onChange: (rows: SystemResult[]) => void
  /** Questions in the bank; "That's more than..." shows when the import exceeds it. Omit when unknown. */
  bank?: number
  /** The bank's name from the plan ("UWorld", "QBank"). Anything but UWorld gets neutral wording. */
  bankName?: string
  /** A uni past-paper results table instead of a question bank. */
  papers?: boolean
  /** Rows offered when typing by hand: subject names (a uni goal's subjects). Default: our Step 1 systems. */
  subjects?: string[]
}

/**
 * Bring in results from any question bank or past-paper table: paste text or pick a CSV / TSV / TXT file,
 * check the preview, confirm. Or type numbers per subject. Everything is read in the browser.
 * Skipping lives with the caller.
 */
export function QbankImport({ value, onChange, bank, bankName, papers, subjects }: QbankImportProps) {
  const [mode, setMode] = useState<Mode>(value.length ? 'done' : 'choose')
  const [text, setText] = useState('')
  const [found, setFound] = useState<QbankParse | null>(null)
  const [fileNote, setFileNote] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(() => toDraft(value))
  const [extra, setExtra] = useState('')
  const pasteId = useId()
  const fileRef = useRef<HTMLInputElement>(null)

  const isUworld = !papers && /uworld/i.test(bankName ?? '')
  const noun = papers ? 'past-paper results' : isUworld ? 'UWorld results' : 'question-bank results'
  const unit = 'questions'
  const sheet = papers ? 'subject' : 'system'
  const names = subjects?.length ? subjects : SYSTEMS.map((s) => s.id)

  const confirm = (rows: SystemResult[]) => {
    onChange(rows)
    setMode(rows.length ? 'done' : 'choose')
  }

  const read = (raw: string) => {
    const res = parseQbankResults(raw)
    setFound(res)
    if (res.rows.length) setMode('preview')
    else setMode('paste')
  }

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      setFileNote('That file is too big to be a results table. Try copying the table and pasting it.')
      setMode('paste')
      return
    }
    try {
      const raw = await file.text()
      setText(raw)
      setFileNote(null)
      read(raw)
    } catch {
      setFileNote("We couldn't open that file. Try copying the table and pasting it.")
      setMode('paste')
    }
  }

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
      className="sr-only"
      tabIndex={-1}
      aria-label="Choose a results file"
      onChange={(e) => {
        void pickFile(e.target.files?.[0])
        e.target.value = ''
      }}
    />
  )

  if (mode === 'choose') {
    return (
      <div className="flex flex-col gap-2.5">
        {fileInput}
        <Chip block check={false} selected={false} onClick={() => setMode('paste')} hint={`Copy the table from your ${papers ? 'results' : 'bank'} and paste it here`}>
          Paste my results
        </Chip>
        <Chip block check={false} selected={false} onClick={() => fileRef.current?.click()} hint="A CSV, TSV or text file, read on your device only">
          Choose a file
        </Chip>
        <Chip block check={false} selected={false} onClick={() => setMode('manual')} hint={`Questions and % correct, any ${sheet}s you know`}>
          Type the numbers
        </Chip>
      </div>
    )
  }

  if (mode === 'paste') {
    return (
      <div>
        {fileInput}
        <label htmlFor={pasteId} className="mb-2 block text-callout font-medium text-muted">
          {isUworld
            ? 'In UWorld: Performance → Reports → by system, for all time. Select all, copy, paste.'
            : `Paste your ${noun}. Any table works: a name and either correct out of total or a percent, or lines like "Cardio 12/20".`}{' '}
          It counts as your history until your own blocks add up.
        </label>
        <textarea
          id={pasteId}
          value={text}
          onChange={(e) => { setText(e.target.value); setFound(null); setFileNote(null) }}
          rows={7}
          placeholder={papers ? 'Anatomy\t14/20\nPhysiology\t11/20\nBiochemistry\t9/20' : 'Cardio\t12/20\nRenal\t15/25\nPulmonary\t60%'}
          className="block w-full resize-y rounded-md border border-line bg-surface p-3 text-body-sm text-fg placeholder:text-faint"
        />
        {(fileNote || (found && !found.rows.length)) && (
          <p role="status" className="mt-3 text-subhead text-muted">
            {fileNote ?? found?.message}
          </p>
        )}
        <div className="mt-4 flex flex-col gap-1">
          <Button variant="secondary" onClick={() => read(text)} disabled={!text.trim()}>Read my results</Button>
          <Button variant="plain" onClick={() => fileRef.current?.click()}>Choose a file instead</Button>
          <Button variant="plain" onClick={() => setMode('manual')}>Type the numbers instead</Button>
        </div>
      </div>
    )
  }

  if (mode === 'preview' && found) {
    const hint: string[] = []
    if (found.custom.length) hint.push(`${found.custom.join(', ')} ${found.custom.length === 1 ? 'is' : 'are'} kept under ${found.custom.length === 1 ? 'its' : 'their'} own name.`)
    if (found.assumedCounts) hint.push('Where there was only a %, we counted a short block of 20 questions.')
    if (found.skipped) hint.push(`${found.skipped} ${found.skipped === 1 ? 'line' : 'lines'} we couldn't read ${found.skipped === 1 ? 'was' : 'were'} left out.`)
    return (
      <div>
        <p className="mb-2 text-callout font-medium text-muted">We found:</p>
        <ResultTable rows={found.rows} sheet={sheet} />
        {hint.length > 0 && <p className="mt-3 text-subhead text-muted">{hint.join(' ')}</p>}
        <div className="mt-4 flex flex-col gap-1">
          <Button variant="secondary" onClick={() => confirm(found.rows)}>Confirm</Button>
          <Button variant="plain" onClick={() => { setDraft(toDraft(found.rows)); setMode('manual') }}>Fix</Button>
          <Button variant="plain" onClick={() => setMode('paste')}>Paste something else</Button>
        </div>
      </div>
    )
  }

  if (mode === 'manual') {
    const set = (name: string, key: 'used' | 'pct', v: string) =>
      setDraft((d) => ({ ...d, [name]: { used: d[name]?.used ?? '', pct: d[name]?.pct ?? '', [key]: digits(v, key === 'pct' ? 100 : 9999) } }))
    const rows = fromDraft(draft)
    const shown = [...names, ...Object.keys(draft).filter((k) => !names.includes(k))]
    const addExtra = () => {
      const n = extra.replace(/\s+/g, ' ').trim().slice(0, 40)
      if (!n) return
      setDraft((d) => (d[n] ? d : { ...d, [n]: { used: '', pct: '' } }))
      setExtra('')
    }
    return (
      <div>
        <p className="mb-2 text-callout text-muted">Fill only the {sheet}s you know.</p>
        <div className="flex items-end gap-2 border-b border-line pb-2 text-footnote font-medium text-muted">
          <span className="flex-1">{papers ? 'Subject' : 'System'}</span>
          <span className="w-20 text-end">Questions</span>
          <span className="w-16 text-end">% correct</span>
        </div>
        <div className="divide-y divide-line">
          {shown.map((id) => (
            <div key={id} className="flex min-h-13 items-center gap-2 py-1.5">
              <span className="min-w-0 flex-1 truncate text-body-sm font-medium">{id}</span>
              <input
                inputMode="numeric"
                aria-label={`${id} ${unit}`}
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
        <div className="mt-2 flex items-center gap-2">
          <input
            value={extra}
            aria-label={`Add another ${sheet}`}
            placeholder={`Another ${sheet}`}
            onChange={(e) => setExtra(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExtra() } }}
            className="min-h-11 min-w-0 flex-1 rounded-md bg-surface px-3 text-body-sm placeholder:text-faint"
          />
          <Button variant="plain" onClick={addExtra} disabled={!extra.trim()}>Add</Button>
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
  const label = papers ? 'subject' : 'system'
  return (
    <div>
      {fileInput}
      <p className="text-body font-medium">
        {value.length} {value.length === 1 ? label : `${label}s`}, {num(total)} questions
      </p>
      <p className="mt-1 text-subhead text-muted">
        {weakest ? `${weakest.system} (${weakest.pct}%) gets a fix first.` : 'Your plan starts from these numbers.'}
      </p>
      {bank !== undefined && total > bank && (
        <p className="mt-1 text-subhead text-muted">
          That's more than the {num(bank)} in {isUworld ? 'UWorld' : 'your bank'}, likely from a reset. Next, say how many you've done this time through.
        </p>
      )}
      <div className="mt-4">
        <ResultTable rows={value} sheet={label} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <Button variant="plain" onClick={() => { setText(''); setFound(null); setMode('paste') }}>Paste new results</Button>
        <Button variant="plain" onClick={() => { setDraft(toDraft(value)); setMode('manual') }}>Change</Button>
      </div>
    </div>
  )
}

function ResultTable({ rows, sheet }: { rows: SystemResult[]; sheet: string }) {
  return (
    <table className="w-full text-body-sm">
      <thead className="sr-only">
        <tr><th>{sheet}</th><th>Questions</th><th>% correct</th></tr>
      </thead>
      <tbody className="divide-y divide-line border-y border-line">
        {rows.map((r) => (
          <tr key={r.system}>
            <td className="py-2.5 font-medium">{r.system}</td>
            <td className="tnum py-2.5 text-end text-muted">{r.assumed ? 'a short block' : `${num(r.used)} used`}</td>
            <td className={`tnum w-28 py-2.5 text-end font-medium ${r.pct === null ? 'text-faint' : r.pct < WEAK_BELOW ? 'text-weak' : ''}`}>
              {r.pct === null ? 'no %' : `${r.pct}% correct`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
