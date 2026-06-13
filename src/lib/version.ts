/**
 * Single source of truth for the app version and its changelog.
 *
 * `CHANGELOG[0]` is always the current release — `APP_VERSION` is derived from
 * it, so bumping the version means prepending one entry here (newest first).
 * Keep `package.json`'s `version` in sync for tooling that reads it.
 */

export interface ChangelogEntry {
  version: string;
  /** Release date, ISO 'YYYY-MM-DD'. */
  date: string;
  /** User-facing change notes (German), one bullet per line. */
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.2.0',
    date: '2026-06-13',
    changes: [
      'Klick auf einen Tag öffnet neu ein Detailfenster mit Status, Grund und WebUntis-Link — die Infos sind damit auch auf dem Handy erreichbar.',
      'Die zuletzt gewählte Klasse wird gemerkt und beim nächsten Besuch automatisch angezeigt.',
      'Fehler beim Laden lassen sich direkt erneut versuchen; ein fehlgeschlagener Excel-Export wird jetzt gemeldet.',
      'Beim Klassenwechsel bleibt der bisherige Kalender sichtbar, statt kurz zu verschwinden.',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-06-12',
    changes: [
      'Gesamtübersicht „Alle Klassen“ mit Detailansicht pro Tag.',
      'MCP-Server (/api/mcp) für den Zugriff auf die Ausfalldaten.',
      'Auswahl von Schuljahr und Klasse bleibt über die URL teilbar.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-05-26',
    changes: [
      'Erste Version: Schuljahreskalender mit Unterrichtsausfällen, Ferien und Veranstaltungen pro Klasse.',
      'Excel-Export des Kalenders.',
    ],
  },
];

/** Current app version (e.g. "1.2.0"). */
export const APP_VERSION = CHANGELOG[0].version;
