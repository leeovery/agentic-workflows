'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the legacy files — what the migration kept of a file that has
// no place in Leeway's shape, at its old path under the unit's
// `assets/legacy/`, or the product's `.product/assets/legacy/` for a file
// outside any unit — and the three ways the person sorts each: bring it in,
// keep it as it is, or discard it.
//
// - The read: every file below a place's legacy folder, read from disk each
//   time and never stored; an empty or absent folder holds none. The start
//   menu shows a row for each place holding any, the epic's menu one for its
//   own (projections/start-menu.cjs, projections/epic-menu.cjs).
// - Bring and keep move each file named, or every file below a folder named,
//   out of `legacy/` to the same path under the place's `assets/`, a name
//   taken there suffixed `-2`, `-3` … as an import's is (import-landing.cjs);
//   discard deletes each, the file kept in the state's history. Every folder
//   a move empties goes with it. A path below no legacy folder of the place,
//   or naming nothing there, is refused, as is a unit the project lacks; a
//   unit completed or cancelled is sorted as any other.
// - Bring answers where the findings Claude records from the files go: the
//   unit's own level in its discovery, which every topic opening in the unit
//   reads, or the product's place, for the product's files and a unit no
//   longer live (8.12.12).
// - When: under the writer lock, the files moved or deleted and the change
//   committed on the state branch (`asset({place}): {outcome} {path}`),
//   held while the migration runs, as every state commit is (commit.cjs).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { PRODUCT } = require('../kernel/manifest-schema.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { withStateLock } = require('./state-worktree.cjs');
const { commitStateTail, noteCommitOutcome } = require('./commit.cjs');
const { liveness } = require('./ledger-units.cjs');
const { dedupe } = require('./import-landing.cjs');
const { PRODUCT_DIR } = require('./layout.cjs');

/** What each way of sorting a legacy file does, in its commit's words. */
const OUTCOMES = Object.freeze({ bring: 'bring in', keep: 'keep', discard: 'discard' });

/** @typedef {keyof typeof OUTCOMES} Outcome */

/** A place holding legacy files: a unit, or the product, and how many it holds. @typedef {{place: string, count: number}} LegacyPlace */

/** The folder a place's legacy files are under, from the state root. @param {string} owner the unit's folder, or the product's */
const legacyFolder = (owner) => `${owner}/assets/legacy`;

/** The folder a place keeps under the state root: the product's, or the unit's own. @param {string} place */
const ownerOf = (place) => (place === PRODUCT ? PRODUCT_DIR : place);

/**
 * Every file at or below `rel`, from the state root, in order; none where
 * nothing is there.
 * @param {string} root @param {string} rel @returns {string[]}
 */
function filesAt(root, rel) {
  const at = path.join(root, rel);
  if (!fs.existsSync(at)) return [];
  if (!fs.statSync(at).isDirectory()) return [rel];
  return fs.readdirSync(at).sort().flatMap((name) => filesAt(root, `${rel}/${name}`));
}

/** The place's legacy files, from the state root (the header's). @param {string} root @param {string} place */
const legacyFiles = (root, place) => filesAt(root, legacyFolder(ownerOf(place)));

/**
 * The places holding legacy files (the header's): each of `units` in its
 * order, then the product.
 * @param {string} cwd @param {string[]} units @returns {LegacyPlace[]}
 */
function legacyPlaces(cwd, units) {
  const root = stateRoot(cwd);
  return [...units, PRODUCT].map((place) => ({ place, count: legacyFiles(root, place).length })).filter(({ count }) => count > 0);
}

/** Where the findings brought in from a place's files go (the header's). @param {string} root @param {string} place */
function findingsAt(root, place) {
  return place !== PRODUCT && liveness(root)(place, null) === null ? `${place}.discovery` : `${PRODUCT}.discovery`;
}

/** Each folder from `rel`'s up to `stop`, inclusive, removed while it is empty. @param {string} root @param {string} rel @param {string} stop */
function pruneEmpty(root, rel, stop) {
  for (let dir = path.posix.dirname(rel); dir === stop || dir.startsWith(`${stop}/`); dir = path.posix.dirname(dir)) {
    const at = path.join(root, dir);
    if (!fs.existsSync(at) || fs.readdirSync(at).length > 0) return;
    fs.rmdirSync(at);
  }
}

/**
 * Each file moved out of the legacy folder to its path under the assets,
 * a name taken there suffixed (the header's).
 * @param {string} root @param {string} owner @param {string[]} files
 * @returns {{from: string, to: string}[]}
 */
function moveOut(root, owner, files) {
  const legacy = legacyFolder(owner);
  /** @type {Map<string, Set<string>>} */
  const taken = new Map();
  return files.map((from) => {
    const dir = path.posix.dirname(`${owner}/assets/${from.slice(legacy.length + 1)}`);
    const names = taken.get(dir) ?? new Set();
    taken.set(dir, names);
    const name = dedupe(path.posix.basename(from), path.join(root, dir), names);
    names.add(name);
    const to = `${dir}/${name}`;
    fs.mkdirSync(path.join(root, dir), { recursive: true });
    fs.renameSync(path.join(root, from), path.join(root, to));
    pruneEmpty(root, from, legacy);
    return { from, to };
  });
}

/** Each file deleted (the header's). @param {string} root @param {string} owner @param {string[]} files */
function discardAll(root, owner, files) {
  for (const file of files) {
    fs.rmSync(path.join(root, file));
    pruneEmpty(root, file, legacyFolder(owner));
  }
}

/**
 * `asset bring|keep|discard <place> <path>`: the legacy files at or below
 * `rel` sorted as `outcome` says and committed (the header's). The place is
 * checked by the caller; `rel` is a path from the state root, spelled as
 * the file system spells it.
 * @param {string} cwd @param {Outcome} outcome @param {string} place @param {string} rel
 * @returns {Record<string, unknown>}
 */
function sortLegacy(cwd, outcome, place, rel) {
  const said = `asset ${outcome}`;
  const owner = ownerOf(place);
  const legacy = legacyFolder(owner);
  if (rel !== legacy && !rel.startsWith(`${legacy}/`)) throw new Error(`${said}: ${rel} is not among ${place}'s legacy files, which are under ${legacy}/`);
  const root = stateRoot(cwd);
  return withStateLock(root, () => {
    const files = filesAt(root, rel);
    if (files.length === 0) throw new Error(`${said}: ${rel} names no legacy file of ${place}'s — asset legacy ${place} lists them`);
    /** @type {string[]} */
    const warnings = [];
    const moved = outcome === 'discard' ? null : moveOut(root, owner, files);
    if (moved === null) discardAll(root, owner, files);
    const touched = moved === null ? files : moved.flatMap(({ from, to }) => [from, to]);
    const commit = commitStateTail(cwd, touched, `asset(${place}): ${OUTCOMES[outcome]} ${rel}`, warnings);
    /** @type {{note?: string} & Record<string, unknown>} */
    const result = {
      ...(moved === null ? { discarded: files } : { moved }),
      ...(outcome === 'bring' ? { findings_at: findingsAt(root, place) } : {}),
      left: legacyFiles(root, place).length,
      committed: commit.committed,
    };
    noteCommitOutcome(result, commit);
    return { ...result, ...(warnings.length > 0 ? { warnings } : {}) };
  });
}

module.exports = { OUTCOMES, legacyFolder, legacyFiles, legacyPlaces, sortLegacy };
