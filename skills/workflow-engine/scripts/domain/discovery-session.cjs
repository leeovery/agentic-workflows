'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the epic discovery-session lifecycle — open and close.
//
// open starts a session at the log's first write (lazy creation): allocate
// the next session number from the on-disk logs, move the model-drafted log
// into place, set the active-session marker — one manifest write under the
// work-unit lock, NO commit (the session is live; the calling flow's commit
// cadence picks up the log and marker at its next natural break).
//
// close finalises the session as ONE transaction: clear the active-session
// marker, index the finalised session log into the knowledge base
// (warn-don't-block), commit scoped to the work unit with the caller's
// message (the message varies — synthesise-vs-finalise — so it arrives
// via -m).
//
// The session log's CONTENT (Exploration, Conclusion line, Topics
// Identified) is written by the model — the engine never writes prose: open
// installs a finished draft verbatim, close closes the session the marker
// names. The marker always pairs with an existing log: no marker means a
// browse-only session with nothing to close, and a marker without a log on
// disk is corrupt state — both refuse loudly with the manifest untouched.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock, ensureContainer } = require('../kernel/manifest.cjs');
const { commitScopedWithKb } = require('./commit.cjs');
const { knowledge } = require('./kb.cjs');

/**
 * The next session number: highest on-disk `session-NNN.md` plus one, `1`
 * when no log (or no sessions directory) exists yet. Disk is the source —
 * no manifest field stores the counter, so legacy manifests need nothing.
 * @param {string} sessionsDir absolute path
 * @returns {number}
 */
function nextSessionNumber(sessionsDir) {
  /** @type {string[]} */
  let files;
  try {
    files = fs.readdirSync(sessionsDir);
  } catch {
    return 1;
  }
  let max = 0;
  for (const f of files) {
    const m = f.match(/^session-(\d+)\.md$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

/**
 * @typedef {object} DiscoverySessionOpenResult
 * @property {string} work_unit
 * @property {string} session  the opened session's number string (e.g. `003`)
 * @property {string} path     the installed log's project-relative path
 */

/**
 * Open a discovery session for an epic: allocate the next session number
 * from the on-disk logs, install the model-drafted log (moved, not copied)
 * as `discovery/sessions/session-NNN.md`, and set
 * `phases.discovery.active_session` — one manifest write under the
 * work-unit lock. No commit and no knowledge-base index: the session is
 * live, and the calling flow's commit cadence picks up the log and marker
 * at its next natural break; close indexes the finalised log.
 *
 * Validation is complete before any mutation: the work unit must be an epic
 * (the sole work type with a resumable discovery session loop — single-phase
 * work gets its log at `workunit create`), no session may already be open,
 * and the draft must exist with content — a refusal leaves everything
 * pristine, the draft included.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {{sessionLogFile: string}} opts  model-drafted log content, installed verbatim
 * @returns {DiscoverySessionOpenResult}
 */
function openDiscoverySession(cwd, workUnit, { sessionLogFile }) {
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    if (manifest.work_type !== 'epic') {
      throw new Error(`discovery-session open is epic-only — "${workUnit}" is work_type "${manifest.work_type}" (single-phase work gets its session log at workunit create)`);
    }
    const phases = manifest.phases && typeof manifest.phases === 'object' ? manifest.phases : {};
    const discovery = phases.discovery && typeof phases.discovery === 'object' ? phases.discovery : {};
    const active = discovery.active_session;
    if (typeof active === 'string' && active !== '') {
      throw new Error(`a discovery session ("${active}") is already open for "${workUnit}" — close it before opening another`);
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

    const sessionsDir = path.join(cwd, '.workflows', workUnit, 'discovery', 'sessions');
    const session = String(nextSessionNumber(sessionsDir)).padStart(3, '0');
    const rel = `.workflows/${workUnit}/discovery/sessions/session-${session}.md`;

    // Log first, marker second: a failure between the two leaves a log
    // without a marker (a closed-looking session — recoverable), never a
    // marker naming a missing log (corrupt state).
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.renameSync(draftPath, path.join(cwd, rel));
    ensureContainer(ensureContainer(manifest, 'phases', 'phases'), 'discovery', 'phases.discovery').active_session = session;
    saveWorkUnitManifest(cwd, workUnit, manifest);
    return { work_unit: workUnit, session, path: rel };
  });
}

/**
 * @typedef {object} DiscoverySessionCloseResult
 * @property {string} work_unit
 * @property {string} session      the closed session's number string (e.g. `002`)
 * @property {string} session_log  the indexed log's project-relative path
 * @property {string|null} committed  short commit sha, or null when nothing was staged
 * @property {string} [note]       set when committed is null
 * @property {string[]} warnings   non-blocking failures (knowledge-base index)
 */

/**
 * Close the work unit's active discovery session: delete
 * `phases.discovery.active_session` (so resume detection on the next entry
 * sees a closed session), index the marker's session log into the knowledge
 * base (warn-don't-block), and commit scoped to the work unit with the
 * caller's message — one call covers whatever the session left dirty.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {{message: string}} opts  commit message — varies by caller
 *   (topics synthesised vs edits-only finalisation), so it arrives via -m
 * @returns {DiscoverySessionCloseResult}
 */
function closeDiscoverySession(cwd, workUnit, { message }) {
  const session = withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const phases = manifest.phases && typeof manifest.phases === 'object' ? manifest.phases : {};
    const discovery = phases.discovery && typeof phases.discovery === 'object' ? phases.discovery : {};
    const active = discovery.active_session;
    if (typeof active !== 'string' || active === '') {
      throw new Error(`no active discovery session for "${workUnit}" — phases.discovery.active_session is not set (a browse-only session never sets it; nothing to close)`);
    }
    const rel = `.workflows/${workUnit}/discovery/sessions/session-${active}.md`;
    if (!fs.existsSync(path.join(cwd, rel))) {
      throw new Error(`session log missing on disk: ${rel} — the active-session marker names a session with no log`);
    }

    delete discovery.active_session;
    saveWorkUnitManifest(cwd, workUnit, manifest);
    return { number: active, rel };
  });

  /** @type {string[]} */
  const warnings = [];
  knowledge(cwd, ['index', session.rel], `knowledge index (discovery/sessions/session-${session.number}.md)`, warnings);

  const committed = commitScopedWithKb(cwd, `.workflows/${workUnit}`, message);
  /** @type {DiscoverySessionCloseResult} */
  const result = { work_unit: workUnit, session: session.number, session_log: session.rel, committed, warnings };
  if (committed === null) result.note = 'nothing to commit';
  return result;
}

module.exports = { openDiscoverySession, closeDiscoverySession };
