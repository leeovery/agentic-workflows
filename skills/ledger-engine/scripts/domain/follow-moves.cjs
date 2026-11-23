'use strict';

// ---------------------------------------------------------------------------
// Domain ring: every markdown document's links followed when files move.
// Each relative link and embed in every `.md` file in the state but under
// `.git`, `.cache` and `.knowledge` is rebased (markdown-links.cjs), a
// document that moved itself rebased from where it was.
//
// Moves are `[from, to]` pairs from the state root, a folder's covering what
// is below it (`landingOf`), so a link naming the folder, or anything below
// it, follows it, a folder's trailing slash kept. The caller holds the
// writer lock, makes the moves before following them, and commits the
// documents rewritten.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { writeTextAtomic } = require('../kernel/manifest-io.cjs');
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

/**
 * Every document's links rebased to follow `moves` (the header's): the
 * documents rewritten, from the state root.
 * @param {string} root @param {Moves} moves @returns {string[]}
 */
function relinkDocuments(root, moves) {
  const follow = (/** @type {string} */ file) => landingOf(file, moves) ?? file;
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

module.exports = { relinkDocuments };
