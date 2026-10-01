'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the boot pipeline — the sequential entry checks Step 0 needs,
// collapsed into one call: run migrations, probe the knowledge base, and when
// it is ready bring the store's keyword side in line with the files, compact
// it, and hand the vectors it awaits to the background fill — a start never
// waits on embedding.
//
// Migrations are the durability-critical leg: a failing migrate.cjs is a hard
// error — migrations must never half-run silently. A run that recorded
// migrations without changing a document leaves the tracking ledger as the
// only dirt, and no reviewed commit follows a report of no changes, so boot
// commits that line itself — this run's, or one an earlier boot stranded.
//
// The knowledge directory — the store, its metadata, the knowledge config,
// beside them the store's lock and the fill's claim — is local to each
// checkout and git-ignored: boot keeps the first three listed in
// `.worktreeinclude` so a worktree Claude Code creates starts with a copy.
// A checkout set up (its local config) with no store gets one built when this
// machine's config says how — it reads `buildable`. Anything else not-ready
// is the caller's gate: boot never sets a checkout up itself, and a not-ready
// response carries the system-config report so the gate can offer setup
// without extra probes. A knowledge config setting the load ignores, a
// failing index or compact, a provider key that does not resolve, and a
// vector fill that fell short are warnings, never blocks.
//
// Boot is also where the conversation folders are tidied, whichever project
// the conversations ran in: one goes once its transcript is gone.
// ---------------------------------------------------------------------------

const path = require('path');
const { spawnSync } = require('child_process');
const { git } = require('../kernel/git.cjs');
const { withProjectLock } = require('../kernel/manifest.cjs');
const { systemConfigPath } = require('../kernel/knowledge/config.cjs');
const { commitPathspecScoped } = require('./commit.cjs');
const { bootKnowledge } = require('./knowledge/sync.cjs');
const { detectSystemConfig: detectKnowledgeSettings } = require('./knowledge/setup.cjs');
const { labelConfigStatus, repairSessionLabels, resolveEnabled, syncSessionHooks } = require('./session-label.cjs');
const { syncGateSurface } = require('./gate-surface.cjs');
const { tidyConversations } = require('./conversation.cjs');
const { SETTINGS_SPEC } = require('./settings.cjs');
const { syncWorktreeInclude, WORKTREE_INCLUDE } = require('./worktree-include.cjs');
const { baselineState, baselineSignal } = require('./baseline.cjs');
const { walkthroughState } = require('./walkthrough.cjs');

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
 * @property {boolean} indexed the store's keyword side came in line with the files — no artifact left failing
 * @property {boolean} compacted
 * @property {string|null} migrations_committed short sha of the tracking-ledger commit, or null when nothing was committed — set only where no reviewed migration commit follows, whatever boot left the ledger dirty
 * @property {string[]} warnings non-blocking failures (a knowledge config setting the load ignores, knowledge index, compaction, a provider key that does not resolve, a vector fill that fell short, ledger commit, the session hooks, the worktree include, the user's Claude Code settings, an unreadable report block)
 * @property {'no-tmux'|'on'|'off'|'prompt'} tmux_labels session-label opt-in state — `prompt` means in tmux and never asked, workflow-start's one-time prompt
 * @property {boolean} label_repaired a session label on this terminal — this session's own, arriving at the start menu, or a stranded one whose owner is gone — was put back to the original name
 * @property {boolean} session_hooks_installed this boot wrote the session hooks into `.claude/settings.json` — SessionEnd's `presence cleanup` and `conversation end` for every project, `session cleanup` and SessionStart's `session resume` (matcher `resume`) while labels are on; false when the file already carried exactly those
 * @property {boolean} worktree_include_installed this boot changed `.worktreeinclude` — a knowledge file appended; false when it left the file as it was
 * @property {import('./gate-surface.cjs').GateSurface} gate_surface the gate mod — `unavailable` where it cannot run here (Claude Code on the web, another entrypoint than the terminal app, the mod not installed, a version that does not read) and `outdated` at a release before 2.1.282, both touching no file; where it can: `on` where it is running, its announcement in boot's own environment; otherwise `restart` where this boot wrote the function-hooks flag into the user's Claude Code settings, `not-running` where the flag was already there, `settings-unreadable` where that file could not be read or written — workflow-start stops on all four
 * @property {string} [claude_settings] the user's Claude Code settings file the gate sync read — present wherever it ran, absent with `unavailable` and `outdated`
 * @property {'none'|'native'|'in-progress'|'completed'|'skipped'} baseline project baseline status from the project manifest — `none` means nothing recorded yet (workflow-start's one-time judgment: native, or the offer)
 * @property {'none'|'walked'|'skipped'} walkthrough the answer to the walkthrough offer from the project manifest — `none` means nothing recorded yet, the state workflow-start's one-time offer keys on
 * @property {import('./baseline.cjs').BaselineSignal|null} [baseline_signal] present only while baseline is `none` — the repository facts the judgment is made from; null when there is no git history to read
 * @property {SystemConfigReport} [system_config] present only when knowledge is not-ready — lets the calling skill offer setup without extra probes
 */

/**
 * The system config's status, and the provider and model it makes active.
 * Reads config.json alone — never credentials.json — so no secret can enter
 * the response. A file whose `knowledge` settings do not read is invalid; a
 * file without them is absent — it may carry other subsystems' keys — and a
 * valid one naming no provider is keyword-only.
 * @returns {SystemConfigReport}
 */
function detectSystemConfig() {
  const detected = detectKnowledgeSettings(systemConfigPath());
  if (!detected.exists) return { status: 'absent', provider: null, model: null };
  if (!detected.valid || !detected.knowledge) return { status: 'invalid', provider: null, model: null };
  const { provider, model } = detected.knowledge;
  return {
    status: 'valid',
    provider: typeof provider === 'string' && provider !== '' ? provider : null,
    model: typeof model === 'string' && model !== '' ? model : null,
  };
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

  // A migration that ran while changing no document still wrote the ledger,
  // and that write has no other path to a commit: with nothing to review the
  // calling skill says "up to date" and never reaches its `commit
  // --migrations`. So boot leaves the ledger clean whenever no reviewed commit
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

  const { knowledge, indexed, compacted } = bootKnowledge(cwd, warnings);

  // While a reviewed migration commit follows, it takes every path the
  // workflows own, so boot's own writes there ride it as the ledger does —
  // a confined commit of a file a migration also edited would carry that
  // edit past the review under boot's message.
  const commitOwn = !migrations.changed;
  const sessionHooksInstalled = installSessionHooks(cwd, commitOwn, warnings);
  const worktreeIncludeInstalled = installWorktreeInclude(cwd, commitOwn, warnings);
  const gate = syncGateSurface(cwd);
  if (gate.error) warnings.push(`gate surface not synced: ${gate.error}`);
  tidyConversations();

  const baseline = baselineState(cwd).status;
  /** @type {BootResult} */
  const result = { migrations, knowledge, indexed, compacted, migrations_committed: migrationsCommitted, warnings, tmux_labels: labelConfigStatus(cwd), label_repaired: repairSessionLabels(cwd).repaired, session_hooks_installed: sessionHooksInstalled, worktree_include_installed: worktreeIncludeInstalled, gate_surface: gate.status, baseline, walkthrough: walkthroughState(cwd).status };
  if (gate.settings) result.claude_settings = gate.settings;
  // The signal travels only while nothing is recorded: the calling skill
  // judges once, then the verdict is on the manifest.
  if (baseline === 'none') result.baseline_signal = baselineSignal(cwd);
  // Not-ready responses carry the system-config report so the calling
  // skill's knowledge gate can branch (reuse the system config, offer a
  // mode choice, or fall back to the terminal wizard) without extra probes.
  if (knowledge === 'not-ready') result.system_config = detectSystemConfig();
  return result;
}

/**
 * Commit a file boot wrote, confined to it. The write is already on disk, so
 * a commit git refuses is a warning, never a block.
 * @param {string} cwd @param {string} spec @param {string} message
 * @param {string} failure the warning's lead @param {string[]} warnings
 */
function commitPlumbing(cwd, spec, message, failure, warnings) {
  try {
    commitPathspecScoped(cwd, spec, message);
  } catch (err) {
    warnings.push(`${failure}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Keep the session hooks in the project's settings — SessionEnd's `presence
 * cleanup` and `conversation end` for every project, `session cleanup` and
 * SessionStart's `session resume` while labels are on — so a checkout that
 * predates them, or lost them to a hand edit, gets them back; committed
 * where `commit` says so. The opt-in read and the write share the project
 * lock: a `label-config` landing between them would have this boot strip
 * the hook it just installed. A file that cannot be read is a warning,
 * never a block.
 * @param {string} cwd @param {boolean} commit @param {string[]} warnings
 * @returns {boolean} this boot wrote the hooks
 */
function installSessionHooks(cwd, commit, warnings) {
  const sync = withProjectLock(cwd, () => syncSessionHooks(cwd, { session: resolveEnabled(cwd) === true, workflows: true }));
  if (sync.error) warnings.push(`session hooks not installed: ${sync.error}`);
  if (sync.changed && commit) {
    commitPlumbing(cwd, SETTINGS_SPEC, 'chore: install workflow session hooks', 'project settings commit failed', warnings);
  }
  return sync.changed;
}

/**
 * Keep the knowledge files listed in `.worktreeinclude` so a worktree Claude
 * Code creates starts with a copy; committed where `commit` says so. The
 * read and the append share the project lock, so concurrent boots never
 * append twice. A file that cannot be written is a warning, never a block.
 * @param {string} cwd @param {boolean} commit @param {string[]} warnings
 * @returns {boolean} this boot wrote the file
 */
function installWorktreeInclude(cwd, commit, warnings) {
  const include = withProjectLock(cwd, () => syncWorktreeInclude(cwd));
  if (include.error) warnings.push(`worktree include not written: ${include.error}`);
  if (include.changed && commit) {
    commitPlumbing(cwd, WORKTREE_INCLUDE, 'chore: copy the knowledge store into new worktrees', 'worktree include commit failed', warnings);
  }
  return include.changed;
}

module.exports = { boot, detectSystemConfig };
