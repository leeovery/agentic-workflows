'use strict';

const path = require('path');
const { loadManifest, phaseStatus, phaseItems, phaseData, fileExists, listFiles, listDirs, computeNextPhase } = require('../../workflow-shared/scripts/discovery-utils');

const ALL_PHASES = ['research', 'discussion', 'investigation', 'specification', 'planning', 'implementation', 'review'];

function phaseFileExists(cwd, workUnit, phase) {
  const dir = path.join(cwd, '.workflows', workUnit, phase);
  switch (phase) {
    case 'research':       return listFiles(dir, '.md').length > 0;
    case 'discussion':     return listFiles(dir, '.md').length > 0;
    case 'investigation':  return listFiles(dir, '.md').length > 0;
    case 'specification':  return listDirs(dir).some(d => fileExists(path.join(dir, d, 'specification.md')));
    case 'planning':       return listDirs(dir).some(d => fileExists(path.join(dir, d, 'planning.md')));
    case 'implementation': return listDirs(dir).some(d => fileExists(path.join(dir, d, 'implementation.md')));
    case 'review':         return listDirs(dir).some(d =>
      listDirs(path.join(dir, d)).some(r => r.startsWith('r') && fileExists(path.join(dir, d, r, 'review.md'))));
    default: return false;
  }
}

function discover(cwd, workUnit) {
  const manifest = loadManifest(cwd, workUnit);
  if (!manifest) return { error: `Could not read manifest for "${workUnit}"` };

  const phases = {};
  for (const phase of ALL_PHASES) {
    phases[phase] = {
      exists: phaseFileExists(cwd, workUnit, phase),
      status: phaseStatus(manifest, phase) || 'none',
    };
  }

  const workType = manifest.work_type;
  let next_phase;
  if (workType === 'epic') {
    next_phase = 'interactive';
  } else {
    next_phase = computeNextPhase(manifest).next_phase;
  }

  const result = {
    work_unit: workUnit,
    work_type: workType,
    status: manifest.status,
    phases,
    next_phase,
  };

  if (workType === 'epic') {
    const epicDetail = {};
    for (const phase of ['research', 'discussion', 'specification', 'planning', 'implementation', 'review']) {
      const pd = phaseData(manifest, phase);
      if (!pd) continue;
      const items = phaseItems(manifest, phase);
      epicDetail[phase] = {
        status: pd.status || 'none',
        items: items.map(i => ({ name: i.name, status: i.status || 'unknown' })),
      };
    }
    result.epic_detail = epicDetail;
  }

  return result;
}

function format(result) {
  if (result.error) return `Error: ${result.error}\n`;

  const lines = [];
  lines.push(`=== ${result.work_unit} (${result.work_type}, ${result.status}) ===`);
  lines.push(`next_phase: ${result.next_phase}`);
  lines.push('');

  for (const [phase, data] of Object.entries(result.phases)) {
    lines.push(`  ${phase}: ${data.status}${data.exists ? '' : ' (no files)'}`);
  }

  if (result.epic_detail) {
    lines.push('');
    lines.push('=== EPIC DETAIL ===');
    for (const [phase, data] of Object.entries(result.epic_detail)) {
      lines.push(`  ${phase}: ${data.status}`);
      for (const item of data.items) {
        lines.push(`    - ${item.name}: ${item.status}`);
      }
    }
  }

  return lines.join('\n') + '\n';
}

if (require.main === module) {
  const workUnit = process.argv[2];
  if (!workUnit) {
    process.stderr.write('Error: work unit name required\nUsage: discovery.js <work_unit>\n');
    process.exit(1);
  }
  process.stdout.write(format(discover(process.cwd(), workUnit)));
}

module.exports = { discover };
