'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the legacy files — what the migration kept of a file that has
// no place in Leeway's shape, at its old path under the unit's
// `assets/legacy/`, or the product's `.product/assets/legacy/` for a file
// outside any unit or of a unit retired (workunit-retire.cjs) — and the two
// ways the person sorts each: keep it, or discard it.
//
// - The read: every file below a place's legacy folder, read from disk each
//   time and never stored, the sidecars the person's tools leave beside
//   files never among them (state-worktree.cjs); an empty or absent folder
//   holds none. The start menu shows one row for every place holding any,
//   the epic's menu one for its own (projections/start-menu.cjs,
//   projections/epic-menu.cjs).
// - `asset legacy [<place>]` answers each place holding any — or the one
//   named, whatever it holds — with where the findings Claude records from
//   its files go: the unit's own level in its discovery, which every topic
//   opening in the unit reads, while the unit is in progress; the product's
//   place for a unit completed or cancelled, and for the product's own
//   files (8.12.12). Each file is answered with how many things name it —
//   the ledger's lines, the documents, the roadmap's items (follow-moves.cjs).
// - Keep moves each file named, or every file below a folder named, out of
//   `legacy/` to the same path under the place's `assets/`, a name taken
//   there suffixed `-2`, `-3` … as an import's is (import-landing.cjs), and
//   everything naming a file moved follows it (follow-moves.cjs). Discard
//   deletes each, the file kept in the state's history, rewriting nothing.
//   Every folder either empties goes with it. A path below no legacy folder
//   of the place, or naming nothing there, is refused, as is a unit the
//   project lacks; a unit completed or cancelled is sorted as any other.
// - When: under the writer lock, the ledger's lines naming a file to keep
//   carried first, so a keep refused for want of a session moves nothing;
//   then the files moved or deleted, the documents and the roadmap
//   following, and the change committed on the state branch with
//   every file rewritten (`asset({place}): {keep|discard} {path}`) — through
//   the ledger's commit where a line was carried, the knowledge base's
//   copies rendered after — held while the migration runs, as every state
//   commit is (commit.cjs).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { PRODUCT } = require('../kernel/manifest-schema.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { withStateLock, SIDECAR_NAME } = require('./state-worktree.cjs');
const { commitStateTail, noteCommitOutcome, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
const { commitLedger, carrying } = require('./ledger.cjs');
const { refreshLedgerCopies } = require('./ledger-copies.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { dedupe } = require('./import-landing.cjs');
const { PRODUCT_DIR } = require('./layout.cjs');
const { relinkDocuments, carryNamings, followSources, namings } = require('./follow-moves.cjs');

/** @typedef {'keep'|'discard'} Outcome */

/** A place holding legacy files: a unit, or the product, and how many it holds. @typedef {{place: string, count: number}} LegacyPlace */

/** The folder a place's legacy files are under, from the state root. @param {string} place */
const legacyFolder = (place) => `${place === PRODUCT ? PRODUCT_DIR : place}/assets/legacy`;

/**
 * Every file at or below `rel`, from the state root, in order, but the
 * tools' sidecars; none where nothing is there.
 * @param {string} root @param {string} rel @returns {string[]}
 */
function filesAt(root, rel) {
  const at = path.join(root, rel);
  if (!fs.existsSync(at) || SIDECAR_NAME.test(path.posix.basename(rel))) return [];
  if (!fs.statSync(at).isDirectory()) return [rel];
  return fs.readdirSync(at).sort().flatMap((name) => filesAt(root, `${rel}/${name}`));
}

/** The place's legacy files, from the state root (the header's). @param {string} root @param {string} place */
const legacyFiles = (root, place) => filesAt(root, legacyFolder(place));

/**
 * The places holding legacy files (the header's): each of `units` in its
 * order, then the product.
 * @param {string} cwd @param {string[]} units @returns {LegacyPlace[]}
 */
function legacyPlaces(cwd, units) {
  const root = stateRoot(cwd);
  return [...units, PRODUCT].map((place) => ({ place, count: legacyFiles(root, place).length })).filter(({ count }) => count > 0);
}

/** Where the findings from a place's files go (the header's). @param {string} root @param {string} place */
function findingsAt(root, place) {
  return place !== PRODUCT && manifestOf(root, place)?.status === 'in-progress' ? `${place}.discovery` : `${PRODUCT}.discovery`;
}

/**
 * `asset legacy [<place>]` (the header's): each place's files, with how
 * many things name each, and where its findings go. The place, where one is
 * named, is checked by the caller.
 * @param {string} cwd @param {string[]} places
 */
function readLegacy(cwd, places) {
  const root = stateRoot(cwd);
  /** @type {string[]} */
  const warnings = [];
  const named = namings(cwd, root, warnings);
  const read = places.map((place) => ({ place, findings_at: findingsAt(root, place), files: legacyFiles(root, place).map((file) => ({ path: file, named: named.get(file) ?? 0 })) }));
  return { places: read, ...(warnings.length > 0 ? { warnings } : {}) };
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
 * Where each file goes, out of the place's legacy folder to its path under
 * the assets, a name taken there, or by a file before it, suffixed (the
 * header's): each move, made by `moveAll`.
 * @param {string} root @param {string} place @param {string[]} files
 * @returns {[string, string][]}
 */
function planMoves(root, place, files) {
  const legacy = legacyFolder(place);
  const assets = path.posix.dirname(legacy);
  /** @type {Map<string, Set<string>>} */
  const taken = new Map();
  return files.map((from) => {
    const dir = path.posix.dirname(`${assets}/${from.slice(legacy.length + 1)}`);
    const names = taken.get(dir) ?? new Set();
    taken.set(dir, names);
    const name = dedupe(path.posix.basename(from), path.join(root, dir), names);
    names.add(name);
    return /** @type {[string, string]} */ ([from, `${dir}/${name}`]);
  });
}

/** Each move made, the folders it empties gone. @param {string} root @param {string} place @param {[string, string][]} moves */
function moveAll(root, place, moves) {
  for (const [from, to] of moves) {
    fs.mkdirSync(path.dirname(path.join(root, to)), { recursive: true });
    fs.renameSync(path.join(root, from), path.join(root, to));
    pruneEmpty(root, from, legacyFolder(place));
  }
}

/** Each file deleted (the header's). @param {string} root @param {string} place @param {string[]} files */
function discardAll(root, place, files) {
  for (const file of files) {
    fs.rmSync(path.join(root, file));
    pruneEmpty(root, file, legacyFolder(place));
  }
}

/**
 * The files kept, everything naming them followed: the ledger's lines
 * carried before anything moves, so a keep refused moves nothing. Answers
 * the moves, how many lines were carried, and the files the following
 * rewrote.
 * @param {string} cwd @param {string} root @param {string} place @param {string[]} files @param {string[]} warnings
 */
function keepAll(cwd, root, place, files, warnings) {
  const moves = planMoves(root, place, files);
  const carried = carryNamings(root, 'asset keep', moves, warnings);
  moveAll(root, place, moves);
  const documents = relinkDocuments(root, moves);
  const sources = followSources(cwd, moves);
  const rewritten = [...documents, ...(sources.length > 0 ? [PROJECT_MANIFEST_SPEC] : [])];
  return { moves, carried, rewritten, touched: [...moves.flat(), ...rewritten] };
}

/**
 * `asset keep|discard <place> <path>`: the legacy files at or below `rel`
 * sorted as `outcome` says and committed (the header's). The place is
 * checked by the caller; `rel` is a path from the state root, spelled as
 * the file system spells it.
 * @param {string} cwd @param {Outcome} outcome @param {string} place @param {string} rel
 * @returns {Record<string, unknown>}
 */
function sortLegacy(cwd, outcome, place, rel) {
  const said = `asset ${outcome}`;
  const legacy = legacyFolder(place);
  if (rel !== legacy && !rel.startsWith(`${legacy}/`)) throw new Error(`${said}: ${rel} is not among ${place}'s legacy files, which are under ${legacy}/`);
  const root = stateRoot(cwd);
  /** @type {string[]} */
  const warnings = [];
  try {
    return withStateLock(root, () => {
      const files = filesAt(root, rel);
      if (files.length === 0) throw new Error(`${said}: ${rel} names no legacy file of ${place}'s — asset legacy ${place} lists them`);
      const kept = outcome === 'keep' ? keepAll(cwd, root, place, files, warnings) : null;
      if (kept === null) discardAll(root, place, files);
      const message = `asset(${place}): ${outcome} ${rel}`;
      const commit = kept !== null && kept.carried > 0
        ? commitLedger(cwd, message, warnings, kept.touched)
        : commitStateTail(cwd, kept?.touched ?? files, message, warnings);
      if (kept !== null && kept.carried > 0) refreshLedgerCopies(cwd, warnings);
      /** @type {{note?: string} & Record<string, unknown>} */
      const result = {
        ...(kept === null ? { discarded: files } : { moved: kept.moves.map(([from, to]) => ({ from, to })), rewritten: kept.rewritten }),
        left: legacyFiles(root, place).length,
        committed: commit.committed,
      };
      noteCommitOutcome(result, commit);
      return { ...result, ...(warnings.length > 0 ? { warnings } : {}) };
    });
  } catch (err) {
    throw carrying(err, warnings);
  }
}

module.exports = { legacyFiles, legacyPlaces, readLegacy, sortLegacy };
