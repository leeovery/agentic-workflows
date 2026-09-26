'use strict';

// ---------------------------------------------------------------------------
// Domain ring: tmux session labels — an opt-in rename of the user's tmux
// session to show where the workflow session is working. Every place labels
// itself on arrival: a process skill's Step 0 applies `{original} ·
// {work-unit} · {phase} · {topic}`, a navigation skill and the bridge
// `{original} · {work-unit}`, the roadmap and the baseline `{original} ·
// roadmap` / `{original} · baseline`, and workflow-start puts the original
// back through boot's `repair`. Leaving a place is never an event: the name
// changes on arrival, and at session end, where `session cleanup` restores
// it. A resumed session gets its label back: every landed label records
// the session's position (`positions/{session_id}.json` beside the stash,
// outliving the session — cleanup leaves it), and `session resume`, a
// SessionStart hook fired on `claude --resume`, re-applies it; `repair`
// drops the calling session's own position with its own label (the start
// menu is no position) and prunes positions older than Claude Code's
// session retention. The feature is a display courtesy, never state: for
// the user who has not opted in, or outside tmux, or on any tmux error,
// every path degrades to a no-op JSON response and the label never gates a
// flow. (A bad argument from an opted-in call site still fails loudly —
// that is an authoring bug, not an environment condition.)
//
// Opt-in is the project manifest's `defaults.tmux_labels` boolean — absent
// means never asked, which is what workflow-start's one-time prompt keys on
// (boot reports it via `labelConfigStatus`); a prose-test world stamps
// `false` so a walk never labels the terminal the suite runs in.
//
// The hooks live in the project's committed `.claude/settings.json`, where
// the engine installs them (a SessionEnd hook declared in skill frontmatter
// never fires). SessionEnd carries two commands: `session cleanup`,
// present while labels are on, and `presence cleanup`, present in every
// workflow project regardless — the heartbeat sweep is infrastructure, not
// a label preference. SessionStart (matcher `resume`) carries `session
// resume` while labels are on. Recording the choice syncs the hooks
// (`recordLabelChoice`) and every boot re-syncs them (`syncSessionHooks`).
//
// The original name is stashed in the checkout's cache
// (`.workflows/.cache/.session-labels/`, keyed by tmux socket + session
// id), so no other checkout's engine ever reads a record. Re-labels across
// phases recompose from the true original instead of compounding suffixes.
// A user rename mid-flight is adopted as the new original at the next
// label; restore only ever renames a session whose current name is exactly
// a name we applied.
//
// The stash key is not stable: tmux session ids renumber when the server
// restarts, and name-restoring setups (tmux-resurrect, Portal) carry a
// still-labelled name across the restart under a new id. Every original
// lookup therefore resolves by exact applied-name match across the
// checkout's records for the socket — chained, because a record written
// against a stranded label
// carries that label inside its own `original` — and only a name matching
// no record is adopted as the user's own. Records carry their owning
// Claude process's identity (pid + start time, the presence discipline):
// a dead owner marks a label as stranded — repairable at boot and
// sweepable by any session — while a live owner's label is never stripped
// outside an explicit relabel.
// ---------------------------------------------------------------------------

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { processStartTime, ownerAlive, ownsRow } = require('../kernel/process.cjs');
const { PROJECT_IDENTITIES, VALID_PHASES } = require('../kernel/manifest-schema.cjs');
const { readProjectManifest, withProjectLock, writeProjectManifestAtomic } = require('../kernel/manifest.cjs');
const { writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { commitTailPathspec, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
const { SETTINGS_SPEC, isObject, readProjectSettings, settingsHeld, writeProjectSettings } = require('./settings.cjs');

const HOOK_ENGINE = 'node "$CLAUDE_PROJECT_DIR/.claude/skills/workflow-engine/scripts/engine.cjs"';
const SESSION_CLEANUP_COMMAND = `${HOOK_ENGINE} session cleanup`;
const SESSION_RESUME_COMMAND = `${HOOK_ENGINE} session resume`;
const PRESENCE_CLEANUP_COMMAND = `${HOOK_ENGINE} presence cleanup`;
// What makes a hook ours: the exact `engine.cjs" <verb>` form. The path
// before it and any arguments after are free, so a hook under another
// install prefix or carrying a timeout is recognised and never twinned; the
// closing quote is part of the mark, so a re-quoted command is not.
const hookMark = (/** @type {string} */ command) => command.slice(command.indexOf('engine.cjs"'));
const HOOK_MARKS = wantedByEvent({ session: true, presence: true }).flatMap((e) => e.commands.map(hookMark));

/**
 * The opt-in for this project — `defaults.tmux_labels` when it is a
 * boolean; null when never asked, or when the project manifest is absent,
 * unreadable, or carries no defaults.
 * @param {string} cwd @returns {boolean|null}
 */
function resolveEnabled(cwd) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(cwd, '.workflows', 'manifest.json'), 'utf8'));
    const v = isObject(parsed) && isObject(parsed.defaults) ? parsed.defaults.tmux_labels : undefined;
    if (typeof v === 'boolean') return v;
  } catch { /* no project manifest */ }
  return null;
}

/**
 * Record the opt-in as the project manifest's `defaults.tmux_labels`,
 * every other key preserved — under the project lock, the manifest's own
 * atomic write. A manifest that does not parse refuses loudly through the
 * kernel read: silently replacing it would drop every registered work unit.
 * @param {string} cwd @param {boolean} value
 * @returns {{tmux_labels: boolean}}
 */
function setLabelConfig(cwd, value) {
  withProjectLock(cwd, () => {
    const manifest = readProjectManifest(cwd);
    const defaults = isObject(manifest.defaults) ? manifest.defaults : {};
    manifest.defaults = { ...defaults, tmux_labels: value };
    writeProjectManifestAtomic(cwd, manifest);
  });
  return { tmux_labels: value };
}

/** The mark a hook of ours carries, or null for a foreign one. @param {unknown} hook */
function ourMark(hook) {
  if (!isObject(hook) || hook.type !== 'command' || typeof hook.command !== 'string') return null;
  return HOOK_MARKS.find((m) => hook.command.includes(m)) || null;
}

/** The marks of ours a hook group carries. @param {unknown} group */
function marksOf(group) {
  return isObject(group) && Array.isArray(group.hooks) ? group.hooks.map(ourMark).filter(Boolean) : [];
}

/**
 * What each hook event wants, by the opt-ins: SessionEnd restores the
 * name and sweeps the heartbeats; SessionStart brings a resumed session's
 * label back — its matcher has Claude Code fire it on `claude --resume`
 * alone.
 * @param {{session: boolean, presence: boolean}} want
 * @returns {{event: string, matcher?: string, commands: string[]}[]}
 */
function wantedByEvent({ session, presence }) {
  /** @param {(string|false)[]} candidates */
  const on = (candidates) => candidates.filter(/** @returns {c is string} */ (c) => typeof c === 'string');
  return [
    { event: 'SessionEnd', commands: on([session && SESSION_CLEANUP_COMMAND, presence && PRESENCE_CLEANUP_COMMAND]) },
    { event: 'SessionStart', matcher: 'resume', commands: on([session && SESSION_RESUME_COMMAND]) },
  ];
}

/**
 * One event's groups with ours reconciled to `commands`: null when the
 * marks found already make up exactly the wanted set, wherever and however
 * they sit (a recognised hook is never rewritten, never twinned, never
 * reordered); otherwise ours are stripped from every group — a group
 * emptied by that goes, one still holding foreign hooks keeps them and its
 * matcher — and the wanted set lands as one group.
 * @param {any[]} groups @param {string[]} commands @param {string} [matcher]
 * @returns {any[]|null}
 */
function reconcileEventGroups(groups, commands, matcher) {
  if (groups.flatMap(marksOf).sort().join('\n') === commands.map(hookMark).sort().join('\n')) return null;
  const kept = groups.flatMap((g) => {
    if (marksOf(g).length === 0) return [g];
    const foreign = g.hooks.filter((/** @type {unknown} */ h) => !ourMark(h));
    return foreign.length > 0 ? [{ ...g, hooks: foreign }] : [];
  });
  if (commands.length === 0) return kept;
  const hooks = commands.map((command) => ({ type: 'command', command }));
  return [...kept, matcher ? { matcher, hooks } : { hooks }];
}

/**
 * Ensure the session hooks in the project's `.claude/settings.json` match
 * the opt-ins: SessionEnd carries `session cleanup` iff `session` and
 * `presence cleanup` iff `presence`, SessionStart carries `session resume`
 * iff `session` — each event reconciled on its own, every other key
 * (permissions, other events, foreign groups and their matchers)
 * preserved, an event emptied by a removal gone. A settings file that does
 * not parse is left untouched and reported rather than thrown: neither
 * caller may fail over hook plumbing it cannot read.
 * @param {string} cwd @param {{session: boolean, presence: boolean}} want
 * @returns {import('./settings.cjs').SettingsSync}
 */
function syncSessionHooks(cwd, want) {
  if (settingsHeld()) return { changed: false };
  const read = readProjectSettings(cwd);
  if (read.error) return { changed: false, error: read.error };
  const settings = read.settings;
  const hooks = isObject(settings.hooks) ? settings.hooks : {};
  const nextHooks = { ...hooks };
  let changed = false;
  for (const { event, matcher, commands } of wantedByEvent(want)) {
    const groups = reconcileEventGroups(Array.isArray(hooks[event]) ? hooks[event] : [], commands, matcher);
    if (groups === null) continue;
    changed = true;
    if (groups.length > 0) nextHooks[event] = groups;
    else delete nextHooks[event];
  }
  if (!changed) return { changed: false };
  const next = { ...settings };
  if (Object.keys(nextHooks).length > 0) next.hooks = nextHooks;
  else delete next.hooks;
  writeProjectSettings(cwd, next);
  return { changed: true };
}

/**
 * workflow-start's one-time answer: record the opt-in, sync the session
 * hooks to match (`presence cleanup` stays whatever the answer), and commit
 * the two together, confined. The choice is recorded either way: a settings
 * file the sync could not read, or a commit git refused, comes back as a
 * warning — boot re-syncs, and the state is saved.
 * @param {string} cwd @param {boolean} value
 * @returns {{tmux_labels: boolean, warnings?: string[]}}
 */
function recordLabelChoice(cwd, value) {
  setLabelConfig(cwd, value);
  /** @type {string[]} */
  const warnings = [];
  const specs = [PROJECT_MANIFEST_SPEC];
  // Sequential with setLabelConfig's own hold, never nested: the lock is a
  // file lock, not reentrant.
  const sync = withProjectLock(cwd, () => syncSessionHooks(cwd, { session: value, presence: true }));
  if (sync.error) warnings.push(`session hooks not synced: ${sync.error}`);
  if (sync.changed) specs.push(SETTINGS_SPEC);
  commitTailPathspec(cwd, specs, 'chore: record session-label choice', warnings);
  return warnings.length > 0 ? { tmux_labels: value, warnings } : { tmux_labels: value };
}

/**
 * Boot's report for workflow-start's one-time prompt: `no-tmux` (never
 * prompt, never label), `on`/`off` (recorded on the project manifest),
 * `prompt` (in tmux and never asked).
 * @param {string} cwd
 * @returns {'no-tmux'|'on'|'off'|'prompt'}
 */
function labelConfigStatus(cwd) {
  if (!process.env.TMUX) return 'no-tmux';
  const v = resolveEnabled(cwd);
  if (v === true) return 'on';
  if (v === false) return 'off';
  return 'prompt';
}

/**
 * @param {string[]} args
 * @param {string|null} socket explicit server socket — restore runs from a
 *   SessionEnd hook whose env may lack `$TMUX`
 */
function tmux(args, socket) {
  const full = socket ? ['-S', socket, ...args] : args;
  return execFileSync('tmux', full, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).replace(/\n$/, '');
}

/**
 * The attached tmux session's identity, pinned via `$TMUX_PANE` when
 * present. Null outside tmux; throws when tmux itself errors.
 * @returns {{socket: string|null, id: string, name: string}|null}
 */
function tmuxContext() {
  const env = process.env.TMUX;
  if (!env) return null;
  const socket = env.split(',')[0] || null;
  const args = ['display-message', '-p'];
  if (process.env.TMUX_PANE) args.push('-t', process.env.TMUX_PANE);
  args.push('#{session_id}|#{session_name}');
  const out = tmux(args, socket);
  const sep = out.indexOf('|');
  if (sep === -1) return null;
  return { socket, id: out.slice(0, sep), name: out.slice(sep + 1) };
}

/** The checkout's stash store, under its gitignored cache. @param {string} cwd */
function stashDir(cwd) {
  return path.join(cwd, '.workflows', '.cache', '.session-labels');
}

/** @param {string} cwd @param {string|null} socket @param {string} tmuxId */
function stashPath(cwd, socket, tmuxId) {
  const server = crypto.createHash('sha256').update(socket || '').digest('hex').slice(0, 8);
  return path.join(stashDir(cwd), `${server}-${tmuxId.replace(/[^A-Za-z0-9_-]/g, '')}.json`);
}

/** A record written whole through the kernel's atomic write, its directory made first. @param {string} file @param {object} record */
function writeRecord(file, record) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeJsonAtomic(file, record);
}

/**
 * Where a labelled session's working position outlives it, keyed by
 * Claude session id — a subdirectory, so the stash readers that list the
 * store root never see a position as a stash.
 * @param {string} cwd
 */
function positionsDir(cwd) {
  return path.join(stashDir(cwd), 'positions');
}

/** @param {string} cwd @param {string} sessionId */
function positionPath(cwd, sessionId) {
  return path.join(positionsDir(cwd), `${sessionId.replace(/[^A-Za-z0-9_-]/g, '')}.json`);
}

/**
 * @typedef {object} LabelPosition
 * @property {string} name     work unit, or a project identity
 * @property {string} [phase]
 * @property {string} [topic]
 * @property {string} at       when the label landed — the prune's clock
 */

/**
 * Record the calling session's position behind a landed label — what
 * `session resume` re-applies. Nothing without a session id; a write that
 * fails costs nothing, the next label writes again.
 * @param {string} cwd @param {string} name @param {string} [phase] @param {string} [topic]
 */
function recordPosition(cwd, name, phase, topic) {
  const sessionId = process.env.CLAUDE_CODE_SESSION_ID;
  if (!sessionId) return;
  /** @type {LabelPosition} */
  const position = { name, phase, topic, at: new Date().toISOString() };
  try { writeRecord(positionPath(cwd, sessionId), position); } catch { /* a courtesy, never a failure */ }
}

/** @param {string} cwd @param {string} sessionId @returns {LabelPosition|null} */
function readPosition(cwd, sessionId) {
  try {
    const parsed = JSON.parse(fs.readFileSync(positionPath(cwd, sessionId), 'utf8'));
    if (isObject(parsed) && typeof parsed.name === 'string') return /** @type {LabelPosition} */ (parsed);
  } catch { /* none recorded, or unreadable */ }
  return null;
}

/** @param {string} cwd @param {string|null|undefined} sessionId */
function dropPosition(cwd, sessionId) {
  if (!sessionId) return;
  try { fs.unlinkSync(positionPath(cwd, sessionId)); } catch { /* none recorded */ }
}

// Claude Code keeps a session's transcript for 30 days by default
// (`cleanupPeriodDays`); a position older than that has nothing to resume.
const POSITION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Drop every position past the retention window — and any whose time
 * cannot be read, since age is the only way a position ever leaves.
 * @param {string} cwd
 */
function prunePositions(cwd) {
  const dir = positionsDir(cwd);
  /** @type {string[]} */
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')); } catch { return; }
  const cutoff = Date.now() - POSITION_RETENTION_MS;
  for (const f of files) {
    const file = path.join(dir, f);
    let at = NaN;
    try { at = Date.parse(JSON.parse(fs.readFileSync(file, 'utf8')).at); } catch { /* unreadable */ }
    if (!(at > cutoff)) { try { fs.unlinkSync(file); } catch { /* raced away */ } }
  }
}

/**
 * @typedef {object} LabelStash
 * @property {string} tmux_id     tmux session id at apply time (`$N` — renumbered by a server restart)
 * @property {string|null} socket server socket at apply time
 * @property {string} original    the name to restore
 * @property {string} applied     the name we set
 * @property {string|null} session_id owning conversation (CLAUDE_CODE_SESSION_ID)
 * @property {number|null} [pid]       owning Claude process (CLAUDE_PID at apply)
 * @property {string|null} [pid_start] its start time — recycled-pid guard
 */

/** Parse a stash file; null for unreadable or non-object content. @param {string} file @returns {LabelStash|null} */
function readStash(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch { /* absent or unreadable */ }
  return null;
}

/**
 * Every complete stash record, with its file path. Incomplete or
 * unreadable files are left for the sweeps to drop.
 * @param {string} cwd
 * @returns {(LabelStash & {file: string})[]}
 */
function allStashRecords(cwd) {
  /** @type {(LabelStash & {file: string})[]} */
  const records = [];
  /** @type {string[]} */
  let files = [];
  try { files = fs.readdirSync(stashDir(cwd)).filter((f) => f.endsWith('.json')).sort(); } catch { return records; }
  for (const f of files) {
    const file = path.join(stashDir(cwd), f);
    const stash = readStash(file);
    if (stash && stash.tmux_id && stash.applied && stash.original) records.push({ ...stash, file });
  }
  return records;
}

/**
 * This checkout's stash records on one socket — the chain-resolution set.
 * @param {string} cwd @param {string|null} socket
 * @returns {(LabelStash & {file: string})[]}
 */
function listStashes(cwd, socket) {
  return allStashRecords(cwd).filter((r) => (r.socket || null) === (socket || null));
}

/**
 * The true original behind a session name: a name matching a record's
 * `applied` is a label this module put there, so its `original` is one hop
 * closer to the user's own — and a record written against a stranded label
 * chains further, because that record's `original` is itself an applied
 * name. Exact match only; a name matching no record is the user's own.
 * @param {(LabelStash & {file: string})[]} records same-socket records
 * @param {string} name
 * @returns {{original: string, visited: string[]}} visited = record files the chain consumed
 */
function chainOriginal(records, name) {
  /** @type {Map<string, LabelStash & {file: string}>} */
  const byApplied = new Map();
  for (const r of records) if (!byApplied.has(r.applied)) byApplied.set(r.applied, r);
  /** @type {string[]} */
  const visited = [];
  const seen = new Set();
  let current = name;
  while (byApplied.has(current) && !seen.has(current)) {
    seen.add(current);
    const r = /** @type {LabelStash & {file: string}} */ (byApplied.get(current));
    visited.push(r.file);
    current = r.original;
  }
  return { original: current, visited };
}

/** Is the record's owning Claude process gone — the kernel's liveness rule, negated? @param {LabelStash} stash */
function ownerDead(stash) {
  return !ownerAlive(stash);
}

/**
 * Every live session on a socket. Null when the server is unreachable —
 * distinct from an empty list, because an unverifiable server proves
 * nothing about its names.
 * @param {string|null} socket
 * @returns {{id: string, name: string}[]|null}
 */
function liveSessions(socket) {
  try {
    const out = tmux(['list-sessions', '-F', '#{session_id}|#{session_name}'], socket);
    return out.split('\n').filter(Boolean).flatMap((line) => {
      const sep = line.indexOf('|');
      return sep === -1 ? [] : [{ id: line.slice(0, sep), name: line.slice(sep + 1) }];
    });
  } catch { return null; }
}

/**
 * Rename the tmux session to carry the working position: `{name}` alone
 * on arrival at a work unit's menu or a project-level place, `{name} ·
 * {phase} · {topic}` inside a phase (topic collapsed when it equals the
 * work unit). `name` is a work-unit directory, or in the name-only form a
 * project identity — `roadmap`, `baseline` — which has no directory and no
 * phase. No-op JSON when the feature is off for the project, the session
 * runs outside tmux, tmux errors, or the stash cannot be written — the
 * label never blocks a flow. Bad arguments from an enabled call site
 * throw: an authoring bug fails loudly.
 * @param {string} cwd @param {string} name @param {string} [phase] @param {string} [topic]
 */
function applySessionLabel(cwd, name, phase, topic) {
  if (resolveEnabled(cwd) !== true) return { labelled: false, reason: 'disabled' };
  if (phase !== undefined && !VALID_PHASES.includes(phase)) {
    throw new Error(`unknown phase "${phase}" — one of ${VALID_PHASES.join('|')}`);
  }
  const projectLevel = phase === undefined && PROJECT_IDENTITIES.includes(name);
  if (!projectLevel && !fs.existsSync(path.join(cwd, '.workflows', name))) {
    throw new Error(`no work unit directory: .workflows/${name}`);
  }
  /** @type {ReturnType<typeof tmuxContext>} */
  let ctx = null;
  try { ctx = tmuxContext(); } catch { /* tmux errored */ }
  if (!ctx) return { labelled: false, reason: process.env.TMUX ? 'tmux-error' : 'no-tmux' };

  const file = stashPath(cwd, ctx.socket, ctx.id);
  // Resolve the original by applied-name chain, not by the id-keyed stash
  // alone: a server restart renumbers the id, so a stranded label's record
  // sits under a key this session will never look up directly.
  const { original, visited } = chainOriginal(listStashes(cwd, ctx.socket), ctx.name);
  const position = [name, phase, topic === name ? undefined : topic].filter(Boolean).join(' · ');
  const applied = `${original} · ${position}`;
  const pid = Number(process.env.CLAUDE_PID) || null;
  // Stash before rename: a rename with no restore record strands the label,
  // while a stash whose `applied` never landed is inert (restore skips it,
  // the next label re-adopts the live name).
  /** @type {LabelStash} */
  const record = {
    tmux_id: ctx.id,
    socket: ctx.socket,
    original,
    applied,
    session_id: process.env.CLAUDE_CODE_SESSION_ID || null,
    pid,
    pid_start: pid ? processStartTime(pid) : null,
  };
  try { writeRecord(file, record); } catch { return { labelled: false, reason: 'stash-error' }; }
  if (applied !== ctx.name) {
    try { tmux(['rename-session', '-t', ctx.id, applied], ctx.socket); }
    catch { return { labelled: false, reason: 'tmux-error' }; }
  }
  // The chain's links are spent — the new id-keyed record holds the true
  // original. Only after the rename lands: a failed attempt keeps them for
  // the retry.
  for (const f of visited) {
    if (f !== file) { try { fs.unlinkSync(f); } catch { /* raced away */ } }
  }
  recordPosition(cwd, name, phase, topic);
  return { labelled: true, name: applied };
}

/**
 * Bring a resumed session's label back — `session resume`, the SessionStart
 * hook's target on `claude --resume`. The position recorded behind the
 * session's last label is re-applied through `applySessionLabel`, so the
 * gates are `label`'s own (disabled, no tmux, a tmux error all no-op), the
 * stash records the resuming process's identity, and a name already worn
 * costs no rename. A position naming a work unit or phase that no longer
 * exists is dropped: nothing to come back to. Never throws: a hook must
 * exit clean.
 * @param {string} cwd @param {string|null} sessionId
 * @returns {{resumed: boolean}}
 */
function resumeSessionLabel(cwd, sessionId) {
  if (!sessionId) return { resumed: false };
  const position = readPosition(cwd, sessionId);
  if (!position) return { resumed: false };
  try {
    return { resumed: applySessionLabel(cwd, position.name, position.phase, position.topic).labelled };
  } catch {
    dropPosition(cwd, sessionId);
    return { resumed: false };
  }
}

/**
 * Put the original tmux session name back — `session cleanup`, the
 * SessionEnd sweep over the checkout's stash store. Without a session id
 * nothing is touched (an id-less sweep could take a live peer's label —
 * the presence sweep refuses the same way). Sweeps stashes the named
 * session owns (an ownerless stash counts) plus any whose owning process
 * is dead — a stranding no other sweep would ever reach. A session is
 * renamed only when its current name is exactly the one we applied — found
 * by the stash's id or, after a server restart renumbered it, by exact
 * name across the socket's live sessions — and always back to the
 * chain-resolved true original, never a polluted intermediate. A manual
 * rename is never clobbered. A restored or inapplicable stash is dropped;
 * one whose rename failed is kept for the next sweep, as is a link a live
 * session's name still chains through — dropping it would strand that
 * session's own recomposition. Never throws: a hook must exit clean.
 * @param {string} cwd @param {string|null} sessionId
 * @returns {{restored: boolean}}
 */
function restoreSessionLabel(cwd, sessionId) {
  if (!sessionId) return { restored: false };
  const dir = stashDir(cwd);
  /** @type {string[]} */
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')); } catch { return { restored: false }; }
  let restored = false;
  /** @type {Map<string, {id: string, name: string}[]|null>} */
  const liveCache = new Map();
  const liveOn = (/** @type {string|null} */ socket) => {
    const key = socket || '';
    if (!liveCache.has(key)) liveCache.set(key, liveSessions(socket));
    return /** @type {{id: string, name: string}[]|null} */ (liveCache.get(key));
  };
  for (const f of files) {
    const p = path.join(dir, f);
    const stash = readStash(p);
    if (stash && stash.session_id && stash.session_id !== sessionId && !ownerDead(stash)) continue;
    let drop = true;
    if (stash && stash.tmux_id && stash.original && stash.applied) {
      const socket = stash.socket || null;
      /** @type {string|null} */
      let targetId = null;
      try {
        const current = tmux(['display-message', '-p', '-t', stash.tmux_id, '#{session_name}'], socket);
        if (current === stash.applied) targetId = stash.tmux_id;
      } catch { /* session gone under this id — it may live under a renumbered one */ }
      if (!targetId) {
        const live = liveOn(socket);
        const wearer = live ? live.find((s) => s.name === stash.applied) : null;
        if (wearer) targetId = wearer.id;
      }
      if (targetId) {
        const { original, visited } = chainOriginal(listStashes(cwd, socket), stash.applied);
        try {
          tmux(['rename-session', '-t', targetId, original], socket);
          restored = true;
          liveCache.delete(socket || ''); // names changed — re-list before the next protection check
          for (const v of visited) {
            if (v !== p) { try { fs.unlinkSync(v); } catch { /* raced away */ } }
          }
        } catch {
          drop = false; // transient rename failure — keep the record for the next sweep
        }
      } else {
        const live = liveOn(socket);
        if (live && live.some((s) => chainOriginal(listStashes(cwd, socket), s.name).visited.includes(p))) {
          drop = false; // a live name still chains through this record
        }
      }
    }
    if (drop) {
      try { fs.unlinkSync(p); } catch { /* raced away */ }
    }
  }
  return { restored };
}

/**
 * Boot's pass over the current terminal — workflow-start is the place
 * whose label is the original name. When the tmux session's name is a
 * name this module applied and the label is the calling session's own
 * (`ownsRow`: its session id, or its pid for a later conversation in the
 * same process) or its owner is gone — a session that never restored, a
 * restart that carried the label across — put the true original back,
 * then prune the spent and orphaned records. The calling session's own
 * position comes off with its own label — the start menu is no position —
 * while a dead owner's stays: that session may yet be resumed. Gated
 * exactly like `label` (a disabled project must never touch the terminal),
 * no-op outside tmux or on any tmux error, and a peer's label whose owning
 * process still runs is live — left alone. Prune keeps every record a live
 * session's name still chains through, touches nothing on an unreachable
 * server (an unverifiable name proves nothing). The position prune alone
 * runs ahead of the gate, whatever the opt-in: it touches only this
 * checkout's cache, and positions written while labels were on would
 * otherwise outlive the opt-out forever.
 * @param {string} cwd
 * @returns {{repaired: boolean}}
 */
function repairSessionLabels(cwd) {
  prunePositions(cwd);
  if (resolveEnabled(cwd) !== true) return { repaired: false };
  /** @type {ReturnType<typeof tmuxContext>} */
  let ctx = null;
  try { ctx = tmuxContext(); } catch { /* tmux errored */ }
  if (!ctx) return { repaired: false };
  let repaired = false;
  const records = listStashes(cwd, ctx.socket);
  const head = records.find((r) => r.applied === ctx.name);
  const own = head !== undefined && ownsRow(head);
  if (head && (own || ownerDead(head))) {
    const { original, visited } = chainOriginal(records, ctx.name);
    try {
      tmux(['rename-session', '-t', ctx.id, original], ctx.socket);
      repaired = true;
      for (const f of visited) { try { fs.unlinkSync(f); } catch { /* raced away */ } }
      if (own) dropPosition(cwd, process.env.CLAUDE_CODE_SESSION_ID);
    } catch { /* tmux errored — the records keep the repair available */ }
  }
  /** @type {Map<string, {id: string, name: string}[]|null>} */
  const liveCache = new Map();
  for (const r of allStashRecords(cwd)) {
    if (!ownerDead(r)) continue;
    const key = r.socket || '';
    if (!liveCache.has(key)) liveCache.set(key, liveSessions(r.socket || null));
    const live = liveCache.get(key);
    if (!live) continue; // server unreachable — keep, nothing is verifiable
    const sameSocket = listStashes(cwd, r.socket || null);
    const needed = live.some((s) => chainOriginal(sameSocket, s.name).visited.includes(r.file));
    if (!needed) { try { fs.unlinkSync(r.file); } catch { /* raced away */ } }
  }
  return { repaired };
}

module.exports = {
  applySessionLabel, restoreSessionLabel, repairSessionLabels, resumeSessionLabel,
  resolveEnabled, labelConfigStatus, syncSessionHooks, recordLabelChoice,
};
