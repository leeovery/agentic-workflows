'use strict';

// ---------------------------------------------------------------------------
// Domain ring: workflow-start projections — the Workflow Overview display and
// the unified continue/start menu over one StartDetail (see ../start.cjs).
//
// Deterministic: same detail, same string. The overview is a flat list (one
// numbered item + one └─ sub-row each, numbering continuous across the type
// sections) — composed line-by-line here, not a continuous-gutter tree. The
// menu carries machine action keys so skills route on keys, never on labels.
// ---------------------------------------------------------------------------

const { box } = require('../../kernel/render.cjs');
const { titlecase, capitalise } = require('../conventions.cjs');

/** @typedef {import('../start.cjs').StartDetail} StartDetail */
/** @typedef {import('../start.cjs').WorkUnitEntry} WorkUnitEntry */
/** @typedef {import('../start.cjs').InboxDetail} InboxDetail */

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

module.exports = { startOverview, startMenu };
