'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the tmux labeller (session-label.cjs) — the label is the tmux
// session's name, `{original} · {place}`.
//
// The original name is stashed in the store (session-label-store.cjs),
// keyed by tmux socket + session id. Re-labels across phases recompose from
// the true original instead of compounding suffixes. A user rename
// mid-flight is adopted as the new original at the next label; restore only
// ever renames a session whose current name is exactly a name we applied.
//
// The stash key is not stable: tmux session ids renumber when the server
// restarts, and name-restoring setups (tmux-resurrect) carry a
// still-labelled name across the restart under a new id. Every original
// lookup therefore resolves by exact applied-name match across the
// checkout's records for the socket — chained, because a record written
// against a stranded label carries that label inside its own `original` —
// and only a name matching no record is adopted as the user's own. A dead
// owner marks a label as stranded — repairable at boot and sweepable by any
// session — while a live owner's label is never stripped outside an
// explicit relabel.
// ---------------------------------------------------------------------------

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('../kernel/spawn.cjs');
const { handedSession, processStartTime, ownsRow } = require('../kernel/process.cjs');
const { stashDir, stashName, writeRecord, putRecordBack, readStash, ownerDead } = require('./session-label-store.cjs');

/**
 * @typedef {object} TmuxSession
 * @property {string|null} socket the server's socket, from `$TMUX`
 * @property {string} id          the session id (`$N`)
 * @property {string} name        its name now
 */

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

/**
 * @param {string[]} args
 * @param {string|null} socket explicit server socket — restore runs from a
 *   SessionEnd hook whose env may lack `$TMUX`
 */
function tmux(args, socket) {
  const full = socket ? ['-S', socket, ...args] : args;
  return execFileSync('tmux', full, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).replace(/\n$/, '');
}

/** Whether the session runs inside tmux. */
function present() {
  return Boolean(process.env.TMUX);
}

/**
 * The attached tmux session's identity, pinned via `$TMUX_PANE` when
 * present. Null outside tmux; throws when tmux itself errors.
 * @returns {TmuxSession|null}
 */
function read() {
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

/** @param {string} cwd @param {string|null} socket @param {string} tmuxId */
function stashPath(cwd, socket, tmuxId) {
  const server = crypto.createHash('sha256').update(socket || '').digest('hex').slice(0, 8);
  return path.join(stashDir(cwd), `${server}-${stashName(tmuxId)}.json`);
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
    /** @type {LabelStash|null} */
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
 * Rename the session to `{original} · {place}`, the original stashed
 * first. `stash-error` where the stash cannot be written, `tmux-error` where
 * the rename fails, the record put back as it stood — the name left alone
 * either way.
 * @param {string} cwd @param {TmuxSession} ctx @param {string} place
 * @returns {import('./session-label.cjs').LabelResult}
 */
function apply(cwd, ctx, place) {
  const file = stashPath(cwd, ctx.socket, ctx.id);
  // Resolve the original by applied-name chain, not by the id-keyed stash
  // alone: a server restart renumbers the id, so a stranded label's record
  // sits under a key this session will never look up directly.
  const { original, visited } = chainOriginal(listStashes(cwd, ctx.socket), ctx.name);
  const applied = `${original} · ${place}`;
  const pid = Number(process.env.CLAUDE_PID) || null;
  // Stash before rename: a rename with no restore record strands the label.
  // Where the rename fails, the record goes back as it stood, so it never
  // names a label the session does not wear.
  /** @type {LabelStash} */
  const record = {
    tmux_id: ctx.id,
    socket: ctx.socket,
    original,
    applied,
    session_id: handedSession(),
    pid,
    pid_start: pid ? processStartTime(pid) : null,
  };
  /** @type {LabelStash|null} */
  const prior = readStash(file);
  try { writeRecord(file, record); } catch { return { labelled: false, reason: 'stash-error' }; }
  if (applied !== ctx.name) {
    try { tmux(['rename-session', '-t', ctx.id, applied], ctx.socket); }
    catch {
      putRecordBack(file, prior);
      return { labelled: false, reason: 'tmux-error' };
    }
  }
  // The chain's links are spent — the new id-keyed record holds the true
  // original. Only after the rename lands: a failed attempt keeps them for
  // the retry.
  for (const f of visited) {
    if (f !== file) { try { fs.unlinkSync(f); } catch { /* raced away */ } }
  }
  return { labelled: true, name: applied };
}

/**
 * The SessionEnd sweep over the checkout's tmux records. Sweeps stashes the
 * named session owns (an ownerless stash counts) plus any whose owning
 * process is dead — a stranding no other sweep would ever reach. A session
 * is renamed only when its current name is exactly the one we applied —
 * found by the stash's id or, after a server restart renumbered it, by
 * exact name across the socket's live sessions — and always back to the
 * chain-resolved true original, never a polluted intermediate. A manual
 * rename is never clobbered. A restored or inapplicable stash is dropped;
 * one whose rename failed is kept for the next sweep, as is a link a live
 * session's name still chains through — dropping it would strand that
 * session's own recomposition. Runs whatever the environment: the hook's
 * may lack `$TMUX`, and each record names its socket.
 * @param {string} cwd @param {string} sessionId
 * @returns {boolean} a session was renamed back
 */
function restore(cwd, sessionId) {
  /** @type {string} */
  let dir;
  /** @type {string[]} */
  let files = [];
  try {
    dir = stashDir(cwd);
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch { return false; }
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
    /** @type {LabelStash|null} */
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
  return restored;
}

/**
 * Boot's pass over this terminal's tmux session: when its name is a name
 * this module applied and the label is the calling session's own
 * (`ownsRow`: its session id, or its pid for a later conversation in the
 * same process) or its owner is gone — a session that never restored, a
 * restart that carried the label across — put the true original back, then
 * prune the spent and orphaned records. A peer's label whose owning process
 * still runs is live — left alone. Prune keeps every record a live
 * session's name still chains through, touches nothing on an unreachable
 * server (an unverifiable name proves nothing).
 * @param {string} cwd @param {TmuxSession} ctx
 * @returns {boolean} the name was put back
 */
function repair(cwd, ctx) {
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
  return repaired;
}

module.exports = { name: 'tmux', title: 'tmux', present, read, apply, restore, repair };
