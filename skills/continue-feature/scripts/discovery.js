'use strict';

const { loadActiveManifests, phaseStatus, computeNextPhase } = require('../../workflow-shared/scripts/discovery-utils');

const FEATURE_PIPELINE = ['research', 'discussion', 'specification', 'planning', 'implementation', 'review'];

function concludedPhases(manifest) {
  const concluded = [];
  for (const phase of FEATURE_PIPELINE) {
    const s = phaseStatus(manifest, phase);
    if (s === 'concluded' || s === 'completed') {
      concluded.push(phase);
    }
  }
  return concluded;
}

function discover(cwd, workUnit) {
  // Single work unit mode — validate and return phase info
  if (workUnit) {
    const { loadManifest } = require('../../workflow-shared/scripts/discovery-utils');
    const manifest = loadManifest(cwd, workUnit);
    if (!manifest) return { error: `not_found`, work_unit: workUnit };
    if (manifest.work_type !== 'feature') return { error: `wrong_type`, work_unit: workUnit, work_type: manifest.work_type };

    const state = computeNextPhase(manifest);
    if (state.next_phase === 'done') return { error: 'done', work_unit: workUnit };

    return {
      mode: 'single',
      feature: {
        name: workUnit,
        next_phase: state.next_phase,
        phase_label: state.phase_label,
        concluded_phases: concludedPhases(manifest),
      },
    };
  }

  // List mode — find all active features
  const manifests = loadActiveManifests(cwd);
  const features = [];

  for (const m of manifests) {
    if (m.work_type !== 'feature') continue;
    const state = computeNextPhase(m);
    if (state.next_phase === 'done') continue;
    features.push({
      name: m.name,
      next_phase: state.next_phase,
      phase_label: state.phase_label,
      concluded_phases: concludedPhases(m),
    });
  }

  return {
    mode: 'list',
    features,
    count: features.length,
  };
}

function format(result) {
  if (result.error) return `Error: ${result.error} (${result.work_unit})\n`;

  const lines = [];

  if (result.mode === 'single') {
    const f = result.feature;
    lines.push(`=== FEATURE: ${f.name} ===`);
    lines.push(`next_phase: ${f.next_phase}`);
    lines.push(`phase_label: ${f.phase_label}`);
    lines.push(`concluded_phases: ${f.concluded_phases.join(', ') || '(none)'}`);
  } else {
    lines.push(`=== FEATURES (${result.count}) ===`);
    for (const f of result.features) {
      lines.push(`  ${f.name}: ${f.phase_label} [concluded: ${f.concluded_phases.join(', ') || 'none'}]`);
    }
  }

  return lines.join('\n') + '\n';
}

if (require.main === module) {
  const workUnit = process.argv[2] || null;
  process.stdout.write(format(discover(process.cwd(), workUnit)));
}

module.exports = { discover };
