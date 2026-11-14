import { useEffect, useState } from 'react'
import { initDev } from './lib/dev'
import { AnkiConnect } from './screens/AnkiConnect'
import { BlockFinished } from './screens/BlockFinished'
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
  if (s.overlay === 'block') return <BlockFinished />
  if (s.overlay === 'anki') {
    return (
      <AnkiConnect
        mode="app"
        connected={s.ankiConnected}
        newCards={s.plan.anki?.newCardsLeft ?? 0}
        onConnectedChange={s.setAnkiConnected}
        onDone={s.closeAnki}
        onBack={s.closeAnki}
      />
    )
  }

  if (s.tab === 'pace') return <Pace />
  if (s.tab === 'week') return <Weekly />
  return <Today />
}
