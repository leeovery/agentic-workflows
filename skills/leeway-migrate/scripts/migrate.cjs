#!/usr/bin/env node
'use strict';

//
// migrate.cjs — the migration orchestrator.
//
// Keeps workflow files in sync with the current system design. Discovers every
// migration in scripts/migrations/ — legacy `*.sh`, modern `*.cjs`, and
// directives, `*.md` — sorts them into one strict numeric-prefix ordering,
// and runs each exactly once — a project stuck at 020 catches up through the
// frozen bash fleet then the Node ones, in order — stopping at a directive.
//
// Tracking:
//   - Progress lives in the migrations record the caller names (`--record
//     <path>`; boot names the state's `.state/migrations`), one numeric-only
//     ID per line (e.g. "001", "047"). The ID is the filename's leading
//     digits, extension-independent — .sh, .cjs and .md share the same ID
//     space.
//   - An ID recorded once is never re-run. Delete the log to force a full
//     re-run. An ID is recorded only AFTER its migration completes; any
//     failure aborts the whole run without recording (boot treats a non-zero
//     exit as fatal — migrations must never half-run silently).
//   - What the runs since the last that completed owe it is journaled in
//     the folder the caller names (`--journals <dir>`; boot names one in the
//     state's cache, which no state commit takes): each migration's
//     handbacks and the run's tally, kept as the migration records.
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
//   - `*.md`: a directive (21.10) — a migration whose transform is
//     judgment, a file of instructions the start session carries out, written
//     against the shape at its number and frozen once released like any
//     migration. It opens on its title, an H1, then its head: `## Touches`,
//     a list of the files it may touch, and `## Asks`, a list of what it asks
//     the person — "Nothing." an item of its own where it asks nothing — each
//     holding its list alone, an item wrapped onto lines indented beneath
//     it; its instructions follow, under headings of their own. Beside it
//     sits its check, `NNN-{slug}.check.cjs`: `module.exports = { counts,
//     done, check({ projectDir, stateDir }) }`. `counts` names one piece of
//     the directive's work and many, `{ one: 'topic', many: 'topics' }`, and
//     `done` says what a piece done has ('have their records'), as the stop's
//     screen counts them — "12 of Fumi's 19 topics have their records";
//     `check` answers an array of `{ name, problems }`, one for each piece,
//     `problems` a sentence for each thing the piece still lacks, none once
//     it is done. The check reads alone — the project's code tree
//     at `projectDir` and git's history of it, the state at `stateDir`, both
//     absolute — and is mechanical: it calls no model and changes nothing.
//     The directive's check passes when every piece's does. The engine runs
//     it (`engine migrate check NNN-{slug}`).
//
//     The runner stops at a directive the record does not hold: it prints
//     `---DIRECTIVE: NNN-{slug}---` and ends, the migrations before it
//     recorded and nothing after it run, printing neither the run's counts,
//     its handbacks nor its run report: each is journaled, for the run that
//     completes. The directive is recorded by `engine checklist close
//     directive NNN-{slug}`, which its passing check alone lets through; the
//     next run carries on past it. One start may meet several.
//
// The bash binary used for `*.sh` migrations is `bash` on PATH, overridable via
// LEEWAY_MIGRATE_BASH (a test seam for pinning stock /bin/bash 3.2).
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
// strips both. Each entry is journaled to its kind's pending file in the
// journals folder as its migration records, and emitted (then cleared) only by
// a fully successful run — a later migration aborting the run must never
// cost an earlier migration's entry, whose ID is already recorded and will
// never re-run.
const HANDBACKS = [
  { key: 'verify', marker: '---VERIFY_ADDENDA---', journal: 'pending-verify.json' },
  { key: 'notice', marker: '---MIGRATION_NOTICES---', journal: 'pending-notices.json' },
];

// Marker preceding the one-line JSON report of what the runs recorded,
// `{"ran": <migrations executed since the last run that completed>}`.
// Distinct from the stop gate, which counts files: a migration that ran and
// found nothing to do still recorded its ID, so the record is dirty on a run
// that updated nothing. Boot extracts and strips it.
const MIGRATIONS_RUN_MARKER = '---MIGRATIONS_RUN---';

// What the runs since the last that completed have done — the migrations
// executed and the files they updated — journaled as each
// migration records, as the handbacks are: a run that stops at a directive,
// or aborts, never costs its migrations their review and their commit, since
// the run that completes counts them all, and clears it.
const TALLY_JOURNAL = 'pending-tally.json';

const RECORD_FLAG = '--record';
const JOURNALS_FLAG = '--journals';
const USAGE = `usage: migrate.cjs ${RECORD_FLAG} <path> ${JOURNALS_FLAG} <dir> — the migrations record the run writes into, and the folder it journals in`;

// The fleet released while the state lived in the code tree upgrades the
// `.workflows/` there, and three of it (049, 053, 060) would create one from
// nothing. In a project with none there is nothing for it to upgrade, so
// each is recorded unrun.
const LAST_CODE_TREE_MIGRATION = 72;
const CODE_TREE_STATE = '.workflows';

// The reshape's sequence (074–081, 21.2) carries a project's state out of
// the code tree's `.workflows/`. A directive of it, in a project with none,
// has nothing to carry, so it is recorded unrun; the sequence's code steps
// see that for themselves. Renumbered with the sequence until it is released.
const LAST_CODE_TREE_DIRECTIVE = 81;

const DIRECTIVE = '.md';
const CHECK = '.check.cjs';

/** @param {string} journals @param {string} journal */
function journalPath(journals, journal) {
  return path.join(journals, journal);
}

/** Write a journal, its folder made where missing. @param {string} file @param {unknown} content */
function writeJournal(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(content) + '\n');
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

/** @param {string} file @returns {{ran: number, updated: number}} */
function readTally(file) {
  try {
    const { ran, updated } = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Number.isInteger(ran) && Number.isInteger(updated)) return { ran, updated };
  } catch { /* none journaled */ }
  return { ran: 0, updated: 0 };
}

// Bash used to source `*.sh` migrations. Default `bash` (PATH); the override
// lets the orchestrator test pin stock /bin/bash 3.2 explicitly.
const BASH = process.env.LEEWAY_MIGRATE_BASH || 'bash';

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
 * The path the caller names after `flag`, resolved from the cwd.
 * @param {string} cwd @param {string[]} args @param {string} flag
 * @returns {string}
 */
function pathOf(cwd, args, flag) {
  const at = args.indexOf(flag);
  const given = at === -1 ? undefined : args[at + 1];
  if (!given) fail(USAGE);
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

/** The IDs the record holds, one a line. @param {string} record @returns {Set<string>} */
function recordedIds(record) {
  return new Set(fs.readFileSync(record, 'utf8').split('\n'));
}

/** Whether a file in the migrations folder is a migration: a directive's check is its directive's. @param {string} name */
function isMigration(name) {
  return /\.(sh|cjs|md)$/.test(name) && !name.endsWith(CHECK);
}

/**
 * Run a `*.sh` migration by sourcing it in a spawned bash. Returns the counter
 * deltas; a non-zero exit surfaces the migration's stderr and aborts the run.
 * @param {string} cwd @param {string} scriptAbs @param {string} record
 * @returns {{updated: number, skipped: number, stdout: string}}
 */
function runShMigration(cwd, scriptAbs, record) {
  const res = spawnSync(BASH, ['-c', SH_WRAPPER], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, MG_SCRIPT: scriptAbs, MG_TRACKING: record, PROJECT_DIR: '.' },
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
  const args = process.argv.slice(2);
  const record = pathOf(cwd, args, RECORD_FLAG);
  const journals = pathOf(cwd, args, JOURNALS_FLAG);
  fs.mkdirSync(path.dirname(record), { recursive: true });
  if (!fs.existsSync(record)) fs.writeFileSync(record, '');
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
    .filter((e) => e.isFile() && isMigration(e.name))
    .map((e) => path.join(MIGRATIONS_DIR, e.name))
    .sort(compareMigrations);

  if (scripts.length === 0) {
    process.stdout.write('No migration scripts found.\n');
    return;
  }

  const tallyFile = journalPath(journals, TALLY_JOURNAL);
  const tally = readTally(tallyFile);
  const recorded = recordedIds(record);
  const noteRecorded = (/** @type {string} */ id) => {
    fs.appendFileSync(record, id + '\n');
    recorded.add(id);
  };

  for (const script of scripts) {
    const id = migrationId(script);
    if (!id) {
      process.stdout.write(`Warning: Skipping ${script} (no numeric prefix)\n`);
      continue;
    }

    // Skip entire migration if already recorded.
    if (recorded.has(id)) continue;
    const directive = script.endsWith(DIRECTIVE);
    if (!codeTreeState && parseInt(id, 10) <= (directive ? LAST_CODE_TREE_DIRECTIVE : LAST_CODE_TREE_MIGRATION)) {
      noteRecorded(id);
      continue;
    }
    if (directive) {
      process.stdout.write(`---DIRECTIVE: ${path.basename(script, DIRECTIVE)}---\n`);
      return;
    }

    const result = script.endsWith('.cjs')
      ? runCjsMigration(script)
      : runShMigration(cwd, script, record);

    if (result.stdout) process.stdout.write(result.stdout);

    noteRecorded(id);
    tally.ran += 1;
    tally.updated += result.updated;
    writeJournal(tallyFile, tally);

    // Journal what it handed back durably the moment its migration is
    // recorded — an abort further down the fleet must not lose it.
    if ('description' in result) {
      const entries = {
        verify: result.verify && { id, description: result.description, info: result.info, verify: result.verify },
        notice: result.notice && { id, description: result.description, notice: result.notice },
      };
      for (const { key, journal } of HANDBACKS) {
        if (!entries[key]) continue;
        const file = journalPath(journals, journal);
        writeJournal(file, [...readJournal(file), entries[key]]);
      }
    }
  }

  if (tally.updated > 0) {
    process.stdout.write('\n');
    process.stdout.write(`${tally.ran} migration(s) applied, ${tally.updated} file(s) updated.\n`);
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
    const file = journalPath(journals, journal);
    const entries = readJournal(file);
    if (entries.length === 0) continue;
    process.stdout.write(marker + '\n');
    process.stdout.write(JSON.stringify(entries) + '\n');
    try { fs.unlinkSync(file); } catch { /* already gone */ }
  }

  try { fs.unlinkSync(tallyFile); } catch { /* none journaled */ }
  process.stdout.write(MIGRATIONS_RUN_MARKER + '\n');
  process.stdout.write(JSON.stringify({ ran: tally.ran }) + '\n');
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    fail(`migration run failed: ${err instanceof Error ? (err.stack || err.message) : String(err)}`, 1);
  }
}

module.exports = { LAST_CODE_TREE_MIGRATION, LAST_CODE_TREE_DIRECTIVE };
