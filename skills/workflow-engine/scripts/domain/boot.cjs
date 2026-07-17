'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the boot pipeline — the sequential entry checks Step 0 needs,
// collapsed into one call: run migrations, probe the knowledge base, compact
// when ready.
//
// Migrations are the durability-critical leg: a failing migrate.sh is a hard
// error — migrations must never half-run silently. The knowledge base is a
// derived index: a not-ready `check` triggers a non-interactive keyword-only
// init (`knowledge init --keyword-only` — no human input needed, so boot can
// self-serve instead of dead-ending the session at `knowledge setup`); only a
// failing init still reports "not-ready" (the caller's gate). A failing
// `compact` is a warning, never a block.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { git, commitScoped } = require('../kernel/git.cjs');
const { KB_DIR } = require('./commit.cjs');

// Resolved against this file so they work wherever the skill tree is installed.
const SKILLS_ROOT = path.resolve(__dirname, '..', '..', '..');
const MIGRATE_SH = path.join(SKILLS_ROOT, 'workflow-migrate', 'scripts', 'migrate.sh');
const KNOWLEDGE_CLI = path.join(SKILLS_ROOT, 'workflow-knowledge', 'scripts', 'knowledge.cjs');

// migrate.sh prints this marker if and only if files were updated — it is the
// authoritative "changed" signal. (git status is no substitute: unrelated
// session work may already be dirty under .workflows.) The marker's follow-on
// instruction lines address a prose flow, not this caller, so the trimmed
// report drops everything from the marker down.
const STOP_GATE_MARKER = '---STOP_GATE: FILES_UPDATED---';

/**
 * @typedef {object} BootResult
 * @property {{changed: boolean, output: string}} migrations
 * @property {'ready'|'initialised-keyword-only'|'not-ready'} knowledge
 * @property {string} [note] set with 'initialised-keyword-only' — the line the calling skill surfaces
 * @property {boolean} compacted
 * @property {string|null} kb_committed short sha of the knowledge-store commit, or null when the store was clean
 * @property {string[]} warnings non-blocking failures (knowledge init/compaction, store commit)
 */

/**
 * migrate.sh's report, trimmed for the JSON response: everything above the
 * stop-gate marker (update counts included), whitespace collapsed at the ends.
 * @param {string} stdout
 * @returns {string}
 */
function trimReport(stdout) {
  const lines = stdout.split('\n');
  const idx = lines.findIndex((line) => line.trim() === STOP_GATE_MARKER);
  return (idx === -1 ? lines : lines.slice(0, idx)).join('\n').trim();
}

/**
 * Run the boot pipeline against the project at `cwd`.
 * @param {string} cwd project root
 * @returns {BootResult}
 */
function boot(cwd) {
  const mig = spawnSync('bash', [MIGRATE_SH], { cwd, encoding: 'utf8' });
  if (mig.error || mig.status !== 0) {
    const detail = mig.error
      ? mig.error.message
      : `exit ${mig.status}: ${(mig.stderr || mig.stdout || '').trim()}`;
    throw new Error(`migrate.sh failed — migrations must never half-run silently (${detail})`);
  }
  const stdout = mig.stdout || '';
  const migrations = {
    changed: stdout.includes(STOP_GATE_MARKER),
    output: trimReport(stdout),
  };

  /** @type {string[]} */
  const warnings = [];
  const check = spawnSync('node', [KNOWLEDGE_CLI, 'check'], { cwd, encoding: 'utf8' });
  const ready = !check.error && check.status === 0 && (check.stdout || '').trim() === 'ready';

  // Not-ready is self-servable: keyword-only mode needs no human input, so
  // boot initialises the store and continues. Only a genuine init failure
  // (corrupt store, unwritable disk) still reports not-ready.
  let knowledge = ready ? 'ready' : 'not-ready';
  /** @type {string|undefined} */
  let note;
  if (!ready) {
    const init = spawnSync('node', [KNOWLEDGE_CLI, 'init', '--keyword-only'], { cwd, encoding: 'utf8' });
    if (init.error || init.status !== 0) {
      const detail = init.error
        ? init.error.message
        : (init.stderr || init.stdout || `exit ${init.status}`).trim();
      warnings.push(`knowledge init failed: ${detail}`);
    } else if ((init.stdout || '').trim() === 'already-initialised') {
      // check said not-ready but every file is present — the store (or its
      // config) is broken, and init has nothing to create. Not self-servable.
      warnings.push('knowledge store present but not loadable — run `knowledge rebuild`');
    } else {
      knowledge = 'initialised-keyword-only';
      note = 'knowledge base initialised keyword-only — run `knowledge setup` anytime to configure embeddings';
    }
  }

  let compacted = false;
  if (ready) {
    const compact = spawnSync('node', [KNOWLEDGE_CLI, 'compact'], { cwd, encoding: 'utf8' });
    if (compact.error || compact.status !== 0) {
      const detail = compact.error
        ? compact.error.message
        : (compact.stderr || compact.stdout || `exit ${compact.status}`).trim();
      warnings.push(`knowledge compact failed: ${detail}`);
    } else {
      compacted = true;
    }
  }

  // Commit the knowledge-store dirt this boot found or created (the init
  // above, the compact, or leftovers from an interrupted earlier session).
  // The store is a derived index and boot must stay usable, so a commit
  // failure is a warning, never a block. The failed-init path leaves any
  // half-created state uncommitted for the next boot to finish.
  /** @type {string|null} */
  let kbCommitted = null;
  if (knowledge !== 'not-ready') {
    try {
      const kbDirty =
        fs.existsSync(path.join(cwd, KB_DIR)) &&
        git(cwd, ['status', '--porcelain', '--', KB_DIR]).trim() !== '';
      if (kbDirty) {
        const message = knowledge === 'initialised-keyword-only'
          ? 'chore(knowledge): initialise store'
          : 'chore(knowledge): compact store';
        kbCommitted = commitScoped(cwd, KB_DIR, message);
      }
    } catch (err) {
      warnings.push(`knowledge store commit failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** @type {BootResult} */
  const result = { migrations, knowledge: /** @type {BootResult['knowledge']} */ (knowledge), compacted, kb_committed: kbCommitted, warnings };
  if (note !== undefined) result.note = note;
  return result;
}

module.exports = { boot };
