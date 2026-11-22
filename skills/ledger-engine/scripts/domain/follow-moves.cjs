'use strict';

// ---------------------------------------------------------------------------
// Domain ring: what in the state names a file, followed when files move,
// and counted for a file about to go. Three things name a file:
//
// - the ledger's lines — an entry's citations and an asset link's path, as
//   every read takes them (ledger-rehomed.cjs) — followed by a `rehomed`
//   line for each place the lines naming a moved file are read at, which
//   carries them to that same place, each moved file at its new path;
// - every markdown document's relative links and embeds, rebased
//   (markdown-links.cjs), a document that moved itself rebased from where it
//   was: every `.md` file in the state but under `.git`, `.cache` and
//   `.knowledge`;
// - the roadmap's sources.
//
// Moves are `[from, to]` pairs from the state root, a folder's covering what
// is below it (`landingOf`), so a link, a citation or a source naming the
// folder, or anything below it, follows it, a folder's trailing slash kept.
// An emptied folder — one whose files went to one new folder, though it
// was emptied rather than moved — is followed by what names it alone, never
// by what names a path below it the moves did not take, and only a
// document that itself moved is rebased from where it was. The caller holds
// the writer lock, makes the moves before following them, and commits what
// each answers.
//
// The namers are each ledger line, document and roadmap item with the
// paths it names, a folder's without its trailing slash, read in one pass
// over each, for the caller to count (legacy-files.cjs).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { readProjectManifest, writeProjectManifestAtomic, withProjectLock } = require('../kernel/manifest.cjs');
const { writeTextAtomic } = require('../kernel/manifest-io.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { appendEntries } = require('./ledger.cjs');
const { foldLedger } = require('./ledger-fold.cjs');
const { newId } = require('./ledger-ids.cjs');
const { roadmapItems } = require('./derivations.cjs');
const { landingOf } = require('./roadmap.cjs');
const { rebaseLinks } = require('./markdown-links.cjs');

/** @typedef {[string, string][]} Moves */

/** The state's top folders holding no document of Ledger's. */
const NO_DOCUMENTS = Object.freeze(['.git', '.cache', '.knowledge']);

/** Every markdown document in the state, from its root (the header's). @param {string} root @param {string} [from] @returns {string[]} */
function documents(root, from = '') {
  return fs.readdirSync(path.join(root, from), { withFileTypes: true }).flatMap((entry) => {
    const rel = from === '' ? entry.name : `${from}/${entry.name}`;
    if (entry.isDirectory()) return from === '' && NO_DOCUMENTS.includes(entry.name) ? [] : documents(root, rel);
    return entry.isFile() && entry.name.endsWith('.md') ? [rel] : [];
  });
}

/** The files a document's relative links name, from the state root. @param {string} root @param {string} doc @returns {Set<string>} */
function linkedFrom(root, doc) {
  /** @type {Set<string>} */
  const named = new Set();
  const dir = path.posix.dirname(doc);
  rebaseLinks(fs.readFileSync(path.join(root, doc), 'utf8'), dir, dir, (file) => {
    named.add(file);
    return file;
  });
  return named;
}

/**
 * Where `file` went: its move's landing, or an emptied folder's own, its
 * trailing slash kept; null where nothing took it.
 * @param {string} file @param {Moves} moves @param {Moves} emptied
 */
function landing(file, moves, emptied) {
  const bare = file.replace(/\/+$/, '');
  const folder = emptied.find(([from]) => from === bare);
  return landingOf(file, moves) ?? (folder === undefined ? null : folder[1] + file.slice(bare.length));
}

/** The files a ledger line names, as every read takes it. @param {Record<string, unknown>} event @returns {string[]} */
function namedBy(event) {
  const cited = Array.isArray(event.cites) ? event.cites.map((/** @type {{path: string}} */ cite) => cite.path) : [];
  return event.event === 'asset' ? [...cited, /** @type {string} */ (event.path)] : cited;
}

/**
 * Every document's links rebased to follow `moves`, and the folders
 * `emptied` into new ones (the header's): the documents rewritten, from the
 * state root.
 * @param {string} root @param {Moves} moves @param {Moves} [emptied] @returns {string[]}
 */
function relinkDocuments(root, moves, emptied = []) {
  const follow = (/** @type {string} */ file) => landing(file, moves, emptied) ?? file;
  /** @type {Moves} */
  const back = moves.map(([from, to]) => [to, from]);
  return documents(root).filter((doc) => {
    const file = path.join(root, doc);
    const text = fs.readFileSync(file, 'utf8');
    const rebased = rebaseLinks(text, path.posix.dirname(landingOf(doc, back) ?? doc), path.posix.dirname(doc), follow);
    if (rebased === text) return false;
    writeTextAtomic(file, rebased);
    return true;
  });
}

/**
 * The ledger's lines naming a file `moves` moved, or a folder `emptied`
 * emptied, each carried to the place it is read at, the files at their new
 * paths (the header's), in one write: how many lines. Refused, in the
 * words of `said`, where there are any and no session to tag the carries
 * with.
 * @param {string} root @param {string} said @param {Moves} moves @param {Moves} emptied @param {string[]} warnings
 */
function carryNamings(root, said, moves, emptied, warnings) {
  const groups = foldLedger(root, {
    start: () => /** @type {Map<string, {unit: string, topic: string|null, phase: string, ids: string[], files: Set<string>}>} */ (new Map()),
    step: (found, event) => {
      if (event.event === 'rehomed') return;
      const moved = namedBy(event).filter((file) => landing(file, moves, emptied) !== null);
      if (moved.length === 0) return;
      const topic = typeof event.topic === 'string' ? event.topic : null;
      const key = JSON.stringify([event.unit, topic, event.phase]);
      const group = found.get(key) ?? { unit: /** @type {string} */ (event.unit), topic, phase: /** @type {string} */ (event.phase), ids: [], files: new Set() };
      group.ids.push(/** @type {string} */ (event.id));
      for (const file of moved) group.files.add(file);
      found.set(key, group);
    },
  }, warnings);
  if (groups.size === 0) return 0;
  const session = handedSession();
  if (session === null) throw new Error(`${said}: ledger entries name what moves, and their carry is tagged with this conversation — Claude Code hands every command it runs a session id, and this one has none`);
  appendEntries(root, [...groups.values()].map(({ unit, topic, phase, ids, files }) => ({
    fields: { event: 'rehomed', unit, topic, phase, session, lines: ids, files: [...files].map((file) => [file, landing(file, moves, emptied)]) },
    id: newId(),
  })), warnings);
  return [...groups.values()].reduce((sum, { ids }) => sum + ids.length, 0);
}

/**
 * The roadmap's sources following `moves` and `emptied`, written where any
 * did: those rewritten.
 * @param {string} cwd @param {Moves} moves @param {Moves} emptied
 */
function followSources(cwd, moves, emptied) {
  return withProjectLock(cwd, () => {
    const project = readProjectManifest(cwd);
    /** @type {{item: string, from: string, to: string}[]} */
    const rewritten = [];
    for (const [name, item] of Object.entries(roadmapItems(project))) {
      if (!Array.isArray(item?.sources)) continue;
      item.sources = item.sources.map((/** @type {unknown} */ source) => {
        const to = typeof source === 'string' ? landing(source, moves, emptied) : null;
        if (to === null) return source;
        rewritten.push({ item: name, from: /** @type {string} */ (source), to });
        return to;
      });
    }
    if (rewritten.length > 0) writeProjectManifestAtomic(cwd, project);
    return rewritten;
  });
}

/** A thing naming paths (the header's): the document it is, where it is one. @typedef {{from: string|null, names: Set<string>}} Namer */

/**
 * Every namer in the state (the header's).
 * @param {string} cwd @param {string} root @param {string[]} warnings
 * @returns {Namer[]}
 */
function namers(cwd, root, warnings) {
  /** @type {Namer[]} */
  const found = [];
  const add = (/** @type {string|null} */ from, /** @type {Iterable<string>} */ named) => {
    const names = new Set([...named].map((said) => said.replace(/\/+$/, '')));
    if (names.size > 0) found.push({ from, names });
  };
  foldLedger(root, { start: () => null, step: (_, event) => add(null, namedBy(event)) }, warnings);
  for (const doc of documents(root)) add(doc, linkedFrom(root, doc));
  for (const item of Object.values(roadmapItems(readProjectManifest(cwd)))) {
    if (Array.isArray(item?.sources)) add(null, item.sources.filter((source) => typeof source === 'string'));
  }
  return found;
}

module.exports = { relinkDocuments, carryNamings, followSources, namers };
