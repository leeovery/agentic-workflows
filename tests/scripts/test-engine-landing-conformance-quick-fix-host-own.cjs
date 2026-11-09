'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, a commit of the person's own on
// its branch after a merge by hand (R15): the contract every landing driver
// meets, run through the engine's verbs against each shipped driver in
// turn. A commit on the branch the engine never wrote is kept by the branch
// cut again at the next start, replayed in its place, and lands with the
// squash. Alone on the branch once every fix has landed by hand,
// test-engine-landing-conformance-quick-fix-host-own-alone.cjs's; in a
// nested clone, -nested-read-own's. The branch deleted here while its pull
// request is open is -host's. A driver's side
// (tests/drivers/{name}/landing.cjs) readies the world, merges by hand and
// reads what landed where; this file names no driver and no tool.
// Conformance layer: the quick-fix of quick-fix-world.cjs
// (`quickFixConformance`), built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, git } = require('./engine-harness.cjs');
const { UNIT, DESCRIPTION, BRANCH, createFix, ownCommit, quickFixConformance } = require('./quick-fix-world.cjs');
const { HELP, steps } = require('./quick-fix-by-hand.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const MINE = 'My own change';

for (const { name } of listDrivers('landing')) {
  const conf = quickFixConformance(name, `engine-landing-quick-fix-host-own-${name}-`);
  const { side, as, project, built, landed } = conf;
  const { committed, closed } = steps(conf);
  const [[how, merge]] = Object.entries(side.byHand);

  describe(`the ${name} landing driver's quick-fix, a commit of the person's own on its branch (R15)`, () => {
    it(`merged by hand by ${how}, then a commit of the person's own on its branch: the next start cuts the branch again keeping it, replayed in its place, and it lands with the squash`, () => {
      const at = project();
      built(at, 1);
      merge(at, BRANCH);
      ownCommit(at, MINE);
      const before = git(at, ['rev-parse', '--short', BRANCH]).trim();
      createFix(at, 2, HELP.title, as());
      const start = ok(at, ['task', 'start', UNIT, '1.2'], as());
      const kept = git(at, ['log', '--format=%s', `${side.defaultTip(at)}..${BRANCH}`]).trim();
      committed(at, HELP.text);
      ok(at, ['land', 'open', UNIT, '1.2'], as());
      ok(at, ['task', 'done', UNIT, '1.2'], as());
      closed(at);

      assert.deepStrictEqual([start.cut_again.map((/** @type {any} */ { repo, from, replayed }) => ({ repo, from, replayed })), kept], [[{ repo: '.', from: before, replayed: [] }], MINE]);
      assert.deepStrictEqual(landed(at).at(-1), [`fix(${UNIT}): ${DESCRIPTION}`, ['mine.txt', HELP.file]]);
    });
  });
}
