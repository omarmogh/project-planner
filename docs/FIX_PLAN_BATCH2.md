# Fix plan: batch-2 complaints (shared brief for all lanes)

Repo: /home/user/project-planner (branch claude/epic-gates-j4pjav). Read CLAUDE.md sections 4, 4b, 11 first.
Evidence: docs/STUDENT_SIM_REPORT_BATCH2.md (sections 3, 6, 8). Raw student notes (gitignored, read-only,
NEVER commit): sim-students/batch2/<CODE>/ and sim-students/batch2/re-<CODE>/.

## Owner decisions (from Omar, 18 Nov 2026)
- Fix CORE problems. Do NOT work on: language/RTL/Arabizi/local day words ("viernes", "bukra"),
  local licensing exams (KMLE, PLE, TUS, LEK, NEET-PG, ENARM, SMLE, PLAB), national holidays.
- Scope stays USMLE + university. But university tracking must be first-class, not a USMLE afterthought,
  and basic-year students (no rotations) must be served.
- Students using other question banks (not UWorld/AMBOSS) must be able to paste or import their results.
- Goal: students say "I'd recommend it / keep using it / it improved my confidence and scores".

## Saving credits
- Locate code with Graphify before reading files: `graphify query "<question>" --budget 1500`,
  `graphify explain "<symbol>"`, `graphify affected "<symbol>"`. Read only the parts you need.
- Do not commit. Do not push. The lead commits by path after review.
- Other lanes edit other files at the same time. Only edit files your lane owns. If typecheck fails in a
  file you don't own, ignore it and say so in your report.
- `npm test` (includes the 27-persona simulator) must pass for your files. `npx tsc --noEmit` clean for your files.
- Final report: under 300 words. Files changed, the API other lanes need (exact names/signatures),
  what you verified, what you skipped and why.

## Universal design rules (apply everywhere)
- "Not sure" never becomes a specific big number shown or used as the student's number. "Don't know yet"
  never becomes a date that the app judges pace against.
- Never show three-digit hour gaps or "X h a day needed" on a first screen. Unknown → say so calmly.
- Never say "You're on track" when there is no exam ahead or the app can't see the work.
- No USMLE/UWorld wording for a student who has no USMLE goal / no UWorld.
- Every tunable number in src/engine/config.ts. Update docs/ENGINE_SPEC.md + ENGINE_NOTES.md with engine changes.

## Lanes and file ownership

### Lane E: engine (Opus). Owns src/engine/** (not imported.ts), src/data/setup.ts, src/data/templates.ts,
src/data/topics.ts, src/data/universities/**, src/engine/__tests__/** (not import.test.ts), tests/sim/**, docs/ENGINE_*.
E1. Several exams and the next rotation WITHOUT a reset. Pure functions (e.g. src/engine/planEdits.ts):
    addGoal / removeGoal / editGoal, startNextRotation(state, rotation, subjects/exams, today) that keep
    sessions, topics, outcomes, retests and Anki. A passed uni exam's goal is retired (spec rule: its fixes and
    retests drop). When no exam is ahead the engine reports a "what's next" state instead of an empty
    "on track" day (Today must be able to ask "What's next?"). Basic-year: a "block/semester" with subjects and
    exams works the same as a rotation (no hospital wording needed in data).
E2. Scored past papers / past questions for uni goals: a papers (or any uni question) block takes
    questions + correct, feeds accuracy, weak topics, fix → retest, the weekly totals. Uni weak topics are the
    goal's own subjects / lecture titles, not Step 1 systems. Basic-year subject list (Anatomy, Physiology,
    Biochemistry, Histology, Pathology, Pharmacology, Microbiology, …) as data for basic-year uni goals.
E3. Named items: slides/lectures (and an oral-exam question list) can carry optional item titles
    (Resource.itemNames?: string[]); tasks name them ("Lecture 7: Heart failure") instead of "next lecture".
    An oral/viva question list is just a slides-type resource with unit ['question','questions'] and titles.
E4. Fill the stated time: leftover time grows slides / papers / topic study too, not only question blocks
    (planSteps growStep). Never under-fill when material remains. No half lectures (whole units only).
    Never exceed the cap (existing invariant).
E5. Unknown counts: setup.ts bankSize() must not fall back to 3600 for "Not sure" on a non-UWorld bank.
    Mark unsure (Resource.unitsUnsure) and exclude unsure amounts and 'assumed'/'projected' dates from
    rescue / "h more work than time" / "h a day needed" judgements; pace says "date not known yet" instead.
    "Anki 0 new cards left" after Not sure → a sensible default flagged unsure.
E6. When the student studies: Availability.studyWindow ('evening' | 'late' | 'early' | 'mixed', default
    'evening' = current 16:00 rule) so busy time only reduces study capacity when it overlaps the window;
    also learn it from timer start times (pure helper). Hospital/rotation shifts typed as commitments must not
    be double-counted when the student gave hours "after hospital": daytime shift hours on a rotation day
    count 0 against capacity.
E7. Retests: never on or after the exam day of their goal (move earlier or drop with the uni rule).
    Pooled retests: the reason/carry says how it counts ("6/10 + 4/5 = 10/15").
E8. Deadline work: split across the available days before the deadline (never "all of it today" late at
    night when other days exist); a seminar must not take a whole day's study 11 days before an exam when
    it can spread. Repeat "Sun/Tue/Thu" saves all three days (English parser bug). "Duty tomorrow" title for
    today's duty fixed. No "ADDED TO TOMORROW" fixes onto a 0-minute day (move to next day with time).
E9. Light day: don't offer when essentials == whole plan; "Do more" tasks never count toward a rough day.
    Partly on a timed task keeps the timer minutes. "<System>, still your weakest" never right after "Passed".
E10. Imported/known progress moves topic order (120 Micro questions done → don't start at "Bacterial basics")
    if cheap.
Simulator: add personas for basic-year uni-only, uni + past papers, two exams in one block, next rotation,
late-night studier, unknown bank size. All invariants clean.

### Lane I: any question bank import (Sonnet). Owns src/data/uworldImport.ts (may rename to qbankImport.ts
and keep a re-export), src/engine/imported.ts, src/ui/UworldImport.tsx (may rename, keep export),
src/engine/__tests__/import.test.ts.
I1. Paste or upload a results file from ANY bank (UWorld, AMBOSS, Kaplan, BoardVitals, TrueLearn, Lecturio,
    local banks, a spreadsheet export): CSV/TSV/pasted table/"System 12/20" lines, header detection, %
    or correct/total, subject/system names mapped to the plan's topics via aliases, unknown names kept as
    custom subjects (not dropped). Preview before saving. Never blocks; a parse failure shows a clear
    sentence. File upload via <input type=file> read locally (no network).
I2. Neutral copy: "Bring in your question-bank results", bank name from the plan, never "UWorld" unless the
    student uses UWorld. Works for uni goals too (a uni past-paper results table).

### Lane Q: small UI fixes (Haiku). Owns src/screens/Onboarding.tsx, src/screens/AnkiConnect.tsx,
src/App.tsx, src/ui/Nav.tsx, src/ui/Stepper.tsx.
Q1. Typed-university form ("Can't find it? Type your university" + country) has no Continue button: add it.
Q2. "After hospital and lectures" wording only for clinical students; basic-year students see
    "After lectures" (or neutral "On a normal weekday").
Q3. After "Not sure" on question-bank size, the screen must not keep showing 3,600 (show "Not sure").
Q4. Connect Anki is never offered on a phone/touch-only browser (use the existing useMedia helper).
Q5. The app always opens on Today, not the last tab.
Q6. Lecture stepper: steps sensibly from larger numbers (a typed number field, or step +5 above 10).

### Lane U: screens and store (Sonnet), runs AFTER E and I. Owns src/screens/** (except Q's files once Q is
done they become U's), src/store/**, src/ui/**, src/lib/**, src/data/demo.ts.
U1. "Add an exam" / "Next rotation / next block" / "What's next?" screens using E1; PlanSettings no longer
    resets ("Set up again" stays only as a last option). Today's no-exam state asks "What's next?".
U2. Onboarding: paste lecture titles / oral question list (optional, one per line), basic-year path with
    subjects, "When do you usually study?" one tap with "Not sure" (E6), no USMLE defaults for uni-only.
U3. BlockFinished: papers / past questions take questions + % (accept "12/20" or "60"), topic quick-pick from
    the goal's subjects or lecture titles; pooled retest line.
U4. Pace / Weekly: university progress first-class (lectures done, papers scored, accuracy by subject);
    no "0 questions" card for uni-only weeks (show lectures / papers); no UWorld wording without UWorld.
U5. Small: "I'm sick / take it easy" entry on Today (uses light day), stale "Good luck tomorrow" after the
    exam, "So far" includes or labels today, a line when an exam-date edit shrinks today, "ready around 4 Jan"
    says when that is the exam day, "Your commitments take today's study time" only when they do, "Due
    tomorrow" relative to the right day, "How did it go?" offers more than Continue, exam date saves first try,
    an "Other" material (Sketchy etc.), Light day hidden when it changes nothing.

## Status (18 Nov 2026, for resuming in a new session)
- Lane Q: done (commit be1960d).
- Lane I: done (commit 0a68c03). Move PCT_ONLY_QUESTIONS from src/data/qbankImport.ts to config.ts.
- Lane E: in progress; WIP snapshot in commit 3c9a013 (planEdits.ts started). Run `npm test` first; finish E1–E10.
- Lane U: not started. Needs Lane E's API (src/engine/planEdits.ts, new type fields, config constants).
