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
| Skip onboarding | “Use demo student” on the first screen (Lina) |

## Layout

```
src/engine/   pure plan logic (pace, plan, fixes, retests, weekly) + tests — reused in Phase 1
src/data/     onboarding templates, answers → plan, demo student (Lina)
src/store/    Zustand in-memory demo state
src/screens/  Onboarding, Today, Running, BlockFinished, Pace, Weekly, AnkiConnect
src/ui/       small primitives (Button, Chip, Stepper, Tag, ProgressBar, Page, TabBar)
src/lib/      features.ts (future Pro gating), dev switches, formatting
```

Pro gating later: flip `PRO_GATING` in `src/lib/features.ts`; screens only call `isEnabled(id)`.
