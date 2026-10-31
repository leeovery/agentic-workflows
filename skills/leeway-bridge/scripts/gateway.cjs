'use strict';

const path = require('path');
const engine = require('../../leeway-engine/scripts/lib.cjs');
const { TERMINAL_STATUSES } = require('../../leeway-engine/scripts/kernel/manifest-schema.cjs');
const { loadManifest, fileExists, listFiles, listDirs } = engine.reads;
const { stateRoot } = engine.state;
const { phaseStatus, phaseItems, computeNextPhase, inputMoved, movedFrom } = engine.derivations;
const { seriesDir } = require('../../leeway-engine/scripts/domain/experiment-paths.cjs');

const ALL_PHASES = engine.schema.VALID_PHASES.filter((p) => p !== 'discovery');

/** Whether any of the unit's topics passes `holds`, given the topic's name. @param {string} cwd @param {string} workUnit @param {(topic: string) => boolean} holds */
function anyTopic(cwd, workUnit, holds) {
  return listDirs(path.join(stateRoot(cwd), workUnit, 'topics')).some(holds);
}

function phaseFileExists(cwd, workUnit, phase, manifest) {
  const dir = path.join(stateRoot(cwd), workUnit, phase);
  switch (phase) {
    case 'experiment':     return anyTopic(cwd, workUnit, (topic) => listDirs(path.join(stateRoot(cwd), seriesDir(workUnit, topic))).length > 0);
    case 'discussion':     return anyTopic(cwd, workUnit, (topic) => fileExists(path.join(stateRoot(cwd), workUnit, 'topics', topic, 'log.md')));
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

  // Live items whose input has moved — observability for the continuation
  // prose (routing itself rides next_phase). The same predicate next_phase
  // walks, so the dump can never name a route its own list calls settled.
  const reconcile_pending = [];
  for (const phase of ALL_PHASES) {
    for (const item of phaseItems(manifest, phase)) {
      if (!TERMINAL_STATUSES.includes(item.status)
          && (item.reconcile_needed !== undefined || inputMoved(manifest, phase, item))) {
        reconcile_pending.push(`${phase}/${item.name} (${movedFrom(item)})`);
      }
    }
  }

  // Where a linear type's routes enter: the next phase and the revisit
  // candidates — none past the pipeline's end, which completes the unit.
  const targets = engine.detail.WORK_UNIT_TYPES[workType] && next_phase !== 'done'
    ? engine.detail.phaseTargets(manifest, next_phase)
    : null;

  return {
    work_unit: workUnit,
    work_type: workType,
    status: manifest.status,
    phases,
    next_phase,
    reconcile_pending,
    targets,
  };
}

// The thin scoped dump: the fields the continuation references branch on —
// the derived next phase, the completed set (in pipeline order), the revisit
// candidates (completed phases before next_phase, filtered to the type's
// pipeline), and
// the route each move is entered by.
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
    const { next, revisit } = result.targets || { next: null, revisit: [] };
    const route = (/** @type {string} */ phase, /** @type {string|null} */ topic = null) => engine.project.phaseRoute(result.work_type, phase, result.work_unit, topic);
    lines.push(`revisitable_phases: ${revisit.join(', ') || '(none)'}`);
    lines.push(`next_route: ${next ? route(next.phase, next.topic) : '(none)'}`);
    lines.push(`revisit_routes: ${revisit.map((/** @type {string} */ phase) => route(phase)).join(', ') || '(none)'}`);
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
