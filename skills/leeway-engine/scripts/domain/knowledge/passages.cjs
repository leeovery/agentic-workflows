'use strict';

// ---------------------------------------------------------------------------
// Domain ring: what a query prints of each result in place of its chunk —
// the excerpt that best matches the framing it ranked on, the headings
// enclosing that excerpt, and the chunk's lines in its file. The last two
// are read from the file as it stands, each file once, and a file that no
// longer holds the chunk gives neither.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const store = require('../../kernel/knowledge/store.cjs');
const { tokenize } = require('../../kernel/knowledge/keyword.cjs');
const { excerpt } = require('../../kernel/knowledge/excerpt.cjs');
const { outline } = require('../../kernel/knowledge/outline.cjs');

/** @typedef {import('../../kernel/knowledge/store.cjs').Store} Store */
/** @typedef {import('../../kernel/knowledge/ranking.cjs').Ranked} Ranked */
/** @typedef {import('../../kernel/knowledge/outline.cjs').Outline} Outline */
/** @typedef {import('../../kernel/knowledge/outline.cjs').Lines} Lines */

// Chosen by the eval's excerpt hit@5 against bytes per query.
const EXCERPT_CHARS = 1000;

/**
 * @typedef {object} Passage
 * @property {string} excerpt
 * @property {string[]} headings  enclosing the excerpt, outermost first
 * @property {Lines|null} lines  the chunk's lines in its file
 */

/** @typedef {Ranked & Passage} Placed  a ranked result with the passage `query` prints */

// What a read throws where the file is gone — ENOTDIR where a directory on its path is no longer one.
const GONE = new Set(['ENOENT', 'ENOTDIR']);

/** @param {string} file @returns {Outline|null} */
function readOutline(file) {
  let markdown;
  try {
    markdown = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (GONE.has(/** @type {NodeJS.ErrnoException} */ (err).code ?? '')) return null;
    throw err;
  }
  return outline(markdown);
}

/**
 * Each file's outline, read at its first asking — null where the file is gone.
 * @param {string} root
 * @returns {(file: string) => Outline|null}
 */
function outlines(root) {
  /** @type {Map<string, Outline|null>} */
  const read = new Map();
  return (file) => {
    if (!read.has(file)) read.set(file, readOutline(path.resolve(root, file)));
    return read.get(file) ?? null;
  };
}

/**
 * Each result with its passage, the excerpt picked by the words of the
 * framing it kept.
 * @param {Store} db @param {Ranked[]} results @param {string[]} terms  the query's framings
 * @param {string} root  the project the results' source files are in
 * @returns {Placed[]}
 */
function withPassages(db, results, terms, root) {
  const rarity = store.contentRarity(db);
  const outlineOf = outlines(root);
  return results.map((result) => {
    const words = new Set(tokenize(terms[result.scoring.kept - 1]));
    const picked = excerpt(result.content, words, rarity, EXCERPT_CHARS);
    const file = outlineOf(result.source_file);
    const lines = file ? file.locate(result.content) : null;
    return { ...result, excerpt: picked.text, headings: file && lines ? file.headingsAt(lines.first + picked.line) : [], lines };
  });
}

module.exports = { withPassages };
