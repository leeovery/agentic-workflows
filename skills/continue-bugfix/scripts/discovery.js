'use strict';

const { loadActiveManifests, phaseStatus, computeNextPhase } = require('../../workflow-shared/scripts/discovery-utils');

const BUGFIX_PIPELINE = ['investigation', 'specification', 'planning', 'implementation', 'review'];

function concludedPhases(manifest) {
  const concluded = [];
  for (const phase of BUGFIX_PIPELINE) {
    const s = phaseStatus(manifest, phase);
    if (s === 'concluded' || s === 'completed') {
      concluded.push(phase);
    }
  }
  return concluded;
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
      concluded_phases: concludedPhases(m),
    });
  }

  return {
    bugfixes,
    count: bugfixes.length,
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
    lines.push(`  ${b.name}: ${b.phase_label} [concluded: ${b.concluded_phases.join(', ') || 'none'}]`);
  }
  return lines.join('\n') + '\n';
}

if (require.main === module) {
  process.stdout.write(format(discover(process.cwd())));
}

module.exports = { discover };
