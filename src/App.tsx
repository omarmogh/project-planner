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
import { TabBar } from './ui/TabBar'

export function App() {
  const s = useDemo()
  useEffect(() => initDev(useDemo.getState().reset), [])

  // Brief "building" beat between onboarding and the first Today.
  const [building, setBuilding] = useState(false)
  const hasPlan = !!s.plan
  useEffect(() => {
    if (!hasPlan || !useDemo.getState().intro) return
    setBuilding(true)
    const t = window.setTimeout(() => setBuilding(false), 900)
    return () => window.clearTimeout(t)
  }, [hasPlan])

  // Each screen starts at the top.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [s.tab, s.overlay, hasPlan, s.outcome === null])

  if (!s.plan) return <Onboarding />

  if (building) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="anim-fade text-[17px] text-muted">Building your plan…</p>
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

  return (
    <>
      {s.tab === 'today' && <Today />}
      {s.tab === 'pace' && <Pace />}
      {s.tab === 'week' && <Weekly />}
      <TabBar
        tab={s.tab}
        onChange={(t) => {
          s.endIntro()
          s.setTab(t)
        }}
      />
    </>
  )
}
