'use strict';

// ---------------------------------------------------------------------------
// Domain ring: epic projections — the dashboard, key, and menu views over one
// EpicDetail (see ../epic-detail.cjs).
//
// Deterministic: same detail, same string. The dashboard groups every phase
// under the three-D stage dividers (DISCOVERY / DEFINITION / DELIVERY); the
// menu carries machine action keys so skills route on keys, never on labels.
// Layout goes through the kernel renderer — no character arithmetic here.
// ---------------------------------------------------------------------------

const { signpost, box, renderTree, wrap, wrapWithPrefix } = require('../../kernel/render.cjs');
const { WORK_TYPE_PIPELINES, DERIVED_PHASES } = require('../../kernel/manifest-schema.cjs');
const { TREE_WIDTH, treeHeader, titlecase, title, derivedFrom, stateNote, materialBlock, discoveryGlyph, discoveryLifecycleLabel } = require('../conventions.cjs');
const { section, menuFrame, cmdOption, callout } = require('./surfaces.cjs');
const { fmtAge, CODE_PHASES } = require('../presence.cjs');
const { buildOrderLive } = require('../build-order.cjs');

/** @typedef {import('../epic-detail.cjs').EpicDetail} EpicDetail */
/** @typedef {import('../epic-detail.cjs').MapRow} MapRow */
/** @typedef {import('../epic-detail.cjs').PhaseEntry} PhaseEntry */
/** @typedef {import('../epic-detail.cjs').NextPhaseEntry} NextPhaseEntry */
/** @typedef {import('../epic-detail.cjs').DepBlocking} DepBlocking */
/** @typedef {import('../epic-detail.cjs').ItemRef} ItemRef */

/**
 * @typedef {object} NewArrivals
 * @property {string[]} [gap_analysis]        topic names added by gap-analysis this boot-up
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
 * @property {boolean} [input_moved]   the entry's item (or its source item) carries a live reconcile flag
 * @property {boolean} [in_session]    a held session elsewhere occupies this topic's phase
 * @property {number} [session_age]    that session's last-active age in seconds
 * @property {{work_unit: string, phase: string, topic: string}} [session_holder] the held code row taking the slot, when it is not this entry's own topic
 * @property {boolean} [code_session]  the hold is the checkout's code slot — gated at the entry skill, never by this menu
 */

/** @typedef {import('../presence.cjs').PresenceRow} PresenceRow */

const EPIC_PIPELINE = WORK_TYPE_PIPELINES.epic;

const BUILD_PHASES = EPIC_PIPELINE.slice(EPIC_PIPELINE.indexOf('specification'));

// The three-D stage each pipeline phase renders under. STAGES groups the epic
// pipeline in order by this labelling, so the dividers can never hold a phase
// the pipeline lacks.
const STAGE_OF = {
  research: 'DISCOVERY', experiment: 'DISCOVERY', discussion: 'DISCOVERY',
  specification: 'DEFINITION', planning: 'DEFINITION',
  implementation: 'DELIVERY', review: 'DELIVERY',
};

/** @type {{name: string, phases: string[]}[]} */
const STAGES = EPIC_PIPELINE.reduce((/** @type {{name: string, phases: string[]}[]} */ stages, phase) => {
  const name = STAGE_OF[/** @type {keyof typeof STAGE_OF} */ (phase)];
  const last = stages[stages.length - 1];
  if (last && last.name === name) last.phases.push(phase);
  else stages.push({ name, phases: [phase] });
  return stages;
}, []);

const STATUS_ORDER = ['proposed', 'triaged', 'in-progress', 'completed', 'cancelled', 'promoted'];

const PHASE_ENTRY_SKILL = {
  research: 'workflow-research-entry',
  experiment: 'workflow-experiment-entry',
  discussion: 'workflow-discussion-entry',
  specification: 'workflow-specification-entry',
  planning: 'workflow-planning-entry',
  implementation: 'workflow-implementation-entry',
  review: 'workflow-review-entry',
};

const ACTION_PHASE = {
  start_research: 'research',
  continue_research: 'research',
  continue_experiment: 'experiment',
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

// Every action the epic menu can hand the soft gate: the phase actions plus
// the command options the selection flow routes through it. One home — the
// gate refuses anything outside it, so a rename here can never silently
// stop a gate firing.
const SOFT_GATE_ACTIONS = [
  ...Object.keys(ACTION_PHASE),
  'analyze_discussions', 'new_discussion', 'new_research', 'continue_discovery',
];

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
  return discoveryLifecycleLabel(row.lifecycle, row.routing, row.research_state ?? null, row.triage_parked ?? false, row.reconcile_pending ?? false, row.awaiting_experiments);
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

/** Build the tree nodes for one build/flat phase — a completed item with a live reconcile flag carries the `· input moved` cue. @param {string} phase @param {PhaseEntry[]} items */
function phaseNodes(phase, items) {
  return displayOrder(phase, items).map((item) => {
    const depBlocked = Array.isArray(item.deps_blocking) && item.deps_blocking.length > 0;
    const tagText = item.status === 'completed' && item.reconcile_needed !== undefined
      ? 'completed · input moved'
      : (item.blocked_by !== undefined || depBlocked ? `${item.status} · blocked` : item.status);
    const head = title({ label: titlecase(item.name) });
    // The plan format rides inside the tag rather than after it: anything
    // appended past the tag column would break the alignment for every row.
    const tag = phase === 'planning' && item.format ? `${tagText} · ${item.format}` : tagText;
    /** @type {{title: string, tag?: string}[]} */
    const children = [];
    if (phase === 'specification' && Array.isArray(item.sources)) {
      for (const src of item.sources) {
        children.push({ title: title({ label: titlecase(sourceName(src)) }), tag: src.status || 'pending' });
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
    return children.length ? { title: head, tag, children } : { title: head, tag };
  });
}

/** Sub-header + item tree for one phase. @param {string} phase @param {PhaseEntry[]} items */
function phaseBlock(phase, items) {
  return treeHeader(`${phase.toUpperCase()} (${countSummary(items)})`) + '\n'
    + renderTree(phaseNodes(phase, items), { width: TREE_WIDTH });
}

/** ⚑ callout wrapped under the flag — continuation lines align with the text. @param {string} text */
function flaggedCallout(text) {
  return callout(text, { width: TREE_WIDTH });
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
  if (s.handled) parts.push(`${s.handled} dead-ended`);
  if (s.cancelled) parts.push(`${s.cancelled} cancelled`);
  return parts.length ? ' · ' + parts.join(' · ') : '';
}

/** The MATERIAL block above the map header — what the epic carried in. @param {EpicDetail} detail */
function stageMaterial(detail) {
  const showImports = detail.imports_count > 0 && detail.imports_count !== detail.discovery_map.length;
  return materialBlock({ seeds: detail.seeds_count, imports: showImports ? detail.imports_count : 0 });
}

/** Arrival callouts above the map header — what the analysis added this boot-up. @param {NewArrivals} newArrivals */
function arrivalCallouts(newArrivals) {
  const lines = [];
  for (const [field, label] of [['gap_analysis', 'gap-analysis']]) {
    const names = newArrivals[/** @type {'gap_analysis'} */ (field)];
    if (Array.isArray(names) && names.length > 0) {
      lines.push(`  ⚑ ${names.length} new topic(s) added to the map from ${label}.`);
    }
  }
  return lines;
}

// Discovery-map topic rows as kernel tree nodes. No tag column — the
// lifecycle rides a `↳ state` line beneath the summary, so long titles never
// stretch a shared column across the whole map.
/** @param {EpicDetail} detail @param {Set<string>} heldTopics */
function mapNodes(detail, heldTopics) {
  return detail.discovery_map.map((row) => {
    const body = [];
    if (row.summary) body.push(row.summary);
    if (row.source_provenance) body.push(derivedFrom(row.source_provenance));
    body.push(stateNote(heldTopics.has(row.name) ? `${lifecycleLabel(row)} · in session` : lifecycleLabel(row)));
    return {
      title: title({ glyph: discoveryGlyph(row.lifecycle), label: titlecase(row.name) }),
      body,
    };
  });
}

/** Held rows from a presence scan — sessions whose owning process still runs. @param {PresenceRow[]|undefined} presence @returns {PresenceRow[]} */
function heldSessions(presence) {
  return (presence || []).filter((r) => r.held);
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
    return 'Conclude the remaining discussions to unlock specification — the grouping analysis reads the settled record.';
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
    + wrapWithPrefix('These plans have unresolved dependencies that must be addressed first.',
      { width: TREE_WIDTH, prefix: '  ' }).join('\n'),
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
 * @param {{newArrivals?: NewArrivals, presence?: PresenceRow[]}} [opts]
 * @returns {string}
 */
function epicDashboard(workUnit, detail, opts = {}) {
  const newArrivals = opts.newArrivals || {};
  const heldTopics = new Set(heldSessions(opts.presence).map((r) => r.topic));
  const hasMap = detail.discovery_map.length > 0;
  const phaseNames = Object.keys(detail.phases);

  // Brand-new epic — nothing started anywhere. Point at the one true door.
  if (!hasMap && phaseNames.length === 0) {
    return ''
      + 'No work started yet.\n\n'
      + flaggedCallout('Run discovery to shape the topic map — research and discussion start from there.')
      + '\n';
  }

  /** @type {string[]} stage blocks, each ending with a single \n */
  const stages = [];

  if (hasMap) {
    // Stage dividers are drawn inside the fence, where markdown chrome cannot
    // reach — so they size to the content they divide rather than to the
    // kernel's fixed chrome width, and the dashboard stays internally
    // consistent at any terminal width.
    let block = signpost('DISCOVERY', { width: TREE_WIDTH }) + '\n\n';
    // Material and arrivals are separate blocks: the ⚑ lines are alerts about
    // the map, not things the epic carried in, so they never sit under the
    // MATERIAL header.
    const material = stageMaterial(detail);
    if (material) block += material + '\n\n';
    const callouts = arrivalCallouts(newArrivals);
    if (callouts.length > 0) block += callouts.join('\n') + '\n\n';
    const total = detail.map_summary ? detail.map_summary.total : detail.discovery_map.length;
    block += treeHeader(`RESEARCH & DISCUSSION (${total} topic${total === 1 ? '' : 's'}${mapStatusSuffix(detail)})`) + '\n';
    block += renderTree(mapNodes(detail, heldTopics), { width: TREE_WIDTH, gap: true });
    stages.push(block);
  }

  for (const stage of STAGES) {
    if (hasMap && stage.name === 'DISCOVERY') continue; // the map is the DISCOVERY stage
    const populated = stage.phases.filter((p) => (detail.phases[p] || []).length > 0);
    if (populated.length === 0) continue;
    stages.push(
      signpost(stage.name, { width: TREE_WIDTH }) + '\n\n'
      + populated.map((p) => phaseBlock(p, detail.phases[p])).join('\n')
    );
  }

  let out = stages.join('\n');

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

const KEY_STATUS =
  '  Status:\n'
  + '    proposed    — analyzed grouping, not yet started\n'
  + '    triaged     — rerouted concerns parked, topic not started\n'
  + '    in-progress — work is ongoing\n'
  + '    completed   — phase or implementation done\n'
  + '    cancelled   — topic removed from active work\n'
  + '    promoted    — moved to its own cross-cutting work unit';

const KEY_BLOCKING =
  '  Blocking reason:\n'
  + '    blocked by {plan}:{task} — depends on another plan\'s task\n'
  + '    blocked by {plan}        — dependency unresolved';

const CUE_RECONCILE =
  '    input moved             — an upstream artifact was revised since\n'
  + '                              this item completed; the item\'s entry\n'
  + '                              flow reconciles it';

const CUE_BLOCKED =
  '    blocked (specification) — a source discussion is back\n'
  + '                              in-progress; re-conclude it and the\n'
  + '                              item returns to the menu';

const CUE_PLAN_BLOCKED =
  '    blocked (planning)      — implementation waits on another plan;\n'
  + '                              the ⚑ list names the dependency,\n'
  + '                              u/unblock is the override';

/**
 * Section B — the Key block, showing only categories present in the display
 * whose vocabulary the rows don't spell out themselves: phase-item status
 * tags, the `input moved` cue, and blocking reasons. Map-row lifecycle and
 * session state need no legend — their `↳` state lines carry the words.
 * Empty string when nothing on screen earns a legend.
 * @param {EpicDetail} detail
 * @returns {string}
 */
function epicKey(detail) {
  const hasMap = detail.discovery_map.length > 0;
  const phaseNames = Object.keys(detail.phases);
  if (!hasMap && phaseNames.length === 0) return '';

  const anyBlocked = (detail.phases.planning || [])
    .some((p) => Array.isArray(p.deps_blocking) && p.deps_blocking.length > 0);
  // The cue legend mirrors the display: with a map only build phases render
  // item rows — but map rows themselves cue via the reconcile_pending rider;
  // without a map every phase renders.
  const cuePhases = hasMap ? BUILD_PHASES : Object.keys(detail.phases);
  const anyFlagged = cuePhases.some((p) => (detail.phases[p] || [])
    .some((i) => i.status === 'completed' && i.reconcile_needed !== undefined))
    || detail.discovery_map.some((r) => r.reconcile_pending === true);
  const specBlockedAny = (detail.phases.specification || []).some((i) => i.blocked_by !== undefined);
  const blocks = [];
  if (!hasMap || BUILD_PHASES.some((p) => (detail.phases[p] || []).length > 0)) blocks.push(KEY_STATUS);
  const cueLines = [];
  if (anyFlagged) cueLines.push(CUE_RECONCILE);
  if (specBlockedAny) cueLines.push(CUE_BLOCKED);
  if (anyBlocked) cueLines.push(CUE_PLAN_BLOCKED);
  if (cueLines.length > 0) blocks.push('  Cue:\n' + cueLines.join('\n'));
  if (anyBlocked) blocks.push(KEY_BLOCKING);
  if (blocks.length === 0) return '';
  return 'Key:\n' + blocks.join('\n\n');
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

/** @param {string} action @param {string} workUnit @param {string} topic */
function topicRoute(action, workUnit, topic) {
  return `/${PHASE_ENTRY_SKILL[/** @type {keyof typeof ACTION_PHASE} */ (ACTION_PHASE[action])]} epic ${workUnit} ${topic}`;
}

/** @param {string} action @param {string} name @param {string|null} [researchState] @param {boolean} [triageParked] */
function discoveryEntryLabel(action, name, researchState, triageParked) {
  const t = titlecase(name);
  switch (action) {
    case 'start_research': return triageParked ? `Start research for "${t}" — *triage waiting*` : `Start research for "${t}"`;
    case 'start_discussion': return triageParked ? `Start discussion for "${t}" — *triage waiting*` : `Start discussion for "${t}"`;
    case 'continue_research': return `Continue "${t}" — *research*`;
    case 'continue_discussion': return `Continue "${t}" — *discussion*`;
    // start_discussion_after_research — superseded research is named as such,
    // never as completed (same rule as discoveryLifecycleLabel).
    default: return researchState === 'superseded'
      ? `Start discussion for "${t}" — *research superseded*`
      : `Start discussion for "${t}" — *research completed*`;
  }
}

/** @param {string} phase @param {PhaseEntry} item */
function continueLabel(phase, item) {
  const t = titlecase(item.name);
  let label;
  if (phase === 'implementation' && item.current_phase != null) {
    if (item.current_task) {
      label = `Continue "${t}" — *implementation (Phase ${item.current_phase}, Task ${item.current_task})*`;
    } else {
      const tasks = Array.isArray(item.completed_tasks) ? item.completed_tasks.length : 0;
      label = `Continue "${t}" — *implementation (Phase ${item.current_phase}, ${tasks} task(s) completed)*`;
    }
  } else {
    label = `Continue "${t}" — *${phase} [in-progress]*`;
  }
  return item.reconcile_needed !== undefined ? `${label} · input moved` : label;
}

/** @param {NextPhaseEntry} n @param {boolean} [srcFlagged]  the entry's source item carries a live reconcile flag */
function startVerbLabel(n, srcFlagged) {
  const t = titlecase(n.name);
  const cue = srcFlagged ? ' · input moved' : '';
  if (n.action === 'start_implementation') {
    return `Start implementation of "${t}" — *${n.label}*${cue}`;
  }
  const phase = ACTION_PHASE[/** @type {keyof typeof ACTION_PHASE} */ (n.action)];
  return `Start ${phase} for "${t}" — *${n.label}*${cue}`;
}

/**
 * One entry per topic whose series holds a live top-level record — appearing
 * at the first spawn, retiring when no live record remains. Entry is
 * per-topic: which experiment to work is resolved inside the phase.
 * @param {string} workUnit @param {EpicDetail} detail @returns {MenuKey[]}
 */
function experimentEntries(workUnit, detail) {
  /** @type {MenuKey[]} */
  const out = [];
  for (const item of detail.phases.experiment || []) {
    const live = item.experiments || [];
    if (live.length === 0) continue;
    out.push({
      key: '',
      action: 'continue_experiment',
      topic: item.name,
      route: topicRoute('continue_experiment', workUnit, item.name),
      label: `Enter the laboratory for "${titlecase(item.name)}" — *${live.length} experiment${live.length === 1 ? '' : 's'} queued*`,
    });
  }
  return out;
}

/** Continue entries for one phase's in-progress items. @param {string} workUnit @param {EpicDetail} detail @param {string} phase @returns {MenuKey[]} */
function continueEntries(workUnit, detail, phase) {
  return (detail.phases[phase] || [])
    .filter((item) => item.status === 'in-progress')
    // A blocked spec is not actionable — no menu row; the display tree
    // carries its blocked state.
    .filter((item) => !(phase === 'specification' && item.blocked_by !== undefined))
    .map((item) => ({
      key: '',
      action: `continue_${phase}`,
      topic: item.name,
      route: topicRoute(`continue_${phase}`, workUnit, item.name),
      label: continueLabel(phase, item),
      ...(item.reconcile_needed !== undefined ? { input_moved: true } : {}),
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
    // The entry's source item is the previous pipeline phase's same-named
    // item — a live reconcile flag there means starting forward propagates
    // known-stale input, so the label carries the cue.
    const srcPhase = EPIC_PIPELINE[EPIC_PIPELINE.indexOf(phase) - 1];
    const srcItem = srcPhase ? (detail.phases[srcPhase] || []).find((i) => i.name === n.name) : undefined;
    const srcFlagged = srcItem !== undefined && srcItem.reconcile_needed !== undefined;
    // A dep-blocked implementation start is not actionable — no menu row;
    // the ⚑ plans-not-ready block and the tree cue carry its blocked state,
    // and the u/unblock command option is the escape hatch.
    if (n.blocked) continue;
    /** @type {MenuKey} */
    const entry = {
      key: '',
      action: n.action,
      topic: n.name,
      route: topicRoute(n.action, workUnit, n.name),
      label: startVerbLabel(n, srcFlagged),
      ...(srcFlagged ? { input_moved: true } : {}),
    };
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
      label: `Analyze / regroup discussions — *${desc}*`,
    });
  }
  // Discovery is reachable in EVERY map state: with a map it refines the
  // map; without one it is how the map gets built — the map-less epic is the
  // state that needs the route most, so it leads the menu there.
  /** @type {MenuKey} */
  const discoveryOpt = {
    key: 'i', word: 'discovery', action: 'continue_discovery', topic: null,
    route: `/workflow-discovery epic ${workUnit}`,
    // An open session marker outranks map state: the user left a session
    // mid-flight, and discovery's resume gate is waiting for them.
    label: detail.active_session
      ? `Resume the in-progress discovery session (session-${detail.active_session})`
      : (hasMap ? 'Continue discovery' : 'Run discovery — shape the topic map'),
  };
  if (detail.active_session && hasMap) {
    // resume leads even on a populated map; the !hasMap unshift below already
    // leads for map-less epics
    opts.push(discoveryOpt);
  }
  if (!hasMap) opts.push(discoveryOpt);
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
  if (hasMap && !detail.active_session) opts.push(discoveryOpt);
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
  const anyPlanBlocked = (detail.phases.planning || [])
    .some((p) => Array.isArray(p.deps_blocking) && p.deps_blocking.length > 0);
  if (anyPlanBlocked) {
    opts.push({ key: 'u', word: 'unblock', action: 'unblock_plan', topic: null, route: null, label: 'Unblock a plan — mark a dependency as satisfied externally' });
  }
  // The build order's manual escape hatch: the automatic triggers fire on a
  // missing or stale order, never on a wrong one.
  const anyLiveSpec = (detail.phases.specification || []).some((i) => buildOrderLive(i));
  if (anyLiveSpec) {
    opts.push({ key: 'o', word: 'order', action: 'resequence_build_order', topic: null, route: null, label: 'Re-sequence the build order' });
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

  // An interrupted discovery session outranks every other recommendation —
  // the user left mid-thought and the resume gate is waiting.
  if (detail.active_session) {
    const discoveryOpt = options.find((o) => o.action === 'continue_discovery');
    if (discoveryOpt) { discoveryOpt.recommended = true; return null; }
  }

  // A live experiment outranks the rest: its verdict is what unblocks a
  // waiting conversation, and a phase whose locks have all released becomes
  // the recommendation again. The pick stays the user's — E1 then E2, or E1
  // then the half-unblocked conversation, are both legitimate orders.
  const experiment = numbered.find((e) => e.action === 'continue_experiment' && !e.in_session);
  if (experiment) return experiment;

  if (hasMap) {
    if (detail.convergence_state === 'in-progress') {
      // Top of the actionable map — the first discovery entry mirrors the
      // first map row with a non-null next_action. Decided rows lead the map
      // but carry no action, so the actionable order is → then ◐ then ○.
      // A topic another session holds open is never the recommendation.
      const discoveryActions = ['start_research', 'start_discussion', 'continue_research', 'continue_discussion', 'start_discussion_after_research'];
      return numbered.find((e) => discoveryActions.includes(e.action) && !e.in_session) || null;
    }
    // settled — first build-phase next_phase_ready entry in pipeline order.
    // An input-moved entry is never the recommendation: recommending a start
    // that propagates known-stale input contradicts its own cue — the
    // reconcile (via the flagged item's entry flow) comes first. Nor is an
    // entry a held session occupies — recommending the row the menu has
    // struck through would be the display arguing with itself.
    const build = numbered.find((e) => e.action.startsWith('start_') && !e.input_moved && !e.in_session
      && BUILD_PHASES.includes(ACTION_PHASE[/** @type {keyof typeof ACTION_PHASE} */ (e.action)]));
    if (build) return build;
    // With a flagged completed item and nothing else to start, the reconcile
    // route IS the recommendation — resuming the flagged item clears the flag.
    if (detail.completed.some((i) => i.reconcile_needed !== undefined)) {
      const cOption = options.find((o) => o.action === 'resume_completed');
      if (cOption) { cOption.recommended = true; return null; }
    }
    if (sOption) sOption.recommended = true;
    return null;
  }

  // No-map branch — recommendation by phase completion state.
  // Brand-new epic (no phase work at all): discovery is the recommendation.
  if (Object.values(detail.phases).every((items) => items.length === 0)) {
    const discoveryOpt = options.find((o) => o.action === 'continue_discovery');
    if (discoveryOpt) discoveryOpt.recommended = true;
    return null;
  }
  // Same rule as the settled branch: a struck row is never the
  // recommendation, or the display argues with itself.
  const proposedEntry = numbered.find((e) => e.action === 'start_specification' && !e.in_session);
  if (proposedEntry) return proposedEntry;

  const discussion = detail.phases.discussion || [];
  if (discussion.length > 0 && discussion.every((i) => i.status === 'completed')
      && (detail.phases.specification || []).length === 0 && sOption) {
    sOption.recommended = true;
    return null;
  }

  const specs = liveItems(detail, 'specification');
  const planEntry = numbered.find((e) => e.action === 'start_planning' && !e.input_moved && !e.in_session);
  if (specs.length > 0 && specs.every((i) => i.status === 'completed') && planEntry) return planEntry;

  const plans = liveItems(detail, 'planning');
  const implEntry = numbered.find((e) => e.action === 'start_implementation' && !e.input_moved && !e.in_session);
  if (plans.length > 0 && plans.every((i) => i.status === 'completed') && implEntry) return implEntry;

  const impls = liveItems(detail, 'implementation');
  const reviewEntry = numbered.find((e) => e.action === 'start_review' && !e.input_moved && !e.in_session);
  if (impls.length > 0 && impls.every((i) => i.status === 'completed') && reviewEntry) return reviewEntry;

  return null;
}

/**
 * Mark entries a held session elsewhere occupies. A doc entry is marked by a
 * row on its own (phase, topic); a code entry is marked by any held
 * implementation or review row in the project, because code does not
 * partition — one tree, one index, one slot, whatever work unit holds it.
 * @param {MenuKey[]} numbered @param {PresenceRow[]} held
 * @param {(PresenceRow & {work_unit: string})[]} [codeHeld] project-wide held code rows
 */
function markHeldEntries(numbered, held, codeHeld = []) {
  for (const e of numbered) {
    const phase = ACTION_PHASE[/** @type {keyof typeof ACTION_PHASE} */ (e.action)];
    const own = held.find((r) => r.phase === phase && r.topic === e.topic);
    const foreign = own || !CODE_PHASES.includes(phase) ? undefined : codeHeld[0];
    const row = own || foreign;
    if (!row) continue;
    e.in_session = true;
    e.session_age = row.age_seconds;
    // A code entry's hold is the checkout's one slot, and its gate lives at
    // the entry skill — the marker says so, so the menu's own in-session gate
    // never fires for it and the user meets one gate per attempt.
    if (CODE_PHASES.includes(phase)) e.code_session = true;
    if (foreign) {
      e.session_holder = { work_unit: foreign.work_unit, phase: foreign.phase, topic: foreign.topic };
    }
  }
}

/**
 * Section C — the interactive menu. `keys` carries the machine action keys
 * (skills route on these); `rendered` is the dotted-gate markdown block.
 * @param {string} workUnit
 * @param {EpicDetail} detail
 * @param {{presence?: PresenceRow[], codeHeld?: (PresenceRow & {work_unit: string})[]}} [opts]
 * @returns {{keys: MenuKey[], rendered: string}}
 */
function epicMenu(workUnit, detail, opts = {}) {
  const hasMap = detail.discovery_map.length > 0;

  /** @type {MenuKey[]} */
  let numbered = [];

  // Live experiments lead the menu whatever the map state — one row per
  // topic with live records, ranked above every other entry.
  numbered.push(...experimentEntries(workUnit, detail));

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
        label: discoveryEntryLabel(row.next_action, row.name, row.research_state ?? null, row.triage_parked ?? false),
      });
    }
    // Build-phase entries by pipeline position — continues, then gated starts.
    for (const phase of BUILD_PHASES) {
      numbered.push(...continueEntries(workUnit, detail, phase));
      numbered.push(...startEntries(workUnit, detail, phase));
    }
  } else {
    // Continue items — any in-progress item in any phase, pipeline order.
    // Derived phases are skipped: their topic rows above already carry the
    // series, and a generic item row would double it.
    for (const phase of EPIC_PIPELINE) {
      if (DERIVED_PHASES.includes(phase)) continue;
      numbered.push(...continueEntries(workUnit, detail, phase));
    }
    // Next-phase-ready items — specification first, then planning,
    // implementation, review.
    for (const phase of BUILD_PHASES) {
      numbered.push(...startEntries(workUnit, detail, phase));
    }
  }

  markHeldEntries(numbered, heldSessions(opts.presence), opts.codeHeld || []);

  const options = commandOptions(workUnit, detail, hasMap);

  const recommended = pickRecommendation(detail, numbered, options, hasMap);
  if (recommended) {
    recommended.recommended = true;
    // The recommendation leads the menu — unless the entries it would jump
    // include one a held session occupies, which keeps its position so the
    // in-session marker reads in place.
    const ahead = numbered.slice(0, numbered.indexOf(recommended));
    if (!ahead.some((e) => e.in_session)) {
      numbered = [recommended, ...numbered.filter((e) => e !== recommended)];
    }
  }

  numbered.forEach((e, i) => { e.key = String(i + 1); });

  const lines = ['What would you like to do?', ''];
  for (const e of numbered) {
    // The word names what holds the row: `code session` for the checkout's
    // one code slot, wherever it is held, plus the holder when it is somebody
    // else's — a hold on this very topic needs no address.
    const holder = e.code_session
      ? `code session${e.session_holder ? ` in ${e.session_holder.work_unit}/${e.session_holder.topic}` : ''}`
      : 'in session';
    const label = e.in_session
      ? `~~${e.label}~~ · ${holder} (last active ${fmtAge(e.session_age ?? 0)} ago)`
      : e.label;
    lines.push(cmdOption(e.key, null, `${label}${e.recommended ? ' (recommended)' : ''}`));
  }
  for (const o of options) {
    lines.push(cmdOption(o.key, o.word, `${o.label}${o.recommended ? ' (recommended)' : ''}`));
  }

  return { keys: [...numbered, ...options], rendered: menuFrame(lines) };
}

/**
 * Labelled confirm-gate section for one menu entry a held session occupies —
 * served by the gateway's `in-session-gate` verb, fetched by the flow at the
 * gate that displays it. Never blocks: the machine can verify that a process
 * still runs, never that its session still matters, so the gate states the
 * fact, names the consequence and the release, and lets the user decide.
 * Document phases only — a code entry's hold is the checkout's one slot, and
 * the `code-gate` surface at the entry skill owns that conversation, so the
 * user meets one gate per attempt.
 * @param {string} workUnit  this epic — the holder of the topic this entry would open
 * @param {MenuKey} entry
 * @returns {string} one labelled MENU section
 */
function epicInSessionGate(workUnit, entry) {
  const phase = ACTION_PHASE[/** @type {keyof typeof ACTION_PHASE} */ (entry.action)];
  const topic = entry.topic || '';
  const fact = `"${titlecase(topic)}" is open in another session — last active ${fmtAge(entry.session_age ?? 0)} ago.`;
  const consequence = `Proceeding starts a second concurrent session on the same ${phase}; its work could conflict with that session's.`;
  const release = `node .claude/skills/workflow-engine/scripts/engine.cjs presence clear ${workUnit} ${phase} ${topic}`;
  return section(
    `MENU: in-session gate — ${entry.key}`,
    "emit verbatim as markdown, then STOP for the user's response",
    menuFrame([
      `${fact} ${consequence} Only proceed if you know that session is no longer working; if it is wedged but alive, release its hold with \`${release}\`.`,
      '',
      '**`◆ Proceed anyway?`**',
      '',
      cmdOption('b', 'back', 'Return to menu (recommended)'),
      cmdOption('p', 'proceed', 'Proceed anyway'),
    ]),
  );
}

// ---------------------------------------------------------------------------
// Selection sub-views — the grouped pick lists behind the menu's internal
// flows (resume completed / cancel / reactivate). Each returns the keys table,
// the grouped DISPLAY list, and the pick-menu markdown.
// ---------------------------------------------------------------------------

/**
 * @typedef {object} SubViewKey
 * @property {string} key             what the user types (`1`, `2`, …, `b`)
 * @property {string} [word]          long form of a command option (`back`)
 * @property {string} action          machine action key — skills route on this, never the label
 * @property {string|null} topic
 * @property {string|null} phase
 * @property {string|null} route      skill invocation, or null when the flow continues internally
 * @property {string} label
 * @property {string} [dep]           unblock rows — the dependency topic to mark satisfied
 */

/**
 * @typedef {object} SubViewRow
 * @property {string} phase
 * @property {string} topic
 * @property {string} row     display line (unindented; the branch glyph and `{key}. ` are prefixed)
 * @property {string} label   pick-menu option label
 * @property {string|null} route
 * @property {string} [dep]   unblock rows — the dependency topic to mark satisfied
 */

/** The back option every sub-view menu closes with. @returns {SubViewKey} */
function backKey() {
  return { key: 'b', word: 'back', action: 'back', topic: null, phase: null, route: null, label: 'Return to menu' };
}

/**
 * Compose one selection sub-view from its rows: sequential numbering across
 * phase groups, blank line between groups, dotted pick menu with `b/back`.
 * The heading is the caller's TITLE section, never drawn here — so the phase
 * header sits at column 0 with its rows hanging two columns off it, the shape
 * every engine list shares. Picker rows are list rows: the `[tag]` rides
 * inline rather than columnising, matching the inbox pickup.
 * @param {string} title     the view's chrome heading (TITLE section)
 * @param {string} empty     the display's stand-in when there are no rows
 * @param {string} question  the pick menu's first line
 * @param {string} action    the numbered entries' action key
 * @param {SubViewRow[]} rows  display order; grouped by contiguous `phase` runs
 * @returns {{keys: SubViewKey[], title: string, display: string, rendered: string}}
 */
function selectionSubView(title, empty, question, action, rows) {
  /** @type {SubViewKey[]} */
  const keys = [];
  const displayLines = [];
  let phase = null;
  rows.forEach((r, i) => {
    const key = String(i + 1);
    keys.push({ key, action, topic: r.topic, phase: r.phase, route: r.route, label: r.label, ...(r.dep ? { dep: r.dep } : {}) });
    if (r.phase !== phase) {
      if (displayLines.length) displayLines.push('');
      displayLines.push(titlecase(r.phase));
      phase = r.phase;
    }
    const lastInGroup = i === rows.length - 1 || rows[i + 1].phase !== r.phase;
    // Sub-views are plain list rows (CONVENTIONS: selection sub-views use
    // the [term] form, not trees) — the branch glyphs are visual grouping,
    // so wrapped continuations align under the row text with no rail.
    const glyph = lastInGroup ? '└─' : '├─';
    displayLines.push(...wrapWithPrefix(`${key}. ${r.row}`, {
      width: TREE_WIDTH, prefix: `  ${glyph} `, hang: `${key}. `.length,
    }).map((line, li) => (li === 0 ? line : line.replace(`  ${glyph} `, '     '))));
  });
  keys.push(backKey());

  const menuLines = [question, ''];
  for (const k of keys) {
    menuLines.push(cmdOption(k.key, k.word, k.label));
  }

  return {
    keys,
    title,
    display: (rows.length ? displayLines.join('\n') : empty) + '\n',
    rendered: menuFrame(menuLines),
  };
}

/** Group ItemRefs by phase in pipeline order. @param {ItemRef[]} items @returns {ItemRef[]} */
function pipelineOrdered(items) {
  const order = Object.keys(PHASE_ENTRY_SKILL);
  return [...items].sort((a, b) => order.indexOf(a.phase) - order.indexOf(b.phase));
}

/**
 * Section D — the Completed Topics list and pick menu. Numbered entries route
 * to the topic's phase entry skill.
 * @param {string} workUnit
 * @param {EpicDetail} detail
 * @returns {{keys: SubViewKey[], title: string, display: string, rendered: string}}
 */
function epicCompletedMenu(workUnit, detail) {
  const rows = pipelineOrdered(detail.completed).map((item) => {
    const flagged = item.reconcile_needed !== undefined;
    return {
      phase: item.phase,
      topic: item.name,
      row: title({ label: titlecase(item.name), tag: flagged ? 'completed · input moved' : 'completed' }),
      label: `Resume "${titlecase(item.name)}" — *${item.phase}*${flagged ? ' · input moved' : ''}`,
      route: topicRoute(`continue_${item.phase}`, workUnit, item.name),
    };
  });
  return selectionSubView('Completed Topics', 'No completed topics.', 'Which topic would you like to resume?', 'resume', rows);
}

/**
 * Section E — the Cancellable Topics list and pick menu (non-cancelled,
 * non-promoted items). No routes — the flow continues to its confirmation gate.
 * @param {EpicDetail} detail
 * @returns {{keys: SubViewKey[], title: string, display: string, rendered: string}}
 */
function epicCancelMenu(detail) {
  /** @type {SubViewRow[]} */
  const rows = [];
  for (const [phase, items] of Object.entries(detail.phases)) {
    for (const item of items) {
      if (item.status === 'cancelled' || item.status === 'promoted') continue;
      rows.push({
        phase,
        topic: item.name,
        row: title({ label: titlecase(item.name), tag: item.status }),
        label: `Cancel "${titlecase(item.name)}" — *${phase} [${item.status}]*`,
        route: null,
      });
    }
  }
  return selectionSubView('Cancellable Topics', 'No cancellable topics.', 'Which topic would you like to cancel?', 'cancel', rows);
}

/**
 * Section F — the Cancelled Topics list and pick menu, each row carrying the
 * stashed `previous_status`. No routes — the flow runs the reactivate
 * transaction.
 * @param {EpicDetail} detail
 * @returns {{keys: SubViewKey[], title: string, display: string, rendered: string}}
 */
function epicReactivateMenu(detail) {
  const rows = pipelineOrdered(detail.cancelled).map((item) => {
    const was = `(was: ${item.previous_status || 'unknown'})`;
    return {
      phase: item.phase,
      topic: item.name,
      row: `${title({ label: titlecase(item.name), tag: 'cancelled' })} ${was}`,
      label: `Reactivate "${titlecase(item.name)}" — *${item.phase} ${was}*`,
      route: null,
    };
  });
  return selectionSubView('Cancelled Topics', 'No cancelled topics.', 'Which topic would you like to reactivate?', 'reactivate', rows);
}

/**
 * Section G — the blocked-plans list and pick menu, one row per blocking
 * dependency (a plan with two blockers gets two rows). The `topic` slot
 * carries the plan, the `dep` field the dependency topic to mark satisfied.
 * No routes — the flow runs the manifest write.
 * @param {EpicDetail} detail
 * @returns {{keys: SubViewKey[], title: string, display: string, rendered: string}}
 */
function epicUnblockMenu(detail) {
  /** @type {SubViewRow[]} */
  const rows = [];
  for (const item of detail.phases.planning || []) {
    for (const dep of item.deps_blocking || []) {
      rows.push({
        phase: 'planning',
        topic: item.name,
        dep: dep.topic,
        row: `${title({ label: titlecase(item.name) })} — blocked by ${depRef(dep)} (${dep.reason})`,
        label: `Unblock "${titlecase(item.name)}" — *mark ${depRef(dep)} satisfied externally*`,
        route: null,
      });
    }
  }
  return selectionSubView('Blocked Plans', 'No blocked plans.', 'Which dependency has been satisfied?', 'unblock', rows);
}

module.exports = { epicDashboard, epicKey, epicMenu, epicInSessionGate, epicCompletedMenu, epicCancelMenu, epicReactivateMenu, epicUnblockMenu, SOFT_GATE_ACTIONS };
