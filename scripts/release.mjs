#!/usr/bin/env node
// Cut a release from the current changelog: validate, tag, push, GitHub release.
//
// Source of truth is src/lib/changelog.json — CHANGELOG[0] is the release being
// cut. The script never invents version content; it only refuses to proceed when
// the repo state and the changelog disagree, then mirrors changelog[0] into an
// annotated git tag and a matching `gh` release.
//
// Usage:
//   npm run release            cut the release for changelog[0]
//   npm run release -- --dry-run   print what would happen, change nothing

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');

const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

function fail(msg, hint) {
  console.error(`\n${C.red('✗')} ${msg}`);
  if (hint) console.error(`  ${C.dim(hint)}`);
  process.exit(1);
}

/** Run a command, returning trimmed stdout. Throws on non-zero exit. */
function run(cmd, args) {
  return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

/** Run a command, returning { ok, out } instead of throwing. */
function tryRun(cmd, args) {
  try {
    return { ok: true, out: run(cmd, args) };
  } catch (err) {
    return { ok: false, out: (err.stdout || '') + (err.stderr || '') };
  }
}

function readJson(relPath) {
  return JSON.parse(readFileSync(join(ROOT, relPath), 'utf8'));
}

// ── Load the release content ──────────────────────────────────────────────────

const changelog = readJson('src/lib/changelog.json');
if (!Array.isArray(changelog) || changelog.length === 0) {
  fail('src/lib/changelog.json is empty or not an array.');
}
const entry = changelog[0];
const { version, date, changes } = entry;
if (!version || !date || !Array.isArray(changes) || changes.length === 0) {
  fail('changelog[0] is missing version, date, or changes.');
}
const tag = `v${version}`;

// ── Guard rails ─────────────────────────────────────────────────────────────

const pkg = readJson('package.json');
if (pkg.version !== version) {
  fail(
    `package.json version (${pkg.version}) does not match changelog[0] (${version}).`,
    `Bump "version" in package.json to ${version}, then re-run.`,
  );
}

const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
if (branch !== 'main') {
  fail(`Not on main (on "${branch}"). Releases are cut from main.`);
}

const status = run('git', ['status', '--porcelain']);
if (status) {
  fail('Working tree is not clean.', 'Commit or stash your changes first.');
}

// Local main must be pushed, so the tag points at a commit that exists on origin.
run('git', ['fetch', '--quiet', 'origin', 'main']);
const local = run('git', ['rev-parse', 'HEAD']);
const remote = run('git', ['rev-parse', 'origin/main']);
if (local !== remote) {
  fail('Local main differs from origin/main.', 'Push (or pull) main first, then re-run.');
}

// Tag must not already exist locally or on origin.
if (tryRun('git', ['rev-parse', '--verify', `refs/tags/${tag}`]).ok) {
  fail(`Tag ${tag} already exists locally.`, `Delete it with: git tag -d ${tag}`);
}
if (tryRun('git', ['ls-remote', '--exit-code', '--tags', 'origin', tag]).ok) {
  fail(`Tag ${tag} already exists on origin.`);
}

const hasGh = tryRun('gh', ['--version']).ok;
if (!hasGh) {
  fail('GitHub CLI (gh) not found.', 'Install it or create the release manually after tagging.');
}
if (!tryRun('gh', ['auth', 'status']).ok) {
  fail('gh is not authenticated.', 'Run: gh auth login');
}

// ── Compose tag message / release notes from the changelog entry ──────────────

const bullets = changes.map((c) => `- ${c}`).join('\n');
const tagMessage = `Version ${version} (${date})\n\n${bullets}\n`;
const releaseNotes =
  `Veröffentlicht am ${formatDate(date)}.\n\n${bullets}\n\n` +
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`;

function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${C.bold(`Release ${tag}`)} ${C.dim(`(${date})`)}`);
console.log(`  commit  ${C.dim(local.slice(0, 9))}`);
console.log(`${bullets.replace(/^/gm, '  ')}`);

if (dryRun) {
  console.log(`\n${C.yellow('Dry run')} — no tag created, nothing pushed.`);
  process.exit(0);
}

// ── Execute ──────────────────────────────────────────────────────────────────

console.log(`\n${C.dim('→ creating annotated tag')}`);
run('git', ['tag', '-a', tag, '-m', tagMessage]);

console.log(C.dim('→ pushing tag to origin'));
try {
  run('git', ['push', 'origin', tag]);
} catch (err) {
  // Roll back the local tag so a re-run starts clean.
  tryRun('git', ['tag', '-d', tag]);
  fail(`Pushing the tag failed — rolled back local ${tag}.`, String(err.message || err));
}

console.log(C.dim('→ creating GitHub release'));
const release = tryRun('gh', ['release', 'create', tag, '--title', tag, '--notes', releaseNotes]);
if (!release.ok) {
  fail(
    `Tag ${tag} was pushed, but creating the GitHub release failed.`,
    `Finish manually: gh release create ${tag} --title ${tag} --notes "…"\n  ${release.out.trim()}`,
  );
}

console.log(`\n${C.green('✓')} Released ${C.bold(tag)}`);
console.log(`  ${release.out.trim()}`);
