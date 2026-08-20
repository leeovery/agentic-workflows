'use strict';

// ---------------------------------------------------------------------------
// Adapter (read gateway) for workflow-discussion-process. Thin by design:
// map state, rendering, and the agent-store derivations live in the engine;
// this script selects the answers the session flow needs and sections the
// output.
//
//   gateway.cjs map {work_unit} {topic}
//     → DATA (counts, all_decided, unresolved, review_arming)
//       + DISPLAY (the Discussion Map block)
//       + MENU: defer gate (while undecided subtopics remain — emitted only
//         at the concluding step, per its marker)
// ---------------------------------------------------------------------------

const engine = require('../../workflow-engine/scripts/lib.cjs');

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
      review_arming: engine.agents.reviewArming(cwd, workUnit, topic),
    }),
    engine.gateway.displayBlock(engine.project.discussionMap(topic, manifest)),
    ...(state.unresolved.length > 0
      ? [engine.project.discussionDeferGate(state.unresolved.length)]
      : []),
  ].join('\n');
}

if (require.main === module) {
  engine.gateway.runGateway({ map });
}

module.exports = { map };
