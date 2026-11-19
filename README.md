# untis_schulausfälle

Schuljahreskalender für das BZZ (Bildungszentrum Zürichsee), der pro Klasse aus
WebUntis lädt und farbig anzeigt, an welchen Tagen Unterricht stattfindet,
welche Tage **Schulausfall** sind, sowie Ferien und Wochenenden.

Companion-Projekt zu [bzz_dispensationsgesuche](https://github.com/BZZ-Commons/bzz_dispensationsgesuche).

## Was die App macht

- Liest aus WebUntis: Klassen, Stundenplan eines Schuljahres, Ferien
- Erkennt anhand der ersten 4 Schulwochen, welche Wochentage für die Klasse Schultage sind
- Klassifiziert jeden Tag in eine von sechs Kategorien:
  - **Normaler Schultag** (Grün) — Lektionen finden statt
  - **Einzelne Lektionen abgesagt** (Pink) — nur im Detailmodus `?details=true`
  - **Schulausfall** (Orange) — Schultag, aber keine effektiven Lektionen
    (alle abgesagt, Feiertag, oder schlicht nichts geplant)
  - **Veranstaltung** (Türkis) — Schulanlass ohne «Unterrichtsausfall»-Präfix
  - **Ferien** (Violett) — Schulferien
  - **Kein Schultag** (Grau) — Wochenende oder ein Wochentag, an dem die Klasse nie Unterricht hat
- Tooltip zeigt Anzahl effektiv stattfindender Lektionen und ggf. abgesagte separat
- Jede Zelle ist verlinkt zum entsprechenden WebUntis-Wochenstundenplan
- **Alle-Klassen-Ansicht** — zeigt alle Klassen gleichzeitig; orangefarbene Tage
  können angeklickt werden, um eine Detailliste der betroffenen Klassen zu öffnen
- **Excel-Export** — Einzelklassen-Kalender als `.xlsx` herunterladen

## URL-Parameter

Alle Parameter sind kombinierbar und bleiben beim Wechsel von Klasse oder
Schuljahr erhalten.

| Parameter    | Beispiel              | Bedeutung                                                                            |
| ------------ | --------------------- | ------------------------------------------------------------------------------------ |
| `schoolyear` | `?schoolyear=25`      | Öffnet das Schuljahr, dessen Name mit `25` beginnt                                   |
| `class`      | `?class=IN23a`        | Wählt diese Klasse direkt aus                                                        |
| `companion`  | `?companion=IN23a-BM` | Löst IA-Varianten ohne Dialog auf                                                    |
| `view`       | `?view=all`           | Öffnet direkt die Alle-Klassen-Ansicht                                               |
| `details`    | `?details=true`       | Aktiviert den Detailmodus: Normal-Tage mit teilweisem Ausfall werden rosa eingefärbt |

Der `details`-Parameter ist **sitzungspersistent**: Er wird bei jedem URL-Update
automatisch mitgeschrieben und bleibt beim Wechsel von Klasse oder Schuljahr
erhalten.

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

- **Framework**: Next.js 16 (App Router) + React 19, Node.js 26 LTS
- **UI**: [BZZ Design System](https://bzz.eifach.online/design/) (Kopie in `src/styles/bzz-design.css`) + Tailwind CSS v4 + lucide-react, Schrift Inter lokal via `@fontsource-variable/inter`
- **WebUntis**: `webuntis` npm-Package (Login/Logout pro Request via `withUntisClient()`)
- **Excel**: `xlsx` (SheetJS 0.20.x vom SheetJS-CDN — das npm-Paket ist veraltet)
- **MCP**: `mcp-handler` 2 + `@modelcontextprotocol/server` 2 (stateless Streamable HTTP)
- **Tests**: Vitest + jsdom

## Commands

```bash
npm install
npm run dev          # Dev server (http://localhost:3000)
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint
npm run typecheck    # TypeScript type-check
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
  layout.tsx                  Root layout
  page.tsx                    Entry — Schuljahr-/Klassen-Dropdown + Kalender
  api/
    schoolyears/route.ts      GET → alle WebUntis-Schuljahre
    classes/route.ts          GET ?schoolyearId=… → aktive Klassen + companion fetchIds
    calendar-data/route.ts    GET ?classIds=…&schoolyearId=… → klassifizierte Tage (Einzelklasse)
    calendar-data-all/route.ts GET ?schoolyearId=… → aggregierte Tage aller Klassen
components/
  SchoolYearCalendar.tsx      Einzelklassen-Kalender; ?details=true → Rosa-Einfärbung
  AggregatedCalendar.tsx      Alle-Klassen-Übersicht
  DayDetailsDialog.tsx        Popup mit betroffenen Klassen (Alle-Klassen-Ansicht)
  CalendarLegend.tsx          Farblegende (passt sich an detailsMode an)
  ClassSelector.tsx           Klassen-Dropdown
  SchoolYearSelector.tsx      Schuljahr-Dropdown
  ViewToggle.tsx              Einzelklasse / Alle Klassen umschalten
  IAVariantDialog.tsx         BM / ABU Dialog für IA-Klassen
  ExportButton.tsx            Excel-Download-Button
  DialogShell.tsx             Gemeinsamer Dialog-Rahmen (BZZ-Look, Escape/Backdrop schliesst)
  SiteHeader.tsx              Weisse BZZ-Kopfzeile mit Logo
  CalendarGridParts.tsx       Wochentag-Kopf, Monatstitel u. Ä. für beide Kalender
src/
  types.ts                    Geteilte TypeScript-Interfaces
  lib/
    calendar.ts               classifyDays() + Helpers (pur, getestet)
    classGroups.ts            Companion-Rules + IA-Variant-Auflösung
    webuntis.ts               withUntisClient() Wrapper, resolveSchoolyear()
    calendar-styles.ts        Tailwind-Klassen pro DayType (Farben: --cal-* in src/index.css)
    calendar-layout.ts        buildMonthGroups() — Wochen/Monate für die Kalenderdarstellung
    exportExcel.ts            exportCalendarToExcel() — erzeugt .xlsx mit SheetJS
tests/                        Vitest Unit-Tests
```

## Excel-Export

Der Button erscheint im Einzelklassen-Kalender (oben rechts). Er exportiert alle
Schultage (ohne Wochenenden, `no-lessons` und `out-of-year`) mit folgenden Spalten:

| Spalte      | Inhalt                                                                       |
| ----------- | ---------------------------------------------------------------------------- |
| Datum       | `dd.MM.yyyy`                                                                 |
| Wochentag   | `Mo`–`Fr`                                                                    |
| Typ         | `Normal`, `Unterrichtsausfall`, `Ferien`, `Veranstaltung`, `Kein Unterricht` |
| Bezeichnung | Ferienname oder Veranstaltungsname                                           |
| Lektionen   | Effektiv stattfindende Lektionen                                             |
| Abgesagt    | Abgesagte Lektionen                                                          |

Dateiname: `Unterrichtsausfaelle_<Klasse>_<Schuljahr>.xlsx`

## Detailmodus (`?details=true`)

Wenn der Parameter `?details=true` in der URL vorhanden ist, werden normale
Schultage mit mindestens einer abgesagten Lektion **rosa** (`bg-cal-teilausfall`)
statt grün dargestellt. Die Legende wird entsprechend erweitert. Der Parameter
bleibt beim Wechsel von Klasse und Schuljahr erhalten.

## Deployment

Produktiv auf **deplo.io (Nine)** unter
[unterrichtsausfall.bzz.ch](https://unterrichtsausfall.bzz.ch)
(`unterrichtsausfaelle.bzz.ch` leitet dorthin um). Beide Hostnamen zeigen per CNAME
auf `unterrichtsausfall.2368aef.deploio.app`; TLS verwaltet deplo.io.

- **Deploy = Push auf `main`.** deplo.io baut das Image aus dem
  [Dockerfile](Dockerfile) (Multi-Stage, `node:26-alpine`, non-root `nextjs`-User,
  Next.js `output: 'standalone'`) und rollt es aus. Kein manueller Schritt.
- Container lauscht auf Port **3000**.
- Die `WEBUNTIS_*`-Variablen und optional `MCP_ADMIN_KEY` sind im deplo.io-Cockpit als
  Laufzeit-Variablen gesetzt. Der Entrypoint bricht ab, wenn eine `WEBUNTIS_*`-Variable
  fehlt.
- MCP-Endpoint: `https://unterrichtsausfall.bzz.ch/api/mcp` (optional `?key=<MCP_ADMIN_KEY>`).

Lokal lässt sich dasselbe Image mit Docker Compose starten (liest `.env`, Port
`127.0.0.1:3002`):

```bash
docker compose up -d --build
```
