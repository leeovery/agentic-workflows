'use strict';

// ---------------------------------------------------------------------------
// Adapter (read gateway) for workflow-roadmap. Thin by design: derivation
// lives in the engine's domain ring (roadmap state — lifecycle by join);
// this script selects which view the skill's flow needs and sections it.
//
//   gateway.cjs view                       → DATA + TITLE + DISPLAY + MENU home snapshot
//   gateway.cjs pull-set                   → DATA + DISPLAY + MENU pull working set
//                                            (no TITLE — the skill's step marker
//                                            heads the ceremony)
//   gateway.cjs proposal --file {path}     → harvest overlay: the proposed item
//                                            set (model-authored JSON) rendered
//                                            over the existing roadmap
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const engine = require('../../workflow-engine/scripts/lib.cjs');

function state(cwd) {
  return engine.roadmap.roadmapState(cwd);
}

/** DATA lines shared by the views: the derived state the flow reasons from. */
function stateLines(s) {
  const lines = [
    `exists: ${s.exists}`,
    `active_session: ${s.active_session ?? 'null'}`,
    // Padded like the log's own filename — the flow interpolates this into
    // durable source pointers, so the two spellings must never diverge.
    `next_session_number: ${String(s.next_session_number).padStart(3, '0')}`,
    `session_count: ${s.session_logs.length}`,
    `import_count: ${s.imports.length}`,
    `horizons: ${s.horizons.join(', ') || '(none)'}`,
    `totals: ${s.totals.items} items — ${s.totals.in_flight} in flight, ${s.totals.waiting} waiting, ${s.totals.shipped} shipped, ${s.totals.orphaned} orphaned`,
  ];
  if (s.items.length > 0) {
    lines.push('ITEMS (name  horizon  state  work_unit):');
    for (const i of s.items) {
      lines.push(`  ${i.name}  ${i.horizon}  ${i.state}  ${i.work_unit || '—'}`);
    }
  }
  if (s.session_logs.length > 0) {
    lines.push('SESSIONS (number  path):');
    for (const l of s.session_logs) lines.push(`  ${l.number}  ${l.path}`);
  }
  return lines;
}

// The home snapshot: derived state (DATA), the map (DISPLAY), the
// converse/pull menu (MENU) — the `r/roadmap` row's landing and the
// session's "show roadmap" anchor.
function view() {
  const s = state(process.cwd());
  const menu = engine.project.roadmapHomeMenu(s);
  const dataLines = stateLines(s);
  dataLines.push('ACTIONS (key  action):');
  for (const k of menu.keys) dataLines.push(`  ${k.key}  ${k.action}`);
  return [
    engine.gateway.dataBlock(dataLines.join('\n')),
    engine.gateway.titleBlock(engine.project.roadmapTitle()),
    engine.gateway.displayBlock(engine.project.roadmapMapView(s)),
    engine.gateway.menuBlock(menu.rendered),
  ].join('\n');
}

// The pull working set: waiting items numbered horizon-major, the DATA table
// resolving numbers, the select menu.
function pullSet() {
  let v;
  try {
    v = engine.project.roadmapPullSetView(state(process.cwd()));
  } catch (err) {
    process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
    return '';
  }
  return [
    engine.gateway.dataBlock(v.data),
    engine.gateway.displayBlock(v.display),
    engine.gateway.menuBlock(v.menu),
  ].join('\n');
}

/**
 * Parse and validate the harvest's proposed-items JSON: a non-empty array of
 * {name, horizon, summary}.
 */
function readProposedFile(cwd, file) {
  const abs = path.resolve(cwd, file);
  if (!fs.existsSync(abs)) {
    throw new Error(`proposed-items file not found: ${file}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (err) {
    throw new Error(`proposed-items file is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('proposed-items file must be a non-empty JSON array of {name, horizon, summary}');
  }
  parsed.forEach((t, i) => {
    for (const field of ['name', 'horizon', 'summary']) {
      if (typeof t[field] !== 'string' || t[field] === '') {
        throw new Error(`proposed item ${i} is missing "${field}" (each entry needs name, horizon, summary)`);
      }
    }
  });
  return parsed;
}

// The harvest overlay: per-name flags the persist step routes on (an active
// collision must be resolved before the gate; illegal names must be renamed)
// plus the proposal rendered over the existing roadmap.
function proposal(...rest) {
  const cwd = process.cwd();
  let file = null;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--file' && rest[i + 1]) file = rest[++i];
    else throw new Error(`proposal: unexpected argument "${rest[i]}"`);
  }
  if (!file) throw new Error('Usage: gateway.cjs proposal --file <path>');

  const s = state(cwd);
  const proposed = readProposedFile(cwd, file);

  const dataLines = [`mode: harvest`, `existing_items: ${s.items.length}`, `proposed (${proposed.length}):`];
  for (const t of proposed) {
    const flags = [
      `horizon=${t.horizon}`,
      `exists_on_roadmap=${s.items.some((i) => i.name === t.name)}`,
      `legal_name=${!/[./]/.test(t.name)}`,
      `legal_horizon=${!/[./]/.test(t.horizon)}`,
      `new_horizon=${!s.horizons.includes(t.horizon)}`,
    ];
    dataLines.push(`  ${t.name} ${flags.join(' ')}`);
  }

  return engine.gateway.dataBlock(dataLines.join('\n')) + '\n'
    + engine.gateway.displayBlock(engine.project.roadmapProposalView(s, proposed));
}

if (require.main === module) {
  engine.gateway.runGateway({
    index: () => view(),
    view,
    'pull-set': pullSet,
    proposal: (...rest) => {
      try {
        return proposal(...rest);
      } catch (err) {
        process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(1);
        return ''; // unreachable
      }
    },
  });
}

module.exports = { view, pullSet, proposal };
