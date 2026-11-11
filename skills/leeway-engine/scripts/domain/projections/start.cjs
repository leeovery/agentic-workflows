'use strict';

// ---------------------------------------------------------------------------
// Domain ring: leeway projections — the start skill's state-derived
// sub-views over one StartDetail (see ../start.cjs): the inbox pickup and
// archived lists, the working set, the manage flow, and the completed &
// cancelled view. Sub-view projections return `{data, display, menu}` bodies
// — a pick view carries its menu, or its display when there is nothing to
// pick (the adapter wraps them in section markers). The start menu itself is
// start-menu.cjs's.
//
// Deterministic: same detail, same string. Menus carry machine action keys so
// skills route on keys, never on labels.
// ---------------------------------------------------------------------------

const { renderTree } = require('../../kernel/render.cjs');
const { TREE_WIDTH, titlecase } = require('../conventions.cjs');
const { menuFrame: dotMenu, menu, cmdOption, bareOption, promptOption, rangeOption, actionsTable, section: labelled, MENU_INSTRUCTION, CONTINUE_MARKDOWN_INSTRUCTION } = require('./surfaces.cjs');
const { escapeMarkdown } = require('./worklist.cjs');

/** @typedef {import('../start.cjs').StartDetail} StartDetail */
/** @typedef {import('../inbox-set.cjs').PickupItem} PickupItem */
/** @typedef {import('../inbox-set.cjs').WorkingSetDetail} WorkingSetDetail */
/** @typedef {import('../workunit-manage.cjs').ManageDetail} ManageDetail */
/** @typedef {import('./surfaces.cjs').LabelParts} LabelParts */

/**
 * @typedef {object} TypeSection
 * @property {string} label
 * @property {'features'|'bugfixes'|'quick_fixes'|'epics'} group
 * @property {'feature'|'bugfix'|'quick-fix'|'epic'} type
 */

// Display and numbering order of the type sections.
/** @type {TypeSection[]} */
const SECTIONS = [
  { label: 'Features:', group: 'features', type: 'feature' },
  { label: 'Bugfixes:', group: 'bugfixes', type: 'bugfix' },
  { label: 'Quick Fixes:', group: 'quick_fixes', type: 'quick-fix' },
  { label: 'Epics:', group: 'epics', type: 'epic' },
];

// ---------------------------------------------------------------------------
// Inbox pickup + archived store
// ---------------------------------------------------------------------------

/** The `n  type  date  slug  → path  — title` table under a header line. @param {string} header @param {PickupItem[]} items */
function itemTable(header, items) {
  const lines = [`${header} (n  type  date  slug  → path  — title):`];
  for (const item of items) {
    lines.push(`  ${item.n}  ${item.type}  ${item.date}  ${item.slug}  → ${item.path}  — ${item.title}`);
  }
  return lines;
}

// Display order and headers of the pickup type groups.
const PICKUP_GROUPS = /** @type {const} */ ([
  ['ideas', 'Ideas'], ['bugs', 'Bugs'], ['quickfixes', 'Quick Fixes'],
]);

// The grouped pickup tree: one header per non-empty folder, items renumbered
// group-major (date order within a group) so the display numbering and the
// DATA `ITEMS` table always agree. Returns the reordered copies alongside the
// rendered lines — callers must feed the same copies to `itemTable`.
/** @param {PickupItem[]} items @returns {{ordered: PickupItem[], display: string}} */
function groupedPickup(items) {
  /** @type {PickupItem[]} */
  const ordered = [];
  const lines = [];
  for (const [folder, header] of PICKUP_GROUPS) {
    const group = items.filter((i) => i.folder === folder);
    if (group.length === 0) continue;
    if (lines.length) lines.push('');
    lines.push(header);
    group.forEach((item, gi) => {
      const copy = { ...item, n: ordered.length + 1 };
      ordered.push(copy);
      lines.push(`  ${gi === group.length - 1 ? '└─' : '├─'} ${copy.n}. ${copy.title} [${copy.date}]`);
    });
  }
  return { ordered, display: lines.join('\n') + '\n' };
}

// A pickup item as a pick-menu row's label — the title the head, escaped
// because the person wrote it, its metadata the tail.
/** @param {PickupItem} item @param {string} meta @returns {import('./surfaces.cjs').LabelParts} */
function itemLabel(item, meta) {
  return { head: escapeMarkdown(item.title), tail: meta };
}

/**
 * The inbox pickup snapshot: the type-grouped item tree, the
 * select/archived/back menu. Selection numbers resolve through the DATA
 * `ITEMS` table, which carries the same group-major numbering as the tree.
 * An empty inbox is the display that says so and no menu — the flow returns
 * to its caller without a pick to take.
 * @param {PickupItem[]} items      combined live inbox, pickup order
 * @param {boolean} hasArchived
 * @returns {{data: string, display: string, menu?: string}}
 */
function inboxPickupView(items, hasArchived) {
  const grouped = groupedPickup(items);
  const data = [
    `inbox_count: ${items.length}`,
    `has_archived: ${hasArchived}`,
    ...itemTable('ITEMS', grouped.ordered),
  ].join('\n');

  if (items.length === 0) return { data, display: 'No inbox items.\n' };

  const options = [items.length === 1
    ? cmdOption('1', null, 'Triage the item — archive it, put it on the roadmap, or start work')
    : rangeOption(1, items.length, 'Triage item(s) — archive, put on the roadmap, or start work (comma-separated for several)')];
  if (hasArchived) options.push(cmdOption('a', 'archived', 'View archived items (restore or delete)'));
  options.push(cmdOption('b', 'back', 'Return'));

  return { data, display: grouped.display, menu: dotMenu(['What would you like to do?', '', ...options]) };
}

/**
 * The archived-store snapshot: the archived items as a numbered pick menu,
 * group-major like the pickup — or, with nothing archived, the empty display
 * and no menu.
 * @param {PickupItem[]} items  combined archived items, pickup order
 * @returns {{data: string, display?: string, menu?: string}}
 */
function archivedView(items) {
  const { ordered } = groupedPickup(items);
  const data = [
    `archived_count: ${items.length}`,
    ...itemTable('ITEMS', ordered),
  ].join('\n');

  if (items.length === 0) return { data, display: 'No archived items.\n' };

  return {
    data,
    menu: menu('Which item?', [
      ...ordered.map((item) => cmdOption(String(item.n), null, itemLabel(item, `${item.type}, ${item.date}`))),
      cmdOption('b', 'back', 'Return to the inbox'),
    ]),
  };
}

/**
 * The archived item's action menu, served by `render archived-actions` once
 * the sub-view holds a selection: view, restore, delete, back.
 * @param {PickupItem} item
 * @returns {string}
 */
function archivedActions(item) {
  return labelled(
    'MENU: archived actions',
    MENU_INSTRUCTION,
    menu(`Selected: **${escapeMarkdown(item.title)}** (${item.type}, archived)`, [
      cmdOption('v', 'view', 'View full content'),
      cmdOption('u', 'unarchive', 'Restore to the inbox'),
      cmdOption('d', 'delete', 'Permanently delete (removes the file from git)'),
      cmdOption('b', 'back', 'Return to the archived list'),
    ], { question: 'What would you like to do with it?' }),
  );
}

/**
 * Inbox items in full, served by `render inbox-content` — each opens on its
 * italic type-and-date line, its divider, then its own content as written,
 * whose heading is its visible title. Markdown, so that content renders.
 * @param {{item: PickupItem, body: string}[]} entries
 * @returns {string}
 */
function inboxContent(entries) {
  const blocks = entries.map(({ item, body }) => [`*[${item.type}] — ${item.date}*`, ...(body ? ['', body] : [])].join('\n'));
  return labelled('DISPLAY: inbox content', CONTINUE_MARKDOWN_INSTRUCTION, blocks.join('\n\n'));
}

/**
 * The archived item's delete consent, served by `render archived-delete-gate`
 * — the consequence stated, then the ask.
 * @param {PickupItem} item
 * @returns {string}
 */
function archivedDeleteGate(item) {
  return labelled(
    'MENU: archived delete gate',
    MENU_INSTRUCTION,
    menu(`Permanently deleting "${escapeMarkdown(item.title)}" removes the file from the repo and cannot be undone.`, [
      cmdOption('y', 'yes', 'Delete permanently'),
      cmdOption('n', 'no', 'Return'),
    ], { question: 'Delete it?' }),
  );
}

// ---------------------------------------------------------------------------
// Working set
// ---------------------------------------------------------------------------

/**
 * The working-set snapshot: the set tree (summaries are model-synthesised and
 * arrive via the caller's payload, keyed by inbox path — a row renders
 * without a body when its summary is missing) and the set menu. The add/drop
 * gate sections are served by workingSetAddGate / workingSetDropGate,
 * fetched by the gateway verbs at each gate.
 * @param {WorkingSetDetail} ws
 * @param {Record<string, string>} [summaries]
 * @returns {{data: string, title: string, display: string, menu: string}}
 */
function workingSetView(ws, summaries = {}) {
  // The heading is the adapter's TITLE section, as every sibling sub-view's
  // is; the count rides it, since the set's size is what the screen is about.
  const title = `Working Set (${ws.count} item${ws.count === 1 ? '' : 's'})`;
  const display = renderTree(ws.items.map((item) => {
    const summary = summaries[item.path];
    return {
      title: `${item.title} [${item.type}]`,
      ...(summary ? { body: [summary] } : {}),
    };
  }), { width: TREE_WIDTH, gap: true, bodyIndent: 1 });

  const data = [
    `set_count: ${ws.count}`,
    `set_type: ${ws.set_type}`,
    `addable_count: ${ws.addable.length}`,
    ...itemTable('SET', ws.items),
    ...itemTable('ADDABLE', ws.addable),
  ].join('\n');

  const options = [
    cmdOption('w', 'work', 'Proceed to discovery with this set'),
    cmdOption('o', 'roadmap', 'Move the set out of the inbox onto the roadmap'),
    cmdOption('a', 'add', 'Add another inbox item to the set'),
    cmdOption('d', 'drop', 'Drop item(s) from the set (keeps them in the inbox)'),
    cmdOption('r', 'archive', 'Archive the whole set out of the inbox'),
    cmdOption('v', 'view', 'View full content of the set'),
    cmdOption('b', 'back', 'Return to the inbox list'),
    promptOption('Ask', 'Ask about the set'),
  ];
  const menu = dotMenu([
    'Type a shortcut, or just tell me in your own words — e.g. "add 2 and 4", "drop the bug", "archive these".',
    '',
    '**`◆ What would you like to do?`**',
    '',
    ...options,
  ]);

  return { data, title, display, menu };
}

// The add and drop gates' pick: one row per candidate, several picks
// comma-separated.
/** @param {string} question @param {PickupItem[]} items @param {(item: PickupItem) => string} meta */
function workingSetPick(question, items, meta) {
  return menu('Pick one, or several comma-separated.', [
    ...items.map((item) => cmdOption(String(item.n), null, itemLabel(item, meta(item)))),
    cmdOption('b', 'back', 'Return to the working set'),
  ], { question });
}

/**
 * The add-items gate over the working set's addable rows, served by the
 * gateway's `working-set-add-gate` verb at the gate that displays it.
 * @param {WorkingSetDetail} ws
 * @returns {string}
 */
function workingSetAddGate(ws) {
  if (ws.addable.length === 0) {
    throw new Error('working-set-add-gate: nothing addable — the whole inbox is already in the set');
  }
  return labelled(
    'MENU: add gate',
    MENU_INSTRUCTION,
    workingSetPick('Add which?', ws.addable, (item) => `${item.type}, ${item.date}`),
  );
}

/**
 * The drop-items gate over the working set, served by the gateway's
 * `working-set-drop-gate` verb at the gate that displays it.
 * @param {WorkingSetDetail} ws
 * @returns {string}
 */
function workingSetDropGate(ws) {
  return labelled(
    'MENU: drop gate',
    MENU_INSTRUCTION,
    workingSetPick('Drop which?', ws.items, (item) => item.type),
  );
}

// ---------------------------------------------------------------------------
// Manage
// ---------------------------------------------------------------------------

/**
 * @typedef {object} ManageRow
 * @property {number} n
 * @property {string} work_type
 * @property {string} work_unit
 */

/**
 * The manage selection snapshot: every active work unit as a numbered pick
 * row, numbering continuous across the type sections — the same order and
 * numbers as the overview.
 * @param {StartDetail} detail
 * @returns {{data: string, menu: string, rows: ManageRow[]}}
 */
function manageListView(detail) {
  /** @type {ManageRow[]} */
  const rows = SECTIONS.flatMap((s) => detail[s.group].work_units.map((u) => ({ work_type: u.work_type, work_unit: u.name })))
    .map((r, i) => ({ n: i + 1, ...r }));

  const data = [
    `unit_count: ${rows.length}`,
    'UNITS (n  work_type  work_unit):',
    ...rows.map((r) => `  ${r.n}  ${r.work_type}  ${r.work_unit}`),
  ].join('\n');

  return {
    data,
    menu: menu('Which work unit?', [
      ...rows.map((r) => cmdOption(String(r.n), null, { head: titlecase(r.work_unit), tail: r.work_type })),
      cmdOption('b', 'back', 'Return'),
    ]),
    rows,
  };
}

/**
 * One work unit's manage snapshot: the action menu offering exactly the
 * actions its state allows. The absorb-target gate is served by its own
 * render surface, fetched at the gate.
 * @param {ManageDetail} md
 * @returns {{data: string, menu: string}}
 */
function manageUnitView(md) {
  /** @type {{key: string, word: string, action: string, label: string}[]} */
  const keys = [];
  if (md.work_type === 'feature') keys.push({ key: 'p', word: 'pivot', action: 'pivot', label: 'Convert to epic (enables multiple topics)' });
  if (md.absorb_available) keys.push({ key: 'a', word: 'absorb', action: 'absorb', label: 'Merge into an existing epic' });
  if (md.has_build) keys.push({ key: 'v', word: 'view-build', action: 'view_build', label: 'View the build\'s phases and tasks' });
  keys.push(
    { key: 'c', word: 'cancel', action: 'cancel', label: 'Mark as cancelled' },
    { key: 'b', word: 'back', action: 'back', label: 'Return' },
  );
  const options = [
    ...keys.map((k) => cmdOption(k.key, k.word, k.label)),
    promptOption('Ask', 'Ask a question about this work unit'),
  ];

  const data = [
    `work_unit: ${md.work_unit}`,
    `work_type: ${md.work_type}`,
    `status: ${md.status}`,
    `has_build: ${md.has_build}`,
    `has_spec: ${md.has_spec}`,
    `has_discussion: ${md.has_discussion}`,
    `absorb_available: ${md.absorb_available}`,
    `available_epics: ${md.available_epics.join(', ') || '(none)'}`,
    ...actionsTable(['action'], keys, (k) => [k.action]),
  ].join('\n');

  return { data, menu: menu(`**${titlecase(md.work_unit)}** (${md.work_type})`, options, { question: 'What would you like to do?' }) };
}

/**
 * The absorb-target selection menu, served by `render absorb-target` at the
 * gate that displays it. Numbering follows `available_epics` order.
 * @param {ManageDetail} md
 * @returns {string}
 */
function absorbTargetMenu(md) {
  return labelled(
    'MENU: absorb target',
    MENU_INSTRUCTION,
    dotMenu([
      'Which epic should absorb it?',
      '',
      ...md.available_epics.map((name, i) => cmdOption(String(i + 1), null, titlecase(name))),
      '',
      cmdOption('b', 'back', 'Return'),
    ]),
  );
}

/**
 * The absorb proceed gate, served by `render absorb-confirm-gate` beneath
 * the summary the calling prose renders — the transaction's consent.
 * @returns {string}
 */
function absorbConfirmGate() {
  return labelled(
    'MENU: absorb confirm gate',
    MENU_INSTRUCTION,
    menu('', [bareOption('y', 'yes'), bareOption('n', 'no')], { question: 'Proceed?' }),
  );
}

// ---------------------------------------------------------------------------
// Completed & cancelled
// ---------------------------------------------------------------------------

/**
 * @typedef {object} ClosedRow
 * @property {number} n
 * @property {string} status
 * @property {string} work_type
 * @property {string} work_unit
 * @property {string} last_phase
 */

// A closed row's tail: how it closed, and in which phase.
/** @type {Record<string, string>} */
const CLOSED_TAIL = { completed: 'completed after', cancelled: 'cancelled during' };

/**
 * The completed & cancelled snapshot: completed then cancelled as one
 * numbered pick menu, numbers resolving through the DATA `UNITS` table — or,
 * with nothing closed, the empty display and no menu.
 * @param {StartDetail} detail
 * @returns {{data: string, display?: string, menu?: string, rows: ClosedRow[]}}
 */
function completedView(detail) {
  /** @type {ClosedRow[]} */
  const rows = [...detail.completed, ...detail.cancelled]
    .map((e, i) => ({ n: i + 1, status: e.status, work_type: e.work_type, work_unit: e.name, last_phase: e.last_phase || 'none' }));

  const data = [
    `completed_count: ${rows.filter((r) => r.status === 'completed').length}`,
    `cancelled_count: ${rows.filter((r) => r.status === 'cancelled').length}`,
    'UNITS (n  status  work_type  work_unit  last_phase):',
    ...rows.map((r) => `  ${r.n}  ${r.status}  ${r.work_type}  ${r.work_unit}  ${r.last_phase}`),
  ].join('\n');

  if (rows.length === 0) return { data, display: 'No completed or cancelled work units found.\n', rows };

  const options = [
    ...rows.map((r) => cmdOption(String(r.n), null, { head: titlecase(r.work_unit), tail: `${CLOSED_TAIL[r.status]} ${r.last_phase}` })),
    cmdOption('b', 'back', 'Return'),
  ];
  return { data, menu: menu('Which work unit?', options), rows };
}

/**
 * The selected unit's action menu, served by `render completed-actions` once
 * the list's number resolves to a row: reactivate, back, ask.
 * @param {string} workUnit
 * @param {string} status  `completed` or `cancelled`
 * @returns {string}
 */
function completedActions(workUnit, status) {
  return labelled(
    'MENU: completed actions',
    MENU_INSTRUCTION,
    menu(`**${titlecase(workUnit)}** (${status})`, [
      cmdOption('r', 'reactivate', 'Set status back to in-progress'),
      cmdOption('b', 'back', 'Return to the list'),
      promptOption('Ask', 'Ask a question about this work unit'),
    ], { question: 'What would you like to do?' }),
  );
}

module.exports = {
  inboxPickupView,
  archivedView,
  archivedActions,
  archivedDeleteGate,
  inboxContent,
  workingSetView,
  workingSetAddGate,
  workingSetDropGate,
  manageListView,
  manageUnitView,
  absorbTargetMenu,
  absorbConfirmGate,
  completedView,
  completedActions,
};
