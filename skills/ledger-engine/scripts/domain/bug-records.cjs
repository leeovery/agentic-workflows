'use strict';

// ---------------------------------------------------------------------------
// Domain ring: what bugfixes recorded of their bugs (17.1.6, 17.1.9), read
// alike by the bugs found after review (measures.cjs) and by the conclude
// that records them (investigation-conclude.cjs), on each bugfix's
// investigation item as its conclude kept it: `fixes`, the unit whose code
// the bug is in; `after_review`, whether that unit's review phase had ended
// when a conclude first named it; and `part`, the part of the verify setup's
// feature map it sits in — each where named.
//
// - Only units typed bugfix are read (17.1.6): one moved to another type
//   keeps no bug. A cancelled bugfix's record stands, and so does a
//   reopened investigation's until it concludes again.
// - A part is Claude's words for a piece of the map, which is the product's
//   own, so two spellings of one part are one: parts are known folded for
//   case and spacing (`partKey`), each by the spelling first recorded — the
//   earliest concluded, then by the bugfix's name.
// ---------------------------------------------------------------------------

/** @typedef {{bugfix: string, fixes: string|null, after_review: boolean, part: string|null}} BugRecord */

/** Names sorted alike wherever bugs are listed. @param {string} a @param {string} b */
const byName = (a, b) => a.localeCompare(b);

/** A part as two spellings of it are known alike: case and spacing folded. @param {string} part */
const partKey = (part) => part.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Every bug the project's bugfixes recorded, the first concluded first.
 * @param {Array<Record<string, any>>} manifests @returns {BugRecord[]}
 */
function bugRecords(manifests) {
  return manifests.flatMap((manifest) => {
    const item = manifest.work_type === 'bugfix' ? manifest.phases?.investigation?.items?.[manifest.name] : undefined;
    if (item === undefined || (item.fixes === undefined && item.part === undefined)) return [];
    return [{ bugfix: manifest.name, fixes: item.fixes ?? null, after_review: item.after_review === true, part: item.part ?? null, at: String(item.concluded_at ?? '') }];
  }).sort((a, b) => byName(a.at, b.at) || byName(a.bugfix, b.bugfix)).map(({ at, ...record }) => record);
}

/**
 * Each part the records name, by its key, as first spelt.
 * @param {BugRecord[]} records @returns {Map<string, string>}
 */
function partSpellings(records) {
  /** @type {Map<string, string>} */
  const spelt = new Map();
  for (const { part } of records) if (part !== null && !spelt.has(partKey(part))) spelt.set(partKey(part), part);
  return spelt;
}

module.exports = { byName, partKey, bugRecords, partSpellings };
