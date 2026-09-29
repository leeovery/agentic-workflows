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

// Chosen by the eval: the judged answer shows in a top-five excerpt for 94%
// of its cases keyword-only and 98% hybrid, at a fifth of whole chunks' bytes.
const EXCERPT_CHARS = 1000;

/**
 * @typedef {object} Passage
 * @property {string} excerpt
 * @property {string[]} headings  enclosing the excerpt, outermost first
 * @property {Lines|null} lines  the chunk's lines in its file
 */

/** @typedef {Ranked & Passage} Placed  a ranked result with the passage `query` prints */

/** @param {string} file @returns {Outline|null} */
function readOutline(file) {
  try {
    return outline(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Each file's outline, read at its first asking — null where it cannot be read.
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
