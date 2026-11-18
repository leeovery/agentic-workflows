'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the boot pipeline — the sequential entry checks the start
// skill needs, collapsed into one call: put the state in place and catch it
// up, run migrations, probe the knowledge base, and when it is ready bring
// the store's keyword side in line with the files, compact it, and hand the
// vectors it awaits to the background fill — a start never waits on
// embedding.
//
// Before all of it, boot reads the git on the PATH, once: one older than the
// engine's floor, or none, stops boot with nothing written (git-floor.cjs).
// Then a folder in no git repository stops it, with nothing written either:
// Ledger runs inside a repository and never sets one up. A project that is a
// folder inside a larger repository is in one, and boots.
//
// The state comes first, before anything writes it (state-checks.cjs): the
// state folder kept out of every branch, the branch and its worktree put in
// place — or set up, or, lost, the stop whose yes is `boot --start-again`,
// or left to the migration where the project owes the reshape — then, under
// the writer lock, the ledger's entries a killed write left
// uncommitted committed, a warning counting them, and the catch-up from the
// remote, which carries them, whose stop on a field both clones changed ends
// boot there for the person's pick (state-merge.cjs). Then the session's own
// `.gitignore` keeps the state's ignore line, Ledger's trace,
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
// and its pieces done of all of them, where its check can say. So does a
// run the runner stops before the reshape's move, for the checks the chain
// before it handed back (21.10.13): the `checks` stop carries them, and the
// folder in the main checkout whose old state they fix, uncommitted,
// for the move to carry. Once made, they come back marked `made` with the
// run that finishes the migration, beside the chain's notices. The session
// either stop meets carries the migration on, its row at the migration's
// place stamped (presence.cjs); where another live session holds that row,
// the stop is `taken`, naming the step that session carries on from and
// when it was last active, and this one goes no further. Boot drops that
// row once it reaches the work, the migration done.
//
// Where the project owes the reshape (21.1.2), boot runs the migrations
// before anything else writes, and the reshape's guard runs first of them
// (21.2.1): where another session is live in the project, or its old state
// has uncommitted changes, the guard refuses and boot stops there — the
// `guard` stop, its facts the screen's (21.3.4) — with nothing written to
// the state or the code but the exclude line boot keeps. On a pass the
// guard puts the state worktree in place, and the migration is under way.
// The run holds the boot lock from the state's checks to its end, and the
// writer lock with it once the state worktree is there, so a second boot
// meanwhile waits, then finds it done or stopped. It runs in the project's
// folder in the main checkout, wherever boot was called from: the copy the
// reshape moves. Called from another checkout, boot warns of each file of
// that checkout's old state the reshape leaves where it is, differing from
// what the main checkout's HEAD holds (the migrate skill's old-layout.cjs,
// `unmoved`).
//
// While the migration is under way — its state worktree checked out on a
// `ledger-state` with no commit yet — nothing is committed before the
// migration's commit (21.9.3): no ledger tail, no catch-up, no ignore line
// in the code tree, and no settings commit; every state commit is held
// (state-worktree.cjs). The session hooks are synced all the same, at
// every stop past the guard, written for the migration's commit to take:
// in the calling checkout, whose session reads them, and in the project's
// folder in the main checkout, which the commit takes. They go live at the
// checks stop, the first the migration's own work meets, since the guards
// refuse none of that work — the checks' fixes in the old state, the
// split's plans staged in the cache, the records carried through the
// engine — and so the brief hook hands the records directive's agents
// their briefs. Before the move there is no manifest to read the label
// opt-in from, so a stop before it syncs the label hooks as off, and the
// first stop after it brings them back. Once the runner has nothing left
// to run, the migration waits on its commit, and boot stops there — the
// `finish` stop, whatever the run changed — committing nothing, the
// migrations record among it, so the start menu is never reached over a
// half-migrated project; it stops there too while the reshape's commit is
// part made, the state branch born and the code branch's still owed
// (migration-commit.cjs).
// Before it stops, boot renders the ledger's copies and indexes the
// records, as after any migration (21.9.1). Where a kill after the code
// commit left the drops on disk, nothing is left for the person to decide:
// boot takes them off, clears the journals, under its lock, and goes on.
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
// Outside the reshape, the migrations run from the code root
// (kernel/code-root), whichever folder boot was called from, recording into
// the state's migrations record.
//
// Boot stamps the calling conversation as booted for the project (22.1.7,
// boot-stamp.cjs) where it reaches the work — ready, or restarted — and at a
// directive's stop, whose steps call verbs; never at the git, repo, lost,
// guard, checks, taken or merge stops, where nothing may touch the work,
// and never at finish, where a stamp a directive's stop wrote earlier
// stands. The verbs those stops run go through without it (engine.cjs,
// `BOOT_EXEMPT`).
//
// Each stop names what the start skill does there (`STOPS`): the marker it
// opens on, the screen it fetches and what follows — the start ending, the
// person's answer at the screen's gate, or a reference loaded, then boot
// again — so a stop joins without a word of prose. Past the stops, boot
// takes the person's words, the bare command none, and answers where the
// start goes and the setup gates due before it (boot-route.cjs), with the
// facts those gates read: the session's effort as Claude Code hands it,
// `CLAUDE_EFFORT`, and whether the gate mod runs, could, or cannot.
//
// Boot is also where the conversation folders are tidied, whichever project
// the conversations ran in: one goes once its transcript is gone, and no
// trust log event waits in it. Every boot appends the events any
// conversation keeps waiting, first of all, so one that stops at the lost
// state or the merge does too (trust-log.cjs): they need no project state,
// but one a write kept ahead of its entry, which lands, or goes, by this
// project's ledger, under its writer lock.
// The start menu is no position, so the calling conversation's own goes
// first, before the migrations — a boot that fails leaves none — the place
// it left kept for the board where it names a phase, and its tasks in
// flight kept there whatever boot answers, the menu, a route or a pick, so
// the builders still at work go on (position.cjs).
//
// Where a decision landed unchecked, never one the migration carried, and
// no late check has judged it, boot launches the late one-decision check,
// detached, as it hands vectors to the fill: a start never waits on a
// Claude call (ledger-late-check.cjs). What keeps it from launching is a
// warning.
// ---------------------------------------------------------------------------

const { spawnSync } = require('../kernel/spawn.cjs');
const { withProjectLock } = require('../kernel/manifest.cjs');
const { stateRoot, statePath, outsideRepository } = require('../kernel/state-root.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { systemConfigPath } = require('../kernel/knowledge/config.cjs');
const { commitStateScoped } = require('./commit.cjs');
const { withStateLock, withBootLock, migrationRuns } = require('./state-worktree.cjs');
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
const { stampBoot } = require('./boot-stamp.cjs');
const { appendWaiting, holdsWaiting } = require('./trust-log.cjs');
const { leavePosition } = require('./position.cjs');
const { brownfieldOffer, brownfieldSignal } = require('./brownfield.cjs');
const { walkthroughState } = require('./walkthrough.cjs');
const { launchLateCheck } = require('./ledger-late-check.cjs');
const { commitUncommitted } = require('./ledger.cjs');
const { MIGRATE_CJS, MIGRATIONS_RECORD, MIGRATION_JOURNALS, directiveStopped } = require('./directives.cjs');
const { finishOwed, projectInMain } = require('./migration-commit.cjs');
const { entryOf, gatesDue } = require('./boot-route.cjs');
const { migrationCarrier, beatMigrationQuietly, dropMigrationRow } = require('./presence.cjs');
const { unmoved } = require('../../../ledger-migrate/scripts/old-layout.cjs');

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

// The line migrate.cjs ends a run on where it stops before the reshape's
// move, for the checks the chain before it handed back.
const CHECKS_MARKER = '---CHECKS---';

// The line migrate.cjs ends a run on where the reshape's guard (074) refused
// to run, before the one-line JSON of the refusal's facts; the run recorded
// nothing.
const GUARD_REFUSED = '---REFUSED: 074---';

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
 * @property {true} [made]        checked at the stop before the reshape's move: listed among what was done, never checked again
 */

/**
 * @typedef {object} MigrationNotice
 * @property {string} id
 * @property {string} description
 * @property {string} notice  what the person is told
 */

/**
 * What the start skill does at a stop (the header's): the marker it opens
 * on, where it has one; the screen it fetches, `render {surface} {args}`,
 * where it has one; and what follows — null, the start ends; `gate`, the
 * screen's gate takes the person's answer, whose next is run, boot running
 * again after it but where it was a boot or none; `load`, the start
 * skill's reference by name, with what it is given, then boot again.
 * @typedef {{kind: 'gate'} | {kind: 'load', reference: string, with?: Record<string, string>}} StopNext
 * @typedef {{marker?: string, surface?: string, args?: string[], next: StopNext|null}} Stop
 */

const MIGRATION = 'Migration';
/** @type {StopNext} */
const AT_THE_GATE = Object.freeze({ kind: 'gate' });
/** @param {string} reference @returns {StopNext} */
const loading = (reference) => Object.freeze({ kind: 'load', reference });

/**
 * Boot's stops, each as the start skill takes it (`Stop`): `git`, the git
 * on the PATH older than the engine's floor, or none, read before anything
 * else runs; `repo`, the folder in no git repository, read next; `lost`,
 * the state branch gone here and on the remote in a project holding
 * Ledger's trace, its yes `boot --start-again`; `guard`, the reshape's
 * guard refusing the migration (`GuardStop`); `checks`, the migration
 * stopped before its move for the checks the chain before it handed back
 * (`ChecksStop`); `merge`, the catch-up stopped by a field both clones
 * changed, each row's answer its `state-merge pick`; `taken`, the migration
 * stopped where another live session carries it on (`TakenStop`);
 * `directive`, the migration stopped at a directive the session carries out
 * (`DirectiveStop`); `finish`, the migration waiting on its commit, which
 * the review's gate makes (`FinishStop`).
 * @type {Readonly<Record<string, Readonly<Stop>>>}
 */
const STOPS = Object.freeze({
  git: Object.freeze({ surface: 'git-floor-stop', next: null }),
  repo: Object.freeze({ surface: 'repo-stop', next: null }),
  lost: Object.freeze({ surface: 'state-lost-gate', next: AT_THE_GATE }),
  guard: Object.freeze({ marker: MIGRATION, surface: 'migration-guard-stop', next: null }),
  checks: Object.freeze({ marker: MIGRATION, surface: 'migration-checks-stop', next: loading('migration-checks') }),
  merge: Object.freeze({ surface: 'state-merge-gate', next: AT_THE_GATE }),
  taken: Object.freeze({ marker: MIGRATION, surface: 'migration-taken-stop', next: null }),
  directive: Object.freeze({ next: loading('migration-directive') }),
  finish: Object.freeze({ marker: MIGRATION, next: loading('migration-review') }),
});

/** Each stop that fetches a screen, by the surface that draws it. */
const BOOT_STOPS = Object.freeze(Object.fromEntries(Object.entries(STOPS).flatMap(([state, { surface }]) => (surface === undefined ? [] : [[state, surface]]))));

/**
 * The stop `state` as the start skill takes it, the screen's arguments and
 * the reference's inputs where this stop has them.
 * @param {string} state @param {{args?: string[], given?: Record<string, string>}} [filled]
 * @returns {Stop}
 */
function stopAt(state, { args, given } = {}) {
  const { next, ...shown } = STOPS[state];
  return { ...shown, ...(args === undefined ? {} : { args }), next: next?.kind === 'load' && given !== undefined ? { ...next, with: given } : next };
}

/**
 * Boot stopped before anything wrote the state (`STOPS`).
 * @typedef {object} BootStop
 * @property {'git'|'repo'|'lost'|'merge'} state
 * @property {Stop} stop
 * @property {string[]} warnings
 */

/**
 * Why the reshape's guard refused the migration, and the facts its screen
 * states (21.3.4): `live`, another session working in the project — the
 * unit, phase and topic of the presence written last, and how long ago, in
 * whole seconds, `paths` null; `dirty`, uncommitted changes in the
 * project's old state, `paths` each path changed, from the project's
 * folder, the other four null.
 * @typedef {{cause: 'live'|'dirty', unit: string|null, phase: string|null, topic: string|null, active: number|null, paths: string[]|null}} Refusal
 */

/**
 * Boot stopped at the reshape's guard, with nothing written to the state or
 * the code.
 * @typedef {{state: 'guard', stop: Stop, warnings: string[]} & Refusal} GuardStop
 */

/**
 * Boot stopped at a directive of the migration the record does not hold
 * (21.10.10): the directive's id and file, and its pieces done of all of
 * them where its check can say — `render directive-stop` draws the stop,
 * and the session carries the directive on.
 * @typedef {{state: 'directive', id: string, file: string, done?: number, of?: number, stop: Stop, warnings: string[]}} DirectiveStop
 */

/**
 * Boot stopped where another live session carries the migration on
 * (21.10.10, P7): the step it carries on from, `at` — a directive's id, or
 * `checks`, the checks before the reshape's move — and the whole seconds
 * since that session's row at the migration's place was last written;
 * `render migration-taken-stop` draws the stop naming it, and this session
 * goes no further.
 * @typedef {{state: 'taken', at: string, active: number, stop: Stop, warnings: string[]}} TakenStop
 */

/**
 * Boot stopped before the reshape's move (21.10.13): the checks the chain
 * before it handed back, and the project's folder in the main checkout,
 * whose old state the checks are made on, uncommitted, for
 * the move to carry — `render migration-checks-stop` draws the stop, the
 * session makes the checks and records them made (`migrate checked`).
 * @typedef {{state: 'checks', folder: string, verify: VerifyAddendum[], stop: Stop, warnings: string[]}} ChecksStop
 */

/**
 * Boot stopped where the migration waits on its commit (21.9): the run's
 * report, its handbacks among it — none where the state branch's first
 * commit is made and only the code branch's remains, which no run precedes
 * — for the review whose gate's yes makes the commit.
 * @typedef {{state: 'finish', migrations: BootResult['migrations'], stop: Stop, warnings: string[]}} FinishStop
 */

/** Whether the gate mod runs, could, or cannot (22.2.4). @typedef {'running'|'could'|'cannot'} Mod */

/** The mod's standing as boot reports it, by where the gate surface stands. @type {Readonly<Record<import('./gate-surface.cjs').GateSurface, Mod>>} */
const MOD = Object.freeze({ on: 'running', 'not-running': 'could', unavailable: 'cannot', outdated: 'cannot' });

/** The session's effort as Claude Code hands it (`CLAUDE_EFFORT`), lowercase; null where it hands none. @returns {string|null} */
function sessionEffort() {
  const level = (process.env.CLAUDE_EFFORT ?? '').trim().toLowerCase();
  return level === '' ? null : level;
}

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
 * @property {'no-multiplexer'|'on'|'off'|'prompt'} session_labels session-label opt-in state — `prompt` means inside tmux or Portal and never asked, ledger's one-time prompt
 * @property {boolean} label_repaired a session label on this terminal — this session's own, arriving at the start menu, or a stranded one whose owner is gone — was put back to the original name
 * @property {boolean} session_hooks_installed this boot wrote the session hooks into `.claude/settings.json` — SessionEnd's `presence cleanup` and `conversation end`, and PreToolUse's layout hook (`layout guard`, matcher `Write|Edit|NotebookEdit`), brief hook (`brief guard`, matcher `Agent|SendMessage`) and shell hook (`shell guard`, matcher `Bash`), for every project, `session cleanup` and SessionStart's `session resume` (matcher `resume`) while labels are on; false when the file already carried exactly those
 * @property {Mod} mod the gate mod, which boot writes nothing for: `running`, its announcement in boot's own environment; `could`, where it can run and is not running — the start's notice; `cannot`, where it cannot run here (Claude Code on the web, another entrypoint than the terminal app, the mod not installed, a version that does not read, or one older than the floor, which the `claude-code-floor` gate stops on)
 * @property {string|null} effort the session's effort as Claude Code hands it every command (`CLAUDE_EFFORT`), lowercase; null where it hands none — the threshold is the start's prose (26.2.3)
 * @property {'menu'|'route'|'pick'} go where the start goes once its gates are worked (boot-route.cjs): the start menu, on the bare command; the route the words make; or the pick between the pieces of work they name
 * @property {import('./boot-route.cjs').Route} [route] where `go` is `route`: Start's type call with the words, or the unit or topic they name, and its next, the move invoked in this conversation
 * @property {{surface: string, args: string[]}} [pick] where `go` is `pick`: its screen, `render {surface} {args}`
 * @property {import('./boot-route.cjs').Gate[]} gates the setup gates due, in the order start works them
 * @property {import('./brownfield.cjs').BrownfieldOffer} brownfield_offer the answer to the brownfield offer from the project manifest — `none` means nothing recorded yet (ledger's one-time judgment: native, or the offer), `accepted` that its research is owed, which the product's conversation resumes at its next opening
 * @property {'none'|'walked'|'skipped'} walkthrough the answer to the walkthrough offer from the project manifest — `none` means nothing recorded yet, the state ledger's one-time offer keys on
 * @property {import('./brownfield.cjs').BrownfieldSignal|null} [brownfield_signal] present only where `gates` holds `brownfield` — the repository facts the judgment is made from; null when there is no git history to read
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
 * `words` are the person's, as the start was given them: none on the bare
 * command.
 * @param {string} cwd project root
 * @param {{startAgain?: boolean, words?: string}} [opts]
 * @returns {BootResult|BootStop|GuardStop|DirectiveStop|TakenStop|ChecksStop|FinishStop}
 */
function boot(cwd, { startAgain = false, words = '' } = {}) {
  if (gitShortfall() !== null) return { state: 'git', stop: stopAt('git'), warnings: [] };
  if (outsideRepository(cwd)) return { state: 'repo', stop: stopAt('repo'), warnings: [] };
  leavePosition(handedSession());
  /** @type {string[]} */
  const warnings = [];
  appendWaiting(cwd, warnings);
  const root = stateRoot(cwd);
  const { placed, migrated: reshaping } = placeAndReshape(cwd, root, startAgain, warnings);
  if ('stop' in placed) return { state: placed.stop, stop: stopAt(placed.stop), warnings };
  const migrated = reshaping ?? withStateLock(root, () => {
    commitLedgerTail(root, warnings);
    const caught = catchUpState(root, { listing: placed.listing });
    warnings.push(...caught.warnings);
    if (caught.action === 'stopped') return null;
    keepStateIgnored(cwd, warnings);
    const ran = runMigrations(cwd, codeRoot(cwd), warnings);
    return 'migrations' in ran ? { ...ran, migrationsCommitted: commitRecord(cwd, ran.migrations, warnings) } : ran;
  });
  if (migrated === null) return { state: 'merge', stop: stopAt('merge'), warnings };
  if ('refused' in migrated) return guardStop(migrated.refused, warnings);
  if (reshaping !== undefined) syncMigrationHooks(cwd, warnings);
  if ('taken' in migrated) {
    const { at, active } = migrated.taken;
    return { state: 'taken', at, active, stop: stopAt('taken', { args: ['--at', at, '--active', String(active)] }), warnings };
  }
  if ('directive' in migrated) {
    const stopped = directiveStopped(cwd, migrated.directive);
    return stamped(cwd, { state: 'directive', ...stopped, stop: stopAt('directive', { given: { directive: stopped.id, file: stopped.file } }), warnings });
  }
  if ('checks' in migrated) {
    const folder = projectInMain(cwd);
    return { state: 'checks', folder, verify: migrated.checks, stop: stopAt('checks', { given: { folder } }), warnings };
  }

  renderLedgerCopies(cwd, warnings);
  const { knowledge, indexed, compacted } = bootKnowledge(cwd, warnings);
  if ('finish' in migrated) return { state: 'finish', migrations: migrated.migrations, stop: stopAt('finish'), warnings };
  const { migrations, migrationsCommitted } = migrated;
  dropMigrationRow(cwd);

  // While a reviewed migration commit follows, it takes every path
  // Ledger owns, so boot's own writes there ride it as the record does —
  // a confined commit of a file a migration also edited would carry that
  // edit past the review under boot's message.
  const sessionHooksInstalled = installSessionHooks(cwd, !migrations.changed, warnings);
  tidyConversations(holdsWaiting);
  launchLateCheck(root, warnings);

  const surface = gateSurface(cwd);
  const facts = { migrations, knowledge, indexed, compacted, migrations_committed: migrationsCommitted, warnings, session_labels: labelConfigStatus(cwd), label_repaired: repairSessionLabels(cwd).repaired, session_hooks_installed: sessionHooksInstalled, mod: MOD[surface], effort: sessionEffort(), brownfield_offer: brownfieldOffer(cwd), walkthrough: walkthroughState(cwd).status, github_rule_offer: githubRuleOffered(cwd), github_squash_offer: githubSquashOffered(cwd) };
  const entry = entryOf(cwd, words);
  const restarted = placed.made === 'restarted';
  /** @type {BootResult} */
  const result = { state: restarted ? 'restarted' : 'ready', ...facts, ...entry, gates: gatesDue(facts, { bare: entry.go === 'menu', outdated: surface === 'outdated', restarted }) };
  if (result.gates.includes('brownfield')) result.brownfield_signal = brownfieldSignal(cwd);
  // Not-ready responses carry the system-config report so the calling
  // skill's knowledge gate can branch (reuse the system config, offer a
  // mode choice, or fall back to the terminal wizard) without extra probes.
  if (knowledge === 'not-ready') result.system_config = detectSystemConfig();
  return stamped(cwd, result);
}

/**
 * Boot stopped at the reshape's guard (`GuardStop`), its screen drawn from
 * the refusal's facts: the live session's, or each path changed.
 * @param {Refusal} refused @param {string[]} warnings @returns {GuardStop}
 */
function guardStop(refused, warnings) {
  const { cause, unit, phase, topic, active, paths } = refused;
  const facts = cause === 'live' ? ['--unit', String(unit), '--phase', String(phase), '--topic', String(topic), '--active', String(active)] : (paths ?? []).flatMap((at) => ['--path', at]);
  return { state: 'guard', cause, unit, phase, topic, active, paths, stop: stopAt('guard', { args: ['--cause', cause, ...facts] }), warnings };
}

/**
 * Boot's answer, the calling conversation stamped first as booted for the
 * project, where Claude Code handed the call a session id (boot-stamp.cjs).
 * @template {BootResult|DirectiveStop} T
 * @param {string} cwd @param {T} answer @returns {T}
 */
function stamped(cwd, answer) {
  const session = handedSession();
  if (session !== null) stampBoot(cwd, session);
  return answer;
}

/**
 * The state's checks, under the boot lock, and where they leave the state
 * to the migration, the migrations run in the project's folder in the main
 * checkout before the lock is let go — under the writer lock too once the
 * state worktree is there to hold it; a run with nothing left to run leaves
 * the migration waiting on its commit. Where the reshape's commit is part
 * made, the state branch born, it waits on the rest, and nothing runs; where
 * only the drops were left, they go, and boot goes on.
 * @param {string} cwd @param {string} root @param {boolean} startAgain @param {string[]} warnings
 * @returns {{placed: import('./state-checks.cjs').Placed, migrated: Migrated|undefined}}
 */
function placeAndReshape(cwd, root, startAgain, warnings) {
  return withBootLock(root, () => {
    const placed = placeState(cwd, { startAgain });
    warnings.push(...placed.warnings);
    if ('stop' in placed) return { placed, migrated: undefined };
    if (!placed.migrating) return { placed, migrated: finishOwed(cwd) === null ? undefined : { finish: true, migrations: nothingRan() } };
    const here = codeRoot(cwd);
    const from = projectInMain(cwd);
    warnUnmoved(here, from, warnings);
    const run = () => runMigrations(cwd, from, warnings);
    const ran = migrationRuns(root) ? withStateLock(root, run) : run();
    return { placed, migrated: 'migrations' in ran ? { finish: true, migrations: ran.migrations } : ran };
  });
}

/**
 * Where boot ran in another checkout than the main one, the warning naming
 * each file of its old state the reshape, run from `from`, leaves where it is.
 * @param {string} here @param {string} from @param {string[]} warnings
 */
function warnUnmoved(here, from, warnings) {
  const left = unmoved(here);
  if (left.length === 0) return;
  warnings.push(`the migration moves the project's state as the main checkout holds it, in ${from}; where boot ran, in ${here}, these differ from it and stay where they are: ${left.join(', ')}`);
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
 * What a migration handed back beside its counts: the checks for the
 * session, and the notices for the person.
 * @typedef {{verify: VerifyAddendum[], notices: MigrationNotice[]}} Handbacks
 */

/**
 * The step a run stopped at — a directive's id, or `checks` — carried on by
 * another live session, and the whole seconds since it was last active.
 * @typedef {{at: string, active: number}} Taken
 */

/**
 * What a run of the migrations left: the run; the directive it stopped at,
 * or the checks it stopped for before the reshape's move, this session
 * carrying the migration on, or another; or the refusal it stopped on.
 * @typedef {{migrations: BootResult['migrations']}|{directive: string}|{taken: Taken}|{checks: VerifyAddendum[]}|{refused: Refusal}} Ran
 */

/**
 * What boot's migrations left: the run, its record committed where no
 * reviewed commit will carry it; the migration waiting on its commit, with
 * the run that finished it; the directive a run stopped at, or the checks it
 * stopped for before the reshape's move, this session carrying the
 * migration on, or another; or the refusal it stopped on.
 * @typedef {{migrations: BootResult['migrations'], migrationsCommitted: string|null}|{finish: true, migrations: BootResult['migrations']}|{directive: string}|{taken: Taken}|{checks: VerifyAddendum[]}|{refused: Refusal}} Migrated
 */

/** The report of no run at all. @returns {BootResult['migrations']} */
const nothingRan = () => ({ changed: false, ran: 0, output: '', verify: [], notices: [] });

/**
 * The guard's refusal a run printed, or undefined where it printed none.
 * @param {string} stdout
 * @returns {Refusal|undefined}
 */
function refusalIn(stdout) {
  const lines = stdout.split('\n');
  const at = lines.indexOf(GUARD_REFUSED);
  return at === -1 ? undefined : JSON.parse(lines[at + 1]);
}

/**
 * The checks and notices a run handed back, lifted out of its report's
 * lines in place; an unreadable block is a warning, read as none.
 * @param {string[]} lines @param {string[]} warnings
 * @returns {Handbacks}
 */
function handbacksOf(lines, warnings) {
  const addenda = liftMarker(lines, VERIFY_MARKER, 'verification addenda', warnings);
  if (addenda !== undefined && !Array.isArray(addenda)) warnings.push('verification addenda unreadable: not an array');
  const notices = liftMarker(lines, NOTICES_MARKER, 'migration notices', warnings);
  if (notices !== undefined && !Array.isArray(notices)) warnings.push('migration notices unreadable: not an array');
  return {
    verify: /** @type {VerifyAddendum[]} */ (Array.isArray(addenda) ? addenda : []),
    notices: /** @type {MigrationNotice[]} */ (Array.isArray(notices) ? notices : []),
  };
}

/**
 * Run the migrations from the folder `from` into the state's migrations
 * record: the run, or the directive it stopped at, or the checks it stopped
 * for, or the refusal it stopped on. Its callers hold boot's lock or the
 * writer lock, so of two boots meeting a directive at once, one takes it.
 * @param {string} cwd @param {string} from @param {string[]} warnings
 * @returns {Ran}
 */
function runMigrations(cwd, from, warnings) {
  const mig = spawnSync('node', [MIGRATE_CJS, '--record', statePath(cwd, MIGRATIONS_RECORD), '--journals', statePath(cwd, MIGRATION_JOURNALS)], { cwd: from, encoding: 'utf8' });
  if (mig.error || mig.status !== 0) {
    const detail = mig.error
      ? mig.error.message
      : `exit ${mig.status}: ${(mig.stderr || mig.stdout || '').trim()}`;
    throw new Error(`migrate.cjs failed — migrations must never half-run silently (${detail})`);
  }
  const refused = refusalIn(mig.stdout || '');
  if (refused !== undefined) return { refused };
  const stopped = DIRECTIVE_MARKER.exec(mig.stdout || '');
  if (stopped !== null) return carriedOn(cwd, { directive: stopped[1] }, stopped[1]);

  const outLines = (mig.stdout || '').split('\n');
  const handbacks = handbacksOf(outLines, warnings);
  if (outLines.includes(CHECKS_MARKER)) return carriedOn(cwd, { checks: handbacks.verify }, 'checks');
  const ran = readRunReport(liftMarker(outLines, MIGRATIONS_RUN_MARKER, 'migration run report', warnings), warnings);
  const stdout = outLines.join('\n');

  return { migrations: { changed: stdout.includes(STOP_GATE_MARKER), ran, output: trimReport(stdout), ...handbacks } };
}

/**
 * A run stopped where a session carries the migration on — `stop`, at a
 * directive or for the checks before the reshape's move, its step `at`:
 * this session carries it on, its row at the migration's place stamped,
 * unless another live session holds that row — then the stop names that
 * session's step, and this one goes no further.
 * @template {{directive: string}|{checks: VerifyAddendum[]}} S
 * @param {string} cwd @param {S} stop @param {string} at
 * @returns {S|{taken: Taken}}
 */
function carriedOn(cwd, stop, at) {
  const carrier = migrationCarrier(cwd);
  if (carrier !== null) return { taken: { at, active: carrier.age_seconds } };
  beatMigrationQuietly(cwd);
  return stop;
}

/**
 * The migrations record committed where no reviewed commit will carry it:
 * the commit's short sha, null where nothing was committed.
 *
 * A migration that ran while changing no document still wrote the record,
 * and that write has no other path to a commit: with nothing to review the
 * calling skill says "up to date" and never reaches its `commit
 * --migrations`. So boot leaves the record clean whenever no reviewed commit
 * will carry it — dirt this run recorded, and dirt an earlier boot left
 * behind the same way. When the review gate does fire, its own commit takes
 * the record in with the diff the user approved and boot stays out of the
 * way. The migrations are already applied, so a commit failure is a warning.
 * @param {string} cwd @param {BootResult['migrations']} migrations @param {string[]} warnings
 * @returns {string|null}
 */
function commitRecord(cwd, migrations, warnings) {
  if (migrations.changed) return null;
  try {
    const committed = commitStateScoped(cwd, MIGRATIONS_RECORD, "chore: record Ledger's migrations");
    warnings.push(...committed.warnings);
    return committed.committed;
  } catch (err) {
    warnings.push(`migrations record commit failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * The session hooks synced while the migration is under way, written and
 * never committed (21.9.3): in the calling checkout, whose settings its
 * session's hooks are read from, and in the project's folder in the main
 * checkout, whose settings the migration's commit takes.
 * @param {string} cwd @param {string[]} warnings
 */
function syncMigrationHooks(cwd, warnings) {
  for (const folder of new Set([codeRoot(cwd), projectInMain(cwd)])) installSessionHooks(folder, false, warnings);
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
    const wanted = { session: resolveEnabled(cwd) === true, ledger: true };
    return { want: wanted, sync: syncSessionHooks(cwd, wanted) };
  });
  if (sync.error) warnings.push(`session hooks not installed: ${sync.error}`);
  if (commit && !sync.error) commitSessionHooks(cwd, want, 'chore: install Ledger session hooks', 'project settings commit failed', warnings);
  return sync.changed;
}

module.exports = { BOOT_STOPS, STOPS, boot, detectSystemConfig };
