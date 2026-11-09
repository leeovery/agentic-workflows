'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, a second clone of the project
// (R18): the contract every landing driver meets, run through the engine's
// verbs against each shipped driver in turn. A fix across the project and a
// nested clone, the door's record of the clone on the state branch, then
// every repository as a second clone of the project has it once its state
// branch merges — the record, and no branch of the quick-fix's here nor any
// commit of one in a reflog: the next fix, in the project alone, walks the
// clone the record names, and the close lands it there with the project's.
// A second clone of the clone alone is
// test-engine-landing-conformance-quick-fix-nested-second-clone.cjs's. A
// driver's side (tests/drivers/{name}/landing.cjs) readies each repository
// and reads what landed where; this file names no driver and no tool.
// Conformance layer: quick-fix-world.cjs's `quickFixNestedConformance`,
// built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { git } = require('./engine-harness.cjs');
const { UNIT, BRANCH, SET, quickFixNestedConformance } = require('./quick-fix-world.cjs');
const { NESTED } = require('./landing-world.cjs');
const { STATE_BRANCH } = require('../../skills/leeway-engine/scripts/domain/state-worktree.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const ID = (/** @type {number} */ n) => `${UNIT}-1-${n}`;

for (const { name } of listDrivers('landing')) {
  const { project, built, closed, landed, secondClone } = quickFixNestedConformance(name, `engine-landing-quick-fix-project-clone-${name}-`);

  describe(`the ${name} landing driver's quick-fix in a second clone of the project, its record carried on the state branch (R18)`, () => {
    it('the next fix, in the project alone, walks the clone the record names, and the close lands both there and in the project', () => {
      const at = project();
      built(at, 1, { [SET[0].file]: SET[0].text, 'lib/lib.txt': 'lib --colour\n' });
      const carried = JSON.parse(git(at.dir, ['show', `${STATE_BRANCH}:${UNIT}/manifest.json`])).fixes.repos;
      git(at.dir, ['switch', '-q', 'main']);
      git(at.dir, ['branch', '-q', '-D', BRANCH]);
      git(at.dir, ['update-ref', '-d', `refs/remotes/origin/${BRANCH}`]);
      git(at.dir, ['reflog', 'expire', '--expire=now', 'HEAD']);
      secondClone(at.lib, NESTED.lib.into);
      built(at, 2, { [SET[1].file]: SET[1].text });
      const close = closed(at);

      assert.deepStrictEqual([carried, close.landed.map((/** @type {any} */ { repo, merged }) => [repo, merged]), landed(at)], [
        ['lib'], [['lib', ['1.1']], ['.', ['1.1', '1.2']]], { '.': [[ID(2), [SET[0].file, SET[1].file]]], ext: [], lib: [[ID(1), ['lib.txt']]] },
      ]);
    });
  });
}
