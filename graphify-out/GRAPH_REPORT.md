# Graph Report - project-planner  (2026-11-18)

## Corpus Check
- 111 files · ~143,368 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: (none) 2, .css 1)

## Summary
- 1338 nodes · 3654 edges · 55 communities (51 shown, 4 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 69 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d0b94102`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- sim.ts
- fixes.ts
- 2. Generate: 15 ideas
- package.json
- engine/topics.ts
- Locus — Project Brief (handoff for Claude Code)
- demoStore.ts
- plan.ts
- engine/index.ts
- commitments.ts
- UworldImport.tsx
- setup.ts
- Today.tsx
- Onboarding
- import.test.ts
- gen-bnb.mjs
- App.tsx
- BlockFinished.tsx
- config.ts
- commitmentParse.ts
- engine.test.ts
- topics.test.ts
- progress.ts
- buildPlanState
- compilerOptions
- Locus plan engine: specification
- Locus — Phase 0 prototype
- uni.ts
- setup.test.ts
- personas.ts
- Commitments.tsx
- Student simulation report: three students, setup plus four days
- Pace.tsx
- pace.ts
- list.ts
- availability.ts
- lightday.ts
- import.test.ts
- rescue.ts
- engine/types.ts
- react
- core.test.ts
- addDays
- ISODate
- commitments.test.ts
- lightday.test.ts
- reasons.ts
- invariants.ts
- day.ts
- progress.ts
- 3. Mistakes that come from the app's origin
- Student simulation, batch 2: 8 new students worldwide + old batch re-rating
- Page
- data/sweep.ts
- rescueCheck

## God Nodes (most connected - your core abstractions)
1. `addDays()` - 79 edges
2. `ISODate` - 46 edges
3. `daysBetween()` - 44 edges
4. `useDemo` - 42 edges
5. `Onboarding()` - 35 edges
6. `buildPlanState()` - 33 edges
7. `Today()` - 32 edges
8. `buildDay()` - 29 edges
9. `Task` - 28 edges
10. `runPersona()` - 27 edges

## Surprising Connections (you probably didn't know these)
- `3. What frustrated the new students, ranked by how many hit it` --references--> `bankSize()`  [INFERRED]
  docs/STUDENT_SIM_REPORT_BATCH2.md → src/data/setup.ts
- `3.4 Language and text parsing` --references--> `busyReduction()`  [INFERRED]
  docs/STUDENT_SIM_REPORT_GLOBAL.md → src/engine/commitments.ts
- `11. Invariants` --references--> `buildDay()`  [INFERRED]
  docs/ENGINE_SPEC.md → src/engine/plan.ts
- `3. Situations nobody had designed, and what the engine does now` --references--> `nextRotation()`  [INFERRED]
  docs/ENGINE_NOTES.md → src/data/setup.ts
- `3. Situations nobody had designed, and what the engine does now` --references--> `startBreak()`  [INFERRED]
  docs/ENGINE_NOTES.md → src/data/setup.ts

## Import Cycles
- 2-file cycle: `src/engine/plan.ts -> src/engine/planSteps.ts -> src/engine/plan.ts`

## Communities (55 total, 4 thin omitted)

### Community 0 - "sim.ts"
Cohesion: 0.16
Nodes (23): 3. Situations nobody had designed, and what the engine does now, 2. The study day, rateConfident(), RETEST_PASS, endDay(), rotationEnded(), startDay(), todayOffer() (+15 more)

### Community 1 - "fixes.ts"
Cohesion: 0.11
Nodes (38): overconfidence(), CONFIRM_RETEST_AFTER_DAYS, FIX_AFTER_BLOCK_DAYS, FIX_CARDS, FIX_MINUTES, MAX_PARKS, MAX_RETEST_FAILS, MIXED_SYSTEM (+30 more)

### Community 2 - "2. Generate: 15 ideas"
Cohesion: 0.04
Nodes (48): 10. Last-48-hours sheet, 11. Quiz-swap buddy, 12. Explain-it-back, 13. Exam-week drop list, 14. Dress rehearsal blocks, 15. Mix-it-up nudge, #1 Exam split → weights: why it could be the reason people choose Locus, 1. Ground it (+40 more)

### Community 3 - "package.json"
Cohesion: 0.06
Nodes (39): dependencies, @fontsource-variable/inter@^5.3.0, lucide-react@^1.73.0, react@^19.3.1, react-dom@^19.3.1, zustand@^5.1.0, devDependencies, playwright@1.63.0 (+31 more)

### Community 4 - "engine/topics.ts"
Cohesion: 0.16
Nodes (31): linkedTopicIds(), topicStep(), activeSystems(), advanceTopic(), applyTopicCompletion(), ceilTo5(), hasItems(), isAllWatched() (+23 more)

### Community 5 - "Locus — Project Brief (handoff for Claude Code)"
Cohesion: 0.06
Nodes (34): 10. Risks and how we test them, 11. Rejected / already discussed (don't re-propose), 12. Open decisions, 13. What I want from Claude Code right now, 1. Who I am (context for decisions), 2. The old project: `productivity-v2`, 3. How the idea evolved (conversation history), 4. The product: what Locus is (+26 more)

### Community 6 - "demoStore.ts"
Cohesion: 0.06
Nodes (15): DayMode, DemoState, initial(), looksValid(), offerCache, Overlay, PlanEdit, recordedMinutes() (+7 more)

### Community 7 - "plan.ts"
Cohesion: 0.10
Nodes (28): CommitmentDay, Estimates, DayInfo, resourcePace(), unitsLeft(), BuildOptions, DayNote, refreshTopicTasks() (+20 more)

### Community 8 - "engine/index.ts"
Cohesion: 0.16
Nodes (18): 9. Fixes from the three-student simulation (17 Nov), vitest, BLOCKS, DEMO_TODAY, linaAnswers(), linaState(), seedSessions(), TOPIC_STATE (+10 more)

### Community 9 - "commitments.ts"
Cohesion: 0.13
Nodes (27): busyCost(), busyMinutes(), busyOn(), busyReduction(), capacity(), ceilTo5(), Chunk, chunkTask() (+19 more)

### Community 10 - "UworldImport.tsx"
Cohesion: 0.16
Nodes (16): SystemResult, AnkiStatus, call(), checkAnki(), reviewedToday(), num(), AnkiConnect(), styles (+8 more)

### Community 11 - "setup.ts"
Cohesion: 0.06
Nodes (38): addCustomSubject(), Answers, customSubject(), DateAnswer, mins(), Subject, subjectFor(), timeNote() (+30 more)

### Community 12 - "Today.tsx"
Cohesion: 0.12
Nodes (26): demoSweep(), canConnectAnki(), ideaEnabled(), clock(), duration(), longDate(), CommitmentLines(), useCommitmentSheet() (+18 more)

### Community 13 - "Onboarding"
Cohesion: 0.22
Nodes (14): bankSize(), dropSubjects(), goalChoices(), goalLabel(), usesSubjects(), Choices(), DateRow(), NumberRow() (+6 more)

### Community 14 - "import.test.ts"
Cohesion: 0.22
Nodes (11): WEAK_BELOW, applyImport(), importedResults(), importReason(), Reported, markWeak(), answers(), rows (+3 more)

### Community 15 - "gen-bnb.mjs"
Cohesion: 0.06
Nodes (28): checklist, emptyTopics, extra, ids, items, listed, MAP, REVIEW (+20 more)

### Community 16 - "App.tsx"
Cohesion: 0.12
Nodes (19): react-dom, App(), initDev(), FeatureId, FEATURES, isEnabled(), PRO_GATING, Tier (+11 more)

### Community 17 - "BlockFinished.tsx"
Cohesion: 0.13
Nodes (25): parseScore(), ScoreInput, westernDigits(), ANKI_CHOICES, AnkiReport(), AnkiSync(), BlockFinished(), capital() (+17 more)

### Community 18 - "config.ts"
Cohesion: 0.06
Nodes (55): ROTATION_SYSTEMS, ACCURACY_WINDOW_DAYS, AMBOSS_MINUTES_PER_TOPIC, ANKI_MAX_NEW_PER_DAY, ANKI_MIN_MINUTES, ANKI_NEW_MIN_HORIZON_DAYS, ANKI_NO_NEW_BEFORE_EXAM_DAYS, BACKLOG_LIMIT_FACTOR (+47 more)

### Community 19 - "commitmentParse.ts"
Cohesion: 0.08
Nodes (43): BUSY, DAY_SRC, dayMonth(), dayOf(), DEADLINE_SOFT, DEADLINE_STRONG, hm(), matchTopic() (+35 more)

### Community 21 - "topics.test.ts"
Cohesion: 0.09
Nodes (13): BNB, BNB_NEEDS_REVIEW, FIRST_AID, FIRST_AID_EXTRACTED, ResourceItem, checklistIds(), topicItems(), watchChecklist() (+5 more)

### Community 22 - "progress.ts"
Cohesion: 0.18
Nodes (11): ESTIMATE_MAX, ESTIMATE_MAX_STEP, ESTIMATE_MIN, ESTIMATE_OUTLIER_RATIO, ESTIMATE_PRIOR_SESSIONS, Blend, blendEstimate(), clamp() (+3 more)

### Community 23 - "buildPlanState"
Cohesion: 0.20
Nodes (20): allTopics(), boardGoal(), buildPlanState(), endWeeks(), hasQbank(), isMajor(), nextRotation(), offersWatched() (+12 more)

### Community 24 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 25 - "Locus plan engine: specification"
Cohesion: 0.14
Nodes (13): 10. Time estimates, 11. Invariants, 4.1 Board goals: by topic, 4.2 Uni goals: lectures, summaries, past papers, 4. Sharing time between goals, 5.1 The three days around a firm exam, 5.2 Wind-down before a uni exam, 5.3 After an exam (+5 more)

### Community 26 - "Locus — Phase 0 prototype"
Cohesion: 0.13
Nodes (14): "Already watched" (current system only), Bring in UWorld results, Deploy (Vercel), Design tokens, Dev-only switches (invisible to classmates), Layout, Light days (no post-call questions), Locus — Phase 0 prototype (+6 more)

### Community 27 - "uni.ts"
Cohesion: 0.11
Nodes (22): LECTURE_MINUTES, LECTURES_AHEAD, LECTURES_DONE_BEFORE_SHARE, LECTURES_MAX_PER_DAY, MIN_TASK_MINUTES, PAPER_MIN_PART, PAPERS_BACKLOAD, PAPERS_LARGE_LECTURES (+14 more)

### Community 28 - "setup.test.ts"
Cohesion: 0.14
Nodes (13): defaultAnswers(), pickUniversity(), RotationEnd, rotationEndAnswered(), DEFAULT_WEEKEND, FRI_SAT, mondayFirst(), SHORT (+5 more)

### Community 29 - "personas.ts"
Cohesion: 0.14
Nodes (17): RotationAnswer, startBreak(), SYSTEM_IDS, SystemDef, SYSTEMS, afterIM, answers(), build() (+9 more)

### Community 30 - "Commitments.tsx"
Cohesion: 0.11
Nodes (13): BusyLabel, cap(), clockRange(), CommitmentSheet(), DAY_SHORT, Draft, fromCommitment(), LENGTHS (+5 more)

### Community 31 - "Student simulation report: three students, setup plus four days"
Cohesion: 0.11
Nodes (18): 1. Summary: the five findings most likely to make a real student stop, 2. The three students, 3. Across students, 4. Bugs, with steps to reproduce, 5. What worked, 6. Where this simulation is probably wrong, 7. Questions for the 10 classmate interviews, 8. Recommended fixes, by impact (made: see section 9) (+10 more)

### Community 32 - "Pace.tsx"
Cohesion: 0.09
Nodes (17): Accuracy(), BAND_BAR, capital(), computePace(), Details(), ImportFromPace(), Load(), nextStep() (+9 more)

### Community 33 - "pace.ts"
Cohesion: 0.18
Nodes (26): Pace = your road to the exam, statedMinutes(), estimates(), studyDaysLeft(), DailyLoad, dailyLoad(), goalMinutesLeft(), goalMinutesOn() (+18 more)

### Community 34 - "list.ts"
Cohesion: 0.07
Nodes (26): 10.1 Setup that fits any student (18 Nov), 10.2 Commitments for every kind of week (18 Nov), 10.3 Defaults that aren't one country's (18 Nov), 10.4 Changing the plan later (18 Nov), 10. Universal fixes (18 Nov), 1. Decisions Omar made (requirements), 2. Conflicts between rules, and how each was resolved, 4. Deviations from the spec, or things it leaves open (+18 more)

### Community 35 - "availability.ts"
Cohesion: 0.24
Nodes (8): DayContext, dayContext(), DayKind, weekday(), DayType, Sitting, DayPlan, DayLog

### Community 36 - "lightday.ts"
Cohesion: 0.11
Nodes (19): 8. Follow-ups from the progress report (16 Nov), ESSENTIAL_TASKS, EXAM_PROTECT_DAYS, FIRST_NIGHT_FROM_HOUR, LIGHT_DAY_MINUTES, LIGHT_OFFERS_PER_WEEK, LONG_BUSY_MINUTES, OFFER_DECLINED_BACKOFF_DAYS (+11 more)

### Community 37 - "import.test.ts"
Cohesion: 0.31
Nodes (9): ALIASES, ImportedSystem, importSummary(), norm(), parseUworldReport(), Raw, readValues(), systemFromLine() (+1 more)

### Community 38 - "rescue.ts"
Cohesion: 0.11
Nodes (22): RESCUE_COOLDOWN_DAYS, RESCUE_COOLDOWN_FACTOR, RESCUE_DISMISS_DAYS, RESCUE_EXTRA_MINUTES, RESCUE_EXTRA_STEP, RESCUE_MAX_DROP_SHARE, RESCUE_MAX_EXTRA, RESCUE_MAX_MOVE_DAYS (+14 more)

### Community 39 - "engine/types.ts"
Cohesion: 0.13
Nodes (23): Suggested data model (proposal, adjust freely), 1.1 What the student gives (stable), 1.2 What the engine records (history), 1.3 What the engine returns, 1. Data model, FixContext, GoalMaterial, AnkiDeck (+15 more)

### Community 40 - "react"
Cohesion: 0.38
Nodes (6): lucide-react, react, PlanLine(), WeekendLine(), Sheet(), Stepper()

### Community 41 - "core.test.ts"
Cohesion: 0.11
Nodes (4): avail, ctx, topics, uworld

### Community 42 - "addDays"
Cohesion: 0.16
Nodes (23): accuracyBySystem(), Band, pct(), recentAccuracy(), SystemAccuracy, DAY_ENDS_HOUR, addDays(), daysBetween() (+15 more)

### Community 43 - "ISODate"
Cohesion: 0.19
Nodes (15): Overconfidence, TopicScore, BlockResult, RescueOption, LectureSource, SweepOutcome, sweepOutcome(), sweepTaskId() (+7 more)

### Community 46 - "reasons.ts"
Cohesion: 0.18
Nodes (15): eveTasks(), count(), dayName(), inSentence(), listJoin(), MONTHS, MONTHS_LONG, monthYear() (+7 more)

### Community 47 - "invariants.ts"
Cohesion: 0.38
Nodes (12): activeGoals(), dayInfo(), isPaused(), lastSitting(), sittings(), studies(), windDownGoals(), retestReady() (+4 more)

### Community 48 - "day.ts"
Cohesion: 0.23
Nodes (12): 3. How a day is decided, 3.6 Not from the origin, but found here (affects everyone), DO_MORE_MINUTES, doMore(), fitToday(), nextDay(), replanToday(), spentMinutes() (+4 more)

### Community 49 - "progress.ts"
Cohesion: 0.24
Nodes (12): applyCommitmentWork(), PARTLY_SHARE, applyCompletion(), assume(), assumeDone(), previewTomorrow(), roundTo5(), TaskReport (+4 more)

### Community 50 - "3. Mistakes that come from the app's origin"
Cohesion: 0.17
Nodes (11): 1. Method, 2. The most common complaints, 3.1 "Every rotation ends in an exam, with lectures" (Mutah assumption), 3.2 "The board exam is USMLE, studied with UWorld and Anki", 3.3 "Study happens in the evening, after the hospital" (Jordan routine), 3.4 Language and text parsing, 3.5 University search and weekends, 3. Mistakes that come from the app's origin (+3 more)

### Community 51 - "Student simulation, batch 2: 8 new students worldwide + old batch re-rating"
Cohesion: 0.20
Nodes (9): 1. Method, 2. The headline, 3. What frustrated the new students, ranked by how many hit it, 4. What they liked most, and what they like but want better, 5. Before → after (productivity), 6. Old batch re-rating: did the batch-1 fixes land?, 7. Do they complain about the same things as batch 1?, 8. Observations for Omar (no code changed; your call) (+1 more)

### Community 52 - "Page"
Cohesion: 0.48
Nodes (4): useLongPress(), Nav(), TABS, Page()

### Community 54 - "rescueCheck"
Cohesion: 0.83
Nodes (4): 9. Rescue mode, minutesShort(), rescueCheck(), rescueOptions()

## Knowledge Gaps
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Suggested data model (proposal, adjust freely)` connect `engine/types.ts` to `fixes.ts`, `ISODate`, `Locus — Project Brief (handoff for Claude Code)`, `rescue.ts`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Should `fixes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10685249709639953 - nodes in this community are weakly interconnected._
- **Why does `4. The product: what Locus is` connect `Locus — Project Brief (handoff for Claude Code)` to `engine/types.ts`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Should `2. Generate: 15 ideas` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._
- **Why does `buildDay()` connect `day.ts` to `sim.ts`, `lightday.ts`, `demoStore.ts`, `plan.ts`, `engine/index.ts`, `addDays`, `import.test.ts`, `invariants.ts`, `progress.ts`, `Locus plan engine: specification`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06463414634146342 - nodes in this community are weakly interconnected._
- **Should `Locus — Project Brief (handoff for Claude Code)` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._