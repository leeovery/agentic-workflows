'use strict';

const { loadActiveManifests, loadManifest, phaseItems, phaseData } = require('../../workflow-shared/scripts/discovery-utils');

const EPIC_PHASES = ['research', 'discussion', 'specification', 'planning', 'implementation', 'review'];

/**
 * List mode: return all active epics with summary info.
 */
function discoverList(cwd) {
  const manifests = loadActiveManifests(cwd);
  const epics = [];

  for (const m of manifests) {
    if (m.work_type !== 'epic') continue;

    // Collect phases that have items or status
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
    });
  }

  return {
    mode: 'list',
    epics,
    count: epics.length,
  };
}

/**
 * Detail mode: return full phase-by-phase breakdown for a single epic.
 */
function discoverDetail(cwd, workUnit) {
  const manifest = loadManifest(cwd, workUnit);
  if (!manifest) return { error: 'not_found', work_unit: workUnit };
  if (manifest.work_type !== 'epic') return { error: 'wrong_type', work_unit: workUnit, work_type: manifest.work_type };

  const phases = {};
  const allSourcedDiscussions = new Set();
  const concludedItems = [];
  const inProgressItems = [];
  const nextPhaseReady = [];

  // Build per-phase data
  for (const phase of EPIC_PHASES) {
    const items = phaseItems(manifest, phase);
    if (items.length === 0) continue;

    const phaseItems2 = [];
    for (const item of items) {
      const entry = { name: item.name, status: item.status || 'unknown' };

      // For specification items, include sources
      if (phase === 'specification' && item.sources) {
        entry.sources = item.sources;
        // Track which discussions are sourced
        for (const src of item.sources) {
          allSourcedDiscussions.add(src.topic || src.name);
        }
      }

      phaseItems2.push(entry);

      // Classify items
      if (item.status === 'in-progress') {
        inProgressItems.push({ name: item.name, phase });
      }
      if (item.status === 'concluded' || item.status === 'completed') {
        concludedItems.push({ name: item.name, phase });
      }
    }

    phases[phase] = phaseItems2;
  }

  // Detect unaccounted discussions (concluded but not sourced in any spec)
  const discussionItems = phaseItems(manifest, 'discussion');
  const unaccountedDiscussions = [];
  for (const d of discussionItems) {
    if (d.status === 'concluded' && !allSourcedDiscussions.has(d.name)) {
      unaccountedDiscussions.push(d.name);
    }
  }

  // Detect reopened discussions (in-progress but incorporated in a spec)
  const reopenedDiscussions = [];
  for (const d of discussionItems) {
    if (d.status === 'in-progress' && allSourcedDiscussions.has(d.name)) {
      reopenedDiscussions.push(d.name);
    }
  }

  // Compute next-phase-ready items
  const specItems = phaseItems(manifest, 'specification');
  const planItems = phaseItems(manifest, 'planning');
  const implItems = phaseItems(manifest, 'implementation');

  // Concluded specs with no plan
  const planTopics = new Set(planItems.map(i => i.name));
  for (const s of specItems) {
    if (s.status === 'concluded' && !planTopics.has(s.name)) {
      nextPhaseReady.push({ name: s.name, action: 'start_planning', label: 'spec concluded' });
    }
  }

  // Concluded plans with no implementation
  const implTopics = new Set(implItems.map(i => i.name));
  for (const p of planItems) {
    if (p.status === 'concluded' && !implTopics.has(p.name)) {
      nextPhaseReady.push({ name: p.name, action: 'start_implementation', label: 'plan concluded' });
    }
  }

  // Completed implementations with no review
  const reviewItems = phaseItems(manifest, 'review');
  const reviewTopics = new Set(reviewItems.map(i => i.name));
  for (const i of implItems) {
    if (i.status === 'completed' && !reviewTopics.has(i.name)) {
      nextPhaseReady.push({ name: i.name, action: 'start_review', label: 'implementation completed' });
    }
  }

  // Phase-forward gating checks
  const hasConcludedSpec = specItems.some(s => s.status === 'concluded');
  const hasConcludedPlan = planItems.some(p => p.status === 'concluded');
  const hasConcludedDiscussion = discussionItems.some(d => d.status === 'concluded');
  const hasCompletedImpl = implItems.some(i => i.status === 'completed');

  return {
    mode: 'detail',
    work_unit: workUnit,
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
  if (workUnit) return discoverDetail(cwd, workUnit);
  return discoverList(cwd);
}

function format(result) {
  if (result.error) return `Error: ${result.error} (${result.work_unit})\n`;

  const lines = [];

  if (result.mode === 'list') {
    lines.push(`=== EPICS (${result.count}) ===`);
    for (const e of result.epics) {
      lines.push(`  ${e.name}: ${e.active_phases.join(', ') || '(no phases)'}`);
    }
  } else {
    lines.push(`=== ${result.work_unit} (epic detail) ===`);
    for (const [phase, items] of Object.entries(result.phases)) {
      lines.push(`  ${phase}:`);
      for (const item of items) {
        let line = `    - ${item.name} (${item.status})`;
        if (item.sources) {
          const srcNames = item.sources.map(s => `${s.topic || s.name}:${s.status || '?'}`);
          line += ` [sources: ${srcNames.join(', ')}]`;
        }
        lines.push(line);
      }
    }
    if (result.in_progress.length > 0) {
      lines.push('  in-progress:');
      for (const i of result.in_progress) lines.push(`    - ${i.name} (${i.phase})`);
    }
    if (result.next_phase_ready.length > 0) {
      lines.push('  next-phase-ready:');
      for (const n of result.next_phase_ready) lines.push(`    - ${n.name}: ${n.action} (${n.label})`);
    }
    if (result.unaccounted_discussions.length > 0) {
      lines.push(`  unaccounted_discussions: ${result.unaccounted_discussions.join(', ')}`);
    }
    if (result.reopened_discussions.length > 0) {
      lines.push(`  reopened_discussions: ${result.reopened_discussions.join(', ')}`);
    }
    if (result.concluded.length > 0) {
      lines.push('  concluded:');
      for (const c of result.concluded) lines.push(`    - ${c.name} (${c.phase})`);
    }
  }

  return lines.join('\n') + '\n';
}

if (require.main === module) {
  const workUnit = process.argv[2] || null;
  process.stdout.write(format(discover(process.cwd(), workUnit)));
}

module.exports = { discover };
