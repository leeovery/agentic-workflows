'use strict';

// ---------------------------------------------------------------------------
// Adapter (read gateway) for leeway. Thin by design: collation lives
// in the engine's domain ring; this script selects which engine answers the
// skill's flow needs and sections the output.
//
//   gateway.cjs inbox                 → inbox pickup snapshot (no MENU when the inbox is empty)
//   gateway.cjs archived              → archived store snapshot
//   gateway.cjs working-set {path} …  → working-set snapshot (add/drop gates via their own verbs)
//   gateway.cjs manage                → manage selection snapshot
//   gateway.cjs manage {work_unit}    → action-menu snapshot (absorb/plan gates via render surfaces)
//   gateway.cjs completed             → completed & cancelled snapshot
// ---------------------------------------------------------------------------

const engine = require('../../leeway-engine/scripts/lib.cjs');

// The gate each of the start's menus states, named for what it asks: a key
// of the trust log forever (16.11.9), so never another menu's.
const GATES = Object.freeze({
  inbox: 'inbox menu',
  archived: 'archived pick',
  workingSet: 'working set menu',
  manage: 'manage pick',
  manageUnit: 'manage actions',
  completed: 'completed pick',
});

function discover(cwd) {
  return engine.detail.startDetail(cwd);
}

// The inbox pickup snapshot: the combined live list, numbered, plus the
// select/archived/back menu — or, with nothing in the inbox, the display that
// says so and no menu.
function inboxView() {
  const detail = discover(process.cwd());
  const v = engine.project.inboxPickupView(engine.detail.combinedInbox(detail.inbox), detail.inbox.archived.total_count > 0);
  return [
    engine.gateway.dataBlock(v.data),
    engine.gateway.titleBlock('Inbox'),
    engine.gateway.displayBlock(v.display),
    engine.gateway.menuBlock(GATES.inbox, v.menu ?? ''),
  ].filter(Boolean).join('\n');
}

// The archived store snapshot: the combined archived list as a numbered pick
// menu — or the empty display when nothing is archived.
function archivedView() {
  const detail = discover(process.cwd());
  const v = engine.project.archivedView(engine.detail.combinedInbox(detail.inbox.archived));
  return pickSnapshot(v, 'Archived', GATES.archived);
}

// A pick snapshot: DATA and TITLE, then the menu that lists the rows, stating
// the gate `gate` — or, with no rows, the display that says so.
function pickSnapshot(v, title, gate) {
  return [
    engine.gateway.dataBlock(v.data),
    engine.gateway.titleBlock(title),
    v.menu ? engine.gateway.menuBlock(gate, v.menu) : engine.gateway.displayBlock(v.display),
  ].join('\n');
}

// The working-set snapshot over the caller-held selection: DATA (set + addable
// tables), the set tree, and the set menu.
// `--summaries <file>` names a JSON payload of model-synthesised item
// summaries keyed by inbox path — rows render without one. The add/drop gate
// sections are served by their own verbs below, fetched at each gate.
function workingSetView(...args) {
  const paths = [];
  let summaries = {};
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--summaries') {
      i += 1;
      try {
        summaries = JSON.parse(require('fs').readFileSync(args[i], 'utf8'));
      } catch (err) {
        return engine.gateway.dataBlock({ error: `--summaries: ${err.message}` });
      }
    } else {
      paths.push(args[i]);
    }
  }
  let ws;
  try {
    ws = engine.detail.workingSetDetail(process.cwd(), paths);
  } catch (err) {
    return engine.gateway.dataBlock({ error: err.message });
  }
  const v = engine.project.workingSetView(ws, summaries);
  return [
    engine.gateway.dataBlock(v.data),
    engine.gateway.titleBlock(v.title),
    engine.gateway.displayBlock(v.display),
    engine.gateway.menuBlock(GATES.workingSet, v.menu),
  ].join('\n');
}

// The add/drop gates over the caller-held selection — fetched at the gate
// that displays them, so the candidate lists are computed fresh from the
// same paths the snapshot took.
function workingSetGate(builder) {
  return (...paths) => {
    let ws;
    try {
      ws = engine.detail.workingSetDetail(process.cwd(), paths);
      return builder(ws);
    } catch (err) {
      return engine.gateway.dataBlock({ error: err.message });
    }
  };
}

// manage → the selection snapshot; manage {work_unit} → the unit's action-menu
// snapshot; the absorb-target / plan-topic gates are render surfaces.
function manageView(workUnit) {
  if (workUnit === undefined) {
    const v = engine.project.manageListView(discover(process.cwd()));
    return [
      engine.gateway.dataBlock(v.data),
      engine.gateway.titleBlock('Manage'),
      engine.gateway.menuBlock(GATES.manage, v.menu),
    ].join('\n');
  }
  const md = engine.detail.manageDetail(process.cwd(), workUnit);
  if (!md) {
    return engine.gateway.dataBlock({ work_unit: workUnit, error: 'no work unit with this name' });
  }
  const v = engine.project.manageUnitView(md);
  return [
    engine.gateway.dataBlock(v.data),
    engine.gateway.menuBlock(GATES.manageUnit, v.menu),
  ].join('\n');
}

// The completed & cancelled snapshot: the closed units as a numbered pick
// menu — or, with nothing closed, the display that says so.
function completedView() {
  return pickSnapshot(engine.project.completedView(discover(process.cwd())), 'Completed & Cancelled', GATES.completed);
}

if (require.main === module) {
  engine.gateway.runGateway({
    index: () => {
      process.stderr.write('Error: a verb is required\nUsage: gateway.cjs <inbox|archived|working-set|working-set-add-gate|working-set-drop-gate|manage|completed> [args…]\n');
      return process.exit(1);
    },
    inbox: inboxView,
    archived: archivedView,
    'working-set': workingSetView,
    'working-set-add-gate': workingSetGate(engine.project.workingSetAddGate),
    'working-set-drop-gate': workingSetGate(engine.project.workingSetDropGate),
    manage: manageView,
    completed: completedView,
  });
}

module.exports = { discover, GATES };
