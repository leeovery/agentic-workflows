'use strict';

// ---------------------------------------------------------------------------
// Adapter (read gateway) for workflow-continue-epic. Thin by design: detail
// building lives in the engine's domain ring; this script selects which
// engine answers the skill's flow needs and sections the output.
//
//   gateway.cjs {work_unit}   → scoped state dump, one epic (Steps 1–6)
//   gateway.cjs view {work_unit} [new_arrivals_json]
//                               → DATA + DISPLAY + MENU snapshot (Step 6)
//   gateway.cjs completed-menu {work_unit}     → Resume Completed sub-view (D)
//   gateway.cjs cancel-menu {work_unit}        → Cancel Topic sub-view (E)
//   gateway.cjs reactivate-menu {work_unit}    → Reactivate Topic sub-view (F)
//   gateway.cjs unblock-menu {work_unit}       → Unblock Plan sub-view (G)
//   gateway.cjs postpone-menu {work_unit}      → Postpone Topic sub-view (H)
//   gateway.cjs pull-forward-menu {work_unit}  → Pull Forward Topic sub-view (I)
//   gateway.cjs spec-scenario {work_unit}      → the specification menu's routing read, DATA only
//   gateway.cjs spec-view {work_unit}          → its snapshot: DATA + TITLE + DISPLAY (+ MENU)
//   gateway.cjs spec-completed-menu {work_unit} → its Completed Specifications sub-view
//   gateway.cjs in-session-gate {work_unit} {key} → the in-session confirm over one held entry
//
// Those calls are the whole legal surface: the bare call, a verb without its
// work unit, an unknown verb, or excess arguments is a usage error (stderr,
// exit 1) — never a silent first-epic render.
// ---------------------------------------------------------------------------

const engine = require('../../workflow-engine/scripts/lib.cjs');
const { TERMINAL_STATUSES } = require('../../workflow-engine/scripts/kernel/manifest-schema.cjs');
const { loadActiveManifests } = engine.reads;
const { phaseItems } = engine.derivations;

/**
 * The active epics, each with its detail — the one named `workUnit` where the
 * caller names one.
 * @param {string} cwd @param {string} [workUnit]
 * @returns {{epics: {name: string, detail: any}[]}}
 */
function discover(cwd, workUnit) {
  const epics = loadActiveManifests(cwd)
    .filter((m) => m.work_type === 'epic' && (workUnit === undefined || m.name === workUnit))
    .map((m) => ({ name: m.name, detail: engine.detail.epicDetail(cwd, m) }));
  return { epics };
}

/** A parked stub is undrained work — never done. @param {any} d @returns {boolean} */
function parkedConcerns(d) {
  return ['research', 'discussion'].some((phase) => ((d.phases && d.phases[phase]) || []).some((i) => i.status === 'triaged'));
}

/**
 * The all-done derivation over one epic detail: review items exist
 * and every non-terminal one is completed, nothing is in progress or awaiting
 * its next phase, no completed discussion is unaccounted, no item carries a
 * live reconcile flag (the epic mirror of the linear types' routing override
 * — the terminal gate is never offered past known-stale input), and the
 * discovery map has settled (or the epic has none).
 * @param {any} d  EpicDetail
 * @returns {boolean}
 */
function computeAllDone(d) {
  const review = (d.phases && d.phases.review) || [];
  const live = review.filter((i) => !TERMINAL_STATUSES.includes(i.status));
  return live.length > 0
    && live.every((i) => i.status === 'completed')
    && d.in_progress.length === 0
    && d.next_phase_ready.length === 0
    && d.unaccounted_discussions.length === 0
    && !parkedConcerns(d)
    && reconcilePending(d).length === 0
    && (d.convergence_state === 'settled' || d.convergence_state === null);
}

/**
 * Completed items carrying a live reconcile flag, across every phase —
 * `phase/name (value)` strings for the scoped dump, the same vocabulary the
 * linear bridge's `reconcile_pending:` line uses.
 * @param {any} d  EpicDetail
 * @returns {string[]}
 */
function reconcilePending(d) {
  const out = [];
  for (const [phase, items] of Object.entries(d.phases || {})) {
    for (const item of items) {
      if (!TERMINAL_STATUSES.includes(item.status) && item.reconcile_needed !== undefined) {
        out.push(`${phase}/${item.name} (${item.reconcile_needed})`);
      }
    }
  }
  return out;
}

// The scoped state dump for one epic — the reasoning surface Steps 1–6
// read: the all-done flag, analysis-cache statuses, the sequencing flag, and
// the discovery-map rows (tier, lifecycle, routing, field presence, current
// summary text).
function formatScoped(workUnit, result) {
  const e = result.epics[0];
  const lines = [];
  lines.push(`=== EPIC: ${workUnit} ===`);
  if (!e) {
    lines.push('error: no active epic with this name');
    return lines.join('\n') + '\n';
  }
  const d = e.detail;
  lines.push(`all_done: ${computeAllDone(d)}`);
  lines.push(`reconcile_pending: ${reconcilePending(d).join(', ') || '(none)'}`);
  lines.push(`analysis_caches: gap_analysis=${d.analysis_caches.gap_analysis.status}`);
  lines.push(`needs_sequencing: ${d.needs_sequencing}`);
  lines.push(`build_order_needs_sequencing: ${d.build_order_needs_sequencing}`);
  lines.push(`discovery_map (${d.discovery_map.length}):`);
  if (d.discovery_map.length === 0) {
    lines.push('  (empty)');
  }
  for (const t of d.discovery_map) {
    let line = `  - ${t.tier} ${t.name} [${t.lifecycle}]`;
    line += ` routing=${t.routing || 'none'}`;
    line += ` summary=${t.summary_present ? 'present' : 'absent'}`;
    line += ` description=${t.description_present ? 'present' : 'absent'}`;
    if (t.triage_parked) line += ` triage=waiting`;
    if (t.waits.length > 0) {
      line += ` awaiting=${t.waits.map((w) => (w.kind === 'research' ? 'research' : w.id)).join(',')}`;
    }
    if (t.summary) line += ` — ${t.summary}`;
    lines.push(line);
  }
  return lines.join('\n') + '\n';
}

// One snapshot for Step 6: reasoning DATA (flags + the ACTIONS table), the
// rendered dashboard + key (DISPLAY), and the menu (MENU).
function view(workUnit, newArrivalsJson) {
  const result = discover(process.cwd(), workUnit);
  const e = result.epics[0];
  if (!e) {
    return engine.gateway.dataBlock({ work_unit: workUnit || '(missing)', error: 'no active epic with this name' })
      + engine.project.selectionNotFound('epic', workUnit || '(missing)');
  }
  const d = e.detail;

  let newArrivals = {};
  if (newArrivalsJson) {
    try { newArrivals = JSON.parse(newArrivalsJson); } catch { /* ignore malformed tracker */ }
  }

  // Held sessions elsewhere mark their topics across the snapshot: the
  // dashboard cue, the menu strike-through, the recommendation skip, and the
  // ACTIONS markers the in-session confirm gate reads. "Elsewhere" is the
  // whole point — a session that steps back to the menu holds a row of its
  // own, and striking it through would have the display arguing with the
  // user about a topic they are sitting in.
  const presence = engine.presence.scanPresence(process.cwd(), e.name).sessions
    .filter((r) => !engine.presence.ownsRow(r));
  const held = presence.filter((r) => r.held);
  // Code takes one slot per checkout, so the code entries read the whole
  // project's held rows, not just this epic's.
  const codeHeld = engine.presence.heldCodeSessions(process.cwd());

  const menu = engine.project.epicMenu(e.name, d, { presence, codeHeld });

  const dataLines = [];
  dataLines.push(`work_unit: ${e.name}`);
  dataLines.push(`sessions_in_progress: ${held.map((r) => `${r.phase}/${r.topic} (last active ${engine.presence.fmtAge(r.age_seconds)} ago)`).join(', ') || '(none)'}`);
  dataLines.push(`convergence: ${d.convergence_state || 'none'}`);
  dataLines.push(`needs_sequencing: ${d.needs_sequencing}`);
  dataLines.push(`build_order_needs_sequencing: ${d.build_order_needs_sequencing}`);
  dataLines.push(`analysis_caches: gap_analysis=${d.analysis_caches.gap_analysis.status}`);
  dataLines.push(`unaccounted_discussions: ${d.unaccounted_discussions.join(', ') || '(none)'}`);
  dataLines.push(`reopened_discussions: ${d.reopened_discussions.join(', ') || '(none)'}`);
  dataLines.push(`spec_blocked: ${d.spec_blocked.map((b) => `${b.name} (${b.by.join(', ')})`).join(', ') || '(none)'}`);
  dataLines.push(...engine.project.actionsTable(['action', 'topic', '→ route'], menu.keys, (k) => {
    const cells = [k.action, k.topic || '—', `→ ${k.route || '(internal)'}`];
    if (k.recommended) cells.push('(recommended)');
    if (k.in_session) {
      const holder = k.session_holder ? `${k.session_holder.work_unit}/${k.session_holder.topic}, ` : '';
      // A code entry reads as the checkout's slot, not this topic's session:
      // its own marker keeps the menu's in-session gate from firing, because
      // the phase's own code gate owns that stop.
      const label = k.code_session ? 'code session' : 'in session';
      cells.push(`(${label}: ${holder}last active ${engine.presence.fmtAge(k.session_age || 0)} ago)`);
    }
    return cells;
  }));

  const display = engine.project.epicDashboard(e.name, d, { newArrivals, presence });
  const key = engine.project.epicKey(d);

  return [
    engine.gateway.dataBlock(dataLines.join('\n')),
    engine.gateway.titleBlock(engine.project.titlecase(workUnit)),
    engine.gateway.displayBlock(key ? display + '\n' + key : display),
    engine.gateway.menuBlock(menu.rendered),
  ].join('\n');
}

// The in-session confirm gate for one held menu entry — fetched by the flow
// at the gate that displays it, recomputed from the same detail and presence
// the snapshot read.
function inSessionGate(workUnit, key) {
  const result = discover(process.cwd(), workUnit);
  const e = result.epics[0];
  if (!e) {
    return engine.gateway.dataBlock({ work_unit: workUnit || '(missing)', error: 'no active epic with this name' });
  }
  const presence = engine.presence.scanPresence(process.cwd(), e.name).sessions
    .filter((r) => !engine.presence.ownsRow(r));
  const codeHeld = engine.presence.heldCodeSessions(process.cwd());
  const entry = engine.project.epicMenuKeys(e.name, e.detail, { presence, codeHeld }).find((k) => k.key === key);
  if (!entry) {
    return engine.gateway.dataBlock({ work_unit: e.name, error: `no menu entry with key "${key}"` });
  }
  if (!entry.in_session) {
    return engine.gateway.dataBlock({ work_unit: e.name, error: `entry "${key}" is not held by another session — no gate to render` });
  }
  if (entry.code_session) {
    return engine.gateway.dataBlock({ work_unit: e.name, error: `entry "${key}" is a code phase — the code slot is gated where the phase starts (render code-gate), never here` });
  }
  return engine.project.epicInSessionGate(e.name, entry);
}

/** @typedef {(name: string, detail: object, opts: {presence: object[]}) => {keys: object[], title: string, display: string, rendered: string}} SubViewProjection */

// One selection sub-view (sections D–G): the keys table as DATA, the view's
// heading as TITLE, the grouped list as DISPLAY, the pick menu as MENU. The
// presence scan rides along as the view's does — a held unit's row carries
// its in-session age, a cue and never a lock.
/** @param {string} workUnit @param {SubViewProjection} projection */
function subView(workUnit, projection) {
  const result = discover(process.cwd(), workUnit);
  const e = result.epics[0];
  if (!e) {
    return engine.gateway.dataBlock({ work_unit: workUnit || '(missing)', error: 'no active epic with this name' })
      + engine.project.selectionNotFound('epic', workUnit || '(missing)');
  }
  const presence = engine.presence.scanPresence(process.cwd(), e.name).sessions
    .filter((r) => !engine.presence.ownsRow(r));
  const view = projection(e.name, e.detail, { presence });

  const dataLines = [
    `work_unit: ${e.name}`,
    ...engine.project.actionsTable(['action', 'topic', 'phase', '→ route'], view.keys, (k) => [
      k.action, k.topic || '—', k.phase || '—', `→ ${k.route || '(internal)'}`, ...(k.dep ? [`(dep: ${k.dep})`] : []), ...(k.item ? [`(item: ${k.item})`] : []),
    ]),
  ];

  return [
    engine.gateway.dataBlock(dataLines.join('\n')),
    engine.gateway.titleBlock(view.title),
    engine.gateway.displayBlock(view.display),
    engine.gateway.menuBlock(view.rendered),
  ].join('\n');
}

// ---------------------------------------------------------------------------
// The specification menu (the `s` row): the scenario the epic's completed
// discussions are in, its snapshot, and the concluded-specs sub-view.
// Discovery, scenario derivation and rendering live in the engine's domain
// ring; these verbs section the output.
// ---------------------------------------------------------------------------

/** @typedef {import('../../workflow-engine/scripts/domain/specification.cjs').DiscoveryResult} SpecDiscovery */
/** @typedef {import('../../workflow-engine/scripts/domain/specification.cjs').SpecificationDetail} SpecDetail */

/** @param {string} cwd @param {string} workUnit @returns {{result: SpecDiscovery, detail: SpecDetail}} */
function specDetail(cwd, workUnit) {
  const result = engine.detail.specificationDiscovery(cwd, workUnit);
  return { result, detail: engine.detail.specificationDetail(workUnit, result) };
}

// The ACTIONS key table over a spec menu's keys.
/** @param {{key: string, word?: string, action: string, topic: string|null}[]} keys */
function specActions(keys) {
  return engine.project.actionsTable(['action', 'topic'], keys, (k) => [k.action, k.topic || '—']);
}

// The DATA body: the scenario and its flags, the single-discussion
// auto-proceed context, the discussion/spec detail the flow reasons from,
// and the ACTIONS key table when a menu exists.
/** @param {SpecDiscovery} result @param {SpecDetail} detail @param {{key: string, word?: string, action: string, topic: string|null}[]} keys */
function specData(result, detail, keys) {
  const cs = result.current_state;
  const lines = [
    `scenario: ${detail.scenario}`,
    `work_unit: ${detail.work_unit}`,
    `counts: discussions=${cs.discussion_count} completed=${cs.completed_count} in_progress=${cs.in_progress_count} specs=${cs.spec_count} proposed=${cs.proposed_count} concluded=${cs.concluded_count}`,
    `cache_status: ${detail.cache_status}`,
    `discussions_checksum: ${cs.discussions_checksum || '(none)'}`,
  ];
  if (detail.single) {
    lines.push(`single_variant: ${detail.single.variant}`);
    lines.push(`single_discussion: ${detail.single.discussion}`);
    lines.push(`proceed_name: ${detail.single.proceed_name}`);
  }
  lines.push('discussions:');
  if (result.discussions.length === 0) lines.push('  (none)');
  for (const d of result.discussions) {
    lines.push(`  ${d.name}: ${d.status}${d.has_individual_spec ? `, individual spec: ${d.spec_status}` : ''}`);
  }
  lines.push('specifications:');
  if (result.specifications.length === 0) lines.push('  (none)');
  const rowsByName = new Map([...detail.actionable, ...detail.concluded].map((row) => [row.name, row]));
  for (const s of result.specifications) {
    const row = rowsByName.get(s.name);
    const blockedBy = row && row.blocked ? `, blocked_by=${row.open_sources.join(',')}` : '';
    lines.push(`  ${s.name}: ${s.status}, has_pending_sources=${s.has_pending_sources}${blockedBy}`);
    for (const src of s.sources || []) {
      lines.push(`    source: ${src.name} (${src.status}, discussion: ${src.discussion_status})`);
    }
  }
  lines.push('cancelled_specifications:');
  if (result.cancelled_specifications.length === 0) lines.push('  (none)');
  for (const s of result.cancelled_specifications) {
    lines.push(`  ${s.name}: sources ${s.sources.join(', ') || '(none)'}`);
  }
  lines.push(`unassigned_discussions: ${detail.unassigned.join(', ') || '(none)'}`);
  lines.push(`in_progress_discussions: ${detail.in_progress_discussions.join(', ') || '(none)'}`);
  if (keys.length > 0) lines.push(...specActions(keys));
  return lines.join('\n');
}

// The routing read: the scenario and the detail the flow reasons from, with
// no menu — a display the scenario routes to fetches its own snapshot where
// it shows it.
/** @param {string} cwd @param {string} workUnit */
function specScenario(cwd, workUnit) {
  const { result, detail } = specDetail(cwd, workUnit);
  return engine.gateway.dataBlock(specData(result, detail, []));
}

// One snapshot: reasoning DATA, the TITLE, and the scenario's DISPLAY; MENU
// when the scenario renders one.
/** @param {string} cwd @param {string} workUnit */
function specView(cwd, workUnit) {
  const { result, detail } = specDetail(cwd, workUnit);
  const menu = engine.project.specificationMenu(detail);
  return [
    engine.gateway.dataBlock(specData(result, detail, menu.keys)),
    engine.gateway.titleBlock(engine.project.SPEC_TITLE),
    engine.gateway.displayBlock(engine.project.specificationDisplay(detail)),
    ...(menu.rendered ? [engine.gateway.menuBlock(menu.rendered)] : []),
  ].join('\n');
}

// The concluded-specs sub-view: keys table as DATA, the view's heading as
// TITLE, the spec list as DISPLAY, the Refine pick menu as MENU.
/** @param {string} cwd @param {string} workUnit */
function specCompletedMenu(cwd, workUnit) {
  const { detail } = specDetail(cwd, workUnit);
  const sub = engine.project.specificationCompletedMenu(detail);
  return [
    engine.gateway.dataBlock([`work_unit: ${detail.work_unit}`, ...specActions(sub.keys)].join('\n')),
    engine.gateway.titleBlock(sub.title),
    engine.gateway.displayBlock(sub.display),
    engine.gateway.menuBlock(sub.rendered),
  ].join('\n');
}

const USAGE = 'Usage: gateway.cjs {work_unit} | gateway.cjs view {work_unit} [new_arrivals_json] | gateway.cjs (completed-menu|cancel-menu|reactivate-menu|postpone-menu|pull-forward-menu|unblock-menu|spec-scenario|spec-view|spec-completed-menu) {work_unit} | gateway.cjs in-session-gate {work_unit} {key}';

/** Reject the call: the reason to stderr, exit 1. @param {string} message @returns {string} */
function reject(message) {
  process.stderr.write(`gateway: ${message}\n`);
  process.exit(1);
  return ''; // unreachable; keeps the handler's return type uniform
}

/** Reject the call with the usage: stderr, exit 1. @param {string} message @returns {string} */
function usageError(message) {
  return reject(`${message}\n${USAGE}`);
}

/** @param {string} verb @param {(cwd: string, workUnit: string) => string} build */
function specHandler(verb, build) {
  return (/** @type {string} */ workUnit, /** @type {string[]} */ ...rest) => {
    if (!workUnit || rest.length > 0) return usageError(`${verb} takes exactly one work unit`);
    try {
      return build(process.cwd(), workUnit);
    } catch (err) {
      return reject(err instanceof Error ? err.message : String(err));
    }
  };
}

/** @param {string} verb @param {SubViewProjection} projection */
function subViewHandler(verb, projection) {
  return (/** @type {string} */ workUnit, /** @type {string[]} */ ...rest) => (!workUnit || rest.length > 0
    ? usageError(`${verb} takes exactly one work unit`)
    : subView(workUnit, projection));
}

if (require.main === module) {
  engine.gateway.runGateway({
    index: () => usageError('a work unit is required'),
    view: (workUnit, newArrivalsJson, ...rest) => (!workUnit || rest.length > 0
      ? usageError('view takes a work unit and an optional new-arrivals JSON')
      : view(workUnit, newArrivalsJson)),
    'completed-menu': subViewHandler('completed-menu', (name, d) => engine.project.epicCompletedMenu(name, d)),
    'cancel-menu': subViewHandler('cancel-menu', (name, d, opts) => engine.project.epicCancelMenu(d, opts)),
    'reactivate-menu': subViewHandler('reactivate-menu', (name, d, opts) => engine.project.epicReactivateMenu(d, opts)),
    'postpone-menu': subViewHandler('postpone-menu', (name, d, opts) => engine.project.epicPostponeMenu(d, opts)),
    'pull-forward-menu': subViewHandler('pull-forward-menu', (name, d) => engine.project.epicPullForwardMenu(d)),
    'unblock-menu': subViewHandler('unblock-menu', (name, d) => engine.project.epicUnblockMenu(d)),
    'spec-scenario': specHandler('spec-scenario', specScenario),
    'spec-view': specHandler('spec-view', specView),
    'spec-completed-menu': specHandler('spec-completed-menu', specCompletedMenu),
    'in-session-gate': (workUnit, key, ...rest) => (!workUnit || !key || rest.length > 0
      ? usageError('in-session-gate takes a work unit and a menu key')
      : inSessionGate(workUnit, key)),
    fallback: (workUnit, ...rest) => (rest.length > 0
      ? usageError(`unknown verb "${workUnit}"`)
      : formatScoped(workUnit, discover(process.cwd(), workUnit))),
  });
}

module.exports = { discover, formatScoped, specScenario };
