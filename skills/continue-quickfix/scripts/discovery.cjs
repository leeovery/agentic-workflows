'use strict';

const { loadActiveManifests, loadAllManifests, phaseStatus, computeNextPhase } = require('../../workflow-shared/scripts/discovery-utils.cjs');

const QUICKFIX_PIPELINE = ['scoping', 'implementation', 'review'];

function lastCompletedPhase(manifest) {
  let last = null;
  for (const phase of QUICKFIX_PIPELINE) {
    const s = phaseStatus(manifest, phase);
    if (s === 'completed') last = phase;
  }
  return last;
}

function completedPhases(manifest) {
  const completed = [];
  for (const phase of QUICKFIX_PIPELINE) {
    const s = phaseStatus(manifest, phase);
    if (s === 'completed') {
      completed.push(phase);
    }
  }
  return completed;
}

function discover(cwd) {
  const manifests = loadActiveManifests(cwd);
  const quick_fixes = [];

  for (const m of manifests) {
    if (m.work_type !== 'quick-fix') continue;
    const state = computeNextPhase(m);
    if (state.next_phase === 'done') continue;
    quick_fixes.push({
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
    if (m.work_type !== 'quick-fix') continue;
    if (m.status === 'completed') {
      completed.push({ name: m.name, status: m.status, last_phase: lastCompletedPhase(m) });
    } else if (m.status === 'cancelled') {
      cancelled.push({ name: m.name, status: m.status, last_phase: lastCompletedPhase(m) });
    }
  }

  return {
    quick_fixes,
    count: quick_fixes.length,
    completed,
    cancelled,
    completed_count: completed.length,
    cancelled_count: cancelled.length,
    summary: quick_fixes.length === 0
      ? 'no active quick-fixes'
      : `${quick_fixes.length} active quick-fix(es)`,
  };
}

function format(result) {
  const lines = [];
  lines.push(`=== QUICK-FIXES (${result.count}) ===`);
  lines.push(`summary: ${result.summary}`);
  for (const q of result.quick_fixes) {
    lines.push(`  ${q.name}: ${q.phase_label} [completed: ${q.completed_phases.join(', ') || 'none'}]`);
  }
  return lines.join('\n') + '\n';
}

if (require.main === module) {
  process.stdout.write(format(discover(process.cwd())));
}

module.exports = { discover, format };
