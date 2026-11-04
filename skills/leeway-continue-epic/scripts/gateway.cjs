'use strict';

// ---------------------------------------------------------------------------
// Adapter (read gateway) for leeway-continue-epic. Thin by design: detail
// building lives in the engine's domain ring; this script selects which
// engine answers the skill's flow needs and sections the output.
//
//   gateway.cjs {work_unit}   → scoped state dump, one epic (Steps 1–6)
//   gateway.cjs view {work_unit} [new_arrivals_json]
//                               → DATA + DISPLAY + MENU snapshot (Step 6)
//   gateway.cjs completed-menu {work_unit}     → Resume Completed sub-view (D)
//   gateway.cjs cancel-menu {work_unit}        → Cancel Topic sub-view (E)
//   gateway.cjs reactivate-menu {work_unit}    → Reactivate Topic sub-view (F)
//   gateway.cjs postpone-menu {work_unit}      → Postpone Topic sub-view (G)
//   gateway.cjs pull-forward-menu {work_unit}  → Pull Forward Topic sub-view (H)
//   gateway.cjs in-session-gate {work_unit} {key} → the in-session confirm over one held entry
//
// Those calls are the whole legal surface: the bare call, a verb without its
// work unit, an unknown verb, or excess arguments is a usage error (stderr,
// exit 1) — never a silent first-epic render.
// ---------------------------------------------------------------------------

const engine = require('../../leeway-engine/scripts/lib.cjs');
const { TERMINAL_STATUSES } = require('../../leeway-engine/scripts/kernel/manifest-schema.cjs');
const { loadActiveManifests } = engine.reads;

// The gate each of the epic's menus states, named for what it asks: a key of
// the trust log forever (16.11.9), so never another menu's.
const GATES = Object.freeze({
  epic: 'epic menu',
  resume: 'resume pick',
  cancel: 'cancel pick',
  reactivate: 'reactivate pick',
  postpone: 'postpone pick',
  pullForward: 'pull forward pick',
});

/** @typedef {import('../../leeway-engine/scripts/domain/epic-detail.cjs').EpicDetail} EpicDetail */

/**
 * The detail of the active epic `workUnit` names, or null where none does.
 * @param {string} cwd @param {string} workUnit
 * @returns {EpicDetail|null}
 */
function discover(cwd, workUnit) {
  const manifest = loadActiveManifests(cwd).find((m) => m.work_type === 'epic' && m.name === workUnit);
  return manifest ? engine.detail.epicDetail(cwd, manifest) : null;
}

/** A parked stub is undrained work — never done. @param {any} d @returns {boolean} */
function unstartedStubs(d) {
  return ((d.phases && d.phases.discussion) || []).some((i) => i.status === 'unstarted');
}

/**
 * The all-done derivation over one epic detail: review items exist
 * and every non-terminal one is completed, nothing is in progress or awaiting
 * its next phase, no item carries a live reconcile flag (the epic mirror of the linear types' routing override
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
    && !unstartedStubs(d)
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
// the discovery-map rows (tier, lifecycle, the name a renamed topic goes by
// beside its key, field presence, current summary text).
/** @param {string} workUnit @param {EpicDetail|null} d */
function formatScoped(workUnit, d) {
  const lines = [];
  lines.push(`=== EPIC: ${workUnit} ===`);
  if (!d) {
    lines.push('error: no active epic with this name');
    return lines.join('\n') + '\n';
  }
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
    if (t.goes_by !== t.name) line += ` goes_by=${t.goes_by}`;
    line += ` summary=${t.summary_present ? 'present' : 'absent'}`;
    line += ` description=${t.description_present ? 'present' : 'absent'}`;
    if (t.mail_waiting) line += ` mail=waiting`;
    if (t.waits.length > 0) {
      line += ` awaiting=${t.waits.map((w) => w.id).join(',')}`;
    }
    if (t.summary) line += ` — ${t.summary}`;
    lines.push(line);
  }
  return lines.join('\n') + '\n';
}

// One snapshot for Step 6: reasoning DATA (flags + the ACTIONS table), the
// rendered dashboard + key (DISPLAY), and the menu (MENU).
function view(workUnit, newArrivalsJson) {
  const d = discover(process.cwd(), workUnit);
  if (!d) {
    return engine.gateway.dataBlock({ work_unit: workUnit, error: 'no active epic with this name' })
      + engine.project.selectionNotFound('epic', workUnit);
  }

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
  const presence = engine.presence.scanPresence(process.cwd(), workUnit).sessions
    .filter((r) => !engine.presence.ownsRow(r));
  const held = presence.filter((r) => r.held);
  // Code takes one slot per checkout, so the code entries read the whole
  // project's held rows, not just this epic's.
  const codeHeld = engine.presence.heldCodeSessions(process.cwd());

  const menu = engine.project.epicMenu(workUnit, d, { presence, codeHeld });

  const dataLines = [];
  dataLines.push(`work_unit: ${workUnit}`);
  dataLines.push(`sessions_in_progress: ${held.map((r) => `${r.phase}/${r.topic} (last active ${engine.presence.fmtAge(r.age_seconds)} ago)`).join(', ') || '(none)'}`);
  dataLines.push(`convergence: ${d.convergence_state || 'none'}`);
  dataLines.push(`needs_sequencing: ${d.needs_sequencing}`);
  dataLines.push(`build_order_needs_sequencing: ${d.build_order_needs_sequencing}`);
  dataLines.push(`analysis_caches: gap_analysis=${d.analysis_caches.gap_analysis.status}`);
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

  const display = engine.project.epicDashboard(workUnit, d, { newArrivals, presence });
  const key = engine.project.epicKey(d);

  return [
    engine.gateway.dataBlock(dataLines.join('\n')),
    engine.gateway.titleBlock(engine.project.titlecase(workUnit)),
    engine.gateway.displayBlock(key ? display + '\n' + key : display),
    engine.gateway.menuBlock(GATES.epic, menu.rendered),
  ].join('\n');
}

// The in-session confirm gate for one held menu entry — fetched by the flow
// at the gate that displays it, recomputed from the same detail and presence
// the snapshot read.
function inSessionGate(workUnit, key) {
  const d = discover(process.cwd(), workUnit);
  if (!d) {
    return engine.gateway.dataBlock({ work_unit: workUnit, error: 'no active epic with this name' });
  }
  const presence = engine.presence.scanPresence(process.cwd(), workUnit).sessions
    .filter((r) => !engine.presence.ownsRow(r));
  const codeHeld = engine.presence.heldCodeSessions(process.cwd());
  const entry = engine.project.epicMenuKeys(workUnit, d, { presence, codeHeld }).find((k) => k.key === key);
  if (!entry) {
    return engine.gateway.dataBlock({ work_unit: workUnit, error: `no menu entry with key "${key}"` });
  }
  if (!entry.in_session) {
    return engine.gateway.dataBlock({ work_unit: workUnit, error: `entry "${key}" is not held by another session — no gate to render` });
  }
  if (entry.code_session) {
    return engine.gateway.dataBlock({ work_unit: workUnit, error: `entry "${key}" is a code phase — the code slot is gated where the phase starts (render code-gate), never here` });
  }
  return engine.project.epicInSessionGate(workUnit, entry, d.titles);
}

/** @typedef {(name: string, detail: object, opts: {presence: object[]}) => {keys: object[], title: string, display: string, rendered: string}} SubViewProjection */

// One selection sub-view (sections D–H): the keys table as DATA, the view's
// heading as TITLE, the grouped list as DISPLAY, the pick menu as MENU,
// stating the gate `gate`. The presence scan rides along as the view's does —
// a held unit's row carries its in-session age, a cue and never a lock.
/** @param {string} workUnit @param {string} gate @param {SubViewProjection} projection */
function subView(workUnit, gate, projection) {
  const d = discover(process.cwd(), workUnit);
  if (!d) {
    return engine.gateway.dataBlock({ work_unit: workUnit, error: 'no active epic with this name' })
      + engine.project.selectionNotFound('epic', workUnit);
  }
  const presence = engine.presence.scanPresence(process.cwd(), workUnit).sessions
    .filter((r) => !engine.presence.ownsRow(r));
  const view = projection(workUnit, d, { presence });

  const dataLines = [
    `work_unit: ${workUnit}`,
    ...engine.project.actionsTable(['action', 'topic', 'phase', '→ route'], view.keys, (k) => [
      k.action, k.topic || '—', k.phase || '—', `→ ${k.route || '(internal)'}`, ...(k.dep ? [`(dep: ${k.dep})`] : []), ...(k.item ? [`(item: ${k.item})`] : []),
    ]),
  ];

  return [
    engine.gateway.dataBlock(dataLines.join('\n')),
    engine.gateway.titleBlock(view.title),
    engine.gateway.displayBlock(view.display),
    engine.gateway.menuBlock(gate, view.rendered),
  ].join('\n');
}

const USAGE = 'Usage: gateway.cjs {work_unit} | gateway.cjs view {work_unit} [new_arrivals_json] | gateway.cjs (completed-menu|cancel-menu|reactivate-menu|postpone-menu|pull-forward-menu) {work_unit} | gateway.cjs in-session-gate {work_unit} {key}';

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

/** @param {string} verb @param {string} gate @param {SubViewProjection} projection */
function subViewHandler(verb, gate, projection) {
  return (/** @type {string} */ workUnit, /** @type {string[]} */ ...rest) => (!workUnit || rest.length > 0
    ? usageError(`${verb} takes exactly one work unit`)
    : subView(workUnit, gate, projection));
}

if (require.main === module) {
  engine.gateway.runGateway({
    index: () => usageError('a work unit is required'),
    view: (workUnit, newArrivalsJson, ...rest) => (!workUnit || rest.length > 0
      ? usageError('view takes a work unit and an optional new-arrivals JSON')
      : view(workUnit, newArrivalsJson)),
    'completed-menu': subViewHandler('completed-menu', GATES.resume, (name, d) => engine.project.epicCompletedMenu(name, d)),
    'cancel-menu': subViewHandler('cancel-menu', GATES.cancel, (name, d, opts) => engine.project.epicCancelMenu(d, opts)),
    'reactivate-menu': subViewHandler('reactivate-menu', GATES.reactivate, (name, d, opts) => engine.project.epicReactivateMenu(d, opts)),
    'postpone-menu': subViewHandler('postpone-menu', GATES.postpone, (name, d, opts) => engine.project.epicPostponeMenu(d, opts)),
    'pull-forward-menu': subViewHandler('pull-forward-menu', GATES.pullForward, (name, d) => engine.project.epicPullForwardMenu(d)),
    'in-session-gate': (workUnit, key, ...rest) => (!workUnit || !key || rest.length > 0
      ? usageError('in-session-gate takes a work unit and a menu key')
      : inSessionGate(workUnit, key)),
    fallback: (workUnit, ...rest) => (rest.length > 0
      ? usageError(`unknown verb "${workUnit}"`)
      : formatScoped(workUnit, discover(process.cwd(), workUnit))),
  });
}

module.exports = { discover, formatScoped, GATES };
