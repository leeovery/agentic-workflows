'use strict';

// ---------------------------------------------------------------------------
// Adapter (read gateway) for workflow-continue-quickfix. Thin by design: the
// work-unit collation and projections live in the engine's domain ring; this
// script selects which engine answers the skill's flow needs and sections the
// output.
//
//   gateway.cjs               → labelled dump, all active quick-fixes (head insert)
//   gateway.cjs view {work_unit}
//                               → DATA + DISPLAY + MENU snapshot (Step 5)
// ---------------------------------------------------------------------------

const engine = require('../../workflow-engine/scripts/lib.cjs');

const TYPE = 'quick-fix';

function discover(cwd) {
  return engine.detail.workUnitDetail(cwd, TYPE);
}

function format(result) {
  return engine.detail.workUnitIndex(TYPE, result);
}

// One snapshot for Step 5: reasoning DATA (flow flags + the ACTIONS table),
// the rendered status block (DISPLAY), and the proceed/revisit menu (MENU).
function view(workUnit) {
  const result = discover(process.cwd());
  const unit = (result.quick_fixes || []).find((u) => u.name === workUnit);
  if (!unit) {
    return engine.gateway.dataBlock({ work_unit: workUnit || '(missing)', error: 'no active quick-fix with this name' });
  }
  const menu = engine.project.workUnitMenu(TYPE, unit);
  return [
    engine.gateway.dataBlock(engine.project.workUnitData(TYPE, unit, menu)),
    engine.gateway.displayBlock(engine.project.workUnitStatus(TYPE, unit)),
    engine.gateway.menuBlock(menu.rendered),
  ].join('\n');
}

if (require.main === module) {
  engine.gateway.runGateway({
    index: () => format(discover(process.cwd())),
    view,
    fallback: () => format(discover(process.cwd())),
  });
}

module.exports = { discover, format };
