'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the legacy files — what the migration kept of a file that has
// no place in Ledger's shape, at its old path under the unit's
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
// - A file is named by each ledger line, document and roadmap item that
//   names it, or a folder above it up to the legacy folder, each counted
//   once (follow-moves.cjs) — but a legacy document of the same place,
//   whose links name only what the migration kept beside it.
// - What a discard leaves dead: each thing naming a file it deletes, and
//   each naming a folder it empties of which no keep moved anything — a
//   folder some of whose files were kept, its kept folder there under the
//   assets, is followed there instead, as a keep follows a folder it
//   empties. The legacy folder itself is never so followed: the assets are
//   always there.
// - `asset legacy` answers each place holding any, with its type and status,
//   its topics in discussion, and its folders. `asset legacy <place>`
//   answers the one named, whatever it holds, with its folders and its
//   files, where the findings Claude records from its files go — the
//   unit's own level in its discovery, which every topic opening in the
//   unit reads, while the unit is in progress, and the product's place for
//   a unit completed or cancelled and for the product's own files
//   (8.12.12) — and its topics in discussion, the ones a message from its
//   discovery may go to: a unit's in progress, while it is. A folder is
//   each one holding files, with how many and how many of them something
//   names; a file, how many things name it; and in the place's read each,
//   what discarding it would leave dead.
// - Keep takes one place and path or several, across places, in one call:
//   each file a path names, or every file below a folder it names, moved
//   out of `legacy/` to the same path under its place's `assets/`, a name
//   taken there, or by a file before it, suffixed `-2`, `-3` … as an
//   import's is (import-landing.cjs), and everything naming a file moved,
//   or a folder it emptied, following it (follow-moves.cjs). One path
//   answers a file's move and the documents rewritten, which a finding
//   citing the file where it went needs, or a folder's count and where its
//   files went; several, how many files in how many places.
//   Discard deletes each file below the path, the file kept in the state's
//   history, and answers how many, rewriting nothing that names what it
//   deleted. Every folder either empties goes with it. A path below no
//   legacy folder of its place, or naming nothing there, is refused, as is
//   a unit the project lacks; a unit completed or cancelled is sorted as
//   any other.
// - When: under the writer lock, every path checked first, then the ledger's
//   lines naming what moves carried, so a call refused for want of a
//   session moves nothing; then the files moved or deleted, the documents
//   and the roadmap following, and the change committed on the state branch
//   with every file rewritten — `asset({place}): {keep|discard} {path}`, or
//   `asset: keep {n} paths in {m} places` — through the ledger's commit
//   where a line was carried, the knowledge base's copies rendered after —
//   held while the migration runs, as every state commit is (commit.cjs).
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
const { relinkDocuments, carryNamings, followSources, namers } = require('./follow-moves.cjs');

/** A place holding legacy files: a unit, or the product, and how many it holds. @typedef {{place: string, count: number}} LegacyPlace */

/** A legacy file: how many things name it, and what discarding it leaves dead where that is read. @typedef {{path: string, named: number, dead?: number}} ReadFile */

/** A place and a path within its legacy folder, from the state root. @typedef {{place: string, rel: string}} Sorted */

/** @typedef {[string, string][]} Moves */

/** The folder a place's legacy files are under, from the state root. @param {string} place */
const legacyFolder = (place) => `${place === PRODUCT ? PRODUCT_DIR : place}/assets/legacy`;

/** Where a path at or below a place's legacy folder is kept to, from the state root. @param {string} place @param {string} rel */
const keptAt = (place, rel) => path.posix.dirname(legacyFolder(place)) + rel.slice(legacyFolder(place).length);

/** Whether `rel` is `dir` or below it. @param {string} rel @param {string} dir */
const within = (rel, dir) => rel === dir || rel.startsWith(`${dir}/`);

/** Each folder above `file` up to `stop`, inclusive, the nearest first. @param {string} file @param {string} stop @returns {string[]} */
function foldersAbove(file, stop) {
  /** @type {string[]} */
  const folders = [];
  for (let dir = path.posix.dirname(file); within(dir, stop); dir = path.posix.dirname(dir)) folders.push(dir);
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

/** The place's manifest, none for the product's. @param {string} root @param {string} place */
const manifestAt = (root, place) => (place === PRODUCT ? null : manifestOf(root, place));

/** Where the findings from a place's files go (the header's). @param {string} root @param {string} place */
function findingsAt(root, place) {
  return manifestAt(root, place)?.status === 'in-progress' ? `${place}.discovery` : `${PRODUCT}.discovery`;
}

/** The place's topics in discussion (the header's), by key and title. @param {Record<string, any>|null} manifest */
function inDiscussion(manifest) {
  if (manifest?.status !== 'in-progress') return [];
  const items = Object.entries(manifest.phases?.discussion?.items ?? {});
  return items.filter(([, item]) => item?.status === 'in-progress').map(([topic]) => ({ topic, title: topicTitle(manifest, topic) }));
}

/**
 * The folders sorting `files` of a place's empties, each with the folder
 * its files go to under the assets: every folder above them, up to the
 * legacy folder, holding no file that stays.
 * @param {string[]} held the place's legacy files @param {string} place @param {string[]} files
 * @returns {Moves}
 */
function emptiedFolders(held, place, files) {
  const sorting = new Set(files);
  const staying = held.filter((file) => !sorting.has(file));
  const folders = new Set(files.flatMap((file) => foldersAbove(file, legacyFolder(place))));
  return [...folders].filter((dir) => !staying.some((file) => within(file, dir))).map((dir) => [dir, keptAt(place, dir)]);
}

/**
 * The emptied folders a keep already moved some of, whose kept folder is
 * there under the assets (the header's): those a discard follows.
 * @param {string} root @param {string} place @param {Moves} emptied
 */
function partKept(root, place, emptied) {
  return emptied.filter(([dir, to]) => dir !== legacyFolder(place) && fs.existsSync(path.join(root, to)) && fs.statSync(path.join(root, to)).isDirectory());
}

/**
 * The namers' reads of one place's files (the header's): how many things
 * name a file, and how many a discard of some of them leaves dead.
 * @param {string} root @param {string} place @param {string[]} held the place's legacy files
 * @param {import('./follow-moves.cjs').Namer[]} list @param {Map<string, number[]>} naming the namers of each path, by index
 */
function placeNamings(root, place, held, list, naming) {
  const legacy = legacyFolder(place);
  const counted = (/** @type {Iterable<string>} */ said) => new Set([...said].flatMap((rel) => naming.get(rel) ?? []).filter((i) => !within(list[i].from ?? '', legacy))).size;
  return {
    named: (/** @type {string} */ file) => counted([file, ...foldersAbove(file, legacy)]),
    dead: (/** @type {string} */ rel) => {
      const files = held.filter((file) => within(file, rel));
      const emptied = emptiedFolders(held, place, files);
      const followed = new Set(partKept(root, place, emptied).map(([dir]) => dir));
      return counted([...files, ...emptied.map(([dir]) => dir).filter((dir) => !followed.has(dir))]);
    },
  };
}

/**
 * A place's files counted by the folder holding them, in order (the
 * header's), each with what discarding it leaves dead where `dead` reads it.
 * @param {ReadFile[]} files @param {((rel: string) => number)|null} dead
 */
function byFolder(files, dead) {
  /** @type {Map<string, {path: string, count: number, named: number}>} */
  const folders = new Map();
  for (const file of files) {
    const at = path.posix.dirname(file.path);
    const folder = folders.get(at) ?? { path: at, count: 0, named: 0 };
    folder.count += 1;
    if (file.named > 0) folder.named += 1;
    folders.set(at, folder);
  }
  const sorted = [...folders.values()].sort((a, b) => (a.path < b.path ? -1 : 1));
  return dead === null ? sorted : sorted.map((folder) => ({ ...folder, dead: dead(folder.path) }));
}

/**
 * The places' reads (the header's): each one's manifest, its folders and
 * its files, with what a discard leaves dead where `withDead` says.
 * @param {string} cwd @param {string} root @param {string[]} places @param {boolean} withDead @param {string[]} warnings
 */
function readPlaces(cwd, root, places, withDead, warnings) {
  const list = namers(cwd, root, warnings);
  /** @type {Map<string, number[]>} */
  const naming = new Map();
  list.forEach(({ names }, i) => {
    for (const rel of names) naming.set(rel, [...(naming.get(rel) ?? []), i]);
  });
  return places.map((place) => {
    const held = legacyFiles(root, place);
    const { named, dead } = placeNamings(root, place, held, list, naming);
    const files = held.map((file) => ({ path: file, named: named(file), ...(withDead ? { dead: dead(file) } : {}) }));
    return { place, manifest: manifestAt(root, place), files, folders: byFolder(files, withDead ? dead : null) };
  });
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
  const read = readPlaces(cwd, stateRoot(cwd), places, false, warnings).map(({ place, manifest, files, folders }) => ({
    place,
    work_type: manifest?.work_type ?? null,
    status: manifest?.status ?? null,
    in_discussion: inDiscussion(manifest),
    count: files.length,
    folders,
  }));
  return { places: read, ...warned(warnings) };
}

/**
 * `asset legacy <place>` (the header's): the place's folders and files,
 * where its findings go, and its topics in discussion. The place is checked
 * by the caller.
 * @param {string} cwd @param {string} place
 */
function readLegacy(cwd, place) {
  const root = stateRoot(cwd);
  /** @type {string[]} */
  const warnings = [];
  const [{ manifest, files, folders }] = readPlaces(cwd, root, [place], true, warnings);
  return { place, findings_at: findingsAt(root, place), in_discussion: inDiscussion(manifest), folders, files, ...warned(warnings) };
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
 * header's).
 * @param {string} root @param {string} place @param {string[]} files
 * @returns {Moves}
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

/** Each move made, the folders it empties gone. @param {string} root @param {string} place @param {Moves} moves */
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
 * The files each of `sorted` names, checked (the header's): one entry for
 * each place, its files in order, each once.
 * @param {string} root @param {string} said @param {Sorted[]} sorted
 * @returns {{place: string, held: string[], files: string[]}[]}
 */
function namedFiles(root, said, sorted) {
  /** @type {Map<string, Set<string>>} */
  const byPlace = new Map();
  for (const { place, rel } of sorted) {
    const files = filesAt(root, rel);
    if (files.length === 0) throw new Error(`${said}: ${rel} names no legacy file of ${place}'s — asset legacy ${place} lists them`);
    byPlace.set(place, new Set([...(byPlace.get(place) ?? []), ...files]));
  }
  return [...byPlace].map(([place, files]) => {
    const held = legacyFiles(root, place);
    return { place, held, files: held.filter((file) => files.has(file)) };
  });
}

/**
 * What names `moves` and `emptied`, followed: the ledger's lines carried
 * first, so a call refused for want of a session changes nothing, then
 * `change` made, then the documents and the roadmap. Answers how many lines
 * were carried and the files the following rewrote.
 * @param {string} cwd @param {string} root @param {string} said @param {Moves} moves @param {Moves} emptied @param {() => void} change @param {string[]} warnings
 */
function following(cwd, root, said, moves, emptied, change, warnings) {
  const carried = carryNamings(root, said, moves, emptied, warnings);
  change();
  const documents = relinkDocuments(root, moves, emptied);
  const sources = followSources(cwd, moves, emptied);
  return { carried, rewritten: [...documents, ...(sources.length > 0 ? [PROJECT_MANIFEST_SPEC] : [])] };
}

/**
 * The change committed (the header's), and its answer with how many legacy
 * files still wait in `places` and the commit's outcome.
 * @param {string} cwd @param {string} root @param {string} message @param {{carried: number, rewritten: string[]}} followed
 * @param {string[]} paths the files the change moved or deleted @param {string[]} places @param {Record<string, unknown>} answer @param {string[]} warnings
 */
function committed(cwd, root, message, followed, paths, places, answer, warnings) {
  const touched = [...paths, ...followed.rewritten];
  const commit = followed.carried > 0 ? commitLedger(cwd, message, warnings, touched) : commitStateTail(cwd, touched, message, warnings);
  if (followed.carried > 0) refreshLedgerCopies(cwd, warnings);
  /** @type {{note?: string} & Record<string, unknown>} */
  const result = { ...answer, left: places.reduce((sum, place) => sum + legacyFiles(root, place).length, 0), committed: commit.committed };
  noteCommitOutcome(result, commit);
  return { ...result, ...warned(warnings) };
}

/**
 * A keep's answer (the header's): one path's file move and the documents
 * rewritten, or its folder's count and where its files went; several
 * paths', how many files in how many places.
 * @param {Sorted[]} sorted @param {string[]} kept the files the paths named @param {Moves} moves @param {string[]} rewritten
 */
function keptAnswer(sorted, kept, moves, rewritten) {
  const [{ place, rel }] = sorted;
  if (sorted.length > 1) return { kept: kept.length, places: new Set(sorted.map((one) => one.place)).size };
  if (kept.length > 1 || kept[0] !== rel) return { kept: kept.length, to: keptAt(place, rel) };
  const [[from, to]] = moves;
  return { from, to, rewritten };
}

/** The path checked to lie in its place's legacy folder (the header's). @param {string} said @param {Sorted} sorted */
function checkWithin(said, { place, rel }) {
  const legacy = legacyFolder(place);
  if (!within(rel, legacy)) throw new Error(`${said}: ${rel} is not among ${place}'s legacy files, which are under ${legacy}/`);
}

/**
 * Runs `sort` under the writer lock, the warnings it gathers carried on a
 * refusal.
 * @param {string} root @param {(warnings: string[]) => Record<string, unknown>} sort
 */
function locked(root, sort) {
  /** @type {string[]} */
  const warnings = [];
  try {
    return withStateLock(root, () => sort(warnings));
  } catch (err) {
    throw carrying(err, warnings);
  }
}

/**
 * `asset keep <place> <path> …` (the header's): every place and path
 * checked by the caller but where it lies; each `rel` a path from the state
 * root, spelled as the file system spells it.
 * @param {string} cwd @param {Sorted[]} sorted
 * @returns {Record<string, unknown>}
 */
function keepLegacy(cwd, sorted) {
  const said = 'asset keep';
  for (const one of sorted) checkWithin(said, one);
  const root = stateRoot(cwd);
  return locked(root, (warnings) => {
    const places = namedFiles(root, said, sorted).map(({ place, held, files }) => ({ place, moves: planMoves(root, place, files), emptied: emptiedFolders(held, place, files) }));
    const moves = places.flatMap((one) => one.moves);
    const followed = following(cwd, root, said, moves, places.flatMap(({ emptied }) => emptied), () => {
      for (const { place, moves: its } of places) moveAll(root, place, its);
    }, warnings);
    const [first] = sorted;
    const message = sorted.length === 1 ? `asset(${first.place}): keep ${first.rel}` : `asset: keep ${sorted.length} paths in ${places.length} places`;
    const kept = moves.map(([from]) => from);
    return committed(cwd, root, message, followed, moves.flat(), places.map(({ place }) => place), keptAnswer(sorted, kept, moves, followed.rewritten), warnings);
  });
}

/**
 * `asset discard <place> <path>` (the header's): the place checked by the
 * caller; `rel` as `keepLegacy` takes it. What names a folder it empties
 * that a keep moved some of follows it to its kept folder; what names a
 * file it deletes is left as it is.
 * @param {string} cwd @param {string} place @param {string} rel
 * @returns {Record<string, unknown>}
 */
function discardLegacy(cwd, place, rel) {
  const said = 'asset discard';
  checkWithin(said, { place, rel });
  const root = stateRoot(cwd);
  return locked(root, (warnings) => {
    const [{ held, files }] = namedFiles(root, said, [{ place, rel }]);
    const emptied = partKept(root, place, emptiedFolders(held, place, files));
    const followed = following(cwd, root, said, [], emptied, () => discardAll(root, place, files), warnings);
    return committed(cwd, root, `asset(${place}): discard ${rel}`, followed, files, [place], { discarded: files.length }, warnings);
  });
}

module.exports = { legacyFiles, legacyPlaces, surveyLegacy, readLegacy, keepLegacy, discardLegacy };
