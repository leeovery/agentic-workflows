'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the boot pipeline — the sequential entry checks Step 0 needs,
// collapsed into one call: run migrations, probe the knowledge base, compact
// when ready.
//
// Migrations are the durability-critical leg: a failing migrate.cjs is a hard
// error — migrations must never half-run silently. The knowledge base is a
// derived index: a failing `check` reports "not-ready" (the caller's gate —
// boot never initialises anything itself; a not-ready response additionally
// carries the system-config report so the gate can offer setup without extra
// probes). A failing `compact` is a warning, never a block. Store dirt found
// when ready is committed (the post-setup first boot, compact churn, or
// leftovers).
// ---------------------------------------------------------------------------

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { git, commitScoped } = require('../kernel/git.cjs');
const { KB_DIR } = require('./commit.cjs');
const { spawnKnowledge } = require('./kb.cjs');

// Resolved against this file so it works wherever the skill tree is installed.
const MIGRATE_CJS = path.join(path.resolve(__dirname, '..', '..', '..'), 'workflow-migrate', 'scripts', 'migrate.cjs');

// The migration orchestrator prints this marker if and only if files were updated — it is the
// authoritative "changed" signal. (git status is no substitute: unrelated
// session work may already be dirty under .workflows.) The marker's follow-on
// instruction lines address a prose flow, not this caller, so the trimmed
// report drops everything from the marker down.
const STOP_GATE_MARKER = '---STOP_GATE: FILES_UPDATED---';

/**
 * @typedef {object} SystemConfigReport
 * @property {'valid'|'absent'|'invalid'} status
 * @property {string|null} provider active provider name, or null (keyword-only / absent / invalid)
 * @property {string|null} model active model name, or null
 */

/**
 * @typedef {object} BootResult
 * @property {{changed: boolean, output: string}} migrations
 * @property {'ready'|'not-ready'} knowledge
 * @property {boolean} compacted
 * @property {string|null} kb_committed short sha of the knowledge-store commit, or null when the store was clean
 * @property {string[]} warnings non-blocking failures (knowledge init/compaction, store commit)
 * @property {SystemConfigReport} [system_config] present only when knowledge is not-ready — lets the calling skill offer setup without extra probes
 */

/**
 * Detect the system config at ~/.config/workflows/config.json and report its
 * status plus the active provider/model. Reads config.json only — never
 * credentials.json — so no secret can enter the response. The shape check
 * mirrors the knowledge CLI's own detection: a parseable file with a
 * top-level `knowledge` object is valid (a providerless one means
 * keyword-only mode); anything else is invalid.
 * @returns {SystemConfigReport}
 */
function detectSystemConfig() {
  const p = path.join(os.homedir(), '.config', 'workflows', 'config.json');
  if (!fs.existsSync(p)) return { status: 'absent', provider: null, model: null };
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    const k = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed.knowledge : null;
    if (!k || typeof k !== 'object' || Array.isArray(k)) {
      return { status: 'invalid', provider: null, model: null };
    }
    return {
      status: 'valid',
      provider: typeof k.provider === 'string' && k.provider !== '' ? k.provider : null,
      model: typeof k.model === 'string' && k.model !== '' ? k.model : null,
    };
  } catch (_) {
    return { status: 'invalid', provider: null, model: null };
  }
}

/**
 * The orchestrator's report, trimmed for the JSON response: everything above
 * the stop-gate marker (update counts included), whitespace collapsed at the ends.
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
  const mig = spawnSync('node', [MIGRATE_CJS], { cwd, encoding: 'utf8' });
  if (mig.error || mig.status !== 0) {
    const detail = mig.error
      ? mig.error.message
      : `exit ${mig.status}: ${(mig.stderr || mig.stdout || '').trim()}`;
    throw new Error(`migrate.cjs failed — migrations must never half-run silently (${detail})`);
  }
  const stdout = mig.stdout || '';
  const migrations = {
    changed: stdout.includes(STOP_GATE_MARKER),
    output: trimReport(stdout),
  };

  /** @type {string[]} */
  const warnings = [];

  // Migrations reach past .workflows: some edit .claude/settings.json
  // (permission/hook plumbing) and the repo-root .gitignore. The skill's
  // .workflows-scoped migration commit misses those, leaving them dirty after
  // boot for some later unrelated commit to sweep up. When migrations changed,
  // commit whichever of the two exist on disk — existence-guarded, since a
  // `git add` on a nonexistent path errors (the same lesson commit.cjs's
  // KB_DIR guard encodes) and an all-clean stage simply commits nothing. The
  // migration files are already applied, so a commit failure is a warning,
  // never a block.
  if (migrations.changed) {
    try {
      const configSpecs = ['.claude/settings.json', '.gitignore']
        .filter((p) => fs.existsSync(path.join(cwd, p)));
      if (configSpecs.length > 0) {
        commitScoped(cwd, configSpecs, 'chore: apply workflow migration config changes');
      }
    } catch (err) {
      warnings.push(`migration config commit failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

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
  // Not-ready responses carry the system-config report so the calling
  // skill's knowledge gate can branch (reuse the system config, offer a
  // mode choice, or fall back to the terminal wizard) without extra probes.
  if (!ready) result.system_config = detectSystemConfig();
  return result;
}

module.exports = { boot, detectSystemConfig };
