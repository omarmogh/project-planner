# Locus — Project Brief (handoff for Claude Code)

> Read this whole file before doing anything. It explains who I am, what the old project was, why we're changing direction, every objection we already worked through, and the plan. Don't re-propose ideas listed under "Rejected / already discussed" unless I ask.

Last updated: 14 November 2026
Working name: **Locus** (taken from the old project's asset names; not final)

---

## 1. Who I am (context for decisions)

- Omar, 5th-year medical student at Mutah University, Jordan. Strong interest in internal medicine.
- Background in graphic design and community moderation (Discord, forums).
- I build side projects in React/TypeScript. I'm building this **part-time alongside med school**, so scope must stay small and phased.
- I'm the target user myself: I study for uni exams during rotations and plan to take USMLE Step 1.

---

## 2. The old project: `productivity-v2`

Location: `C:\Users\omarm\Desktop\CS\productivity-v2`

### What it is
A general focus/productivity app (landing page calls it "CantFocus", assets call it "Locus"). Tagline on landing: "One glass panel to own your cognitive day." Sold as "Download for Windows" (Tauri) or "Open in Browser".

### Features it has
- Pomodoro timer (adaptive cycles, custom durations, break rhythms) — `src/store/timerStore.ts` (~21 KB), `src/workers/timerWorker.ts`, `src/store/usePomodoroTicker.ts`, `src/hooks/useGlobalTimer.ts`, `src/components/MiniTimer.tsx`, `src/hooks/useDocumentPip.ts` (picture-in-picture timer)
- Ambient sounds — `src/lib/SoundManager.ts`, `src/components/AmbientPlayer.tsx`, `AmbientControls.tsx`, `src/store/useAudioStore.ts`, `src/config/audioList.ts`, `public/sounds/`
- Tasks — `src/store/tasksStore.ts`, `src/views/TasksView.tsx` (dnd-kit drag and drop)
- Analytics / heatmaps / bento dashboard — `src/store/useAnalyticsStore.ts`, `src/hooks/useAnalytics.ts`, `src/views/AnalyticsView.tsx`, `src/components/analytics/BentoDashboard.tsx`
- Hydration reminders, posture reminders — `useHydrationManager.ts`, `usePostureManager.ts`, `HydrationCard.tsx`, `utilities/HydrationUtility.tsx`
- Mood tracker, notes (TipTap), calculator (mathjs), lava lamp / lava mesh background
- Live user count via Supabase presence — `src/hooks/useLiveUsers.ts`
- Auth — `src/components/auth/AuthGate.tsx`, `GuestBanner.tsx`, `src/lib/supabaseClient.ts`, `supabase/schema.sql`
- Offline storage — `src/lib/db.ts` (Dexie)
- Premium modal mentioning "Unlimited Active Tasks", "Pro Clinical Calculator", "Advanced Hydration Engine" — `src/components/ui/PremiumModal.tsx`
- Floating panels / window manager / launcher — `FloatingPanels.tsx`, `layout/WindowManager.tsx`, `layout/LauncherMenu.tsx`
- i18n (English + Arabic) — `src/i18n.ts`, `src/locales/`
- Clutter: `src_V1_Stable_Local/` and `src_V2_Supabase_WIP/` are old copies of `src`. README is still the Vite template.

### Stack
React 19, Vite 8, TypeScript, Tailwind 4, Zustand, Dexie, Supabase, Tauri 2, framer-motion, TipTap, dnd-kit, lucide-react, i18next, jspdf/html2canvas.

### Why it doesn't stand out (the diagnosis)
- Every feature already exists for free in Pomofocus, Flocus, LifeAt, Forest. Adding features made a bigger copy, not a different product.
- It's for "anyone who wants to focus", so it's replaceable by whichever app has the nicest background that week.
- The timer doesn't know **what** you studied, so all it can say is "you focused 3 hours" — interesting for a week, then people stop opening it.
- Clue that was already there: the premium modal sells a "Pro Clinical Calculator" — the real audience was med students all along.

---

## 3. How the idea evolved (conversation history)

1. **"It feels basic and won't stand out."** → Diagnosis above. Suggested picking a specific person: med students, because I am one, can test with classmates tomorrow, know their tools, and my Instagram vlog reaches that audience.
2. **"So med students is the perfect solution?"** → Not perfect; strongest bet *for me*. Downsides: smaller market, big competitors nearby (UWorld/AMBOSS stats), busy skeptical users, and it may not be the cozy/ambient thing I enjoy building. Alternatives considered: another niche I know (Discord communities, designers), a pure "identity" product (the virtual library feel), or a general study tool with med school as the first group.
3. **"Show me what it logs."** → Built an interactive sample: after a session you log resource (UWorld / Anki / videos / reading), system, minutes (from timer), and for QBank blocks: questions + % correct. The app then shows pace vs exam date, hours per system vs exam weight, and accuracy per system with a suggested next block.
4. **"Why would people use it if UWorld and Anki already log that?"** → Valid objection. If it makes you retype what UWorld shows, it's useless. What they *don't* do: UWorld only knows UWorld, Anki only knows Anki; they report the past, not today's plan; neither knows rotations/call days or uni exams. So the product is **not a tracker** — it's a daily plan across all resources that adapts to your real schedule. Logging must be near-automatic.
5. **"Every student/university/rotation/exam is different."** → Don't hardcode curricula. Each student describes their situation once: **goal(s)** (exam + date), **material** (UWorld 3,600 Qs, Pathoma 11 chapters, uni slides 18 lectures…), **availability** (rotation until X, hours per weekday/weekend). Core logic is the same for everyone. Consequences: setup is the hardest part (solve with templates students can copy/share), and start narrower (my batch at Mutah).
6. **"I don't want it to be just analysis — I want it to improve and guide the student."** → Agreed; analysis is the engine underneath, the student sees a coach. See section 4.
7. **"Build from scratch or use productivity-v2?"** → New project, copying the good parts (section 7).
8. Made a proposal deck (Locus_Proposal.pdf) with market numbers, costs, revenue. Its content is merged into this file.

---

## 4. The product: what Locus is

**One line:** A study coach for medical students. It tells you what to study today, finds what you keep getting wrong, makes you fix it, and keeps you on track for your exam.

### The core loop
1. **Plan** — every morning, today's tasks sized to the time you actually have.
2. **Do** — press Start; the timer runs each task.
3. **Report** — ~10 seconds after a block: e.g. "20 questions, 50%". Minutes come from the timer automatically.
4. **Fix** — weak topic detected → a specific fix task is added (video, wrong-answer review, make Anki cards).
5. **Retest** — a few days later, a short retest. Weak → solid, or back into the plan.

**Engine:** remaining material ÷ available time = today's plan, recalculated whenever you fall behind, your schedule changes, or a weak topic appears.

### A day from the student's side
- **Morning:** "Today: 2 hours. 1) Anki reviews 25 min 2) UWorld: 20 Cardio questions, timed, 40 min 3) Review yesterday's wrong Renal answers 30 min." No decisions; press Start.
- **After the Cardio block:** enters "20q, 50%". App: "You missed 4 of 5 heart failure questions. Before tomorrow: watch the 12-min heart failure video and make 5 Anki cards from your wrong answers. Added to tomorrow's plan."
- **Three days later:** "Retest: 10 heart failure questions." 80% → "Heart failure: weak → solid. Moving on."
- **Life happens:** skipped 2 days for uni exams → "You're 2 days behind. Spread over the next 10 days: +15 min a day. Exam date still safe." No guilt, no rebuilding a plan.
- **Sunday:** "This week: 180 questions. Renal 58% → 71%. Cardio still weakest; next week focuses on it." Shareable weekly report card (the moment students screenshot and post).

The model is a good tutor / senior resident: decides what you study today, notices what you keep getting wrong, makes you redo it, keeps you on schedule.

### Key screens (MVP)
1. **Setup / onboarding** — pick a template (e.g. "Mutah 5th year, IM rotation", "Step 1 with UWorld + B&B") then adjust goal, material, availability.
2. **Today** — header: day, rotation, "2 h 05 min planned", days until exam, progress bar. Task list; tasks marked `Fix` show why they're there; Start button runs the timer.
3. **Block finished** — questions, % correct, topics missed (optional quick pick) → shows the fix that was added; buttons "Got it" / "Change fix".
4. **Pace** — "8 days behind on UWorld at your current pace. +6 questions a day fixes it." Accuracy by system bars (green ≥60%, amber borderline, red weak). "Weak topics fixed this month: 7 · still open: 3".
5. **Weekly report** — shareable card.

### Onboarding and daily-logic decisions (prototype, Nov 2026)
- **University:** a search field over a bundled, trimmed copy of the open Hipo "university-domains-list" (name + country, MIT license, credited in the README; no API calls). Fallback: "Can't find it? Type your university" + country picker.
- **Weekends are automatic** from the university's country (`src/data/weekends.ts`: Fri–Sat for most Arab countries, Sat–Sun elsewhere, UAE Sat–Sun; marked TODO(review)). No weekend question; the first Today shows "Weekend: Fri–Sat · Change".
- **Rotation:** "When does it end?" chips (1 / 2 / 3 / 4+ weeks / Pick date), then per subject "Exam at the end of the rotation?" Yes (default) / No → optional date ("Don't know yet" allowed). Combined rotations ask per subject.
- **No post-call / call-day questions anywhere.** Replaced by **light days**: the engine detects a rough patch (skipped tasks, several Partly/Didn't answers, or a score drop in the last 1–2 days) and Today offers once: "Rough day? Do just the essentials (about 20 min)." → Light day / Keep the full plan. Rules (numbers in `config.ts`): at most 2 offers per 7 days, then encouraging copy only ("Just the first task today. You can stop after it."); within 5 days of an exam never a break, only "essentials only" (1–2 highest-impact tasks); a full rest day only when ahead of schedule. A light day re-plans the rest of the week automatically. Never guilt: no red warnings, no broken streaks.
- **Time estimates, no calibration mode:** after each finished task, that task type's estimate blends the config default with the student's timer minutes (weight toward real data grows per session, outliers ignored, change capped per session; formula in `config.ts`). Pace always uses the current blended estimate, never an empty state.

### Commitments: "things you have to do" (decided, Nov 2026, core, no flag)
- **Not a to-do list.** No backlog screen, no lists to manage. A commitment exists only to take time from the plan, which adapts around it. Done = it disappears. Tap an item to edit or delete it.
- **Entry:** a small "+" on Today opens one text field. The student types naturally in English, Arabic or mixed ("Seminar on DKA Thursday 3h", "Lecture 10–12", "محاضرة 10-12", "Gym 6pm 1h"). Parsed locally, no AI (`src/engine/commitmentParse.ts`); a preview with editable chips (type, day/time, length, tag) appears, then Add. If parsing fails, the chips are just empty.
- **Busy time** (a fixed time on a day) reduces that day's study capacity. Time inside the evening study window counts in full; daytime hours count at 25%, because most study happens in the evening (numbers in `config.ts`, TODO(review)). Today shows one line: "Lecture 10–12 → 2 h 30 min of study time instead of 3 h".
- **Work with a deadline** (seminar, presentation, assignment) plus a length is split across the days before the deadline. Chunks are ≥30 min, it aims to finish a day early, and it re-splits as parts are done. The chunks show as normal tasks with the tag.
- **Tag** is guessed (Uni / USMLE / Personal); one tap changes it.
- **Topic link:** if the text matches a topic (aliases in `src/data/topicAliases.ts`, e.g. DKA → Diabetes), deadline work counts as studying that topic. The plan doesn't schedule that topic separately until a week after the deadline.
- **Overload:** commitments always come first. If they leave no room, Today says so calmly ("Your commitments take today's study time. Retests stay; the rest moves to the coming days."). Due retests and Anki reviews are never silently dropped.
- Engine: `src/engine/commitments.ts` (pure, tested).

### Recall Sweep outcomes (behind `?idea=1`)
- Fuzzy on a uni lecture → "Skim lecture: X" (10 min) within 2 days, then the re-sweep 3 days later.
- **Overconfidence note:** if a topic rated "Had it" in the sweep scores under 60% in a question block within 30 days, Block finished shows it once, gently: "You felt sure about X, but scored Y%. Added a short review." (a 15-min review, unless the block's fix already covers it). Engine: `src/engine/confidence.ts`.

### Pace math (from the prototype)
```
pace_per_day   = items_done / days_elapsed
days_needed    = ceil(items_remaining / pace_per_day)
days_late      = days_needed - days_until_exam      // >0 = behind
required_pace  = ceil(items_remaining / days_until_exam)
time_share[sys]   = hours[sys] / total_hours
exam_weight[sys]  = configured weight (example numbers only — get real ones)
gap[sys]          = exam_weight[sys] - time_share[sys]   // biggest positive gap = under-studied → suggest next
accuracy[sys]     = correct[sys] / attempted[sys]         // <60% flagged
```

### Suggested data model (proposal, adjust freely)
- `Goal` { id, name ("Step 1", "IM final"), examDate, priority }
- `Resource` { id, goalId, type (qbank | anki | video | reading | slides | other), name, totalUnits, unitLabel ("questions", "chapters", "lectures"), doneUnits }
- `Availability` { blocks: [{ from, to, label ("Surgery rotation"), weekdayMinutes, weekendMinutes, offDays/callDays }] }
- `Topic` { id, system ("Cardio"), name ("Heart failure"), status (unknown | weak | fixing | solid) }
- `Session` { id, date, resourceId, topicIds, minutes (from timer), questions?, correct?, notes? }
- `Task` { id, date, kind (study | fix | retest | anki), resourceId?, topicId?, minutes, reason, status }
- `PlanEngine` — pure function: (goals, resources, availability, topics, sessions, today) → Task[] for today. Keep it pure and unit-tested.

### Logging must be near-automatic
- Minutes always from the timer.
- QBank: one line "block done: 40q, 62%", or paste the block results.
- Anki: see "Anki integration" below — both manual and AnkiConnect from the start.
- If logging takes more than ~10 seconds, people quit.

### Anki integration (decided: both paths from the start)
Locus does **not** replace Anki's scheduling — Anki already decides which cards are due. Locus only needs a few numbers to plan time.

**Path A — Manual (default, works for everyone, incl. phone users)**
- Setup asks per deck: "How many new cards are left?" and "How long do your reviews usually take?"
- Locus derives: `newCardsPerDay = newCardsLeft / daysUntilExam` and reserves review time in the daily plan.
- After an Anki task: a checkbox, or one tap "about how many did you review?"

**Path B — "Connect Anki" (optional, desktop, fills numbers automatically)**
- AnkiConnect is a desktop Anki add-on that runs a local HTTP server on `http://127.0.0.1:8765` while Anki is open. POST JSON `{ action, version: 6, params }`.
- Useful actions: `deckNames`, `getDeckStats` (new / learning / review / total per deck), `getNumCardsReviewedToday`, `getNumCardsReviewedByDay`, `findCards` (e.g. `deck:"X" is:new`).
- Limits to design around:
  - Only works while Anki desktop is running on the same computer. Phones (AnkiDroid / AnkiMobile) don't have it.
  - Browsers block a website calling it unless the user adds our origin to `webCorsOriginList` in AnkiConnect's config → confusing for students. The **Tauri desktop app** can call it from the Rust side / http plugin without that browser restriction, so the desktop app is the natural home for this.
  - Must fail gracefully: if Anki isn't reachable, silently fall back to Path A — never block the user.
- Build Path B as a small isolated module (`ankiConnect.ts`) with a clear "Connected / Not connected" state and a guided one-time setup screen.
- Phase 0 decides priority: ask classmates **"Do you do Anki on your laptop or your phone?"** Mostly laptop → Path B is in the MVP. Mostly phone → Path B stays small and Path A must be excellent.

---

## 4b. Design principles (non-negotiable)

The bar is an Apple-quality app: calm, clean, does the job, and feels like it understands what the student needs. **Not** a junk drawer of features — that is exactly what killed productivity-v2.

**The app thinks, the student doesn't have to**
- Every screen answers one question. Today = "what do I do now?". Block finished = "how did it go and what's next?". Pace = "am I on track?".
- The app makes the decision and shows it; the student can adjust. Defaults over settings.
- One primary action per screen (usually "Start"). Everything else is secondary or hidden until needed.
- Explain *why* in one short line ("Weakest system for its exam weight", "From Sunday's block") — never a wall of stats.
- Ask for input only when it's needed and only what's needed. Never a form where one tap works.
- Only ask what students know without checking anything. Every question has a "Not sure" option with a sensible default. The app refines it later from usage.
- Plan by topic, never by resource units. Students study topics; resources are just how they study them. Never show video numbers or page numbers.
- Progressive disclosure: details (charts, history, settings) one tap away, never on the main screen.

**Smart, not noisy**
- Context-aware: knows it's the weekend, an exam week, or that you had a rough couple of days, and adjusts the plan and tone.
- No guilt. "You're 2 days behind — here's the adjusted plan" instead of red warnings and broken streaks.
- Notifications are rare and useful (start of day plan, retest due), never nagging.
- Empty and error states are helpful sentences, not apologies.

**Visual language**
- Lots of white space, a clear type hierarchy, one accent color plus semantic colors (green solid, amber borderline, coral weak) used only when they mean something.
- System-quality typography (e.g. Inter / SF-like), consistent 8-pt spacing grid, generous touch targets.
- Subtle, purposeful motion only (task completes, plan updates). No lava lamps, no decorative gradients, no glassmorphism for its own sake.
- Must not look AI-generated or template-like: no generic SaaS hero sections, no emoji-heavy UI, no random cards everywhere.
- Light and dark mode both first-class. Fully usable on a phone browser.
- Arabic (RTL) supported properly, not as an afterthought.

**Quality bar**
- Fast: Today screen loads instantly (local-first with Dexie, sync in background).
- Works offline; never loses a logged session.
- Every feature must earn its place: if it doesn't help the student decide or do today's work, it doesn't ship.
- When in doubt, remove.

---

## 5. Target users and market

- ~23,000 students studying medicine inside Jordan, ~20,000 Jordanians studying medicine abroad (Jordan Medical Association, Apr 2026).
- 2025: 4,454 doctors graduated in Jordan vs 1,040 residency slots → many look to USMLE / abroad.
- 25,660 non-US international graduates took USMLE Step 1 in 2025.

**Example user:** 5th-year at Mutah on internal medicine rotation, uni exams every block, Step 1 planned in 6 months, uses UWorld + Anki + uni slides, ~2 h on weekdays, plans the week in her head and feels behind.

**Rollout order:** 1) my batch at Mutah (30–50) → 2) med students across Jordan → 3) Arab students preparing for USMLE / PLAB / SMLE → 4) anyone facing a big exam on a deadline (the engine isn't medical-specific).

---

## 6. Competition (be honest about this)

| Product | Price | What it does | Gap for our user |
|---|---|---|---|
| UWorld Study Planner | Included with UWorld QBank (~$449+/yr) | Daily plan from your dates + available hours | Plans around UWorld; no local uni exams |
| Blueprint Med Study Planner (ex-Cram Fighter) | **Free** | Splits your books, QBanks, lectures, flashcards across your schedule | Built for US exams (USMLE/COMLEX/Shelf), not Jordanian rotations / uni exams |
| Oncourse AI | $119/yr | Adaptive plan with its own QBank + flashcards | You must switch to its content |
| AMBOSS | $448/yr QBank bundle | QBank, library, study plans, analytics | Expensive; plans around AMBOSS |

**Our angle:** works with *any* material incl. uni slides and local exams · rotation and call-day aware · the fix → retest loop · regional pricing · Arabic.
**Hard truth:** a good planner is already free. Locus cannot charge for planning alone. The coaching loop and local fit must be clearly better.

---

## 7. Build approach: new project, reuse the good parts

**Decision:** start a new project. Don't build inside productivity-v2 — its structure (floating panels, window manager, utility launcher, premium modal) assumes "toolbox for focusing" and would fight the new core.

| Carry over | Rewrite | Leave behind |
|---|---|---|
| `timerStore.ts` + `timerWorker.ts` (becomes the "start task" engine) | Analytics store (tracks focus minutes → needs material, scores, weak topics) | Lava lamp / LavaMeshBackground |
| Supabase auth + client (`AuthGate`, `supabaseClient.ts`) | Tasks store (becomes the daily plan) | Calculator, mood tracker |
| Dexie setup (`db.ts`) for offline | Dashboard (BentoDashboard) | Hydration + posture reminders |
| `SoundManager` + ambient audio | | Floating window manager / launcher |
| `Modal`, `Portal` UI pieces, Tailwind setup | | `src_V1_Stable_Local/`, `src_V2_Supabase_WIP/` |
| i18n setup (Arabic matters for the market) | | Premium modal copy |
| `useDocumentPip.ts` (PiP timer is nice) | | |

Stack stays: React, Vite, TypeScript, Tailwind, Zustand, Supabase, Dexie, Tauri (desktop later). Web first; mobile later from the same codebase.

---

## 8. Plan (phases, part-time)

**Rule:** no phase starts until the previous phase's goal is met. Stopping after Phase 0 is a good outcome if students don't have the problem.

- **Phase 0 — Validate (Nov–Dec 2026, ~3 weeks)**
  - Ask 10 classmates: *"How do you decide what to study today, and how do you know if you're on track for the exam?"* (Do NOT ask "would you log your sessions?" — everyone says no.) Write down exact words.
  - Also ask: *"Do you do Anki on your laptop or your phone?"* (decides AnkiConnect priority).
  - Build a **clickable Today screen + Block finished screen with fake data** and show it to the same 10.
  - Go if most describe the problem unprompted (vague, stressed, spreadsheets). No-go if they shrug.
- **Phase 1 — MVP (Dec 2026–Feb 2027, ~8 weeks)**
  - Setup with templates, Today screen, timer, block report, fix → retest loop, pace view.
  - Anki: manual path (A) for everyone; "Connect Anki" (B) if Phase 0 shows most students use Anki on a laptop.
  - Web first; Tauri desktop build where AnkiConnect is needed.
  - After Supabase is added, reuse from `productivity-v2/src/store/useAnalyticsStore.ts`: the offline queue (sessions sync when back online) and guest mode → account with data kept (`switchUser` / `resetGuestData` logic).
  - Study calendar on the Week tab (rework of v2's heatmap, which needs improvement). Requirements decided in Phase 1; starting point: each day is full day / light day / rest, no streak counter, no guilt, tap a day to see what was done.
  - Explicitly NOT bringing over from v2: calibration mode, daily score, focus purity, work/break ratio, task velocity, leaderboard, hydration.
- **Phase 2 — Beta at Mutah (Mar–May 2027)**
  - 30–50 students from my batch. Watch daily use, not opinions. Target: 40%+ still using it after 4 weeks.
  - Test willingness to pay with a $29/yr pre-order before building payments.
- **Phase 3 — Launch in Jordan (mid-2027)**
  - Public launch, paid Pro tier, templates per Jordanian university, Instagram content.

### Future (after it works in Jordan)
- Less typing: paste QBank results, calendar import for rotations, richer Anki data (per-topic tags, retention) on top of the basic AnkiConnect sync.
- AI coach: explains patterns in wrong answers and writes fix tasks (Claude Haiku 5.5 ≈ $0.00055 per suggestion at ~3k in / 500 out tokens).
- Study rooms: my earlier "virtual library" idea (isometric pixel-art co-working room, NPCs, timer above the table) — study next to people on the same exam/system, by batch or exam month. Better than a generic live user count.
- Shared templates ("Mutah 5th year, IM block") — built-in word of mouth.
- More exams: PLAB, SMLE, Jordanian boards, then non-medical exams.
- Mobile apps; later licenses for universities / student societies.

---

## 9. Business

### Pricing
- **Free:** setup, Today screen, timer, block reports, basic pace. Must be good on its own (Blueprint's planner is free).
- **Pro, Jordan/region:** $29/year or $3.99/month — fix → retest loop, weak-topic tracking, weekly report, AI coach, shared templates. ≈ $27.05 after fees.
- **Pro, international:** $59/year — same features for USMLE/PLAB students abroad. ≈ $55.55 after fees.
- Payments via a merchant of record (Paddle / Lemon Squeezy: 5% + $0.50, they handle tax).
- Benchmark: freemium converts 2–5% on average, 8–10% is strong; education apps tend lower.

### Cost per year (cheapest → most expensive)
| Option | Includes | Year-one cost |
|---|---|---|
| 1. Solo, free tiers (Phases 0–2) | Supabase Free, Vercel Hobby (non-commercial, fine for beta), domain | ~$15 + my time |
| 2. Solo, launched (Phase 3) | Vercel Pro $240 + Supabase Pro $300 + domain ~$15 + Apple $99 if iOS + AI ~$100–600 | ~$750–1,250 |
| 3. Solo + freelancers | Option 2 + freelance design/dev (~$3k–15k) | ~$4,000–16,000 |
| 4. Hire a local developer | Option 2 + full-time dev in Amman (~JOD 2,000/mo ≈ $34k/yr senior) | ~$26,000–36,000 |
| 5. Agency | Option 2 + small agency MVP ($15k–75k) + maintenance | ~$16,000–76,000 |

AI estimate: 1,000 daily users × 3 suggestions/day ≈ $600/yr.

### Realistic revenue (estimates, not forecasts)
| Year | Assumptions | Paying | Revenue after fees |
|---|---|---|---|
| 1 — Jordan launch | 1,500 free users · 3% convert · all $29 | 45 | ~$1,200 |
| 2 — Jordan + first IMGs | 6,000 free · 4% · 70% Jordan / 30% intl | 240 | ~$8,500 |
| 3 — Regional + intl | 25,000 free · 5% · 40% Jordan / 60% intl | 1,250 | ~$55,000 |

- **Jordan-only ceiling:** 30% of ~23,000 students use it, 5% pay → 345 × $27 ≈ $9,300/yr. Side income, not a business. Real money requires going international.
- With option 2 costs it pays for itself from year 1. Hiring only makes sense after year 2 if international growth is real.
- Phase 2 beta numbers (retention, willingness to pay) must replace these assumptions.

---

## 10. Risks and how we test them

| Risk | Test / mitigation |
|---|---|
| Students don't feel the problem | Phase 0 interviews before real code |
| Logging feels like extra work | <10 s per block; timer fills minutes; Anki sync later; measure drop-off in beta |
| Free planners are good enough | Lead with fix → retest loop and local exams |
| Students won't pay | $29/yr pre-order test with beta users before building payments |
| Seasonal usage | Yearly plans; cover uni exams too, not only USMLE |
| My time as a med student | Small phases, hard scope limits, stop rules |

---

## 11. Rejected / already discussed (don't re-propose)

- Adding more generic features to productivity-v2 to make it "stand out" — doesn't work; that's the original problem.
- A pure tracker/analytics app that re-logs what UWorld/Anki already show — useless on its own.
- Hardcoding university curricula — every student/university differs; use user-described goals + templates instead.
- Building the new product inside productivity-v2 — start fresh and copy parts.
- Charging for planning alone — Blueprint's planner is free.
- Postponing Anki support to "later" — Anki is central for med students; it's in from the start (manual + optional AnkiConnect).
- Rebuilding Anki's scheduling inside Locus — Anki decides what's due; Locus only plans time around it.
- Post-call / call-day questions in onboarding — replaced by automatic light-day detection.
- A "calibrating" mode or screen for time estimates — estimates blend in gradually instead.
- Asking for weekend days — derived from the university's country.
- Feature-pile UI (widgets, panels, toggles for everything) — see section 4b.

## 12. Open decisions

- Final name (Locus is a placeholder).
- Real exam-weight numbers per system (the prototype used made-up example weights).
- Exactly how topics are captured after a block (quick-pick list vs free text vs paste results) — keep it under 10 seconds.
- Whether the first validation prototype is a standalone HTML page or the start of the real app.

---

## 13. What I want from Claude Code right now

1. Don't write the full app yet. Phase 0 first.
2. First task: build a **clickable prototype** (fake data) of the **Today** screen and the **Block finished → fix added** screen, so I can show it to 10 classmates. Follow section 4b exactly: Apple-level clean, not AI-looking, works on phone browsers.
3. When I say go for Phase 1: scaffold a new project (same stack), copy the reusable parts from `C:\Users\omarm\Desktop\CS\productivity-v2` listed in section 7, and implement the plan engine as a pure, tested function.
4. Keep scope tight. If something isn't needed for the current phase, say so instead of building it.

---

## Sources (checked November 2026)
- Petra / Jordan Medical Association (Apr 2026) — student numbers, graduates vs residency slots
- USMLE 2025 performance data (via getoncourse.ai) — 25,660 non-US IMG Step 1 examinees
- UWorld Dynamic Study Planner (medical.uworld.com; PR Newswire, Nov 2024)
- Blueprint Med Study Planner — blueprintprep.com/medical/med-school/study-schedule
- Oncourse $119/yr; AMBOSS QBank bundle $448/yr (getoncourse.ai, pricingsaas.com)
- UWorld Step 1 12-month ~$449 (aimed-study review, Apr 2026)
- Supabase Pro $25/mo; Vercel Pro $20/user/mo, Hobby non-commercial
- Apple Developer $99/yr; Google Play $25 once
- Paddle / Lemon Squeezy 5% + $0.50 (flaviocopes.com)
- Claude Haiku 5.5: $0.10 / $0.50 per million tokens
- MVP costs: freelancer $3k–15k, small agency $15k–75k (projectcostestimator.com, orbix.studio)
- Senior software engineer, Amman ~JOD 2,000/month (Glassdoor, Jun 2026)
- Freemium conversion 2–5% avg, 8–10% strong (appcues.com)
