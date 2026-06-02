'use strict';

const { loadActiveManifests, loadAllManifests, phaseStatus, computeNextPhase } = require('../../workflow-shared/scripts/discovery-utils.cjs');

const CC_PIPELINE = ['research', 'discussion', 'specification'];

function lastCompletedPhase(manifest) {
  let last = null;
  for (const phase of CC_PIPELINE) {
    const s = phaseStatus(manifest, phase);
    if (s === 'completed') last = phase;
  }
  return last;
}

function completedPhases(manifest) {
  const completed = [];
  for (const phase of CC_PIPELINE) {
    const s = phaseStatus(manifest, phase);
    if (s === 'completed') {
      completed.push(phase);
    }
  }
  return completed;
}

function discover(cwd) {
  const manifests = loadActiveManifests(cwd);
  const cross_cutting = [];

  for (const m of manifests) {
    if (m.work_type !== 'cross-cutting') continue;
    const state = computeNextPhase(m);
    if (state.next_phase === 'done') continue;
    cross_cutting.push({
      name: m.name,
      next_phase: state.next_phase,
      phase_label: state.phase_label,
      completed_phases: completedPhases(m),
    });
  }

  // Load completed/cancelled cross-cutting concerns
  const allManifests = loadAllManifests(cwd);
  const completed = [];
  const cancelled = [];

  for (const m of allManifests) {
    if (m.work_type !== 'cross-cutting') continue;
    if (m.status === 'completed') {
      completed.push({ name: m.name, status: m.status, last_phase: lastCompletedPhase(m) });
    } else if (m.status === 'cancelled') {
      cancelled.push({ name: m.name, status: m.status, last_phase: lastCompletedPhase(m) });
    }
  }

  return {
    cross_cutting,
    count: cross_cutting.length,
    completed,
    cancelled,
    completed_count: completed.length,
    cancelled_count: cancelled.length,
    summary: cross_cutting.length === 0
      ? 'no active cross-cutting concerns'
      : `${cross_cutting.length} active cross-cutting concern(s)`,
  };
}

function format(result) {
  const lines = [];
  lines.push(`=== CROSS-CUTTING (${result.count}) ===`);
  lines.push(`summary: ${result.summary}`);
  for (const cc of result.cross_cutting) {
    lines.push(`  ${cc.name}: ${cc.phase_label} [completed: ${cc.completed_phases.join(', ') || 'none'}]`);
  }
  return lines.join('\n') + '\n';
}

if (require.main === module) {
  process.stdout.write(format(discover(process.cwd())));
}

module.exports = { discover, format };
