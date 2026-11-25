// "Log a result": an exam, NBME, quiz or oral from outside the plan. One field for the name, an optional
// score, optional time, and (with a score) what felt weak. It feeds the same fix → retest loop as a block.

import { useMemo, useState } from 'react'
import { parseCommitment, uniTopicChoices, type ISODate, type ResultPrompt } from '../engine'
import { duration } from '../lib/format'
import { parseScore } from '../lib/score'
import { useDemo } from '../store/demoStore'
import { Button } from '../ui/Button'
import { Chip } from '../ui/Chip'
import { Sheet } from '../ui/Sheet'

const TIMES = [30, 60, 120, 180, 240]

export function ResultSheet({ prompt, onClose }: { prompt?: ResultPrompt; onClose: () => void }) {
  const { plan, today, logResult } = useDemo()
  const p = plan!
  const [label, setLabel] = useState(prompt?.label ?? '')
  const goals = useMemo(() => p.goals.filter((g) => g.examDate >= today).sort((a, b) => a.examDate.localeCompare(b.examDate)), [p.goals, today])
  // The goal it counts for: the prompt's, or guessed from the words ("NBME" → the board exam), one tap to change.
  const guessed = useMemo(() => guessGoal(label, goals, today), [label, goals, today])
  const [picked, setPicked] = useState<string | null>(prompt?.goalId ?? null)
  const goalId = picked ?? guessed
  const goal = goals.find((g) => g.id === goalId)
  const [scoreText, setScoreText] = useState('')
  const score = parseScore(scoreText)
  const [minutes, setMinutes] = useState<number | undefined>()
  const [weak, setWeak] = useState<string[]>([])

  const topics = useMemo(() => {
    if (!goal) return []
    if (goal.kind === 'uni') return uniTopicChoices(p, goal.id).filter((t) => !t.wholeSystem).map((t) => ({ id: t.id, name: t.name }))
    return [...new Set(p.topics.filter((t) => !t.wholeSystem && !t.id.startsWith('uni-')).map((t) => t.system))].map((sys) => ({ id: sys, name: sys }))
  }, [goal, p])

  const ok = label.trim().length > 0 && !!goal && (score === null || score.ok)
  const save = () => {
    if (!ok || !goal) return
    const scored = score?.ok ? score : null
    logResult({ goalId: goal.id, label: label.trim(), percent: scored?.percent, questions: scored?.questions, weakTopicIds: scored ? weak : undefined, minutes }, prompt?.key)
    onClose()
  }
  const toggle = (id: string) => setWeak((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]))
  const sectionTitle = 'mt-6 text-subhead font-medium text-muted'

  return (
    <Sheet title={prompt ? `How did the ${prompt.label} go?` : 'Log a result'} onClose={onClose}>
      <form className="pt-4 pb-2" onSubmit={(e) => { e.preventDefault(); save() }}>
        <input
          autoFocus={!prompt}
          dir="auto"
          value={label}
          onChange={(e) => setLabel(e.target.value.slice(0, 60))}
          placeholder="NBME 1, Cardio quiz, Physiology oral"
          aria-label="What was it?"
          className="min-h-12 w-full rounded-md bg-surface px-3 py-2 text-body"
        />

        {goals.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Counts for">
            {goals.map((g) => (
              <Chip key={g.id} selected={g.id === goalId} onClick={() => { setPicked(g.id); setWeak([]) }}>{g.label}</Chip>
            ))}
          </div>
        )}

        <label className="mt-6 flex min-h-14 items-center justify-between gap-4">
          <span className="text-body font-medium">Score</span>
          <input
            autoFocus={!!prompt}
            inputMode="numeric"
            enterKeyHint="done"
            placeholder="62% or 7/10"
            value={scoreText}
            maxLength={9}
            onChange={(e) => setScoreText(e.target.value)}
            aria-label="Score: percent correct, or right out of total"
            className="tnum min-h-11 w-36 rounded-md bg-surface px-3 py-2 text-end text-body placeholder:text-faint"
          />
        </label>
        <p className="mt-1 text-subhead text-muted" role="status">
          {score && !score.ok ? <span className="text-weak">{score.message}</span> : score?.ok ? `${score.percent}% correct.` : "Leave it empty if you don't have it yet."}
        </p>

        {score?.ok && topics.length > 0 && (
          <div className="anim-fade">
            <p className={sectionTitle}>{goal?.kind === 'uni' ? 'Lectures you missed questions on' : 'Systems you struggled with'} <span className="text-faint">· optional</span></p>
            <div className="mt-2 flex flex-wrap gap-2">
              {topics.map((t) => <Chip key={t.id} selected={weak.includes(t.id)} onClick={() => toggle(t.id)}>{t.name}</Chip>)}
            </div>
          </div>
        )}

        <p className={sectionTitle}>Time it took <span className="text-faint">· counts as studied today</span></p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Time it took">
          {TIMES.map((m) => <Chip key={m} selected={minutes === m} onClick={() => setMinutes(minutes === m ? undefined : m)}>{duration(m)}</Chip>)}
        </div>

        <div className="mt-6">
          <Button type="submit" disabled={!ok}>Save</Button>
        </div>
      </form>
    </Sheet>
  )
}

/** Board words go to the board goal; anything else to the nearest uni exam, else the nearest goal. */
function guessGoal(label: string, goals: { id: string; kind: string; label: string }[], today: ISODate): string | null {
  if (!goals.length) return null
  const tag = label.trim() ? parseCommitment(label, today).tag : null
  const board = goals.find((g) => g.kind !== 'uni')
  const uni = goals.filter((g) => g.kind === 'uni')
  if (tag === 'usmle' && board) return board.id
  const lower = label.toLowerCase()
  const named = uni.find((g) => lower.includes(g.label.replace(/ exam$/i, '').toLowerCase()))
  return (named ?? uni[0] ?? board ?? goals[0]).id
}

/** On Today, once: "How did the Physics colloquium go?" after a test-like commitment or exam part has passed. */
export function ResultAsk({ prompt, onLog }: { prompt: ResultPrompt; onLog: () => void }) {
  const dismiss = useDemo((s) => s.dismissResult)
  return (
    <section className="anim-rise mt-8">
      <p className="text-title-2 font-semibold tracking-tight">How did the <bdi>{prompt.label}</bdi> go?</p>
      <p className="mt-1 text-body-sm text-muted">Add your score and Locus plans a fix for what you missed.</p>
      <div className="mt-2 flex flex-wrap gap-x-6">
        <button type="button" onClick={onLog} className="inline-flex min-h-11 items-center text-callout font-semibold text-accent hover:opacity-70 active:opacity-60">Add the score</button>
        <button type="button" onClick={() => dismiss(prompt.key)} className="inline-flex min-h-11 items-center text-callout font-medium text-muted hover:opacity-70 active:opacity-60">Not now</button>
      </div>
    </section>
  )
}
