'use strict';

// ---------------------------------------------------------------------------
// Domain ring: tmux session labels — an opt-in rename of the user's tmux
// session to show where the workflow session is working
// (`{original} · {work-unit} · {phase} · {topic}`). Applied by each process
// skill at Step 0, restored by the `session cleanup` SessionEnd hook. The
// feature is a display courtesy, never state: for the user who has not
// opted in, or outside tmux, or on any tmux error, every path degrades to
// a no-op JSON response and the label never gates a flow. (A bad argument
// from an opted-in call site still fails loudly — that is an authoring
// bug, not an environment condition.)
//
// Opt-in lives in the system config (`~/.config/workflows/config.json`)
// under `session.tmux_labels` — absent means unconfigured, which is what
// workflow-start's one-time prompt keys on (boot reports it via
// `labelConfigStatus`). A `defaults.tmux_labels` boolean in the project
// manifest overrides the system value for that project — the per-project
// off-switch, and what keeps a prose-test world from ever labelling the
// terminal the suite runs in. `WORKFLOWS_CONFIG_DIR` overrides the config
// directory for tests.
//
// The original name is stashed machine-globally (under the config dir's
// `state/session-labels/`, keyed by tmux socket + session id) because the
// resource it protects — the tmux session name — is machine-global: a
// label from any project finds the same stash, so re-labels across phases
// and projects recompose from the true original instead of compounding
// suffixes. A user rename mid-flight is adopted as the new original at the
// next label; restore only ever renames a session whose current name is
// exactly a name we applied.
//
// The stash key is not stable: tmux session ids renumber when the server
// restarts, and name-restoring setups (tmux-resurrect, Portal) carry a
// still-labelled name across the restart under a new id. Every original
// lookup therefore resolves by exact applied-name match across the socket's
// records — chained, because a record written against a stranded label
// carries that label inside its own `original` — and only a name matching
// no record is adopted as the user's own. Records carry their owning
// Claude process's identity (pid + start time, the presence discipline):
// a dead owner marks a label as stranded — repairable at boot and
// sweepable by any session — while a live owner's label is never stripped
// outside an explicit relabel.
// ---------------------------------------------------------------------------

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { processStartTime, processAlive } = require('../kernel/process.cjs');
const { VALID_PHASES } = require('../kernel/manifest-schema.cjs');

/** The system config directory — `WORKFLOWS_CONFIG_DIR` overrides for tests. */
function configDir() {
  return process.env.WORKFLOWS_CONFIG_DIR || path.join(os.homedir(), '.config', 'workflows');
}

function configPath() {
  return path.join(configDir(), 'config.json');
}

/**
 * The stored opt-in: true/false when configured, null when unconfigured
 * (absent file, absent key, or unreadable — all mean "never asked").
 * @returns {boolean|null}
 */
function readLabelConfig() {
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
    const s = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed.session : null;
    if (s && typeof s === 'object' && !Array.isArray(s) && typeof s.tmux_labels === 'boolean') return s.tmux_labels;
  } catch { /* absent or unreadable — unconfigured */ }
  return null;
}

/**
 * The project manifest's `defaults.tmux_labels`, when it is a boolean —
 * the per-project override. Null when absent or unreadable.
 * @param {string} cwd @returns {boolean|null}
 */
function readProjectOverride(cwd) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(cwd, '.workflows', 'manifest.json'), 'utf8'));
    const d = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed.defaults : null;
    if (d && typeof d === 'object' && !Array.isArray(d) && typeof d.tmux_labels === 'boolean') return d.tmux_labels;
  } catch { /* no project manifest — no override */ }
  return null;
}

/**
 * The effective opt-in for this project: the project override wins, then
 * the system value. Null means unconfigured everywhere.
 * @param {string} cwd @returns {boolean|null}
 */
function resolveEnabled(cwd) {
  const project = readProjectOverride(cwd);
  if (project !== null) return project;
  return readLabelConfig();
}

/**
 * Record the opt-in under `session.tmux_labels`, preserving every other
 * top-level key (the knowledge subsystem shares this file). An existing
 * file that does not parse is refused loudly — silently replacing it
 * would destroy the sibling subsystem's settings. Atomic pid-tagged
 * tmp-then-rename, matching the store/manifest convention.
 * @param {boolean} value
 */
function setLabelConfig(value) {
  const p = configPath();
  /** @type {Record<string, unknown>} */
  let existing = {};
  if (fs.existsSync(p)) {
    /** @type {unknown} */
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {
      throw new Error(`config file at ${p} is not valid JSON — fix or remove it before recording the session-label choice`);
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) existing = /** @type {Record<string, unknown>} */ (parsed);
  }
  const session = existing.session && typeof existing.session === 'object' && !Array.isArray(existing.session)
    ? /** @type {Record<string, unknown>} */ (existing.session)
    : {};
  const payload = { ...existing, session: { ...session, tmux_labels: value } };
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2) + '\n');
  fs.renameSync(tmp, p);
  return { tmux_labels: value };
}

/**
 * Boot's report for workflow-start's one-time prompt: `no-tmux` (never
 * prompt, never label), `on`/`off` (settled — by the project override or
 * the system value), `prompt` (in tmux and never asked anywhere).
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

// Machine-global stash home: the tmux session name is machine-global, so
// its restore record must be findable from any project.
function stashDir() {
  return path.join(configDir(), 'state', 'session-labels');
}

/** @param {string|null} socket @param {string} tmuxId */
function stashPath(socket, tmuxId) {
  const server = crypto.createHash('sha256').update(socket || '').digest('hex').slice(0, 8);
  return path.join(stashDir(), `${server}-${tmuxId.replace(/[^A-Za-z0-9_-]/g, '')}.json`);
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
 * @returns {(LabelStash & {file: string})[]}
 */
function allStashRecords() {
  /** @type {(LabelStash & {file: string})[]} */
  const records = [];
  /** @type {string[]} */
  let files = [];
  try { files = fs.readdirSync(stashDir()).filter((f) => f.endsWith('.json')).sort(); } catch { return records; }
  for (const f of files) {
    const file = path.join(stashDir(), f);
    const stash = readStash(file);
    if (stash && stash.tmux_id && stash.applied && stash.original) records.push({ ...stash, file });
  }
  return records;
}

/**
 * The complete stash records on one socket — the chain-resolution set.
 * @param {string|null} socket
 * @returns {(LabelStash & {file: string})[]}
 */
function listStashes(socket) {
  return allStashRecords().filter((r) => (r.socket || null) === (socket || null));
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

/**
 * Is the record's owning Claude process gone? Identity is pid + start time
 * (the presence discipline — a recycled pid carries a different start
 * time). A record without a pid predates owner identity and counts as
 * dead: exactly the strandings the sweeps exist to clear.
 * @param {LabelStash} stash
 */
function ownerDead(stash) {
  if (!stash.pid) return true;
  return stash.pid_start ? processStartTime(stash.pid) !== stash.pid_start : !processAlive(stash.pid);
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
 * Rename the tmux session to carry the working position. No-op JSON when
 * the feature is off (system or project), the session runs outside tmux,
 * tmux errors, or the stash cannot be written — the label never blocks a
 * flow. Bad arguments from an enabled call site throw: an authoring bug
 * fails loudly.
 * @param {string} cwd @param {string} workUnit @param {string} phase @param {string} topic
 */
function applySessionLabel(cwd, workUnit, phase, topic) {
  if (resolveEnabled(cwd) !== true) return { labelled: false, reason: 'disabled' };
  if (!VALID_PHASES.includes(phase)) {
    throw new Error(`unknown phase "${phase}" — one of ${VALID_PHASES.join('|')}`);
  }
  if (!fs.existsSync(path.join(cwd, '.workflows', workUnit))) {
    throw new Error(`no work unit directory: .workflows/${workUnit}`);
  }
  /** @type {ReturnType<typeof tmuxContext>} */
  let ctx = null;
  try { ctx = tmuxContext(); } catch { /* tmux errored */ }
  if (!ctx) return { labelled: false, reason: process.env.TMUX ? 'tmux-error' : 'no-tmux' };

  const file = stashPath(ctx.socket, ctx.id);
  // Resolve the original by applied-name chain, not by the id-keyed stash
  // alone: a server restart renumbers the id, so a stranded label's record
  // sits under a key this session will never look up directly.
  const { original, visited } = chainOriginal(listStashes(ctx.socket), ctx.name);
  const position = topic === workUnit ? `${workUnit} · ${phase}` : `${workUnit} · ${phase} · ${topic}`;
  const name = `${original} · ${position}`;
  const pid = Number(process.env.CLAUDE_PID) || null;
  // Stash before rename: a rename with no restore record strands the label,
  // while a stash whose `applied` never landed is inert (restore skips it,
  // the next label re-adopts the live name).
  /** @type {LabelStash} */
  const record = {
    tmux_id: ctx.id,
    socket: ctx.socket,
    original,
    applied: name,
    session_id: process.env.CLAUDE_CODE_SESSION_ID || null,
    pid,
    pid_start: pid ? processStartTime(pid) : null,
  };
  try {
    fs.mkdirSync(stashDir(), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(record) + '\n');
    fs.renameSync(tmp, file);
  } catch {
    return { labelled: false, reason: 'stash-error' };
  }
  if (name !== ctx.name) {
    try { tmux(['rename-session', '-t', ctx.id, name], ctx.socket); }
    catch { return { labelled: false, reason: 'tmux-error' }; }
  }
  // The chain's links are spent — the new id-keyed record holds the true
  // original. Only after the rename lands: a failed attempt keeps them for
  // the retry.
  for (const f of visited) {
    if (f !== file) { try { fs.unlinkSync(f); } catch { /* raced away */ } }
  }
  return { labelled: true, name };
}

/**
 * Put the original tmux session name back — `session cleanup`, the
 * SessionEnd sweep over the machine-global stash store. Without a session
 * id nothing is touched (an id-less sweep could take a live peer's label —
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
 * @param {string|null} sessionId
 * @returns {{restored: boolean}}
 */
function restoreSessionLabel(sessionId) {
  if (!sessionId) return { restored: false };
  const dir = stashDir();
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
        const { original, visited } = chainOriginal(listStashes(socket), stash.applied);
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
        if (live && live.some((s) => chainOriginal(listStashes(socket), s.name).visited.includes(p))) {
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
 * Boot's stranded-label detector: when the current tmux session's name is
 * a name this module applied and its owner is gone — a session that never
 * restored, a restart that carried the label across — put the true
 * original back, then prune the spent and orphaned records. Gated exactly
 * like `label` (a disabled project must never touch the terminal), no-op
 * outside tmux or on any tmux error, and a label whose owning process
 * still runs is live, not stranded — left alone. Prune keeps every record
 * a live session's name still chains through, and touches nothing on an
 * unreachable server: an unverifiable name proves nothing.
 * @param {string} cwd
 * @returns {{repaired: boolean}}
 */
function repairSessionLabels(cwd) {
  if (resolveEnabled(cwd) !== true) return { repaired: false };
  /** @type {ReturnType<typeof tmuxContext>} */
  let ctx = null;
  try { ctx = tmuxContext(); } catch { /* tmux errored */ }
  if (!ctx) return { repaired: false };
  let repaired = false;
  const records = listStashes(ctx.socket);
  const head = records.find((r) => r.applied === ctx.name);
  if (head && ownerDead(head)) {
    const { original, visited } = chainOriginal(records, ctx.name);
    try {
      tmux(['rename-session', '-t', ctx.id, original], ctx.socket);
      repaired = true;
      for (const f of visited) { try { fs.unlinkSync(f); } catch { /* raced away */ } }
    } catch { /* tmux errored — the records keep the repair available */ }
  }
  /** @type {Map<string, {id: string, name: string}[]|null>} */
  const liveCache = new Map();
  for (const r of allStashRecords()) {
    if (!ownerDead(r)) continue;
    const key = r.socket || '';
    if (!liveCache.has(key)) liveCache.set(key, liveSessions(r.socket || null));
    const live = liveCache.get(key);
    if (!live) continue; // server unreachable — keep, nothing is verifiable
    const sameSocket = listStashes(r.socket || null);
    const needed = live.some((s) => chainOriginal(sameSocket, s.name).visited.includes(r.file));
    if (!needed) { try { fs.unlinkSync(r.file); } catch { /* raced away */ } }
  }
  return { repaired };
}

module.exports = { applySessionLabel, restoreSessionLabel, repairSessionLabels, setLabelConfig, labelConfigStatus, configDir };
