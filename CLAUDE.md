# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**untis_schulausfälle** – A Next.js web app for BZZ (Bildungszentrum Zürichsee) that fetches and displays school lesson cancellations and absences from WebUntis. Companion project to `bzz_dispensationsgesuche`.

## Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (`"strict": true`)
- **UI**: React 19 + Tailwind CSS v4 + lucide-react icons
- **WebUntis**: `webuntis` npm package — login/logout per request via `withUntisClient()` wrapper
- **Testing**: Vitest + jsdom

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint (flat config, next/core-web-vitals + next/typescript)
npm run typecheck    # TypeScript type-check (tsc --noEmit)
npm run test         # Run all tests once
npm run test:watch   # Watch mode
npm run coverage     # Run tests with coverage report
npm run format       # Prettier — write
npm run format:check # Prettier — check only (used in CI)
```

A husky pre-commit hook runs lint-staged (ESLint --fix + Prettier on staged files).

Run a single test file:

```bash
npx vitest run tests/lib/calendar.test.ts
```

## Architecture

### Directory layout

```
app/
  layout.tsx              # Root layout
  page.tsx                # Entry point — class dropdown + calendar
  api/
    classes/route.ts      # GET → active classes + companions + fetchIds
    calendar-data/route.ts # GET ?classIds=… → classified days for school year
components/               # ClassSelector, SchoolYearCalendar, CalendarLegend, IAVariantDialog
src/
  types.ts                # All shared TypeScript interfaces
  index.css               # Tailwind v4 entry
  lib/
    calendar.ts           # classifyDays() + helpers (pure)
    classGroups.ts        # Companion class rules + IA variant resolution
    webuntis.ts           # withUntisClient() wrapper (login → fn → logout)
tests/                    # Vitest unit tests
```

### Path alias

`@/*` resolves to project root (e.g. `@/components/Foo`, `@/src/types`).

### WebUntis API pattern

API routes wrap their WebUntis work in `withUntisClient(async (untis) => …)` from `src/lib/webuntis.ts` — it handles login/logout (incl. error paths). Routes return `NextResponse.json(...)`.

### Companion class rules

`src/lib/classGroups.ts` defines `COMPANION_RULES` declaratively. To change which classes get merged, edit this array — no logic changes needed.

IA classes are a special case: they're shown standalone in the dropdown, and the BM/ABU variant is picked via `IAVariantDialog` after selection (rules in `getIAVariants`).

### UI conventions

- All user-facing text in **German** (Swiss school dialect)
- Color palette: slate (neutrals) + indigo (primary) + emerald (BM/positive) + orange (Schulausfall) + violet (Ferien) + amber (Feiertag)

## Environment variables

```
WEBUNTIS_SCHOOL=
WEBUNTIS_USERNAME=
WEBUNTIS_PASSWORD=
WEBUNTIS_BASE_URL=
```
