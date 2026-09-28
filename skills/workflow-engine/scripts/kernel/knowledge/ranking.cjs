'use strict';

// ---------------------------------------------------------------------------
// Kernel: ranking — each framing's keyword and vector searches blended by
// score, the framings merged by each chunk's best, then re-ranked by decay,
// boosts and the confidence tier; and the account `--explain` prints.
// ---------------------------------------------------------------------------

const store = require('./store.cjs');

const KEYWORD_WEIGHT = 0.4;
const VECTOR_WEIGHT = 0.6;
const OVER_FETCH = 2;

const BOOST_AMOUNT = 0.1;
const TIER_STEP = 0.01;
const CONFIDENCE_RANK = {
  'high': 4,
  'medium': 3,
  'low-medium': 2,
  'low': 1,
};

const DECAY_BASE = 0.9;           // R when progressElapsed === stability (10% down)

/**
 * @typedef {object} SearchScore  what one search made of a chunk
 * @property {'keyword'|'vector'} search
 * @property {number|null} raw  its BM25 score or cosine — null where the search missed the chunk
 * @property {number} [normalised]  the raw score over the search's best, where the framing blends
 */

/**
 * @typedef {object} FramingScore  a chunk's score in one framing
 * @property {SearchScore[]} parts  each search the framing ran
 * @property {number} score  the blend, or the raw BM25 score keyword-only
 */

/**
 * @typedef {object} Scoring  how a result came by its score
 * @property {Array<FramingScore|null>} framings  null where a framing's hits lack the chunk
 * @property {number} kept  the framing whose score the chunk kept, from 1
 * @property {number} cut  the length every framing's hits were cut to
 * @property {number} [decay]
 * @property {number} [boost]
 * @property {number} [tier]
 */

/**
 * @typedef {Record<string, any> & {score: number, scoring: Required<Scoring>}} Ranked  a re-ranked result
 */

/**
 * @typedef {object} Searching  how a query's searches run
 * @property {import('./store.cjs').Where} [where]
 * @property {number} limit  the query's result limit
 * @property {number} similarity  the vector search's per-chunk minimum
 * @property {Array<ArrayLike<number>>|null} vectors  each framing's vector, in order — null when the query runs keyword-only
 */

/**
 * Every framing's hits, best first and cut to twice the limit: the keyword
 * and vector searches blended when the query has vectors, else the keyword
 * search's raw scores. Each hit carries its parts.
 * @param {import('./store.cjs').Store} db @param {string[]} terms @param {Searching} searching
 * @returns {{cut: number, framings: Array<Array<Record<string, any>>>}}
 */
function searchFramings(db, terms, { where, limit, similarity, vectors }) {
  const cut = limit * OVER_FETCH;
  const framings = terms.map((term, at) => {
    if (!vectors) {
      const hits = store.searchKeyword(db, { term, where, limit: cut });
      return hits.map((hit) => ({ ...hit, parts: [{ search: 'keyword', raw: hit.score }] }));
    }
    return blend([
      { search: 'keyword', weight: KEYWORD_WEIGHT, hits: store.searchKeyword(db, { term, where }) },
      { search: 'vector', weight: VECTOR_WEIGHT, hits: store.searchVector(db, { vector: vectors[at], similarity, where }) },
    ]).slice(0, cut);
  });
  return { cut, framings };
}

/**
 * The searches' hits merged, best first: each hit's score divided by its own
 * search's best and weighted, summed per chunk — a search that missed the
 * chunk adds nothing.
 * @param {Array<{search: 'keyword'|'vector', weight: number, hits: Array<Record<string, any>>}>} searches
 * @returns {Array<Record<string, any>>}
 */
function blend(searches) {
  const blended = new Map();
  searches.forEach(({ search, weight, hits }, at) => {
    for (const hit of hits) {
      const normalised = hit.score / hits[0].score;
      const prior = blended.get(hit.id) || { ...hit, score: 0, parts: searches.map((s) => ({ search: s.search, raw: null })) };
      prior.parts[at] = { search, raw: hit.score, normalised };
      blended.set(hit.id, { ...prior, score: prior.score + normalised * weight });
    }
  });
  return [...blended.values()].sort((a, b) => b.score - a.score);
}

/**
 * Every framing's hits merged: each chunk once, in the order the framings
 * first found it, keeping its best framing's score — the earliest, where
 * framings tie.
 * @param {Array<Array<Record<string, any>>>} framings @param {number} cut  the length they were cut to
 * @returns {Array<Record<string, any>>}  each chunk with its scoring
 */
function mergeFramings(framings, cut) {
  const merged = new Map();
  framings.forEach((hits, at) => {
    for (const { parts, ...hit } of hits) {
      const prior = merged.get(hit.id);
      const scores = prior ? prior.scoring.framings : framings.map(() => null);
      scores[at] = { parts, score: hit.score };
      if (!prior || hit.score > prior.score) merged.set(hit.id, { ...hit, scoring: { framings: scores, kept: at + 1, cut } });
    }
  });
  return [...merged.values()];
}

/**
 * Retrievability R = DECAY_BASE^(progressElapsed / stability), in (0, 1].
 * progressElapsed 0 → R = 1 (nothing completed past the chunk). More work
 * completed past a chunk's unit → smaller R. This is the multiplier the soft
 * down-rank applies to a chunk's base relevance.
 * @param {number} progressElapsed @param {number} stability  above 0
 */
function retrievability(progressElapsed, stability) {
  const p = progressElapsed > 0 ? progressElapsed : 0;
  if (p === 0) return 1;
  return Math.pow(DECAY_BASE, p / stability);
}

/**
 * Application-level re-ranking, best first: each result's score decayed by
 * its retrievability, then its boosts (+0.1 per matching directive) and its
 * confidence tier (+0.01 per step) added — undimmed by the decay. A decayed
 * chunk sinks but is never removed. Each result's scoring records what the
 * three did.
 * @param {Array<Record<string, any>>} results  each may carry `progressElapsed`
 *        (attached by the query pipeline; absent → 0 → no decay)
 * @param {Array<{field: string, value: string}>} boosts  normalised boost list
 * @param {number} stability  S0 for the decay curve
 * @returns {Ranked[]}
 */
function rerank(results, boosts, stability) {
  return results
    .map((r) => {
      const decay = retrievability(r.progressElapsed || 0, stability);
      const matching = boosts.filter(({ field, value }) => r[field] === value);
      const boosted = matching.reduce((score) => score + BOOST_AMOUNT, (r.score || 0) * decay);
      const tier = (CONFIDENCE_RANK[r.confidence] || 0) * TIER_STEP;
      return { ...r, score: boosted + tier, scoring: { ...r.scoring, decay, boost: matching.length * BOOST_AMOUNT, tier } };
    })
    .sort((a, b) => b.score - a.score);
}

/** @param {number} value */
function shown(value) {
  return value.toFixed(4);
}

/** @param {FramingScore} framing */
function framingLine({ parts, score }) {
  const searches = parts.map(({ search, raw, normalised }) => {
    if (raw === null) return `${search} absent`;
    return normalised === undefined ? `${search} ${shown(raw)}` : `${search} ${shown(raw)} → ${shown(normalised)}`;
  });
  return parts.length > 1 ? `${searches.join(', ')}, blended ${shown(score)}` : searches.join(', ');
}

/**
 * The lines `query --explain` prints beneath a ranked result: its score in
 * every framing, then the framing it kept, worked through decay, the boosts
 * and the tier.
 * @param {Ranked} result
 * @returns {string[]}
 */
function explanation({ score, scoring }) {
  const kept = /** @type {FramingScore} */ (scoring.framings[scoring.kept - 1]);
  const unlisted = `not in its top ${scoring.cut}`;
  return [
    ...scoring.framings.map((framing, at) => `Framing ${at + 1}: ${framing ? framingLine(framing) : unlisted}`),
    `Score: kept framing ${scoring.kept}'s ${shown(kept.score)} × ${shown(scoring.decay)} decay`
      + ` + ${shown(scoring.boost)} boost + ${shown(scoring.tier)} tier = ${shown(score)}`,
  ];
}

module.exports = { searchFramings, mergeFramings, rerank, retrievability, explanation };
