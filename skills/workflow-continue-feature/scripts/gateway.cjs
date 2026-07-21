'use strict';

// ---------------------------------------------------------------------------
// Adapter (read gateway) for workflow-continue-feature. Thin by design: the
// work-unit collation and projections live in the engine's domain ring; this
// script selects which engine answers the skill's flow needs and sections the
// output.
//
//   gateway.cjs               → labelled dump, all active features (head insert)
//   gateway.cjs view {work_unit}
//                               → DATA + DISPLAY + MENU snapshot (Step 5),
//                                 plus the deferred revisit-phase menu when
//                                 earlier phases can be revisited
//
// Those two calls are the whole legal surface: an unknown verb, a bare
// positional, or excess arguments is a usage error (stderr, exit 1) — never
// a silent index render.
// ---------------------------------------------------------------------------

const engine = require('../../workflow-engine/scripts/lib.cjs');

const TYPE = 'feature';

function discover(cwd) {
  return engine.detail.workUnitDetail(cwd, TYPE);
}

function format(result) {
  const units = engine.detail.unitsOf(engine.detail.typeConfig(TYPE), result);
  return engine.detail.workUnitIndex(TYPE, result)
    + engine.project.selectionSections(TYPE, units, { completed: result.completed_count, cancelled: result.cancelled_count });
}

// One snapshot for Step 5: reasoning DATA (flow flags + the ACTIONS table),
// the rendered status block (DISPLAY), and the proceed/revisit menu (MENU).
function view(workUnit) {
  const result = discover(process.cwd());
  const unit = (result.features || []).find((u) => u.name === workUnit);
  if (!unit) {
    return engine.gateway.dataBlock({ work_unit: workUnit || '(missing)', error: 'no active feature with this name' });
  }
  const menu = engine.project.workUnitMenu(TYPE, unit);
  return [
    engine.gateway.dataBlock(engine.project.workUnitData(TYPE, unit, menu)),
    engine.gateway.displayBlock(engine.project.workUnitStatus(TYPE, unit)),
    engine.gateway.menuBlock(menu.rendered),
    engine.project.revisitPhasesSection(engine.project.revisitablePhases(TYPE, unit)),
  ].filter(Boolean).join('\n');
}

const USAGE = 'Usage: gateway.cjs | gateway.cjs view {work_unit}';

/** Reject the call: usage to stderr, exit 1. @param {string} message @returns {string} */
function usageError(message) {
  process.stderr.write(`gateway: ${message}\n${USAGE}\n`);
  process.exit(1);
  return ''; // unreachable; keeps the handler's return type uniform
}

if (require.main === module) {
  engine.gateway.runGateway({
    index: (...rest) => (rest.length > 0
      ? usageError('index takes no arguments')
      : format(discover(process.cwd()))),
    view: (workUnit, ...rest) => (!workUnit || rest.length > 0
      ? usageError('view takes exactly one work unit')
      : view(workUnit)),
    fallback: (verb) => usageError(`unknown verb "${verb}"`),
  });
}

module.exports = { discover, format };
