'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, landed as one pull request
// (19.5.15, 19.S38): the contract every landing driver meets for a
// quick-fix's set of fixes, run through the engine's verbs against each
// shipped driver in turn. Three fixes, built one after another in the
// project's own checkout, each its own commit through the door on the
// quick-fix's one branch, cut from the default branch at the first fix's
// start: the first fix's opening opens the quick-fix's pull request, each
// later one pushing its commit to it, and the close merges it, squashed into
// one commit that names every fix by its `Task:` line, the checkout put back
// on the default branch, holding the landing. A fix done only once its
// commit is in the pull request is test-engine-quick-fix-end.cjs's; the set
// landed only once each fix has ended
// test-engine-landing-conformance-quick-fix-unended.cjs's; the pull request
// merged by hand -by-hand.cjs's and -branch-gone.cjs's; the close itself
// test-engine-quick-fix-close.cjs's. A driver's side
// (tests/drivers/{name}/landing.cjs) readies the world and reads what
// landed where; this file names no driver and no tool. Conformance layer:
// the quick-fix of quick-fix-world.cjs (`quickFixConformance`), built once
// per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, git, tip } = require('./engine-harness.cjs');
const { UNIT, DESCRIPTION, BRANCH, SET, checklistClosed, quickFixConformance } = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

for (const { name } of listDrivers('landing')) {
  const { side, as, project, record, built, landed } = quickFixConformance(name, `engine-landing-quick-fix-${name}-`);

  describe(`the ${name} landing driver's quick-fix, landed as one pull request (19.5.15)`, () => {
    it('19.S38: three fixes, each its own commit on the quick-fix\'s one branch cut from the default branch, land through one pull request — the first opening it, each later one pushing to it — squashed at the close into one commit naming every fix, the checkout back on the default branch', () => {
      const at = project();
      const base = tip(at, 'main');
      const opened = SET.map((_, n) => built(at, n + 1));
      const cut = git(at, ['merge-base', BRANCH, 'main']).trim();
      const own = SET.map((_, n) => git(at, ['log', '--format=%(trailers:key=Leeway-Task,valueonly)', '-1', `${BRANCH}~${SET.length - 1 - n}`]).trim());
      SET.forEach((_, n) => record(at, n + 1));
      checklistClosed(at, as());
      const closed = ok(at, ['finish', 'yes', UNIT], as());
      const message = git(side.on(at), ['log', '-1', '--format=%B', 'main']);

      assert.deepStrictEqual([opened.map(({ branch, already }) => [branch, already]), cut], [SET.map(() => [BRANCH, undefined]), base]);
      assert.deepStrictEqual(own, [`${UNIT}-1-1`, `${UNIT}-1-2`, `${UNIT}-1-3`]);
      assert.deepStrictEqual([closed.landed.map((/** @type {any} */ { repo, merged }) => [repo, merged]), closed.checkout], [[['.', ['1.1', '1.2', '1.3']]], 'main']);
      assert.deepStrictEqual(landed(at), [[`fix(${UNIT}): ${DESCRIPTION}`, SET.map(({ file }) => file).sort()]]);
      assert.deepStrictEqual(message.match(/^Task: .*$/gm), [`Task: ${UNIT}-1-1`, `Task: ${UNIT}-1-2`, `Task: ${UNIT}-1-3`]);
      assert.deepStrictEqual([git(at, ['symbolic-ref', '--short', 'HEAD']).trim(), tip(at, 'main')], ['main', side.defaultTip(at)]);
    });
  });
}
