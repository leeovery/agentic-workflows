'use strict';

// ---------------------------------------------------------------------------
// Adapter (read gateway) for workflow-continue-epic. Thin by design: detail
// building lives in the engine's domain ring; this script selects which
// engine answers the skill's flow needs and sections the output.
//
//   discovery.cjs               → labelled dump, all active epics (head insert)
//   discovery.cjs {work_unit}   → labelled dump, one epic (scoped re-runs)
//   discovery.cjs view {work_unit} [new_arrivals_json]
//                               → DATA + DISPLAY + MENU snapshot (Step 8)
//   discovery.cjs completed-menu {work_unit}   → Resume Completed sub-view (D)
//   discovery.cjs cancel-menu {work_unit}      → Cancel Topic sub-view (E)
//   discovery.cjs reactivate-menu {work_unit}  → Reactivate Topic sub-view (F)
// ---------------------------------------------------------------------------

const engine = require('../../workflow-engine/scripts/lib.cjs');
const { loadActiveManifests, loadAllManifests, phaseItems } = require('../../workflow-shared/scripts/discovery-utils.cjs');

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

function format(result) {
  const lines = [];
  lines.push(`=== EPICS (${result.count}) ===`);
  lines.push(`summary: ${result.summary}`);

  for (const e of result.epics) {
    lines.push(`  ${e.name}: ${e.active_phases.join(', ') || '(no phases)'}`);
    const d = e.detail;
    for (const [phase, items] of Object.entries(d.phases)) {
      lines.push(`    ${phase}:`);
      for (const item of items) {
        let line = `      - ${item.name} (${item.status})`;
        if (item.sources) {
          const sourcesArr = Array.isArray(item.sources)
            ? item.sources
            : Object.entries(item.sources).map(([topic, data]) => ({ topic, ...data }));
          const srcNames = sourcesArr.map(s => `${s.topic || s.name}:${s.status || '?'}`);
          line += ` [sources: ${srcNames.join(', ')}]`;
        }
        if (item.format) line += ` [format: ${item.format}]`;
        if (item.deps_blocking) {
          line += ` [blocked: ${item.deps_blocking.map(b => b.topic + (b.internal_id ? ':' + b.internal_id : '')).join(', ')}]`;
        }
        if (item.completed_tasks) {
          line += ` [tasks: ${item.completed_tasks.length} completed]`;
        }
        if (item.current_phase) {
          line += ` [phase: ${item.current_phase}]`;
        }
        lines.push(line);
      }
    }
    if (d.seeds_count && d.seeds_count > 0) {
      lines.push(`    seeds_count: ${d.seeds_count}`);
    }
    if (d.imports_count && d.imports_count > 0) {
      lines.push(`    imports_count: ${d.imports_count}`);
    }
    if (d.discovery_map && d.discovery_map.length > 0) {
      const s = d.map_summary;
      lines.push(`    discovery_map (${s.total} topics — ${s.decided} decided, ${s.in_flight} in-flight, ${s.ready} ready, ${s.fresh} fresh, ${s.handled} handled, ${s.cancelled} cancelled, convergence: ${d.convergence_state}, needs_sequencing: ${d.needs_sequencing}):`);
      for (const t of d.discovery_map) {
        let line = `      - ${t.tier} ${t.name} [${t.lifecycle}]`;
        if (t.next_action) line += ` -> ${t.next_action}`;
        line += ` [summary: ${t.summary_present ? 'present' : 'absent'}, description: ${t.description_present ? 'present' : 'absent'}]`;
        if (t.source_provenance) line += ` (${t.source_provenance})`;
        lines.push(line);
        if (t.summary) {
          lines.push(`             summary: ${t.summary}`);
        }
      }
    }
    if (d.in_progress.length > 0) {
      lines.push('    in-progress:');
      for (const i of d.in_progress) lines.push(`      - ${i.name} (${i.phase})`);
    }
    if (d.next_phase_ready.length > 0) {
      lines.push('    next-phase-ready:');
      for (const n of d.next_phase_ready) {
        let line = `      - ${n.name}: ${n.action} (${n.label})`;
        if (n.blocked) line += ` [BLOCKED: ${n.deps_blocking.map(b => b.topic).join(', ')}]`;
        lines.push(line);
      }
    }
    if (d.unaccounted_discussions.length > 0) {
      lines.push(`    unaccounted_discussions: ${d.unaccounted_discussions.join(', ')}`);
    }
    if (d.reopened_discussions.length > 0) {
      lines.push(`    reopened_discussions: ${d.reopened_discussions.join(', ')}`);
    }
    if (d.analysis_caches) {
      lines.push(`    analysis_caches: research_analysis=${d.analysis_caches.research_analysis.status}, gap_analysis=${d.analysis_caches.gap_analysis.status}`);
    }
    if (d.completed.length > 0) {
      lines.push('    completed:');
      for (const c of d.completed) lines.push(`      - ${c.name} (${c.phase})`);
    }
    if (d.cancelled.length > 0) {
      lines.push('    cancelled:');
      for (const c of d.cancelled) lines.push(`      - ${c.name} (${c.phase}, was: ${c.previous_status || 'unknown'})`);
    }
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

if (require.main === module) {
  engine.gateway.runGateway({
    index: () => format(discover(process.cwd())),
    view,
    'completed-menu': (workUnit) => subView(workUnit, (name, d) => engine.project.epicCompletedMenu(name, d)),
    'cancel-menu': (workUnit) => subView(workUnit, (name, d) => engine.project.epicCancelMenu(d)),
    'reactivate-menu': (workUnit) => subView(workUnit, (name, d) => engine.project.epicReactivateMenu(d)),
    fallback: (workUnit) => format(discover(process.cwd(), workUnit)),
  });
}

module.exports = { discover, format };
