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
    const store = JSON.parse(fs.readFileSync(path.join(cwd, '.workflows', '.cache', workUnit, 'state.json'), 'utf8'));
    rows = store.agents || {};
  } catch {
    rows = {};
  }
  const prefix = `discussion/${topic}/`;
  const rowIds = new Set();
  let fromRows = 0;
  for (const [key, row] of Object.entries(rows)) {
    if (!key.startsWith(prefix) || row.kind !== 'review') continue;
    rowIds.add(`${row.id}.md`);
    if (row.status !== 'in-flight') fromRows += 1;
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
