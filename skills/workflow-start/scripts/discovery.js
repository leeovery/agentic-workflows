'use strict';

const { loadActiveManifests, phaseStatus, phaseItems, phaseData, computeNextPhase } = require('../../workflow-shared/scripts/discovery-utils');

const EPIC_PHASES = ['research', 'discussion', 'specification', 'planning', 'implementation', 'review'];

function discover(cwd) {
  const manifests = loadActiveManifests(cwd);
  const epics = [];
  const features = [];
  const bugfixes = [];

  for (const m of manifests) {
    const state = computeNextPhase(m);
    if (state.next_phase === 'done') continue;

    const unit = {
      name: m.name,
      next_phase: state.next_phase,
      phase_label: state.phase_label,
    };

    if (m.work_type === 'epic') {
      // For epics, include list of phases that have items or status
      const activePhases = [];
      for (const phase of EPIC_PHASES) {
        const items = phaseItems(m, phase);
        const pd = phaseData(m, phase);
        if (items.length > 0 || pd.status) {
          activePhases.push(phase);
        }
      }
      unit.active_phases = activePhases;
      epics.push(unit);
    } else if (m.work_type === 'bugfix') {
      bugfixes.push(unit);
    } else {
      features.push(unit);
    }
  }

  return {
    epics: { work_units: epics, count: epics.length },
    features: { work_units: features, count: features.length },
    bugfixes: { work_units: bugfixes, count: bugfixes.length },
    state: {
      has_any_work: (epics.length + features.length + bugfixes.length) > 0,
      epic_count: epics.length,
      feature_count: features.length,
      bugfix_count: bugfixes.length,
    },
  };
}

function format(result) {
  const lines = [];

  function emitSection(label, items) {
    lines.push(`=== ${label.toUpperCase()} ===`);
    if (items.length === 0) {
      lines.push('  (none)');
    }
    for (const u of items) {
      if (u.active_phases) {
        lines.push(`  ${u.name} (${u.active_phases.join(', ')})`);
      } else {
        lines.push(`  ${u.name} (${u.phase_label})`);
      }
    }
    lines.push('');
  }

  emitSection('epics', result.epics.work_units);
  emitSection('features', result.features.work_units);
  emitSection('bugfixes', result.bugfixes.work_units);

  lines.push('=== STATE ===');
  lines.push(`has_any_work: ${result.state.has_any_work}`);
  lines.push(`counts: ${result.state.epic_count} epic, ${result.state.feature_count} feature, ${result.state.bugfix_count} bugfix`);

  return lines.join('\n') + '\n';
}

if (require.main === module) {
  process.stdout.write(format(discover(process.cwd())));
}

module.exports = { discover };
