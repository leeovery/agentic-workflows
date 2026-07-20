#!/usr/bin/env node
'use strict';

//
// migrate.cjs — the migration orchestrator.
//
// Keeps workflow files in sync with the current system design. Discovers every
// migration in scripts/migrations/ (both legacy `*.sh` and modern `*.cjs`),
// sorts them into one strict numeric-prefix ordering, and runs each exactly
// once — a project stuck at 020 catches up through the frozen bash fleet then
// the Node ones, in order.
//
// Tracking (identical to the retired migrate.sh):
//   - Progress lives in .workflows/.state/migrations, one numeric-only ID per
//     line (e.g. "001", "047"). The ID is the filename's leading digits,
//     extension-independent — .sh and .cjs share the same ID space.
//   - An ID recorded once is never re-run. Delete the log to force a full
//     re-run. An ID is recorded only AFTER its migration completes; any
//     failure aborts the whole run without recording (boot treats a non-zero
//     exit as fatal — migrations must never half-run silently).
//
// Migration contracts:
//   - `*.sh`: sourced in a spawned bash with report_update / report_skip helper
//     functions, PROJECT_DIR pinned to ".", cwd = project root — byte-for-byte
//     the contract migrate.sh gave them. `return 0` semantics preserved.
//   - `*.cjs`: `module.exports = { id, description, run({ projectDir,
//     reportUpdate, reportSkip }) }` — run in-process. Communicate only via the
//     report callbacks; never write to stdout. A throw aborts the run.
//
// The bash binary used for `*.sh` migrations is `bash` on PATH, overridable via
// WORKFLOWS_MIGRATE_BASH (a test seam for pinning stock /bin/bash 3.2).
//

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT_DIR = __dirname;
const MIGRATIONS_DIR = path.join(SCRIPT_DIR, 'migrations');

// migrate.sh printed this marker iff files were updated — the authoritative
// "changed" signal boot keys on. Kept byte-identical.
const STOP_GATE_MARKER = '---STOP_GATE: FILES_UPDATED---';

// Bash used to source `*.sh` migrations. Default `bash` (PATH); the override
// lets the orchestrator test pin stock /bin/bash 3.2 explicitly.
const BASH = process.env.WORKFLOWS_MIGRATE_BASH || 'bash';

// Wrapper that gives a sourced `*.sh` migration migrate.sh's exact contract:
// report_update/report_skip counters, PROJECT_DIR pinned to ".", the tracking
// file exported, and `set -eo pipefail` so a mid-migration failure aborts. The
// per-migration counts come back on fd 3 (kept off stdout so any migration
// output passes through untouched, exactly as sourcing did).
const SH_WRAPPER = [
  'set -eo pipefail',
  'FILES_UPDATED=0',
  'FILES_SKIPPED=0',
  'report_update() { FILES_UPDATED=$((FILES_UPDATED + 1)); }',
  'report_skip() { FILES_SKIPPED=$((FILES_SKIPPED + 1)); }',
  'export -f report_update report_skip',
  'export TRACKING_FILE="$MG_TRACKING"',
  'export FILES_UPDATED FILES_SKIPPED',
  'export PROJECT_DIR="."',
  'source "$MG_SCRIPT"',
  "printf '%s %s' \"$FILES_UPDATED\" \"$FILES_SKIPPED\" >&3",
].join('\n');

// === LEGACY TRACKING SUPPORT (ported verbatim from migrate.sh) ===
//
// Handles tracking-file discovery across historical locations and formats so a
// project part-way through the fleet (pre-migration-011, under docs/workflow/)
// resumes cleanly.

/** @param {string} cwd @returns {string} cwd-relative tracking path */
function findTrackingFile(cwd) {
  const candidates = [
    '.workflows/.state/migrations',
    'docs/workflow/.state/migrations',
    'docs/workflow/.cache/migrations',
    'docs/workflow/.cache/migrations.log',
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.resolve(cwd, candidate))) return candidate;
  }
  return '.workflows/.state/migrations';
}

/** Old "path: 001" rows → bare "001", sorted-unique. @param {string} cwd @param {string} rel */
function normalizeTrackingFormat(cwd, rel) {
  const full = path.resolve(cwd, rel);
  let content;
  try {
    content = fs.readFileSync(full, 'utf8');
  } catch (_) {
    return;
  }
  if (!/: [0-9]/.test(content)) return;
  const ids = [];
  for (const line of content.split('\n')) {
    const m = line.match(/[0-9]+$/); // grep -oE '[0-9]+$'
    if (m) ids.push(m[0]);
  }
  const uniq = Array.from(new Set(ids)).sort(); // sort -u (lexical)
  fs.writeFileSync(full, uniq.length ? uniq.join('\n') + '\n' : '');
}

/** Move a legacy .cache/ tracking file to .state/ so it survives migration 010.
 *  @param {string} cwd @param {string} rel @returns {string} possibly-updated rel */
function stabilizeTrackingLocation(cwd, rel) {
  const stable = 'docs/workflow/.state/migrations';
  if (rel.startsWith('docs/workflow/.cache/')) {
    const stableAbs = path.resolve(cwd, stable);
    fs.mkdirSync(path.dirname(stableAbs), { recursive: true });
    fs.renameSync(path.resolve(cwd, rel), stableAbs);
    return stable;
  }
  return rel;
}

// === END LEGACY TRACKING SUPPORT ===

/** Leading digits of a filename, or '' when none. @param {string} scriptPath */
function migrationId(scriptPath) {
  const m = path.basename(scriptPath).match(/^[0-9]+/);
  return m ? m[0] : '';
}

/** Numeric-prefix comparator, lexical tie-break — one strict ordering across
 *  both extensions. @param {string} a @param {string} b */
function compareMigrations(a, b) {
  const ida = migrationId(a);
  const idb = migrationId(b);
  const na = ida === '' ? NaN : parseInt(ida, 10);
  const nb = idb === '' ? NaN : parseInt(idb, 10);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
  const ba = path.basename(a);
  const bb = path.basename(b);
  return ba < bb ? -1 : ba > bb ? 1 : 0;
}

/** Whether `id` is already recorded in the tracking file (grep -q "^id$").
 *  @param {string} cwd @param {string} rel @param {string} id */
function isRecorded(cwd, rel, id) {
  let content;
  try {
    content = fs.readFileSync(path.resolve(cwd, rel), 'utf8');
  } catch (_) {
    return false;
  }
  return content.split('\n').some((line) => line === id);
}

/**
 * Run a `*.sh` migration by sourcing it in a spawned bash. Returns the counter
 * deltas; a non-zero exit surfaces the migration's stderr and aborts the run.
 * @param {string} cwd @param {string} scriptAbs @param {string} trackingRel
 * @returns {{updated: number, skipped: number, stdout: string}}
 */
function runShMigration(cwd, scriptAbs, trackingRel) {
  const res = spawnSync(BASH, ['-c', SH_WRAPPER], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, MG_SCRIPT: scriptAbs, MG_TRACKING: trackingRel, PROJECT_DIR: '.' },
    stdio: ['ignore', 'pipe', 'pipe', 'pipe'],
  });
  if (res.error || res.status !== 0) {
    const detail = res.error
      ? res.error.message
      : (res.stderr || res.stdout || `exit ${res.status}`).trim();
    fail(`migration ${path.basename(scriptAbs)} failed: ${detail}`, res.status || 1);
  }
  const counts = String(res.output[3] || '').trim().split(/\s+/);
  return {
    updated: parseInt(counts[0], 10) || 0,
    skipped: parseInt(counts[1], 10) || 0,
    stdout: res.stdout || '',
  };
}

/**
 * Run a `*.cjs` migration in-process against the contract. A throw propagates
 * to the top-level handler, aborting the run without recording.
 * @param {string} scriptAbs
 * @returns {{updated: number, skipped: number}}
 */
function runCjsMigration(scriptAbs) {
  const mod = require(scriptAbs);
  if (!mod || typeof mod.run !== 'function') {
    throw new Error(`migration ${path.basename(scriptAbs)} does not export a run() function`);
  }
  let updated = 0;
  let skipped = 0;
  mod.run({
    projectDir: '.',
    reportUpdate: () => { updated += 1; },
    reportSkip: () => { skipped += 1; },
  });
  return { updated, skipped };
}

/** Abort the run: emit detail on stderr, exit non-zero, record nothing.
 *  @param {string} message @param {number} [code] @returns {never} */
function fail(message, code) {
  process.stderr.write(message.endsWith('\n') ? message : message + '\n');
  process.exit(code || 1);
}

function main() {
  const cwd = process.cwd();

  // Resolve, normalise and stabilise the tracking file, then ensure it exists.
  let trackingRel = findTrackingFile(cwd);
  normalizeTrackingFormat(cwd, trackingRel);
  trackingRel = stabilizeTrackingLocation(cwd, trackingRel);
  const trackingAbs = () => path.resolve(cwd, trackingRel);
  fs.mkdirSync(path.dirname(trackingAbs()), { recursive: true });
  if (!fs.existsSync(trackingAbs())) fs.writeFileSync(trackingAbs(), '');

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    process.stdout.write(`No migrations directory found at ${MIGRATIONS_DIR}\n`);
    return;
  }

  let dirents;
  try {
    dirents = fs.readdirSync(MIGRATIONS_DIR, { withFileTypes: true });
  } catch (_) {
    dirents = [];
  }
  const scripts = dirents
    .filter((e) => e.isFile() && /\.(sh|cjs)$/.test(e.name))
    .map((e) => path.join(MIGRATIONS_DIR, e.name))
    .sort(compareMigrations);

  if (scripts.length === 0) {
    process.stdout.write('No migration scripts found.\n');
    return;
  }

  let filesUpdated = 0;
  let migrationsRun = 0;

  for (const script of scripts) {
    const id = migrationId(script);
    if (!id) {
      process.stdout.write(`Warning: Skipping ${script} (no numeric prefix)\n`);
      continue;
    }

    // Skip entire migration if already recorded.
    if (isRecorded(cwd, trackingRel, id)) continue;

    const result = script.endsWith('.cjs')
      ? runCjsMigration(script)
      : runShMigration(cwd, script, trackingRel);

    if (result.stdout) process.stdout.write(result.stdout);
    filesUpdated += result.updated;

    // Re-find the tracking file (migration 011 moves it), then record the ID.
    trackingRel = findTrackingFile(cwd);
    fs.mkdirSync(path.dirname(trackingAbs()), { recursive: true });
    fs.appendFileSync(trackingAbs(), id + '\n');
    migrationsRun += 1;
  }

  if (filesUpdated > 0) {
    process.stdout.write('\n');
    process.stdout.write(`${migrationsRun} migration(s) applied, ${filesUpdated} file(s) updated.\n`);
    process.stdout.write('\n');
    process.stdout.write(STOP_GATE_MARKER + '\n');
    process.stdout.write('You MUST now follow the migration skill instructions to STOP and let the user review.\n');
    process.stdout.write('Follow the explicit instructions in the migration skill before proceeding.\n');
  } else {
    process.stdout.write('[SKIP] No changes needed\n');
  }
}

try {
  main();
} catch (err) {
  fail(`migration run failed: ${err instanceof Error ? (err.stack || err.message) : String(err)}`, 1);
}
