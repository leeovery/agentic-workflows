'use strict';

const { loadActiveManifests, phaseItems, phaseData } = require('../../workflow-shared/scripts/discovery-utils');

const EPIC_PHASES = ['research', 'discussion', 'specification', 'planning', 'implementation', 'review'];

function buildEpicDetail(manifest) {
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
      nextPhaseReady.push({ name: p.name, action: 'start_implementation', label: 'plan concluded' });
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

function discover(cwd) {
  const manifests = loadActiveManifests(cwd);
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
      detail: buildEpicDetail(m),
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
        lines.push(line);
      }
    }
    if (d.in_progress.length > 0) {
      lines.push('    in-progress:');
      for (const i of d.in_progress) lines.push(`      - ${i.name} (${i.phase})`);
    }
    if (d.next_phase_ready.length > 0) {
      lines.push('    next-phase-ready:');
      for (const n of d.next_phase_ready) lines.push(`      - ${n.name}: ${n.action} (${n.label})`);
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
  process.stdout.write(format(discover(process.cwd())));
}

module.exports = { discover };
