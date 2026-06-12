'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the boot pipeline — the sequential entry checks Step 0 needs,
// collapsed into one call: run migrations, probe the knowledge base, compact
// when ready.
//
// Migrations are the durability-critical leg: a failing migrate.sh is a hard
// error — migrations must never half-run silently. The knowledge base is a
// derived index: a failing `check` reports "not-ready" (the caller's gate),
// a failing `compact` is a warning, never a block.
// ---------------------------------------------------------------------------

const path = require('path');
const { spawnSync } = require('child_process');

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
 * @property {'ready'|'not-ready'} knowledge
 * @property {boolean} compacted
 * @property {string[]} warnings non-blocking failures (knowledge compaction)
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

  return { migrations, knowledge: ready ? 'ready' : 'not-ready', compacted, warnings };
}

module.exports = { boot };
