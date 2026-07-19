'use strict';

// ---------------------------------------------------------------------------
// Adapter (read gateway) for workflow-start. Thin by design: collation lives
// in the engine's domain ring; this script selects which engine answers the
// skill's flow needs and sections the output.
//
//   gateway.cjs                       → labelled dump, all work + inbox (head insert)
//   gateway.cjs view                  → DATA + DISPLAY + MENU snapshot (Step 3 /
//                                       empty state — the snapshot follows has_any_work)
//   gateway.cjs inbox                 → inbox pickup snapshot
//   gateway.cjs archived              → archived store snapshot
//   gateway.cjs working-set {path} …  → working-set snapshot + deferred add/drop gates
//   gateway.cjs manage                → manage selection snapshot
//   gateway.cjs manage {work_unit}    → action-menu snapshot + deferred absorb/plan gates
//   gateway.cjs completed [{type}]    → completed & cancelled snapshot
// ---------------------------------------------------------------------------

const engine = require('../../workflow-engine/scripts/lib.cjs');

function discover(cwd) {
  return engine.detail.startDetail(cwd);
}

// The thin head-insert dump: work-unit names per type, the closed sets, inbox
// items (with titles — the pickup flows display them), and the STATE flags the
// routing steps branch on. Phase labels, trees, and menus are the `view`
// verb's concern, never this dump's.
function format(result) {
  const lines = [];

  function emitSection(label, items) {
    lines.push(`=== ${label.toUpperCase()} ===`);
    for (const u of items) {
      lines.push(`  ${u.name}`);
    }
  }

  function emitInboxItems(scan) {
    for (const item of scan.ideas) {
      lines.push(`  ${item.slug} (idea, ${item.date}) — ${item.title}`);
    }
    for (const item of scan.bugs) {
      lines.push(`  ${item.slug} (bug, ${item.date}) — ${item.title}`);
    }
    for (const item of scan.quickfixes) {
      lines.push(`  ${item.slug} (quick-fix, ${item.date}) — ${item.title}`);
    }
  }

  emitSection('epics', result.epics.work_units);
  emitSection('features', result.features.work_units);
  emitSection('bugfixes', result.bugfixes.work_units);
  emitSection('quick-fixes', result.quick_fixes.work_units);
  emitSection('cross-cutting', result.cross_cutting.work_units);

  if (result.completed.length > 0) {
    lines.push('=== COMPLETED ===');
    for (const u of result.completed) {
      lines.push(`  ${u.name} (${u.work_type}, last phase: ${u.last_phase || 'none'})`);
    }
  }

  if (result.cancelled.length > 0) {
    lines.push('=== CANCELLED ===');
    for (const u of result.cancelled) {
      lines.push(`  ${u.name} (${u.work_type}, last phase: ${u.last_phase || 'none'})`);
    }
  }

  if (result.inbox.total_count > 0) {
    lines.push('=== INBOX ===');
    emitInboxItems(result.inbox);
  }

  if (result.inbox.archived.total_count > 0) {
    lines.push('=== ARCHIVED ===');
    emitInboxItems(result.inbox.archived);
  }

  lines.push('=== STATE ===');
  lines.push(`has_any_work: ${result.state.has_any_work}`);
  lines.push(`counts: ${result.state.epic_count} epic, ${result.state.feature_count} feature, ${result.state.bugfix_count} bugfix, ${result.state.quickfix_count} quick-fix, ${result.state.cross_cutting_count} cross-cutting`);
  lines.push(`completed_count: ${result.completed_count}`);
  lines.push(`cancelled_count: ${result.cancelled_count}`);
  lines.push(`has_inbox: ${result.state.has_inbox}`);
  lines.push(`inbox_count: ${result.state.inbox_count}`);
  lines.push(`has_archived: ${result.state.has_archived}`);
  lines.push(`archived_count: ${result.state.archived_count}`);

  return lines.join('\n') + '\n';
}

// One snapshot for Step 3 and the empty state: reasoning DATA (state flags +
// the ACTIONS table), the rendered overview (DISPLAY), and the menu (MENU).
// Which variant renders follows has_any_work — the empty state swaps in the
// start-something menu, same ACTIONS shape.
function view() {
  const detail = discover(process.cwd());
  const empty = !detail.state.has_any_work;
  const menu = empty ? engine.project.emptyMenu(detail) : engine.project.startMenu(detail);

  const dataLines = [];
  dataLines.push(`has_any_work: ${detail.state.has_any_work}`);
  dataLines.push(`counts: ${detail.state.epic_count} epic, ${detail.state.feature_count} feature, ${detail.state.bugfix_count} bugfix, ${detail.state.quickfix_count} quick-fix, ${detail.state.cross_cutting_count} cross-cutting`);
  dataLines.push(`inbox_count: ${detail.state.inbox_count}`);
  dataLines.push(`completed_count: ${detail.completed_count}`);
  dataLines.push(`cancelled_count: ${detail.cancelled_count}`);
  dataLines.push('ACTIONS (key  action  work_unit  → route):');
  for (const k of menu.keys) {
    let line = `  ${k.key}  ${k.action}  ${k.work_unit || '—'}  → ${k.route || '(internal)'}`;
    if (k.pre_seed) line += `  (pre_seed: ${k.pre_seed})`;
    dataLines.push(line);
  }

  return [
    engine.gateway.dataBlock(dataLines.join('\n')),
    engine.gateway.displayBlock(empty ? engine.project.emptyOverview(detail) : engine.project.startOverview(detail)),
    engine.gateway.menuBlock(menu.rendered),
  ].join('\n');
}

// The inbox pickup snapshot: the combined live list, numbered, plus the
// select/archived/back menu.
function inboxView() {
  const detail = discover(process.cwd());
  const v = engine.project.inboxPickupView(engine.detail.combinedInbox(detail.inbox), detail.state.has_archived);
  return [
    engine.gateway.dataBlock(v.data),
    engine.gateway.displayBlock(v.display),
    engine.gateway.menuBlock(v.menu),
  ].join('\n');
}

// The archived store snapshot: the combined archived list, numbered, plus the
// select prompt.
function archivedView() {
  const detail = discover(process.cwd());
  const v = engine.project.archivedView(engine.detail.combinedInbox(detail.inbox.archived, { archived: true }));
  return [
    engine.gateway.dataBlock(v.data),
    engine.gateway.displayBlock(v.display),
    engine.gateway.menuBlock(v.menu),
  ].join('\n');
}

// The working-set snapshot over the caller-held selection: DATA (set + addable
// tables), the set menu, and the deferred add/drop gate sections.
function workingSetView(...paths) {
  let ws;
  try {
    ws = engine.detail.workingSetDetail(process.cwd(), paths);
  } catch (err) {
    return engine.gateway.dataBlock({ error: err.message });
  }
  const v = engine.project.workingSetView(ws);
  return [
    engine.gateway.dataBlock(v.data),
    engine.gateway.menuBlock(v.menu),
    v.sections,
  ].filter(Boolean).join('\n');
}

// manage → the selection snapshot; manage {work_unit} → the unit's action-menu
// snapshot with its deferred absorb-target / plan-topic gates.
function manageView(workUnit) {
  if (workUnit === undefined) {
    const v = engine.project.manageListView(discover(process.cwd()));
    return [
      engine.gateway.dataBlock(v.data),
      engine.gateway.displayBlock(v.display),
      engine.gateway.menuBlock(v.menu),
    ].join('\n');
  }
  const md = engine.detail.manageDetail(process.cwd(), workUnit);
  if (!md) {
    return engine.gateway.dataBlock({ work_unit: workUnit, error: 'no work unit with this name' });
  }
  const v = engine.project.manageUnitView(md);
  return [
    engine.gateway.dataBlock(v.data),
    engine.gateway.menuBlock(v.menu),
    v.sections,
  ].filter(Boolean).join('\n');
}

// The completed & cancelled snapshot, optionally filtered to one work type.
function completedView(filter) {
  let v;
  try {
    v = engine.project.completedView(discover(process.cwd()), filter);
  } catch (err) {
    return engine.gateway.dataBlock({ error: err.message });
  }
  return [
    engine.gateway.dataBlock(v.data),
    engine.gateway.displayBlock(v.display),
    engine.gateway.menuBlock(v.menu),
  ].join('\n');
}

if (require.main === module) {
  engine.gateway.runGateway({
    index: () => format(discover(process.cwd())),
    view,
    inbox: inboxView,
    archived: archivedView,
    'working-set': workingSetView,
    manage: manageView,
    completed: completedView,
    fallback: () => format(discover(process.cwd())),
  });
}

module.exports = { discover, format };
