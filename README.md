# Locus — Phase 0 prototype

Clickable prototype for validation interviews (see `CLAUDE.md`, section 8).
In-memory only: refresh = fresh demo. No backend, no auth.

## Run

```bash
npm install
npm run dev        # http://localhost:5173 (also on your LAN IP for a phone on the same Wi-Fi)
npm test           # engine unit tests
npm run build      # type-check + production build
```

## Dev-only switches (invisible to classmates)

| What | How |
|---|---|
| Right-to-left layout | `?dir=rtl` in the URL, or **Ctrl+Shift+D** to toggle |
| Reset the demo | `?reset`, or long-press the faint “Locus” wordmark on Today (both wipe the saved state) |
| Skip onboarding | “Use demo student” on the first screen (Lina, always Sunday 15 Nov 2026, post-call, studying Cardio) |

## Saved between visits

The whole demo state is saved to `localStorage` (`locus-demo`, Zustand `persist`) with a schema version (`STORE_VERSION` in `src/store/demoStore.ts`). Bump it whenever the saved shape changes: an older or unreadable save starts fresh instead of crashing. Only data is saved (plan, today's tasks, tab…), never an open sheet or a running timer. `?reset`, the long press and "Use demo student" all start fresh.
Known gap: the saved "today" doesn't roll over to a new day yet (the demo is pinned to a date anyway).

## Bring in UWorld results

Optional onboarding step after resources (only if UWorld is picked), also on Pace ("Bring in / Update UWorld results"). Paste the *performance by system* report text → preview → Confirm / Fix, or type questions used + % correct per system, or Skip.
The parser (`src/data/uworldImport.ts`) is tolerant: one cell per line or tab rows, any order, extra lines, missing systems, Subjects section ignored. **Its test fixtures are synthetic until a real pasted report is added.**
Imported results seed accuracy by system and UWorld questions done; the weakest system under 60% gets a fix today, and system order puts weak unstarted systems first. Imported numbers never count as this week's work.
Phase 1 (not built): import from a screenshot with AI.

## Pace = your road to the exam

Verdict (on track / behind / ready around), the systems in planned order with date ranges up to the exam (uni exams marked), daily load needed vs available, one what-if (extra minutes a day, skip tomorrow), and accuracy by system once there's data (import or 2 blocks). Engine: `roadToExam`, `dailyLoad`, `readyOnWith` / `whatIfDays` in `src/engine/pace.ts`.

## "Already watched" (current system only)

Onboarding offers an optional, collapsed "Already watched some of Cardio?" row under the current system(s); Today's system line ("Cardio: 6 of 14 topics watched · 3 solid") opens the same checklist as a sheet.
A tick means *watched*, not *mastered*: ticked videos leave the topic's task; when every video in a topic is ticked, the topic becomes a short check ("Heart failure: 10 UWorld questions"). Only question results and retests make a topic solid.

## Design tokens

Every color, size, radius, weight and breakpoint lives in `src/index.css` (rem-based, so zoom and text size scale the app). Components use only those tokens.

## Tuning

- Planning assumptions (post-call share, minutes per question, minutes per B&B video / First Aid section, retest rules…): `src/engine/config.ts`, one comment each.
- Made-up template numbers (totals, "Not sure" defaults, rough exam dates): search for `TODO(placeholder)` in `src/data/`.
- The topic map (systems → topics): `src/data/topics.ts`.

## Resource structure (titles only)

Source files go in `resources-src/` (gitignored, never committed). From them, only titles are extracted and mapped to topics:

```bash
node scripts/gen-bnb.mjs resources-src/bnb-checklist.pdf   # writes src/data/resources/bnb.ts
```

The mapping lives in the script (`MAP`); it fails if a video maps to an unknown topic or twice. Judgment calls are exported as `BNB_NEEDS_REVIEW`.
`src/data/resources/firstaid.ts` is a stand-in (one section per topic, named after the topic) until the First Aid book is in `resources-src/`.

## Layout

```
src/engine/   pure plan logic (config, topics, plan, progress, pace, fixes, retests, weekly) + tests — reused in Phase 1
src/data/     topic map, resource titles (resources/), onboarding templates, answers → plan, demo student (Lina)
src/store/    Zustand in-memory demo state
src/screens/  Onboarding, Today, Running, BlockFinished, Pace, Weekly, AnkiConnect
src/ui/       Page (the one layout component: phone / tablet / desktop), Nav, Button, Chip, Stepper, Tag, ProgressBar, ThemeSwitch
src/lib/      features.ts (future Pro gating), theme, dev switches, formatting
```

## Deploy (Vercel)

Vercel detects Vite: build `npm run build`, output `dist`. No env vars, no rewrites needed.

Pro gating later: flip `PRO_GATING` in `src/lib/features.ts`; screens only call `isEnabled(id)`.
