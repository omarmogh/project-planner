import { ChevronLeft } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { num } from '../lib/format'
import { Button } from '../ui/Button'
import { Page } from '../ui/Page'

/** Mocked "due today" count while connected (the real one comes from getDeckStats). */
export const MOCK_DUE_TODAY = 214

/**
 * Path B: "Connect Anki". Mocked for Phase 0 — no real connection.
 * Real version: ankiConnect.ts → POST http://127.0.0.1:8765 { action: 'deckNames' | 'getDeckStats' ... }
 * from the Tauri app; any failure falls back silently to the manual numbers (path A).
 */
export function AnkiConnect({
  mode, connected, newCards, onConnectedChange, onDone, onBack,
}: {
  mode: 'onboarding' | 'app'
  connected: boolean
  newCards: number
  onConnectedChange: (v: boolean) => void
  onDone: () => void
  onBack?: () => void
}) {
  const [checking, setChecking] = useState(false)
  const timer = useRef<number | null>(null)
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])

  const check = () => {
    setChecking(true)
    timer.current = window.setTimeout(() => {
      setChecking(false)
      onConnectedChange(true)
    }, 1100)
  }

  const footer = connected ? (
    <Button onClick={onDone}>{mode === 'onboarding' ? 'Continue' : 'Done'}</Button>
  ) : (
    <div className="flex flex-col gap-1">
      <Button onClick={check} disabled={checking}>{checking ? 'Checking…' : 'Check connection'}</Button>
      <Button variant="plain" onClick={onDone}>{mode === 'onboarding' ? 'Skip' : 'Use my numbers instead'}</Button>
    </div>
  )

  return (
    <Page
      footer={footer}
      top={
        onBack && (
          <div className="flex h-14 items-center px-2">
            <button type="button" onClick={onBack} className="flex size-11 items-center justify-center text-accent" aria-label="Back">
              <ChevronLeft size={26} className="rtl:-scale-x-100" />
            </button>
          </div>
        )
      }
    >
      <div className={onBack ? 'pt-2' : 'pt-14'}>
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight">
          {mode === 'onboarding' ? 'Connect Anki on this computer?' : 'Connect Anki'}
        </h1>
        <p className="mt-3 text-[17px] leading-relaxed text-muted">
          Locus can read your deck numbers straight from Anki, so you never type them. Anki still decides what's due.
        </p>

        <ol className="mt-8 space-y-5">
          {[
            <>In Anki, open <b className="font-medium text-fg">Tools → Add-ons → Get Add-ons</b>.</>,
            <>Paste the code <b className="tnum font-medium text-fg">2055492159</b> (AnkiConnect), then restart Anki.</>,
            <>Keep Anki open and tap <b className="font-medium text-fg">Check connection</b>.</>,
          ].map((step, i) => (
            <li key={i} className="flex gap-4">
              <span className="tnum flex size-7 shrink-0 items-center justify-center rounded-full bg-surface text-[14px] font-semibold text-muted">{i + 1}</span>
              <span className="pt-0.5 text-[16px] leading-relaxed text-muted">{step}</span>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex items-center gap-3 border-t border-line pt-5" aria-live="polite">
          <span className={`size-2.5 rounded-full ${connected ? 'bg-good' : 'bg-faint'}`} aria-hidden />
          {connected ? (
            <span className="text-[16px]">
              <span className="font-medium">Connected.</span>{' '}
              <span className="text-muted">{num(newCards)} new cards · {MOCK_DUE_TODAY} due today</span>
            </span>
          ) : (
            <span className="text-[16px] text-muted">{checking ? 'Looking for Anki on this computer…' : 'Not connected'}</span>
          )}
        </div>
        {connected && mode === 'app' && (
          <button type="button" onClick={() => onConnectedChange(false)} className="mt-3 text-[15px] text-muted underline-offset-2 active:underline">
            Disconnect
          </button>
        )}

        <p className="mt-8 text-[14px] leading-relaxed text-faint">
          Works with Anki on a laptop. On your phone, Locus uses the numbers you entered — nothing breaks if Anki isn't open.
        </p>
      </div>
    </Page>
  )
}
