'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, its pull request's head left
// on the host after its merge by hand by the first way the driver's side
// merges by hand, the branch it lands on then changed there on that fix's
// own lines (R15): the contract every landing driver meets, run through the
// engine's verbs against each shipped driver in turn. The head holds no
// commit not landed, so it is never brought in: the next fix opens with
// none of it, unrefused, and lands alone. A head holding a commit not
// landed, brought in, is
// test-engine-landing-conformance-quick-fix-host.cjs's and GitHub's
// tests/drivers/github/test-landing-quick-fix-host*.cjs's. A driver's side
// (tests/drivers/{name}/landing.cjs) readies the world, merges by hand and
// reads what landed where; this file names no driver and no tool.
// Conformance layer: the quick-fix of quick-fix-world.cjs
// (`quickFixConformance`), built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { ok, git, createFile } = require('./engine-harness.cjs');
const { UNIT, DESCRIPTION, BRANCH, SET, quickFixConformance } = require('./quick-fix-world.cjs');
const { HELP, steps } = require('./quick-fix-by-hand.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

for (const { name } of listDrivers('landing')) {
  const conf = quickFixConformance(name, `engine-landing-quick-fix-stale-head-${name}-`);
  const { side, as, project, built, landed } = conf;
  const { started, committed, closed } = steps(conf);
  const [[how, merge]] = Object.entries(side.byHand);

  describe(`the ${name} landing driver's quick-fix, its pull request's head left after its merge by hand by ${how}, the branch it lands on then changed on that fix's lines (R15)`, () => {
    it('never brings the head in: the next fix opens with none of it and lands alone', () => {
      const at = project();
      built(at, 1);
      const head = git(at, ['rev-parse', BRANCH]).trim();
      merge(at, BRANCH);
      const tree = fs.mkdtempSync(path.join(os.tmpdir(), 'quick-fix-elsewhere-'));
      git(side.on(at), ['worktree', 'add', '-q', tree, 'main']);
      createFile(tree, SET[0].file, 'const flag = \'colour\'; // and more\n');
      git(tree, ['commit', '-q', '-am', 'Say more of the flag']);
      git(side.on(at), ['worktree', 'remove', '--force', tree]);
      started(at);
      committed(at, HELP.text);
      ok(at, ['land', 'open', UNIT, '1.2'], as());
      const holds = git(at, ['merge-base', head, BRANCH]).trim() === head;
      ok(at, ['task', 'done', UNIT, '1.2'], as());
      closed(at);

      assert.deepStrictEqual([holds, landed(at).at(-1)], [false, [`fix(${UNIT}): ${DESCRIPTION}`, [HELP.file]]]);
    });
  });
}
