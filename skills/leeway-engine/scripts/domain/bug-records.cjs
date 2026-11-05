'use strict';

// ---------------------------------------------------------------------------
// Domain ring: what bugfixes recorded of their bugs (17.1.6, 17.1.9), read
// alike by the bugs found after review (measures.cjs) and by the conclude
// that records them (investigation-conclude.cjs), on each bugfix's
// investigation item as its conclude kept it: `fixes`, the unit whose code
// the bug is in; `after_review`, whether that unit's review phase had ended
// when the bug was concluded; and `area`, the area of the verify setup's
// feature map it sits in — each where named.
//
// - Only units typed bugfix are read (17.1.6): one moved to another type
//   keeps no bug. A cancelled bugfix's record stands, and so does a
//   reopened investigation's until it concludes again.
// - An area is Claude's words for a part of the map, which is the product's
//   own, so two spellings of one area are one: areas are known folded for
//   case and spacing (`areaKey`), each by the spelling first recorded — the
//   earliest concluded, then by the bugfix's name.
// ---------------------------------------------------------------------------

/** @typedef {{bugfix: string, fixes: string|null, after_review: boolean, area: string|null}} BugRecord */

/** Names sorted alike wherever bugs are listed. @param {string} a @param {string} b */
const byName = (a, b) => a.localeCompare(b);

/** An area as two spellings of it are known alike: case and spacing folded. @param {string} area */
const areaKey = (area) => area.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Every bug the project's bugfixes recorded, the first concluded first.
 * @param {Array<Record<string, any>>} manifests @returns {BugRecord[]}
 */
function bugRecords(manifests) {
  return manifests.flatMap((manifest) => {
    const item = manifest.work_type === 'bugfix' ? manifest.phases?.investigation?.items?.[manifest.name] : undefined;
    if (item === undefined || (item.fixes === undefined && item.area === undefined)) return [];
    return [{ bugfix: manifest.name, fixes: item.fixes ?? null, after_review: item.after_review === true, area: item.area ?? null, at: String(item.concluded_at ?? '') }];
  }).sort((a, b) => byName(a.at, b.at) || byName(a.bugfix, b.bugfix)).map(({ at, ...record }) => record);
}

/**
 * Each area the records name, by its key, as first spelt.
 * @param {BugRecord[]} records @returns {Map<string, string>}
 */
function areaSpellings(records) {
  /** @type {Map<string, string>} */
  const spelt = new Map();
  for (const { area } of records) if (area !== null && !spelt.has(areaKey(area))) spelt.set(areaKey(area), area);
  return spelt;
}

module.exports = { byName, areaKey, bugRecords, areaSpellings };
