import { useRef, useState } from 'react'
import { backupText, useDemo } from '../store/demoStore'

const linkClass = 'inline-flex min-h-11 items-center text-callout font-medium text-accent hover:opacity-70 active:opacity-60'

/** Restore a plan from a backup file, read locally. Used in Plan settings and on the first setup screen. */
export function RestoreBackup({ label = 'Restore from a backup' }: { label?: string }) {
  const restore = useDemo((s) => s.restore)
  const input = useRef<HTMLInputElement>(null)
  const [failed, setFailed] = useState(false)
  const read = async (file: File | undefined) => {
    if (!file) return
    setFailed(!restore(await file.text()))
    if (input.current) input.current.value = ''
  }
  return (
    <>
      <button type="button" onClick={() => input.current?.click()} className={linkClass}>{label}</button>
      <input ref={input} type="file" accept=".json,application/json" className="hidden" onChange={(e) => read(e.target.files?.[0])} />
      {failed && <p role="status" className="w-full text-subhead text-muted">That file isn't a Locus backup. Nothing was changed.</p>}
    </>
  )
}

/** Download the whole plan (setup, logged blocks, weak topics) as one file. */
export function SaveBackup() {
  const save = () => {
    const text = backupText()
    if (!text) return
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `locus-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  return <button type="button" onClick={save} className={linkClass}>Save a backup</button>
}
