import changelog from './changelog.json';

/**
 * Single source of truth for the app version and its changelog.
 *
 * The changelog data lives in `changelog.json` so the release tooling
 * (`scripts/release.mjs`) and the app read the exact same content. `CHANGELOG[0]`
 * is always the current release — `APP_VERSION` is derived from it, so cutting a
 * version means prepending one entry to that file (newest first) and bumping
 * `package.json`'s `version` to match (the release script enforces the latter).
 */

export interface ChangelogEntry {
  version: string;
  /** Release date, ISO 'YYYY-MM-DD'. */
  date: string;
  /** User-facing change notes (German), one bullet per line. */
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = changelog;

/** Current app version (e.g. "1.2.0"). */
export const APP_VERSION = CHANGELOG[0].version;
