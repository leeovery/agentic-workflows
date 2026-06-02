'use strict';

const { loadActiveManifests, loadAllManifests, phaseStatus, computeNextPhase } = require('../../workflow-shared/scripts/discovery-utils.cjs');

const FEATURE_PIPELINE = ['research', 'discussion', 'specification', 'planning', 'implementation', 'review'];

function lastCompletedPhase(manifest) {
  let last = null;
  for (const phase of FEATURE_PIPELINE) {
    const s = phaseStatus(manifest, phase);
    if (s === 'completed') last = phase;
  }
  return last;
}

function completedPhases(manifest) {
  const completed = [];
  for (const phase of FEATURE_PIPELINE) {
    const s = phaseStatus(manifest, phase);
    if (s === 'completed') {
      completed.push(phase);
    }
  }
  return completed;
}

function discover(cwd) {
  const manifests = loadActiveManifests(cwd);
  const features = [];

  for (const m of manifests) {
    if (m.work_type !== 'feature') continue;
    const state = computeNextPhase(m);
    if (state.next_phase === 'done') continue;
    const importsCount = Array.isArray(m.imports) ? m.imports.length : 0;
    const seedsCount = Array.isArray(m.seeds) ? m.seeds.length : 0;
    features.push({
      name: m.name,
      next_phase: state.next_phase,
      phase_label: state.phase_label,
      completed_phases: completedPhases(m),
      imports_count: importsCount,
      seeds_count: seedsCount,
    });
  }

  // Load completed/cancelled features
  const allManifests = loadAllManifests(cwd);
  const completed = [];
  const cancelled = [];

  for (const m of allManifests) {
    if (m.work_type !== 'feature') continue;
    if (m.status === 'completed') {
      completed.push({ name: m.name, status: m.status, last_phase: lastCompletedPhase(m) });
    } else if (m.status === 'cancelled') {
      cancelled.push({ name: m.name, status: m.status, last_phase: lastCompletedPhase(m) });
    }
  }

  return {
    features,
    count: features.length,
    completed,
    cancelled,
    completed_count: completed.length,
    cancelled_count: cancelled.length,
    summary: features.length === 0
      ? 'no active features'
      : `${features.length} active feature(s)`,
  };
}

function format(result) {
  const lines = [];
  lines.push(`=== FEATURES (${result.count}) ===`);
  lines.push(`summary: ${result.summary}`);
  for (const f of result.features) {
    const seedsClause = f.seeds_count > 0 ? ` (${f.seeds_count} seed${f.seeds_count > 1 ? 's' : ''})` : '';
    const importsClause = f.imports_count > 0 ? ` (${f.imports_count} imports)` : '';
    lines.push(`  ${f.name}: ${f.phase_label}${seedsClause}${importsClause} [completed: ${f.completed_phases.join(', ') || 'none'}]`);
  }
  return lines.join('\n') + '\n';
}

if (require.main === module) {
  process.stdout.write(format(discover(process.cwd())));
}

module.exports = { discover, format };
