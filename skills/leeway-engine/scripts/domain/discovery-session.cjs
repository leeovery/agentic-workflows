'use strict';

// ---------------------------------------------------------------------------
// Domain ring: discovery's sessions — open and close, at either of its
// places (8.1.4, 4.11.16):
//   - an epic's, its logs `{unit}/discovery/session-NNN.md`, its marker
//     `phases.discovery.active_session` on the unit's manifest, under the
//     unit's lock;
//   - the product's conversation, `product`, its logs
//     `.product/sessions/session-NNN.md`, its marker `product_session` on the
//     project manifest, under the project's lock.
//
// The entry opens one where none is open (`openSession`, enter.cjs): the
// next session number from the logs on disk, its log made empty for the
// conversation to write, and the marker set — one manifest write, no commit:
// the session is live, and every state commit takes its log along
// (state-worktree.cjs).
//
// close clears the marker and commits the place's scope with the caller's
// message — the unit's discovery scope, or the product's — the log with it.
// The knowledge base never indexes a log (8.14.7).
//
// The log's content is the conversation's — the engine never writes prose.
// The marker always pairs with a log on disk: no marker means no
// session to close, and a marker without its log refuses, the manifest
// untouched.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const {
  loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock, ensureContainer,
  readProjectManifest, writeProjectManifestAtomic, withProjectLock,
} = require('../kernel/manifest.cjs');
const { PRODUCT } = require('../kernel/manifest-schema.cjs');
const { commitStateTail, noteCommitOutcome, discoveryScope, PRODUCT_SCOPE } = require('./commit.cjs');
const { statePath } = require('../kernel/state-root.cjs');
const { PRODUCT_SESSIONS } = require('./layout.cjs');
const { namedConversations } = require('./topic-log.cjs');

const SESSION_LOG = /^session-(\d+)\.md$/;

/**
 * The session logs in a folder, by number, ascending: each one's number and
 * file name; none where the folder is not there.
 * @param {string} dir absolute
 * @returns {{number: number, file: string}[]}
 */
function sessionLogs(dir) {
  /** @type {string[]} */
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return files.flatMap((file) => {
    const m = SESSION_LOG.exec(file);
    return m === null ? [] : [{ number: parseInt(m[1], 10), file }];
  }).sort((a, b) => a.number - b.number);
}

/**
 * The highest-numbered session log in a folder, or null where there is none.
 * @param {string} dir absolute
 * @returns {{number: number, file: string}|null}
 */
function latestSessionLog(dir) {
  return sessionLogs(dir).at(-1) ?? null;
}

/**
 * The next session number: one past the highest on disk, whatever numbers
 * the logs there carry, `1` where there is none.
 * @param {string} dir absolute
 * @returns {number}
 */
function nextSessionNumber(dir) {
  const latest = latestSessionLog(dir);
  return latest === null ? 1 : latest.number + 1;
}

/** The session a marker value names, or null. @param {unknown} value @returns {string|null} */
const named = (value) => (typeof value === 'string' && value !== '' ? value : null);

/** The product's open session, as the project manifest marks it, or null. @param {Record<string, any>} project */
const productSession = (project) => named(project.product_session);

/**
 * A place's marker as read under its lock: the session it names, or null;
 * and its write — a session, or null to clear it.
 * @typedef {{active: string|null, set: (session: string|null) => void}} Marker
 */

/**
 * Where a session runs: its logs' folder, state-relative; its marker, worked
 * under its lock; its commit scope; and the retry a failed commit's note
 * names.
 * @typedef {object} SessionPlace
 * @property {string} logs
 * @property {<T>(fn: (marker: Marker, manifest: Record<string, any>) => T) => T} withMarker
 * @property {() => string[]} scope
 * @property {string} retry
 */

/** The folder a place's logs are in, state-relative. @param {string} name a work unit, or `product` */
const sessionLogsAt = (name) => (name === PRODUCT ? PRODUCT_SESSIONS : `${name}/discovery`);

/** @param {string} cwd @param {string} unit @returns {SessionPlace} */
function unitPlace(cwd, unit) {
  return {
    logs: sessionLogsAt(unit),
    withMarker: (fn) => withWorkUnitLock(cwd, unit, () => {
      const manifest = loadWorkUnitManifest(cwd, unit);
      const discovery = () => ensureContainer(ensureContainer(manifest, 'phases', 'phases'), 'discovery', 'phases.discovery');
      return fn({
        active: named(manifest.phases?.discovery?.active_session),
        set: (session) => {
          if (session === null) delete discovery().active_session;
          else discovery().active_session = session;
          saveWorkUnitManifest(cwd, unit, manifest);
        },
      }, manifest);
    }),
    scope: () => discoveryScope(cwd, unit),
    retry: `${unit} --discovery`,
  };
}

/** @param {string} cwd @returns {SessionPlace} */
function productPlace(cwd) {
  return {
    logs: sessionLogsAt(PRODUCT),
    withMarker: (fn) => withProjectLock(cwd, () => {
      const manifest = readProjectManifest(cwd);
      return fn({
        active: productSession(manifest),
        set: (session) => {
          if (session === null) delete manifest.product_session;
          else manifest.product_session = session;
          writeProjectManifestAtomic(cwd, manifest);
        },
      }, manifest);
    }),
    scope: () => [...PRODUCT_SCOPE],
    retry: '--product',
  };
}

/** The place `name` names: the product's conversation, or a unit's discovery. @param {string} cwd @param {string} name */
const sessionPlace = (cwd, name) => (name === PRODUCT ? productPlace(cwd) : unitPlace(cwd, name));

/**
 * The session a place has open, as its marker names it, or null — read
 * without the lock, as a read is.
 * @param {string} cwd @param {string} name a work unit, or `product`
 * @returns {string|null}
 */
function activeSession(cwd, name) {
  return name === PRODUCT
    ? productSession(readProjectManifest(cwd))
    : named(loadWorkUnitManifest(cwd, name).phases?.discovery?.active_session);
}

/**
 * The product's conversation as the start menu names it (18.2.13): how many
 * sessions it has had, and the date of the latest conversation its logs name
 * — null while none names one.
 * @param {string} cwd @returns {{sessions: number, last: string|null}}
 */
function productConversation(cwd) {
  const dir = statePath(cwd, PRODUCT_SESSIONS);
  const logs = sessionLogs(dir);
  for (const { file } of [...logs].reverse()) {
    const latest = namedConversations(path.join(dir, file)).at(-1);
    if (latest !== undefined) return { sessions: logs.length, last: latest.date };
  }
  return { sessions: logs.length, last: null };
}

/**
 * Install a place's next log, empty, and set the marker to it: the number
 * one past the highest on disk.
 * @param {string} cwd @param {SessionPlace} place @param {Marker} marker
 * @returns {{session: string, path: string}}
 */
function installLog(cwd, place, marker) {
  const dir = statePath(cwd, place.logs);
  const session = String(nextSessionNumber(dir)).padStart(3, '0');
  const log = path.join(dir, `session-${session}.md`);
  // Log first, marker second: a failure between the two leaves a log
  // without a marker (a closed-looking session — recoverable), never a
  // marker naming a missing log.
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(log, '');
  marker.set(session);
  return { session, path: log };
}

/**
 * Open a place's next session for a conversation entering it (enter.cjs):
 * its log made empty, the conversation's to write, and the marker set — one
 * manifest write under the place's lock. No commit: the entry's.
 * @param {string} cwd @param {string} name a work unit, or `product`
 * @returns {{session: string, path: string}}
 */
function openSession(cwd, name) {
  const place = sessionPlace(cwd, name);
  return place.withMarker((marker) => {
    // Read again under the lock: a peer's entry may have opened one since.
    if (marker.active !== null) {
      throw new Error(`a discovery session ("${marker.active}") is already open for "${name}" — close it before opening another`);
    }
    return installLog(cwd, place, marker);
  });
}

/**
 * @typedef {object} DiscoverySessionCloseResult
 * @property {string} session      the closed session's number string (e.g. `002`)
 * @property {string} session_log  the closed log's path
 * @property {string|null} committed  short commit sha, or null when nothing was staged
 * @property {string} [note]       set when committed is null
 * @property {string[]} warnings   non-blocking failures (the commit, its push)
 */

/**
 * Close a place's open session: clear the marker, then commit the place's
 * scope with the caller's message — one call covers whatever the session
 * left uncommitted. A peer session's topic files are never swept: discovery
 * runs beside live discussion sessions.
 * @param {string} cwd project root
 * @param {string} name a work unit, or `product`
 * @param {{message: string}} opts  commit message — it varies by caller, so it arrives via -m
 * @returns {DiscoverySessionCloseResult}
 */
function closeDiscoverySession(cwd, name, { message }) {
  const place = sessionPlace(cwd, name);
  const session = place.withMarker((marker) => {
    if (marker.active === null) throw new Error(`no discovery session is open for "${name}" — nothing to close`);
    const log = statePath(cwd, place.logs, `session-${marker.active}.md`);
    if (!fs.existsSync(log)) {
      throw new Error(`session log missing on disk: ${log} — the active-session marker names a session with no log`);
    }
    marker.set(null);
    return { number: marker.active, log };
  });

  /** @type {string[]} */
  const warnings = [];
  const outcome = commitStateTail(cwd, place.scope(), message, warnings);
  /** @type {DiscoverySessionCloseResult} */
  const result = { session: session.number, session_log: session.log, committed: outcome.committed, warnings };
  noteCommitOutcome(result, outcome, place.retry);
  return result;
}

module.exports = {
  openSession, closeDiscoverySession, sessionLogs, latestSessionLog, productSession,
  activeSession, sessionLogsAt, productConversation,
};
