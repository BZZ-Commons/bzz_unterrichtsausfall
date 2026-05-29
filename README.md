# untis_schulausfälle

Schuljahreskalender für das BZZ (Bildungszentrum Zürichsee), der pro Klasse aus
WebUntis lädt und farbig anzeigt, an welchen Tagen Unterricht stattfindet,
welche Tage **Schulausfall** sind, sowie Ferien und Wochenenden.

Companion-Projekt zu [bzz_dispensationsgesuche](https://github.com/BZZ-Commons/bzz_dispensationsgesuche).

## Was die App macht

- Liest aus WebUntis: Klassen, Stundenplan eines Schuljahres, Ferien
- Erkennt anhand der ersten 4 Schulwochen, welche Wochentage für die Klasse Schultage sind
- Klassifiziert jeden Tag in eine von fünf Kategorien:
  - **Normaler Schultag** (Grün) — Lektionen finden statt
  - **Schulausfall** (Orange) — Schultag, aber keine effektiven Lektionen
    (alle abgesagt, Feiertag, oder schlicht nichts geplant)
  - **Ferien** (Violett) — Schulferien
  - **Kein Schultag** (Grau) — Wochenende oder ein Wochentag, an dem die Klasse nie Unterricht hat
- Tooltip zeigt Anzahl effektiv stattfindender Lektionen und ggf. abgesagte separat
- Jede Zelle ist verlinkt zum entsprechenden WebUntis-Wochenstundenplan

## Klassenverbünde

Klassen die ihren Stundenplan teilen, werden zusammen ausgewertet:

- **ME** ↔ AB oder BM (je nach Suffix)
- **AB** ↔ ME oder IA
- **BM** ↔ IA oder ME
- **IA** ist ein Sonderfall:
  - Im Dropdown nur die reinen IA-Klassen
  - Bei Auswahl erscheint ein Dialog: **Mit BM** oder **Mit ABU** wählen
  - Ausnahme: Existiert eine `IA xx c`, gilt automatisch `a→BMa`, `b→BMb`, `c→ABc`

Die Regeln sind als deklarative `COMPANION_RULES` in
[src/lib/classGroups.ts](src/lib/classGroups.ts) definiert — Änderungen an den
Pairings brauchen keine Logik-Anpassung.

## Stack

- **Framework**: Next.js 15 (App Router) + React 19
- **UI**: Tailwind CSS v4 + lucide-react
- **WebUntis**: `webuntis` npm-Package (Login/Logout pro Request via `withUntisClient()`)
- **Tests**: Vitest + jsdom

## Commands

```bash
npm install
npm run dev          # Dev server (http://localhost:3000)
npm run build        # Production build
npm run start        # Production server
npm run lint         # TypeScript type-check
npm run test         # Vitest run
npm run test:watch   # Watch mode
```

## Environment

`.env` (lokal, nicht im Repo):

```
WEBUNTIS_SCHOOL=BZZ
WEBUNTIS_USERNAME=…
WEBUNTIS_PASSWORD=…
WEBUNTIS_BASE_URL=bzz.webuntis.com
```

## Architektur

```
app/
  layout.tsx              Root layout
  page.tsx                Entry — Schuljahr-/Klassen-Dropdown + Kalender
  api/
    schoolyears/route.ts  GET → alle WebUntis-Schuljahre
    classes/route.ts      GET ?schoolyearId=… → aktive Klassen + companion fetchIds
    calendar-data/route.ts GET ?classIds=…&schoolyearId=… → klassifizierte Tage
components/               Klassen-/Schuljahr-Selector, Kalender, Legende, IA-Variant-Dialog
src/
  types.ts                Geteilte TypeScript-Interfaces
  lib/
    calendar.ts           classifyDays() + Helpers (pur, getestet)
    classGroups.ts        Companion-Rules + IA-Variant-Auflösung
    webuntis.ts           withUntisClient() Wrapper, resolveSchoolyear()
tests/                    Vitest Unit-Tests
```

## Deployment

Docker (multi-stage Build → `node:20-alpine`-Runner, non-root `nextjs`-User,
Next.js `output: 'standalone'`):

```bash
docker compose up -d --build
```

Produktiv unter [schulausfall.it.bzz.ch](https://schulausfall.it.bzz.ch) — Apache
reverse-proxy auf Container-Port 3002.
