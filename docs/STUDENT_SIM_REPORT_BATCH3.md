# Student simulation, batch 3: five Step 1 students, five countries

Run: 25 Nov 2026, against the current `claude/epic-gates-j4pjav` build (after the "+ adds existing tasks" change).
App time: Mon 30 Nov – Sun 13 Dec 2026, each student in their own timezone on a fake clock.
No app code was changed for this report. Raw notes, personas and screenshots are in `sim-students/batch3/` (gitignored, local only).

Labels used below:
- **Confirmed**: checked in the code (file:line), or reproduced by running the engine.
- **Seen**: reported by a student with a screenshot, not re-checked by me.
- **Felt**: an opinion or a guess by the student.

---

## 1. Method

**What changed from earlier batches:**
- Every student prepares for **USMLE Step 1 only**: no PLAB or SMLE.
- No comments on language or translation were allowed.
- Students played in first person, writing their mood and energy before each visit and letting it change what they did.
- Their scores follow their real ability.
- Design opinions were invited.

| Code | Student | School | Stage | Level (block accuracy) | Device / theme |
|---|---|---|---|---|---|
| UG | Brian Kiggundu Mukasa, 27 | Makerere University, Kampala | Graduate, pre-intern | Struggling (42–52%) | Android / dark |
| NP | Rohan Gurung, 23 | IOM Maharajgunj, Kathmandu | Year 3 | Struggling (45–55%) | Laptop / dark |
| AM | Mariam Hovhannisyan, 18 | Yerevan State Medical University | Year 1 | Average for year 1 (40–55%) | iPad / light |
| DO | Jomaira Almonte Peña, 23 | UASD, Santo Domingo | Year 3 | Struggling (40–55%) | iPhone / light |
| VN | Trần Thu Hằng, 27 | Hanoi Medical University | Year 6, mother of a 3-year-old | Average (55–65%) | Android / light |

**How it ran:**
- **Personas.** A low-cost model researched each school from public sources: curriculum, exam format, weekend, costs, and resources students use. I kept those facts as the persona's baseline, for example Nepal's switch to a Sat–Sun weekend in April 2026.
- **The students.** One strong model per student played them through Playwright against a dev server. Each had a saved profile, ran 10–14 visits over two weeks, and took about 6–10 screenshots.
- **Required moments**, at least once each:
  - a reload in the middle of a task;
  - coming back after missed days;
  - a change in their life;
  - doing more than planned, and doing less;
  - looking for a missing feature.
- **Verification.** I checked the main claims in code (section 6).
- **No "graphify" skill.** It isn't installed in this environment.

**Caveat on variety:** the levels came out mostly struggling to average. No top student (70–85%) was in this batch, so complaints from strong students, like "too easy" or "wastes my time", are under-represented.

---

## 2. Scores (1–10)

| | Setup | Today | Logging speed | Trust in plan | Look & feel | Would miss it | Recommend | Day 30 |
|---|---|---|---|---|---|---|---|---|
| UG | 8 | 7 | 8 | 4 | 8 | 5 | 5 | maybe |
| NP | 4 | 7 | 6 | 4 | 8 | 4 | 5 | maybe |
| AM | 6 | 6 | 8 | 4 | 8 | 5 | 5 | maybe |
| DO | 6 | 7 | 8 | 4 | 8 | 3 | 5 | maybe |
| VN | 7 | 7 | 8 | 4 | 9 | 6 | 6 | maybe |
| **Avg** | **6.2** | **6.8** | **7.6** | **4.0** | **8.2** | **4.6** | **5.2** | 5× maybe |

**The headline:** the app looks and feels right (8.2) and logging is fast (7.6), but **no one trusts the plan (4/10, unanimous)**.
- The reason is the same every time: the numbers on screen sometimes don't match what the student did, or show dates and exams they never gave.
- Trust is what turns "maybe" into "yes" on day 30.

**Would pay:**

| Student | Would pay |
|---|---|
| UG | UGX 20,000/yr |
| NP | NPR 300–500/yr |
| AM | $1–2/month, with conditions |
| DO | RD$300/yr |
| VN | Not yet; maybe a Vietnam-level price once progress is reliable |

Everyone named a price well below $29/yr. That is expected for these countries, but it supports regional pricing.

---

## 3. Common complaints (count = students who raised it)

| # | Complaint | Who | Count | Severity |
|---|---|---|---|---|
| 1 | Progress recorded wrong: an early stop counts a whole task or lecture as done; "End session" throws away an unticked task's minutes; no "partly done" | NP, DO, VN | 3 | would-quit (VN), annoying |
| 2 | Dates or exams the student never gave, shown like real ones ("No idea" Step 1 → 29 Jan; "Don't know yet" → "IM exam in 7 days"; "Early 2027" → 15 Mar) | AM, NP, DO | 3 | would-quit (AM) |
| 3 | Commitments misread: a one-off "Mon to Wed" repeats weekly; overnight shift → 2 h; "today and tomorrow" → today only; "whole day" not understood; no repeating busy time when wanted | UG, VN, AM, NP, DO | 5 | would-quit (UG) |
| 4 | No place to log an exam, NBME, colloquium or study done outside the plan, so the fix loop never starts for non-QBank work | UG, AM, NP, VN | 4 | annoying → would-quit (AM) |
| 5 | Stale state after an exam passes: topics still "weak", "0 of 3 topics watched" frozen, fix "added to Sunday" after a Friday exam | DO, NP, VN | 3 | annoying |
| 6 | Pathoma assigned to topics it doesn't cover (EKGs, cardiac cycle, antiarrhythmics, cardiac physiology) | UG, NP | 2 | annoying |
| 7 | Clinical-year wording for pre-clinical students ("…Physics rotation", "topics watched" for book reading) | AM, DO | 2 | minor, but kills trust |
| 8 | Garbled fix text "cardio, overall and renal, overall"; fixes feel generic | DO, UG | 2 | minor |
| 9 | Settings hidden under Week | NP, DO, VN | 3 | annoying |
| 10 | Anki numbers off: "Not sure" → 2,970 new cards (AnKing is about 30k); every log subtracts 30 new cards; nowhere to enter a backlog | UG, VN | 2 | annoying |
| 11 | Exam-day rules too rigid for a small test (no "Do more" the day before, forced rest after, no "how did it go?") | NP | 1 | annoying |
| 12 | Screens disagree (Pace says "Retest today", Today hides it; "2 h instead of 2 h 15 min" when Today shows 4 h; Week "42 min studied" vs about 1 h 40) | VN, DO | 2 | annoying |

---

## 4. What they liked (unprompted, everyone)

- **No guilt.** All five named it: "Nothing is lost", the light-day offer, and the calm plan after missed days. This is the strongest asset, and it's working.
- **The fix → retest loop with one-line reasons** (VN's favourite; UG and NP close behind). For example: "IM paper: 65%. Here's the fix. Added to tomorrow … Retest Wednesday", and "Neuro needs another pass. A different fix this time."
- **About 10-second logging** that leads straight to a fix.
- **The look.** Calm, premium, and the dark mode is polished. AM said the design "lowered my anxiety on sight".
- **A timer that survives a reload**, plus tiny first tasks, the recall sweep and the "Do more" picker.

**UI/UX notes:**
- The sticky Start button covers the last card's text (VN, Android).
- The Board canvas is cut off on iPhone (DO).
- "Chang e" wraps on iPad Week (AM).
- "Connect Anki on this computer?" was asked on a phone (VN).
- Coming back after 9 days and seeing "3 h planned · 0 of 5 tasks" made DO close the app. The welcome back should be smaller.

---

## 5. BEFORE → AFTER

| | Before | After |
|---|---|---|
| UG | Anki 40 cards/wk · confidence 3 | Anki 150/wk · confidence 2 ("truer") |
| NP | No plan, crams before exams | Calmer, but doesn't trust the dates |
| AM | Uni first, Step 1 vague | Step 1 pushed too hard by an invented date; worse until she found it |
| DO | Plans in her head | No-guilt return helped once; closed the app after a 9-day gap |
| VN | Re-plans in Notion weekly · stress 7 · confidence 4 · ~2 h/weekday | Stopped re-planning · stress 6 · confidence 5 · ~1.5 h/weekday, almost no UWorld |

**Honest read:**
- The app lowered planning stress for most of them.
- Only one (UG) clearly studied more.
- One (VN) studied less, because her QBank work dropped out of the plan.
- Nobody gained confidence in being "on track", because they don't believe the pace numbers.

---

## 6. Verified findings

| Finding | Status | Where |
|---|---|---|
| A day range always becomes a weekly repeat: `parseCommitment("Funeral Mon to Wed")` → `repeat: [1,2,3]` | **Confirmed** (ran the parser) | `src/engine/commitmentParse.ts:155`, `:274` |
| An overnight shift is cut to 2 h: "Night duty 17:00-07:00" → `from 17:00, to 19:00` | **Confirmed** (ran the parser) | `src/engine/commitmentParse.ts` (time-range parse) |
| "Grandma sick today and tomorrow" → title "Grandma sick and", no kind, no second day | **Confirmed** (ran the parser) | `src/engine/commitmentParse.ts` |
| "Tutoring whole day" → no kind, no time | **Confirmed** (ran the parser) | `src/engine/commitmentParse.ts` |
| "No idea" Step 1 date → a `projected` ready-by date, planned as a real exam | **Confirmed** | `src/data/setup.ts:396`, `src/engine/day.ts:25`, `src/engine/pace.ts:254` |
| "Don't know yet" uni exam → `assumed` end of rotation, shown like a real date | **Confirmed** (by design; the label isn't clear) | `src/engine/types.ts:15`, `src/screens/Today.tsx:144` |
| Nepal weekend is Saturday only; Nepal moved to Sat–Sun in April 2026 | **Confirmed** | `src/data/weekends.ts:44` |
| The header shows "<subject> rotation" for any rotation block, including pre-clinical semesters | **Confirmed** | `src/screens/Today.tsx:113` |
| Pathoma is mapped per system, so every Cardio/Neuro/… topic gets a Pathoma step (marked TODO(placeholder)) | **Confirmed** | `src/data/templates.ts:149–150` |
| Whole-system fix names read "Cardio, overall", which gives "cardio, overall and renal, overall" when joined | **Confirmed** | `src/engine/fixes.ts:76` |
| "End session" saves ticked tasks only; minutes on an unticked current task are dropped | **Confirmed** (by design; students read it as lost work) | `src/screens/Running.tsx:90–91`, `:242` |
| An early finish counts a whole lecture pair as done; "More lectures left" adds new lectures instead of unticking | Seen (VN, `d05f-04-chg.png`) | — |
| A fix is scheduled after the exam it was for (ACS fix "added to Sunday", exam Friday) | Seen (VN, NP) | — |
| Weak topics still listed after their uni exam passes | Seen (DO, NP, VN) | — |
| Anki logging subtracts 30 new cards on review-only days | Seen (VN) | — |
| A crash right after Start lost one session | Seen (VN, once) | — |

---

## 7. Recommendations, in priority order

1. **Make progress honest** (complaint 1, trust).
   - Add a "Partly" outcome when a task ends early: minutes from the timer, the share done from one tap.
   - On "End session", keep the current task's minutes as partly done instead of dropping them.
   - "More lectures left" should untick lectures, not invent new ones.
2. **Never present a guessed date as real** (complaint 2).
   - "No idea" for Step 1 should mean "not yet": a low background share with a "Set a date" prompt, not the ready-by date planned as an exam.
   - Show assumed or projected dates with a visible "estimated · change" label on Today and Pace.
3. **Fix the commitment parser's common cases** (complaint 3). Each is a small, testable rule in `commitmentParse.ts`:
   - an overnight range where the end is before the start;
   - "today and tomorrow";
   - "whole day";
   - a day range meaning this week once unless "every" or "weekly" is said.
4. **Let students log a result for anything** (complaint 4): a uni exam, NBME, colloquium or outside block. It should feed the same fix → retest loop.
5. **Clean up after an exam passes** (complaint 5).
   - Drop its weak flags and frozen progress lines.
   - Never schedule a fix after the exam it serves; move it before, or drop it.
6. **Data fixes:**
   - Nepal weekend to Sat–Sun.
   - Pathoma by chapter topic, not by system.
   - Pre-clinical wording ("semester", "read" instead of "rotation", "watched").
   - Join whole-system fix names properly.
   - Anki "Not sure" based on deck size.
7. **Small UI:**
   - Settings reachable from Today.
   - The sticky Start button shouldn't cover the last card.
   - The Board fits on iPhone.
   - Hide "Connect Anki" on phones.
   - A softer return screen after long gaps.

Items 1–3 are the ones that would move "trust in plan" from 4. Every student said the look and the no-guilt tone are already right, so none of these should change them.
