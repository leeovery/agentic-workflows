'use strict';

// ---------------------------------------------------------------------------
// Adapter (read gateway) for workflow-discussion-process. Thin by design:
// map state and rendering live in the engine; this script selects the
// answers the session flow needs and sections the output.
//
//   gateway.cjs map {work_unit} {topic}
//     → DATA (counts, all_decided, unresolved, review_cycles)
//       + DISPLAY (the Discussion Map block)
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const engine = require('../../workflow-engine/scripts/lib.cjs');

// Completed review cycles. The engine's agent store is authoritative: review
// rows past `in-flight` are cycles that happened. Legacy review-*.md files
// with no store row (pre-programme caches) count as completed cycles by
// existence alone — their frontmatter is legacy state and is never read.
function reviewCycles(cwd, workUnit, topic) {
  const dir = path.join(cwd, '.workflows', '.cache', workUnit, 'discussion', topic);
  /** @type {Record<string, any>} */
  let rows = {};
  try {
    const store = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'));
    rows = store.agents || {};
  } catch {
    rows = {};
  }
  const rowIds = new Set();
  let fromRows = 0;
  for (const row of Object.values(rows)) {
    if (row.kind !== 'review') continue;
    rowIds.add(`${row.id}.md`);
    if (row.status !== 'in-flight') {
      // A zero-finding row only counts if its report actually exists — an
      // abandoned row closed by the dead-session arm never produced one.
      let real = (row.findings || []).length > 0;
      if (!real) {
        try { real = fs.statSync(path.join(dir, `${row.id}.md`)).size > 0; } catch { real = false; }
      }
      if (real) fromRows += 1;
    } else {
      // Finished but not yet scanned: the agent's report landed, no scan has
      // promoted the row. Mirror scan's promotion read — the cycle happened.
      try {
        if (fs.statSync(path.join(dir, `${row.id}.md`)).size > 0) fromRows += 1;
      } catch { /* still running */ }
    }
  }
  try {
    const legacy = fs.readdirSync(dir)
      .filter((f) => /^review-.*\.md$/.test(f))
      .filter((f) => !rowIds.has(f))
      .length;
    return fromRows + legacy;
  } catch {
    return fromRows;
  }
}

function map(workUnit, topic) {
  if (!workUnit || !topic) {
    throw new Error('Usage: gateway.cjs map {work_unit} {topic}');
  }
  const cwd = process.cwd();
  const manifest = engine.manifest.loadWorkUnitManifest(cwd, workUnit);
  const state = engine.discussionMap.mapState(manifest, topic);

  return [
    engine.gateway.dataBlock({
      topic,
      counts: state.counts,
      all_decided: state.all_decided,
      unresolved: state.unresolved,
      review_cycles: reviewCycles(cwd, workUnit, topic),
    }),
    engine.gateway.displayBlock(engine.project.discussionMap(topic, manifest)),
  ].join('\n');
}

if (require.main === module) {
  engine.gateway.runGateway({ map });
}

module.exports = { map };
