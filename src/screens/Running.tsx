import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { clock } from '../lib/format'
import { useDemo } from '../store/demoStore'
import { Button } from '../ui/Button'
import { Page } from '../ui/Page'
import { ProgressBar } from '../ui/ProgressBar'
import { Tag } from '../ui/Tag'

export function Running() {
  const { running, todayTasks, plan, pause, resume, finish, cancelRun } = useDemo()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])

  if (!running) return null
  const task = todayTasks.find((t) => t.id === running.taskId)!
  const goal = plan?.goals.find((g) => g.id === task.goalId)?.label
  const paused = running.pausedAt !== null
  const elapsed = ((running.pausedAt ?? now) - running.startedAt - running.pausedMs) / 1000
  const total = task.minutes * 60
  const left = total - elapsed
  const over = left < 0

  return (
    <Page
      centered
      top={
        <div className="flex h-14 items-center px-2">
          <button type="button" onClick={cancelRun} className="flex size-11 items-center justify-center text-muted" aria-label="Stop without saving">
            <X className="size-icon-xl" />
          </button>
        </div>
      }
      footer={
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" className="min-w-32 flex-1" onClick={paused ? resume : pause}>{paused ? 'Resume' : 'Pause'}</Button>
          <Button className="min-w-32 flex-2" onClick={finish}>Finish</Button>
        </div>
      }
    >
      <div className="flex min-h-stage flex-col justify-center text-center">
        <div className="flex justify-center gap-2">
          {task.kind === 'fix' && <Tag tone="accent">Fix</Tag>}
          {goal && <Tag>{goal}</Tag>}
        </div>
        <h1 className="mt-3 text-title-2 leading-snug font-semibold tracking-tight text-balance">{task.title}</h1>
        {task.detail && <p className="mt-1 text-body-sm text-muted">{task.detail}</p>}

        <p
          className={`tnum mt-14 text-timer leading-none font-light tracking-tight transition-opacity ${paused ? 'opacity-40' : ''}`}
          aria-live="off"
          role="timer"
        >
          {over ? clock(-left) : clock(left)}
        </p>
        <p className="mt-3 text-callout text-muted">
          {paused ? 'Paused' : over ? `over ${task.minutes} min — finish when you're done` : `of ${task.minutes} min`}
        </p>
        <div className="mx-auto mt-8 w-40">
          <ProgressBar value={Math.min(1, elapsed / total)} label="Time used" />
        </div>
      </div>
    </Page>
  )
}
