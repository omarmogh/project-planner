import { ChevronLeft } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { checkAnki, type AnkiStatus } from '../lib/ankiConnect'
import { num } from '../lib/format'
import { Button } from '../ui/Button'
import { Page } from '../ui/Page'

/** Phones and tablets without a mouse: no AnkiConnect there, so the offer is never shown. */
export const TOUCH_ONLY = '(pointer: coarse) and (hover: none)'

/**
 * Path B: "Connect Anki". A real check against AnkiConnect (see lib/ankiConnect.ts); the numbers shown
 * are Anki's own or nothing. Any failure leaves the student on their own numbers (path A).
 */
export function AnkiConnect({
  mode, connected, onConnectedChange, onDone, onBack,
}: {
  mode: 'onboarding' | 'app'
  connected: boolean
  onConnectedChange: (v: boolean) => void
  onDone: () => void
  onBack?: () => void
}) {
  const [checking, setChecking] = useState(false)
  const [failed, setFailed] = useState(false)
  const [status, setStatus] = useState<AnkiStatus | null>(null)
  const live = useRef(true)
  useEffect(() => {
    live.current = true
    return () => { live.current = false }
  }, [])

  const check = async () => {
    setChecking(true)
    setFailed(false)
    const got = await checkAnki()
    if (!live.current) return
    setChecking(false)
    setStatus(got)
    setFailed(!got)
    onConnectedChange(!!got)
  }
  // Reopened while connected: show today's real numbers, or quietly that Anki isn't open right now.
  useEffect(() => {
    if (connected) checkAnki().then((got) => live.current && setStatus(got))
  }, [connected])

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
              <ChevronLeft className="size-icon-2xl rtl:-scale-x-100" />
            </button>
          </div>
        )
      }
    >
      <div className={onBack ? 'pt-2' : 'pt-14'}>
        <h1 className="text-title-1 leading-tight font-semibold tracking-tight">
          {mode === 'onboarding' ? 'Connect Anki on this computer?' : 'Connect Anki'}
        </h1>
        <p className="mt-3 text-body leading-relaxed text-muted">
          Locus can read your deck numbers straight from Anki, so you never type them. Anki still decides what's due.
        </p>

        <ol className="mt-8 space-y-5">
          {[
            <>In Anki, open <b className="font-medium text-fg">Tools → Add-ons → Get Add-ons</b>.</>,
            <>Paste the code <b className="tnum font-medium text-fg">2055492159</b> (AnkiConnect), then restart Anki.</>,
            <>Keep Anki open and tap <b className="font-medium text-fg">Check connection</b>.</>,
          ].map((step, i) => (
            <li key={i} className="flex gap-4">
              <span className="tnum flex size-7 shrink-0 items-center justify-center rounded-full bg-surface text-subhead font-semibold text-muted">{i + 1}</span>
              <span className="pt-0.5 text-body-sm leading-relaxed text-muted">{step}</span>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex items-center gap-3 border-t border-line pt-5" aria-live="polite">
          <span className={`size-2.5 rounded-full ${connected ? 'bg-good' : 'bg-faint'}`} aria-hidden />
          {connected ? (
            <span className="text-body-sm">
              <span className="font-medium">Connected.</span>{' '}
              <span className="text-muted">
                {status ? `${num(status.newCards)} new ${status.newCards === 1 ? 'card' : 'cards'} · ${num(status.dueToday)} due today` : 'Open Anki to see today\'s numbers.'}
              </span>
            </span>
          ) : (
            <span className="text-body-sm text-muted">{checking ? 'Looking for Anki on this computer…' : failed ? "Couldn't reach Anki." : 'Not connected'}</span>
          )}
        </div>
        {failed && (
          <p className="mt-2 text-callout leading-relaxed text-muted">
            Check that Anki is open with AnkiConnect installed. In a browser, AnkiConnect also has to allow this site; the desktop app won't need that. Until then Locus uses your numbers.
          </p>
        )}
        {connected && mode === 'app' && (
          <button type="button" onClick={() => onConnectedChange(false)} className="mt-2 inline-flex min-h-11 items-center text-callout text-muted underline-offset-2 hover:underline active:underline">
            Disconnect
          </button>
        )}

        <p className="mt-8 text-subhead leading-relaxed text-faint">
          Works with Anki on a laptop. On your phone, Locus uses the numbers you entered — nothing breaks if Anki isn't open.
        </p>
      </div>
    </Page>
  )
}
