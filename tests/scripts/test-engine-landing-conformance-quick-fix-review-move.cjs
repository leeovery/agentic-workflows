'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix moved to a feature mid-review
// (19.5.9, 19.5.15, 19.5.16): its review's fix tasks are its tasks, so the
// move treats them as its fixes — round 1 failed, its fix task 2.1 open,
// the yes closes 2.1, takes every phase the quick-fix wrote out of the
// tracker, phase 2 among them, and sets its review's folder aside in the
// topic's earlier material, whose round report the topic's first opening
// reads; the feature then writes its own phases 1 and 2, and holds no
// round of the quick-fix's for its own review to read as its own. The
// contract every landing driver meets, run through the engine's verbs
// against each shipped driver in turn; this file names no driver and no
// tool. Conformance layer: the quick-fix of quick-fix-world.cjs
// (`quickFixConformance`), built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

const { ok, okSections, refuses, writeState, layout, statePath } = require('./engine-harness.cjs');
const { UNIT, quickFixConformance, checklistClosed } = require('./quick-fix-world.cjs');
const { firstRoundFailed } = require('./quick-fix-review-by-hand.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

for (const { name } of listDrivers('landing')) {
  const conf = quickFixConformance(name, `engine-landing-quick-fix-review-move-${name}-`);
  const { as } = conf;

  describe(`the ${name} landing driver's quick-fix moved to a feature mid-review (19.5.9, 19.5.16)`, () => {
    it('closes the review\'s open fix task, takes every phase it wrote out of the tracker and sets its review aside in the topic\'s earlier material; the feature writes its own phases 1 and 2 and holds no round of the review', () => {
      const at = conf.project();
      const run = (/** @type {string[]} */ args) => ok(at, args, as());
      conf.built(at, 1);
      conf.built(at, 2);
      conf.record(at, 1);
      conf.record(at, 2);
      checklistClosed(at, as());
      run(['review', 'ask', UNIT]);
      okSections(at, ['enter', 'review', UNIT], as());
      firstRoundFailed(conf, at);
      const brief = writeState(at, layout.cache('scratch', 'brief.md'), `# ${UNIT}\n\nWhat the review showed.\n`);
      okSections(at, ['workunit', 'move', UNIT, '--to', 'feature', '--file', writeState(at, layout.cache('scratch', 'move.json'), JSON.stringify({ description: `The ${UNIT} work, as feature work.`, reason: 'It needs a decision.', brief }))], as());
      const { next } = run(['gate', 'start this work', '--pick', 'y']);
      const moved = run(next.argv);
      const unwritten = [1, 2].map((phase) => refuses(at, ['task', 'list', UNIT, String(phase)], as()).error);
      const earlier = statePath(at, layout.unit(UNIT, 'topics', UNIT, 'earlier', 'review', 'round-1.md'));
      const opening = okSections(at, ['enter', 'discussion', UNIT], as()).sections.split('\n').filter((line) => line.startsWith('earlier review round: '));
      const written = [1, 2].map((phase) => run(['task', 'phase', UNIT, String(phase), '--title', `The feature's phase ${phase}`]).phase);

      assert.deepStrictEqual([moved.work_type, moved.fixes_closed], ['feature', ['2.1']]);
      assert.deepStrictEqual(unwritten, [`phase 1 of ${UNIT} is not written`, `phase 2 of ${UNIT} is not written`]);
      assert.deepStrictEqual([fs.existsSync(statePath(at, layout.unit(UNIT, 'review'))), fs.existsSync(earlier), opening], [false, true, [`earlier review round: ${earlier}`]]);
      assert.deepStrictEqual([written, run(['task', 'list', UNIT, '2']).tasks], [[1, 2], []]);
    });
  });
}
