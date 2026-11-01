'use strict';

// ---------------------------------------------------------------------------
// Domain ring: discovery projections — the Discovery Map view over one
// epic's map rows.
//
// Deterministic: same input, same string. Rows carry their lifecycle label
// as the `[tag]` (self-describing — no separate Key block); summaries wrap
// through the kernel tree's body budget, so a long summary can never produce
// the ragged hand-drawn layout this projection replaces.
// ---------------------------------------------------------------------------

const { renderTree } = require('../../kernel/render.cjs');
const { TREE_WIDTH, treeHeader, titlecase, title, stateNote, discoveryGlyph, discoveryLifecycleLabel } = require('../conventions.cjs');
const { section, dataSection, CONTINUE_INSTRUCTION } = require('./surfaces.cjs');

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
 * A map row as the map's screen takes it: its order, the name it goes by,
 * and, while it is unstarted, its brief's absolute path.
 * @typedef {DiscoveryMapRow & {order?: number|null, goes_by?: string, brief?: string}} MapScreenRow
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
    title: title({ glyph: discoveryGlyph(row.lifecycle), label: row.title }),
    body: [stateNote(discoveryLifecycleLabel(row.lifecycle, row.mail_waiting ?? false, row.waits, row.promoted_to ?? null))],
  }));
}

/**
 * The Discovery Map display block: map header with the tier breakdown, one row per
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
 * A map row as DATA names it: its order, key and lifecycle, the name it goes
 * by where a rename gave it one, its brief where it carries one, and its
 * summary.
 * @param {MapScreenRow} row
 */
function rowData({ order, name, lifecycle, goes_by: goesBy, brief, summary }) {
  return `  ${order ?? '-'} ${name} [${lifecycle}]${goesBy !== undefined && goesBy !== name ? ` goes_by=${goesBy}` : ''}${brief ? ` brief=${brief}` : ''}${summary ? ` — ${summary}` : ''}`;
}

/** The names struck from the map, as the person reads them, or nothing where none is. @param {string[]} dismissed */
function struckBlock(dismissed) {
  if (dismissed.length === 0) return '';
  return `\nStruck from the map (${dismissed.length})\n${dismissed.map((name) => `  · ${titlecase(name)}`).join('\n')}\n`;
}

/**
 * The epic's map for Claude and for the person (`render discovery-map`):
 * DATA naming each topic in its order with its lifecycle and summary, an
 * unstarted one's brief, and the names struck from the map; then the map's
 * display with those names beneath.
 * @param {string} workUnit
 * @param {{rows: MapScreenRow[], summary: DiscoveryMapSummary}} map
 * @param {string[]} dismissed
 * @returns {string}
 */
function discoveryMapScreen(workUnit, map, dismissed) {
  const { summary: s } = map;
  const data = [
    `work_unit: ${workUnit}`,
    `map: ${s.total} topics — ${s.decided} decided, ${s.in_flight} in-flight, ${s.fresh} fresh, ${s.cancelled} cancelled, ${s.postponed} postponed`,
    `topics (${map.rows.length}):`,
    ...(map.rows.length === 0 ? ['  (none)'] : map.rows.map(rowData)),
    `dismissed (${dismissed.length}):`,
    ...(dismissed.length === 0 ? ['  (none)'] : dismissed.map((name) => `  - ${name}`)),
  ];
  return dataSection(data) + section('DISPLAY: discovery map', CONTINUE_INSTRUCTION, discoveryMapView(workUnit, map) + struckBlock(dismissed));
}

module.exports = { discoveryMapView, discoveryMapScreen };
