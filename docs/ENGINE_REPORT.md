# Plan engine: what changed and why (15 Nov 2026)

For a reader who has not seen the work. The rules are in `docs/ENGINE_SPEC.md`; every decision and
deviation is logged in `docs/ENGINE_NOTES.md`.

## What changed

- **One ordered pipeline decides a day** (`buildDay` in `src/engine/plan.ts`): day type → capacity →
  deadline work → exam eve → Anki → due retests → due fixes → study shared between goals → an accepted
  light day. Before, the parts were added one prompt at a time and a day could go over the stated time.
- **The plan never exceeds the day.** What does not fit moves to the next day and is listed as moved.
- **Exams:** the day before is one light review, exam day is empty, the day after is rest. Board work
  shrinks to Anki only before a uni exam (7 days, fewer for short rotations).
- **Uni goals are lectures + past papers + recall.** Papers are spread over a window before the exam.
  Summaries are what "narrow the scope" means for a uni exam.
- **The fix → retest loop is bounded:** a retest waits for its fix, one loop per topic, a different fix
  after a miss, a rest after three misses, a stop after six, and no new topics during a backlog.
- **Rescue mode** offers move the date / narrow the scope / add time, each with its cost, only for firm dates.
- **A study day** ends at 4 AM; `startDay` / `endDay` roll it over; "Do more" adds one task on request.
- **Institution facts are data:** `src/data/universities/` (global default + Mutah).
- **A simulator** (`tests/sim/`) runs 27 students for 8–12 weeks and checks 20 invariants every day.
- **The app's store** uses the same engine functions as the simulator.

## Verified

- Full suite: 243 tests pass, including the simulator with 0 invariant violations across 27 personas.
- `npm run build` passes.
- A phone-width browser smoke test of the demo student ran three tasks with no console errors (before the review fixes; not repeated after them).

## Not built (engine ready, no screen)

- The rescue options screen, and "not now".
- The "What's next?" question after a rotation ends.
- Past-papers count and OSCE date questions in onboarding (defaults are used).

## One line per persona (final run)

| # | Persona | Outcome |
|---|---|---|
| 01 | Perfect follower | 335 of 335 tasks done; 11 topics solid; 2 rescue offers for Step 1 (it does not fit in 5 months at 2.5 h) |
| 02 | Skips two days a week | Skips absorbed with no light-day offers; 7 topics solid |
| 03 | Always "Partly" | 89 of 294 done; fixes now close on the second "Partly"; 10 topics solid; 20 light days (inside the 2-a-week limit) |
| 04 | Two exams in one week | Tuesday and Thursday exams each get an eve; rest after the second; 8 solid |
| 05 | Combined ENT + Ophthalmology | Both exams on one day share time by need; no rescue (Step 1 date is rough) |
| 06 | 30 minutes a day | Moves, slowly: 368 h still left after 12 weeks; no rescue because the date is rough |
| 07 | 8 hours a day | 397 tasks; 15 solid; 3 rescue offers in 8 weeks; finished the material |
| 08 | Basic sciences | Module exam prepared with lectures and papers; 15 solid |
| 09 | No exam dates | Projected date follows the pace; assumed uni date says "about N days (end of rotation)" |
| 10 | Weak in everything | New topics pause during a backlog; open loops stay at 9 or fewer; 11 solid |
| 11 | Fails retests | Loops stop after a rest and three more misses; open loops 8 (were 84) |
| 12 | Big UWorld history | Imported stats pick the start and the fix; 11 solid; 21 h left |
| 13 | Far behind, narrows | 3 offers; narrowing is questions-only (nothing dropped without imported stats); finished |
| 14 | Overconfident sweeper | Same bounds as 11; open loops 6 (were 62) |
| 15 | Heavy week + seminar | Deadline work split and finished; study moves; 4 solid |
| 16 | Far behind, moves the date | One offer, date moved, calm after |
| 17 | Far behind, adds time | 3 offers; extra time capped at 3 h a day |
| 18 | Uni only + OSCE | Paced lectures, papers, daily recall; OSCE gets an eve and a rest day but no prep |
| 19 | Two-week minors | Six rotations in a row; Step 1 paused about 5 days of each 14; 3 rescue offers |
| 20 | Disappears 10 days | Returns with no guilt; plan continues; 15 solid |
| 21 | Ignores rescue | Offer shown 3 times in 8 weeks (was 41 days in a row) |
| 22 | Rough days, takes rest | 187 of 310 done; 1 rest day; no nagging after two declines |
| 23 | Rotation, then a break | Break hours apply from "What's next?"; 14 solid |
| 24 | Slow, uni exam short | Uni exam takes the whole day when it needs it; lectures from summaries after rescue |
| 25 | Weekends off, odd Anki | Zero-minute weekends stay empty even with added time; chunks stay multiples of 5 |
| 26 | Almost done, no date | New Anki cards capped (was "+1150 in a day") |
| 27 | Questions all day | Two blocks a day get separate fixes; finished the question bank |
