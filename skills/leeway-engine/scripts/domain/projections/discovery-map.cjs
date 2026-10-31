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

const { renderTree, wrapWithPrefix } = require('../../kernel/render.cjs');
const { TREE_WIDTH, treeHeader, titlecase, title, stateNote, discoveryGlyph, discoveryLifecycleLabel } = require('../conventions.cjs');

/** @typedef {import('../../kernel/render.cjs').TreeNode} TreeNode */

/**
 * @typedef {object} DiscoveryMapRow
 * @property {string} name
 * @property {string} lifecycle   fresh|discussing|decided|cancelled|postponed
 * @property {string} [title]      how screens title the topic, its name titlecased where none is given
 * @property {string|null} [discussion_state]  the discussion item's raw status, null when none exists
 * @property {string|null} [promoted_to]  the cross-cutting unit a promoted discussion moved to, null otherwise
 * @property {boolean} [mail_waiting]  messages wait in the topic's mailbox, whatever its items' status
 * @property {import('../derivations.cjs').Wait[]} [waits]  the live waits of the topic's in-progress phase items
 * @property {string|null} [summary]
 */

/**
 * @typedef {object} DiscoveryMapSummary
 * @property {number} total
 * @property {number} decided
 * @property {number} in_flight
 * @property {number} fresh
 * @property {number} cancelled
 * @property {number} postponed
 */

/**
 * @typedef {object} ProposedTopic
 * @property {string} name
 * @property {string} summary   one line, from the exploration
 * @property {string} description  a short paragraph, from the exploration — what the topic covers and why it surfaced
 */

// Breakdown categories in display order. The whole breakdown is omitted when
// only one category is non-zero (the rows already say it).
const BREAKDOWN = /** @type {const} */ ([
  ['decided', 'decided'],
  ['in_flight', 'in flight'],
  ['fresh', 'fresh'],
  ['cancelled', 'cancelled'],
  ['postponed', 'postponed'],
]);

/** @param {DiscoveryMapSummary} summary */
function breakdown(summary) {
  const present = BREAKDOWN.filter(([key]) => summary[key] > 0);
  if (present.length <= 1) return '';
  return ' — ' + present.map(([key, label]) => `${summary[key]} ${label}`).join(' · ');
}

// Map rows as kernel tree nodes: glyph + name, lifecycle spelled out on a
// `↳ state` line — no tag column (long names never stretch a shared column).
/** @param {DiscoveryMapRow[]} rows */
function mapNodes(rows) {
  return rows.map((row) => ({
    title: title({ glyph: discoveryGlyph(row.lifecycle), label: row.title ?? titlecase(row.name) }),
    body: [stateNote(discoveryLifecycleLabel(row.lifecycle, row.mail_waiting ?? false, row.waits, row.promoted_to ?? null))],
  }));
}

/** Proposed rows: ○ (fresh-to-be) + name, the summary and — a blank line on — the description beneath. @param {ProposedTopic[] } proposed */
function proposedNodes(proposed) {
  return proposed.map((t) => ({
    title: title({ glyph: '○', label: titlecase(t.name) }),
    body: [t.summary, '', t.description],
  }));
}

/**
 * The Discovery Map display block — the session's anchor render (opener,
 * "show map"): map header with the tier breakdown, one row per
 * topic in the given (tier-sorted) order.
 * @param {string} workUnit
 * @param {{rows: DiscoveryMapRow[], summary: DiscoveryMapSummary}} map
 * @returns {string}
 */
function discoveryMapView(workUnit, map) {
  const head = ''
    + treeHeader(`Discovery Map (${map.summary.total} topic${map.summary.total === 1 ? '' : 's'}`
      + `${breakdown(map.summary)})`) + '\n';
  if (map.rows.length === 0) return head + '  (empty)\n';
  return head + renderTree(mapNodes(map.rows), { width: TREE_WIDTH, gap: true });
}

/**
 * The synthesised-map display block — the harvest proposal: the proposed
 * topics (summary and description wrapped beneath), the existing map
 * unchanged below it, and the framing footer.
 * @param {string} workUnit
 * @param {{rows: DiscoveryMapRow[], summary: DiscoveryMapSummary}} map
 * @param {ProposedTopic[]} proposed
 * @returns {string}
 */
function discoverySynthesisView(workUnit, map, proposed) {
  if (!Array.isArray(proposed) || proposed.length === 0) {
    throw new Error('discoverySynthesisView: proposed set is empty — nothing to render');
  }
  const parts = [`Synthesised Discovery Map — ${titlecase(workUnit)}\n`];
  const hasExisting = map.rows.length > 0;

  parts.push(`${hasExisting ? 'New this session' : 'Proposed topics'} (${proposed.length})`);
  parts.push(renderTree(proposedNodes(proposed), { width: TREE_WIDTH, gap: true }));

  if (hasExisting) {
    parts.push(`Already on the map (${map.rows.length})`);
    parts.push(renderTree(mapNodes(map.rows), { width: TREE_WIDTH, gap: true }));
  }

  // A closing sentence, not a detail of the tree above it — column 0.
  const footer = `${proposed.length} topic${proposed.length === 1 ? '' : 's'}. `
    + 'Summaries and descriptions come from the exploration.';
  parts.push(wrapWithPrefix(footer, { width: TREE_WIDTH, prefix: '' }).join('\n') + '\n');

  return parts.join('\n');
}

/** The view's chrome heading. @param {string} workUnit */
function discoveryTitle(workUnit) { return `Discovery — ${titlecase(workUnit)}`; }

module.exports = {
  discoveryTitle, discoveryMapView, discoverySynthesisView };
