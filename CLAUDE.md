# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**untis_schulausfälle** – A Next.js web app for BZZ (Bildungszentrum Zürichsee) that fetches and displays school lesson cancellations and absences from WebUntis. Companion project to `bzz_dispensationsgesuche`.

## Stack

- **Framework**: Next.js 16 (App Router), Node.js 26 LTS (Docker + CI)
- **Language**: TypeScript (`"strict": true`)
- **UI**: React 19 + BZZ Design System (`src/styles/bzz-design.css`) + Tailwind CSS v4 + lucide-react icons
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
npm run release      # Cut a release from changelog[0] (annotated tag + GitHub release)
```

A husky pre-commit hook runs lint-staged (ESLint --fix + Prettier on staged files).

Run a single test file:

```bash
npx vitest run tests/lib/calendar.test.ts
```

### Releases / Versioning

`src/lib/changelog.json` is the single source of truth for the version + changelog.
`src/lib/version.ts` re-exports it as the typed `CHANGELOG` plus a derived
`APP_VERSION`; the footer shows `v<APP_VERSION>` and opens `VersionDialog` with the
history. To cut a release:

1. Prepend a new entry (newest first) to `src/lib/changelog.json`.
2. Bump `version` in `package.json` to match `changelog[0].version`.
3. Commit + push `main`.
4. `npm run release` — validates (clean tree, on main, pushed, versions match, tag
   unused, `gh` authed), then creates the annotated tag and GitHub release from
   `changelog[0]`. `npm run release -- --dry-run` previews without changing anything.

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
  index.css               # Tailwind v4 entry + BZZ design import + --cal-* calendar colours
  styles/bzz-design.css   # vendored copy of bzz.eifach.online/_eifach/design/design.css
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

### MCP server

`/api/mcp` exposes the calendar data as MCP tools (stateless Streamable HTTP via `mcp-handler` 2 / MCP SDK v2 `@modelcontextprotocol/server`; tool `inputSchema`s are full `z.object(...)` schemas, zod 4). Tool registrations, cached data accessors, class resolution, and rate limiting live in `src/lib/mcp/`. Rate limit: 20 req/min/IP (in-memory), bypassed via the `MCP_ADMIN_KEY` env var + `?key=` query param. MCP data uses the serverCache with a 15-min TTL.

`/api/mcp-stats` returns the MCP request count of the last 15 minutes (in-memory, `src/lib/mcp/requestStats.ts`); `McpRequestBadge` shows it unobtrusively in the `SiteFooter`.

### Companion class rules

`src/lib/classGroups.ts` defines `COMPANION_RULES` declaratively. To change which classes get merged, edit this array — no logic changes needed.

IA classes are a special case: they're shown standalone in the dropdown, and the BM/ABU variant is picked via `IAVariantDialog` after selection (rules in `getIAVariants`).

### UI conventions

- All user-facing text in **German** (Swiss spelling: «ss», no «ß»), addressing users with «Sie»
- Look follows the **BZZ Design System** (https://bzz.eifach.online/design/, rules in
  `/_eifach/design/guidelines.md` there). `src/styles/bzz-design.css` is an unmodified copy
  (except the font: Inter comes from `@fontsource-variable/inter`, no CDN) — re-download it
  to update, don't edit it. It is imported into the Tailwind `components` layer, so utilities
  still override it.
- Use the `.bzz-*` building blocks (`bzz-card`, `bzz-btn`, `bzz-note`, `bzz-rows`, `bzz-tag`,
  `bzz-field` …) and the `--bzz-*` tokens, exposed as Tailwind colours (`bg-bzz-grau`,
  `text-bzz-muted`, `rounded-bzz` …). Radius 2 px everywhere, no shadows, surfaces instead
  of borders (except input fields).
- Page frame: white `SiteHeader` with the logo (`public/bzz-logo.svg`, fixed size), blue
  `bzz-kopf` on the main page, `SiteFooter` with «© Bildungszentrum Zürichsee, Horgen».
- Calendar colours are the `--cal-*` tokens in `src/index.css` (derived from BZZ colours):
  Unterricht green, Unterrichtsausfall orange, Teilausfall pink, Veranstaltung blue,
  Ferien violet, free days grey. Dialogs use `components/DialogShell.tsx`.

## Deployment

Production runs on **deplo.io (Nine)** at https://unterrichtsausfall.bzz.ch
(`unterrichtsausfaelle.bzz.ch` redirects there, see `next.config.ts`). deplo.io builds the
Dockerfile from `main` on every push — **deploy = commit + push to `main`**, nothing else.
Runtime secrets are set in the deplo.io Cockpit. The old it.bzz.ch setup no longer exists.

## Environment variables

```
WEBUNTIS_SCHOOL=
WEBUNTIS_USERNAME=
WEBUNTIS_PASSWORD=
WEBUNTIS_BASE_URL=
MCP_ADMIN_KEY=      # optional — bypasses the MCP rate limit via ?key=<uuid>
```
