'use strict';

// ---------------------------------------------------------------------------
// Domain ring: workflow-start projections — the Workflow Overview display and
// the unified continue/start menu over one StartDetail (see ../start.cjs),
// plus the skill's state-derived sub-views: the empty state, the inbox pickup
// and archived lists, the working set, the manage flow, and the completed &
// cancelled view. Sub-view projections return `{data, display, menu}` bodies
// (the adapter wraps them in section markers); flows with later gates also
// return labelled deferred `sections`, emitted only where their marker says.
//
// Deterministic: same detail, same string. The overview is a flat list (one
// numbered item + one └─ sub-row each, numbering continuous across the type
// sections) — composed line-by-line here, not a continuous-gutter tree. Menus
// carry machine action keys so skills route on keys, never on labels.
// ---------------------------------------------------------------------------

const { box } = require('../../kernel/render.cjs');
const { titlecase, capitalise } = require('../conventions.cjs');

/** @typedef {import('../start.cjs').StartDetail} StartDetail */
/** @typedef {import('../start.cjs').WorkUnitEntry} WorkUnitEntry */
/** @typedef {import('../start.cjs').InboxDetail} InboxDetail */
/** @typedef {import('../inbox-set.cjs').PickupItem} PickupItem */
/** @typedef {import('../inbox-set.cjs').WorkingSetDetail} WorkingSetDetail */
/** @typedef {import('../workunit-manage.cjs').ManageDetail} ManageDetail */

const DOTS = '· · · · · · · · · · · ·';

/** Dot-framed menu block. @param {string[]} lines @returns {string} */
function dotMenu(lines) {
  return [DOTS, ...lines, DOTS].join('\n');
}

/** One labelled `=== NAME (instruction) ===` deferred section. @param {string} name @param {string} instruction @param {string} body */
function labelled(name, instruction, body) {
  return `=== ${name} (${instruction}) ===\n${body.replace(/\n+$/, '')}\n`;
}

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

// Titlecase a phase label without disturbing its punctuation: every alphabetic
// run is capitalised in place, so parentheses and hyphens survive.
// `discussion (in-progress)` → `Discussion (In-Progress)`.
/** @param {string} s */
function titlecaseLabel(s) {
  return String(s).replace(/[a-z]+/gi, (w) => capitalise(w));
}

/** One-line inbox count hint — non-zero categories, pluralised. @param {InboxDetail} inbox */
function inboxHint(inbox) {
  const parts = [];
  if (inbox.idea_count > 0) parts.push(`${inbox.idea_count} idea${inbox.idea_count === 1 ? '' : 's'}`);
  if (inbox.bug_count > 0) parts.push(`${inbox.bug_count} bug${inbox.bug_count === 1 ? '' : 's'}`);
  if (inbox.quickfix_count > 0) parts.push(`${inbox.quickfix_count} quick-fix${inbox.quickfix_count === 1 ? '' : 'es'}`);
  return parts.join(', ');
}

// The └─ sub-row: epics show their active phases (phase_label when nothing has
// started yet); every other type shows the titlecased phase label — prefixed
// `Finalising —` when the pipeline finished but `workunit complete` never ran.
/** @param {WorkUnitEntry} unit @param {TypeSection['type']} type */
function subRow(unit, type) {
  if (type === 'epic') {
    const phases = unit.active_phases || [];
    if (phases.length > 0) return phases.map(titlecase).join(', ');
  }
  if (unit.finalising) return titlecaseLabel(`finalising — ${unit.phase_label}`);
  return titlecaseLabel(unit.phase_label);
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

/**
 * Section A — the Workflow Overview display. One code-block string: box cap,
 * non-empty type sections with continuous numbering, the inbox hint line, and
 * the completed/cancelled count line.
 * @param {StartDetail} detail
 * @returns {string}
 */
function startOverview(detail) {
  const lines = [];
  let n = 0;
  for (const s of SECTIONS) {
    const units = detail[s.group].work_units;
    if (units.length === 0) continue;
    lines.push(s.label);
    for (const u of units) {
      n += 1;
      lines.push(`  ${n}. ${titlecase(u.name)}`);
      lines.push(`     └─ ${subRow(u, s.type)}`);
      lines.push('');
    }
  }
  if (detail.state.has_inbox) {
    lines.push(`Inbox: ${inboxHint(detail.inbox)}`);
    lines.push('');
  }
  if (detail.completed_count > 0 || detail.cancelled_count > 0) {
    lines.push(`${detail.completed_count} completed, ${detail.cancelled_count} cancelled.`);
    lines.push('');
  }
  return (box('Workflow Overview') + lines.join('\n')).replace(/\n+$/, '\n');
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

// A finalising unit's entry reads `Finalise …` — the continue skill it routes
// to presents the completion gate.
/** @param {WorkUnitEntry} unit @param {TypeSection['type']} type */
function continueLabel(unit, type) {
  const t = titlecase(unit.name);
  if (type === 'epic') return `Continue "${t}" — epic`;
  if (unit.finalising) return `Finalise "${t}" — ${type}, ${unit.phase_label}`;
  return `Continue "${t}" — ${type}, ${unit.phase_label}`;
}

/**
 * Section B — the interactive menu. `keys` carries the machine action keys
 * (skills route on these); `rendered` is the dotted-gate markdown block.
 * Numbered continue entries first (overview order and numbering), then the
 * start-new and lifecycle command options (`i` only with a live inbox, `v`
 * only with completed/cancelled work units).
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
  const options = [
    { key: 's', word: 'start', action: 'start_new', pre_seed: 'none', route: null, label: 'Start something new (not sure what kind yet)' },
    { key: 'f', word: 'feature', action: 'start_new', pre_seed: 'feature', route: null, label: 'Start new feature' },
    { key: 'e', word: 'epic', action: 'start_new', pre_seed: 'epic', route: null, label: 'Start new epic' },
    { key: 'b', word: 'bugfix', action: 'start_new', pre_seed: 'bugfix', route: null, label: 'Start new bugfix' },
    { key: 'q', word: 'quick-fix', action: 'start_new', pre_seed: 'quick-fix', route: null, label: 'Start new quick-fix' },
    { key: 'c', word: 'cross-cutting', action: 'start_new', pre_seed: 'cross-cutting', route: null, label: 'Start new cross-cutting concern' },
  ];
  if (detail.state.has_inbox) {
    options.push({ key: 'i', word: 'inbox', action: 'view_inbox', route: null, label: 'View the inbox and start from an item' });
  }
  if (detail.completed_count > 0 || detail.cancelled_count > 0) {
    options.push({ key: 'v', word: 'view', action: 'view_completed', route: null, label: 'View completed & cancelled work units' });
  }
  options.push({ key: 'm', word: 'manage', action: 'manage', route: null, label: "Manage a work unit's lifecycle" });

  const lines = ['· · · · · · · · · · · ·', 'What would you like to do?', ''];
  for (const e of numbered) {
    lines.push(`- **\`${e.key}\`** — ${e.label}`);
  }
  if (numbered.length > 0) lines.push('');
  for (const o of options) {
    lines.push(`- **\`${o.key}\`/\`${o.word}\`** — ${o.label}`);
  }
  lines.push('', 'Select an option:', '· · · · · · · · · · · ·');

  return { keys: [...numbered, ...options], rendered: lines.join('\n') };
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

/**
 * The empty-state Workflow Overview: no active work, closed counts when any.
 * @param {StartDetail} detail
 * @returns {string}
 */
function emptyOverview(detail) {
  let out = box('Workflow Overview') + 'No active work found.\n';
  if (detail.completed_count > 0 || detail.cancelled_count > 0) {
    out += `\n${detail.completed_count} completed, ${detail.cancelled_count} cancelled.\n`;
  }
  return out;
}

/**
 * The empty-state start menu — the six start-new options with pipeline-shape
 * labels, `i` only with a live inbox, `v` only with closed work units. Same
 * key shape as startMenu, so the ACTIONS table and routing are uniform.
 * @param {StartDetail} detail
 * @returns {{keys: StartMenuKey[], rendered: string}}
 */
function emptyMenu(detail) {
  /** @type {StartMenuKey[]} */
  const options = [
    { key: 's', word: 'start', action: 'start_new', pre_seed: 'none', route: null, label: "Not sure what kind yet — describe it and we'll shape it" },
    { key: 'f', word: 'feature', action: 'start_new', pre_seed: 'feature', route: null, label: 'Single topic: (research →) discussion → spec → plan → implement → review' },
    { key: 'e', word: 'epic', action: 'start_new', pre_seed: 'epic', route: null, label: 'Multiple topics, multi-session, same pipeline per topic' },
    { key: 'b', word: 'bugfix', action: 'start_new', pre_seed: 'bugfix', route: null, label: 'Investigation → spec → plan → implement → review' },
    { key: 'q', word: 'quick-fix', action: 'start_new', pre_seed: 'quick-fix', route: null, label: 'Scoping → implement → review (no formal planning)' },
    { key: 'c', word: 'cross-cutting', action: 'start_new', pre_seed: 'cross-cutting', route: null, label: '(Research →) discussion → spec (patterns or policies that inform other work)' },
  ];
  if (detail.state.has_inbox) {
    const n = detail.state.inbox_count;
    options.push({ key: 'i', word: 'inbox', action: 'view_inbox', route: null, label: `View the inbox and start from an item (${n} item${n === 1 ? '' : 's'})` });
  }
  if (detail.completed_count > 0 || detail.cancelled_count > 0) {
    options.push({ key: 'v', word: 'view', action: 'view_completed', route: null, label: 'View completed & cancelled work units' });
  }

  const lines = ['What would you like to start?', ''];
  for (const o of options) {
    lines.push(`- **\`${o.key}\`/\`${o.word}\`** — ${o.label}`);
  }
  lines.push('', 'Select an option:');

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

/** Numbered pickup rows, dated. @param {PickupItem[]} items */
function pickupRows(items) {
  return items.map((item) => `  ${item.n}. ${item.title} (${item.type}, ${item.date})`);
}

/**
 * The inbox pickup snapshot: numbered live items, the select/archived/back
 * menu. Selection numbers resolve through the DATA `ITEMS` table.
 * @param {PickupItem[]} items      combined live inbox, pickup order
 * @param {boolean} hasArchived
 * @returns {{data: string, display: string, menu: string}}
 */
function inboxPickupView(items, hasArchived) {
  const data = [
    `inbox_count: ${items.length}`,
    `has_archived: ${hasArchived}`,
    ...itemTable('ITEMS', items),
  ].join('\n');

  const display = box('Inbox')
    + (items.length > 0 ? pickupRows(items).join('\n') + '\n' : 'No inbox items.\n');

  const options = [];
  if (items.length === 1) {
    options.push('- **`1`** — Select the item to work on');
  } else if (items.length > 1) {
    options.push(`- **\`1\`–\`${items.length}\`** — Select item(s) to work on (comma-separated for several)`);
  }
  if (hasArchived) options.push('- **`a`/`archived`** — View archived items (restore or delete)');
  options.push('- **`b`/`back`** — Return');

  return { data, display, menu: dotMenu(['What would you like to do?', '', ...options]) };
}

/**
 * The archived-store snapshot: numbered archived items and the select prompt
 * (empty menu when nothing is archived).
 * @param {PickupItem[]} items  combined archived items, pickup order
 * @returns {{data: string, display: string, menu: string}}
 */
function archivedView(items) {
  const data = [
    `archived_count: ${items.length}`,
    ...itemTable('ITEMS', items),
  ].join('\n');

  const display = box('Archived')
    + (items.length > 0 ? pickupRows(items).join('\n') + '\n' : 'No archived items.\n');

  const menu = items.length > 0
    ? dotMenu(['Select an item (enter number, or **`b`/`back`** to return):'])
    : '';

  return { data, display, menu };
}

// ---------------------------------------------------------------------------
// Working set
// ---------------------------------------------------------------------------

/**
 * The working-set snapshot: the set menu (`w`/`work` renders only for a
 * type-uniform set) plus the deferred add/drop gates. The set's item render
 * (titles, summaries) stays with the session — summaries are synthesised
 * content the engine never writes.
 * @param {WorkingSetDetail} ws
 * @returns {{data: string, menu: string, sections: string}}
 */
function workingSetView(ws) {
  const data = [
    `set_count: ${ws.count}`,
    `set_uniform: ${ws.uniform}`,
    `set_type: ${ws.set_type}`,
    `addable_count: ${ws.addable.length}`,
    ...itemTable('SET', ws.items),
    ...itemTable('ADDABLE', ws.addable),
  ].join('\n');

  const options = [];
  if (ws.uniform) options.push('- **`w`/`work`** — Proceed to discovery with this set');
  options.push(
    '- **`a`/`add`** — Add another inbox item to the set',
    '- **`d`/`drop`** — Drop item(s) from the set (keeps them in the inbox)',
    '- **`r`/`archive`** — Archive the whole set out of the inbox',
    '- **`v`/`view`** — View full content of the set',
    '- **`b`/`back`** — Return to the inbox list',
    '- **Ask** — Ask about the set',
  );
  const menu = dotMenu([
    'What would you like to do? Type a shortcut, or just tell me in',
    'your own words — e.g. "add 2 and 4", "drop the bug", "archive these".',
    '',
    ...options,
  ]);

  const sections = [];
  if (ws.addable.length > 0) {
    sections.push(labelled(
      'DISPLAY: add candidates',
      'emit verbatim as a code block only at the add-items gate — never at the call',
      ws.addable.map((item) => `  ${item.n}. ${item.title} (${item.type}, ${item.date})`).join('\n'),
    ));
    sections.push(labelled(
      'MENU: add gate',
      'emit verbatim as markdown only at the add-items gate',
      dotMenu(['Add which? (enter number(s), comma-separated, or **`b`/`back`**)']),
    ));
  }
  sections.push(labelled(
    'DISPLAY: drop candidates',
    'emit verbatim as a code block only at the drop-items gate — never at the call',
    ws.items.map((item) => `  ${item.n}. ${item.title} (${item.type})`).join('\n'),
  ));
  sections.push(labelled(
    'MENU: drop gate',
    'emit verbatim as markdown only at the drop-items gate',
    dotMenu(['Drop which? (enter number(s), comma-separated, or **`b`/`back`**)']),
  ));

  return { data, menu, sections: sections.join('\n') };
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
    displayLines.push(s.label);
    for (const u of units) {
      rows.push({ n: rows.length + 1, work_type: s.type, work_unit: u.name });
      displayLines.push(`  ${rows.length}. ${titlecase(u.name)}`);
    }
    displayLines.push('');
  }

  const data = [
    `unit_count: ${rows.length}`,
    'UNITS (n  work_type  work_unit):',
    ...rows.map((r) => `  ${r.n}  ${r.work_type}  ${r.work_unit}`),
  ].join('\n');

  const display = box('Manage')
    + (rows.length > 0 ? displayLines.join('\n') : 'No active work units.\n');

  const menu = rows.length > 0
    ? dotMenu(['Select a work unit (enter number, or **`b`/`back`** to return):'])
    : '';

  return { data, display, menu, rows };
}

/**
 * One work unit's manage snapshot: the action menu offering exactly the
 * actions its state allows, plus the deferred absorb-target and view-plan
 * topic gates when those actions are live.
 * @param {ManageDetail} md
 * @returns {{data: string, menu: string, sections: string}}
 */
function manageUnitView(md) {
  /** @type {[string, string][]} */
  const actions = [];
  const options = [];
  if (md.implementation_completed) {
    actions.push(['d', 'mark_completed']);
    options.push('- **`d`/`done`** — Mark as completed');
  }
  if (md.work_type === 'feature') {
    actions.push(['p', 'pivot']);
    options.push('- **`p`/`pivot`** — Convert to epic (enables multiple topics)');
  }
  if (md.absorb_available) {
    actions.push(['a', 'absorb']);
    options.push('- **`a`/`absorb`** — Merge into an existing epic');
  }
  if (md.has_plan) {
    actions.push(['v', 'view_plan']);
    options.push('- **`v`/`view-plan`** — View the implementation plan');
  }
  actions.push(['c', 'cancel'], ['b', 'back']);
  options.push(
    '- **`c`/`cancel`** — Mark as cancelled',
    '- **`b`/`back`** — Return',
    '- **Ask** — Ask a question about this work unit',
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

  const sections = [];
  if (md.absorb_available) {
    sections.push(labelled(
      'MENU: absorb target',
      'emit verbatim as markdown only at the absorb target gate — never at the call',
      dotMenu([
        'Select a target epic:',
        '',
        ...md.available_epics.map((name, i) => `- **\`${i + 1}\`** — ${titlecase(name)}`),
        '',
        '- **`b`/`back`** — Return',
      ]),
    ));
  }
  if (md.work_type === 'epic' && md.has_plan && md.planning_topics.length > 1) {
    sections.push(labelled(
      'MENU: plan topics',
      'emit verbatim as markdown only at the view-plan topic gate — never at the call',
      dotMenu([
        'Which plan would you like to view?',
        '',
        ...md.planning_topics.map((t, i) => `- **\`${i + 1}\`** — ${titlecase(t.name)} — ${t.status}`),
      ]),
    ));
  }

  return { data, menu, sections: sections.join('\n') };
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

  let display = box('Completed & Cancelled');
  if (rows.length === 0) {
    display += 'No completed or cancelled work units found.\n';
  } else {
    const lines = [];
    if (filter !== undefined) {
      lines.push(`Showing: ${FILTER_LABELS[filter]}`);
      lines.push('');
    }
    if (completedRows.length > 0) {
      lines.push('Completed:');
      for (const r of completedRows) {
        lines.push(`  ${r.n}. ${titlecase(r.work_unit)}`);
        lines.push(`     └─ Completed after: ${r.last_phase}`);
        lines.push('');
      }
    }
    if (cancelledRows.length > 0) {
      lines.push('Cancelled:');
      for (const r of cancelledRows) {
        lines.push(`  ${r.n}. ${titlecase(r.work_unit)}`);
        lines.push(`     └─ Cancelled during: ${r.last_phase}`);
        lines.push('');
      }
    }
    display += lines.join('\n').replace(/\n+$/, '\n');
  }

  const menu = rows.length > 0
    ? dotMenu([
      'Select a work unit for details, or **`b`/`back`** to return.',
      '',
      'Select an option (enter number):',
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
  manageListView,
  manageUnitView,
  completedView,
};
