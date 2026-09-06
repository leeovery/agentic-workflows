'use strict';

const path = require('path');
const engine = require('../../workflow-engine/scripts/lib.cjs');
const { TERMINAL_STATUSES } = require('../../workflow-engine/scripts/kernel/manifest-schema.cjs');
const { loadManifest, fileExists, listFiles, listDirs } = engine.reads;
const { phaseStatus, phaseItems, computeNextPhase } = engine.derivations;

const ALL_PHASES = engine.schema.VALID_PHASES.filter((p) => p !== 'discovery');

function phaseFileExists(cwd, workUnit, phase, manifest) {
  const dir = path.join(cwd, '.workflows', workUnit, phase);
  switch (phase) {
    case 'research':       return listFiles(dir, '.md').length > 0;
    case 'experiment':     return listDirs(dir).length > 0;
    case 'discussion':     return listFiles(dir, '.md').length > 0;
    case 'investigation':  return listFiles(dir, '.md').length > 0;
    case 'scoping':        return phaseStatus(manifest, phase) !== null;
    case 'specification':  return listDirs(dir).some(d => fileExists(path.join(dir, d, 'specification.md')));
    case 'planning':       return phaseStatus(manifest, phase) !== null;
    case 'implementation': return phaseStatus(manifest, phase) !== null;
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

  // Live items carrying a reconcile flag — observability for the
  // continuation prose (routing itself rides next_phase).
  const reconcile_pending = [];
  for (const phase of ALL_PHASES) {
    for (const item of phaseItems(manifest, phase)) {
      if (!TERMINAL_STATUSES.includes(item.status) && item.reconcile_needed !== undefined) {
        reconcile_pending.push(`${phase}/${item.name} (${item.reconcile_needed})`);
      }
    }
  }

  return {
    work_unit: workUnit,
    work_type: workType,
    status: manifest.status,
    phases,
    next_phase,
    reconcile_pending,
  };
}

// The thin scoped dump: the fields the continuation references branch on —
// the derived next phase, the completed set (in pipeline order), and the
// revisit candidates (completed phases before next_phase, filtered to the
// type's pipeline). When candidates exist, the labelled revisit-phase menu
// follows the dump — emitted only at the gate its marker names.
function format(result) {
  if (result.error) return `Error: ${result.error}\n`;

  const completed = Object.entries(result.phases)
    .filter(([, data]) => data.status === 'completed')
    .map(([phase]) => phase);

  const lines = [];
  lines.push(`=== ${result.work_unit} (${result.work_type}) ===`);
  lines.push(`next_phase: ${result.next_phase}`);
  lines.push(`completed_phases: ${completed.join(', ') || '(none)'}`);
  lines.push(`reconcile_pending: ${(result.reconcile_pending || []).join(', ') || '(none)'}`);

  if (engine.detail.WORK_UNIT_TYPES[result.work_type]) {
    const revisitable = result.next_phase === 'done'
      ? []
      : engine.project.revisitablePhases(result.work_type, { next_phase: result.next_phase, completed_phases: completed });
    lines.push(`revisitable_phases: ${revisitable.join(', ') || '(none)'}`);
  }

  return lines.join('\n') + '\n';
}

if (require.main === module) {
  const workUnit = process.argv[2];
  if (!workUnit) {
    process.stderr.write('Error: work unit name required\nUsage: gateway.cjs <work_unit>\n');
    process.exit(1);
  }
  process.stdout.write(format(discover(process.cwd(), workUnit)));
}

module.exports = { discover, format };
