'use strict';

// ---------------------------------------------------------------------------
// Adapter (read gateway) for workflow-start. Thin by design: collation lives
// in the engine's domain ring; this script selects which engine answers the
// skill's flow needs and sections the output.
//
//   discovery.cjs        → labelled dump, all work + inbox (head insert)
//   discovery.cjs view   → DATA + DISPLAY + MENU snapshot (Step 3)
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

// One snapshot for Step 3: reasoning DATA (state flags + the ACTIONS table),
// the rendered overview (DISPLAY), and the menu (MENU).
function view() {
  const detail = discover(process.cwd());
  const menu = engine.project.startMenu(detail);

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
    engine.gateway.displayBlock(engine.project.startOverview(detail)),
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
