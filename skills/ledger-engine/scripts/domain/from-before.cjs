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
//   product's logs (start-this-work.cjs). A point from before the epic's own
//   discovery meets joins them, after the last (`keepPoint`, discovery-
//   log.cjs). The engine alone writes the file.
// - The epic's discovery reads the file on every entry and after a
//   compaction (discovery-entry.cjs, position.cjs), and approve the map's
//   screen names each point nothing staged places (`uncarried`): a point is
//   placed by any text that cites its id — a brief of the map, a park's
//   summary, a direction not taken in the epic's logs, a message the epic
//   sent a topic (approve-map.cjs).
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
 * apiece, an id once; each named in a refusal as `named` says.
 * @param {unknown} given @param {(at: number) => string} [named] @returns {PointFromBefore[]}
 */
function pointsFromBefore(given, named = (at) => `from_before ${at + 1}`) {
  const points = listed(given, 'from_before').map((point, at) => {
    const fields = shaped(point, named(at), ['id', 'point', 'file']);
    oneLineEach(fields, named(at));
    if (/[\s:]/.test(/** @type {string} */ (fields.id))) throw new Error(`${named(at)}'s id is the record's own, as it writes it — no space or colon: got ${JSON.stringify(fields.id)}`);
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

/** A point as the file writes it, its bullet left off. @param {PointFromBefore} point */
const pointLine = ({ id, point, file }) => `${id}: ${point} (${file})`;

/** The file's text. @param {FromBefore} held @returns {string} */
function fromBeforeText({ points, files }) {
  return [
    '# From before\n',
    ...(points.length === 0 ? [] : [`\n${points.map((point) => `- ${pointLine(point)}\n`).join('')}`]),
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

/**
 * `text` with the point `line` written after the last point it holds, or as
 * its first, above the shared files.
 * @param {string} text @param {string} line
 */
function withPoint(text, line) {
  const lines = text.replace(/\n$/, '').split('\n');
  const files = lines.indexOf(FILES_HEADING);
  const end = files === -1 ? lines.length : files;
  const last = lines.slice(0, end).map((at) => POINT.test(at)).lastIndexOf(true);
  if (last !== -1) lines.splice(last + 1, 0, `- ${line}`);
  else if (files === -1) lines.push('', `- ${line}`);
  else lines.splice(files, 0, `- ${line}`, '');
  return `${lines.join('\n')}\n`;
}

/**
 * The point from before `given` names, `{id, point, file}`, put in the
 * unit's file after the points it holds — the file begun where it has none
 * — answering its line; refused, writing nothing, out of a point's shape or
 * where the unit carries its id already.
 * @param {string} cwd @param {string} unit @param {unknown} given @returns {string}
 */
function keepPoint(cwd, unit, given) {
  const [point] = pointsFromBefore([given], () => 'the point');
  if (pointsOf(cwd, unit).some(({ id }) => id === point.id)) throw new Error(`${unit} carries ${point.id} from before already — its line is in ${unit}/${FROM_BEFORE}`);
  const file = fromBeforeFile(cwd, unit);
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : fromBeforeText({ points: [], files: [] });
  fs.writeFileSync(file, withPoint(text, pointLine(point)));
  return pointLine(point);
}

/** Whether `text` cites `id` as a word of its own. @param {string} text @param {string} id */
function cites(text, id) {
  return new RegExp(`(?<![\\w-])${id.replace(/[\\^$.*+?()[\]{}|/]/g, '\\$&')}(?![\\w-])`).test(text);
}

/**
 * The points from before the unit carries that none of `placing` cites, as
 * written in the file.
 * @param {string} cwd @param {string} unit @param {string[]} placing the texts that place a point (the header's)
 * @returns {string[]}
 */
function uncarried(cwd, unit, placing) {
  return pointsOf(cwd, unit).filter(({ id }) => !placing.some((text) => cites(text, id))).map(({ line }) => line);
}

module.exports = { FROM_BEFORE, pointsFromBefore, sharedFiles, fromBeforeText, fromBeforeFile, keepPoint, uncarried };
