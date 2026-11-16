# Graph Report - project-planner  (2026-11-16)

## Corpus Check
- 100 files · ~107,542 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: (none) 2, .css 1)

## Summary
- 1176 nodes · 3254 edges · 46 communities (45 shown, 1 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 49 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2d48010d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- rescue.ts
- fixes.ts
- 2. Generate: 15 ideas
- package.json
- engine/topics.ts
- Locus — Project Brief (handoff for Claude Code)
- demoStore.ts
- pace.ts
- demo.ts
- commitments.ts
- App.tsx
- setup.ts
- Today.tsx
- Onboarding.tsx
- EngineState
- gen-bnb.mjs
- theme.ts
- BlockFinished.tsx
- config.ts
- progress.ts
- RecallSweep.tsx
- topics.test.ts
- progress.ts
- buildPlanState
- compilerOptions
- Locus plan engine: specification
- Locus — Phase 0 prototype
- Plan engine: what changed and why (15 Nov 2026)
- setup.test.ts
- personas.ts
- Commitments.tsx
- features.ts
- Pace.tsx
- Engine notes
- demo.ts
- sim.ts
- lightday.ts
- invariants.ts
- engine.test.ts
- engine/types.ts
- buildDay
- reasons.ts
- core.test.ts
- engine/index.ts
- App.tsx
- trim-universities.mjs

## God Nodes (most connected - your core abstractions)
1. `addDays()` - 71 edges
2. `useDemo` - 54 edges
3. `buildDay()` - 46 edges
4. `ISODate` - 39 edges
5. `Today()` - 38 edges
6. `daysBetween()` - 37 edges
7. `Onboarding()` - 33 edges
8. `buildPlanState()` - 28 edges
9. `Task` - 25 edges
10. `react` - 23 edges

## Surprising Connections (you probably didn't know these)
- `9. Rescue mode` --references--> `rescueCheck()`  [INFERRED]
  docs/ENGINE_SPEC.md → src/engine/rescue.ts
- `11. Invariants` --references--> `buildDay()`  [INFERRED]
  docs/ENGINE_SPEC.md → src/engine/plan.ts
- `3. Situations nobody had designed, and what the engine does now` --references--> `nextRotation()`  [INFERRED]
  docs/ENGINE_NOTES.md → src/data/setup.ts
- `3. Situations nobody had designed, and what the engine does now` --references--> `startBreak()`  [INFERRED]
  docs/ENGINE_NOTES.md → src/data/setup.ts
- `Suggested data model (proposal, adjust freely)` --references--> `Goal`  [INFERRED]
  CLAUDE.md → src/engine/types.ts

## Import Cycles
- None detected.

## Communities (46 total, 1 thin omitted)

### Community 0 - "rescue.ts"
Cohesion: 0.10
Nodes (31): RESCUE_COOLDOWN_DAYS, RESCUE_COOLDOWN_FACTOR, RESCUE_DISMISS_DAYS, RESCUE_EXTRA_MINUTES, RESCUE_EXTRA_STEP, RESCUE_MAX_DROP_SHARE, RESCUE_MAX_EXTRA, RESCUE_MIN_DAYS_LEFT (+23 more)

### Community 1 - "fixes.ts"
Cohesion: 0.17
Nodes (27): FIX_AFTER_BLOCK_DAYS, FIX_CARDS, FIX_MINUTES, MAX_RETEST_FAILS, PARK_DAYS, RETEST_AFTER_FIX_DAYS, RETEST_MINUTES, RETEST_QUESTIONS (+19 more)

### Community 2 - "2. Generate: 15 ideas"
Cohesion: 0.04
Nodes (48): 10. Last-48-hours sheet, 11. Quiz-swap buddy, 12. Explain-it-back, 13. Exam-week drop list, 14. Dress rehearsal blocks, 15. Mix-it-up nudge, #1 Exam split → weights: why it could be the reason people choose Locus, 1. Ground it (+40 more)

### Community 3 - "package.json"
Cohesion: 0.07
Nodes (36): dependencies, @fontsource-variable/inter@^5.3.0, lucide-react@^1.73.0, react@^19.3.1, react-dom@^19.3.1, zustand@^5.1.0, devDependencies, tailwindcss@^4.3.5 (+28 more)

### Community 4 - "engine/topics.ts"
Cohesion: 0.13
Nodes (38): linkedTopicIds(), QUEUE_NEXT_SYSTEMS, checkTitle(), refreshTopicTasks(), topicTask(), inSentence(), activeSystems(), advanceTopic() (+30 more)

### Community 5 - "Locus — Project Brief (handoff for Claude Code)"
Cohesion: 0.06
Nodes (34): 10. Risks and how we test them, 11. Rejected / already discussed (don't re-propose), 12. Open decisions, 13. What I want from Claude Code right now, 1. Who I am (context for decisions), 2. The old project: `productivity-v2`, 3. How the idea evolved (conversation history), 4. The product: what Locus is (+26 more)

### Community 6 - "demoStore.ts"
Cohesion: 0.10
Nodes (30): CommitmentDay, BlockResult, FixPlan, SystemResult, RoadSegment, DayNote, DayPlan, Outcome (+22 more)

### Community 7 - "pace.ts"
Cohesion: 0.15
Nodes (29): Pace = your road to the exam, LOOP_RESERVE_DAYS, PROJECTION_DAYS, READY_FALLBACK_DAYS, READY_HORIZON_DAYS, isPaused(), studies(), windDownGoals() (+21 more)

### Community 8 - "demo.ts"
Cohesion: 0.15
Nodes (5): BLOCKS, linaAnswers(), linaState(), seedSessions(), TOPIC_STATE

### Community 9 - "commitments.ts"
Cohesion: 0.06
Nodes (46): vitest, TOPIC_ALIASES, BUSY, dayMonth(), DEADLINE_SOFT, DEADLINE_STRONG, hm(), matchTopic() (+38 more)

### Community 10 - "App.tsx"
Cohesion: 0.19
Nodes (11): lucide-react, react, clock(), useLongPress(), Running(), styles, Variant, Nav() (+3 more)

### Community 11 - "setup.ts"
Cohesion: 0.08
Nodes (24): Answers, WatchGroup, ANKI_NEW_UNSURE, ANKI_REVIEW_DEFAULT, DEFAULT_WEEKEND_COUNTRY, GOALS, GoalTemplate, LECTURES_LEFT_UNSURE (+16 more)

### Community 12 - "Today.tsx"
Cohesion: 0.14
Nodes (27): todayOffer(), totalMinutes(), studiedMinutes(), count(), inDays(), sweepOutcome(), sweepTaskId(), withSweepTasks() (+19 more)

### Community 13 - "Onboarding.tsx"
Cohesion: 0.10
Nodes (26): checklistIds(), DateAnswer, dropSubjects(), goalChoices(), goalLabel(), pickUniversity(), rotationEndAnswered(), Subject (+18 more)

### Community 14 - "EngineState"
Cohesion: 0.22
Nodes (9): WEAK_BELOW, applyImport(), importReason(), Replan, Reported, Narrowed, markWeak(), EngineState (+1 more)

### Community 15 - "gen-bnb.mjs"
Cohesion: 0.09
Nodes (20): checklist, emptyTopics, extra, ids, items, listed, MAP, REVIEW (+12 more)

### Community 16 - "theme.ts"
Cohesion: 0.33
Nodes (7): applyTheme(), listeners, setTheme(), Theme, useTheme(), OPTIONS, ThemeSwitch()

### Community 17 - "BlockFinished.tsx"
Cohesion: 0.21
Nodes (22): isEnabled(), ANKI_CHOICES, AnkiReport(), AutoReport(), BlockFinished(), capital(), COMPLETION, CompletionReport() (+14 more)

### Community 18 - "config.ts"
Cohesion: 0.06
Nodes (61): AMBOSS_MINUTES_PER_TOPIC, ANKI_MAX_NEW_PER_DAY, ANKI_MIN_MINUTES, ANKI_NEW_MIN_HORIZON_DAYS, ANKI_NO_NEW_BEFORE_EXAM_DAYS, BACKLOG_LIMIT_FACTOR, BACKLOG_NEW_TOPICS_PER_DAY, BLOCK_SAME_SYSTEM_DAYS (+53 more)

### Community 19 - "progress.ts"
Cohesion: 0.36
Nodes (9): applyCommitmentWork(), PARTLY_SHARE, applyCompletion(), assume(), assumeDone(), previewTomorrow(), roundTo5(), applyFixDone() (+1 more)

### Community 20 - "RecallSweep.tsx"
Cohesion: 0.23
Nodes (18): done(), isRTL(), play(), prefersReduced(), REDUCED_FADE, spring(), SPRING, springAt() (+10 more)

### Community 21 - "topics.test.ts"
Cohesion: 0.07
Nodes (16): BNB, BNB_NEEDS_REVIEW, FIRST_AID, FIRST_AID_EXTRACTED, ResourceItem, addCustomSubject(), allTopics(), customSubject() (+8 more)

### Community 22 - "progress.ts"
Cohesion: 0.18
Nodes (13): ESTIMATE_MAX, ESTIMATE_MAX_STEP, ESTIMATE_MIN, ESTIMATE_OUTLIER_RATIO, ESTIMATE_PRIOR_SESSIONS, Blend, blendEstimate(), clamp() (+5 more)

### Community 23 - "buildPlanState"
Cohesion: 0.22
Nodes (17): boardGoal(), buildPlanState(), endWeeks(), isMajor(), nextRotation(), offersWatched(), papersFor(), plansByTopic() (+9 more)

### Community 24 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 25 - "Locus plan engine: specification"
Cohesion: 0.13
Nodes (14): 10. Time estimates, 11. Invariants, 4.1 Board goals: by topic, 4.2 Uni goals: lectures, summaries, past papers, 4. Sharing time between goals, 5.1 The three days around a firm exam, 5.2 Wind-down before a uni exam, 5.3 After an exam (+6 more)

### Community 26 - "Locus — Phase 0 prototype"
Cohesion: 0.13
Nodes (14): "Already watched" (current system only), Bring in UWorld results, Deploy (Vercel), Design tokens, Dev-only switches (invisible to classmates), Layout, Light days (no post-call questions), Locus — Phase 0 prototype (+6 more)

### Community 27 - "Plan engine: what changed and why (15 Nov 2026)"
Cohesion: 0.40
Nodes (4): Not built (engine ready, no screen), One line per persona (final run), Plan engine: what changed and why (15 Nov 2026), Verified

### Community 28 - "setup.test.ts"
Cohesion: 0.09
Nodes (25): RotationEnd, GLOBAL_DEFAULT, ROTATION_SYSTEMS, countryList(), loadUniversities(), normalize(), searchUniversities(), UniversityData (+17 more)

### Community 29 - "personas.ts"
Cohesion: 0.15
Nodes (17): defaultAnswers(), RotationAnswer, startBreak(), subjectFor(), toggleSubject(), rotationById(), answers(), afterIM (+9 more)

### Community 30 - "Commitments.tsx"
Cohesion: 0.21
Nodes (16): busyCost(), busyMinutes(), clockMinutes(), comingUp(), busyLabel(), cap(), clockRange(), CommitmentLines() (+8 more)

### Community 31 - "features.ts"
Cohesion: 0.40
Nodes (4): FeatureId, FEATURES, PRO_GATING, Tier

### Community 32 - "Pace.tsx"
Cohesion: 0.06
Nodes (32): ALIASES, ImportedSystem, importSummary(), norm(), parseUworldReport(), Raw, readValues(), systemFromLine() (+24 more)

### Community 33 - "Engine notes"
Cohesion: 0.22
Nodes (8): 1. Decisions Omar made (requirements), 2. Conflicts between rules, and how each was resolved, 4. Deviations from the spec, or things it leaves open, 5. What the simulator found (and the fix), 6. What the two independent reviews found, 7. Changes after Omar's feedback (16 Nov), Engine notes, dismissRescue()

### Community 34 - "demo.ts"
Cohesion: 0.11
Nodes (3): DEMO_TODAY, calm, lina

### Community 35 - "sim.ts"
Cohesion: 0.09
Nodes (14): checkLight(), checkRescue(), newMemory(), Violation, around(), Rng, rng(), DayLog (+6 more)

### Community 36 - "lightday.ts"
Cohesion: 0.10
Nodes (37): recentAccuracy(), statedMinutes(), DeadlinePlan, Overconfidence, ESSENTIAL_TASKS, EXAM_PROTECT_DAYS, LIGHT_DAY_MINUTES, LIGHT_OFFERS_PER_WEEK (+29 more)

### Community 37 - "invariants.ts"
Cohesion: 0.08
Nodes (3): checkDay(), isStudy(), Memory

### Community 39 - "engine/types.ts"
Cohesion: 0.12
Nodes (24): Suggested data model (proposal, adjust freely), 1.1 What the student gives (stable), 1.2 What the engine records (history), 1.3 What the engine returns, 1. Data model, FixContext, GoalMaterial, AnkiDeck (+16 more)

### Community 40 - "buildDay"
Cohesion: 0.20
Nodes (16): 3. Situations nobody had designed, and what the engine does now, What changed, 2. The study day, 3. How a day is decided, DO_MORE_MINUTES, doMore(), endDay(), rotationEnded() (+8 more)

### Community 41 - "reasons.ts"
Cohesion: 0.24
Nodes (12): toDate(), dayName(), MONTHS, MONTHS_LONG, monthYear(), plural(), reasons, shortDate() (+4 more)

### Community 42 - "core.test.ts"
Cohesion: 0.13
Nodes (19): accuracyBySystem(), Band, band(), pct(), SystemAccuracy, ACCURACY_WINDOW_DAYS, BORDERLINE_FROM, CONFIRM_RETEST_AFTER_DAYS (+11 more)

### Community 43 - "engine/index.ts"
Cohesion: 0.18
Nodes (12): DayContext, dayContext(), DayKind, overconfidence(), rateConfident(), TopicScore, CONFIDENCE_REVIEW_MINUTES, CONFIDENCE_WINDOW_DAYS (+4 more)

### Community 45 - "App.tsx"
Cohesion: 0.22
Nodes (12): react-dom, App(), initDev(), duration(), num(), range(), REDUCED_MOTION, useMedia() (+4 more)

### Community 46 - "trim-universities.mjs"
Cohesion: 0.18
Nodes (8): countries, COUNTRY_NAME, data, NAME_FIX, out, unis, PERSONAS, render()

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `buildDay()` connect `buildDay` to `rescue.ts`, `fixes.ts`, `lightday.ts`, `engine/topics.ts`, `demoStore.ts`, `pace.ts`, `commitments.ts`, `core.test.ts`, `engine/index.ts`, `Today.tsx`, `BlockFinished.tsx`, `config.ts`, `progress.ts`, `progress.ts`, `Locus plan engine: specification`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `buildDay()` (e.g. with `What changed` and `11. Invariants`) actually correct?**
  _`buildDay()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Should `rescue.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09879032258064516 - nodes in this community are weakly interconnected._
- **Why does `addDays()` connect `lightday.ts` to `rescue.ts`, `fixes.ts`, `demoStore.ts`, `pace.ts`, `buildDay`, `commitments.ts`, `core.test.ts`, `engine/index.ts`, `reasons.ts`, `Today.tsx`, `EngineState`, `gen-bnb.mjs`, `config.ts`, `progress.ts`, `setup.test.ts`, `Commitments.tsx`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Should `2. Generate: 15 ideas` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._
- **Why does `react` connect `App.tsx` to `Pace.tsx`, `package.json`, `Today.tsx`, `App.tsx`, `Onboarding.tsx`, `theme.ts`, `BlockFinished.tsx`, `RecallSweep.tsx`, `Commitments.tsx`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06970128022759602 - nodes in this community are weakly interconnected._