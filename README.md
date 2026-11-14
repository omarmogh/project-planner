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
| Reset the demo | `?reset`, or long-press the faint “Locus” wordmark on Today |
| Skip onboarding | “Use demo student” on the first screen (Lina, always Sunday 15 Nov 2026, post-call, studying Cardio) |

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
