'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the boot pipeline — the sequential entry checks Step 0 needs,
// collapsed into one call: run migrations, probe the knowledge base, compact
// when ready.
//
// Migrations are the durability-critical leg: a failing migrate.sh is a hard
// error — migrations must never half-run silently. The knowledge base is a
// derived index: a failing `check` reports "not-ready" (the caller's gate —
// knowledge setup is a deliberate human choice, never self-served). A failing
// `compact` is a warning, never a block. Store dirt found when ready is
// committed (the post-setup first boot, compact churn, or leftovers).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { git, commitScoped } = require('../kernel/git.cjs');
const { KB_DIR } = require('./commit.cjs');
const { spawnKnowledge } = require('./kb.cjs');

// Resolved against this file so it works wherever the skill tree is installed.
const MIGRATE_SH = path.join(path.resolve(__dirname, '..', '..', '..'), 'workflow-migrate', 'scripts', 'migrate.sh');

// migrate.sh prints this marker if and only if files were updated — it is the
// authoritative "changed" signal. (git status is no substitute: unrelated
// session work may already be dirty under .workflows.) The marker's follow-on
// instruction lines address a prose flow, not this caller, so the trimmed
// report drops everything from the marker down.
const STOP_GATE_MARKER = '---STOP_GATE: FILES_UPDATED---';

/**
 * @typedef {object} BootResult
 * @property {{changed: boolean, output: string}} migrations
 * @property {'ready'|'not-ready'} knowledge
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
  const check = spawnKnowledge(cwd, ['check']);
  const ready = !check.error && check.status === 0 && (check.stdout || '').trim() === 'ready';

  const knowledge = ready ? 'ready' : 'not-ready';

  let compacted = false;
  if (ready) {
    const compact = spawnKnowledge(cwd, ['compact']);
    if (compact.error || compact.status !== 0) {
      const detail = compact.error
        ? compact.error.message
        : (compact.stderr || compact.stdout || `exit ${compact.status}`).trim();
      warnings.push(`knowledge compact failed: ${detail}`);
    } else {
      compacted = true;
    }
  }

  // Commit the knowledge-store dirt this boot found (a fresh store from the
  // user's `knowledge setup` run — the restart's first boot — compact churn,
  // or leftovers from an interrupted session). The store is a derived index
  // and boot must stay usable, so a commit failure is a warning, never a
  // block.
  /** @type {string|null} */
  let kbCommitted = null;
  if (ready) {
    try {
      const status = fs.existsSync(path.join(cwd, KB_DIR))
        ? git(cwd, ['status', '--porcelain', '--', KB_DIR])
        : '';
      if (status.trim() !== '') {
        // Untracked store files mean this is their first commit — the boot
        // right after `knowledge setup` created them.
        const message = status.split('\n').some((l) => l.startsWith('??'))
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
  return result;
}

module.exports = { boot };
