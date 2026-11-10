'use strict';

const engine = require('../../leeway-engine/scripts/lib.cjs');
const { loadManifest } = engine.reads;
const { computeNextPhase } = engine.derivations;

// A single-topic unit's next phase, and the route it is entered by — none
// past the pipeline's end, which completes the unit. The bridge runs it for
// no epic, which returns to its menu.
function discover(cwd, workUnit) {
  const manifest = loadManifest(cwd, workUnit);
  if (!manifest) return { error: `Could not read manifest for "${workUnit}"` };

  const next_phase = computeNextPhase(manifest).next_phase;
  const targets = next_phase === 'done' ? null : engine.detail.phaseTargets(cwd, manifest, next_phase);

  return {
    work_unit: workUnit,
    work_type: manifest.work_type,
    next_phase,
    next: targets ? targets.next : null,
  };
}

// The thin scoped dump the continuation reads: the derived next phase and
// the route it is entered by.
function format(result) {
  if (result.error) return `Error: ${result.error}\n`;

  const { next } = result;
  return [
    `=== ${result.work_unit} (${result.work_type}) ===`,
    `next_phase: ${result.next_phase}`,
    `next_route: ${next ? engine.project.phaseRoute(result.work_type, next.phase, result.work_unit, next.topic) : '(none)'}`,
    '',
  ].join('\n');
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
