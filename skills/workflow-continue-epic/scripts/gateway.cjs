'use strict';

// ---------------------------------------------------------------------------
// Adapter (read gateway) for workflow-continue-epic. Thin by design: detail
// building lives in the engine's domain ring; this script selects which
// engine answers the skill's flow needs and sections the output.
//
//   gateway.cjs               → thin index dump, all active epics (head insert)
//   gateway.cjs {work_unit}   → scoped state dump, one epic (Steps 5–7, bridge)
//   gateway.cjs view {work_unit} [new_arrivals_json]
//                               → DATA + DISPLAY + MENU snapshot (Step 8)
//   gateway.cjs completed-menu {work_unit}   → Resume Completed sub-view (D)
//   gateway.cjs cancel-menu {work_unit}      → Cancel Topic sub-view (E)
//   gateway.cjs reactivate-menu {work_unit}  → Reactivate Topic sub-view (F)
//
// Those calls are the whole legal surface: a verb without its work unit, an
// unknown verb, or excess arguments is a usage error (stderr, exit 1) — never
// a silent first-epic render.
// ---------------------------------------------------------------------------

const engine = require('../../workflow-engine/scripts/lib.cjs');
const { loadActiveManifests, loadAllManifests } = engine.reads;
const { phaseItems } = engine.derivations;

const EPIC_PHASES = engine.detail.EPIC_PHASES;

function lastCompletedPhaseEpic(manifest) {
  let last = null;
  for (const phase of EPIC_PHASES) {
    const items = phaseItems(manifest, phase);
    if (items.length > 0 && items.some(i => i.status === 'completed')) {
      last = phase;
    }
  }
  return last;
}

function discover(cwd, workUnit) {
  const allManifests = loadActiveManifests(cwd);
  const manifests = workUnit
    ? allManifests.filter(m => m.name === workUnit)
    : allManifests;
  const epics = [];

  for (const m of manifests) {
    if (m.work_type !== 'epic') continue;

    const activePhases = [];
    for (const phase of EPIC_PHASES) {
      const items = phaseItems(m, phase);
      if (items.length > 0) {
        activePhases.push(phase);
      }
    }

    epics.push({
      name: m.name,
      active_phases: activePhases,
      detail: engine.detail.epicDetail(cwd, m),
    });
  }

  // Load completed/cancelled epics (only in list mode, not detail mode)
  const completed = [];
  const cancelled = [];
  if (!workUnit) {
    const allManifests = loadAllManifests(cwd);
    for (const m of allManifests) {
      if (m.work_type !== 'epic') continue;
      if (m.status === 'completed') {
        completed.push({ name: m.name, status: m.status, last_phase: lastCompletedPhaseEpic(m) });
      } else if (m.status === 'cancelled') {
        cancelled.push({ name: m.name, status: m.status, last_phase: lastCompletedPhaseEpic(m) });
      }
    }
  }

  return {
    epics,
    count: epics.length,
    completed,
    cancelled,
    completed_count: completed.length,
    cancelled_count: cancelled.length,
    summary: epics.length === 0
      ? 'no active epics'
      : `${epics.length} active epic(s)`,
  };
}

// The thin head-insert dump: active epic names with their active phases, plus
// the closed sets the select and view-completed flows read. Per-epic state is
// the scoped dump's concern; display and routing are the `view` verb's.
function format(result) {
  const lines = [];
  lines.push(`=== EPICS (${result.count}) ===`);
  for (const e of result.epics) {
    lines.push(`  ${e.name}: ${e.active_phases.join(', ') || '(no phases)'}`);
  }
  lines.push(`=== COMPLETED (${result.completed_count}) ===`);
  for (const u of result.completed) {
    lines.push(`  ${u.name} (last phase: ${u.last_phase || 'none'})`);
  }
  lines.push(`=== CANCELLED (${result.cancelled_count}) ===`);
  for (const u of result.cancelled) {
    lines.push(`  ${u.name} (last phase: ${u.last_phase || 'none'})`);
  }
  return lines.join('\n') + '\n';
}

/**
 * The bridge's all-done derivation over one epic detail: review items exist
 * and every non-cancelled one is completed, nothing is in progress or awaiting
 * its next phase, no completed discussion is unaccounted, and the discovery
 * map has settled (or the epic has none).
 * @param {any} d  EpicDetail
 * @returns {boolean}
 */
function computeAllDone(d) {
  const review = (d.phases && d.phases.review) || [];
  const nonCancelled = review.filter((i) => i.status !== 'cancelled');
  return nonCancelled.length > 0
    && nonCancelled.every((i) => i.status === 'completed')
    && d.in_progress.length === 0
    && d.next_phase_ready.length === 0
    && d.unaccounted_discussions.length === 0
    && (d.convergence_state === 'settled' || d.convergence_state === null);
}

// The scoped state dump for one epic — the reasoning surface Steps 5–7 and
// the bridge's epic continuation read: the all-done flag, analysis-cache
// statuses, the sequencing flag, and the discovery-map rows (tier, lifecycle,
// routing, field presence, current summary text).
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
  lines.push(`analysis_caches: research_analysis=${d.analysis_caches.research_analysis.status}, gap_analysis=${d.analysis_caches.gap_analysis.status}`);
  lines.push(`needs_sequencing: ${d.needs_sequencing}`);
  lines.push(`discovery_map (${d.discovery_map.length}):`);
  if (d.discovery_map.length === 0) {
    lines.push('  (empty)');
  }
  for (const t of d.discovery_map) {
    let line = `  - ${t.tier} ${t.name} [${t.lifecycle}]`;
    line += ` routing=${t.routing || 'none'}`;
    line += ` summary=${t.summary_present ? 'present' : 'absent'}`;
    line += ` description=${t.description_present ? 'present' : 'absent'}`;
    if (t.summary) line += ` — ${t.summary}`;
    lines.push(line);
  }
  return lines.join('\n') + '\n';
}

// One snapshot for Step 8: reasoning DATA (flags + the ACTIONS table), the
// rendered dashboard + key (DISPLAY), and the menu (MENU).
function view(workUnit, newArrivalsJson) {
  const result = discover(process.cwd(), workUnit);
  const e = result.epics[0];
  if (!e) {
    return engine.gateway.dataBlock({ work_unit: workUnit || '(missing)', error: 'no active epic with this name' });
  }
  const d = e.detail;

  let newArrivals = {};
  if (newArrivalsJson) {
    try { newArrivals = JSON.parse(newArrivalsJson); } catch { /* ignore malformed tracker */ }
  }

  const menu = engine.project.epicMenu(e.name, d);

  const dataLines = [];
  dataLines.push(`work_unit: ${e.name}`);
  dataLines.push(`convergence: ${d.convergence_state || 'none'}`);
  dataLines.push(`needs_sequencing: ${d.needs_sequencing}`);
  dataLines.push(`analysis_caches: research_analysis=${d.analysis_caches.research_analysis.status}, gap_analysis=${d.analysis_caches.gap_analysis.status}`);
  const phaseNames = Object.keys(d.phases);
  if (phaseNames.length > 0) {
    dataLines.push('phase_counts:');
    for (const phase of phaseNames) {
      const items = d.phases[phase];
      const inProgress = items.filter(i => i.status === 'in-progress').length;
      const proposed = items.filter(i => i.status === 'proposed').length;
      const segments = [`${inProgress} in-progress`];
      if (proposed > 0) segments.push(`${proposed} proposed`);
      dataLines.push(`  ${phase}: ${segments.join(', ')} / ${items.length} total`);
    }
  } else {
    dataLines.push('phase_counts: (none)');
  }
  dataLines.push(`unaccounted_discussions: ${d.unaccounted_discussions.join(', ') || '(none)'}`);
  dataLines.push(`reopened_discussions: ${d.reopened_discussions.join(', ') || '(none)'}`);
  dataLines.push('ACTIONS (key  action  topic  → route):');
  for (const k of menu.keys) {
    let line = `  ${k.key}  ${k.action}  ${k.topic || '—'}  → ${k.route || '(internal)'}`;
    if (k.recommended) line += '  (recommended)';
    if (k.blocked) line += `  (blocked: ${(k.deps_blocking || []).map(b => b.topic + (b.internal_id ? ':' + b.internal_id : '') + ' — ' + b.reason).join('; ')})`;
    dataLines.push(line);
  }

  const display = engine.project.epicDashboard(e.name, d, { newArrivals });
  const key = engine.project.epicKey(d);

  return [
    engine.gateway.dataBlock(dataLines.join('\n')),
    engine.gateway.displayBlock(key ? display + '\n' + key : display),
    engine.gateway.menuBlock(menu.rendered),
  ].join('\n');
}

// One selection sub-view (sections D–F): the keys table as DATA, the grouped
// list as DISPLAY, the pick menu as MENU.
/** @param {string} workUnit @param {(name: string, detail: object) => {keys: object[], display: string, rendered: string}} projection */
function subView(workUnit, projection) {
  const result = discover(process.cwd(), workUnit);
  const e = result.epics[0];
  if (!e) {
    return engine.gateway.dataBlock({ work_unit: workUnit || '(missing)', error: 'no active epic with this name' });
  }
  const view = projection(e.name, e.detail);

  const dataLines = [`work_unit: ${e.name}`];
  dataLines.push('ACTIONS (key  action  topic  phase  → route):');
  for (const k of view.keys) {
    dataLines.push(`  ${k.key}  ${k.action}  ${k.topic || '—'}  ${k.phase || '—'}  → ${k.route || '(internal)'}`);
  }

  return [
    engine.gateway.dataBlock(dataLines.join('\n')),
    engine.gateway.displayBlock(view.display),
    engine.gateway.menuBlock(view.rendered),
  ].join('\n');
}

const USAGE = 'Usage: gateway.cjs | gateway.cjs {work_unit} | gateway.cjs view {work_unit} [new_arrivals_json] | gateway.cjs (completed-menu|cancel-menu|reactivate-menu) {work_unit}';

/** Reject the call: usage to stderr, exit 1. @param {string} message @returns {string} */
function usageError(message) {
  process.stderr.write(`gateway: ${message}\n${USAGE}\n`);
  process.exit(1);
  return ''; // unreachable; keeps the handler's return type uniform
}

/** @param {string} verb @param {(name: string, detail: object) => {keys: object[], display: string, rendered: string}} projection */
function subViewHandler(verb, projection) {
  return (/** @type {string} */ workUnit, /** @type {string[]} */ ...rest) => (!workUnit || rest.length > 0
    ? usageError(`${verb} takes exactly one work unit`)
    : subView(workUnit, projection));
}

if (require.main === module) {
  engine.gateway.runGateway({
    index: (...rest) => (rest.length > 0
      ? usageError('index takes no arguments')
      : format(discover(process.cwd()))),
    view: (workUnit, newArrivalsJson, ...rest) => (!workUnit || rest.length > 0
      ? usageError('view takes a work unit and an optional new-arrivals JSON')
      : view(workUnit, newArrivalsJson)),
    'completed-menu': subViewHandler('completed-menu', (name, d) => engine.project.epicCompletedMenu(name, d)),
    'cancel-menu': subViewHandler('cancel-menu', (name, d) => engine.project.epicCancelMenu(d)),
    'reactivate-menu': subViewHandler('reactivate-menu', (name, d) => engine.project.epicReactivateMenu(d)),
    fallback: (workUnit, ...rest) => (rest.length > 0
      ? usageError(`unknown verb "${workUnit}"`)
      : formatScoped(workUnit, discover(process.cwd(), workUnit))),
  });
}

module.exports = { discover, format, formatScoped };
