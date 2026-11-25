import { useEffect, useState } from 'react'
import { initDev } from './lib/dev'
import { AnkiConnect } from './screens/AnkiConnect'
import { canConnectAnki } from './lib/ankiConnect'
import { BlockFinished } from './screens/BlockFinished'
import { Board } from './screens/Board'
import { Onboarding } from './screens/Onboarding'
import { Pace } from './screens/Pace'
import { Running } from './screens/Running'
import { Today } from './screens/Today'
import { Weekly } from './screens/Weekly'
import { useDemo } from './store/demoStore'
import { REDUCED_MOTION, useMedia } from './lib/useMedia'

export function App() {
  const s = useDemo()
  useEffect(() => initDev(useDemo.getState().reset), [])
  // The app always opens on Today, whatever tab was used last time.
  useEffect(() => { useDemo.getState().setTab('today') }, [])
  // A new study day starts at 4 AM: close yesterday and plan today when the app is opened or comes back into view.
  useEffect(() => {
    const sync = () => document.visibilityState === 'visible' && useDemo.getState().syncDay()
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])

  // Brief "building" beat between onboarding and the first Today.
  // Skipped entirely when the OS asks for reduced motion.
  const reduceMotion = useMedia(REDUCED_MOTION)
  const [building, setBuilding] = useState(false)
  const hasPlan = !!s.plan
  useEffect(() => {
    if (!hasPlan || !useDemo.getState().intro) return
    if (window.matchMedia(REDUCED_MOTION).matches) return
    setBuilding(true)
    const t = window.setTimeout(() => setBuilding(false), 900)
    return () => window.clearTimeout(t)
  }, [hasPlan])

  // Each screen starts at the top.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [s.tab, s.overlay, hasPlan, s.outcome === null])

  if (!s.plan) return <Onboarding />

  if (building && !reduceMotion) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="anim-fade text-body text-muted">Building your plan…</p>
      </div>
    )
  }

  if (s.overlay === 'running') return <Running />
  if (s.overlay === 'block') return <BlockFinished key={s.finishing?.taskId} />
  // Connect Anki is a desktop offer: a phone or tablet never sees the sheet, even if it was open before.
  if (s.overlay === 'anki' && canConnectAnki()) {
    return (
      <AnkiConnect
        mode="app"
        connected={s.ankiConnected}
        onConnectedChange={s.setAnkiConnected}
        onDone={s.closeAnki}
        onBack={s.closeAnki}
      />
    )
  }

  if (s.tab === 'pace') return <Pace />
  if (s.tab === 'week') return <Weekly />
  if (s.tab === 'board') return <Board />
  return <Today />
}
