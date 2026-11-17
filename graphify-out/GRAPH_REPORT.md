# Graph Report - project-planner  (2026-11-17)

## Corpus Check
- 107 files · ~131,652 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: (none) 2, .css 1)

## Summary
- 1121 nodes · 3680 edges · 46 communities
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 62 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1cabf379`
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
- unitsLeft
- demo.ts
- commitments.ts
- Button
- setup.ts
- Today.tsx
- Onboarding.tsx
- imported.ts
- gen-bnb.mjs
- theme.ts
- BlockFinished.tsx
- config.ts
- commitmentParse.ts
- RecallSweep.tsx
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
- Engine notes
- default.ts
- ISODate
- lightday.ts
- import.test.ts
- report.ts
- engine/types.ts
- UworldImport.tsx
- core.test.ts
- accuracy.ts
- confidence.ts
- dates.ts
- react

## God Nodes (most connected - your core abstractions)
1. `addDays()` - 101 edges
2. `useDemo` - 58 edges
3. `daysBetween()` - 57 edges
4. `ISODate` - 54 edges
5. `Today()` - 39 edges
6. `buildPlanState()` - 36 edges
7. `Task` - 36 edges
8. `buildDay()` - 35 edges
9. `EngineState` - 35 edges
10. `Onboarding()` - 35 edges

## Surprising Connections (you probably didn't know these)
- `11. Invariants` --references--> `buildDay()`  [INFERRED]
  docs/ENGINE_SPEC.md → src/engine/plan.ts
- `10. Time estimates` --references--> `studiedOn()`  [INFERRED]
  docs/ENGINE_SPEC.md → src/engine/progress.ts
- `6. What the two independent reviews found` --references--> `dismissRescue()`  [INFERRED]
  docs/ENGINE_NOTES.md → src/engine/rescue.ts
- `3. Situations nobody had designed, and what the engine does now` --references--> `nextRotation()`  [INFERRED]
  docs/ENGINE_NOTES.md → src/data/setup.ts
- `8. Follow-ups from the progress report (16 Nov)` --references--> `timeNote()`  [INFERRED]
  docs/ENGINE_NOTES.md → src/data/setup.ts

## Import Cycles
- 2-file cycle: `src/engine/plan.ts -> src/engine/planSteps.ts -> src/engine/plan.ts`

## Communities (46 total, 0 thin omitted)

### Community 0 - "addDays"
Cohesion: 0.06
Nodes (101): 3. Situations nobody had designed, and what the engine does now, 2. The study day, 3. How a day is decided, 9. Rescue mode, startBreak(), statedMinutes(), DeadlinePlan, DO_MORE_MINUTES (+93 more)

### Community 1 - "fixes.ts"
Cohesion: 0.12
Nodes (19): FIX_AFTER_BLOCK_DAYS, FIX_CARDS, FIX_MINUTES, MAX_PARKS, MAX_RETEST_FAILS, PARK_DAYS, RETEST_AFTER_FIX_DAYS, RETEST_BORDERLINE_QUESTIONS (+11 more)

### Community 2 - "2. Generate: 15 ideas"
Cohesion: 0.04
Nodes (48): 10. Last-48-hours sheet, 11. Quiz-swap buddy, 12. Explain-it-back, 13. Exam-week drop list, 14. Dress rehearsal blocks, 15. Mix-it-up nudge, #1 Exam split → weights: why it could be the reason people choose Locus, 1. Ground it (+40 more)

### Community 3 - "package.json"
Cohesion: 0.06
Nodes (40): dependencies, @fontsource-variable/inter@^5.3.0, lucide-react@^1.73.0, react@^19.3.1, react-dom@^19.3.1, zustand@^5.1.0, devDependencies, playwright@1.63.0 (+32 more)

### Community 4 - "engine/topics.ts"
Cohesion: 0.12
Nodes (36): linkedTopicIds(), QUEUE_NEXT_SYSTEMS, refreshTopicTasks(), checkTitle(), topicStep(), topicTask(), inSentence(), systemsByWeight() (+28 more)

### Community 5 - "Locus — Project Brief (handoff for Claude Code)"
Cohesion: 0.06
Nodes (34): 10. Risks and how we test them, 11. Rejected / already discussed (don't re-propose), 12. Open decisions, 13. What I want from Claude Code right now, 1. Who I am (context for decisions), 2. The old project: `productivity-v2`, 3. How the idea evolved (conversation history), 4. The product: what Locus is (+26 more)

### Community 6 - "demoStore.ts"
Cohesion: 0.10
Nodes (31): demoSweep(), IM_LECTURES_DONE, DayKind, QBANK_MINUTES_PER_QUESTION, SystemResult, DayNote, Outcome, TaskReport (+23 more)

### Community 7 - "unitsLeft"
Cohesion: 0.36
Nodes (8): resourcePace(), unitsLeft(), blockMinutes(), blockStep(), blockTitle(), growStep(), pickSystem(), studyStep()

### Community 8 - "demo.ts"
Cohesion: 0.23
Nodes (11): vitest, BLOCKS, DEMO_TODAY, linaAnswers(), linaState(), seedSessions(), TOPIC_STATE, GAP_MAX_EXTRA_PER_DAY (+3 more)

### Community 9 - "commitments.ts"
Cohesion: 0.09
Nodes (33): TOPIC_ALIASES, applyCommitmentWork(), busyCost(), busyMinutes(), busyOn(), busyReduction(), capacity(), ceilTo5() (+25 more)

### Community 10 - "Button"
Cohesion: 0.18
Nodes (13): AnkiStatus, call(), checkAnki(), reviewedToday(), useLongPress(), AnkiConnect(), Tab, Button() (+5 more)

### Community 11 - "setup.ts"
Cohesion: 0.11
Nodes (30): Answers, WatchGroup, ANKI_NEW_UNSURE, ANKI_REVIEW_DEFAULT, DEFAULT_WEEKEND_COUNTRY, GOALS, GoalTemplate, LECTURES_LEFT_UNSURE (+22 more)

### Community 12 - "Today.tsx"
Cohesion: 0.15
Nodes (26): totalMinutes(), studiedOn(), count(), isSystemDone(), systemProgress(), watchedIds(), canConnectAnki(), ideaEnabled() (+18 more)

### Community 13 - "Onboarding.tsx"
Cohesion: 0.15
Nodes (26): addCustomSubject(), checklistIds(), DateAnswer, dropSubjects(), goalChoices(), goalLabel(), offersWatched(), rotationEndAnswered() (+18 more)

### Community 14 - "imported.ts"
Cohesion: 0.83
Nodes (3): applyImport(), importReason(), markWeak()

### Community 15 - "gen-bnb.mjs"
Cohesion: 0.05
Nodes (30): checklist, emptyTopics, extra, ids, items, listed, MAP, REVIEW (+22 more)

### Community 16 - "theme.ts"
Cohesion: 0.33
Nodes (7): applyTheme(), listeners, setTheme(), Theme, useTheme(), OPTIONS, ThemeSwitch()

### Community 17 - "BlockFinished.tsx"
Cohesion: 0.21
Nodes (24): lucide-react, RETEST_PASS, parseScore(), ScoreInput, westernDigits(), ANKI_CHOICES, AnkiReport(), AnkiSync() (+16 more)

### Community 18 - "config.ts"
Cohesion: 0.08
Nodes (42): AMBOSS_MINUTES_PER_TOPIC, ANKI_MAX_NEW_PER_DAY, ANKI_MIN_MINUTES, ANKI_NEW_MIN_HORIZON_DAYS, ANKI_NO_NEW_BEFORE_EXAM_DAYS, BACKLOG_LIMIT_FACTOR, BACKLOG_NEW_TOPICS_PER_DAY, BLOCK_SAME_SYSTEM_DAYS (+34 more)

### Community 19 - "commitmentParse.ts"
Cohesion: 0.12
Nodes (23): BUSY, dayMonth(), DEADLINE_SOFT, DEADLINE_STRONG, hm(), matchTopic(), MONTHS, nextWeekday() (+15 more)

### Community 20 - "RecallSweep.tsx"
Cohesion: 0.23
Nodes (18): done(), isRTL(), play(), prefersReduced(), REDUCED_FADE, spring(), SPRING, springAt() (+10 more)

### Community 21 - "topics.test.ts"
Cohesion: 0.20
Nodes (13): BNB, BNB_NEEDS_REVIEW, FIRST_AID, FIRST_AID_EXTRACTED, ResourceItem, watchChecklist(), SYSTEM_IDS, SystemDef (+5 more)

### Community 22 - "progress.ts"
Cohesion: 0.20
Nodes (10): ESTIMATE_MAX, ESTIMATE_MIN, ESTIMATE_OUTLIER_RATIO, ESTIMATE_PRIOR_SESSIONS, Blend, blendEstimate(), clamp(), DEFAULT_ESTIMATES (+2 more)

### Community 23 - "buildPlanState"
Cohesion: 0.19
Nodes (20): allTopics(), boardGoal(), buildPlanState(), endWeeks(), isMajor(), nextRotation(), papersFor(), plansByTopic() (+12 more)

### Community 24 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 25 - "Locus plan engine: specification"
Cohesion: 0.17
Nodes (11): 10. Time estimates, 11. Invariants, 5.1 The three days around a firm exam, 5.2 Wind-down before a uni exam, 5.3 After an exam, 5. Exams, 6. The fix → retest loop, 7. Commitments (+3 more)

### Community 26 - "Locus — Phase 0 prototype"
Cohesion: 0.13
Nodes (14): "Already watched" (current system only), Bring in UWorld results, Deploy (Vercel), Design tokens, Dev-only switches (invisible to classmates), Layout, Light days (no post-call questions), Locus — Phase 0 prototype (+6 more)

### Community 27 - "uni.ts"
Cohesion: 0.11
Nodes (23): LECTURE_MINUTES, LECTURES_AHEAD, LECTURES_DONE_BEFORE_SHARE, LECTURES_MAX_PER_DAY, MIN_TASK_MINUTES, PAPER_MIN_PART, PAPERS_BACKLOAD, PAPERS_LARGE_LECTURES (+15 more)

### Community 28 - "setup.test.ts"
Cohesion: 0.15
Nodes (16): pickUniversity(), RotationEnd, LEADING, loadUniversities(), normalize(), searchUniversities(), UniversityData, UNIVERSITIES (+8 more)

### Community 29 - "personas.ts"
Cohesion: 0.21
Nodes (13): customSubject(), RotationAnswer, subjectFor(), afterIM, answers(), build(), chain(), clinical() (+5 more)

### Community 30 - "Commitments.tsx"
Cohesion: 0.13
Nodes (23): comingUp(), FeatureId, FEATURES, isEnabled(), PRO_GATING, Tier, duration(), range() (+15 more)

### Community 31 - "Student simulation report: three students, setup plus four days"
Cohesion: 0.11
Nodes (18): 1. Summary: the five findings most likely to make a real student stop, 2. The three students, 3. Across students, 4. Bugs, with steps to reproduce, 5. What worked, 6. Where this simulation is probably wrong, 7. Questions for the 10 classmate interviews, 8. Recommended fixes, by impact (made: see section 9) (+10 more)

### Community 32 - "Pace.tsx"
Cohesion: 0.06
Nodes (58): 9. Fixes from the three-student simulation (17 Nov), 4.1 Board goals: by topic, 4.2 Uni goals: lectures, summaries, past papers, 4. Sharing time between goals, Pace = your road to the exam, mins(), timeNote(), band() (+50 more)

### Community 33 - "Engine notes"
Cohesion: 0.25
Nodes (7): 1. Decisions Omar made (requirements), 2. Conflicts between rules, and how each was resolved, 4. Deviations from the spec, or things it leaves open, 5. What the simulator found (and the fix), 6. What the two independent reviews found, 7. Changes after Omar's feedback (16 Nov), Engine notes

### Community 34 - "default.ts"
Cohesion: 0.18
Nodes (12): GLOBAL_DEFAULT, ROTATION_SYSTEMS, MUTAH, ExamFormat, UniversityTemplate, PAPER_MINUTES, PAPERS_WINDOW_LARGE, PAPERS_WINDOW_SMALL (+4 more)

### Community 35 - "ISODate"
Cohesion: 0.17
Nodes (19): Subject, DayContext, dayContext(), CommitmentDay, weekday(), Estimates, DayType, Sitting (+11 more)

### Community 36 - "lightday.ts"
Cohesion: 0.09
Nodes (24): 8. Follow-ups from the progress report (16 Nov), ESSENTIAL_TASKS, ESTIMATE_MAX_STEP, EXAM_PROTECT_DAYS, FIRST_NIGHT_FROM_HOUR, LIGHT_DAY_MINUTES, LIGHT_OFFERS_PER_WEEK, OFFER_DECLINED_BACKOFF_DAYS (+16 more)

### Community 37 - "import.test.ts"
Cohesion: 0.20
Nodes (14): defaultAnswers(), ALIASES, ImportedSystem, importSummary(), norm(), parseUworldReport(), Raw, readValues() (+6 more)

### Community 38 - "report.ts"
Cohesion: 0.37
Nodes (13): overconfidence(), fixOptions(), goalMaterial(), planFix(), retestTask(), systemTopic(), systemTopicId(), topicPhrase() (+5 more)

### Community 39 - "engine/types.ts"
Cohesion: 0.13
Nodes (24): Suggested data model (proposal, adjust freely), 1.1 What the student gives (stable), 1.2 What the engine records (history), 1.3 What the engine returns, 1. Data model, ResourceTemplate, FixContext, FixPlan (+16 more)

### Community 40 - "UworldImport.tsx"
Cohesion: 0.29
Nodes (10): num(), FixPicker(), Chip(), digits(), Draft, fromDraft(), Mode, ResultTable() (+2 more)

### Community 41 - "core.test.ts"
Cohesion: 0.29
Nodes (6): CONFIRM_RETEST_AFTER_DAYS, changeFix(), avail, ctx, topics, uworld

### Community 42 - "accuracy.ts"
Cohesion: 0.31
Nodes (11): accuracyBySystem(), Band, pct(), recentAccuracy(), SystemAccuracy, ACCURACY_WINDOW_DAYS, BORDERLINE_FROM, IMPORT_REPLACED_BY_QUESTIONS (+3 more)

### Community 43 - "confidence.ts"
Cohesion: 0.36
Nodes (6): Overconfidence, rateConfident(), TopicScore, CONFIDENCE_REVIEW_MINUTES, CONFIDENCE_WINDOW_DAYS, Confident

### Community 44 - "dates.ts"
Cohesion: 0.50
Nodes (4): DAY_ENDS_HOUR, localToday(), studyDay(), initial()

### Community 45 - "react"
Cohesion: 0.24
Nodes (9): react, App(), initDev(), clock(), REDUCED_MOTION, useMedia(), Running(), ProgressBar() (+1 more)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `addDays()` connect `addDays` to `fixes.ts`, `demoStore.ts`, `unitsLeft`, `demo.ts`, `commitments.ts`, `setup.ts`, `Today.tsx`, `Onboarding.tsx`, `imported.ts`, `BlockFinished.tsx`, `config.ts`, `commitmentParse.ts`, `topics.test.ts`, `buildPlanState`, `uni.ts`, `setup.test.ts`, `personas.ts`, `Commitments.tsx`, `Pace.tsx`, `ISODate`, `lightday.ts`, `import.test.ts`, `report.ts`, `core.test.ts`, `accuracy.ts`, `confidence.ts`, `dates.ts`?**
  _High betweenness centrality (0.125) - this node is a cross-community bridge._
- **Should `addDays` be split into smaller, more focused modules?**
  _Cohesion score 0.06218144750254842 - nodes in this community are weakly interconnected._
- **Why does `ISODate` connect `ISODate` to `addDays`, `fixes.ts`, `engine/topics.ts`, `demoStore.ts`, `demo.ts`, `commitments.ts`, `setup.ts`, `Today.tsx`, `imported.ts`, `config.ts`, `commitmentParse.ts`, `RecallSweep.tsx`, `uni.ts`, `personas.ts`, `Commitments.tsx`, `Pace.tsx`, `lightday.ts`, `report.ts`, `engine/types.ts`, `accuracy.ts`, `confidence.ts`, `dates.ts`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Should `fixes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11904761904761904 - nodes in this community are weakly interconnected._
- **Why does `buildDay()` connect `addDays` to `Pace.tsx`, `ISODate`, `lightday.ts`, `import.test.ts`, `demoStore.ts`, `unitsLeft`, `demo.ts`, `commitments.ts`, `core.test.ts`, `BlockFinished.tsx`, `config.ts`, `topics.test.ts`, `Locus plan engine: specification`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Should `2. Generate: 15 ideas` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06387921022067364 - nodes in this community are weakly interconnected._