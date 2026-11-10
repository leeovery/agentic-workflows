'use strict';

const engine = require('../../leeway-engine/scripts/lib.cjs');
const { loadManifest } = engine.reads;
const { computeNextPhase } = engine.derivations;

function discover(cwd, workUnit) {
  const manifest = loadManifest(cwd, workUnit);
  if (!manifest) return { error: `Could not read manifest for "${workUnit}"` };

  const workType = manifest.work_type;
  const next_phase = computeNextPhase(manifest).next_phase;

  // Where a linear type's next route enters — none past the pipeline's end,
  // which completes the unit.
  const targets = engine.detail.WORK_UNIT_TYPES[workType] && next_phase !== 'done'
    ? engine.detail.phaseTargets(cwd, manifest, next_phase)
    : null;

  return {
    work_unit: workUnit,
    work_type: workType,
    status: manifest.status,
    next_phase,
    next: targets ? targets.next : null,
  };
}

// The thin scoped dump the continuation reads: the derived next phase and,
// for a linear type, the route it is entered by.
function format(result) {
  if (result.error) return `Error: ${result.error}\n`;

  const lines = [];
  lines.push(`=== ${result.work_unit} (${result.work_type}) ===`);
  lines.push(`next_phase: ${result.next_phase}`);

  if (engine.detail.WORK_UNIT_TYPES[result.work_type]) {
    const { next } = result;
    lines.push(`next_route: ${next ? engine.project.phaseRoute(result.work_type, next.phase, result.work_unit, next.topic) : '(none)'}`);
  }

  return lines.join('\n') + '\n';
}

if (require.main === module) {
  engine.gateway.runGateway({
    index: () => {
      process.stderr.write('Error: work unit name required\nUsage: gateway.cjs <work_unit>\n');
      process.exit(1);
      return ''; // unreachable; keeps the handler's return type uniform
    },
    fallback: (workUnit) => format(discover(process.cwd(), workUnit)),
  });
}

module.exports = { discover, format };
