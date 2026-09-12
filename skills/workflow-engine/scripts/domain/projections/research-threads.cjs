'use strict';

// ---------------------------------------------------------------------------
// Domain ring: research projections — the thread register view over one
// research item's threads (see ../research-threads.cjs).
//
// Deterministic: same manifest, same string. Rows hang off the header via the
// kernel tree (├─/└─): the question is the row title — wrapped, never
// clamped, a question being a sentence rather than a label — the origin its
// `[tag]`, a parked row's reason a `↳` line beneath it. Rows sort by
// RANK_ORDER (live first — digging, then open — then learned, parked last)
// with insertion order as the within-rank tiebreak; children nest under
// their parent, two levels max, and sort by the same rule inside it.
// ---------------------------------------------------------------------------

const { renderTree } = require('../../kernel/render.cjs');
const { TREE_WIDTH, treeHeader, titlecase, stateNote, researchGlyph } = require('../conventions.cjs');
const { registerState, threadsOf } = require('../research-threads.cjs');

/** @typedef {import('../../kernel/render.cjs').TreeNode} TreeNode */
/** @typedef {import('../research-threads.cjs').Thread} Thread */
/** @typedef {import('../research-threads.cjs').ThreadCounts} ThreadCounts */
/** @typedef {{node: TreeNode, rank: number, kids: RankedNode[]}} RankedNode */

// Breakdown categories in display order — the same rank drives row order.
// Omitted from the header entirely when only one category is non-zero (the
// rows already say it).
const RANK_ORDER = /** @type {(keyof ThreadCounts)[]} */ (['digging', 'open', 'learned', 'parked']);

/** @param {ThreadCounts} counts */
function breakdown(counts) {
  const present = RANK_ORDER.filter((s) => counts[s] > 0);
  if (present.length <= 1) return '';
  return ' — ' + present.map((s) => `${counts[s]} ${s}`).join(' · ');
}

// Rank rows by RANK_ORDER (registerState has already thrown on a corrupt
// status). Array.prototype.sort is stable, so insertion order survives as the
// within-rank tiebreak.
/** @param {string} status */
function rank(status) {
  return RANK_ORDER.indexOf(/** @type {keyof ThreadCounts} */ (status));
}

// One register row: glyph + the question, the origin in the tag column, a
// parked thread's reason beneath it.
/** @param {Thread} thread @returns {TreeNode} */
function threadNode(thread) {
  return {
    title: `${researchGlyph(thread.status)} ${thread.question}`,
    tag: thread.origin,
    ...(thread.note ? { body: [stateNote(thread.note)] } : {}),
  };
}

/** @param {RankedNode} a @param {RankedNode} b */
const byRank = (a, b) => a.rank - b.rank;

// Register rows as ranked kernel tree nodes: every node built first, then
// linked — a child may be stored before its parent — then both levels
// sorted by rank.
/** @param {Record<string, Thread>} threads @returns {TreeNode[]} */
function threadNodes(threads) {
  /** @type {Map<string, RankedNode>} */
  const bySlug = new Map(Object.entries(threads).map(([slug, thread]) => (
    [slug, { node: threadNode(thread), rank: rank(thread.status), kids: [] }]
  )));
  /** @type {RankedNode[]} */
  const top = [];
  for (const [slug, thread] of Object.entries(threads)) {
    const entry = /** @type {RankedNode} */ (bySlug.get(slug));
    if (thread.parent === null) top.push(entry);
    else /** @type {RankedNode} */ (bySlug.get(thread.parent)).kids.push(entry);
  }
  for (const { node, kids } of bySlug.values()) {
    if (kids.length) node.children = kids.sort(byRank).map((k) => k.node);
  }
  return top.sort(byRank).map((t) => t.node);
}

/**
 * The thread register display block: header + two-level thread tree. An
 * empty register is the header line alone.
 * @param {string} topic
 * @param {object} manifest
 * @returns {string}
 */
function researchThreads(topic, manifest) {
  const state = registerState(manifest, topic);
  const header = treeHeader(`Research Threads — ${titlecase(topic)} `
    + `(${state.total} thread${state.total === 1 ? '' : 's'}${breakdown(state.counts)})`);
  if (state.total === 0) return header + '\n';
  // childIndent 2 = the glyph width: subtrees, a wrapped question's
  // continuation, and a parked row's `↳` all drop from the question's first
  // letter (bodyIndent 0), not from its glyph.
  return header + '\n' + renderTree(threadNodes(threadsOf(manifest, topic)), {
    width: TREE_WIDTH, childIndent: 2, bodyIndent: 0, wrapTitles: true,
  });
}

module.exports = { researchThreads };
