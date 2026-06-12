'use strict';

// ---------------------------------------------------------------------------
// Domain ring: discussion projections — the Discussion Map view over one
// discussion item's subtopics (see ../map.cjs).
//
// Deterministic: same manifest, same string. Rows hang off the header via the
// kernel tree (├─/└─); insertion order is render order; children nest under
// their parent, two levels max.
// ---------------------------------------------------------------------------

const { renderTree } = require('../../kernel/render.cjs');
const { TREE_WIDTH, titlecase, title, discussionGlyph } = require('../conventions.cjs');
const { mapState, subtopicsOf } = require('../map.cjs');

/** @typedef {import('../../kernel/render.cjs').TreeNode} TreeNode */
/** @typedef {import('../map.cjs').SubtopicCounts} SubtopicCounts */

// Breakdown categories in display order. Omitted entirely when only one
// category is non-zero (the rows already say it).
const BREAKDOWN_ORDER = /** @type {(keyof SubtopicCounts)[]} */ (
  ['decided', 'converging', 'exploring', 'pending', 'deferred']
);

/** @param {SubtopicCounts} counts */
function breakdown(counts) {
  const present = BREAKDOWN_ORDER.filter((s) => counts[s] > 0);
  if (present.length <= 1) return '';
  return ' — ' + present.map((s) => `${counts[s]} ${s}`).join(' · ');
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

  const header = `  Discussion Map — ${titlecase(topic)} `
    + `(${state.total} subtopic${state.total === 1 ? '' : 's'}${breakdown(state.counts)})`;
  if (state.total === 0) return header + '\n';

  /** @type {TreeNode[]} */
  const top = [];
  /** @type {Map<string, TreeNode>} */
  const byName = new Map();
  for (const [name, sub] of Object.entries(subtopics)) {
    /** @type {TreeNode} */
    const node = { title: title({ glyph: discussionGlyph(sub.status), label: titlecase(name), tag: sub.status }) };
    byName.set(name, node);
    if (sub.parent === null || sub.parent === undefined) {
      top.push(node);
    } else {
      const parent = byName.get(sub.parent);
      if (!parent) throw new Error(`subtopic "${name}" references missing parent "${sub.parent}"`);
      (parent.children = parent.children || []).push(node);
    }
  }
  return header + '\n' + renderTree(top, { width: TREE_WIDTH });
}

module.exports = { discussionMap };
