'use strict';

// ---------------------------------------------------------------------------
// Domain ring: epic projections — the dashboard, key, and menu views over one
// EpicDetail (see ../epic.cjs).
//
// Deterministic: same detail, same string. The dashboard groups every phase
// under the three-D stage dividers (DISCOVERY / DEFINITION / DELIVERY); the
// menu carries machine action keys so skills route on keys, never on labels.
// Layout goes through the kernel renderer — no character arithmetic here.
// ---------------------------------------------------------------------------

const { signpost, box, renderTree, wrap } = require('../../kernel/render.cjs');
const { TREE_WIDTH, titlecase, title, derivedFrom, discoveryGlyph } = require('../conventions.cjs');

/** @typedef {import('../epic.cjs').EpicDetail} EpicDetail */
/** @typedef {import('../epic.cjs').MapRow} MapRow */
/** @typedef {import('../epic.cjs').PhaseEntry} PhaseEntry */
/** @typedef {import('../epic.cjs').NextPhaseEntry} NextPhaseEntry */
/** @typedef {import('../epic.cjs').DepBlocking} DepBlocking */

/**
 * @typedef {object} NewArrivals
 * @property {string[]} [research_analysis]  topic names added by research-analysis this boot-up
 * @property {string[]} [gap_analysis]       topic names added by gap-analysis this boot-up
 */

/**
 * @typedef {object} MenuKey
 * @property {string} key             what the user types (`1`, `2`, …, `s`, `m`, …)
 * @property {string} [word]          long form of a command option (`spec`, `map`, …)
 * @property {string} action          machine action key — skills route on this, never the label
 * @property {string|null} topic
 * @property {string|null} route      skill invocation, or null for internal flows
 * @property {string} label
 * @property {boolean} [recommended]
 * @property {boolean} [blocked]
 * @property {DepBlocking[]} [deps_blocking]
 */

const BUILD_PHASES = ['specification', 'planning', 'implementation', 'review'];

const STAGES = [
  { name: 'DISCOVERY', phases: ['research', 'discussion'] },
  { name: 'DEFINITION', phases: ['specification', 'planning'] },
  { name: 'DELIVERY', phases: ['implementation', 'review'] },
];

const STATUS_ORDER = ['proposed', 'in-progress', 'completed', 'cancelled', 'promoted'];

const PHASE_ENTRY_SKILL = {
  research: 'workflow-research-entry',
  discussion: 'workflow-discussion-entry',
  specification: 'workflow-specification-entry',
  planning: 'workflow-planning-entry',
  implementation: 'workflow-implementation-entry',
  review: 'workflow-review-entry',
};

const ACTION_PHASE = {
  start_research: 'research',
  continue_research: 'research',
  start_discussion: 'discussion',
  start_discussion_after_research: 'discussion',
  continue_discussion: 'discussion',
  start_specification: 'specification',
  continue_specification: 'specification',
  start_planning: 'planning',
  continue_planning: 'planning',
  start_implementation: 'implementation',
  continue_implementation: 'implementation',
  start_review: 'review',
  continue_review: 'review',
};

const START_GATE = {
  start_specification: 'can_start_specification',
  start_planning: 'can_start_planning',
  start_implementation: 'can_start_implementation',
  start_review: 'can_start_review',
};

// ---------------------------------------------------------------------------
// Shared composition helpers
// ---------------------------------------------------------------------------

/** @param {MapRow} row */
function lifecycleLabel(row) {
  switch (row.lifecycle) {
    case 'ready_for_discussion': return 'research complete · ready for discussion';
    case 'researching': return 'researching';
    case 'discussing': return 'discussing';
    case 'decided': return 'decided';
    case 'handled': return 'handled · research fanned out';
    case 'cancelled': return 'cancelled';
    default: return row.routing ? `fresh · routed to ${row.routing}` : 'fresh';
  }
}

/** Count summary for a phase sub-header — statuses present, zero counts omitted. @param {PhaseEntry[]} items */
function countSummary(items) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const it of items) counts.set(it.status, (counts.get(it.status) || 0) + 1);
  const ordered = [
    ...STATUS_ORDER.filter((s) => counts.has(s)),
    ...[...counts.keys()].filter((s) => !STATUS_ORDER.includes(s)),
  ];
  return ordered.map((s) => `${counts.get(s)} ${s}`).join(', ');
}

/** @param {SpecSourceLike} src @typedef {{topic?: string, name?: string, status?: string}} SpecSourceLike */
function sourceName(src) {
  return src.topic || src.name || '';
}

/** Cross-plan dep reference — `{plan}:{task}` when the task id is known. @param {DepBlocking} dep */
function depRef(dep) {
  return dep.internal_id ? `${dep.topic}:${dep.internal_id}` : dep.topic;
}

/** Spec phase shows proposed items first, then the rest in existing order. @param {string} phase @param {PhaseEntry[]} items */
function displayOrder(phase, items) {
  if (phase !== 'specification') return items;
  return [...items.filter((i) => i.status === 'proposed'), ...items.filter((i) => i.status !== 'proposed')];
}

/** Build the tree nodes for one build/flat phase. @param {string} phase @param {PhaseEntry[]} items */
function phaseNodes(phase, items) {
  return displayOrder(phase, items).map((item) => {
    let head = title({ label: titlecase(item.name), tag: item.status });
    if (phase === 'planning' && item.format) head += ` · ${item.format}`;
    /** @type {{title: string}[]} */
    const children = [];
    if (phase === 'specification' && Array.isArray(item.sources)) {
      for (const src of item.sources) {
        children.push({ title: title({ label: titlecase(sourceName(src)), tag: src.status || 'pending' }) });
      }
    }
    if (phase === 'implementation') {
      const tasks = Array.isArray(item.completed_tasks) ? item.completed_tasks.length : 0;
      if (item.current_phase != null) {
        children.push({ title: `Phase ${item.current_phase}, ${tasks} task(s) completed` });
      } else if (tasks > 0) {
        children.push({ title: `${tasks} task(s) completed` });
      }
    }
    return children.length ? { title: head, children } : { title: head };
  });
}

/** Sub-header + item tree for one phase. @param {string} phase @param {PhaseEntry[]} items */
function phaseBlock(phase, items) {
  return `  ${phase.toUpperCase()} (${countSummary(items)})\n`
    + renderTree(phaseNodes(phase, items), { width: TREE_WIDTH });
}

/** ⚑ callout wrapped under the flag — continuation lines align with the text. @param {string} text */
function flaggedCallout(text) {
  return wrap(text, TREE_WIDTH - 4)
    .map((seg, i) => (i === 0 ? '  ⚑ ' : '    ') + seg)
    .join('\n');
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

/** @param {EpicDetail} detail */
function mapStatusSuffix(detail) {
  if (detail.convergence_state === 'settled') return ' · all decided';
  const s = detail.map_summary;
  if (!s) return '';
  const parts = [];
  if (s.decided) parts.push(`${s.decided} decided`);
  if (s.in_flight) parts.push(`${s.in_flight} in flight`);
  if (s.ready) parts.push(`${s.ready} ready`);
  if (s.fresh) parts.push(`${s.fresh} fresh`);
  if (s.handled) parts.push(`${s.handled} handled`);
  if (s.cancelled) parts.push(`${s.cancelled} cancelled`);
  return parts.length ? ' · ' + parts.join(' · ') : '';
}

/** Stage-meta callouts above the map header (seeds / imports / new arrivals). @param {EpicDetail} detail @param {NewArrivals} newArrivals */
function stageMetaCallouts(detail, newArrivals) {
  const lines = [];
  if (detail.seeds_count > 0) lines.push('  · seeded from the inbox');
  const showImports = detail.imports_count > 0 && detail.imports_count !== detail.discovery_map.length;
  if (showImports) lines.push(`  · ${detail.imports_count} import${detail.imports_count === 1 ? '' : 's'}`);
  for (const [field, label] of [['research_analysis', 'research-analysis'], ['gap_analysis', 'gap-analysis']]) {
    const names = newArrivals[/** @type {'research_analysis'|'gap_analysis'} */ (field)];
    if (Array.isArray(names) && names.length > 0) {
      lines.push(`  ⚑ ${names.length} new topic(s) added to the map from ${label}.`);
    }
  }
  return lines;
}

/** Discovery-map topic rows as kernel tree nodes. @param {EpicDetail} detail */
function mapNodes(detail) {
  return detail.discovery_map.map((row) => {
    const body = [];
    if (row.summary) body.push(row.summary);
    if (row.source_provenance) body.push(derivedFrom(row.source_provenance));
    const node = {
      title: title({ glyph: discoveryGlyph(row.lifecycle), label: titlecase(row.name), tag: lifecycleLabel(row) }),
    };
    return body.length ? { ...node, body } : node;
  });
}

/** First-matching recommendation for the no-map dashboard, or null. @param {EpicDetail} detail */
function displayRecommendation(detail) {
  const research = detail.phases.research || [];
  const discussion = detail.phases.discussion || [];
  const spec = detail.phases.specification || [];
  const plan = detail.phases.planning || [];

  const inProgressPhases = new Set(detail.in_progress.map((i) => i.phase));
  if (inProgressPhases.size > 1) return null;
  if (research.some((i) => i.status === 'in-progress') && research.some((i) => i.status === 'completed')) {
    return 'Consider completing remaining research before starting discussion. Topic analysis works best with all research available.';
  }
  if (discussion.some((i) => i.status === 'in-progress') && discussion.some((i) => i.status === 'completed')) {
    return 'Consider completing remaining discussions before starting specification. The grouping analysis works best with all discussions available.';
  }
  const proposed = spec.filter((i) => i.status === 'proposed');
  if (proposed.length > 0) {
    return `${proposed.length} analyzed grouping(s) ready to specify. Start them before planning to surface cross-cutting dependencies.`;
  }
  if (discussion.length > 0 && discussion.every((i) => i.status === 'completed') && spec.length === 0) {
    return 'All discussions are completed. Specification will analyze and group them.';
  }
  if (spec.some((i) => i.status === 'completed') && spec.some((i) => i.status === 'in-progress')) {
    return 'Completing all specifications before planning helps identify cross-cutting dependencies.';
  }
  if (plan.some((i) => i.status === 'completed') && plan.some((i) => i.status === 'in-progress')) {
    return 'Completing all plans before implementation helps surface task dependencies across plans.';
  }
  for (const name of detail.reopened_discussions) {
    const owner = spec.find((s) => (s.sources || []).some((src) => sourceName(src) === name));
    if (owner) {
      return `${titlecase(owner.name)} specification sources the reopened ${titlecase(name)} discussion. `
        + 'Once that discussion concludes, the specification will need revisiting to extract new content.';
    }
  }
  return null;
}

/** Plans-not-ready ⚑ block, or null when no plan is blocked. @param {EpicDetail} detail */
function plansNotReadyBlock(detail) {
  const blocked = (detail.phases.planning || [])
    .filter((p) => Array.isArray(p.deps_blocking) && p.deps_blocking.length > 0);
  if (blocked.length === 0) return null;
  const parts = [
    '⚑ Plans not ready for implementation:\n'
    + '  These plans have unresolved dependencies that must be\n'
    + '  addressed first.',
  ];
  for (const p of blocked) {
    parts.push(
      `  ${titlecase(p.name)}\n`
      + renderTree((p.deps_blocking || []).map((dep) => ({ title: `Blocked by ${depRef(dep)}` })), { width: TREE_WIDTH })
    );
  }
  return parts.join('\n\n').replace(/\n+$/, '');
}

/**
 * Section A — the epic state display. One code-block string: box cap, stage
 * dividers, map/phase trees, recommendation, and the plans-not-ready block.
 * @param {string} workUnit
 * @param {EpicDetail} detail
 * @param {{newArrivals?: NewArrivals}} [opts]
 * @returns {string}
 */
function epicDashboard(workUnit, detail, opts = {}) {
  const newArrivals = opts.newArrivals || {};
  const hasMap = detail.discovery_map.length > 0;
  const phaseNames = Object.keys(detail.phases);

  // Brand-new epic — nothing started anywhere.
  if (!hasMap && phaseNames.length === 0) {
    return box(titlecase(workUnit)) + 'No work started yet.';
  }

  /** @type {string[]} stage blocks, each ending with a single \n */
  const stages = [];

  if (hasMap) {
    let block = signpost('DISCOVERY') + '\n\n';
    const callouts = stageMetaCallouts(detail, newArrivals);
    if (callouts.length > 0) block += callouts.join('\n') + '\n\n';
    const total = detail.map_summary ? detail.map_summary.total : detail.discovery_map.length;
    block += `  RESEARCH & DISCUSSION (${total} topics${mapStatusSuffix(detail)})\n`;
    block += renderTree(mapNodes(detail), { width: TREE_WIDTH });
    stages.push(block);
  }

  for (const stage of STAGES) {
    if (hasMap && stage.name === 'DISCOVERY') continue; // the map is the DISCOVERY stage
    const populated = stage.phases.filter((p) => (detail.phases[p] || []).length > 0);
    if (populated.length === 0) continue;
    stages.push(
      signpost(stage.name) + '\n\n'
      + populated.map((p) => phaseBlock(p, detail.phases[p])).join('\n')
    );
  }

  let out = box(titlecase(workUnit)) + stages.join('\n');

  if (!hasMap) {
    const rec = displayRecommendation(detail);
    if (rec) out += '\n' + flaggedCallout(rec) + '\n';
  }

  const notReady = plansNotReadyBlock(detail);
  if (notReady) out += '\n' + notReady + '\n';

  return out.replace(/\n+$/, '\n');
}

// ---------------------------------------------------------------------------
// Key
// ---------------------------------------------------------------------------

const KEY_TIER =
  '    Discovery tier:\n'
  + '      →  ready for next phase   ◐  in flight\n'
  + '      ✓  decided                ○  fresh\n'
  + '      ⊙  handled                ⊘  cancelled';

const KEY_STATUS =
  '    Status:\n'
  + '      proposed    — analyzed grouping, not yet started\n'
  + '      in-progress — work is ongoing\n'
  + '      completed   — phase or implementation done\n'
  + '      cancelled   — topic removed from active work\n'
  + '      promoted    — moved to its own cross-cutting work unit';

const KEY_BLOCKING =
  '    Blocking reason:\n'
  + '      blocked by {plan}:{task} — depends on another plan\'s task\n'
  + '      blocked by {plan}        — dependency unresolved';

/**
 * Section B — the Key block, showing only categories present in the display.
 * Empty string for a brand-new epic (the key is skipped on that branch).
 * @param {EpicDetail} detail
 * @returns {string}
 */
function epicKey(detail) {
  const hasMap = detail.discovery_map.length > 0;
  const phaseNames = Object.keys(detail.phases);
  if (!hasMap && phaseNames.length === 0) return '';

  const anyBlocked = (detail.phases.planning || [])
    .some((p) => Array.isArray(p.deps_blocking) && p.deps_blocking.length > 0);
  const blocks = [];
  if (hasMap) {
    blocks.push(KEY_TIER);
    if (BUILD_PHASES.some((p) => (detail.phases[p] || []).length > 0)) blocks.push(KEY_STATUS);
  } else {
    blocks.push(KEY_STATUS);
  }
  if (anyBlocked) blocks.push(KEY_BLOCKING);
  return '  Key:\n' + blocks.join('\n\n');
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

/** @param {string} action @param {string} workUnit @param {string} topic */
function topicRoute(action, workUnit, topic) {
  return `/${PHASE_ENTRY_SKILL[/** @type {keyof typeof ACTION_PHASE} */ (ACTION_PHASE[action])]} epic ${workUnit} ${topic}`;
}

/** @param {string} action @param {string} name */
function discoveryEntryLabel(action, name) {
  const t = titlecase(name);
  switch (action) {
    case 'start_research': return `Start research for "${t}"`;
    case 'start_discussion': return `Start discussion for "${t}"`;
    case 'continue_research': return `Continue "${t}" — research`;
    case 'continue_discussion': return `Continue "${t}" — discussion`;
    default: return `Start discussion for "${t}" — research completed`; // start_discussion_after_research
  }
}

/** @param {string} phase @param {PhaseEntry} item */
function continueLabel(phase, item) {
  const t = titlecase(item.name);
  if (phase === 'implementation' && item.current_phase != null) {
    const tasks = Array.isArray(item.completed_tasks) ? item.completed_tasks.length : 0;
    return `Continue "${t}" — implementation (Phase ${item.current_phase}, Task ${tasks})`;
  }
  return `Continue "${t}" — ${phase} [in-progress]`;
}

/** @param {NextPhaseEntry} n */
function startVerbLabel(n) {
  const t = titlecase(n.name);
  if (n.action === 'start_implementation') {
    if (n.blocked) {
      return `Start implementation of "${t}" — blocked by ${(n.deps_blocking || []).map(depRef).join(', ')}`;
    }
    return `Start implementation of "${t}" — ${n.label}`;
  }
  const phase = ACTION_PHASE[/** @type {keyof typeof ACTION_PHASE} */ (n.action)];
  return `Start ${phase} for "${t}" — ${n.label}`;
}

/** Continue entries for one phase's in-progress items. @param {string} workUnit @param {EpicDetail} detail @param {string} phase @returns {MenuKey[]} */
function continueEntries(workUnit, detail, phase) {
  return (detail.phases[phase] || [])
    .filter((item) => item.status === 'in-progress')
    .map((item) => ({
      key: '',
      action: `continue_${phase}`,
      topic: item.name,
      route: topicRoute(`continue_${phase}`, workUnit, item.name),
      label: continueLabel(phase, item),
    }));
}

/** Gated start entries for one phase from next_phase_ready. @param {string} workUnit @param {EpicDetail} detail @param {string} phase @returns {MenuKey[]} */
function startEntries(workUnit, detail, phase) {
  /** @type {MenuKey[]} */
  const out = [];
  for (const n of detail.next_phase_ready) {
    if (ACTION_PHASE[/** @type {keyof typeof ACTION_PHASE} */ (n.action)] !== phase) continue;
    const gate = START_GATE[/** @type {keyof typeof START_GATE} */ (n.action)];
    if (gate && !detail.gating[/** @type {keyof EpicDetail['gating']} */ (gate)]) continue;
    /** @type {MenuKey} */
    const entry = {
      key: '',
      action: n.action,
      topic: n.name,
      route: topicRoute(n.action, workUnit, n.name),
      label: startVerbLabel(n),
    };
    if (n.blocked) {
      entry.blocked = true;
      entry.deps_blocking = n.deps_blocking;
    }
    out.push(entry);
  }
  return out;
}

/** Command options with presence conditions and adaptive descriptions. @param {string} workUnit @param {EpicDetail} detail @param {boolean} hasMap @returns {MenuKey[]} */
function commandOptions(workUnit, detail, hasMap) {
  /** @type {MenuKey[]} */
  const opts = [];
  if (detail.gating.can_start_specification) {
    const desc = detail.unaccounted_discussions.length > 0
      ? `${detail.unaccounted_discussions.length} discussion(s) not yet grouped`
      : 'review or regroup specifications';
    opts.push({
      key: 's', word: 'spec', action: 'analyze_discussions', topic: null,
      route: `/workflow-specification-entry epic ${workUnit}`,
      label: `Analyze / regroup discussions — ${desc}`,
    });
  }
  opts.push({
    key: 'd', word: 'discuss', action: 'new_discussion', topic: null,
    route: `/workflow-discussion-entry epic ${workUnit}`,
    label: hasMap ? 'Start a discussion on a new topic' : 'Start new discussion',
  });
  opts.push({
    key: 'r', word: 'research', action: 'new_research', topic: null,
    route: `/workflow-research-entry epic ${workUnit}`,
    label: hasMap ? 'Start research on a new topic' : 'Start new research',
  });
  if (hasMap) {
    opts.push({
      key: 'i', word: 'discovery', action: 'continue_discovery', topic: null,
      route: `/workflow-discovery epic ${workUnit}`,
      label: 'Continue discovery',
    });
  }
  if (detail.completed.length > 0) {
    opts.push({ key: 'c', word: 'completed', action: 'resume_completed', topic: null, route: null, label: 'Resume a completed topic' });
  }
  const cancellable = Object.values(detail.phases)
    .some((items) => items.some((i) => i.status !== 'cancelled' && i.status !== 'promoted'));
  if (cancellable) {
    opts.push({ key: 'a', word: 'cancel', action: 'cancel_topic', topic: null, route: null, label: hasMap ? 'Cancel a topic (phase work)' : 'Cancel a topic' });
  }
  if (detail.cancelled.length > 0) {
    opts.push({ key: 'e', word: 'reactivate', action: 'reactivate_topic', topic: null, route: null, label: 'Reactivate a cancelled topic' });
  }
  if (Object.keys(detail.phases).length > 0) {
    opts.push({ key: 'm', word: 'map', action: 'view_map', topic: null, route: null, label: hasMap ? 'View pipeline map' : 'View epic dependency map' });
  }
  return opts;
}

/** All live (non-cancelled, non-promoted) items of one phase. @param {EpicDetail} detail @param {string} phase */
function liveItems(detail, phase) {
  return (detail.phases[phase] || []).filter((i) => i.status !== 'cancelled' && i.status !== 'promoted');
}

/**
 * Pick the recommended entry. Returns the entry to move first, or marks the
 * `s` command option, or neither (no recommendation).
 * @param {EpicDetail} detail @param {MenuKey[]} numbered @param {MenuKey[]} options @param {boolean} hasMap
 * @returns {MenuKey|null}
 */
function pickRecommendation(detail, numbered, options, hasMap) {
  const sOption = options.find((o) => o.action === 'analyze_discussions');

  if (hasMap) {
    if (detail.convergence_state === 'in-progress') {
      // Top of the map — the first discovery entry mirrors the first map row
      // with a non-null next_action (tier order: → first, then ◐, then ○).
      const discoveryActions = ['start_research', 'start_discussion', 'continue_research', 'continue_discussion', 'start_discussion_after_research'];
      return numbered.find((e) => discoveryActions.includes(e.action)) || null;
    }
    // settled — first build-phase next_phase_ready entry in pipeline order
    const build = numbered.find((e) => e.action.startsWith('start_') && !e.blocked
      && BUILD_PHASES.includes(ACTION_PHASE[/** @type {keyof typeof ACTION_PHASE} */ (e.action)]));
    if (build) return build;
    if (sOption) sOption.recommended = true;
    return null;
  }

  // No-map branch — recommendation by phase completion state.
  const proposedEntry = numbered.find((e) => e.action === 'start_specification');
  if (proposedEntry) return proposedEntry;

  const discussion = detail.phases.discussion || [];
  if (discussion.length > 0 && discussion.every((i) => i.status === 'completed')
      && (detail.phases.specification || []).length === 0 && sOption) {
    sOption.recommended = true;
    return null;
  }

  const specs = liveItems(detail, 'specification');
  const planEntry = numbered.find((e) => e.action === 'start_planning');
  if (specs.length > 0 && specs.every((i) => i.status === 'completed') && planEntry) return planEntry;

  const plans = liveItems(detail, 'planning');
  const implEntry = numbered.find((e) => e.action === 'start_implementation' && !e.blocked);
  if (plans.length > 0 && plans.every((i) => i.status === 'completed') && implEntry) return implEntry;

  const impls = liveItems(detail, 'implementation');
  const reviewEntry = numbered.find((e) => e.action === 'start_review');
  if (impls.length > 0 && impls.every((i) => i.status === 'completed') && reviewEntry) return reviewEntry;

  return null;
}

/**
 * Section C — the interactive menu. `keys` carries the machine action keys
 * (skills route on these); `rendered` is the dotted-gate markdown block.
 * @param {string} workUnit
 * @param {EpicDetail} detail
 * @returns {{keys: MenuKey[], rendered: string}}
 */
function epicMenu(workUnit, detail) {
  const hasMap = detail.discovery_map.length > 0;

  /** @type {MenuKey[]} */
  let numbered = [];

  if (hasMap) {
    // Discovery topics — one entry per map row with a non-null next_action
    // (✓/⊙/⊘ rows have none), in map order.
    for (const row of detail.discovery_map) {
      if (!row.next_action) continue;
      numbered.push({
        key: '',
        action: row.next_action,
        topic: row.name,
        route: topicRoute(row.next_action, workUnit, row.name),
        label: discoveryEntryLabel(row.next_action, row.name),
      });
    }
    // Build-phase entries by pipeline position — continues, then gated starts.
    for (const phase of BUILD_PHASES) {
      numbered.push(...continueEntries(workUnit, detail, phase));
      numbered.push(...startEntries(workUnit, detail, phase));
    }
  } else {
    // Continue items — any in-progress item in any phase, pipeline order.
    for (const phase of ['research', 'discussion', ...BUILD_PHASES]) {
      numbered.push(...continueEntries(workUnit, detail, phase));
    }
    // Next-phase-ready items — specification first, then planning,
    // implementation, review.
    for (const phase of BUILD_PHASES) {
      numbered.push(...startEntries(workUnit, detail, phase));
    }
  }

  const options = commandOptions(workUnit, detail, hasMap);

  const recommended = pickRecommendation(detail, numbered, options, hasMap);
  if (recommended) {
    recommended.recommended = true;
    numbered = [recommended, ...numbered.filter((e) => e !== recommended)];
  }

  numbered.forEach((e, i) => { e.key = String(i + 1); });

  const lines = ['· · · · · · · · · · · ·', 'What would you like to do?', ''];
  for (const e of numbered) {
    lines.push(`- **\`${e.key}\`** — ${e.label}${e.recommended ? ' (recommended)' : ''}`);
  }
  if (hasMap && numbered.length > 0 && options.length > 0) lines.push('');
  for (const o of options) {
    lines.push(`- **\`${o.key}\`/\`${o.word}\`** — ${o.label}${o.recommended ? ' (recommended)' : ''}`);
  }
  lines.push('', 'Select an option:', '· · · · · · · · · · · ·');

  return { keys: [...numbered, ...options], rendered: lines.join('\n') };
}

module.exports = { epicDashboard, epicKey, epicMenu };
