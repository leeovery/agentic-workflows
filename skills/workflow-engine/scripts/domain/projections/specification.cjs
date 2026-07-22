'use strict';

// ---------------------------------------------------------------------------
// Domain ring: specification-entry projections — the scenario overview
// (DISPLAY), the grouping/spec menus (MENU), and the concluded-specs
// sub-view, over one SpecificationDetail (see ../specification.cjs).
//
// Deterministic: same detail, same string. The menu carries machine action
// keys so the entry skill routes on keys, never on labels. Tree layout goes
// through the kernel renderer — branch glyphs are positional (├─ for
// non-final siblings, └─ for the last), never repeated └─.
// ---------------------------------------------------------------------------

const { box, renderTree, wrap } = require('../../kernel/render.cjs');
const { TREE_WIDTH, titlecase, title, SPEC_LEGEND } = require('../conventions.cjs');
const { dotFrame, cmdOption } = require('./surfaces.cjs');

/** @typedef {import('../specification.cjs').SpecificationDetail} SpecificationDetail */
/** @typedef {import('../specification.cjs').SpecRow} SpecRow */
/** @typedef {import('../../kernel/render.cjs').TreeNode} TreeNode */

/**
 * @typedef {object} SpecMenuKey
 * @property {string} key             what the user types (`1`, `2`, …, `c`, `b`)
 * @property {string} [word]          long form of a command option (`completed`, `back`)
 * @property {string} action          machine action key — the skill routes on this, never the label
 * @property {string|null} topic      the spec/grouping name, or null for meta and command options
 * @property {string|null} verb       Creating | Continuing | Refining — the confirmation verb
 * @property {string} label
 * @property {string[]} [desc]        meta-option description lines (already backtick-wrapped)
 */

const TITLE = 'Specification Overview';

// Meta-option description wrap budget — matches the shipped menu examples.
const DESC_WIDTH = 61;

const NOT_READY_HEAD =
  '⚑ Discussions not ready for specification:\n'
  + '  These discussions are still in progress and must be completed\n'
  + '  before they can be included in a specification.';

const TIP =
  'Tip: To restructure groupings or pull a discussion into its own\n'
  + 'specification, choose "Re-analyze" and provide guidance.';

const STALE_CACHE_MSG =
  'A previous grouping analysis exists but is outdated — discussions\n'
  + 'have changed since it was created. Re-analysis is required.';

// ---------------------------------------------------------------------------
// Display building blocks
// ---------------------------------------------------------------------------

/** @param {string[]} names */
function bullets(names) {
  return names.map((n) => `  • ${n}`).join('\n');
}

/** `N noun` with plural agreement (`1 spec` / `2 specs`). @param {number} n @param {string} noun */
function counted(n, noun) {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/** ⚑ block for in-progress discussions, or '' when none. @param {string[]} names */
function notReadyBlock(names) {
  if (names.length === 0) return '';
  return NOT_READY_HEAD + '\n\n' + bullets(names);
}

/** @param {SpecRow} row */
function specLine(row) {
  if (row.status === 'proposed') return 'Spec: [no spec]';
  return `Spec: ${row.status} (${row.extracted} of ${row.total} sources extracted)`;
}

// One numbered grouping/spec block: `N. Title` with the detail tree hanging
// beneath at a 3-space indent (branch glyphs align under the title text).
/** @param {number} number @param {SpecRow} row */
function itemBlock(number, row) {
  /** @type {TreeNode[]} */
  const nodes = [{ title: specLine(row) }];
  if (row.sources.length > 0) {
    nodes.push({ title: 'Discussions:', children: row.sources.map((s) => ({ title: `${s.name} [${s.tag}]` })) });
  }
  if (row.consult.length > 0) {
    nodes.push({ title: 'Consult:', children: row.consult.map((c) => ({ title: `${c.name} [${c.status}]` })) });
  }
  const tree = renderTree(nodes, { width: TREE_WIDTH })
    .replace(/\n+$/, '')
    .split('\n')
    .map((l) => (l ? ' ' + l : l))
    .join('\n');
  return `${number}. ${titlecase(row.name)}\n${tree}`;
}

/**
 * Key block for the categories/terms the display shows, or '' when none.
 * Vocabulary comes from conventions (SPEC_LEGEND); terms pad to align the
 * em-dashes within each category.
 * @param {{discussion: Set<string>, consult: Set<string>, spec: Set<string>}} terms
 */
function keyBlock(terms) {
  const categories = /** @type {const} */ ([
    ['discussion', 'Discussion status'],
    ['consult', 'Consult status'],
    ['spec', 'Spec status'],
  ]);
  const blocks = [];
  for (const [cat, label] of categories) {
    const vocab = SPEC_LEGEND[cat];
    const present = Object.keys(vocab).filter((t) => terms[cat].has(t));
    if (present.length === 0) continue;
    const pad = Math.max(...present.map((t) => t.length));
    blocks.push(`  ${label}:\n`
      + present.map((t) => `    ${t.padEnd(pad)} — ${vocab[/** @type {keyof typeof vocab} */ (t)]}`).join('\n'));
  }
  if (blocks.length === 0) return '';
  return 'Key:\n\n' + blocks.join('\n\n');
}

/** Collect the legend terms the given rows display. @param {SpecRow[]} rows */
function displayedTerms(rows) {
  const terms = { discussion: new Set(), consult: new Set(), spec: new Set() };
  for (const row of rows) {
    if (row.status !== 'proposed') terms.spec.add(row.status);
    for (const s of row.sources) {
      for (const t of s.tag.split(', ')) terms.discussion.add(t);
    }
    for (const c of row.consult) terms.consult.add(c.status);
  }
  return terms;
}

/** Box + blocks joined by blank lines, single trailing newline. @param {string[]} blocks */
function compose(blocks) {
  return box(TITLE) + blocks.filter(Boolean).join('\n\n') + '\n';
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

/** @param {SpecificationDetail} detail */
function blockedDisplay(detail) {
  if (detail.scenario === 'blocked-no-discussions') {
    return compose([
      'No discussions found.',
      'The specification phase requires completed discussions to work from.\n'
      + 'Discussions capture the technical decisions, edge cases, and rationale\n'
      + 'that specifications are built upon.',
    ]);
  }
  return compose([
    'No completed discussions found.',
    'The following discussions are still in progress:',
    bullets(detail.in_progress_discussions),
    'Specifications can only be created from completed discussions.\n'
    + 'Conclude at least one discussion before proceeding.',
  ]);
}

const SINGLE_INTRO = {
  'no-spec': 'Single completed discussion found.',
  'has-spec': 'Single completed discussion found with existing specification.',
  grouped: 'Single completed discussion found with existing multi-source specification.',
};

/** @param {SpecificationDetail} detail */
function singleDisplay(detail) {
  const single = detail.single;
  if (!single) throw new Error('specificationDisplay: single scenario without single context');
  /** @type {SpecRow} */
  const row = single.spec || {
    name: detail.work_unit, status: 'proposed',
    sources: [{ name: single.discussion, tag: 'ready' }], consult: [],
    extracted: 0, total: 1, pending: 1, consult_pending: 0, verb: 'Creating',
  };
  const shown = { ...row, name: single.variant === 'grouped' ? row.name : detail.work_unit, consult: [] };
  return compose([
    SINGLE_INTRO[single.variant],
    itemBlock(1, shown),
    notReadyBlock(detail.in_progress_discussions),
    keyBlock(displayedTerms([shown])),
  ]);
}

/** @param {SpecificationDetail} detail */
function groupingsDisplay(detail) {
  return compose([
    'Recommended breakdown for specifications with their source discussions.',
    ...detail.actionable.map((row, i) => itemBlock(i + 1, row)),
    notReadyBlock(detail.in_progress_discussions),
    keyBlock(displayedTerms(detail.actionable)),
    detail.actionable.length >= 2 ? TIP : '',
  ]);
}

/** @param {SpecificationDetail} detail */
function analyzeDisplay(detail) {
  return compose([
    `${counted(detail.counts.completed_count, 'completed discussion')} found. No specifications exist yet.`,
    'Completed discussions:\n' + bullets(detail.completed_discussions),
    notReadyBlock(detail.in_progress_discussions),
  ]);
}

/** @param {SpecificationDetail} detail */
function specsMenuDisplay(detail) {
  const cs = detail.counts;
  const blocks = [`${counted(cs.completed_count, 'completed discussion')} found. `
    + `${counted(cs.spec_count, 'specification')} exist${cs.spec_count === 1 ? 's' : ''}.`];
  if (detail.actionable.length > 0) {
    blocks.push('Existing specifications:');
    detail.actionable.forEach((row, i) => blocks.push(itemBlock(i + 1, row)));
  } else {
    blocks.push('All specifications are completed — see Manage completed specifications.');
  }
  if (detail.unassigned.length > 0) {
    blocks.push('Completed discussions not in a specification:\n' + bullets(detail.unassigned));
  }
  blocks.push(notReadyBlock(detail.in_progress_discussions));
  blocks.push(keyBlock(displayedTerms(detail.actionable)));
  if (detail.cache_status === 'none') blocks.push('No grouping analysis exists.');
  else if (detail.cache_status === 'stale') blocks.push(STALE_CACHE_MSG);
  return compose(blocks);
}

/**
 * The scenario's DISPLAY block, or '' when the scenario renders nothing
 * (analysis-rerun routes straight into the analysis flow).
 * @param {SpecificationDetail} detail
 * @returns {string}
 */
function specificationDisplay(detail) {
  switch (detail.scenario) {
    case 'blocked-no-discussions':
    case 'blocked-none-completed':
      return blockedDisplay(detail);
    case 'single':
      return singleDisplay(detail);
    case 'groupings':
      return groupingsDisplay(detail);
    case 'analyze':
      return analyzeDisplay(detail);
    case 'specs-menu':
      return specsMenuDisplay(detail);
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

/** Meta-option description lines: 3-space indent, backtick-wrapped. @param {string} text */
function descLines(text) {
  return wrap(text, DESC_WIDTH).map((seg) => `   \`${seg}\``);
}

/** @param {SpecRow} row @param {'groupings'|'specs-menu'} scenario */
function rowLabel(row, scenario) {
  const t = titlecase(row.name);
  let label;
  if (row.status === 'proposed') {
    label = `Start "${t}" — ${row.total} ready discussion(s)`;
  } else if (row.status === 'completed') {
    label = `Continue "${t}" — ${row.pending} new source(s) to extract`;
  } else if (scenario === 'specs-menu') {
    label = `Continue "${t}" — in-progress`;
  } else {
    label = row.pending > 0
      ? `Continue "${t}" — ${row.pending} source(s) pending extraction`
      : `Continue "${t}" — all sources extracted`;
  }
  if (row.consult_pending > 0) label += ` — ${row.consult_pending} consult ref(s) pending`;
  return label;
}

const UNIFY_BASE = 'All discussions are combined into one specification.';
const UNIFY_SUPERSEDE = ' Existing specifications are incorporated and superseded.';
const REANALYZE_HEAD = 'Current groupings are discarded and rebuilt.';
const REANALYZE_ANCHORS = ' Existing specification names are preserved.';
const REANALYZE_TAIL = ' You can provide guidance in the next step.';
const ANALYZE_DESC = 'All discussions are analyzed for natural groupings.'
  + REANALYZE_ANCHORS + REANALYZE_TAIL;

/**
 * The scenario's selection menu. `keys` carries the machine action keys (the
 * skill routes on these); `rendered` is the dotted-gate markdown block — both
 * empty when the scenario has no menu (blocked, single, analyze, rerun).
 * @param {SpecificationDetail} detail
 * @returns {{keys: SpecMenuKey[], rendered: string}}
 */
function specificationMenu(detail) {
  if (detail.scenario !== 'groupings' && detail.scenario !== 'specs-menu') {
    return { keys: [], rendered: '' };
  }

  /** @type {SpecMenuKey[]} */
  const numbered = [];
  if (detail.scenario === 'specs-menu') {
    numbered.push({
      key: '', action: 'analyze', topic: null, verb: null,
      label: 'Analyze for groupings (recommended)', desc: descLines(ANALYZE_DESC),
    });
  }
  for (const row of detail.actionable) {
    numbered.push({
      key: '',
      action: row.status === 'proposed' ? 'start_spec' : 'continue_spec',
      topic: row.name,
      verb: row.verb,
      label: rowLabel(row, detail.scenario),
    });
  }
  if (detail.scenario === 'groupings') {
    if (detail.actionable.length >= 2) {
      numbered.push({
        key: '', action: 'unify', topic: null, verb: 'Creating',
        label: 'Unify all into single specification',
        desc: descLines(UNIFY_BASE + (detail.has_materialized ? UNIFY_SUPERSEDE : '')),
      });
    }
    numbered.push({
      key: '', action: 'reanalyze', topic: null, verb: null,
      label: 'Re-analyze groupings',
      desc: descLines(REANALYZE_HEAD + (detail.has_materialized ? REANALYZE_ANCHORS : '') + REANALYZE_TAIL),
    });
  }
  numbered.forEach((e, i) => { e.key = String(i + 1); });

  /** @type {SpecMenuKey[]} */
  const options = [];
  if (detail.concluded.length > 0) {
    options.push({
      key: 'c', word: 'completed', action: 'completed_menu', topic: null, verb: null,
      label: `Manage completed specifications — ${detail.concluded.length} completed`,
    });
  }

  const lines = [];
  for (const e of numbered) {
    lines.push(cmdOption(e.key, null, e.label));
    if (e.desc) lines.push(...e.desc);
  }
  for (const o of options) {
    lines.push('', cmdOption(o.key, o.word, o.label));
  }
  lines.push('', 'Select an option:');

  return { keys: [...numbered, ...options], rendered: dotFrame(lines) };
}

/**
 * The concluded-specs sub-view (`c`/`completed`): the heading with one row per
 * concluded spec, and flat Refine entries — no source detail, the specs have
 * no pending work.
 * @param {SpecificationDetail} detail
 * @returns {{keys: SpecMenuKey[], display: string, rendered: string}}
 */
function specificationCompletedMenu(detail) {
  if (detail.concluded.length === 0) {
    throw new Error('specificationCompletedMenu: no concluded specifications — nothing to render');
  }
  /** @type {SpecMenuKey[]} */
  const keys = detail.concluded.map((row, i) => ({
    key: String(i + 1), action: 'refine_spec', topic: row.name, verb: 'Refining',
    label: `Refine "${titlecase(row.name)}" — completed`,
  }));
  keys.push({ key: 'b', word: 'back', action: 'back', topic: null, verb: null, label: 'Return to the specifications menu' });

  const lines = ['Which completed specification would you like to refine?', ''];
  for (const k of keys) {
    lines.push(cmdOption(k.key, k.word, k.label));
  }
  lines.push('', 'Select an option:');
  const rendered = dotFrame(lines);

  const display = 'Completed Specifications\n'
    + renderTree(detail.concluded.map((row) => ({ title: title({ label: titlecase(row.name), tag: 'completed' }) })), { width: TREE_WIDTH });

  return { keys, display, rendered };
}

module.exports = { specificationDisplay, specificationMenu, specificationCompletedMenu };
