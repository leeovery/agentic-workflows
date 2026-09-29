'use strict';

// ---------------------------------------------------------------------------
// Kernel: the store's keyword side — the one tokenizer an index and a query
// share, each chunk's term counts, and BM25 over them, every field scored on
// its own.
// ---------------------------------------------------------------------------

const { stem } = require('./stemmer.cjs');

/** The fields a keyword search scores, each with its own length statistics. */
const FIELDS = ['content', 'heading_path', 'source_file', 'id'];

/**
 * The version of the terms a chunk carries, recorded in the store's file. A
 * change to the tokenizer or the fields takes the next, and a store recording
 * another re-derives every chunk's terms from the fields it records.
 */
const TOKENIZER_VERSION = 3;

const K1 = 1.2;
const B = 0.75;

const SPLITTER = /[^a-z0-9_'-]+/;
const ACCENTED = /[àèéìòóù]/g;
const UNACCENTED = { à: 'a', è: 'e', é: 'e', ì: 'i', ò: 'o', ó: 'o', ù: 'u' };

/** Lucene's English stop words. */
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'if', 'in', 'into', 'is', 'it', 'no', 'not',
  'of', 'on', 'or', 'such', 'that', 'the', 'their', 'then', 'there', 'these', 'they', 'this', 'to', 'was',
  'will', 'with',
]);

/** @type {Map<string, string>} */
const stems = new Map();

/** @param {string} word */
function stemOf(word) {
  let stemmed = stems.get(word);
  if (stemmed === undefined) {
    stemmed = stem(word);
    stems.set(word, stemmed);
  }
  return stemmed;
}

/**
 * Every word of `text` but the stop words, stemmed, in order, repeats kept.
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(ACCENTED, (letter) => UNACCENTED[letter])
    .split(SPLITTER)
    .filter((word) => word && !STOP_WORDS.has(word))
    .map(stemOf);
}

/** The words a store's chunks hold, each with its id — the position it was first added at. */
class Vocabulary {
  /** @param {string[]} [words] */
  constructor(words = []) {
    this.words = words;
    /** @type {Map<string, number>|null} */
    this.ids = null;
  }

  /** @param {string} word  @returns {number} its id, or -1 when the store holds no such word */
  idOf(word) {
    const id = this.lookup().get(word);
    return id === undefined ? -1 : id;
  }

  /** @param {string} word  @returns {number} its id, the word added when it is new */
  add(word) {
    const ids = this.lookup();
    let id = ids.get(word);
    if (id === undefined) {
      id = this.words.length;
      this.words.push(word);
      ids.set(word, id);
    }
    return id;
  }

  /** @private */
  lookup() {
    if (!this.ids) this.ids = new Map(this.words.map((word, id) => [word, id]));
    return this.ids;
  }
}

/**
 * @typedef {object} FieldTerms  one field of one chunk: its distinct words and how often each occurs
 * @property {Uint32Array} words   word ids
 * @property {Uint32Array} counts  each word's count in the field
 */

/**
 * A chunk's term counts, field by field — each new word added to the
 * vocabulary, and none for a field the chunk does not record.
 * @param {Record<string, any>} chunk @param {Vocabulary} vocabulary
 * @returns {FieldTerms[]}
 */
function termsOf(chunk, vocabulary) {
  return FIELDS.map((field) => {
    /** @type {Map<string, number>} */
    const counts = new Map();
    for (const token of tokenize(chunk[field] ?? '')) counts.set(token, (counts.get(token) || 0) + 1);
    return {
      words: Uint32Array.from(counts.keys(), (word) => vocabulary.add(word)),
      counts: Uint32Array.from(counts.values()),
    };
  });
}

/**
 * The vocabulary cut to the words the chunks still use, and each chunk's terms
 * renumbered to match.
 * @param {FieldTerms[][]} chunks  each chunk's terms, field by field
 * @param {Vocabulary} vocabulary
 * @returns {{words: string[], chunks: FieldTerms[][]}}
 */
function compact(chunks, vocabulary) {
  const renumbered = new Int32Array(vocabulary.words.length).fill(-1);
  /** @type {string[]} */
  const words = [];
  const kept = chunks.map((fields) => fields.map((terms) => ({
    words: terms.words.map((id) => {
      if (renumbered[id] === -1) renumbered[id] = words.push(vocabulary.words[id]) - 1;
      return renumbered[id];
    }),
    counts: terms.counts,
  })));
  return { words, chunks: kept };
}

/**
 * @typedef {object} Postings  one field's words, each with the chunks it occurs in
 * @property {Uint32Array} starts   a word's first posting, by word id; the last entry ends the final word's
 * @property {Uint32Array} chunks   the chunk each posting is in, by store position
 * @property {Uint32Array} counts   the word's count in that chunk's field
 * @property {Uint32Array} lengths  each chunk's field length in tokens
 * @property {number} average       the mean field length
 */

/**
 * One field's postings over every chunk's terms for it.
 * @param {FieldTerms[]} chunks  by store position @param {number} vocabularySize
 * @returns {Postings}
 */
function postingsOf(chunks, vocabularySize) {
  const starts = new Uint32Array(vocabularySize + 1);
  const lengths = new Uint32Array(chunks.length);
  chunks.forEach((terms, chunk) => {
    for (let i = 0; i < terms.words.length; i++) {
      starts[terms.words[i] + 1] += 1;
      lengths[chunk] += terms.counts[i];
    }
  });
  for (let word = 0; word < vocabularySize; word++) starts[word + 1] += starts[word];

  const next = starts.slice(0, vocabularySize);
  const postings = new Uint32Array(starts[vocabularySize]);
  const counts = new Uint32Array(starts[vocabularySize]);
  chunks.forEach((terms, chunk) => {
    for (let i = 0; i < terms.words.length; i++) {
      const at = next[terms.words[i]]++;
      postings[at] = chunk;
      counts[at] = terms.counts[i];
    }
  });
  const total = lengths.reduce((sum, length) => sum + length, 0);
  return { starts, chunks: postings, counts, lengths, average: chunks.length > 0 ? total / chunks.length : 0 };
}

/**
 * Every field's postings over the chunks' terms.
 * @param {FieldTerms[][]} chunks  each chunk's terms, field by field @param {number} vocabularySize
 * @returns {Postings[]}
 */
function indexOf(chunks, vocabularySize) {
  return FIELDS.map((_, field) => postingsOf(chunks.map((fields) => fields[field]), vocabularySize));
}

/**
 * BM25's inverse document frequency: a word's weight when `matching` of
 * `size` chunks hold it, the rarer weighing more.
 * @param {number} size @param {number} matching
 */
function inverseFrequency(size, matching) {
  return Math.log(1 + (size - matching + 0.5) / (matching + 0.5));
}

/**
 * Each word's inverse document frequency in one field — 0 for a word no
 * chunk's field holds.
 * @param {Postings} postings @param {Vocabulary} vocabulary
 * @returns {(word: string) => number}
 */
function rarity(postings, vocabulary) {
  return (word) => {
    const id = vocabulary.idOf(word);
    const matching = id === -1 ? 0 : postings.starts[id + 1] - postings.starts[id];
    return matching === 0 ? 0 : inverseFrequency(postings.lengths.length, matching);
  };
}

/**
 * Each admitted chunk's BM25 score for the query — summed over the fields and
 * the query's distinct words, and absent for a chunk matching none. Document
 * frequency and length statistics are store-wide: `admits` selects chunks,
 * never how one scores.
 * @param {Postings[]} index @param {Vocabulary} vocabulary @param {string} query
 * @param {(chunk: number) => boolean} admits  by store position
 * @returns {Map<number, number>} store position → score
 */
function score(index, vocabulary, query, admits) {
  /** @type {Map<number, number>} */
  const scores = new Map();
  const words = [...new Set(tokenize(query))].map((word) => vocabulary.idOf(word)).filter((id) => id !== -1);
  for (const field of index) {
    const size = field.lengths.length;
    for (const word of words) {
      const first = field.starts[word];
      const end = field.starts[word + 1];
      const matching = end - first;
      if (matching === 0) continue;
      const idf = inverseFrequency(size, matching);
      for (let at = first; at < end; at++) {
        const chunk = field.chunks[at];
        if (!admits(chunk)) continue;
        const count = field.counts[at];
        const saturation = count + K1 * (1 - B + (B * field.lengths[chunk]) / field.average);
        scores.set(chunk, (scores.get(chunk) || 0) + (idf * count * (K1 + 1)) / saturation);
      }
    }
  }
  return scores;
}

module.exports = { FIELDS, TOKENIZER_VERSION, Vocabulary, tokenize, termsOf, compact, indexOf, rarity, score };
