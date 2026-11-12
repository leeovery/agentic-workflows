'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the roadmap's screens over the derived roadmap state
// (domain/roadmap.cjs; 18.8).
//
// - `render roadmap`: the roadmap's home (18.8.10), drawn in the menus' frame
//   (menus.cjs), which arrives at the roadmap. "Roadmap · {Project}", each
//   horizon in the person's order with what waits on it, `{horizon} ({n})`,
//   its items numbered across the horizons, one line each, a title cut short
//   where it would run into the kind and where the item came from, `{kind} ·
//   {origin}`, one left-aligned column across every horizon. An item put
//   back on no horizon trails under "(no horizon)" (18.8.20); an item in
//   flight has left the roadmap, and an archived one is off it (18.8.13).
//   A DATA section gives each number's item, its horizon and its summary,
//   which Claude says when an item is picked or asked about (18.8.5). Rows:
//   w, m and a while anything waits, each carrying on in the conversation,
//   where Claude asks which items; n, the same, asking what and which
//   horizon; p into the product's conversation (18.8.7); b back to the start
//   menu. Nothing waiting says so.
// - `render roadmap-harvest --file <items.json>`: the end of a session of the
//   product's conversation (18.8.18), a gate: TO THE ROADMAP, each item with
//   its horizon, the horizons ending at the width, and the yes landing the
//   file as `roadmap add-batch` lands it, refused as the batch would refuse
//   it — a name already on the roadmap, archived or not, an illegal name or
//   horizon, a source not on disk; Keep shaping carries on in the
//   conversation.
// - The Roadmap view and the add-to-joined-horizon gate, over every item
//   with its lifecycle as a `↳ state` note, joins named — a bug or a
//   quick-fix naming its kind ahead of it, an idea unmarked.
//
// Horizons are the person's own release labels, drawn as they wrote them;
// position carries the semantics, so groups render in list order.
// ---------------------------------------------------------------------------

const { renderTree, wrap, TAG_GAP } = require('../../kernel/render.cjs');
const { displayWidth } = require('../../kernel/terminal.cjs');
const { TREE_WIDTH, treeHeader, titlecase, title, stateNote } = require('../conventions.cjs');
const { section, dataSection, menu, cmdOption, promptOption, emitAs, clipped, MENU_INSTRUCTION } = require('./surfaces.cjs');
const { markedKind, planRoadmapBatch, roadmapState } = require('../roadmap.cjs');
const { projectName } = require('../state-checks.cjs');
const { readPayload, refusing } = require('../staged-payload.cjs');
const { MENUS, drawMenu } = require('../menus.cjs');
const { PRODUCT } = require('../../kernel/manifest-schema.cjs');

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

/** The row's `↳` note — its kind, where marked, ahead of its state. @param {RoadmapItemRow} row */
function roadmapNote(row) {
  const kind = markedKind(row.kind);
  return kind ? `${kind} · ${roadmapStateLabel(row)}` : roadmapStateLabel(row);
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
      stateNote(roadmapNote(row)),
    ],
  }));
}

/** The label rows on no horizon of the list go under, in a display and a DATA line alike. */
const NO_HORIZON = '(no horizon)';

/**
 * Group rows by horizon in list order; rows on no horizon of the list — one
 * put back after its horizon was removed (18.8.20) — trail under their own
 * label, so every view that lists the roadmap shows them.
 * @template {{horizon?: string|null}} R
 * @param {string[]} horizons @param {R[]} rows
 * @returns {{horizon: string, rows: R[]}[]}
 */
function groupByHorizon(horizons, rows) {
  const groups = horizons.map((h) => ({ horizon: h, rows: rows.filter((r) => r.horizon === h) }));
  const strays = rows.filter((r) => typeof r.horizon !== 'string' || !horizons.includes(r.horizon));
  if (strays.length > 0) groups.push({ horizon: NO_HORIZON, rows: strays });
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
/** Horizon-grouped item trees. @param {string[]} horizons @param {RoadmapItemRow[]} rows */
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
 * The add-to-joined-horizon routed confirm (design/product-roadmap.md
 * decision 28). Delivery is a new topic, so it is an epic in flight a member
 * was pulled into — a bugfix, quick-fix or feature takes no topic, nor does
 * finished work. A horizon wholly in such epics takes the strict two-way
 * menu (into the epic / another horizon — no waiting side-door into a
 * release that is now an epic); any other member — waiting, or pulled
 * elsewhere — keeps the three-way (waiting beside them is how a release is
 * composed). `units` names the epics the delivery row pulls into. A horizon
 * with no member in an epic underway — a new one among them — is a plain
 * add, and has no gate: null.
 * @param {RoadmapState} state @param {string} horizon
 * @returns {{units: string[], menu: string}|null}
 */
function roadmapAddGate(state, horizon) {
  const members = state.items.filter((r) => r.horizon === horizon);
  const inEpic = members.filter((r) => r.state === 'in-flight' && r.work_type === 'epic');
  const waiting = members.filter((r) => r.state === 'waiting');
  if (inEpic.length === 0) return null;
  const units = [...new Set(inEpic.map((r) => /** @type {string} */ (r.work_unit)))];
  const deliveryLabel = units.length === 1
    ? `Into the work underway — a new topic in "${units[0]}"`
    : 'Into the work underway — a new topic in one of its work units (name which)';
  const wholly = inEpic.length === members.length;

  const options = [cmdOption('d', 'delivery', deliveryLabel)];
  if (!wholly) {
    const beside = waiting.length > 0 ? ` with its ${waiting.length} other item${waiting.length === 1 ? '' : 's'}` : '';
    options.push(cmdOption('w', 'waiting', { head: `On the roadmap in "${horizon}", waiting${beside}` }));
  }
  options.push(cmdOption('h', 'horizon', 'Another horizon (name it)'));
  options.push(promptOption('Ask', 'Talk it through first'));

  const statement = wholly
    ? `"${horizon}" is being built right now.`
    : `"${horizon}" is partly being built.`;
  return { units, menu: menu(statement, options, { question: 'Where does this go?' }) };
}

// The static gate menu — engine-rendered like every menu, fetched by the
// prose at the point it is displayed.

/** The epic synthesis' parks-only confirm — the whole sort is the roadmap's. */
function roadmapParksGate() {
  return menu('', [
    cmdOption('y', 'yes', 'Add these items to the roadmap and conclude'),
    cmdOption('e', 'explore', 'Go back to exploration; not ready to commit yet'),
    promptOption('Adjust', 'Tell me what to change (move between horizons, rename, re-word)'),
  ], { question: 'Park these on the roadmap?' });
}

/** @typedef {import('../menus.cjs').MenuRow} MenuRow */
/** @typedef {import('../menus.cjs').MenuScreen} MenuScreen */
/** @typedef {import('./surfaces.cjs').Next} Next */

/** A row leading into the conversation. @type {Next} */
const CARRY_ON = Object.freeze({ kind: 'continue' });

/** The branch an item's line opens on, under its horizon. */
const BRANCH = '  ├─ '.length;

/**
 * Where an item came from, as its line names it: discovery for one the
 * product's conversation put there, the inbox for one moved off it, the
 * roadmap for one added on its own menu, and otherwise the unit it left.
 * @param {string} origin
 */
function originOf(origin) {
  const [kind, from = ''] = origin.split(/:(.*)/);
  if (kind === 'harvest' || (kind === 'park' && from === PRODUCT)) return 'discovery';
  if (kind === 'inbox' || kind === 'roadmap') return kind;
  return kind === 'topic' ? from.split('/')[0] : from;
}

/** Items as a tree, one line each. @param {string[]} titles */
const treeLines = (titles) => renderTree(titles.map((t) => ({ title: t })), { width: Infinity }).trimEnd().split('\n');

/**
 * Each horizon's waiting items under its heading, numbered across the
 * horizons (the header's).
 * @param {{horizon: string, rows: RoadmapItemRow[]}[]} groups @param {number} width
 * @returns {string[]}
 */
function horizonLines(groups, width) {
  let n = 0;
  const numbered = groups.map(({ horizon, rows }) => ({
    horizon,
    rows: rows.map((row) => ({ text: `${++n}. ${titlecase(row.name)}`, tag: `${row.kind} · ${originOf(row.origin)}` })),
  }));
  const all = numbered.flatMap(({ rows }) => rows);
  const longest = Math.max(...all.map(({ text }) => text.length));
  const widestTag = Math.max(...all.map(({ tag }) => tag.length));
  const column = Math.min(BRANCH + longest + TAG_GAP, width - widestTag);
  return numbered.flatMap(({ horizon, rows }, i) => [
    ...(i === 0 ? [] : ['']),
    horizon === NO_HORIZON ? horizon : `${horizon} (${rows.length})`,
    ...treeLines(rows.map(({ text }) => clipped(text, column - TAG_GAP - BRANCH))).map((line, j) => line.padEnd(column) + rows[j].tag),
  ]);
}

/** The waiting items, by horizon in the person's order. @param {RoadmapState} state */
const waitingGroups = (state) => groupByHorizon(state.horizons, state.items.filter((row) => row.state === 'waiting'));

/**
 * The roadmap's screen (the header's).
 * @param {string} project @param {RoadmapState} state
 * @returns {MenuScreen}
 */
function roadmapScreen(project, state) {
  const groups = waitingGroups(state);
  /** @type {MenuRow} */
  const add = { key: 'n', word: 'new', label: 'Add an item — I\'ll ask what it is and which horizon', next: CARRY_ON };
  /** @type {MenuRow} */
  const product = { key: 'p', word: 'product', label: 'Talk about the product as a whole', next: { kind: 'handoff', skill: 'leeway-discovery', args: ['none', 'none'] } };
  /** @type {MenuScreen['back']} */
  const back = { label: 'Back to the start menu', next: { kind: 'engine', argv: ['render', 'start-menu'] } };
  const title = `Roadmap · ${project}`;
  if (groups.length === 0) return { title, shows: [], statement: 'Nothing waits on the roadmap.', rows: [add, product], back };
  return {
    title,
    shows: horizonLines(groups, TREE_WIDTH),
    rows: [
      { key: 'w', word: 'work', label: 'Work on items now — discovery finds what kind of work they are', next: CARRY_ON },
      add,
      { key: 'm', word: 'move', label: 'Move an item to another horizon you name', next: CARRY_ON },
      { key: 'a', word: 'archive', label: 'Archive an item', next: CARRY_ON },
      product,
    ],
    back,
  };
}

/** Each waiting item's number, name, horizon and summary, as a DATA section, where any waits. @param {RoadmapState} state */
function itemData(state) {
  const items = waitingGroups(state).flatMap(({ horizon, rows }) => rows.map((row) => `${row.name} · ${horizon} · ${row.summary}`));
  return items.length === 0 ? '' : dataSection(items.map((item, i) => `item ${i + 1}: ${item}`));
}

/** `render roadmap` (the header's). @param {string} cwd @returns {string} */
function roadmapSurface(cwd) {
  const state = roadmapState(cwd);
  return itemData(state) + drawMenu(cwd, MENUS.roadmap, {}, roadmapScreen(projectName(cwd), state));
}

/**
 * Lines whose tags end at the width, as the harvest's drawing puts them, a
 * line cut short where it would run within a gap of its tag.
 * @param {{text: string, tag: string}[]} rows @param {number} width
 */
function rightAligned(rows, width) {
  return rows.map(({ text, tag }) => clipped(text, width - TAG_GAP - tag.length).padEnd(width - tag.length) + tag);
}

/**
 * `render roadmap-harvest --file <items.json>` (the header's).
 * @param {string} cwd @param {string|undefined} file @returns {string}
 */
function roadmapHarvestSurface(cwd, file) {
  const entries = refusing('render roadmap-harvest', () => {
    if (file === undefined) throw new Error('--file is required — the items the session proposes, as roadmap add-batch takes them');
    return planRoadmapBatch(cwd, readPayload(cwd, file)).entries;
  });
  const one = entries.length === 1;
  const lines = treeLines(entries.map((entry) => titlecase(entry.name)));
  const shows = [`TO THE ROADMAP (${entries.length}, from this conversation)`, ...rightAligned(lines.map((text, i) => ({ text, tag: `[${entries[i].horizon}]` })), TREE_WIDTH)];
  const statement = one
    ? `Your yes puts this one on ${projectName(cwd)}'s roadmap, on the horizon you gave it.`
    : `Your yes puts these ${entries.length} on ${projectName(cwd)}'s roadmap, each on the horizon you gave it.`;
  const them = one ? 'it' : 'them';
  return section('DISPLAY: roadmap harvest', emitAs('text'), shows.join('\n'))
    + section('MENU: roadmap harvest gate', MENU_INSTRUCTION, menu(wrap(statement, displayWidth()).join('\n'), [
      cmdOption('y', 'yes', `Put ${them} on the roadmap`, { next: { kind: 'engine', argv: ['roadmap', 'add-batch', '--file', /** @type {string} */ (file)] } }),
      promptOption('Keep shaping', 'Tell me what to change — an item or its horizon', { next: CARRY_ON }),
    ], { question: `Put ${them} on the roadmap?` }));
}

module.exports = {
  groupByHorizon,
  roadmapMapView,
  roadmapAddGate,
  roadmapParksGate,
  roadmapScreen,
  roadmapSurface,
  roadmapHarvestSurface,
};
