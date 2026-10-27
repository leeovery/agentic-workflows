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
// Tracking:
//   - Progress lives in the ledger the caller names (`--ledger <path>`; boot
//     names the state's `.state/migrations`), one numeric-only ID per line
//     (e.g. "001", "047"). The ID is the filename's leading digits,
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
//     Optional verification addendum: a module-level `info` string (what the
//     migration does, project-agnostic) and a `run()` return of
//     `{ verify: string }` (what to check in this project — returned on skip
//     paths too, where code may have silently missed what it couldn't
//     recognise). Optional notice: a `run()` return of `{ notice: string }` —
//     a sentence the person is told. Addenda and notices from migrations
//     executed this run are each emitted as one JSON line under their marker
//     (VERIFY_ADDENDA, MIGRATION_NOTICES) for boot to hand to the calling
//     flow. Never re-emitted for recorded migrations.
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

// What a migration hands back beside its counts, each kind under its own
// marker preceding a one-line JSON array — verification addenda for the
// calling flow's judgment pass, notices for the person. Boot extracts and
// strips both. Each entry is journaled to its kind's pending file beside the
// tracking log as its migration records, and emitted (then cleared) only by
// a fully successful run — a later migration aborting the run must never
// cost an earlier migration's entry, whose ID is already recorded and will
// never re-run.
const HANDBACKS = [
  { key: 'verify', marker: '---VERIFY_ADDENDA---', journal: 'pending-verify.json' },
  { key: 'notice', marker: '---MIGRATION_NOTICES---', journal: 'pending-notices.json' },
];

// Marker preceding the one-line JSON report of what the run recorded:
// `{"ran": <migrations executed>}`. Distinct from the stop gate, which counts
// files: a migration that ran and found nothing to do still recorded its ID,
// so the ledger is dirty on a run that updated nothing. Boot extracts and
// strips it.
const MIGRATIONS_RUN_MARKER = '---MIGRATIONS_RUN---';

const LEDGER_FLAG = '--ledger';

// The fleet released while the state lived in the code tree upgrades the
// `.workflows/` there, and three of it (049, 053, 060) would create one from
// nothing. In a project with none there is nothing for it to upgrade, so
// each is recorded unrun.
const LAST_CODE_TREE_MIGRATION = 72;
const CODE_TREE_STATE = '.workflows';

/** @param {string} ledger @param {string} journal */
function journalPath(ledger, journal) {
  return path.join(path.dirname(ledger), journal);
}

/** @param {string} file @returns {Record<string, string|null>[]} */
function readJournal(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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

/**
 * The ledger the caller names, resolved from the cwd.
 * @param {string} cwd @param {string[]} args
 * @returns {string}
 */
function ledgerOf(cwd, args) {
  const at = args.indexOf(LEDGER_FLAG);
  const given = at === -1 ? undefined : args[at + 1];
  if (!given) fail(`usage: migrate.cjs ${LEDGER_FLAG} <path> — the ledger the run records into`);
  return path.resolve(cwd, given);
}

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

/** Whether `id` is already recorded in the ledger (grep -q "^id$").
 *  @param {string} ledger @param {string} id */
function isRecorded(ledger, id) {
  let content;
  try {
    content = fs.readFileSync(ledger, 'utf8');
  } catch (_) {
    return false;
  }
  return content.split('\n').some((line) => line === id);
}

/**
 * Run a `*.sh` migration by sourcing it in a spawned bash. Returns the counter
 * deltas; a non-zero exit surfaces the migration's stderr and aborts the run.
 * @param {string} cwd @param {string} scriptAbs @param {string} ledger
 * @returns {{updated: number, skipped: number, stdout: string}}
 */
function runShMigration(cwd, scriptAbs, ledger) {
  const res = spawnSync(BASH, ['-c', SH_WRAPPER], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, MG_SCRIPT: scriptAbs, MG_TRACKING: ledger, PROJECT_DIR: '.' },
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

/** A handed-back string, trimmed, or null where there is none. @param {unknown} value */
function handedBack(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/**
 * Run a `*.cjs` migration in-process against the contract. A throw propagates
 * to the top-level handler, aborting the run without recording.
 * @param {string} scriptAbs
 * @returns {{updated: number, skipped: number, description: string, info: string|null, verify: string|null, notice: string|null}}
 */
function runCjsMigration(scriptAbs) {
  const mod = require(scriptAbs);
  if (!mod || typeof mod.run !== 'function') {
    throw new Error(`migration ${path.basename(scriptAbs)} does not export a run() function`);
  }
  let updated = 0;
  let skipped = 0;
  const ret = mod.run({
    projectDir: '.',
    reportUpdate: () => { updated += 1; },
    reportSkip: () => { skipped += 1; },
  });
  const handed = ret && typeof ret === 'object' ? ret : {};
  return {
    updated,
    skipped,
    description: mod.description || '',
    info: handedBack(mod.info),
    verify: handedBack(handed.verify),
    notice: handedBack(handed.notice),
  };
}

/** Abort the run: emit detail on stderr, exit non-zero, record nothing.
 *  @param {string} message @param {number} [code] @returns {never} */
function fail(message, code) {
  process.stderr.write(message.endsWith('\n') ? message : message + '\n');
  process.exit(code || 1);
}

function main() {
  const cwd = process.cwd();
  const ledger = ledgerOf(cwd, process.argv.slice(2));
  fs.mkdirSync(path.dirname(ledger), { recursive: true });
  if (!fs.existsSync(ledger)) fs.writeFileSync(ledger, '');
  const codeTreeState = fs.existsSync(path.join(cwd, CODE_TREE_STATE));

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
    if (isRecorded(ledger, id)) continue;
    if (!codeTreeState && parseInt(id, 10) <= LAST_CODE_TREE_MIGRATION) {
      fs.appendFileSync(ledger, id + '\n');
      continue;
    }

    const result = script.endsWith('.cjs')
      ? runCjsMigration(script)
      : runShMigration(cwd, script, ledger);

    if (result.stdout) process.stdout.write(result.stdout);
    filesUpdated += result.updated;

    fs.appendFileSync(ledger, id + '\n');
    migrationsRun += 1;

    // Journal what it handed back durably the moment its migration is
    // recorded — an abort further down the fleet must not lose it.
    if ('description' in result) {
      const entries = {
        verify: result.verify && { id, description: result.description, info: result.info, verify: result.verify },
        notice: result.notice && { id, description: result.description, notice: result.notice },
      };
      for (const { key, journal } of HANDBACKS) {
        if (!entries[key]) continue;
        const file = journalPath(ledger, journal);
        fs.writeFileSync(file, JSON.stringify([...readJournal(file), entries[key]]) + '\n');
      }
    }
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

  // A fully successful run emits everything journaled — this run's entries
  // plus any stranded by an earlier aborted run — and clears each journal.
  for (const { marker, journal } of HANDBACKS) {
    const file = journalPath(ledger, journal);
    const entries = readJournal(file);
    if (entries.length === 0) continue;
    process.stdout.write(marker + '\n');
    process.stdout.write(JSON.stringify(entries) + '\n');
    try { fs.unlinkSync(file); } catch { /* already gone */ }
  }

  process.stdout.write(MIGRATIONS_RUN_MARKER + '\n');
  process.stdout.write(JSON.stringify({ ran: migrationsRun }) + '\n');
}

try {
  main();
} catch (err) {
  fail(`migration run failed: ${err instanceof Error ? (err.stack || err.message) : String(err)}`, 1);
}
