'use strict';

const { loadActiveManifests, loadManifest, phaseItems, phaseData } = require('../../workflow-shared/scripts/discovery-utils');

const EPIC_PHASES = ['research', 'discussion', 'specification', 'planning', 'implementation', 'review'];

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
    } else if (dep.state === 'resolved' && dep.task_id) {
      const depManifest = loadManifest(cwd, dep.topic);
      const depImpl = depManifest ? phaseData(depManifest, 'implementation') : {};
      const completedTasks = Array.isArray(depImpl.completed_tasks) ? depImpl.completed_tasks : [];
      if (!completedTasks.includes(dep.task_id)) {
        depsSatisfied = false;
        depsBlocking.push({ topic: dep.topic, task_id: dep.task_id, reason: 'task not yet completed' });
      }
    } else if (dep.state === 'resolved' && !dep.task_id) {
      depsSatisfied = false;
      depsBlocking.push({ topic: dep.topic, reason: 'resolved dependency missing task reference' });
    }
  }

  return { deps_satisfied: depsSatisfied, deps_blocking: depsBlocking };
}

function buildEpicDetail(cwd, manifest) {
  const phases = {};
  const allSourcedDiscussions = new Set();
  const concludedItems = [];
  const inProgressItems = [];
  const nextPhaseReady = [];

  for (const phase of EPIC_PHASES) {
    const items = phaseItems(manifest, phase);
    if (items.length === 0) continue;

    const phaseEntries = [];
    for (const item of items) {
      const entry = { name: item.name, status: item.status || 'unknown' };

      if (phase === 'specification' && item.sources) {
        entry.sources = item.sources;
        for (const src of item.sources) {
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
      if (item.status === 'concluded' || item.status === 'completed') {
        concludedItems.push({ name: item.name, phase });
      }
    }

    phases[phase] = phaseEntries;
  }

  const discussionItems = phaseItems(manifest, 'discussion');
  const unaccountedDiscussions = [];
  for (const d of discussionItems) {
    if (d.status === 'concluded' && !allSourcedDiscussions.has(d.name)) {
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

  const planTopics = new Set(planItems.map(i => i.name));
  for (const s of specItems) {
    if (s.status === 'concluded' && !planTopics.has(s.name)) {
      nextPhaseReady.push({ name: s.name, action: 'start_planning', label: 'spec concluded' });
    }
  }

  const implTopics = new Set(implItems.map(i => i.name));
  for (const p of planItems) {
    if (p.status === 'concluded' && !implTopics.has(p.name)) {
      // Check deps before marking as ready for implementation
      const { deps_satisfied, deps_blocking } = resolveDeps(cwd, manifest, p);
      if (deps_satisfied) {
        nextPhaseReady.push({ name: p.name, action: 'start_implementation', label: 'plan concluded' });
      } else {
        nextPhaseReady.push({
          name: p.name, action: 'start_implementation', label: 'plan concluded',
          blocked: true, deps_blocking,
        });
      }
    }
  }

  const reviewItems = phaseItems(manifest, 'review');
  const reviewTopics = new Set(reviewItems.map(i => i.name));
  for (const i of implItems) {
    if (i.status === 'completed' && !reviewTopics.has(i.name)) {
      nextPhaseReady.push({ name: i.name, action: 'start_review', label: 'implementation completed' });
    }
  }

  const hasConcludedSpec = specItems.some(s => s.status === 'concluded');
  const hasConcludedPlan = planItems.some(p => p.status === 'concluded');
  const hasConcludedDiscussion = discussionItems.some(d => d.status === 'concluded');
  const hasCompletedImpl = implItems.some(i => i.status === 'completed');

  return {
    phases,
    in_progress: inProgressItems,
    concluded: concludedItems,
    next_phase_ready: nextPhaseReady,
    unaccounted_discussions: unaccountedDiscussions,
    reopened_discussions: reopenedDiscussions,
    gating: {
      can_start_specification: hasConcludedDiscussion,
      can_start_planning: hasConcludedSpec,
      can_start_implementation: hasConcludedPlan,
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
      const pd = phaseData(m, phase);
      if (items.length > 0 || pd.status) {
        activePhases.push(phase);
      }
    }

    epics.push({
      name: m.name,
      active_phases: activePhases,
      detail: buildEpicDetail(cwd, m),
    });
  }

  return {
    epics,
    count: epics.length,
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
          const srcNames = item.sources.map(s => `${s.topic || s.name}:${s.status || '?'}`);
          line += ` [sources: ${srcNames.join(', ')}]`;
        }
        if (item.format) line += ` [format: ${item.format}]`;
        if (item.deps_blocking) {
          line += ` [blocked: ${item.deps_blocking.map(b => b.topic + (b.task_id ? ':' + b.task_id : '')).join(', ')}]`;
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
    if (d.concluded.length > 0) {
      lines.push('    concluded:');
      for (const c of d.concluded) lines.push(`      - ${c.name} (${c.phase})`);
    }
  }

  return lines.join('\n') + '\n';
}

if (require.main === module) {
  const workUnit = process.argv[2] || undefined;
  process.stdout.write(format(discover(process.cwd(), workUnit)));
}

module.exports = { discover };
