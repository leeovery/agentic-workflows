'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the landing record (7.2.22) — the engine's own note of each
// task's landing, so a task once recorded stays landed whatever its branch
// does after, and only a landing the person made by hand and no verb has
// recorded yet is read from git (task-landed.cjs).
//
// One record per task per repository it landed in, on the unit's manifest
// as `landings`, by the task's internal id, then the repository's folder in
// the project, `.` for the project's own (`repoName`):
//
//   {"commit": sha, "tip": sha, "first": sha, "by": "engine"|"read", "at": instant}
//
// `commit` is the commit on that repository's default branch that landed
// the task, on its first-parent line; `tip` the task's tip that landed;
// `first` the commit of its first landing, kept when a task changed after
// its landing lands again (R30), so the review's change draws its first
// landing and its last from the record alone; `by` whether a land verb
// merged it or a verb acting on the read found the person's; `at` the
// landing commit's committer time, so the same landing recorded on two
// clones writes the same record. No read decides by `at`.
//
// Written by the engine alone, never through the field surface (fields.cjs),
// under the unit's lock, and committed to the state branch at the tail of
// the verb that landed or read it (`recordLandings`), or carried by that
// verb's own commit of the unit where it makes one (`writeLandings`): a
// land verb records every task it lands, in the one operation; a verb
// acting on a task's landing records each the read found landed by hand.
// Display reads record nothing. Two clones that recorded one task in one repository differently
// keep the remote's record (state-merge-rules.cjs): either says it landed.
// ---------------------------------------------------------------------------

const { git } = require('../kernel/git.cjs');
const { LANDINGS } = require('../kernel/manifest-schema.cjs');
const { withWorkUnitLock, loadWorkUnitManifest, saveWorkUnitManifest } = require('../kernel/manifest.cjs');
const { commitStateTail } = require('./commit.cjs');
const { parseTaskId, shownTask } = require('./task-id.cjs');

/** A task's landing in one repository, as the record holds it. @typedef {{commit: string, tip: string, first: string, by: 'engine'|'read', at: string}} LandingRecord */

/**
 * A landing to record: the task by its internal id, the repository by its
 * folder (`repoName`) and its root, the commit that landed it and the tip
 * that landed, and who landed it.
 * @typedef {{id: string, repo: string, root: string, commit: string, tip: string, by: 'engine'|'read'}} Landing
 */

/**
 * The records of one repository's landings on a unit's manifest, by task.
 * @param {Record<string, any>|null} manifest @param {string} repo its folder, `.` for the project's own
 * @returns {Map<string, LandingRecord>}
 */
function recordsIn(manifest, repo) {
  const all = manifest?.[LANDINGS] ?? {};
  return new Map(Object.entries(all).flatMap(([id, byRepo]) => (byRepo?.[repo] ? [[id, /** @type {LandingRecord} */ (byRepo[repo])]] : [])));
}

/** Each commit's committer time, ISO, in the repository at `root`, in one call. @param {string} root @param {string[]} shas @returns {Map<string, string>} */
function timesOf(root, shas) {
  const lines = git(root, ['log', '--no-show-signature', '--no-walk=unsorted', '--format=%H %cI', ...new Set(shas)]).trim().split('\n').filter(Boolean);
  return new Map(lines.map((line) => {
    const [sha, at] = line.split(' ');
    return [sha, new Date(at).toISOString()];
  }));
}

/**
 * `found` written on the unit's manifest under its lock — each landing a
 * record names already, at that commit, left as it is; one of a task
 * recorded at another commit taking its place, `first` kept — for the
 * caller's own state commit of the unit to carry: whether anything was
 * written.
 * @param {string} cwd @param {string} unit @param {Landing[]} found
 * @returns {boolean}
 */
function writeLandings(cwd, unit, found) {
  if (found.length === 0) return false;
  const times = new Map([...new Set(found.map(({ root }) => root))].flatMap((root) => [...timesOf(root, found.filter((landing) => landing.root === root).map(({ commit }) => commit))].map(([sha, at]) => [`${root} ${sha}`, at])));
  return withWorkUnitLock(cwd, unit, () => {
    const manifest = loadWorkUnitManifest(cwd, unit);
    /** @type {Record<string, Record<string, LandingRecord>>} */
    const landings = { ...(manifest[LANDINGS] ?? {}) };
    let changed = false;
    for (const { id, repo, root, commit, tip, by } of found) {
      const held = landings[id]?.[repo];
      if (held?.commit === commit) continue;
      landings[id] = { ...landings[id], [repo]: { commit, tip, first: held?.first ?? commit, by, at: /** @type {string} */ (times.get(`${root} ${commit}`)) } };
      changed = true;
    }
    if (changed) saveWorkUnitManifest(cwd, unit, { ...manifest, [LANDINGS]: landings });
    return changed;
  });
}

/**
 * `found` written (`writeLandings`) and committed to the state branch, its
 * subject naming the tasks recorded: whether anything was. A commit git
 * refuses is a warning (`commitStateTail`).
 * @param {string} cwd @param {string} unit @param {Landing[]} found @param {string[]} warnings
 * @returns {boolean}
 */
function recordLandings(cwd, unit, found, warnings) {
  if (!writeLandings(cwd, unit, found)) return false;
  const shown = [...new Set(found.map(({ id }) => shownTask(parseTaskId(id))))];
  commitStateTail(cwd, [`${unit}/manifest.json`], `land(${unit}): record ${shown.join(', ')} landed`, warnings);
  return true;
}

module.exports = { recordsIn, writeLandings, recordLandings };
