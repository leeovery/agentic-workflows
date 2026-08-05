'use strict';

// ---------------------------------------------------------------------------
// Domain ring: discussion projections — the Discussion Map view over one
// discussion item's subtopics (see ../discussion-map.cjs).
//
// Deterministic: same manifest, same string. Rows hang off the header via the
// kernel tree (├─/└─); rows sort by BREAKDOWN_ORDER rank (settled first, then
// active, then not-yet-started, parked last) with insertion order as the
// within-rank tiebreak; children nest under their parent, two levels max, and
// sort by the same rule inside it.
// ---------------------------------------------------------------------------

const { renderTree } = require('../../kernel/render.cjs');
const { TREE_WIDTH, treeHeader, titlecase, title, discussionGlyph } = require('../conventions.cjs');
const { mapState, subtopicsOf } = require('../discussion-map.cjs');
const { section, menuFrame, cmdOption } = require('./surfaces.cjs');

/** @typedef {import('../../kernel/render.cjs').TreeNode} TreeNode */
/** @typedef {import('../discussion-map.cjs').SubtopicCounts} SubtopicCounts */

// Breakdown categories in display order — the same rank drives row order.
// Omitted from the header entirely when only one category is non-zero (the
// rows already say it).
const BREAKDOWN_ORDER = /** @type {(keyof SubtopicCounts)[]} */ (
  ['decided', 'converging', 'exploring', 'pending', 'deferred']
);

/** @param {SubtopicCounts} counts */
function breakdown(counts) {
  const present = BREAKDOWN_ORDER.filter((s) => counts[s] > 0);
  if (present.length <= 1) return '';
  return ' — ' + present.map((s) => `${counts[s]} ${s}`).join(' · ');
}

// Rank rows by BREAKDOWN_ORDER (unknown status last — mapState has already
// thrown on a corrupt one). Array.prototype.sort is stable, so insertion order
// survives as the within-rank tiebreak.
/** @param {string} status */
function rank(status) {
  const i = BREAKDOWN_ORDER.indexOf(/** @type {keyof SubtopicCounts} */ (status));
  return i === -1 ? BREAKDOWN_ORDER.length : i;
}

/**
 * The Discussion Map display block: header + two-level subtopic tree.
 * @param {string} topic
 * @param {object} manifest
 * @returns {string}
 */
function discussionMap(topic, manifest) {
  const state = mapState(manifest, topic);
  const subtopics = subtopicsOf(manifest, topic);

  const header = treeHeader(`Discussion Map — ${titlecase(topic)} `
    + `(${state.total} subtopic${state.total === 1 ? '' : 's'}${breakdown(state.counts)})`);
  if (state.total === 0) return header + '\n';

  // Build every node first, then link — a child may be stored before its
  // parent, and the sort below reorders both levels anyway.
  /** @type {Map<string, {node: TreeNode, rank: number, kids: {node: TreeNode, rank: number}[]}>} */
  const byName = new Map();
  for (const [name, sub] of Object.entries(subtopics)) {
    /** @type {TreeNode} */
    const node = { title: title({ glyph: discussionGlyph(sub.status), label: titlecase(name) }), tag: sub.status };
    byName.set(name, { node, rank: rank(sub.status), kids: [] });
  }

  /** @type {{node: TreeNode, rank: number}[]} */
  const top = [];
  for (const [name, sub] of Object.entries(subtopics)) {
    const entry = /** @type {{node: TreeNode, rank: number, kids: {node: TreeNode, rank: number}[]}} */ (byName.get(name));
    if (sub.parent === null || sub.parent === undefined) {
      top.push(entry);
    } else {
      const parent = byName.get(sub.parent);
      if (!parent) throw new Error(`subtopic "${name}" references missing parent "${sub.parent}"`);
      parent.kids.push(entry);
    }
  }

  const byRank = (a, b) => a.rank - b.rank;
  for (const { node, kids } of byName.values()) {
    if (kids.length) node.children = kids.sort(byRank).map((k) => k.node);
  }
  // childIndent 2 = the `✓ ` glyph width: subtrees drop from the parent's
  // title, not from its status glyph.
  return header + '\n' + renderTree(top.sort(byRank).map((t) => t.node), { width: TREE_WIDTH, childIndent: 2 });
}

/**
 * The defer gate — the map snapshot appends it while undecided subtopics
 * remain; the concluding flow is the only prescribed emission point. The
 * undecided subtopics themselves are on the DISPLAY map above the menu.
 * @param {number} unresolvedCount  length of mapState().unresolved, > 0
 * @returns {string} one labelled MENU section
 */
function discussionDeferGate(unresolvedCount) {
  const one = unresolvedCount === 1;
  return section(
    'MENU: defer gate',
    "emit verbatim as markdown only at the concluding step, then STOP for the user's response",
    menuFrame([
      one
        ? 'There is still 1 subtopic not yet decided — shown on the map above.'
        : `There are still ${unresolvedCount} subtopics not yet decided — shown on the map above.`,
      '',
      '**`◆ Defer and conclude?`**',
      '',
      cmdOption('y', 'yes', one ? 'Defer it and move toward concluding' : 'Defer them and move toward concluding'),
      cmdOption('n', 'no', 'Continue discussing'),
    ]),
  );
}

module.exports = { discussionMap, discussionDeferGate };
