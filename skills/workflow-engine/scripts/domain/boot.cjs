'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the boot pipeline — the sequential entry checks Step 0 needs,
// collapsed into one call: run migrations, probe the knowledge base, and when
// it is ready run the bulk index — the store brought in line with the
// files — then compact it.
//
// Migrations are the durability-critical leg: a failing migrate.cjs is a hard
// error — migrations must never half-run silently. A run that recorded
// migrations without changing a document leaves the tracking ledger as the
// only dirt, and no reviewed commit follows a report of no changes, so boot
// commits that line itself — this run's, or one an earlier boot stranded. The
// knowledge base is a derived index: a failing `check` reports "not-ready"
// (the caller's gate — boot never initialises anything itself; a not-ready
// response additionally carries the system-config report so the gate can offer
// setup without extra probes). A failing bulk index or compact is a warning,
// never a block. Store dirt found when ready is committed (the post-setup
// first boot, the bulk index's or compact's writes, or leftovers).
// ---------------------------------------------------------------------------

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { git } = require('../kernel/git.cjs');
const { withProjectLock } = require('../kernel/manifest.cjs');
const { commitPathspecScoped, KB_DIR } = require('./commit.cjs');
const { knowledge: runKnowledge, spawnKnowledge } = require('./kb.cjs');
const { labelConfigStatus, repairSessionLabels, resolveEnabled, syncSessionHooks, SETTINGS_SPEC } = require('./session-label.cjs');
const { baselineState, baselineSignal } = require('./baseline.cjs');
const { walkthroughState } = require('./walkthrough.cjs');

/** The system config directory — `WORKFLOWS_CONFIG_DIR` overrides for tests. */
function configDir() {
  return process.env.WORKFLOWS_CONFIG_DIR || path.join(os.homedir(), '.config', 'workflows');
}

// Resolved against this file so it works wherever the skill tree is installed.
const MIGRATE_CJS = path.join(path.resolve(__dirname, '..', '..', '..'), 'workflow-migrate', 'scripts', 'migrate.cjs');

// The migration orchestrator prints this marker if and only if files were updated — it is the
// authoritative "changed" signal. (git status is no substitute: unrelated
// session work may already be dirty under .workflows.) The marker's follow-on
// instruction lines address a prose flow, not this caller, so the trimmed
// report drops everything from the marker down.
const STOP_GATE_MARKER = '---STOP_GATE: FILES_UPDATED---';

// Marker preceding migrate.cjs's one-line JSON array of verification
// addenda — natural-language check instructions from migrations executed
// this run, handed to the calling flow's judgment pass and stripped from
// the report text.
const VERIFY_MARKER = '---VERIFY_ADDENDA---';

// Marker preceding migrate.cjs's one-line JSON report of the run —
// `{ran, tracking}`: the migrations executed, and the tracking ledger they
// recorded into. Counting runs is not counting files — a migration that ran
// and found nothing to do still recorded its ID — so the stop gate cannot
// speak for the ledger. The path is what the commit needs, and it rides every
// completed run, a run that recorded nothing included: the runner resolves it
// itself (migration 011 moves it), and dirt from an earlier boot must be
// committable by a boot that ran no migrations at all.
const MIGRATIONS_RUN_MARKER = '---MIGRATIONS_RUN---';

/**
 * @typedef {object} SystemConfigReport
 * @property {'valid'|'absent'|'invalid'} status
 * @property {string|null} provider active provider name, or null (keyword-only / absent / invalid)
 * @property {string|null} model active model name, or null
 */

/**
 * @typedef {object} VerifyAddendum
 * @property {string} id
 * @property {string} description
 * @property {string|null} info   what the migration does — project-agnostic
 * @property {string} verify      what to check in this project
 */

/**
 * @typedef {object} BootResult
 * @property {{changed: boolean, ran: number, output: string, verify: VerifyAddendum[]}} migrations `changed` counts files, `ran` counts migrations executed — a migration can run and change nothing
 * @property {'ready'|'not-ready'} knowledge
 * @property {boolean} indexed the bulk `knowledge index` ran clean — no artifact left failing
 * @property {boolean} compacted
 * @property {string|null} kb_committed short sha of the knowledge-store commit, or null when the store was clean
 * @property {string|null} migrations_committed short sha of the tracking-ledger commit, or null when nothing was committed — set only where no reviewed migration commit follows, whatever boot left the ledger dirty
 * @property {string[]} warnings non-blocking failures (knowledge index, compaction, store commit, ledger commit, an unreadable report block)
 * @property {'no-tmux'|'on'|'off'|'prompt'} tmux_labels session-label opt-in state — `prompt` means in tmux and never asked, workflow-start's one-time prompt
 * @property {boolean} label_repaired a session label on this terminal — this session's own, arriving at the start menu, or a stranded one whose owner is gone — was put back to the original name
 * @property {boolean} session_hooks_installed this boot wrote the session hooks into `.claude/settings.json` — SessionEnd's `presence cleanup` for every project, `session cleanup` and SessionStart's `session resume` (matcher `resume`) while labels are on; false when the file already carried exactly those
 * @property {'none'|'native'|'in-progress'|'completed'|'skipped'} baseline project baseline status from the project manifest — `none` means nothing recorded yet (workflow-start's one-time judgment: native, or the offer)
 * @property {'none'|'walked'|'skipped'} walkthrough the answer to the walkthrough offer from the project manifest — `none` means nothing recorded yet, the state workflow-start's one-time offer keys on
 * @property {import('./baseline.cjs').BaselineSignal|null} [baseline_signal] present only while baseline is `none` — the repository facts the judgment is made from; null when there is no git history to read
 * @property {SystemConfigReport} [system_config] present only when knowledge is not-ready — lets the calling skill offer setup without extra probes
 */

/**
 * Detect the system config at ~/.config/workflows/config.json and report its
 * status plus the active provider/model. Reads config.json only — never
 * credentials.json — so no secret can enter the response. The shape check
 * mirrors the knowledge CLI's own detection: a parseable file with a
 * top-level `knowledge` object is valid (a providerless one means
 * keyword-only mode); a parseable file without the key is absent — the file
 * may carry other subsystems' keys, so its existence alone says nothing
 * about knowledge; anything else is invalid.
 * @returns {SystemConfigReport}
 */
function detectSystemConfig() {
  const p = path.join(configDir(), 'config.json');
  if (!fs.existsSync(p)) return { status: 'absent', provider: null, model: null };
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { status: 'invalid', provider: null, model: null };
    }
    if (parsed.knowledge === undefined) return { status: 'absent', provider: null, model: null };
    const k = parsed.knowledge;
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
 * Lift a marker's one-line JSON payload out of the orchestrator's report,
 * removing the two-line block from `lines` in place so the plumbing never
 * reaches the report text. Both an absent marker and an unreadable payload
 * answer undefined — the blocks are the runner's machine-readable asides and
 * the migrations they describe have already landed, so neither is fatal; the
 * unreadable one leaves a warning.
 * @param {string[]} lines @param {string} marker @param {string} label
 * @param {string[]} warnings
 * @returns {unknown}
 */
function liftMarker(lines, marker, label, warnings) {
  const idx = lines.findIndex((line) => line.trim() === marker);
  if (idx === -1) return undefined;
  const payload = lines[idx + 1] || '';
  lines.splice(idx, 2);
  try {
    return JSON.parse(payload);
  } catch (err) {
    warnings.push(`${label} unreadable: ${err instanceof Error ? err.message : String(err)}`);
    return undefined;
  }
}

/**
 * Whether a path is one this project may commit: relative, inside the tree,
 * no traversal.
 * @param {string} p
 * @returns {boolean}
 */
function isProjectRelative(p) {
  return p !== '' && p !== '.' && !path.isAbsolute(p) && !p.split('/').includes('..');
}

/**
 * The run report's two fields, read defensively: how many migrations ran, and
 * the ledger they recorded into. An absent block reads zero with no ledger —
 * a runner that predates the marker says nothing about what it recorded, and
 * silence is the safe reading. A malformed one degrades to a warning: `ran`
 * survives when it alone is sound, and an implausible path — one git must
 * never be handed as a pathspec — is dropped, which costs the commit, not the
 * boot.
 * @param {unknown} payload @param {string[]} warnings
 * @returns {{ran: number, tracking: string|null}}
 */
function readRunReport(payload, warnings) {
  if (payload === undefined) return { ran: 0, tracking: null };
  const report = payload && typeof payload === 'object'
    ? /** @type {{ran?: unknown, tracking?: unknown}} */ (payload)
    : {};
  const rawRan = report.ran;
  const ran = typeof rawRan === 'number' && Number.isInteger(rawRan) && rawRan >= 0 ? rawRan : null;
  const tracking = typeof report.tracking === 'string' && isProjectRelative(report.tracking) ? report.tracking : null;
  if (ran === null || tracking === null) {
    warnings.push(`migration run report unreadable: ${JSON.stringify(payload)}`);
    return { ran: ran === null ? 0 : ran, tracking: null };
  }
  return { ran, tracking };
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
  /** @type {string[]} */
  const warnings = [];

  const outLines = (mig.stdout || '').split('\n');
  const addenda = liftMarker(outLines, VERIFY_MARKER, 'verification addenda', warnings);
  if (addenda !== undefined && !Array.isArray(addenda)) warnings.push('verification addenda unreadable: not an array');
  const { ran, tracking } = readRunReport(liftMarker(outLines, MIGRATIONS_RUN_MARKER, 'migration run report', warnings), warnings);
  const stdout = outLines.join('\n');

  const migrations = {
    changed: stdout.includes(STOP_GATE_MARKER),
    ran,
    output: trimReport(stdout),
    verify: /** @type {VerifyAddendum[]} */ (Array.isArray(addenda) ? addenda : []),
  };

  // Migrations reach past .workflows: some edit .claude/settings.json
  // (permission/hook plumbing) and the repo-root .gitignore. The skill's
  // .workflows-scoped migration commit misses those, leaving them dirty after
  // boot for some later unrelated commit to sweep up. When migrations changed,
  // commit whichever of the two exist on disk, confined to them — a boot runs
  // beside live sessions and beside the user's own staged work, and neither
  // belongs in a migration commit. The migration files are already applied,
  // so a commit failure is a warning, never a block.
  if (migrations.changed) {
    try {
      const configSpecs = [SETTINGS_SPEC, '.gitignore']
        .filter((p) => fs.existsSync(path.join(cwd, p)));
      if (configSpecs.length > 0) {
        commitPathspecScoped(cwd, configSpecs, 'chore: apply workflow migration config changes');
      }
    } catch (err) {
      warnings.push(`migration config commit failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // A migration that ran while changing no document still wrote the ledger,
  // and that write has no other path to a commit: with nothing to review the
  // calling skill says "up to date" and never reaches its `commit
  // --workflows`. So boot leaves the ledger clean whenever no reviewed commit
  // will carry it — dirt this run recorded, and dirt an earlier boot left
  // behind the same way, which is the state every install that met this bug
  // is sitting in. When the review gate does fire, its own commit takes the
  // ledger in with the diff the user approved and boot stays out of the way.
  // The migrations are already applied, so a commit failure is a warning.
  /** @type {string|null} */
  let migrationsCommitted = null;
  if (!migrations.changed && tracking) {
    try {
      if (git(cwd, ['status', '--porcelain', '--', tracking]).trim() !== '') {
        migrationsCommitted = commitPathspecScoped(cwd, [tracking], 'chore: record workflow migrations');
      }
    } catch (err) {
      warnings.push(`migration ledger commit failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const check = spawnKnowledge(cwd, ['check']);
  const ready = !check.error && check.status === 0 && (check.stdout || '').trim() === 'ready';

  const knowledge = ready ? 'ready' : 'not-ready';

  let indexed = false;
  let compacted = false;
  if (ready) {
    indexed = runKnowledge(cwd, ['index'], 'knowledge index', warnings);
    compacted = runKnowledge(cwd, ['compact'], 'knowledge compact', warnings);
  }

  // Commit the knowledge-store dirt this boot found (a fresh store from the
  // user's `knowledge setup` run — the restart's first boot — the bulk
  // index's or compact's writes, or leftovers from an interrupted session).
  // The store is a derived index and boot must stay usable, so a commit
  // failure is a warning, never a block.
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
          : 'chore(knowledge): sync store';
        kbCommitted = commitPathspecScoped(cwd, KB_DIR, message);
      }
    } catch (err) {
      warnings.push(`knowledge store commit failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // The session hooks live in the project's settings, so every boot
  // re-syncs them: SessionEnd's `presence cleanup` for every project — a
  // /clear'd session's heartbeats otherwise read held until its process
  // exits — with `session cleanup` and SessionStart's `session resume`
  // while labels are on. A checkout that predates the hooks, or lost them
  // to a hand edit, gets them back here. The file is written either way,
  // and the commit failing is a warning, never a block.
  let sessionHooksInstalled = false;
  // The opt-in read and the sync share one hold: a `label-config` landing
  // between them would have this boot strip the hook it just installed.
  // The commit stays outside the lock.
  const sync = withProjectLock(cwd, () => syncSessionHooks(cwd, { session: resolveEnabled(cwd) === true, presence: true }));
  if (sync.error) {
    warnings.push(`session hooks not installed: ${sync.error}`);
  } else if (sync.changed) {
    sessionHooksInstalled = true;
    try {
      commitPathspecScoped(cwd, SETTINGS_SPEC, 'chore: install workflow session hooks');
    } catch (err) {
      warnings.push(`session hooks commit failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const baseline = baselineState(cwd).status;
  /** @type {BootResult} */
  const result = { migrations, knowledge: /** @type {BootResult['knowledge']} */ (knowledge), indexed, compacted, kb_committed: kbCommitted, migrations_committed: migrationsCommitted, warnings, tmux_labels: labelConfigStatus(cwd), label_repaired: repairSessionLabels(cwd).repaired, session_hooks_installed: sessionHooksInstalled, baseline, walkthrough: walkthroughState(cwd).status };
  // The signal travels only while nothing is recorded: the calling skill
  // judges once, then the verdict is on the manifest.
  if (baseline === 'none') result.baseline_signal = baselineSignal(cwd);
  // Not-ready responses carry the system-config report so the calling
  // skill's knowledge gate can branch (reuse the system config, offer a
  // mode choice, or fall back to the terminal wizard) without extra probes.
  if (!ready) result.system_config = detectSystemConfig();
  return result;
}

module.exports = { boot, detectSystemConfig };
