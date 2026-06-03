'use strict';

const path = require('path');
const { loadActiveManifests, loadAllManifests, loadManifest, phaseItems, phaseData, computeTopicLifecycle, computeNextAction, computeMapSummary, computeSourceProvenance, computeAnalysisCacheStatus, compareMapRows, computeNeedsSequencing } = require('../../workflow-shared/scripts/discovery-utils.cjs');

const EPIC_PHASES = ['discovery', 'research', 'discussion', 'specification', 'planning', 'implementation', 'review'];

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

function resolveDeps(cwd, manifest, planItem) {
  const externalDepsObj = (planItem.external_dependencies && typeof planItem.external_dependencies === 'object' && !Array.isArray(planItem.external_dependencies))
    ? planItem.external_dependencies
    : {};

  const externalDeps = Object.entries(externalDepsObj).map(([depTopic, d]) => ({ topic: depTopic, ...d }));
  let depsSatisfied = true;
  const depsBlocking = [];

  for (const dep of externalDeps) {
    if (dep.state === 'satisfied_externally') continue;
    if (dep.state === 'unresolved') {
      depsSatisfied = false;
      depsBlocking.push({ topic: dep.topic, reason: 'dependency unresolved' });
    } else if (dep.state === 'resolved' && dep.internal_id) {
      const depManifest = loadManifest(cwd, dep.topic);
      const depImpl = depManifest ? phaseData(depManifest, 'implementation') : {};
      const completedTasks = Array.isArray(depImpl.completed_tasks) ? depImpl.completed_tasks : [];
      if (!completedTasks.includes(dep.internal_id)) {
        depsSatisfied = false;
        depsBlocking.push({ topic: dep.topic, internal_id: dep.internal_id, reason: 'task not yet completed' });
      }
    } else if (dep.state === 'resolved' && !dep.internal_id) {
      depsSatisfied = false;
      depsBlocking.push({ topic: dep.topic, reason: 'resolved dependency missing task reference' });
    }
  }

  return { deps_satisfied: depsSatisfied, deps_blocking: depsBlocking };
}

function buildAnalysisCaches(cwd, manifest) {
  const workflowsDir = path.join(cwd, '.workflows');
  return {
    research_analysis: computeAnalysisCacheStatus(manifest, workflowsDir, 'research-analysis'),
    gap_analysis: computeAnalysisCacheStatus(manifest, workflowsDir, 'gap-analysis'),
  };
}

function buildEpicDetail(cwd, manifest) {
  const phases = {};
  const allSourcedDiscussions = new Set();
  const completedItems = [];
  const inProgressItems = [];
  const cancelledItems = [];
  const nextPhaseReady = [];

  for (const phase of EPIC_PHASES) {
    if (phase === 'discovery') continue;
    const items = phaseItems(manifest, phase);
    if (items.length === 0) continue;

    const phaseEntries = [];
    for (const item of items) {
      const entry = { name: item.name, status: item.status || 'unknown' };

      if (phase === 'specification' && item.sources) {
        const sourcesArr = Array.isArray(item.sources)
          ? item.sources
          : Object.entries(item.sources).map(([topic, data]) => ({ topic, ...data }));
        entry.sources = sourcesArr;
        for (const src of sourcesArr) {
          allSourcedDiscussions.add(src.topic || src.name);
        }
      }

      // Enrich planning items with format and dependency data
      if (phase === 'planning') {
        if (item.format) entry.format = item.format;
        const { deps_satisfied, deps_blocking } = resolveDeps(cwd, manifest, item);
        entry.deps_satisfied = deps_satisfied;
        if (deps_blocking.length > 0) entry.deps_blocking = deps_blocking;
      }

      // Enrich implementation items with progress data
      if (phase === 'implementation') {
        if (item.current_phase != null && item.current_phase !== '~') entry.current_phase = item.current_phase;
        if (Array.isArray(item.completed_phases) && item.completed_phases.length > 0) entry.completed_phases = item.completed_phases;
        if (Array.isArray(item.completed_tasks) && item.completed_tasks.length > 0) entry.completed_tasks = item.completed_tasks;
      }

      phaseEntries.push(entry);

      if (item.status === 'in-progress') {
        inProgressItems.push({ name: item.name, phase });
      }
      if (item.status === 'completed') {
        completedItems.push({ name: item.name, phase });
      }
      if (item.status === 'cancelled') {
        cancelledItems.push({ name: item.name, phase, previous_status: item.previous_status || null });
      }
    }

    phases[phase] = phaseEntries;
  }

  const discussionItems = phaseItems(manifest, 'discussion');
  const unaccountedDiscussions = [];
  for (const d of discussionItems) {
    if (d.status === 'completed' && !allSourcedDiscussions.has(d.name)) {
      unaccountedDiscussions.push(d.name);
    }
  }

  const reopenedDiscussions = [];
  for (const d of discussionItems) {
    if (d.status === 'in-progress' && allSourcedDiscussions.has(d.name)) {
      reopenedDiscussions.push(d.name);
    }
  }

  const specItems = phaseItems(manifest, 'specification');
  const planItems = phaseItems(manifest, 'planning');
  const implItems = phaseItems(manifest, 'implementation');

  const planTopics = new Set(planItems.filter(i => i.status !== 'cancelled').map(i => i.name));
  for (const s of specItems) {
    if (s.status === 'completed' && !planTopics.has(s.name)) {
      nextPhaseReady.push({ name: s.name, action: 'start_planning', label: 'spec completed' });
    }
  }

  const implTopics = new Set(implItems.filter(i => i.status !== 'cancelled').map(i => i.name));
  for (const p of planItems) {
    if (p.status === 'completed' && !implTopics.has(p.name)) {
      // Check deps before marking as ready for implementation
      const { deps_satisfied, deps_blocking } = resolveDeps(cwd, manifest, p);
      if (deps_satisfied) {
        nextPhaseReady.push({ name: p.name, action: 'start_implementation', label: 'plan completed' });
      } else {
        nextPhaseReady.push({
          name: p.name, action: 'start_implementation', label: 'plan completed',
          blocked: true, deps_blocking,
        });
      }
    }
  }

  const reviewItems = phaseItems(manifest, 'review');
  const reviewTopics = new Set(reviewItems.filter(i => i.status !== 'cancelled').map(i => i.name));
  for (const i of implItems) {
    if (i.status === 'completed' && !reviewTopics.has(i.name)) {
      nextPhaseReady.push({ name: i.name, action: 'start_review', label: 'implementation completed' });
    }
  }

  const hasCompletedSpec = specItems.some(s => s.status === 'completed');
  const hasCompletedPlan = planItems.some(p => p.status === 'completed');
  const hasCompletedDiscussion = discussionItems.some(d => d.status === 'completed');
  const hasCompletedImpl = implItems.some(i => i.status === 'completed');

  const discoveryItems = phaseItems(manifest, 'discovery');
  let discoveryMap = [];
  let convergenceState = null;
  let mapSummary = null;
  if (discoveryItems.length > 0) {
    discoveryMap = discoveryItems.map(item => {
      const { lifecycle, tier, current_phase } = computeTopicLifecycle(manifest, item.name);
      const next_action = computeNextAction(item.routing, lifecycle);
      const source_provenance = computeSourceProvenance(item.source);
      const summaryText = typeof item.summary === 'string' && item.summary.trim() ? item.summary : null;
      const descriptionText = typeof item.description === 'string' && item.description.trim() ? item.description : null;
      return {
        name: item.name,
        summary_present: summaryText !== null,
        summary: summaryText,
        description_present: descriptionText !== null,
        routing: item.routing || null,
        source: item.source || 'discovery',
        source_provenance,
        order: item.order ?? null,
        lifecycle,
        tier,
        current_phase,
        next_action,
      };
    });
    discoveryMap.sort(compareMapRows);
    mapSummary = computeMapSummary(discoveryMap);
    const allSettled = discoveryMap.every(t => t.lifecycle === 'decided' || t.lifecycle === 'cancelled');
    convergenceState = allSettled ? 'settled' : 'in-progress';
  }

  const importsCount = Array.isArray(manifest.imports) ? manifest.imports.length : 0;
  const seedsCount = Array.isArray(manifest.seeds) ? manifest.seeds.length : 0;

  return {
    phases,
    in_progress: inProgressItems,
    completed: completedItems,
    cancelled: cancelledItems,
    next_phase_ready: nextPhaseReady,
    unaccounted_discussions: unaccountedDiscussions,
    reopened_discussions: reopenedDiscussions,
    discovery_map: discoveryMap,
    convergence_state: convergenceState,
    needs_sequencing: computeNeedsSequencing(discoveryMap),
    map_summary: mapSummary,
    imports_count: importsCount,
    seeds_count: seedsCount,
    analysis_caches: buildAnalysisCaches(cwd, manifest),
    gating: {
      can_start_specification: hasCompletedDiscussion,
      can_start_planning: hasCompletedSpec,
      can_start_implementation: hasCompletedPlan,
      can_start_review: hasCompletedImpl,
    },
  };
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
      detail: buildEpicDetail(cwd, m),
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
      lines.push(`    discovery_map (${s.total} topics — ${s.decided} decided, ${s.in_flight} in-flight, ${s.ready} ready, ${s.fresh} fresh, ${s.cancelled} cancelled, convergence: ${d.convergence_state}, needs_sequencing: ${d.needs_sequencing}):`);
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

if (require.main === module) {
  const workUnit = process.argv[2] || undefined;
  process.stdout.write(format(discover(process.cwd(), workUnit)));
}

module.exports = { discover, format };
