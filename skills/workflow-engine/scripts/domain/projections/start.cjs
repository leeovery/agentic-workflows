'use strict';

// ---------------------------------------------------------------------------
// Domain ring: workflow-start projections — the Workflow Overview display and
// the unified continue/start menu over one StartDetail (see ../start.cjs),
// plus the skill's state-derived sub-views: the empty state, the inbox pickup
// and archived lists, the working set, the manage flow, and the completed &
// cancelled view. Sub-view projections return `{data, display, menu}` bodies
// (the adapter wraps them in section markers); flows with later gates also
// return labelled `sections` emitted at the same call (the mixed-type blocker).
//
// Deterministic: same detail, same string. The overview is a flat list (one
// numbered item + one └─ sub-row each, numbering continuous across the type
// sections) — composed line-by-line here, not a continuous-gutter tree. Menus
// carry machine action keys so skills route on keys, never on labels.
// ---------------------------------------------------------------------------

const { box, renderTree } = require('../../kernel/render.cjs');
const { TREE_WIDTH, titlecase } = require('../conventions.cjs');
const { combinedInbox } = require('../inbox-set.cjs');
const { menuFrame: dotMenu, menu, cmdOption, bareOption, promptOption, rangeOption, section: labelled } = require('./surfaces.cjs');

/** @typedef {import('../start.cjs').StartDetail} StartDetail */
/** @typedef {import('../start.cjs').WorkUnitEntry} WorkUnitEntry */
/** @typedef {import('../start.cjs').InboxDetail} InboxDetail */
/** @typedef {import('../inbox-set.cjs').PickupItem} PickupItem */
/** @typedef {import('../inbox-set.cjs').WorkingSetDetail} WorkingSetDetail */
/** @typedef {import('../workunit-manage.cjs').ManageDetail} ManageDetail */


/**
 * @typedef {object} StartMenuKey
 * @property {string} key             what the user types (`1`, `2`, …, `s`, `m`, …)
 * @property {string} [word]          long form of a command option (`start`, `inbox`, …)
 * @property {string} action          machine action key — skills route on this, never the label
 * @property {string} [work_type]     continue entries
 * @property {string} [work_unit]     continue entries
 * @property {string} [pre_seed]      start_new entries: `none` | a work type
 * @property {string|null} route      skill invocation, or null for internal flows
 * @property {string} label
 */

/**
 * @typedef {object} TypeSection
 * @property {string} label
 * @property {'features'|'bugfixes'|'quick_fixes'|'cross_cutting'|'epics'} group
 * @property {'feature'|'bugfix'|'quick-fix'|'cross-cutting'|'epic'} type
 */

// Display and numbering order of the type sections.
/** @type {TypeSection[]} */
const SECTIONS = [
  { label: 'Features:', group: 'features', type: 'feature' },
  { label: 'Bugfixes:', group: 'bugfixes', type: 'bugfix' },
  { label: 'Quick Fixes:', group: 'quick_fixes', type: 'quick-fix' },
  { label: 'Cross-Cutting:', group: 'cross_cutting', type: 'cross-cutting' },
  { label: 'Epics:', group: 'epics', type: 'epic' },
];

const CONTINUE_SKILL = {
  feature: 'workflow-continue-feature',
  bugfix: 'workflow-continue-bugfix',
  'quick-fix': 'workflow-continue-quickfix',
  'cross-cutting': 'workflow-continue-cross-cutting',
  epic: 'workflow-continue-epic',
};

// ---------------------------------------------------------------------------
// Shared composition helpers
// ---------------------------------------------------------------------------

// The Inbox section rows: one per live item (pickup order), the bracketed
// type riding inline after the title — unnumbered on purpose, `i/inbox` is
// where items are acted on.
/** @param {InboxDetail} inbox */
function inboxRows(inbox) {
  const items = combinedInbox(inbox);
  return items.map((item, i) => `  ${i === items.length - 1 ? '└─' : '├─'} ${item.title} [${item.type}]`);
}

// The Roadmap section rows: one per horizon, list order, the join breakdown
// riding inline — unnumbered on purpose, `r/roadmap` is where the map is
// acted on. Lifecycle arrives derived (lifecycle by join, never stored).
/** @param {StartDetail['roadmap']} roadmap */
function roadmapRows(roadmap) {
  const CATEGORIES = /** @type {const} */ ([
    ['in-flight', 'in flight'],
    ['waiting', 'waiting'],
    ['shipped', 'shipped'],
    ['orphaned', 'orphaned'],
  ]);
  const horizons = roadmap.horizons.filter((h) => roadmap.items.some((i) => i.horizon === h));
  return horizons.map((h, i) => {
    const members = roadmap.items.filter((item) => item.horizon === h);
    const parts = CATEGORIES
      .map(([state, label]) => [members.filter((m) => m.state === state).length, label])
      .filter(([n]) => Number(n) > 0)
      .map(([n, label]) => `${n} ${label}`);
    // Horizon labels render as stored — the user's own release words.
    return `  ${i === horizons.length - 1 ? '└─' : '├─'} ${h} — ${parts.join(' · ')}`;
  });
}

// The roadmap menu row — one key, the skill self-routes on state (baseline's
// pattern): an open session reads as unfinished work, otherwise the layer's
// management/continue entry. Rendered only once the layer exists.
/** @param {StartDetail} detail @returns {StartMenuKey|null} */
function roadmapMenuRow(detail) {
  if (!detail.roadmap.exists) return null;
  const label = detail.roadmap.active_session !== null
    ? 'Resume the product session — *roadmap, in progress*'
    : 'Roadmap — the product conversation, the map, or pull a slice';
  return { key: 'r', word: 'roadmap', action: 'open_roadmap', route: '/workflow-roadmap open', label };
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

/**
 * Section A — the Workflow Overview display. One code-block string: a flat
 * tree of names per non-empty type section, numbering continuous across
 * sections, the Inbox section (one row per live item), and the
 * completed/cancelled count line. A pure inventory — per-unit state lives in
 * the menu's metadata tails, never here.
 * @param {StartDetail} detail
 * @returns {string}
 */
function startOverview(detail) {
  const lines = [];
  let n = 0;
  for (const s of SECTIONS) {
    const units = detail[s.group].work_units;
    if (units.length === 0) continue;
    lines.push(s.label.replace(/:$/, ''));
    units.forEach((u, i) => {
      n += 1;
      lines.push(`  ${i === units.length - 1 ? '└─' : '├─'} ${n}. ${titlecase(u.name)}`);
    });
    lines.push('');
  }
  if (detail.roadmap.exists && detail.roadmap.items.length > 0) {
    lines.push('Roadmap');
    lines.push(...roadmapRows(detail.roadmap));
    lines.push('');
  }
  if (detail.state.has_inbox) {
    lines.push('Inbox');
    lines.push(...inboxRows(detail.inbox));
    lines.push('');
  }
  if (detail.completed_count > 0 || detail.cancelled_count > 0) {
    lines.push(`${detail.completed_count} completed, ${detail.cancelled_count} cancelled.`);
    lines.push('');
  }
  return lines.join('\n').replace(/\n+$/, '\n');
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

// The resume row for an in-progress baseline interview — unfinished
// assessment reads as unfinished work.
/** @param {StartDetail} detail */
function baselineResumeLabel(detail) {
  const n = detail.baseline.remaining;
  return `Resume the baseline interview — *${n} area${n === 1 ? '' : 's'} remaining*`;
}

// A finalising unit's entry reads `Finalise …` — the continue skill it routes
// to presents the completion gate.
/** @param {WorkUnitEntry} unit @param {TypeSection['type']} type */
function continueLabel(unit, type) {
  const t = titlecase(unit.name);
  if (type === 'epic') return `Continue "${t}" — *epic*`;
  if (unit.finalising) return `Finalise "${t}" — *${type}, ${unit.phase_label}*`;
  return `Continue "${t}" — *${type}, ${unit.phase_label}*`;
}

/**
 * Section B — the interactive menu. `keys` carries the machine action keys
 * (skills route on these); `rendered` is the dotted-gate markdown block.
 * Numbered continue entries first (overview order and numbering), then the
 * baseline resume row (`a`, in-progress only — completed manages via `m`),
 * then the start-new and lifecycle command options (`i` only with a live
 * inbox, `v` only with completed/cancelled work units).
 * @param {StartDetail} detail
 * @returns {{keys: StartMenuKey[], rendered: string}}
 */
function startMenu(detail) {
  /** @type {StartMenuKey[]} */
  const numbered = [];
  for (const s of SECTIONS) {
    for (const u of detail[s.group].work_units) {
      numbered.push({
        key: String(numbered.length + 1),
        action: 'continue_work_unit',
        work_type: s.type,
        work_unit: u.name,
        route: `/${CONTINUE_SKILL[s.type]} ${u.name}`,
        label: continueLabel(u, s.type),
      });
    }
  }

  /** @type {StartMenuKey[]} */
  const options = [];
  if (detail.baseline.status === 'in-progress') {
    options.push({ key: 'a', word: 'baseline', action: 'open_baseline', route: '/workflow-baseline', label: baselineResumeLabel(detail) });
  }
  const roadmapRow = roadmapMenuRow(detail);
  if (roadmapRow) options.push(roadmapRow);
  options.push(
    { key: 's', word: 'start', action: 'start_new', pre_seed: 'none', route: null, label: 'Start something new (not sure what kind yet)' },
    { key: 'f', word: 'feature', action: 'start_new', pre_seed: 'feature', route: null, label: 'Start new feature' },
    { key: 'e', word: 'epic', action: 'start_new', pre_seed: 'epic', route: null, label: 'Start new epic' },
    { key: 'b', word: 'bugfix', action: 'start_new', pre_seed: 'bugfix', route: null, label: 'Start new bugfix' },
    { key: 'q', word: 'quick-fix', action: 'start_new', pre_seed: 'quick-fix', route: null, label: 'Start new quick-fix' },
    { key: 'c', word: 'cross-cutting', action: 'start_new', pre_seed: 'cross-cutting', route: null, label: 'Start new cross-cutting concern' },
  );
  if (detail.state.has_inbox) {
    options.push({ key: 'i', word: 'inbox', action: 'view_inbox', route: null, label: 'View the inbox and start from an item' });
  }
  if (detail.completed_count > 0 || detail.cancelled_count > 0) {
    options.push({ key: 'v', word: 'view', action: 'view_completed', route: null, label: 'View completed & cancelled work units' });
  }
  options.push({ key: 'm', word: 'manage', action: 'manage', route: null, label: "Manage a work unit's lifecycle" });

  const lines = ['What would you like to do?', ''];
  for (const e of numbered) {
    lines.push(cmdOption(e.key, null, e.label));
  }
  for (const o of options) {
    lines.push(cmdOption(o.key, o.word, o.label));
  }

  return { keys: [...numbered, ...options], rendered: dotMenu(lines) };
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

/**
 * The empty-state Workflow Overview: no active work, closed counts when any.
 * A project with a roadmap never renders an empty screen (design/product-roadmap.md decision 21
 * — the harvested-no-work state is a real state): the horizon rows stand in
 * for the missing work sections.
 * @param {StartDetail} detail
 * @returns {string}
 */
function emptyOverview(detail) {
  let out;
  if (detail.roadmap.exists && detail.roadmap.items.length > 0) {
    out = 'No work in flight.\n\nRoadmap\n' + roadmapRows(detail.roadmap).join('\n') + '\n';
  } else if (detail.roadmap.exists && detail.roadmap.active_session !== null) {
    // Mid-genesis: a session is open but no item has landed yet. The menu
    // carries the resume row — "no active work" would contradict it.
    out = 'No work in flight.\n\nA product session is open — resume it from the menu.\n';
  } else {
    out = 'No active work found.\n';
  }
  if (detail.completed_count > 0 || detail.cancelled_count > 0) {
    out += `\n${detail.completed_count} completed, ${detail.cancelled_count} cancelled.\n`;
  }
  return out;
}

/**
 * The empty-state start menu — a baseline row first when one exists to act
 * on (`a`: resume in-progress, view/expand completed, start a declined one —
 * the empty state has no manage row, so `skipped` rides here; `none` renders
 * nothing), then the six start-new options with pipeline-shape labels, `i`
 * only with a live inbox, `v` only with closed work units. Same key shape as
 * startMenu, so the ACTIONS table and routing are uniform.
 * @param {StartDetail} detail
 * @returns {{keys: StartMenuKey[], rendered: string}}
 */
function emptyMenu(detail) {
  /** @type {StartMenuKey[]} */
  const options = [];
  if (detail.baseline.status === 'in-progress') {
    options.push({ key: 'a', word: 'baseline', action: 'open_baseline', route: '/workflow-baseline', label: baselineResumeLabel(detail) });
  } else if (detail.baseline.status === 'completed') {
    options.push({ key: 'a', word: 'baseline', action: 'open_baseline', route: '/workflow-baseline', label: 'View or expand the project baseline' });
  } else if (detail.baseline.status === 'skipped') {
    // A declined offer stays reachable here — the empty state has no manage
    // row, and this is the only surface a work-free project renders. `none`
    // stays hidden: a greenfield project never sees a baseline row.
    options.push({ key: 'a', word: 'baseline', action: 'open_baseline', route: '/workflow-baseline', label: 'Start the project baseline assessment' });
  }
  const roadmapRow = roadmapMenuRow(detail);
  if (roadmapRow) options.push(roadmapRow);
  options.push(
    { key: 's', word: 'start', action: 'start_new', pre_seed: 'none', route: null, label: "Not sure what kind yet — describe it and we'll shape it" },
    { key: 'f', word: 'feature', action: 'start_new', pre_seed: 'feature', route: null, label: 'Single topic: (research →) discussion → spec → plan → implement → review' },
    { key: 'e', word: 'epic', action: 'start_new', pre_seed: 'epic', route: null, label: 'Multiple topics, multi-session, same pipeline per topic' },
    { key: 'b', word: 'bugfix', action: 'start_new', pre_seed: 'bugfix', route: null, label: 'Investigation → spec → plan → implement → review' },
    { key: 'q', word: 'quick-fix', action: 'start_new', pre_seed: 'quick-fix', route: null, label: 'Scoping → implement → review (no formal planning)' },
    { key: 'c', word: 'cross-cutting', action: 'start_new', pre_seed: 'cross-cutting', route: null, label: '(Research →) discussion → spec (patterns or policies that inform other work)' },
  );
  if (detail.state.has_inbox) {
    const n = detail.state.inbox_count;
    options.push({ key: 'i', word: 'inbox', action: 'view_inbox', route: null, label: `View the inbox and start from an item (${n} item${n === 1 ? '' : 's'})` });
  }
  if (detail.completed_count > 0 || detail.cancelled_count > 0) {
    options.push({ key: 'v', word: 'view', action: 'view_completed', route: null, label: 'View completed & cancelled work units' });
  }

  const lines = ['What would you like to start?', ''];
  for (const o of options) {
    lines.push(cmdOption(o.key, o.word, o.label));
  }

  return { keys: options, rendered: dotMenu(lines) };
}

// ---------------------------------------------------------------------------
// Inbox pickup + archived store
// ---------------------------------------------------------------------------

/** The `n  type  date  slug  → path` table under a header line. @param {string} header @param {PickupItem[]} items */
function itemTable(header, items) {
  const lines = [`${header} (n  type  date  slug  → path):`];
  for (const item of items) {
    lines.push(`  ${item.n}  ${item.type}  ${item.date}  ${item.slug}  → ${item.path}`);
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

/**
 * The inbox pickup snapshot: the type-grouped item tree, the
 * select/archived/back menu. Selection numbers resolve through the DATA
 * `ITEMS` table, which carries the same group-major numbering as the tree.
 * @param {PickupItem[]} items      combined live inbox, pickup order
 * @param {boolean} hasArchived
 * @returns {{data: string, display: string, menu: string}}
 */
function inboxPickupView(items, hasArchived) {
  const grouped = groupedPickup(items);
  const data = [
    `inbox_count: ${items.length}`,
    `has_archived: ${hasArchived}`,
    ...itemTable('ITEMS', grouped.ordered),
  ].join('\n');

  const display = items.length > 0 ? grouped.display : 'No inbox items.\n';

  const options = [];
  if (items.length === 1) {
    options.push(cmdOption('1', null, 'Select the item to work on'));
  } else if (items.length > 1) {
    options.push(rangeOption(1, items.length, 'Select item(s) to work on (comma-separated for several)'));
  }
  if (hasArchived) options.push(cmdOption('a', 'archived', 'View archived items (restore or delete)'));
  options.push(cmdOption('b', 'back', 'Return'));

  return { data, display, menu: dotMenu(['What would you like to do?', '', ...options]) };
}

/**
 * The archived-store snapshot: numbered archived items and the select prompt
 * (empty menu when nothing is archived).
 * @param {PickupItem[]} items  combined archived items, pickup order
 * @returns {{data: string, display: string, menu: string}}
 */
function archivedView(items) {
  const grouped = groupedPickup(items);
  const data = [
    `archived_count: ${items.length}`,
    ...itemTable('ITEMS', grouped.ordered),
  ].join('\n');

  const display = items.length > 0 ? grouped.display : 'No archived items.\n';

  const menu = items.length > 0
    ? dotMenu(['Select an item (enter number, or **`b/back`** to return):'])
    : '';

  return { data, display, menu };
}

// ---------------------------------------------------------------------------
// Working set
// ---------------------------------------------------------------------------

/**
 * The working-set snapshot: the set tree (summaries are model-synthesised and
 * arrive via the caller's payload, keyed by inbox path — a row renders
 * without a body when its summary is missing), the set menu (`w/work` renders
 * only for a type-uniform set), a `DISPLAY: blocker` section on a mixed-type
 * set. The add/drop gate sections are served by workingSetAddGate /
 * workingSetDropGate, fetched by the gateway verbs at each gate.
 * @param {WorkingSetDetail} ws
 * @param {Record<string, string>} [summaries]
 * @returns {{data: string, title: string, display: string, menu: string, sections: string}}
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
    `set_uniform: ${ws.uniform}`,
    `set_type: ${ws.set_type}`,
    `addable_count: ${ws.addable.length}`,
    ...itemTable('SET', ws.items),
    ...itemTable('ADDABLE', ws.addable),
  ].join('\n');

  const options = [];
  if (ws.uniform) options.push(cmdOption('w', 'work', 'Proceed to discovery with this set'));
  options.push(
    cmdOption('a', 'add', 'Add another inbox item to the set'),
    cmdOption('d', 'drop', 'Drop item(s) from the set (keeps them in the inbox)'),
    cmdOption('r', 'archive', 'Archive the whole set out of the inbox'),
    cmdOption('v', 'view', 'View full content of the set'),
    cmdOption('b', 'back', 'Return to the inbox list'),
    promptOption('Ask', 'Ask about the set'),
  );
  const menu = dotMenu([
    'Type a shortcut, or just tell me in your own words — e.g. "add 2 and 4", "drop the bug", "archive these".',
    '',
    '**`◆ What would you like to do?`**',
    '',
    ...options,
  ]);

  const sections = [];
  if (!ws.uniform) {
    sections.push(labelled(
      'DISPLAY: blocker',
      'emit verbatim as a properties code block (```properties fence — it renders the blocker red) directly after the display',
      '⚑ Work is unavailable while the set mixes types — drop to a single type to enable it.',
    ));
  }

  return { data, title, display, menu, sections: sections.join('\n') };
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
  return [
    labelled(
      'DISPLAY: add candidates',
      'emit verbatim as a code block',
      ws.addable.map((item) => `  ${item.n}. ${item.title} [${item.type}] — ${item.date}`).join('\n'),
    ),
    labelled(
      'MENU: add gate',
      "emit verbatim as markdown, then STOP for the user's response",
      dotMenu(['Add which? (enter number(s), comma-separated, or **`b/back`**)']),
    ),
  ].join('\n');
}

/**
 * The drop-items gate over the working set, served by the gateway's
 * `working-set-drop-gate` verb at the gate that displays it.
 * @param {WorkingSetDetail} ws
 * @returns {string}
 */
function workingSetDropGate(ws) {
  return [
    labelled(
      'DISPLAY: drop candidates',
      'emit verbatim as a code block',
      ws.items.map((item) => `  ${item.n}. ${item.title} [${item.type}]`).join('\n'),
    ),
    labelled(
      'MENU: drop gate',
      "emit verbatim as markdown, then STOP for the user's response",
      dotMenu(['Drop which? (enter number(s), comma-separated, or **`b/back`**)']),
    ),
  ].join('\n');
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
 * The manage selection snapshot: every active work unit by type, numbering
 * continuous across sections — the same order and numbers as the overview.
 * @param {StartDetail} detail
 * @returns {{data: string, display: string, menu: string, rows: ManageRow[]}}
 */
function manageListView(detail) {
  /** @type {ManageRow[]} */
  const rows = [];
  const displayLines = [];
  for (const s of SECTIONS) {
    const units = detail[s.group].work_units;
    if (units.length === 0) continue;
    displayLines.push(s.label.replace(/:$/, ''));
    units.forEach((u, i) => {
      rows.push({ n: rows.length + 1, work_type: s.type, work_unit: u.name });
      displayLines.push(`  ${i === units.length - 1 ? '└─' : '├─'} ${rows.length}. ${titlecase(u.name)}`);
    });
    displayLines.push('');
  }

  const data = [
    `unit_count: ${rows.length}`,
    `baseline: ${detail.baseline.status}`,
    'UNITS (n  work_type  work_unit):',
    ...rows.map((r) => `  ${r.n}  ${r.work_type}  ${r.work_unit}`),
  ].join('\n');

  const display = ''
    + (rows.length > 0 ? displayLines.join('\n') : 'No active work units.\n');

  // The project baseline manages from here too — it is not a work unit, so
  // it rides as a command option rather than a numbered row. Label follows
  // its status; the skill self-routes on the same state.
  const baselineOption = {
    'in-progress': 'Resume the baseline interview',
    completed: 'View or expand the project baseline',
    skipped: 'Start the project baseline assessment',
    none: 'Start the project baseline assessment',
  }[detail.baseline.status];
  const menuLines = [
    cmdOption('a', 'baseline', baselineOption),
    '',
    'Select a work unit (enter number, or **`b/back`** to return):',
  ];

  const menu = rows.length > 0
    ? dotMenu(menuLines)
    : '';

  return { data, display, menu, rows };
}

/**
 * One work unit's manage snapshot: the action menu offering exactly the
 * actions its state allows. The absorb-target and view-plan topic gates are
 * served by their own render surfaces, fetched at each gate.
 * @param {ManageDetail} md
 * @returns {{data: string, menu: string}}
 */
function manageUnitView(md) {
  /** @type {[string, string][]} */
  const actions = [];
  const options = [];
  if (md.implementation_completed) {
    actions.push(['d', 'mark_completed']);
    options.push(cmdOption('d', 'done', 'Mark as completed'));
  }
  if (md.work_type === 'feature') {
    actions.push(['p', 'pivot']);
    options.push(cmdOption('p', 'pivot', 'Convert to epic (enables multiple topics)'));
  }
  if (md.absorb_available) {
    actions.push(['a', 'absorb']);
    options.push(cmdOption('a', 'absorb', 'Merge into an existing epic'));
  }
  if (md.has_plan) {
    actions.push(['v', 'view_plan']);
    options.push(cmdOption('v', 'view-plan', 'View the implementation plan'));
  }
  actions.push(['c', 'cancel'], ['b', 'back']);
  options.push(
    cmdOption('c', 'cancel', 'Mark as cancelled'),
    cmdOption('b', 'back', 'Return'),
    promptOption('Ask', 'Ask a question about this work unit'),
  );

  const data = [
    `work_unit: ${md.work_unit}`,
    `work_type: ${md.work_type}`,
    `status: ${md.status}`,
    `implementation_completed: ${md.implementation_completed}`,
    `has_plan: ${md.has_plan}`,
    `has_spec: ${md.has_spec}`,
    `has_discussion: ${md.has_discussion}`,
    `absorb_available: ${md.absorb_available}`,
    `available_epics: ${md.available_epics.join(', ') || '(none)'}`,
    `planning_topics: ${md.planning_topics.map((t) => `${t.name} [${t.status}]`).join(', ') || '(none)'}`,
    'ACTIONS (key  action):',
    ...actions.map(([k, a]) => `  ${k}  ${a}`),
  ].join('\n');

  const menu = dotMenu([
    `**${titlecase(md.work_unit)}** (${md.work_type})`,
    '',
    ...options,
  ]);

  return { data, menu };
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
    "emit verbatim as markdown, then STOP for the user's response",
    dotMenu([
      'Select a target epic:',
      '',
      ...md.available_epics.map((name, i) => cmdOption(String(i + 1), null, titlecase(name))),
      '',
      cmdOption('b', 'back', 'Return'),
    ]),
  );
}

/**
 * The absorb name-confirm gate, served by `render absorb-name-gate` — the
 * default topic name (the feature's own) offered before the collision check.
 * @param {ManageDetail} md @param {string} epic
 * @returns {string}
 */
function absorbNameGate(md, epic) {
  return labelled(
    'MENU: absorb name gate',
    "emit verbatim as markdown, then STOP for the user's response",
    menu(`Topic name in **${titlecase(epic)}**: **${md.work_unit}**`, [
      cmdOption('y', 'yes', 'Use this name'),
      cmdOption('b', 'back', 'Return'),
      promptOption('Rename', 'Enter a different name (kebab-case)'),
    ], { question: 'Is this name okay?' }),
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
    "emit verbatim as markdown, then STOP for the user's response",
    menu('', [bareOption('y', 'yes'), bareOption('n', 'no')], { question: 'Proceed?' }),
  );
}

/**
 * The view-plan topic selection menu, served by `render plan-topics` at the
 * gate that displays it. Numbering follows `planning_topics` order.
 * @param {ManageDetail} md
 * @returns {string}
 */
function planTopicsMenu(md) {
  return labelled(
    'MENU: plan topics',
    "emit verbatim as markdown, then STOP for the user's response",
    dotMenu([
      'Which plan would you like to view?',
      '',
      ...md.planning_topics.map((t, i) => cmdOption(String(i + 1), null, `${titlecase(t.name)} — *${t.status}*`)),
    ]),
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

// The `Showing:` label per work-type filter — the overview's section labels.
/** @type {Record<string, string>} */
const FILTER_LABELS = {
  feature: 'Features',
  bugfix: 'Bugfixes',
  'quick-fix': 'Quick Fixes',
  'cross-cutting': 'Cross-Cutting',
  epic: 'Epics',
};

/** One closed-set tree: numbered rows, the closing phase as each row's body. @param {ClosedRow[]} rows @param {string} label */
function closedTree(rows, label) {
  return renderTree(
    rows.map((r) => ({ title: `${r.n}. ${titlecase(r.work_unit)}`, body: [`${label}: ${r.last_phase}`] })),
    { width: TREE_WIDTH, bodyIndent: 1 },
  ).replace(/\n$/, '');
}

/**
 * The completed & cancelled snapshot, optionally filtered to one work type
 * (the per-type navigation skills pass their own). Numbering is continuous
 * across the two lists; numbers resolve through the DATA `UNITS` table.
 * @param {StartDetail} detail
 * @param {string} [filter]  a work type, or undefined for all
 * @returns {{data: string, display: string, menu: string, rows: ClosedRow[]}}
 */
function completedView(detail, filter) {
  if (filter !== undefined && !FILTER_LABELS[filter]) {
    throw new Error(`unknown work-type filter "${filter}" (${Object.keys(FILTER_LABELS).join(' | ')})`);
  }
  const match = (/** @type {import('../start.cjs').ClosedEntry} */ e) => filter === undefined || e.work_type === filter;
  /** @type {ClosedRow[]} */
  const rows = [];
  for (const e of [...detail.completed.filter(match), ...detail.cancelled.filter(match)]) {
    rows.push({ n: rows.length + 1, status: e.status, work_type: e.work_type, work_unit: e.name, last_phase: e.last_phase || 'none' });
  }
  const completedRows = rows.filter((r) => r.status === 'completed');
  const cancelledRows = rows.filter((r) => r.status === 'cancelled');

  const data = [
    `filter: ${filter || '(none)'}`,
    `completed_count: ${completedRows.length}`,
    `cancelled_count: ${cancelledRows.length}`,
    'UNITS (n  status  work_type  work_unit  last_phase):',
    ...rows.map((r) => `  ${r.n}  ${r.status}  ${r.work_type}  ${r.work_unit}  ${r.last_phase}`),
  ].join('\n');

  let display = '';
  if (rows.length === 0) {
    display += 'No completed or cancelled work units found.\n';
  } else {
    const lines = [];
    if (filter !== undefined) {
      lines.push(`Showing: ${FILTER_LABELS[filter]}`);
      lines.push('');
    }
    // Each list is one tree off its header: the closing phase is the row's
    // body, so the branch glyphs stay positional (`└─` marks the last row of
    // the group, never every row's sub-line).
    if (completedRows.length > 0) {
      lines.push('Completed');
      lines.push(closedTree(completedRows, 'Completed after'));
      lines.push('');
    }
    if (cancelledRows.length > 0) {
      lines.push('Cancelled');
      lines.push(closedTree(cancelledRows, 'Cancelled during'));
      lines.push('');
    }
    display += lines.join('\n').replace(/\n+$/, '\n');
  }

  const menu = rows.length > 0
    ? dotMenu([
      'Select a work unit (enter number) for details, or **`b/back`** to return.',
    ])
    : '';

  return { data, display, menu, rows };
}

module.exports = {
  startOverview,
  startMenu,
  emptyOverview,
  emptyMenu,
  inboxPickupView,
  archivedView,
  workingSetView,
  workingSetAddGate,
  workingSetDropGate,
  manageListView,
  manageUnitView,
  absorbTargetMenu,
  absorbNameGate,
  absorbConfirmGate,
  planTopicsMenu,
  completedView,
};
