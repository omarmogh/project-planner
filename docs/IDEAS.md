# Locus — new ideas (round 9)

Goal: find features no competitor offers that make a tired 5th-year say "I need this".
Every idea must improve what the student **learns, remembers or scores**, or how well they **decide what to study**. Ideas that mainly measure effort or time were thrown out.

Status: steps 1–4 below. Step 5 (a clickable #1 behind `?idea=1`) is built only after Omar approves the top 3.

---

## 1. Ground it

### What learning science says works

**Well established.** These are replicated findings, many of them in medical learners.

| Finding | What it says | Key sources |
|---|---|---|
| **Retrieval practice (testing effect)** | Pulling information out of memory strengthens it more than re-reading it. This holds even with no feedback, and the effect is larger after a delay. | Roediger & Karpicke 2006; Larsen, Butler & Roediger 2009 (residents, 6-month retention); Dunlosky et al. 2013 rated it "high utility" |
| **Spacing** | Reviews spread out over time beat the same reviews massed together. The best gap grows with how long you need to remember. | Cepeda et al. 2006 (meta-analysis); Cepeda 2008; Kerfoot's spaced-education RCTs in urology residents and med students (2007–2010) |
| **Low value of passive review** | Re-reading, highlighting and summarizing give little lasting benefit, yet they *feel* productive. | Dunlosky et al. 2013 ("low utility") |
| **Fluency illusion / overconfidence** | Material that feels familiar (you just watched the video) is judged as learned. Judgments made right after study are poorly calibrated. | Koriat & Bjork 2005; Kornell & Bjork 2008 |
| **Delayed judgments of learning** | "Do I know this?" is far more accurate when asked later and from a cue alone than when asked right after study. | Nelson & Dunlosky 1991 (delayed-JOL effect) |
| **Interleaving for look-alikes** | Mixing similar categories teaches you to tell them apart better than blocking them. It is strongest when the task is discrimination (which disease is this?). | Kornell & Bjork 2008; Rohrer & Taylor 2007; Hatala et al. 2003 (ECG interpretation in med students) |
| **Hypercorrection** | Errors made with high confidence are corrected *more* easily than low-confidence errors, if the student gets feedback. | Butterfield & Metcalfe 2001; Metcalfe 2017 (review) |
| **Desirable difficulties** | Conditions that slow learning now (spacing, testing, mixing) often improve long-term retention. | Bjork 1994; Bjork & Bjork 2011 |
| **Forgetting curve** | Memory falls off steeply soon after learning, then more slowly. Each successful retrieval flattens the curve. | Ebbinghaus 1885; replicated by Murre & Dros 2015 |
| **Basic-science decay in med school** | Medical students lose a large share of their preclinical basic science within a few years unless it is used. | Custers 2010 (review). *The exact percentages vary by study, so treat any single number as approximate.* |
| **Explanatory feedback** | Feedback that explains *why* beats right/wrong feedback alone. | Butler, Godbole & Marsh 2013 |

**Moderate or uncertain.** Use these, but don't promise outcomes.

- **Pretesting.** Attempting questions *before* learning a topic improves later learning of it, even when you get them wrong (Richland, Kornell & Kao 2009; Pan & Carpenter 2023 review). The evidence is fairly robust in the lab. Evidence in real medical curricula is thinner.
- **Calibration training.** Students can learn to judge their own knowledge better with feedback. *Uncertain:* whether better calibration alone raises exam scores. The plausible mechanism is better choices about what to study, but direct evidence is limited.
- **Generation / illness scripts.** Linking knowledge to a real patient case helps clinical reasoning (Schmidt & Rikers 2007 on illness scripts). *Uncertain:* the size of the benefit for exam scores specifically.
- **Error-type analysis.** It is widely recommended for QBank review (the "why did I miss it" log). It has little controlled evidence behind it.
- **Protégé effect.** Teaching or preparing to teach helps learning (Nestojko et al. 2014). Effects are modest and setup-dependent.

### What our students struggle with

Sources: CLAUDE.md, Omar's own experience, and the Phase 0 interviews still to come.

1. **Several exams at once.** A rotation exam every few weeks, uni finals, and Step 1 in 6 months. Each one pulls toward different material.
2. **Rotations drain time and energy.** Ward hours, call and commuting mean study happens tired and in fragments.
3. **Scattered resources.** UWorld, B&B, First Aid, uni slides, Telegram lecture videos, past papers shared in group chats. No single tool sees all of them.
4. **Uni exams have no QBank.** For local exams there is often nothing to *test yourself with*. Students fall back on re-reading slides and re-watching Telegram videos, which are exactly the low-utility methods.
5. **Passive watching feels like progress.** "I watched all of Cardio" ≠ "I can recall Cardio" (the fluency illusion).
6. **Bad calls about what to study.** Students pick topics by feel, avoid weak ones, and overestimate topics that feel familiar.
7. **Ward learning is disconnected from desk learning.** Students see real heart failure patients in the morning and study a different system at night.

The biggest gap: **retrieval practice is the best-supported technique, and our students have no way to do it for half their material (uni slides, videos).** The second gap is that they misjudge what they know.

---

## 2. Generate: 15 ideas

Novelty checks use what I know (to June 2026) plus three quick web searches done for this doc. Where I say "believed new", I found no product doing it, but I can't prove a negative.

### 1. Recall Sweep
**Pitch:** See only a title, recall what you know, tap one of three buttons. Locus finds what you *think* you know but don't, for any material, including uni slides.

**A real day:** Lina is post-ward at 7 pm, too tired for a QBank block. Today's plan has "Recall sweep · Cardio · 4 min".
1. She presses Start. Card 1 shows "Heart failure: types and treatment" (a B&B title or uni lecture title, nothing else).
2. Prompt: "Think of the 3 things you'd want to remember." She thinks for ~15 s.
3. She taps **Had it**, **Fuzzy** or **Blank**. Next card.
4. After 8 cards: "2 blank, 1 fuzzy. Added: 10 questions on those this week. Had-it topics get a spot-check later."
5. The spot-check: if a "Had it" topic later scores <60% in a block, Locus tells her once, kindly: "You felt sure about Valvular disease, but it scored 45%. Worth a second look."

**Principle:** Retrieval practice. Delayed, cue-only judgments of learning (the most accurate kind of self-judgment). Spacing, because sweeps revisit covered topics.

**Data:** Topic titles Locus already has (topic map, B&B titles). For uni slides, the lecture titles the student pastes once at setup. Per card: 1 tap, which *is* the studying. No extra logging.

**Novelty check:** Blurting apps exist ([Blurtr](https://apps.apple.com/app/id6747290884), [Blurt](https://apps.apple.com/app/id6745759423)). There, you type or say everything you remember from your own notes and AI scores it. Anki has cards, but someone must write them. **The difference:** Locus needs no content and no typing. It runs on titles you already have, works for uni lectures and Telegram videos with no QBank, and feeds the result straight into the daily plan (blank → questions this week; "Had it" → spot-checked). I found no planner that does this. **Believed new.**

### 2. Patient of the day
**Pitch:** Saw a patient with DKA on the ward today? One tap, and tonight's study is about DKA.

**A real day:**
1. At 3 pm, between patients, Lina opens Locus. Today shows a small line: "Saw an interesting patient? Add them."
2. She types "dka" and picks **Diabetic ketoacidosis (Endo)** from the topic list (2 taps).
3. Tonight's plan swaps one task: "Endo: 10 questions on DKA. From your patient today." It is still sized to the time she has.
4. On Sunday, the week report shows: "3 ward patients turned into study this week."

**Principle:** Elaboration and illness scripts (linking knowledge to a concrete case). Relevance-driven timing: studying a topic when it has a real face makes it easier to remember. *The score effect is uncertain.*

**Data:** The topic map, which Locus already has. 2 taps, optional, never asked.

**Novelty check:** Patient logs exist ([Debrief](https://apps.apple.com/us/app/debrief/id6769976772), [WakeTrack](https://waketrack.wakehealth.edu)), but they track encounters for the school; they don't change your study plan. Planners (UWorld, Blueprint) don't know what you saw today. **Believed new.**

### 3. Call your score
**Pitch:** Before you type your block score, guess it. Over time Locus shows where you overestimate yourself, and plans around it.

**A real day:** Lina finishes 20 Cardio questions. The Block finished screen first asks "What do you think you got?" with chips 30 / 40 / 50 / 60 / 70 / 80%. She taps 70. Then she enters the real score: 50%. After 4+ blocks, Pace shows one line: "You tend to overestimate Cardio by ~15%. It's getting extra time."

**Principle:** Metacognition and calibration feedback. *Whether this improves scores is uncertain.*

**Data:** 1 tap per block.

**Novelty check:** Per-question confidence ratings already exist ([MedStudy Qbank+](https://explore.medstudy.com/blog/confidence-levels); [USMLE Benchmark](https://blog.blueprintprep.com/medical/the-best-usmle-prep-strategy-starts-with-question-banks-and-practice-tests/) has a 1–6 scale). **The difference:** a block-level prediction, for any resource, with calibration per system feeding the plan. That is **partly new**.

### 4. Sure-but-wrong
**Pitch:** On the Block finished screen, mark the missed topics you were *sure* about. Those get fixed first.

**A real day:** After a block, the missed-topics pick has an optional second tap: "Was sure." Fixes for those jump the queue, and the retest comes sooner.

**Principle:** Hypercorrection.

**Data:** 1 optional tap per missed topic.

**Novelty check:** Confidence per question already exists in MedStudy and Benchmark. Using it to prioritize the fix is a small twist. **Mostly not new.**

### 5. Why did I miss it
**Pitch:** One tap per block (didn't know / misread / down to two / ran out of time), and each reason gets a different fix.

**A real day:** After a 50% block, Lina taps "down to two". The fix becomes "10-min review: compare the two options you hesitated between", not "watch the video again".

**Principle:** Error analysis and targeted feedback. *Evidence is weak.*

**Data:** 1 tap per block.

**Novelty check:** Students already do this in spreadsheets (the widespread "error log" advice). Some QBanks have notes. Turning it into routed fixes is **partly new**.

### 6. Questions first
**Pitch:** For new topics, do 5 questions *before* the video. Getting them wrong is the point.

**A real day:** Plan: "Renal: 5 questions on glomerular disease first (expect to miss them), then the B&B video."

**Principle:** Pretesting. *Moderate evidence.*

**Data:** None. But the student has to find 5 questions on an unstudied topic in UWorld, and UWorld's topic filtering is coarse. That is real friction.

**Novelty check:** It's common study advice. **Believed new in planners**, though the idea itself is well known.

### 7. Look-alike duels
**Pitch:** Locus spots look-alike pairs (nephritic vs nephrotic, Crohn's vs UC, SIADH vs DI) and gives you a short drill that mixes them.

**A real day:** After Lina misses a nephrotic question, tomorrow's plan has "Duel: nephritic vs nephrotic · 5 min". One card at a time: "Name 2 things that tell them apart." Then she self-rates, and a mixed 10-question block follows the same week.

**Principle:** Interleaving for discrimination. Contrastive retrieval.

**Data:** A curated list of confusable pairs, ~40–60 to start. This is content work and needs medical review. No extra input.

**Novelty check:** Comparison tables exist in AMBOSS articles and First Aid, but you read them. Nobody I found schedules contrast drills from *your* misses. **Believed new.**

### 8. Exam-anchored keep-alive
**Pitch:** Solid topics get a tiny check timed so memory peaks at the exam date.

**Novelty check:** Too close to the existing retests in Locus and to Anki's scheduling. **Not new for Locus.**

### 9. Past-paper yield map
**Pitch:** Classmates mark which lectures came up in past uni exams. Locus weights the plan by local yield.

**Data:** Crowd-sourced, so it needs many users per batch. Accuracy and trust are a problem.

**Novelty check:** Unofficial "high-yield" lists are shared on Telegram. A structured version is **new locally**.

### 10. Last-48-hours sheet
**Pitch:** Before an exam, a personal list of everything you missed, your fuzzy recalls and your sure-but-wrong topics.

**Novelty check:** UWorld already lets you review incorrect questions, and AMBOSS has similar. Cross-resource is a twist. **Partly new.**

### 11. Quiz-swap buddy
**Pitch:** Two classmates quiz each other on each other's weak topics for 10 minutes.

**Novelty check:** Study-buddy apps exist. Matching on weak topics is new-ish, but it needs coordination between two tired people.

### 12. Explain-it-back
**Pitch:** After a video, explain it in 60 seconds (to yourself or by voice note).

**Novelty check:** Feynman-technique apps exist, and Blurt does it with AI scoring. **Not new.**

### 13. Exam-week drop list
**Pitch:** Locus tells you what to *skip* in the last week.

**Novelty check:** Planners already compress the schedule near the exam. **Not new.**

### 14. Dress rehearsal blocks
**Pitch:** Practice blocks at the real exam time of day.

**Novelty check:** Planners already schedule NBME/UWSA self-assessments. **Not new.**

### 15. Mix-it-up nudge
**Pitch:** Once a system is covered, Locus switches its blocks from single-system to mixed.

**Novelty check:** This is standard advice ("go random after a first pass"), and UWorld planners schedule random blocks. **Mostly not new.**

### Hard-rules re-check

Each idea was checked against the banned list: timer, gamification, rankings, wellbeing extras, generic AI, to-do stats, and anything already in Locus.

- #8 overlaps existing retests → **dropped** (it's already in Locus).
- #12 has no clear difference from existing apps → **dropped** (not new).
- #13 and #14 → **dropped** (not new).
- None mainly measures effort or time. #2's weekly line counts patients turned into study, which is a learning prompt rather than effort, and it can be cut if it feels like a stat.

Survivors going into critique: 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 15.

---

## 3. Tear it apart

The question for each idea: would a tired 5th-year on rotation use it **weekly**? Does it add input? Does it fit section 4b (calm, one decision per screen)? What does it cost?

| # | Idea | Used weekly? | Input burden | Fits 4b? | Build / run cost | Verdict |
|---|---|---|---|---|---|---|
| 1 | Recall Sweep | **Yes.** It's the one study activity that works when you're too tired for questions, and it's 3–5 min. | 1 tap per card, but the tap *is* the studying. Uni lectures need a one-time paste of titles. | Yes: one card, three buttons. | Low. Uses the existing topic map, the plan engine and a new task kind. No running cost. | **Keep.** Risk: self-ratings are overconfident. Mitigation: blank items are verified with questions, and "Had it" items are spot-checked against later scores. |
| 2 | Patient of the day | Likely 1–3× a week on rotations. Never asked, so no nagging. | 2 taps, optional. | Yes, if it's one quiet line on Today. | Low: topic search + a plan reorder rule. | **Keep.** Risk: the score benefit is unproven. Its value is motivation and relevance, and students will *feel* it. The topic list must include clinical names (DKA, not "Endo misc"). |
| 3 | Call your score | Yes, if it's a single tap on a screen they already see. | 1 tap per block. | Mostly. It adds one step before the score, so it must be skippable. | Very low. | **Keep as #4.** Per-question confidence already exists elsewhere. Calibration → score is uncertain. Could later be folded into Recall Sweep's spot-check, which already gives calibration feedback for free. |
| 4 | Sure-but-wrong | Rarely. One more tap on a screen that must stay under 10 s. | 1 tap per missed topic. | Adds clutter to Block finished. | Very low. | **Kill.** Not new enough, and it costs taps on the most time-sensitive screen. |
| 5 | Why did I miss it | Maybe for 2 weeks, then skipped. | 1 tap per block. | Borderline. | Low. | **Kill for now.** Weak evidence. Partly duplicates "Partly/Didn't" outcomes. Revisit if interviews show students keep error logs. |
| 6 | Questions first | Rarely. Finding 5 questions on an unstudied topic in UWorld is fiddly. | Real friction outside Locus. | Yes. | Very low. | **Kill as a feature.** Could become a one-line plan *reason* later ("Questions before the video: getting them wrong helps"). |
| 7 | Look-alike duels | Yes, triggered only by real misses. | None. | Yes: one card at a time. | **Medium:** a curated pair list (~40–60) that needs medical review. That is Omar's time. | **Keep.** A strong learning principle, and the pair list is a moat. Content effort is the cost. |
| 9 | Past-paper yield map | Would be loved, but needs many users per batch first. | Crowd input. | Yes. | Medium, plus moderation and trust. | **Later.** Revisit with shared templates in Phase 3. |
| 10 | Last-48-hours sheet | Once per exam, not weekly. | None. | Yes. | Low. | **Later.** Nice, but small. It falls out naturally once 1 and 7 exist. |
| 11 | Quiz-swap buddy | Unlikely. Two tired people must align their schedules. | High coordination. | Adds a social layer. | Medium. | **Kill.** |
| 15 | Mix-it-up nudge | Passive, so yes. | None. | Yes. | Very low. | **Fold in** as a plan-engine rule later, not a feature. Not distinct enough to market. |

---

## 4. Rank

Each score is 1–5. Build effort: 1 = small. Input burden: 1 = none, 2 = a tap or two, 3 = more.

**Score = (impact × uniqueness) ÷ (build effort + input burden)**

| Rank | Idea | Impact | Uniqueness | Effort | Burden | Score |
|---|---|---|---|---|---|---|
| **1** | **Recall Sweep** | 5 | 4 | 2 | 2 | **5.0** |
| **2** | **Patient of the day** | 3 | 5 | 2 | 2 | **3.75** |
| **3** | **Look-alike duels** | 4 | 4 | 3 | 2 | **3.2** |
| 4 | Call your score | 3 | 3 | 1 | 2 | 3.0 |
| 5 | Mix-it-up nudge | 2 | 2 | 1 | 1 | 2.0 |

### #1 Recall Sweep: why it could be the reason people choose Locus
- **It fills the biggest hole.** Uni exams and Telegram videos have no QBank, so students re-read and re-watch. Recall Sweep gives them retrieval practice for *any* material they can name. No competitor does this, because they only plan around their own content.
- **It works when you're wrecked.** A 4-minute sweep is the one valuable thing you can do at 10 pm after call. This fits the light-day logic perfectly: a light day can be "just a recall sweep".
- **It fixes the fluency illusion.** "You felt sure about Valvular disease, but scored 45%" is the moment a student realizes the app knows them. That moment is memorable and shareable.
- **It makes the plan smarter for free.** Blank and fuzzy topics feed the existing fix → retest loop with zero logging.
- **Pitch line:** *"Watched it ≠ know it. Locus checks."*

### #2 Patient of the day: why it could be the reason people choose Locus
- **Only a rotation student has this need,** and only a planner that knows about rotations can serve it. Blueprint and UWorld can't.
- It turns the ward into the study plan. That is how clinicians actually build knowledge (illness scripts), and students feel it immediately.
- It's optional, quiet and 2 taps, and it gives the student a reason to open Locus during the day.
- **Pitch line:** *"Saw it this morning, nailed it tonight."*

### #3 Look-alike duels: why it could be the reason people choose Locus
- Much of the exam is about telling look-alikes apart, and interleaving is the evidence-backed fix. No planner schedules contrast drills from *your* misses.
- **The curated pair list becomes Locus's own content asset:** small, high-yield and hard to copy well.
- **Cost to be honest about:** the pair list needs Omar's (or a resident's) review. That makes it more of a Phase 1–2 item than a quick win.
- **Pitch line:** *"Nephritic or nephrotic? Locus drills the ones you mix up."*

### Notes
- **Synergy:** 1 and 3 share one card mechanic (prompt → think → self-rate). Building Recall Sweep first makes Duels cheap later.
- **Free calibration:** Recall Sweep's spot-check gives most of "Call your score"'s benefit without the extra tap.
- **Phase 0 interview questions this adds:**
  - "How do you test yourself on uni lectures?"
  - "When you see an interesting patient, does it change what you study that night?"
  - Watch whether students react to the "you felt sure but scored 45%" moment.

### Step 5 plan (waiting for approval)
Prototype **Recall Sweep** in the existing clickable prototype. It sits behind an idea flag in `src/lib/features.ts` (off by default, on with `?idea=1`). With the flag on:
- Today shows a "Recall sweep · Cardio · 4 min" task built from Lina's covered Cardio topics.
- Pressing Start opens a one-card-at-a-time screen with Had it / Fuzzy / Blank.
- A summary shows what was added to the week.

Nothing else changes when the flag is off.
