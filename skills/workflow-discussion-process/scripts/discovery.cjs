'use strict';

// ---------------------------------------------------------------------------
// Adapter (read gateway) for workflow-discussion-process. Thin by design:
// map state and rendering live in the engine; this script selects the
// answers the session flow needs and sections the output.
//
//   discovery.cjs map {work_unit} {topic}
//     → DATA (counts, all_decided, unresolved, review_cycles)
//       + DISPLAY (the Discussion Map block)
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const engine = require('../../workflow-engine/scripts/lib.cjs');

// Completed review cycles = review-*.md files in the topic's discussion cache.
function reviewCycles(cwd, workUnit, topic) {
  const dir = path.join(cwd, '.workflows', '.cache', workUnit, 'discussion', topic);
  try {
    return fs.readdirSync(dir).filter((f) => /^review-.*\.md$/.test(f)).length;
  } catch {
    return 0;
  }
}

function map(workUnit, topic) {
  if (!workUnit || !topic) {
    throw new Error('Usage: discovery.cjs map {work_unit} {topic}');
  }
  const cwd = process.cwd();
  const manifest = engine.manifest.loadWorkUnitManifest(cwd, workUnit);
  const state = engine.map.mapState(manifest, topic);

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
