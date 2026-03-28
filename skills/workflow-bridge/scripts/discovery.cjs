'use strict';

const path = require('path');
const { loadManifest, phaseStatus, fileExists, listFiles, listDirs, computeNextPhase } = require('../../workflow-shared/scripts/discovery-utils.cjs');

const ALL_PHASES = ['research', 'discussion', 'investigation', 'scoping', 'specification', 'planning', 'implementation', 'review'];

function phaseFileExists(cwd, workUnit, phase, manifest) {
  const dir = path.join(cwd, '.workflows', workUnit, phase);
  switch (phase) {
    case 'research':       return listFiles(dir, '.md').length > 0;
    case 'discussion':     return listFiles(dir, '.md').length > 0;
    case 'investigation':  return listFiles(dir, '.md').length > 0;
    case 'scoping':        return phaseStatus(manifest, phase) !== null;
    case 'specification':  return listDirs(dir).some(d => fileExists(path.join(dir, d, 'specification.md')));
    case 'planning':       return phaseStatus(manifest, phase) !== null;
    case 'implementation': return phaseStatus(manifest, phase) !== null;
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
      exists: phaseFileExists(cwd, workUnit, phase, manifest),
      status: phaseStatus(manifest, phase) || 'none',
    };
  }

  const workType = manifest.work_type;
  const next_phase = computeNextPhase(manifest).next_phase;

  return {
    work_unit: workUnit,
    work_type: workType,
    status: manifest.status,
    phases,
    next_phase,
  };
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

  return lines.join('\n') + '\n';
}

if (require.main === module) {
  const workUnit = process.argv[2];
  if (!workUnit) {
    process.stderr.write('Error: work unit name required\nUsage: discovery.cjs <work_unit>\n');
    process.exit(1);
  }
  process.stdout.write(format(discover(process.cwd(), workUnit)));
}

module.exports = { discover, format };
