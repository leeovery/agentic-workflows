'use strict';

// ---------------------------------------------------------------------------
// Domain ring: an epic's points from before — the points of a record the
// person brought from before that bear on the epic, carried at its start.
//
// - Start this work's payload names them (`from_before`), an epic's alone:
//   each its id in the record, the point in a line, and the file it is in.
//   The yes writes them once into the epic's own place, `discovery/from-
//   before.md`, whichever way the work started — the product's
//   conversation or a type call, which holds no place there and so never
//   writes into the product's logs (start-this-work.cjs).
// - The epic's discovery reads the file on every entry and after a
//   compaction (discovery-entry.cjs, position.cjs), and approve the map's
//   screen names each point no brief of the map carries — a brief carries a
//   point by citing its id (approve-map.cjs).
// ---------------------------------------------------------------------------

const fs = require('fs');
const { statePath } = require('../kernel/state-root.cjs');
const { shaped, listed, filled } = require('./staged-payload.cjs');

/** The file, from the unit's folder. */
const FROM_BEFORE = 'discovery/from-before.md';

/** A point as the file writes it: its id, then the point and its file. */
const POINT = /^- (\S+?): (.+)$/;

/** @typedef {{id: string, point: string, file: string}} PointFromBefore */

/**
 * The points the payload gives, checked: each `{id, point, file}`, a line
 * apiece, an id once.
 * @param {unknown} given @returns {PointFromBefore[]}
 */
function pointsFromBefore(given) {
  const points = listed(given, 'from_before').map((point, at) => {
    const fields = shaped(point, `from_before ${at + 1}`, ['id', 'point', 'file']);
    for (const [field, value] of Object.entries(fields)) {
      if (!filled(value) || /\n/.test(/** @type {string} */ (value))) throw new Error(`from_before ${at + 1}'s ${field} is one line of text`);
    }
    if (/[\s:]/.test(/** @type {string} */ (fields.id))) throw new Error(`from_before ${at + 1}'s id is the record's own, as it writes it — no space or colon: got ${JSON.stringify(fields.id)}`);
    return /** @type {PointFromBefore} */ (fields);
  });
  const twice = points.find(({ id }, at) => points.findIndex((p) => p.id === id) !== at);
  if (twice !== undefined) throw new Error(`from_before names ${twice.id} twice`);
  return points;
}

/** The file's text for `points`. @param {PointFromBefore[]} points @returns {string} */
function fromBeforeText(points) {
  return `# From before\n\n${points.map(({ id, point, file }) => `- ${id}: ${point} (${file})\n`).join('')}`;
}

/** The file of a unit's points from before, absolute. @param {string} cwd @param {string} unit */
const fromBeforeFile = (cwd, unit) => statePath(cwd, unit, FROM_BEFORE);

/**
 * Each point from before the unit carries, by its id with its line; none
 * where it carries none.
 * @param {string} cwd @param {string} unit @returns {{id: string, line: string}[]}
 */
function pointsOf(cwd, unit) {
  let text;
  try {
    text = fs.readFileSync(fromBeforeFile(cwd, unit), 'utf8');
  } catch {
    return [];
  }
  return text.split('\n').flatMap((line) => {
    const id = POINT.exec(line)?.[1];
    return id === undefined ? [] : [{ id, line: line.slice(2) }];
  });
}

/** Whether `text` cites `id` as a word of its own. @param {string} text @param {string} id */
function cites(text, id) {
  return new RegExp(`(?<![\\w-])${id.replace(/[\\^$.*+?()[\]{}|/]/g, '\\$&')}(?![\\w-])`).test(text);
}

/**
 * The points from before the unit carries that none of `briefs` cites, as
 * written in the file.
 * @param {string} cwd @param {string} unit @param {string[]} briefs the briefs' texts
 * @returns {string[]}
 */
function uncarried(cwd, unit, briefs) {
  return pointsOf(cwd, unit).filter(({ id }) => !briefs.some((brief) => cites(brief, id))).map(({ line }) => line);
}

module.exports = { FROM_BEFORE, pointsFromBefore, fromBeforeText, fromBeforeFile, uncarried };
