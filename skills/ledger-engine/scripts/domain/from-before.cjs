'use strict';

// ---------------------------------------------------------------------------
// Domain ring: an epic's points from before — the points of a record the
// person brought from before that bear on the epic, carried at its start —
// and the shared files that bear on it.
//
// - Start this work's payload names them, an epic's alone: each point
//   (`from_before`) its id in the record, the point in a line, and the file
//   it is in; each shared file (`shared_files`) its path from the state root
//   below an asset home, on disk, what it holds in a line, and whether it is
//   kept as reference or still to read. The yes writes them once into the
//   epic's own place, `discovery/from-before.md`, the files in a section of
//   their own, whichever way the work started — the product's conversation
//   or a type call, which holds no place there and so never writes into the
//   product's logs (start-this-work.cjs).
// - The epic's discovery reads the file on every entry and after a
//   compaction (discovery-entry.cjs, position.cjs), and approve the map's
//   screen names each point no brief of the map carries — a brief carries a
//   point by citing its id (approve-map.cjs).
// ---------------------------------------------------------------------------

const fs = require('fs');
const { statePath } = require('../kernel/state-root.cjs');
const { shaped, listed, filled } = require('./staged-payload.cjs');
const { assetHome } = require('./layout.cjs');

/** The file, from the unit's folder. */
const FROM_BEFORE = 'discovery/from-before.md';

/** A point as the file writes it: its id, then the point and its file. */
const POINT = /^- (\S+?): (.+)$/;

/** The heading the shared files are written under, below the points. */
const FILES_HEADING = '## Shared files';

/** How a shared file is read: kept as reference, searched, or still to read when the talk reaches it. */
const KINDS = Object.freeze(['reference', 'to read']);

/** @typedef {{id: string, point: string, file: string}} PointFromBefore */
/** @typedef {{path: string, holds: string, kind: string}} SharedFile */
/** @typedef {{points: PointFromBefore[], files: SharedFile[]}} FromBefore */

/** Each field of `given` one line of text, `what` naming it. @param {Record<string, unknown>} given @param {string} what */
function oneLineEach(given, what) {
  for (const [field, value] of Object.entries(given)) {
    if (!filled(value) || /\n/.test(/** @type {string} */ (value))) throw new Error(`${what}'s ${field} is one line of text`);
  }
}

/**
 * The points the payload gives, checked: each `{id, point, file}`, a line
 * apiece, an id once.
 * @param {unknown} given @returns {PointFromBefore[]}
 */
function pointsFromBefore(given) {
  const points = listed(given, 'from_before').map((point, at) => {
    const fields = shaped(point, `from_before ${at + 1}`, ['id', 'point', 'file']);
    oneLineEach(fields, `from_before ${at + 1}`);
    if (/[\s:]/.test(/** @type {string} */ (fields.id))) throw new Error(`from_before ${at + 1}'s id is the record's own, as it writes it — no space or colon: got ${JSON.stringify(fields.id)}`);
    return /** @type {PointFromBefore} */ (fields);
  });
  const twice = points.find(({ id }, at) => points.findIndex((p) => p.id === id) !== at);
  if (twice !== undefined) throw new Error(`from_before names ${twice.id} twice`);
  return points;
}

/**
 * The shared files the payload gives, checked: each `{path, holds, kind}`, a
 * line apiece, its path below an asset home and on disk, named once.
 * @param {string} cwd @param {unknown} given @returns {SharedFile[]}
 */
function sharedFiles(cwd, given) {
  const files = listed(given, 'shared_files').map((file, at) => {
    const what = `shared_files ${at + 1}`;
    const fields = /** @type {SharedFile} */ (shaped(file, what, ['path', 'holds', 'kind']));
    oneLineEach(fields, what);
    if (!KINDS.includes(fields.kind)) throw new Error(`${what}'s kind is ${KINDS.map((kind) => `"${kind}"`).join(' or ')} — got ${JSON.stringify(fields.kind)}`);
    if (assetHome(fields.path) === null || !fs.existsSync(statePath(cwd, fields.path))) throw new Error(`${what}: ${fields.path} is no shared file on disk — a path from the state root, below an assets folder or a spike`);
    return fields;
  });
  const twice = files.find(({ path }, at) => files.findIndex((f) => f.path === path) !== at);
  if (twice !== undefined) throw new Error(`shared_files names ${twice.path} twice`);
  return files;
}

/** The file's text. @param {FromBefore} held @returns {string} */
function fromBeforeText({ points, files }) {
  return [
    '# From before\n',
    ...(points.length === 0 ? [] : [`\n${points.map(({ id, point, file }) => `- ${id}: ${point} (${file})\n`).join('')}`]),
    ...(files.length === 0 ? [] : [`\n${FILES_HEADING}\n\n${files.map(({ path, holds, kind }) => `- ${path} — ${holds} (${kind})\n`).join('')}`]),
  ].join('');
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
  const lines = text.split('\n');
  const files = lines.indexOf(FILES_HEADING);
  return (files === -1 ? lines : lines.slice(0, files)).flatMap((line) => {
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

module.exports = { FROM_BEFORE, pointsFromBefore, sharedFiles, fromBeforeText, fromBeforeFile, uncarried };
