'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the record of the pull requests a unit's cancels closed
// (18.3.9), `closed_by_cancel` on its manifest — the engine's alone, the
// field surface refusing it (fields.cjs), and kept for good. One entry for
// each cancel, the latest last, each the host's own names for the pull
// requests it closed, by the repository's folder in the project, `.` the
// project's own.
//
// - A cancel's closes join the latest entry as each is made
//   (`recordClosed`, workunit-lifecycle.cjs), so a cancel refused part way
//   keeps what it closed, and run again records the rest beside it.
// - A reactivate opens the next cancel's entry (`nextCancel`), where the
//   latest holds any.
// - Every landing reads each entry's, in each repository
//   (`cancelClosedIn`): a pull request it takes as none while it stays
//   closed (landing.cjs), so after a reactivate the landing opens what it
//   needs anew; and a merge opens a task again first only for a unit a
//   cancel closed one of (`closedAny`). The cancel's receipt names the latest entry's
//   (`lastClosed`, receipts.cjs).
// ---------------------------------------------------------------------------

const { CLOSED_BY_CANCEL } = require('../kernel/manifest-schema.cjs');

/** One cancel's closes: the host's own names, by the repository's folder. @typedef {Record<string, string[]>} Closes */

/** The record's entries, the latest last. @param {Record<string, any>|null} manifest @returns {Closes[]} */
const entries = (manifest) => manifest?.[CLOSED_BY_CANCEL] ?? [];

/** The pull requests every cancel of the unit's closed in one repository. @param {Record<string, any>|null} manifest @param {string} repo @returns {Set<string>} */
const cancelClosedIn = (manifest, repo) => new Set(entries(manifest).flatMap((closes) => closes[repo] ?? []));

/** Whether any cancel of the unit's closed a pull request. @param {Record<string, any>|null} manifest */
const closedAny = (manifest) => entries(manifest).some((closes) => Object.keys(closes).length > 0);

/** The latest cancel's closes, none where no cancel closed any. @param {Record<string, any>|null} manifest @returns {Closes} */
const lastClosed = (manifest) => entries(manifest).at(-1) ?? {};

/**
 * A pull request the cancel closed joined to the latest entry, one made
 * where there is none. Mutates the loaded manifest.
 * @param {Record<string, any>} manifest @param {string} repo @param {string} name
 */
function recordClosed(manifest, repo, name) {
  const held = entries(manifest);
  const last = { ...lastClosed(manifest) };
  last[repo] = [...new Set([...(last[repo] ?? []), name])];
  manifest[CLOSED_BY_CANCEL] = [...held.slice(0, -1), last];
}

/** The next cancel's entry opened, where the latest holds any. Mutates the loaded manifest. @param {Record<string, any>} manifest */
function nextCancel(manifest) {
  if (Object.keys(lastClosed(manifest)).length > 0) manifest[CLOSED_BY_CANCEL] = [...entries(manifest), {}];
}

module.exports = { cancelClosedIn, closedAny, lastClosed, recordClosed, nextCancel };
