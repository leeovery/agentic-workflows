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
//   A DATA section gives each number's item, its summary told from
//   `roadmap state` when it is picked or asked about (18.8.5). Rows:
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
//
// Horizons are the person's own release labels, drawn as they wrote them;
// position carries the semantics, so groups render in list order.
// ---------------------------------------------------------------------------

const { renderTree, wrap, TAG_GAP } = require('../../kernel/render.cjs');
const { displayWidth } = require('../../kernel/terminal.cjs');
const { TREE_WIDTH, titlecase } = require('../conventions.cjs');
const { section, dataSection, menu, cmdOption, promptOption, emitAs, clipped, MENU_INSTRUCTION } = require('./surfaces.cjs');
const { planRoadmapBatch, roadmapState } = require('../roadmap.cjs');
const { projectName } = require('../state-checks.cjs');
const { readPayload, refusing } = require('../staged-payload.cjs');
const { MENUS, drawMenu } = require('../menus.cjs');
const { PRODUCT } = require('../../kernel/manifest-schema.cjs');

/** @typedef {import('../roadmap.cjs').RoadmapItemRow} RoadmapItemRow */
/** @typedef {ReturnType<import('../roadmap.cjs').roadmapState>} RoadmapState */

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

/** Each waiting item's number and name, as a DATA section, where any waits. @param {RoadmapState} state */
function itemData(state) {
  const names = waitingGroups(state).flatMap(({ rows }) => rows.map((row) => row.name));
  return names.length === 0 ? '' : dataSection(names.map((name, i) => `item ${i + 1}: ${name}`));
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
  roadmapScreen,
  roadmapSurface,
  roadmapHarvestSurface,
};
