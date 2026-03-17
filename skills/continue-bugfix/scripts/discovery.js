'use strict';

const { loadActiveManifests, loadAllManifests, phaseStatus, computeNextPhase } = require('../../workflow-shared/scripts/discovery-utils');

const BUGFIX_PIPELINE = ['investigation', 'specification', 'planning', 'implementation', 'review'];

function lastCompletedPhase(manifest) {
  let last = null;
  for (const phase of BUGFIX_PIPELINE) {
    const s = phaseStatus(manifest, phase);
    if (s === 'completed') last = phase;
  }
  return last;
}

function completedPhases(manifest) {
  const completed = [];
  for (const phase of BUGFIX_PIPELINE) {
    const s = phaseStatus(manifest, phase);
    if (s === 'completed') {
      completed.push(phase);
    }
  }
  return completed;
}

function discover(cwd) {
  const manifests = loadActiveManifests(cwd);
  const bugfixes = [];

  for (const m of manifests) {
    if (m.work_type !== 'bugfix') continue;
    const state = computeNextPhase(m);
    if (state.next_phase === 'done') continue;
    bugfixes.push({
      name: m.name,
      next_phase: state.next_phase,
      phase_label: state.phase_label,
      completed_phases: completedPhases(m),
    });
  }

  const allManifests = loadAllManifests(cwd);
  const completed = [];
  const cancelled = [];

  for (const m of allManifests) {
    if (m.work_type !== 'bugfix') continue;
    if (m.status === 'completed') {
      completed.push({ name: m.name, status: m.status, last_phase: lastCompletedPhase(m) });
    } else if (m.status === 'cancelled') {
      cancelled.push({ name: m.name, status: m.status, last_phase: lastCompletedPhase(m) });
    }
  }

  return {
    bugfixes,
    count: bugfixes.length,
    completed,
    cancelled,
    completed_count: completed.length,
    cancelled_count: cancelled.length,
    summary: bugfixes.length === 0
      ? 'no active bugfixes'
      : `${bugfixes.length} active bugfix(es)`,
  };
}

function format(result) {
  const lines = [];
  lines.push(`=== BUGFIXES (${result.count}) ===`);
  lines.push(`summary: ${result.summary}`);
  for (const b of result.bugfixes) {
    lines.push(`  ${b.name}: ${b.phase_label} [completed: ${b.completed_phases.join(', ') || 'none'}]`);
  }
  return lines.join('\n') + '\n';
}

if (require.main === module) {
  process.stdout.write(format(discover(process.cwd())));
}

module.exports = { discover, format };
