'use strict';

// ---------------------------------------------------------------------------
// Domain ring: roadmap projections — the Roadmap view over the derived
// roadmap state (domain/roadmap.cjs), the harvest's proposal overlay, the
// pull working set, and the add-to-joined-horizon gate.
//
// Deterministic: same state, same string. Item lifecycle arrives derived
// (waiting/in-flight/shipped/orphaned — lifecycle by join, never stored);
// rows carry it as a `↳ state` note, joins named. Horizons are the user's
// own release labels — position carries the semantics, so groups render in
// list order.
// ---------------------------------------------------------------------------

const { renderTree, wrapWithPrefix } = require('../../kernel/render.cjs');
const { TREE_WIDTH, treeHeader, titlecase, title, stateNote } = require('../conventions.cjs');
const { menu, menuFrame, cmdOption, rangeOption, promptOption } = require('./surfaces.cjs');

/** @typedef {import('../roadmap.cjs').RoadmapItemRow} RoadmapItemRow */
/** @typedef {ReturnType<import('../roadmap.cjs').roadmapState>} RoadmapState */

// State glyphs — the conventions vocabulary read through the join: waiting is
// fresh-shaped, in-flight in-progress-shaped, shipped done, orphaned the
// warning cue.
const ROADMAP_GLYPH = /** @type {Record<string, string>} */ ({
  waiting: '○',
  'in-flight': '◐',
  shipped: '✓',
  orphaned: '⚑',
});

/** The `↳ state` note for one row — joins named. @param {RoadmapItemRow} row */
function roadmapStateLabel(row) {
  if (row.state === 'in-flight') return `in flight: ${row.work_unit}`;
  if (row.state === 'shipped') return `shipped: ${row.work_unit}`;
  if (row.state === 'orphaned') return `orphaned — work unit "${row.work_unit}" is missing or cancelled`;
  return 'waiting';
}

// Item rows as kernel tree nodes: glyph + name; a waiting (or orphaned) row
// carries its summary — a joined row is a window onto the work unit, so the
// join note alone is the truth worth printing.
/** @param {RoadmapItemRow[]} rows */
function roadmapNodes(rows) {
  return rows.map((row) => ({
    title: title({ glyph: ROADMAP_GLYPH[row.state] || '', label: titlecase(row.name) }),
    body: [
      ...(row.state === 'waiting' && row.summary ? [row.summary] : []),
      stateNote(roadmapStateLabel(row)),
    ],
  }));
}

/**
 * Group rows by horizon in list order; rows naming an unknown horizon trail
 * under their own label so a hand-edited manifest still renders.
 * @param {string[]} horizons @param {RoadmapItemRow[]} rows
 * @returns {{horizon: string, rows: RoadmapItemRow[]}[]}
 */
function groupByHorizon(horizons, rows) {
  const groups = horizons.map((h) => ({ horizon: h, rows: rows.filter((r) => r.horizon === h) }));
  const strays = rows.filter((r) => !horizons.includes(r.horizon));
  if (strays.length > 0) groups.push({ horizon: '(no horizon)', rows: strays });
  return groups.filter((g) => g.rows.length > 0);
}

// Totals categories in display order; the breakdown is omitted when only one
// is non-zero (the rows already say it).
const BREAKDOWN = /** @type {const} */ ([
  ['in_flight', 'in flight'],
  ['waiting', 'waiting'],
  ['shipped', 'shipped'],
  ['orphaned', 'orphaned'],
]);

/** @param {RoadmapState['totals']} totals */
function breakdown(totals) {
  const present = BREAKDOWN.filter(([key]) => totals[key] > 0);
  if (present.length <= 1) return '';
  return ' — ' + present.map(([key, label]) => `${totals[key]} ${label}`).join(' · ');
}

// Horizon labels render as stored — they are the user's own release words
// ("MVP", "v1.5", "someday"), never recased. Item names stay titlecased,
// matching the discovery map's display convention for topics.
/** Horizon-grouped item trees, shared by the map and proposal views. @param {string[]} horizons @param {RoadmapItemRow[]} rows */
function horizonTrees(horizons, rows) {
  const parts = [];
  for (const g of groupByHorizon(horizons, rows)) {
    parts.push(g.horizon);
    parts.push(renderTree(roadmapNodes(g.rows), { width: TREE_WIDTH, gap: true }));
  }
  return parts;
}

/**
 * The Roadmap display block — the anchor render ("show roadmap", the manage
 * view, the pull ceremony's backdrop): header with the join breakdown, one
 * horizon group per non-empty horizon.
 * @param {RoadmapState} state
 * @returns {string}
 */
function roadmapMapView(state) {
  const head = treeHeader(`Roadmap (${state.totals.items} item${state.totals.items === 1 ? '' : 's'}`
    + `${breakdown(state.totals)})`) + '\n';
  if (state.items.length === 0) return head + '  (empty)\n';
  return head + horizonTrees(state.horizons, state.items).join('\n');
}

/**
 * @typedef {object} ProposedRoadmapItem
 * @property {string} name
 * @property {string} horizon
 * @property {string} summary  one line, from the exploration
 */

/**
 * The harvest proposal — the sorted new items grouped by horizon (existing
 * and JIT alike), the existing roadmap unchanged below, and the framing
 * footer. The two-destination sort's "this container" half never appears
 * here — epic-bound items land on the epic's map via its own synthesis view.
 * @param {RoadmapState} state
 * @param {ProposedRoadmapItem[]} proposed
 * @returns {string}
 */
function roadmapProposalView(state, proposed) {
  if (!Array.isArray(proposed) || proposed.length === 0) {
    throw new Error('roadmapProposalView: proposed set is empty — nothing to render');
  }
  const parts = ['Proposed Roadmap\n'];
  const hasExisting = state.items.length > 0;

  // Proposed rows are waiting-to-be: group by the proposal's own horizons
  // (order: existing list first, then new horizons in proposal order).
  const horizons = [...state.horizons];
  for (const p of proposed) {
    if (!horizons.includes(p.horizon)) horizons.push(p.horizon);
  }
  const rows = proposed.map((p) => /** @type {RoadmapItemRow} */ ({
    name: p.name, horizon: p.horizon, summary: p.summary, origin: 'harvest', sources: [], state: 'waiting',
  }));

  parts.push(`${hasExisting ? 'New this session' : 'Proposed items'} (${proposed.length})`);
  parts.push(...horizonTrees(horizons, rows));

  if (hasExisting) {
    parts.push(`Already on the roadmap (${state.items.length})`);
    parts.push(...horizonTrees(state.horizons, state.items));
  }

  const footer = `${proposed.length} item${proposed.length === 1 ? '' : 's'}. `
    + 'Horizons use the conversation\'s own language; placement is my read — say the word to move any of it.';
  parts.push(wrapWithPrefix(footer, { width: TREE_WIDTH, prefix: '' }).join('\n') + '\n');

  return parts.join('\n');
}

/**
 * The pull working set — the commitment point's selection screen: waiting
 * items numbered horizon-major, a DATA table resolving numbers, the select
 * menu. Consumed by the roadmap skill's gateway (numbers must resolve
 * mechanically, so the reasoning table rides beside the display).
 * @param {RoadmapState} state
 * @returns {{data: string, display: string, menu: string, rows: {n: number, name: string, horizon: string}[]}}
 */
function roadmapPullSetView(state) {
  const waiting = state.items.filter((r) => r.state === 'waiting');
  if (waiting.length === 0) {
    throw new Error('roadmapPullSetView: no waiting items — nothing to pull');
  }
  /** @type {{n: number, name: string, horizon: string}[]} */
  const rows = [];
  const lines = [];
  for (const g of groupByHorizon(state.horizons, waiting)) {
    if (lines.length) lines.push('');
    lines.push(g.horizon);
    g.rows.forEach((row, gi) => {
      rows.push({ n: rows.length + 1, name: row.name, horizon: row.horizon });
      lines.push(`  ${gi === g.rows.length - 1 ? '└─' : '├─'} ${rows.length}. ${titlecase(row.name)} — ${row.summary}`);
    });
  }

  const data = [
    `waiting_count: ${waiting.length}`,
    'ITEMS (n  name  horizon):',
    ...rows.map((r) => `  ${r.n}  ${r.name}  ${r.horizon}`),
  ].join('\n');

  const options = [];
  if (rows.length === 1) {
    options.push(cmdOption('1', null, 'Pull the item into delivery'));
  } else {
    options.push(rangeOption(1, rows.length, 'Pull item(s) into delivery (comma-separated for several)'));
  }
  options.push(cmdOption('b', 'back', 'Return without pulling'));

  return {
    data,
    display: lines.join('\n') + '\n',
    menu: menuFrame(['What goes into delivery?', '', ...options]),
    rows,
  };
}

/**
 * The add-to-joined-horizon routed confirm (design/product-roadmap.md
 * decision 28): a horizon
 * fully in delivery takes the strict two-way menu (into the epic / another
 * horizon — no waiting side-door into a release that is now an epic); one
 * still holding waiting members keeps the three-way (waiting beside them is
 * how a release is composed).
 * @param {RoadmapState} state @param {string} horizon
 * @returns {string}
 */
function roadmapAddGate(state, horizon) {
  const members = state.items.filter((r) => r.horizon === horizon);
  const joined = members.filter((r) => r.state === 'in-flight' || r.state === 'shipped');
  const waiting = members.filter((r) => r.state === 'waiting');
  if (joined.length === 0) {
    throw new Error(`roadmapAddGate: no member of "${horizon}" is in delivery — a plain add needs no gate`);
  }
  const units = [...new Set(joined.map((r) => /** @type {string} */ (r.work_unit)))];
  const deliveryLabel = units.length === 1
    ? `Into the delivery — a fresh topic in "${units[0]}" (full phase discipline applies)`
    : 'Into the delivery — a fresh topic in one of its units (name which)';

  const options = [cmdOption('1', null, deliveryLabel)];
  if (waiting.length > 0) {
    options.push(cmdOption('2', null, `Waiting in "${horizon}" beside its ${waiting.length} uncommitted item${waiting.length === 1 ? '' : 's'}`));
    options.push(cmdOption('3', null, 'Another horizon (name it)'));
  } else {
    options.push(cmdOption('2', null, 'Another horizon (name it)'));
  }
  options.push(promptOption('Ask', 'Talk it through first'));

  const question = waiting.length > 0
    ? `"${horizon}" is partly in delivery. Where does this land?`
    : `"${horizon}" is being built right now. Where does this land?`;
  return menu('', options, { question });
}

/**
 * The roadmap home menu — the `r/roadmap` row's landing. Option set varies
 * at runtime (pull only over waiting items; converse reads as resume over an
 * open session), so it is engine-rendered. `keys` carries the machine action
 * keys the skill routes on.
 * @param {RoadmapState} state
 * @returns {{keys: {key: string, word?: string, action: string, label: string}[], rendered: string}}
 */
function roadmapHomeMenu(state) {
  /** @type {{key: string, word?: string, action: string, label: string}[]} */
  const keys = [];
  keys.push({
    key: 'c',
    word: 'converse',
    action: 'converse',
    label: state.active_session !== null
      ? 'Resume the open product session'
      : 'Open a product session — talk, add, re-sort, groom',
  });
  if (state.totals.waiting > 0) {
    keys.push({ key: 'p', word: 'pull', action: 'pull', label: `Pull waiting item(s) into delivery (${state.totals.waiting} waiting)` });
  }
  keys.push({ key: 'b', word: 'back', action: 'back', label: 'Leave the roadmap as it is' });

  const options = keys.map((k) => cmdOption(k.key, k.word ?? null, k.label));
  options.push(promptOption('Ask', 'Ask about the roadmap'));
  return { keys, rendered: menu('', options, { question: 'What would you like to do?' }) };
}

// The static gate menus — engine-rendered like every menu (one renderer,
// one alignment rule, one register), fetched by the prose at the exact
// point each is displayed.

/** The roadmap harvest's sort confirm. */
function roadmapHarvestGate() {
  return menu('', [
    cmdOption('y', 'yes', 'Commit these items to the roadmap'),
    cmdOption('e', 'explore', 'Go back to the conversation; not ready yet'),
    promptOption('Adjust', 'Tell me what to change (move, split, merge, rename, re-word)'),
  ], { question: 'Confirm the sort, or tell me what to adjust.' });
}

/** The epic synthesis' parks-only confirm — the whole sort is the roadmap's. */
function roadmapParksGate() {
  return menu('', [
    cmdOption('y', 'yes', 'Commit these items to the roadmap and conclude'),
    cmdOption('e', 'explore', 'Go back to exploration; not ready to commit yet'),
    promptOption('Adjust', 'Tell me what to change (move between horizons, rename, re-word)'),
  ], { question: 'Park these on the roadmap, or tell me what to adjust.' });
}

/** The pull's shape confirm — epic vs feature, the framing. */
function roadmapShapeGate() {
  return menu('', [
    cmdOption('y', 'yes', 'Create it and continue into delivery'),
    promptOption('Adjust', 'Tell me what to change (epic vs feature, the framing)'),
  ], { question: 'Shape it this way?' });
}

/** Conclude's stop-or-pull offer. */
function roadmapConcludeGate() {
  return menu('', [
    cmdOption('p', 'pull', 'Pick the item(s) going into delivery'),
    cmdOption('s', 'stop', 'Stop here — the roadmap keeps everything warm'),
  ], { question: 'Pull a slice into delivery now?' });
}

/** The view's chrome heading — project-level, no unit. */
function roadmapTitle() { return 'Roadmap'; }

module.exports = {
  roadmapTitle,
  roadmapMapView,
  roadmapProposalView,
  roadmapPullSetView,
  roadmapAddGate,
  roadmapHarvestGate,
  roadmapParksGate,
  roadmapShapeGate,
  roadmapConcludeGate,
  roadmapHomeMenu,
};
