'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the boot pipeline — the sequential entry checks Step 0 needs,
// collapsed into one call: put the state in place and catch it up, run
// migrations, probe the knowledge base, and when it is ready bring the
// store's keyword side in line with the files, compact it, and hand the
// vectors it awaits to the background fill — a start never waits on
// embedding.
//
// Before all of it, boot reads the git on the PATH, once: one older than the
// engine's floor, or none, stops boot with nothing written (git-floor.cjs).
//
// The state comes first, before anything writes it (state-checks.cjs): the
// state folder kept out of every branch, the branch and its worktree put in
// place — or set up, or, lost, the stop whose yes is `boot --start-again`,
// or, on the layout before the state branch, the stop for the migration —
// then, under the writer lock, the ledger's entries a killed write left
// uncommitted committed, a warning counting them, and the catch-up from the
// remote, which carries them, whose stop on a field both clones changed ends
// boot there for the person's pick (state-merge.cjs). Then the session's own
// `.gitignore` keeps the state's ignore line, the workflows' trace,
// committed through the code door (code-trace.cjs), and the migrations run,
// all under that one hold, so a second boot meanwhile finds each done.
//
// Migrations are the durability-critical leg: a failing migrate.cjs is a hard
// error — migrations must never half-run silently. The run records into the
// state's migrations record, which boot names, under the writer lock: the
// runner takes no lock of its own, so the parent's hold covers it. A run
// that recorded migrations without changing a document leaves the record as
// the only dirt, and no reviewed commit follows a report of no changes, so
// boot commits that line itself — this run's, or one an earlier boot
// stranded. A run the runner stops at a directive — a migration the start
// session carries out (directives.cjs) — stops boot there, past nothing,
// committing nothing (21.10.10): the stop names the directive, its file,
// and its pieces done of all of them, where its check can say.
//
// While the migration is under way — its state worktree checked out on a
// `leeway-state` with no commit yet — nothing is committed before the
// migration's commit (21.9.3): no ledger tail, no catch-up, no ignore line
// in the code tree, and no settings commit; every state commit is held
// (state-worktree.cjs). The migrations run as ever.
//
// The knowledge directory — the store, its metadata, the knowledge config,
// beside them the store's lock and the fill's claim — sits in the one state
// every worktree shares, git-ignored there, so there is nothing to copy into
// a worktree. A checkout set up (its local config) with no store gets one
// built when this machine's config says how — it reads `buildable`.
// Anything else not-ready is the caller's gate: boot never sets a checkout
// up itself, and a not-ready response carries the system-config report so
// the gate can offer setup without extra probes. A knowledge config setting
// the load ignores, a failing index or compact, a provider key that does not
// resolve, and a vector fill that fell short are warnings, never blocks.
// Before that pass the ledger's copies in the knowledge directory are
// rendered again, any missing or stale against the ledger written and any no
// record holds removed (ledger-copies.cjs), so the pass indexes what the
// ledger says now; a render that fails is a warning too.
//
// The migrations run from the code root (kernel/code-root), whichever folder
// boot was called from, recording into the state's migrations record.
//
// Boot is also where the conversation folders are tidied, whichever project
// the conversations ran in: one goes once its transcript is gone, and no
// trust log event waits in it. Every boot appends the events any
// conversation keeps waiting, first of all, so one that stops at the lost
// state or the merge does too (trust-log.cjs): they need no project state,
// but one a write kept ahead of its entry, which lands, or goes, by this
// project's ledger, under its writer lock.
// The start menu is no position, so the calling conversation's own goes
// first, before the migrations — a boot that fails leaves none.
//
// Where a decision landed unchecked and no late check has judged it, boot
// launches the late one-decision check, detached, as it hands vectors to the
// fill: a start never waits on a Claude call (ledger-late-check.cjs). What
// keeps it from launching is a warning.
// ---------------------------------------------------------------------------

const { spawnSync } = require('child_process');
const { withProjectLock } = require('../kernel/manifest.cjs');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { systemConfigPath } = require('../kernel/knowledge/config.cjs');
const { commitStateScoped } = require('./commit.cjs');
const { withStateLock } = require('./state-worktree.cjs');
const { placeState } = require('./state-checks.cjs');
const { catchUpState } = require('./state-merge.cjs');
const { keepStateIgnored } = require('./code-trace.cjs');
const { githubRuleOffered, githubSquashOffered } = require('./github-setup.cjs');
const { bootKnowledge } = require('./knowledge/sync.cjs');
const { renderLedgerCopies } = require('./ledger-copies.cjs');
const { detectSystemConfig: detectKnowledgeSettings } = require('./knowledge/setup.cjs');
const { labelConfigStatus, repairSessionLabels, resolveEnabled, syncSessionHooks, commitSessionHooks } = require('./session-label.cjs');
const { gateSurface } = require('./gate-surface.cjs');
const { gitShortfall } = require('./git-floor.cjs');
const { tidyConversations } = require('./conversation.cjs');
const { appendWaiting, holdsWaiting } = require('./trust-log.cjs');
const { dropPosition } = require('./position.cjs');
const { brownfieldOffer, baselineSignal } = require('./brownfield.cjs');
const { walkthroughState } = require('./walkthrough.cjs');
const { launchLateCheck } = require('./ledger-late-check.cjs');
const { commitUncommitted } = require('./ledger.cjs');
const { MIGRATE_CJS, MIGRATIONS_RECORD, MIGRATION_JOURNALS, directiveStopped } = require('./directives.cjs');

// The migration orchestrator prints this marker if and only if files were updated — it is the
// authoritative "changed" signal. (git status is no substitute: unrelated
// session work may already be dirty in the state.) The marker's follow-on
// instruction lines address a prose flow, not this caller, so the trimmed
// report drops everything from the marker down.
const STOP_GATE_MARKER = '---STOP_GATE: FILES_UPDATED---';

// Marker preceding migrate.cjs's one-line JSON array of verification
// addenda — natural-language check instructions from migrations executed
// this run, handed to the calling flow's judgment pass and stripped from
// the report text.
const VERIFY_MARKER = '---VERIFY_ADDENDA---';

// Marker preceding migrate.cjs's one-line JSON array of notices — sentences
// migrations executed this run hand back for the person, shown in the calling
// flow's migration summary and stripped from the report text.
const NOTICES_MARKER = '---MIGRATION_NOTICES---';

// Marker preceding migrate.cjs's one-line JSON report of the run — `{ran}`:
// the migrations executed. Counting runs is not counting files — a migration
// that ran and found nothing to do still recorded its ID — so the stop gate
// cannot speak for the record.
const MIGRATIONS_RUN_MARKER = '---MIGRATIONS_RUN---';

// The line migrate.cjs ends a run on where it stops at a directive.
const DIRECTIVE_MARKER = /^---DIRECTIVE: (\S+)---$/m;

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
 * @typedef {object} MigrationNotice
 * @property {string} id
 * @property {string} description
 * @property {string} notice  what the person is told
 */

/**
 * Boot stopped before anything wrote the state: `git`, the git on the PATH
 * older than the engine's floor, or none, read before anything else runs —
 * `render git-floor-stop` draws the stop; `lost`, the state
 * branch gone here and on the remote in a project holding the workflows'
 * trace — `render state-lost-gate` draws the stop, and its yes is `boot
 * --start-again`; `migrate`, the project on the layout before the state
 * branch, its state in `.workflows/` on its code branch — the migration
 * moves it; `merge`, the catch-up stopped by a field both clones changed —
 * `render state-merge-gate` draws it, and `state-merge pick` answers it.
 * @typedef {object} BootStop
 * @property {'git'|'lost'|'migrate'|'merge'} state
 * @property {string[]} warnings
 */

/**
 * Boot stopped at a directive of the migration the record does not hold
 * (21.10.10): the directive's id and file, and its pieces done of all of
 * them where its check can say — `render directive-stop` draws the stop,
 * and the session carries the directive on.
 * @typedef {{state: 'directive', id: string, file: string, done?: number, of?: number, warnings: string[]}} DirectiveStop
 */

/**
 * @typedef {object} BootResult
 * @property {'ready'|'restarted'} state `restarted` where this boot started a lost state again, on the person's yes — the product's read of the code follows
 * @property {boolean} github_rule_offer the state's remote is on GitHub and the rule against deleting or force-pushing its branch was never answered — `render github-rule-gate` offers it, and `github-rule <yes|no>` answers
 * @property {boolean} github_squash_offer the project lands through GitHub and the squash default was never answered — `render github-squash-gate` offers it, and `github-squash <yes|no>` answers
 * @property {{changed: boolean, ran: number, output: string, verify: VerifyAddendum[], notices: MigrationNotice[]}} migrations `changed` counts files, `ran` counts migrations executed — a migration can run and change nothing
 * @property {'ready'|'not-ready'} knowledge
 * @property {boolean} indexed the store's keyword side came in line with the files — no artifact left failing
 * @property {boolean} compacted
 * @property {string|null} migrations_committed short sha of the migrations record's commit, or null when nothing was committed — set only where no reviewed migration commit follows, whatever boot left the record dirty
 * @property {string[]} warnings non-blocking failures (a knowledge config setting the load ignores, knowledge index, compaction, a provider key that does not resolve, a vector fill that fell short, the migrations record's commit, the session hooks, an unreadable report block, the late one-decision check not launched, the ledger's copies not rendered, the trust log's waiting events not appended)
 * @property {'no-tmux'|'on'|'off'|'prompt'} tmux_labels session-label opt-in state — `prompt` means in tmux and never asked, leeway's one-time prompt
 * @property {boolean} label_repaired a session label on this terminal — this session's own, arriving at the start menu, or a stranded one whose owner is gone — was put back to the original name
 * @property {boolean} session_hooks_installed this boot wrote the session hooks into `.claude/settings.json` — SessionEnd's `presence cleanup` and `conversation end`, and PreToolUse's layout hook (`layout guard`, matcher `Write|Edit|NotebookEdit`), brief hook (`brief guard`, matcher `Agent|SendMessage`) and shell hook (`shell guard`, matcher `Bash`), for every project, `session cleanup` and SessionStart's `session resume` (matcher `resume`) while labels are on; false when the file already carried exactly those
 * @property {import('./gate-surface.cjs').GateSurface} gate_surface the gate mod, which boot writes nothing for — `unavailable` where it cannot run here (Claude Code on the web, another entrypoint than the terminal app, the mod not installed, a version that does not read) and `outdated` at a release before 2.1.287; where it can: `on` where it is running, its announcement in boot's own environment, and `not-running` where it is not — leeway shows a notice on `not-running` and carries on with typed menus, and stops on `outdated`
 * @property {import('./brownfield.cjs').BrownfieldOffer} brownfield_offer the answer to the brownfield offer from the project manifest — `none` means nothing recorded yet (leeway's one-time judgment: native, or the offer), `accepted` that its research is owed, which the product's conversation resumes at its next opening
 * @property {'none'|'walked'|'skipped'} walkthrough the answer to the walkthrough offer from the project manifest — `none` means nothing recorded yet, the state leeway's one-time offer keys on
 * @property {import('./brownfield.cjs').BaselineSignal|null} [baseline_signal] present only while brownfield_offer is `none` — the repository facts the judgment is made from; null when there is no git history to read
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
 * The run report's count, read defensively: an absent block reads zero, and
 * a malformed one reads zero with a warning.
 * @param {unknown} payload @param {string[]} warnings
 * @returns {number}
 */
function readRunReport(payload, warnings) {
  if (payload === undefined) return 0;
  const ran = payload && typeof payload === 'object' ? /** @type {{ran?: unknown}} */ (payload).ran : undefined;
  if (typeof ran === 'number' && Number.isInteger(ran) && ran >= 0) return ran;
  warnings.push(`migration run report unreadable: ${JSON.stringify(payload)}`);
  return 0;
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
 * Run the boot pipeline against the project at `cwd`. `startAgain` is the
 * person's yes at the lost-state stop: a state still lost is started again.
 * @param {string} cwd project root
 * @param {{startAgain?: boolean}} [opts]
 * @returns {BootResult|BootStop|DirectiveStop}
 */
function boot(cwd, { startAgain = false } = {}) {
  if (gitShortfall() !== null) return { state: 'git', warnings: [] };
  dropPosition(handedSession());
  /** @type {string[]} */
  const warnings = [];
  appendWaiting(cwd, warnings);
  const placed = placeState(cwd, { startAgain });
  warnings.push(...placed.warnings);
  if ('stop' in placed) return { state: placed.stop, warnings };
  const root = stateRoot(cwd);
  const migrated = withStateLock(root, () => {
    if (!placed.migrating) {
      commitLedgerTail(root, warnings);
      const caught = catchUpState(root, { listing: placed.listing });
      warnings.push(...caught.warnings);
      if (caught.action === 'stopped') return null;
      keepStateIgnored(cwd, warnings);
    }
    return runMigrations(cwd, warnings);
  });
  if (migrated === null) return { state: 'merge', warnings };
  if ('directive' in migrated) return { state: 'directive', ...directiveStopped(cwd, migrated.directive), warnings };
  const { migrations, migrationsCommitted } = migrated;

  renderLedgerCopies(cwd, warnings);
  const { knowledge, indexed, compacted } = bootKnowledge(cwd, warnings);

  // While a reviewed migration commit follows, it takes every path the
  // workflows own, so boot's own writes there ride it as the record does —
  // a confined commit of a file a migration also edited would carry that
  // edit past the review under boot's message — as the migration's commit
  // does while the migration is under way.
  const commitOwn = !migrations.changed && !placed.migrating;
  const sessionHooksInstalled = installSessionHooks(cwd, commitOwn, warnings);
  tidyConversations(holdsWaiting);
  launchLateCheck(root, warnings);

  const brownfield = brownfieldOffer(cwd);
  /** @type {BootResult} */
  const result = { state: placed.made === 'restarted' ? 'restarted' : 'ready', migrations, knowledge, indexed, compacted, migrations_committed: migrationsCommitted, warnings, tmux_labels: labelConfigStatus(cwd), label_repaired: repairSessionLabels(cwd).repaired, session_hooks_installed: sessionHooksInstalled, gate_surface: gateSurface(cwd), brownfield_offer: brownfield, walkthrough: walkthroughState(cwd).status, github_rule_offer: githubRuleOffered(cwd), github_squash_offer: githubSquashOffered(cwd) };
  // The signal travels only while nothing is recorded: the calling skill
  // judges once, then the verdict is on the manifest.
  if (brownfield === 'none') result.baseline_signal = baselineSignal(cwd);
  // Not-ready responses carry the system-config report so the calling
  // skill's knowledge gate can branch (reuse the system config, offer a
  // mode choice, or fall back to the terminal wizard) without extra probes.
  if (knowledge === 'not-ready') result.system_config = detectSystemConfig();
  return result;
}

/**
 * Commit the ledger's entries a write appended and a kill, or a commit git
 * refused, left uncommitted, so the catch-up carries them (4.7.8). A commit
 * that fails is a warning: the entries stand in the ledger.
 * @param {string} root @param {string[]} warnings
 */
function commitLedgerTail(root, warnings) {
  try {
    const { entries, warnings: notes } = commitUncommitted(root, 'ledger: the entries a write left uncommitted');
    warnings.push(...notes);
    if (entries > 0) warnings.push(`committed ${entries} ledger ${entries === 1 ? 'entry' : 'entries'} a write left uncommitted`);
  } catch (err) {
    warnings.push(`the ledger's uncommitted entries were not committed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Run the migrations into the state's migrations record and, where no
 * reviewed commit will carry it, commit the record; or answer the directive
 * the run stopped at, committing nothing.
 * @param {string} cwd @param {string[]} warnings
 * @returns {{migrations: BootResult['migrations'], migrationsCommitted: string|null}|{directive: string}}
 */
function runMigrations(cwd, warnings) {
  const mig = spawnSync('node', [MIGRATE_CJS, '--record', statePath(cwd, MIGRATIONS_RECORD), '--journals', statePath(cwd, MIGRATION_JOURNALS)], { cwd: codeRoot(cwd), encoding: 'utf8' });
  if (mig.error || mig.status !== 0) {
    const detail = mig.error
      ? mig.error.message
      : `exit ${mig.status}: ${(mig.stderr || mig.stdout || '').trim()}`;
    throw new Error(`migrate.cjs failed — migrations must never half-run silently (${detail})`);
  }
  const stopped = DIRECTIVE_MARKER.exec(mig.stdout || '');
  if (stopped !== null) return { directive: stopped[1] };

  const outLines = (mig.stdout || '').split('\n');
  const addenda = liftMarker(outLines, VERIFY_MARKER, 'verification addenda', warnings);
  if (addenda !== undefined && !Array.isArray(addenda)) warnings.push('verification addenda unreadable: not an array');
  const notices = liftMarker(outLines, NOTICES_MARKER, 'migration notices', warnings);
  if (notices !== undefined && !Array.isArray(notices)) warnings.push('migration notices unreadable: not an array');
  const ran = readRunReport(liftMarker(outLines, MIGRATIONS_RUN_MARKER, 'migration run report', warnings), warnings);
  const stdout = outLines.join('\n');

  const migrations = {
    changed: stdout.includes(STOP_GATE_MARKER),
    ran,
    output: trimReport(stdout),
    verify: /** @type {VerifyAddendum[]} */ (Array.isArray(addenda) ? addenda : []),
    notices: /** @type {MigrationNotice[]} */ (Array.isArray(notices) ? notices : []),
  };

  // A migration that ran while changing no document still wrote the record,
  // and that write has no other path to a commit: with nothing to review the
  // calling skill says "up to date" and never reaches its `commit
  // --migrations`. So boot leaves the record clean whenever no reviewed commit
  // will carry it — dirt this run recorded, and dirt an earlier boot left
  // behind the same way. When the review gate does fire, its own commit takes
  // the record in with the diff the user approved and boot stays out of the
  // way. The migrations are already applied, so a commit failure is a warning.
  /** @type {string|null} */
  let migrationsCommitted = null;
  if (!migrations.changed) {
    try {
      const committed = commitStateScoped(cwd, MIGRATIONS_RECORD, 'chore: record workflow migrations');
      migrationsCommitted = committed.committed;
      warnings.push(...committed.warnings);
    } catch (err) {
      warnings.push(`migrations record commit failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { migrations, migrationsCommitted };
}

/**
 * Keep the session hooks in the project's settings — SessionEnd's `presence
 * cleanup` and `conversation end`, and PreToolUse's layout, brief and shell
 * hooks, for every project, `session cleanup` and SessionStart's `session
 * resume` while labels are on — so a checkout that predates them, or lost
 * them to a hand edit, gets them back; committed
 * where `commit` says so, this boot's write or one an earlier boot could not
 * commit. The opt-in read and the write share the project lock: a
 * `label-config` landing between them would have this boot strip the hook
 * it just installed. A file that cannot be read is a warning, never a block.
 * @param {string} cwd @param {boolean} commit @param {string[]} warnings
 * @returns {boolean} this boot wrote the hooks
 */
function installSessionHooks(cwd, commit, warnings) {
  const { want, sync } = withProjectLock(cwd, () => {
    const wanted = { session: resolveEnabled(cwd) === true, workflows: true };
    return { want: wanted, sync: syncSessionHooks(cwd, wanted) };
  });
  if (sync.error) warnings.push(`session hooks not installed: ${sync.error}`);
  if (commit && !sync.error) commitSessionHooks(cwd, want, 'chore: install workflow session hooks', 'project settings commit failed', warnings);
  return sync.changed;
}

module.exports = { boot, detectSystemConfig };
