# Graph Report - project-planner  (2026-11-15)

## Corpus Check
- 99 files · ~101,289 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: (none) 2, .css 1)

## Summary
- 1004 nodes · 3295 edges · 34 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 45 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f0fdf054`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- addDays
- engine/types.ts
- 2. Generate: 15 ideas
- package.json
- engine/topics.ts
- Locus — Project Brief (handoff for Claude Code)
- demoStore.ts
- Pace.tsx
- config.ts
- commitmentParse.ts
- App.tsx
- setup.ts
- Today.tsx
- Onboarding.tsx
- commitments.ts
- gen-bnb.mjs
- UworldImport.tsx
- BlockFinished.tsx
- plan.ts
- uni.ts
- RecallSweep.tsx
- topics.test.ts
- lightday.test.ts
- buildPlanState
- compilerOptions
- Locus plan engine: specification
- Locus — Phase 0 prototype
- setup.test.ts
- registry.ts
- personas.ts
- Commitments.tsx
- progress.ts
- uworldImport.ts
- Engine notes

## God Nodes (most connected - your core abstractions)
1. `addDays()` - 97 edges
2. `buildDay()` - 54 edges
3. `useDemo` - 54 edges
4. `ISODate` - 51 edges
5. `daysBetween()` - 45 edges
6. `Today()` - 38 edges
7. `buildPlanState()` - 34 edges
8. `Task` - 34 edges
9. `EngineState` - 34 edges
10. `Onboarding()` - 33 edges

## Surprising Connections (you probably didn't know these)
- `11. Invariants` --references--> `buildDay()`  [INFERRED]
  docs/ENGINE_SPEC.md → src/engine/plan.ts
- `9. Rescue mode` --references--> `rescueCheck()`  [INFERRED]
  docs/ENGINE_SPEC.md → src/engine/rescue.ts
- `3. Situations nobody had designed, and what the engine does now` --references--> `nextRotation()`  [INFERRED]
  docs/ENGINE_NOTES.md → src/data/setup.ts
- `Suggested data model (proposal, adjust freely)` --references--> `Goal`  [INFERRED]
  CLAUDE.md → src/engine/types.ts
- `1.1 What the student gives (stable)` --references--> `Goal`  [INFERRED]
  docs/ENGINE_SPEC.md → src/engine/types.ts

## Import Cycles
- None detected.

## Communities (34 total, 0 thin omitted)

### Community 0 - "addDays"
Cohesion: 0.06
Nodes (112): 3. Situations nobody had designed, and what the engine does now, 2. The study day, 3. How a day is decided, Pace = your road to the exam, startBreak(), statedMinutes(), capacity(), CommitmentDay (+104 more)

### Community 1 - "engine/types.ts"
Cohesion: 0.06
Nodes (81): Suggested data model (proposal, adjust freely), 1.1 What the student gives (stable), 1.2 What the engine records (history), 1.3 What the engine returns, 1. Data model, BLOCKS, linaAnswers(), linaState() (+73 more)

### Community 2 - "2. Generate: 15 ideas"
Cohesion: 0.04
Nodes (48): 10. Last-48-hours sheet, 11. Quiz-swap buddy, 12. Explain-it-back, 13. Exam-week drop list, 14. Dress rehearsal blocks, 15. Mix-it-up nudge, #1 Exam split → weights: why it could be the reason people choose Locus, 1. Ground it (+40 more)

### Community 3 - "package.json"
Cohesion: 0.07
Nodes (38): dependencies, @fontsource-variable/inter@^5.3.0, lucide-react@^1.73.0, react@^19.3.1, react-dom@^19.3.1, zustand@^5.1.0, devDependencies, tailwindcss@^4.3.5 (+30 more)

### Community 4 - "engine/topics.ts"
Cohesion: 0.11
Nodes (39): recentAccuracy(), QUEUE_NEXT_SYSTEMS, checkTitle(), pickSystem(), refreshTopicTasks(), topicTask(), inSentence(), cap() (+31 more)

### Community 5 - "Locus — Project Brief (handoff for Claude Code)"
Cohesion: 0.06
Nodes (34): 10. Risks and how we test them, 11. Rejected / already discussed (don't re-propose), 12. Open decisions, 13. What I want from Claude Code right now, 1. Who I am (context for decisions), 2. The old project: `productivity-v2`, 3. How the idea evolved (conversation history), 4. The product: what Locus is (+26 more)

### Community 6 - "demoStore.ts"
Cohesion: 0.09
Nodes (31): demoSweep(), IM_LECTURES_DONE, DayKind, QBANK_MINUTES_PER_QUESTION, localToday(), studyDay(), DayNote, Outcome (+23 more)

### Community 7 - "Pace.tsx"
Cohesion: 0.11
Nodes (30): DEMO_TODAY, band(), toDate(), importedResults(), count(), dayName(), MONTHS, MONTHS_LONG (+22 more)

### Community 8 - "config.ts"
Cohesion: 0.07
Nodes (32): ROTATION_SYSTEMS, ACCURACY_WINDOW_DAYS, AMBOSS_MINUTES_PER_TOPIC, BNB_MINUTES_PER_VIDEO, BORDERLINE_FROM, DO_MORE_MINUTES, FIRST_AID_MINUTES_PER_SECTION, LOOP_RESERVE_DAYS (+24 more)

### Community 9 - "commitmentParse.ts"
Cohesion: 0.10
Nodes (27): TOPIC_ALIASES, DayContext, dayContext(), BUSY, dayMonth(), DEADLINE_SOFT, DEADLINE_STRONG, hm() (+19 more)

### Community 10 - "App.tsx"
Cohesion: 0.14
Nodes (18): react, App(), initDev(), clock(), useLongPress(), REDUCED_MOTION, useMedia(), AnkiConnect() (+10 more)

### Community 11 - "setup.ts"
Cohesion: 0.13
Nodes (28): Answers, WatchGroup, ANKI_NEW_UNSURE, ANKI_REVIEW_DEFAULT, DEFAULT_WEEKEND_COUNTRY, GOALS, GoalTemplate, LECTURES_LEFT_UNSURE (+20 more)

### Community 12 - "Today.tsx"
Cohesion: 0.12
Nodes (28): WEEKDAYS_SHORT, lightTasks(), taskImpact(), totalMinutes(), inDays(), isSystemDone(), systemProgress(), FeatureId (+20 more)

### Community 13 - "Onboarding.tsx"
Cohesion: 0.14
Nodes (26): addCustomSubject(), checklistIds(), DateAnswer, dropSubjects(), goalChoices(), goalLabel(), Subject, toggleSubject() (+18 more)

### Community 14 - "commitments.ts"
Cohesion: 0.12
Nodes (23): busyCost(), busyMinutes(), busyOn(), busyReduction(), ceilTo5(), Chunk, chunkTask(), clockMinutes() (+15 more)

### Community 15 - "gen-bnb.mjs"
Cohesion: 0.07
Nodes (22): checklist, emptyTopics, extra, ids, items, listed, MAP, REVIEW (+14 more)

### Community 16 - "UworldImport.tsx"
Cohesion: 0.14
Nodes (21): weeklyReport(), duration(), num(), range(), applyTheme(), listeners, setTheme(), Theme (+13 more)

### Community 17 - "BlockFinished.tsx"
Cohesion: 0.23
Nodes (23): lucide-react, isEnabled(), ANKI_CHOICES, AnkiReport(), AutoReport(), BlockFinished(), capital(), COMPLETION (+15 more)

### Community 18 - "plan.ts"
Cohesion: 0.08
Nodes (25): ANKI_MIN_MINUTES, BACKLOG_LIMIT_FACTOR, CLOSE_EXAMS_DAYS, EVE_MAX_MINUTES, EVE_MAX_SHARE, EVE_MIN_MINUTES, FIXLOOP_SHARE, FIXLOOP_SHARE_BACKLOG (+17 more)

### Community 19 - "uni.ts"
Cohesion: 0.12
Nodes (21): LECTURE_MINUTES, LECTURES_AHEAD, LECTURES_DONE_BEFORE_SHARE, LECTURES_MAX_PER_DAY, MIN_TASK_MINUTES, PAPER_MIN_PART, PAPERS_BACKLOAD, PAPERS_LARGE_LECTURES (+13 more)

### Community 20 - "RecallSweep.tsx"
Cohesion: 0.21
Nodes (19): Recall, done(), isRTL(), play(), prefersReduced(), REDUCED_FADE, spring(), SPRING (+11 more)

### Community 21 - "topics.test.ts"
Cohesion: 0.17
Nodes (15): BNB, BNB_NEEDS_REVIEW, FIRST_AID, FIRST_AID_EXTRACTED, ResourceItem, allTopics(), topicItems(), SYSTEM_IDS (+7 more)

### Community 22 - "lightday.test.ts"
Cohesion: 0.13
Nodes (17): ESSENTIAL_TASKS, ESTIMATE_MAX, ESTIMATE_MAX_STEP, ESTIMATE_MIN, ESTIMATE_OUTLIER_RATIO, ESTIMATE_PRIOR_SESSIONS, LIGHT_DAY_MINUTES, Blend (+9 more)

### Community 23 - "buildPlanState"
Cohesion: 0.19
Nodes (19): boardGoal(), buildPlanState(), endWeeks(), isMajor(), nextRotation(), offersWatched(), papersFor(), plansByTopic() (+11 more)

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
Cohesion: 0.23
Nodes (8): GLOBAL_DEFAULT, normalize(), searchUniversities(), UniversityData, MUTAH, UNIVERSITIES, ExamFormat, UniversityTemplate

### Community 29 - "personas.ts"
Cohesion: 0.21
Nodes (13): customSubject(), RotationAnswer, subjectFor(), afterIM, answers(), build(), chain(), clinical() (+5 more)

### Community 30 - "Commitments.tsx"
Cohesion: 0.23
Nodes (13): comingUp(), busyLabel(), cap(), clockRange(), CommitmentLines(), CommitmentSheet(), Draft, fromCommitment() (+5 more)

### Community 31 - "progress.ts"
Cohesion: 0.29
Nodes (11): applyCommitmentWork(), PARTLY_SHARE, applyCompletion(), assume(), assumeDone(), previewTomorrow(), roundTo5(), studiedMinutes() (+3 more)

### Community 32 - "uworldImport.ts"
Cohesion: 0.31
Nodes (9): ALIASES, ImportedSystem, importSummary(), norm(), parseUworldReport(), Raw, readValues(), systemFromLine() (+1 more)

### Community 33 - "Engine notes"
Cohesion: 0.33
Nodes (5): 1. Decisions Omar made (requirements), 2. Conflicts between rules, and how each was resolved, 4. Deviations from the spec, or things it leaves open, 5. What the simulator found (and the fix), Engine notes

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `addDays()` connect `addDays` to `engine/types.ts`, `engine/topics.ts`, `demoStore.ts`, `Pace.tsx`, `commitmentParse.ts`, `setup.ts`, `Today.tsx`, `Onboarding.tsx`, `commitments.ts`, `UworldImport.tsx`, `BlockFinished.tsx`, `plan.ts`, `uni.ts`, `topics.test.ts`, `lightday.test.ts`, `buildPlanState`, `setup.test.ts`, `personas.ts`, `Commitments.tsx`, `progress.ts`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `buildDay()` (e.g. with `11. Invariants` and `3. How a day is decided`) actually correct?**
  _`buildDay()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `addDays` be split into smaller, more focused modules?**
  _Cohesion score 0.061644763582170435 - nodes in this community are weakly interconnected._
- **Why does `4. The product: what Locus is` connect `Locus — Project Brief (handoff for Claude Code)` to `engine/types.ts`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Should `engine/types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05696636925188744 - nodes in this community are weakly interconnected._
- **Why does `Suggested data model (proposal, adjust freely)` connect `engine/types.ts` to `addDays`, `Locus — Project Brief (handoff for Claude Code)`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Should `2. Generate: 15 ideas` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._