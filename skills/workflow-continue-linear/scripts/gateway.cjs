'use strict';

// ---------------------------------------------------------------------------
// Adapter (read gateway) for workflow-continue-linear. Thin by design: the
// unit's entry and its projections live in the engine's domain ring; this
// script finds the unit — its type read from its manifest — and sections the
// output.
//
//   gateway.cjs view {work_unit}
//       → DATA + TITLE + DISPLAY snapshot, with the proceed/revisit MENU when
//         there is anything to revisit or finalise; the not-found display
//         when no feature, bugfix, quick-fix or cross-cutting concern by that
//         name is in progress
//
// That call is the whole legal surface: the bare call, an unknown verb, a
// bare positional, or excess arguments is a usage error (stderr, exit 1).
// ---------------------------------------------------------------------------

const engine = require('../../workflow-engine/scripts/lib.cjs');

/**
 * One snapshot of the unit: reasoning DATA (flow flags + the ACTIONS table),
 * the TITLE, the rendered status block (DISPLAY), and the proceed/revisit
 * menu (MENU).
 * @param {string} cwd @param {string} workUnit @returns {string}
 */
function view(cwd, workUnit) {
  const found = engine.detail.activeWorkUnit(cwd, workUnit);
  if (!found) {
    return engine.gateway.dataBlock({ work_unit: workUnit, error: 'no active work unit with this name' })
      + engine.project.selectionNotFound('work unit', workUnit);
  }
  const { type, unit } = found;
  const menu = engine.project.workUnitMenu(type, unit);
  return [
    engine.gateway.dataBlock(engine.project.workUnitData(type, unit, menu)),
    engine.gateway.titleBlock(engine.project.workUnitTitle(unit)),
    engine.gateway.displayBlock(engine.project.workUnitStatus(type, unit)),
    engine.gateway.menuBlock(menu.rendered),
  ].filter(Boolean).join('\n');
}

const USAGE = 'Usage: gateway.cjs view {work_unit}';

/** Reject the call: usage to stderr, exit 1. @param {string} message @returns {string} */
function usageError(message) {
  process.stderr.write(`gateway: ${message}\n${USAGE}\n`);
  process.exit(1);
  return ''; // unreachable; keeps the handler's return type uniform
}

if (require.main === module) {
  engine.gateway.runGateway({
    index: () => usageError('a verb is required'),
    view: (workUnit, ...rest) => (!workUnit || rest.length > 0
      ? usageError('view takes exactly one work unit')
      : view(process.cwd(), workUnit)),
    fallback: (verb) => usageError(`unknown verb "${verb}"`),
  });
}

module.exports = { view };
