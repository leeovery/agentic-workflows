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
// - A file is named by the ledger's lines, the documents and the roadmap's
//   items that name it, or a folder above it up to the legacy folder
//   (follow-moves.cjs).
// - `asset legacy` answers each place holding any with its folders: each
//   folder holding files, with how many, and how many of them something
//   names. `asset legacy <place>` answers the one named, whatever it holds:
//   each file with how many things name it; where the findings Claude
//   records from its files go — the unit's own level in its discovery,
//   which every topic opening in the unit reads, while the unit is in
//   progress, and the product's place for a unit completed or cancelled
//   and for the product's own files (8.12.12); and the unit's topics in
//   discussion, the ones a message from its discovery may go to.
// - Keep moves each file named, or every file below a folder named, out of
//   `legacy/` to the same path under the place's `assets/`, a name taken
//   there suffixed `-2`, `-3` … as an import's is (import-landing.cjs), and
//   everything naming a file moved, or a folder it emptied, follows it
//   (follow-moves.cjs). It answers a file's move and the documents
//   rewritten, which a finding citing the file where it went needs, or a
//   folder's count and where its files went. Discard deletes each, the
//   file kept in the state's history, rewriting nothing, and answers how
//   many. Every folder either empties goes with it. A path below no legacy
//   folder of the place, or naming nothing there, is refused, as is a unit
//   the project lacks; a unit completed or cancelled is sorted as any
//   other.
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
const { topicTitle } = require('./derivations.cjs');
const { dedupe } = require('./import-landing.cjs');
const { PRODUCT_DIR } = require('./layout.cjs');
const { relinkDocuments, carryNamings, followSources, namings } = require('./follow-moves.cjs');

/** @typedef {'keep'|'discard'} Outcome */

/** A place holding legacy files: a unit, or the product, and how many it holds. @typedef {{place: string, count: number}} LegacyPlace */

/** A legacy file, and how many things name it. @typedef {{path: string, named: number}} NamedFile */

/** The folder a place's legacy files are under, from the state root. @param {string} place */
const legacyFolder = (place) => `${place === PRODUCT ? PRODUCT_DIR : place}/assets/legacy`;

/** Where a path at or below a place's legacy folder is kept to, from the state root. @param {string} place @param {string} rel */
const keptAt = (place, rel) => path.posix.dirname(legacyFolder(place)) + rel.slice(legacyFolder(place).length);

/** Each folder above `file` up to `stop`, inclusive, the nearest first. @param {string} file @param {string} stop @returns {string[]} */
function foldersAbove(file, stop) {
  /** @type {string[]} */
  const folders = [];
  for (let dir = path.posix.dirname(file); dir === stop || dir.startsWith(`${stop}/`); dir = path.posix.dirname(dir)) folders.push(dir);
  return folders;
}

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

/** The unit's topics in discussion (the header's), by key and title. @param {string} root @param {string} place */
function inDiscussion(root, place) {
  const manifest = place === PRODUCT ? null : manifestOf(root, place);
  if (manifest?.status !== 'in-progress') return [];
  const items = Object.entries(manifest.phases?.discussion?.items ?? {});
  return items.filter(([, item]) => item?.status === 'in-progress').map(([topic]) => ({ topic, title: topicTitle(manifest, topic) }));
}

/**
 * The places' legacy files, each with how many things name it, or a folder
 * above it (the header's).
 * @param {string} cwd @param {string} root @param {string[]} places @param {string[]} warnings
 * @returns {{place: string, files: NamedFile[]}[]}
 */
function namedFiles(cwd, root, places, warnings) {
  const held = places.map((place) => ({ place, files: legacyFiles(root, place) }));
  /** @type {Map<string, string[]>} */
  const reach = new Map();
  for (const { place, files } of held) {
    for (const file of files) {
      for (const said of [file, ...foldersAbove(file, legacyFolder(place))]) reach.set(said, [...(reach.get(said) ?? []), file]);
    }
  }
  const named = namings(cwd, root, reach, warnings);
  return held.map(({ place, files }) => ({ place, files: files.map((file) => ({ path: file, named: named.get(file) ?? 0 })) }));
}

/** A place's files counted by the folder holding them, in order (the header's). @param {NamedFile[]} files */
function byFolder(files) {
  /** @type {Map<string, {path: string, count: number, named: number}>} */
  const folders = new Map();
  for (const file of files) {
    const at = path.posix.dirname(file.path);
    const folder = folders.get(at) ?? { path: at, count: 0, named: 0 };
    folder.count += 1;
    if (file.named > 0) folder.named += 1;
    folders.set(at, folder);
  }
  return [...folders.values()].sort((a, b) => (a.path < b.path ? -1 : 1));
}

/** A read's warnings, where it had any. @param {string[]} warnings */
const warned = (warnings) => (warnings.length > 0 ? { warnings } : {});

/**
 * `asset legacy` (the header's): each place holding legacy files, with its
 * folders.
 * @param {string} cwd @param {string[]} places
 */
function surveyLegacy(cwd, places) {
  /** @type {string[]} */
  const warnings = [];
  const read = namedFiles(cwd, stateRoot(cwd), places, warnings);
  return { places: read.map(({ place, files }) => ({ place, count: files.length, folders: byFolder(files) })), ...warned(warnings) };
}

/**
 * `asset legacy <place>` (the header's): the place's files, where its
 * findings go, and its topics in discussion. The place is checked by the
 * caller.
 * @param {string} cwd @param {string} place
 */
function readLegacy(cwd, place) {
  const root = stateRoot(cwd);
  /** @type {string[]} */
  const warnings = [];
  const [{ files }] = namedFiles(cwd, root, [place], warnings);
  return { place, findings_at: findingsAt(root, place), in_discussion: inDiscussion(root, place), files, ...warned(warnings) };
}

/** Each folder from `rel`'s up to `stop`, inclusive, removed while it is empty. @param {string} root @param {string} rel @param {string} stop */
function pruneEmpty(root, rel, stop) {
  for (const dir of foldersAbove(rel, stop)) {
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
  /** @type {Map<string, Set<string>>} */
  const taken = new Map();
  return files.map((from) => {
    const dir = path.posix.dirname(keptAt(place, from));
    const names = taken.get(dir) ?? new Set();
    taken.set(dir, names);
    const name = dedupe(path.posix.basename(from), path.join(root, dir), names);
    names.add(name);
    return /** @type {[string, string]} */ ([from, `${dir}/${name}`]);
  });
}

/**
 * The folders keeping `files` empties, each with the folder its files go
 * to: every folder above them, up to the legacy folder, holding no file
 * that stays.
 * @param {string} root @param {string} place @param {string[]} files
 * @returns {[string, string][]}
 */
function emptiedFolders(root, place, files) {
  const legacy = legacyFolder(place);
  const moving = new Set(files);
  const staying = legacyFiles(root, place).filter((file) => !moving.has(file));
  const folders = new Set(files.flatMap((file) => foldersAbove(file, legacy)));
  return [...folders].filter((dir) => !staying.some((file) => file.startsWith(`${dir}/`))).map((dir) => [dir, keptAt(place, dir)]);
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
 * The files kept, everything naming them or a folder they empty followed:
 * the ledger's lines carried before anything moves, so a keep refused
 * moves nothing. Answers the moves, how many lines were carried, and the
 * files the following rewrote.
 * @param {string} cwd @param {string} root @param {string} place @param {string[]} files @param {string[]} warnings
 */
function keepAll(cwd, root, place, files, warnings) {
  const moves = planMoves(root, place, files);
  const emptied = emptiedFolders(root, place, files);
  const followed = [...moves, ...emptied];
  const carried = carryNamings(root, 'asset keep', followed, warnings);
  moveAll(root, place, moves);
  const documents = relinkDocuments(root, moves, emptied);
  const sources = followSources(cwd, followed);
  const rewritten = [...documents, ...(sources.length > 0 ? [PROJECT_MANIFEST_SPEC] : [])];
  return { moves, carried, rewritten, touched: [...moves.flat(), ...rewritten] };
}

/**
 * A keep's answer (the header's): a file's move and the documents
 * rewritten, or a folder's count and where its files went.
 * @param {string} place @param {string} rel @param {string[]} files @param {{moves: [string, string][], rewritten: string[]}} kept
 */
function keptAnswer(place, rel, files, kept) {
  if (files.length > 1 || files[0] !== rel) return { kept: files.length, to: keptAt(place, rel) };
  const [[from, to]] = kept.moves;
  return { from, to, rewritten: kept.rewritten };
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
        ...(kept === null ? { discarded: files.length } : keptAnswer(place, rel, files, kept)),
        left: legacyFiles(root, place).length,
        committed: commit.committed,
      };
      noteCommitOutcome(result, commit);
      return { ...result, ...warned(warnings) };
    });
  } catch (err) {
    throw carrying(err, warnings);
  }
}

module.exports = { legacyFiles, legacyPlaces, surveyLegacy, readLegacy, sortLegacy };
