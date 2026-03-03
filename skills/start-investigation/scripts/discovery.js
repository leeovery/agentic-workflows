'use strict';

const { loadActiveManifests, phaseStatus } = require('../../workflow-shared/scripts/discovery-utils');

function discover(cwd) {
  const manifests = loadActiveManifests(cwd);
  const bugfixes = manifests.filter(m => m.work_type === 'bugfix');

  const investigations = [];
  let inProgress = 0;
  let concluded = 0;

  for (const m of bugfixes) {
    const status = phaseStatus(m, 'investigation');
    if (!status) continue;
    investigations.push({ work_unit: m.name, status, work_type: 'bugfix' });
    if (status === 'in-progress') inProgress++;
    else if (status === 'concluded') concluded++;
  }

  return {
    investigations: {
      exists: investigations.length > 0,
      files: investigations,
      counts: { total: investigations.length, in_progress: inProgress, concluded },
    },
    state: {
      scenario: investigations.length > 0 ? 'has_investigations' : 'fresh',
    },
  };
}

function format(result) {
  const lines = ['=== INVESTIGATIONS ==='];
  if (result.investigations.files.length === 0) {
    lines.push('  (none)');
  }
  for (const inv of result.investigations.files) {
    lines.push(`  ${inv.work_unit}: ${inv.status}`);
  }
  lines.push('');
  lines.push('=== STATE ===');
  lines.push(`scenario: ${result.state.scenario}`);
  lines.push(`counts: ${result.investigations.counts.total} total, ${result.investigations.counts.in_progress} in-progress, ${result.investigations.counts.concluded} concluded`);
  return lines.join('\n') + '\n';
}

if (require.main === module) {
  process.stdout.write(format(discover(process.cwd())));
}

module.exports = { discover };
