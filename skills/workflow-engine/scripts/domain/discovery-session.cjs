'use strict';

// ---------------------------------------------------------------------------
// Domain ring: discovery-session close — finalise an epic discovery session
// as ONE transaction: clear the active-session marker, index the finalised
// session log into the knowledge base (warn-don't-block), commit scoped to
// the work unit with the caller's message (the message varies —
// synthesise-vs-finalise — so it arrives via -m).
//
// The session log's CONTENT (Conclusion line, Topics Identified) is written
// by the model BEFORE this call — the engine never writes prose; this verb
// closes the session the marker names. The marker is set at the log's first
// write (lazy creation) and always pairs with an existing log: no marker
// means a browse-only session with nothing to close, and a marker without a
// log on disk is corrupt state — both refuse loudly with the manifest
// untouched.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock } = require('../kernel/manifest.cjs');
const { commitScopedWithKb } = require('./commit.cjs');
const { knowledge } = require('./kb.cjs');

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

module.exports = { closeDiscoverySession };
