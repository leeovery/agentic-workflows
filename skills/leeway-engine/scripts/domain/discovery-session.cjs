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
// open allocates the next session number from the logs on disk, moves the
// model-drafted log into place and sets the marker — one manifest write, no
// commit: the session is live, and every state commit takes its log along
// (state-worktree.cjs).
//
// close clears the marker and commits the place's scope with the caller's
// message — the unit's discovery scope, or the product's — the log with it.
// The knowledge base never indexes a log (8.14.7).
//
// The log's content is the model's — the engine never writes prose: open
// installs a finished draft verbatim, close closes the session the marker
// names. The marker always pairs with a log on disk: no marker means no
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
 * Where a session runs: its logs' folder, state-relative; whether it takes
 * one at all, given its manifest; its marker, worked under its lock; its
 * commit scope; and the retry a failed commit's note names.
 * @typedef {object} SessionPlace
 * @property {string} logs
 * @property {(manifest: Record<string, any>) => void} opens  refuses a place that takes no session
 * @property {<T>(fn: (marker: Marker, manifest: Record<string, any>) => T) => T} withMarker
 * @property {() => string[]} scope
 * @property {string} retry
 */

/** @param {string} cwd @param {string} unit @returns {SessionPlace} */
function unitPlace(cwd, unit) {
  return {
    logs: `${unit}/discovery`,
    opens: (manifest) => {
      if (manifest.work_type !== 'epic') {
        throw new Error(`discovery-session open is epic-only — "${unit}" is work_type "${manifest.work_type}" (single-phase work gets its session log at workunit create)`);
      }
    },
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
    logs: PRODUCT_SESSIONS,
    opens: () => {},
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
 * Open a session at a place: allocate the next number from the logs on
 * disk, install the model-drafted log (moved, not copied) as
 * `session-NNN.md` in the place's logs' folder, and set the marker — one
 * manifest write under the place's lock. No commit.
 *
 * Validation is complete before any mutation: a unit must be an epic (the
 * sole work type with a resumable discovery session — single-phase work gets
 * its log at `workunit create`), no session may already be open, and the
 * draft must exist with content — a refusal leaves everything pristine, the
 * draft included.
 * @param {string} cwd project root
 * @param {string} name a work unit, or `product`
 * @param {{sessionLogFile: string}} opts  model-drafted log content, installed verbatim
 * @returns {{session: string, path: string}}
 */
function openDiscoverySession(cwd, name, { sessionLogFile }) {
  const place = sessionPlace(cwd, name);
  return place.withMarker((marker, manifest) => {
    place.opens(manifest);
    if (marker.active !== null) {
      throw new Error(`a discovery session ("${marker.active}") is already open for "${name}" — close it before opening another`);
    }
    const draftPath = path.resolve(cwd, sessionLogFile);
    /** @type {string} */
    let draft;
    try {
      draft = fs.readFileSync(draftPath, 'utf8');
    } catch {
      throw new Error(`session log draft not found: ${sessionLogFile}`);
    }
    if (draft.trim() === '') {
      throw new Error(`session log draft is empty: ${sessionLogFile} — draft the log before opening the session`);
    }

    const dir = statePath(cwd, place.logs);
    const session = String(nextSessionNumber(dir)).padStart(3, '0');
    const log = path.join(dir, `session-${session}.md`);

    // Log first, marker second: a failure between the two leaves a log
    // without a marker (a closed-looking session — recoverable), never a
    // marker naming a missing log. The install resolves any literal {NNN} to
    // the allocated number — the template's placeholder, written before the
    // number exists — so the durable header matches the filename.
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(log, draft.split('{NNN}').join(session));
    fs.unlinkSync(draftPath);
    marker.set(session);
    return { session, path: log };
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
  openDiscoverySession, closeDiscoverySession, sessionLogs, latestSessionLog, nextSessionNumber, productSession,
};
