# Graph Report - project-planner  (2026-11-15)

## Corpus Check
- 99 files · ~105,549 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: (none) 2, .css 1)

## Summary
- 1145 nodes · 3264 edges · 49 communities (48 shown, 1 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 46 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `84a0fb3f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- addDays
- fixes.ts
- 2. Generate: 15 ideas
- package.json
- engine/topics.ts
- Locus — Project Brief (handoff for Claude Code)
- demoStore.ts
- Pace.tsx
- exams.ts
- commitmentParse.ts
- App.tsx
- setup.ts
- Today.tsx
- Onboarding.tsx
- commitments.ts
- gen-bnb.mjs
- theme.ts
- BlockFinished.tsx
- config.ts
- uni.ts
- RecallSweep.tsx
- topics.test.ts
- progress.ts
- buildPlanState
- compilerOptions
- Locus plan engine: specification
- Locus — Phase 0 prototype
- setup.test.ts
- registry.ts
- personas.ts
- Commitments.tsx
- setup.ts
- uworldImport.ts
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
- ISODate
- UworldImport.tsx
- duration
- trim-universities.mjs
- engine/index.ts
- confidence.ts

## God Nodes (most connected - your core abstractions)
1. `addDays()` - 77 edges
2. `useDemo` - 54 edges
3. `buildDay()` - 46 edges
4. `ISODate` - 41 edges
5. `daysBetween()` - 40 edges
6. `Today()` - 38 edges
7. `Onboarding()` - 33 edges
8. `buildPlanState()` - 28 edges
9. `Task` - 26 edges
10. `EngineState` - 24 edges

## Surprising Connections (you probably didn't know these)
- `11. Invariants` --references--> `buildDay()`  [INFERRED]
  docs/ENGINE_SPEC.md → src/engine/plan.ts
- `9. Rescue mode` --references--> `rescueCheck()`  [INFERRED]
  docs/ENGINE_SPEC.md → src/engine/rescue.ts
- `3. Situations nobody had designed, and what the engine does now` --references--> `nextRotation()`  [INFERRED]
  docs/ENGINE_NOTES.md → src/data/setup.ts
- `3. Situations nobody had designed, and what the engine does now` --references--> `startBreak()`  [INFERRED]
  docs/ENGINE_NOTES.md → src/data/setup.ts
- `Pace = your road to the exam` --references--> `dailyLoad()`  [INFERRED]
  README.md → src/engine/pace.ts

## Import Cycles
- None detected.

## Communities (49 total, 1 thin omitted)

### Community 0 - "addDays"
Cohesion: 0.10
Nodes (51): statedMinutes(), capacity(), DeadlinePlan, deadlineRoom(), RESCUE_COOLDOWN_DAYS, RESCUE_COOLDOWN_FACTOR, RESCUE_DISMISS_DAYS, RESCUE_EXTRA_MINUTES (+43 more)

### Community 1 - "fixes.ts"
Cohesion: 0.24
Nodes (22): FIX_AFTER_BLOCK_DAYS, MIXED_SYSTEM, RETEST_AFTER_FIX_DAYS, blockFixOptions(), FixOption, fixOptions(), fixTask(), goalMaterial() (+14 more)

### Community 2 - "2. Generate: 15 ideas"
Cohesion: 0.04
Nodes (48): 10. Last-48-hours sheet, 11. Quiz-swap buddy, 12. Explain-it-back, 13. Exam-week drop list, 14. Dress rehearsal blocks, 15. Mix-it-up nudge, #1 Exam split → weights: why it could be the reason people choose Locus, 1. Ground it (+40 more)

### Community 3 - "package.json"
Cohesion: 0.07
Nodes (36): dependencies, @fontsource-variable/inter@^5.3.0, lucide-react@^1.73.0, react@^19.3.1, react-dom@^19.3.1, zustand@^5.1.0, devDependencies, tailwindcss@^4.3.5 (+28 more)

### Community 4 - "engine/topics.ts"
Cohesion: 0.14
Nodes (36): linkedTopicIds(), QUEUE_NEXT_SYSTEMS, systemDaysLeft(), inSentence(), cap(), narrow(), systemsByWeight(), activeSystems() (+28 more)

### Community 5 - "Locus — Project Brief (handoff for Claude Code)"
Cohesion: 0.06
Nodes (34): 10. Risks and how we test them, 11. Rejected / already discussed (don't re-propose), 12. Open decisions, 13. What I want from Claude Code right now, 1. Who I am (context for decisions), 2. The old project: `productivity-v2`, 3. How the idea evolved (conversation history), 4. The product: what Locus is (+26 more)

### Community 6 - "demoStore.ts"
Cohesion: 0.09
Nodes (28): DayKind, WEAK_BELOW, applyImport(), importReason(), SystemResult, answerLight(), Replan, DayNote (+20 more)

### Community 7 - "Pace.tsx"
Cohesion: 0.19
Nodes (18): Pace = your road to the exam, band(), recentAccuracy(), importedResults(), readyOnWith(), RoadSegment, whatIfDays(), topicCounts() (+10 more)

### Community 8 - "exams.ts"
Cohesion: 0.21
Nodes (9): ROTATION_SYSTEMS, PAPER_MINUTES, PAPERS_WINDOW_LARGE, PAPERS_WINDOW_SMALL, WIND_DOWN_FULL_WEEKS, WIND_DOWN_MAX_DAYS, WIND_DOWN_MIN_DAYS, WIND_DOWN_SHARE (+1 more)

### Community 9 - "commitmentParse.ts"
Cohesion: 0.12
Nodes (23): BUSY, dayMonth(), DEADLINE_SOFT, DEADLINE_STRONG, hm(), matchTopic(), MONTHS, nextWeekday() (+15 more)

### Community 10 - "App.tsx"
Cohesion: 0.13
Nodes (19): lucide-react, react, react-dom, App(), initDev(), clock(), useLongPress(), REDUCED_MOTION (+11 more)

### Community 11 - "setup.ts"
Cohesion: 0.11
Nodes (28): Answers, ANKI_NEW_UNSURE, ANKI_REVIEW_CHOICES, GoalTemplate, LECTURES_LEFT_UNSURE, MAX_ROTATION_SUBJECTS, MINOR_ROTATIONS, ResourceKey (+20 more)

### Community 12 - "Today.tsx"
Cohesion: 0.15
Nodes (29): todayOffer(), totalMinutes(), studiedMinutes(), count(), inDays(), sweepOutcome(), sweepTaskId(), withSweepTasks() (+21 more)

### Community 13 - "Onboarding.tsx"
Cohesion: 0.18
Nodes (15): checklistIds(), dropSubjects(), goalChoices(), goalLabel(), usesSubjects(), watchChecklist(), DateRow(), NumberRow() (+7 more)

### Community 14 - "commitments.ts"
Cohesion: 0.16
Nodes (20): busyOn(), busyReduction(), ceilTo5(), Chunk, chunkTask(), CommitmentDay, commitmentDay(), days() (+12 more)

### Community 15 - "gen-bnb.mjs"
Cohesion: 0.12
Nodes (14): checklist, emptyTopics, extra, ids, items, listed, MAP, REVIEW (+6 more)

### Community 16 - "theme.ts"
Cohesion: 0.33
Nodes (7): applyTheme(), listeners, setTheme(), Theme, useTheme(), OPTIONS, ThemeSwitch()

### Community 17 - "BlockFinished.tsx"
Cohesion: 0.18
Nodes (18): ANKI_CHOICES, AnkiReport(), AutoReport(), BlockFinished(), capital(), COMPLETION, CompletionReport(), FixPicker() (+10 more)

### Community 18 - "config.ts"
Cohesion: 0.06
Nodes (52): ACCURACY_WINDOW_DAYS, AMBOSS_MINUTES_PER_TOPIC, ANKI_MAX_NEW_PER_DAY, ANKI_MIN_MINUTES, ANKI_NEW_MIN_HORIZON_DAYS, ANKI_NO_NEW_BEFORE_EXAM_DAYS, BACKLOG_LIMIT_FACTOR, BACKLOG_NEW_TOPICS_PER_DAY (+44 more)

### Community 19 - "uni.ts"
Cohesion: 0.11
Nodes (24): LECTURE_MINUTES, LECTURES_AHEAD, LECTURES_DONE_BEFORE_SHARE, LECTURES_MAX_PER_DAY, MIN_TASK_MINUTES, PAPERS_BACKLOAD, PAPERS_LARGE_LECTURES, PAPERS_LAST_BEFORE_EXAM_DAYS (+16 more)

### Community 20 - "RecallSweep.tsx"
Cohesion: 0.22
Nodes (19): toDate(), done(), isRTL(), play(), prefersReduced(), REDUCED_FADE, spring(), SPRING (+11 more)

### Community 21 - "topics.test.ts"
Cohesion: 0.08
Nodes (8): BNB, BNB_NEEDS_REVIEW, FIRST_AID, FIRST_AID_EXTRACTED, ResourceItem, TOPICS, hf, items

### Community 22 - "progress.ts"
Cohesion: 0.11
Nodes (25): applyCommitmentWork(), ESTIMATE_MAX, ESTIMATE_MAX_STEP, ESTIMATE_MIN, ESTIMATE_OUTLIER_RATIO, ESTIMATE_PRIOR_SESSIONS, FIX_PARTLY_MIN_MINUTES, PAPER_MIN_PART (+17 more)

### Community 23 - "buildPlanState"
Cohesion: 0.31
Nodes (13): buildPlanState(), endWeeks(), isMajor(), nextRotation(), papersFor(), rotationEnd(), rotationName(), slidesFor() (+5 more)

### Community 24 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 25 - "Locus plan engine: specification"
Cohesion: 0.13
Nodes (14): 10. Time estimates, 11. Invariants, 4.1 Board goals: by topic, 4.2 Uni goals: lectures, summaries, past papers, 4. Sharing time between goals, 5.1 The three days around a firm exam, 5.2 Wind-down before a uni exam, 5.3 After an exam (+6 more)

### Community 26 - "Locus — Phase 0 prototype"
Cohesion: 0.13
Nodes (14): "Already watched" (current system only), Bring in UWorld results, Deploy (Vercel), Design tokens, Dev-only switches (invisible to classmates), Layout, Light days (no post-call questions), Locus — Phase 0 prototype (+6 more)

### Community 27 - "setup.test.ts"
Cohesion: 0.19
Nodes (13): defaultAnswers(), pickUniversity(), RotationEnd, rotationEndAnswered(), DEFAULT_WEEKEND, FRI_SAT, mondayFirst(), SHORT (+5 more)

### Community 28 - "registry.ts"
Cohesion: 0.19
Nodes (10): GLOBAL_DEFAULT, normalize(), searchUniversities(), UniversityData, UniversityPick, MUTAH, templateFor(), UNIVERSITIES (+2 more)

### Community 29 - "personas.ts"
Cohesion: 0.17
Nodes (12): RotationAnswer, startBreak(), afterIM, answers(), build(), chain(), clinical(), dedicated() (+4 more)

### Community 30 - "Commitments.tsx"
Cohesion: 0.13
Nodes (19): TOPIC_ALIASES, busyCost(), busyMinutes(), clockMinutes(), comingUp(), DEADLINE_MIN_CHUNK, Commitment, busyLabel() (+11 more)

### Community 31 - "setup.ts"
Cohesion: 0.07
Nodes (20): addCustomSubject(), allTopics(), boardGoal(), customSubject(), DateAnswer, offersWatched(), plansByTopic(), selectedMaterials() (+12 more)

### Community 32 - "uworldImport.ts"
Cohesion: 0.23
Nodes (12): ALIASES, ImportedSystem, importSummary(), norm(), parseUworldReport(), Raw, readValues(), systemFromLine() (+4 more)

### Community 33 - "Engine notes"
Cohesion: 0.25
Nodes (7): 1. Decisions Omar made (requirements), 2. Conflicts between rules, and how each was resolved, 4. Deviations from the spec, or things it leaves open, 5. What the simulator found (and the fix), 6. What the two independent reviews found, Engine notes, dismissRescue()

### Community 34 - "demo.ts"
Cohesion: 0.08
Nodes (8): BLOCKS, DEMO_TODAY, linaAnswers(), linaState(), seedSessions(), TOPIC_STATE, calm, lina

### Community 35 - "sim.ts"
Cohesion: 0.09
Nodes (14): checkLight(), checkRescue(), newMemory(), Violation, around(), Rng, rng(), DayLog (+6 more)

### Community 36 - "lightday.ts"
Cohesion: 0.10
Nodes (28): ESSENTIAL_TASKS, EXAM_PROTECT_DAYS, LIGHT_DAY_MINUTES, LIGHT_OFFERS_PER_WEEK, OFFER_DECLINED_BACKOFF_DAYS, OFFER_GAP_DAYS, ROUGH_BASELINE_DAYS, ROUGH_LOOKBACK_DAYS (+20 more)

### Community 37 - "invariants.ts"
Cohesion: 0.08
Nodes (3): checkDay(), isStudy(), Memory

### Community 39 - "engine/types.ts"
Cohesion: 0.14
Nodes (22): Suggested data model (proposal, adjust freely), 1.1 What the student gives (stable), 1.2 What the engine records (history), 1.3 What the engine returns, 1. Data model, FixContext, FixPlan, GoalMaterial (+14 more)

### Community 40 - "buildDay"
Cohesion: 0.16
Nodes (18): 3. Situations nobody had designed, and what the engine does now, 2. The study day, 3. How a day is decided, DO_MORE_MINUTES, doMore(), endDay(), nextDay(), rotationEnded() (+10 more)

### Community 41 - "reasons.ts"
Cohesion: 0.16
Nodes (15): vitest, dayName(), MONTHS, MONTHS_LONG, monthYear(), plural(), reasons, shortDate() (+7 more)

### Community 42 - "core.test.ts"
Cohesion: 0.21
Nodes (13): accuracyBySystem(), Band, pct(), SystemAccuracy, CONFIRM_RETEST_AFTER_DAYS, changeFix(), avail, ctx (+5 more)

### Community 43 - "ISODate"
Cohesion: 0.20
Nodes (12): DayContext, dayContext(), localToday(), studyDay(), weekday(), Sitting, BlockResult, DayPlan (+4 more)

### Community 44 - "UworldImport.tsx"
Cohesion: 0.24
Nodes (10): SYSTEM_IDS, SystemDef, SYSTEMS, digits(), Draft, fromDraft(), Mode, ResultTable() (+2 more)

### Community 45 - "duration"
Cohesion: 0.29
Nodes (9): FeatureId, FEATURES, isEnabled(), PRO_GATING, Tier, duration(), num(), range() (+1 more)

### Community 46 - "trim-universities.mjs"
Cohesion: 0.18
Nodes (8): countries, COUNTRY_NAME, data, NAME_FIX, out, unis, PERSONAS, render()

### Community 47 - "engine/index.ts"
Cohesion: 0.35
Nodes (7): demoSweep(), IM_LECTURES_DONE, QBANK_MINUTES_PER_QUESTION, LectureSource, SWEEP, SweepItem, sweepItems()

### Community 48 - "confidence.ts"
Cohesion: 0.33
Nodes (7): Overconfidence, overconfidence(), rateConfident(), TopicScore, CONFIDENCE_REVIEW_MINUTES, CONFIDENCE_WINDOW_DAYS, Confident

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `4. The product: what Locus is` connect `Locus — Project Brief (handoff for Claude Code)` to `engine/types.ts`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `buildDay()` (e.g. with `11. Invariants` and `3. How a day is decided`) actually correct?**
  _`buildDay()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `addDays` be split into smaller, more focused modules?**
  _Cohesion score 0.102322206095791 - nodes in this community are weakly interconnected._
- **Why does `Suggested data model (proposal, adjust freely)` connect `engine/types.ts` to `addDays`, `core.test.ts`, `ISODate`, `Locus — Project Brief (handoff for Claude Code)`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Should `2. Generate: 15 ideas` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._
- **Why does `addDays()` connect `addDays` to `fixes.ts`, `demoStore.ts`, `Pace.tsx`, `exams.ts`, `commitmentParse.ts`, `setup.ts`, `Today.tsx`, `Onboarding.tsx`, `commitments.ts`, `config.ts`, `uni.ts`, `RecallSweep.tsx`, `progress.ts`, `setup.test.ts`, `Commitments.tsx`, `uworldImport.ts`, `lightday.ts`, `buildDay`, `reasons.ts`, `core.test.ts`, `ISODate`, `engine/index.ts`, `confidence.ts`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06970128022759602 - nodes in this community are weakly interconnected._