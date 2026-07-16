'use strict';

// ---------------------------------------------------------------------------
// Domain ring: discovery projections — the Discovery Map view over one
// epic's map rows, with an optional synthesis overlay (the harvest's
// proposed topic set, model-authored, not yet on the map).
//
// Deterministic: same input, same string. Rows carry their lifecycle label
// as the `[tag]` (self-describing — no separate Key block); summaries wrap
// through the kernel tree's body budget, so a long summary can never produce
// the ragged hand-drawn layout this projection replaces.
// ---------------------------------------------------------------------------

const { box, renderTree, wrapWithPrefix } = require('../../kernel/render.cjs');
const { TREE_WIDTH, titlecase, title, discoveryGlyph, discoveryLifecycleLabel } = require('../conventions.cjs');

/** @typedef {import('../../kernel/render.cjs').TreeNode} TreeNode */

/**
 * @typedef {object} DiscoveryMapRow
 * @property {string} name
 * @property {string} lifecycle   fresh|researching|ready_for_discussion|discussing|decided|handled|cancelled
 * @property {string|null} [routing]
 * @property {string|null} [summary]
 */

/**
 * @typedef {object} DiscoveryMapSummary
 * @property {number} total
 * @property {number} decided
 * @property {number} in_flight
 * @property {number} ready
 * @property {number} fresh
 * @property {number} handled
 * @property {number} cancelled
 */

/**
 * @typedef {object} ProposedTopic
 * @property {string} name
 * @property {string} routing   research|discussion
 * @property {string} summary   one line, from the exploration
 */

// Breakdown categories in display order. The whole breakdown is omitted when
// only one category is non-zero (the rows already say it).
const BREAKDOWN = /** @type {const} */ ([
  ['decided', 'decided'],
  ['in_flight', 'in flight'],
  ['ready', 'ready'],
  ['fresh', 'fresh'],
  ['handled', 'handled'],
  ['cancelled', 'cancelled'],
]);

/** @param {DiscoveryMapSummary} summary */
function breakdown(summary) {
  const present = BREAKDOWN.filter(([key]) => summary[key] > 0);
  if (present.length <= 1) return '';
  return ' — ' + present.map(([key, label]) => `${summary[key]} ${label}`).join(' · ');
}

/** Map rows as kernel tree nodes: glyph + name + [lifecycle label]. @param {DiscoveryMapRow[]} rows */
function mapNodes(rows) {
  return rows.map((row) => ({
    title: title({
      glyph: discoveryGlyph(row.lifecycle),
      label: titlecase(row.name),
      tag: discoveryLifecycleLabel(row.lifecycle, row.routing ?? null),
    }),
  }));
}

/** Proposed rows: ○ (fresh-to-be) + name + [routing], summary wrapping beneath. @param {ProposedTopic[] } proposed */
function proposedNodes(proposed) {
  return proposed.map((t) => ({
    title: title({ glyph: '○', label: titlecase(t.name), tag: t.routing }),
    body: [t.summary],
  }));
}

/**
 * The Discovery Map display block — the session's anchor render (opener,
 * "show map"): box cap, map header with the tier breakdown, one row per
 * topic in the given (tier-sorted) order.
 * @param {string} workUnit
 * @param {{rows: DiscoveryMapRow[], summary: DiscoveryMapSummary}} map
 * @returns {string}
 */
function discoveryMapView(workUnit, map) {
  const head = box(`Discovery — ${titlecase(workUnit)}`)
    + `  Discovery Map (${map.summary.total} topics${breakdown(map.summary)})\n\n`;
  if (map.rows.length === 0) return head + '  (empty)\n';
  return head + renderTree(mapNodes(map.rows), { width: TREE_WIDTH });
}

/**
 * The synthesised-map display block — the harvest proposal: the proposed
 * topics (routing as the row tag, summary wrapped beneath), the existing map
 * unchanged below it, and the framing footer. No box — the session's phase
 * title already rendered at the opener.
 * @param {string} workUnit
 * @param {{rows: DiscoveryMapRow[], summary: DiscoveryMapSummary}} map
 * @param {ProposedTopic[]} proposed
 * @returns {string}
 */
function discoverySynthesisView(workUnit, map, proposed) {
  if (!Array.isArray(proposed) || proposed.length === 0) {
    throw new Error('discoverySynthesisView: proposed set is empty — nothing to render');
  }
  const parts = [`  Synthesised Discovery Map — ${titlecase(workUnit)}\n`];
  const hasExisting = map.rows.length > 0;

  parts.push(`  ${hasExisting ? 'New this session' : 'Proposed topics'} (${proposed.length}):\n`);
  parts.push(renderTree(proposedNodes(proposed), { width: TREE_WIDTH }));

  if (hasExisting) {
    parts.push(`  Already on the map (${map.rows.length}):\n`);
    parts.push(renderTree(mapNodes(map.rows), { width: TREE_WIDTH }));
  }

  const footer = `${proposed.length} topic(s). Summaries come from the exploration; `
    + 'routing is my read of where each one goes next.';
  parts.push(wrapWithPrefix(footer, { width: TREE_WIDTH, prefix: '  ' }).join('\n') + '\n');

  return parts.join('\n');
}

module.exports = { discoveryMapView, discoverySynthesisView };
