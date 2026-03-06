'use strict';

const { loadActiveManifests, phaseStatus, phaseItems, computeNextPhase } = require('../../workflow-shared/scripts/discovery-utils');

function discover(cwd) {
  const manifests = loadActiveManifests(cwd);
  const epics = [];
  const features = [];
  const bugfixes = [];

  for (const m of manifests) {
    const state = computeNextPhase(m);
    const phases = {};
    const featureKeys = phaseStatus(m, 'research')
      ? ['research', 'discussion', 'specification', 'planning', 'implementation', 'review']
      : ['discussion', 'specification', 'planning', 'implementation', 'review'];
    const keys = m.work_type === 'epic'
      ? ['research', 'discussion', 'specification', 'planning', 'implementation', 'review']
      : m.work_type === 'bugfix'
        ? ['investigation', 'specification', 'planning', 'implementation', 'review']
        : featureKeys;

    for (const k of keys) {
      if (m.work_type === 'epic') {
        // Epic: per-item statuses (all phases including research)
        const items = phaseItems(m, k);
        phases[k] = {
          total: items.length,
          items: items.map(item => ({ name: item.name, status: item.status || 'unknown' })),
        };
      } else {
        phases[k] = phaseStatus(m, k) || 'none';
      }
    }

    const unit = { name: m.name, next_phase: state.next_phase, phase_label: state.phase_label, phases };

    if (m.work_type === 'epic') epics.push(unit);
    else if (m.work_type === 'bugfix') bugfixes.push(unit);
    else features.push(unit);
  }

  return {
    epics: { work_units: epics, count: epics.length },
    features: { work_units: features, count: features.length },
    bugfixes: { work_units: bugfixes, count: bugfixes.length },
    state: {
      has_any_work: manifests.length > 0,
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
      lines.push(`  ${u.name} (${u.next_phase}: ${u.phase_label})`);
      for (const [k, v] of Object.entries(u.phases)) {
        if (typeof v === 'object') {
          if (v.total === 0) {
            lines.push(`    ${k}: (none)`);
          } else {
            lines.push(`    ${k}: ${v.total} items`);
            for (const item of v.items) {
              lines.push(`      - ${item.name} (${item.status})`);
            }
          }
        } else {
          lines.push(`    ${k}: ${v}`);
        }
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
