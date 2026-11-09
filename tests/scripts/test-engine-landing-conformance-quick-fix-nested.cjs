'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix across nested repositories
// (7.2.24, R16): the contract every landing driver meets where the project
// nests repositories of its own — a submodule and a clone — run through the
// engine's verbs against each shipped driver in turn. A fix across the
// project and the clone lands through one pull request in each, the
// clone's share committed through the door on the quick-fix's branch cut
// from the branch that repository lands on, never on that branch itself,
// children first, each checkout back on the branch it lands on. A fix in
// the clone alone is test-engine-landing-conformance-quick-fix-nested-clone.cjs's;
// the clone's branch gone here,
// test-engine-landing-conformance-quick-fix-nested-gone.cjs's,
// -nested-clone-gone, -nested-host and -nested-second-clone's; what marks
// it as touched, -nested-read*'s; a merge by hand in it,
// -nested-by-hand*'s; its move, -nested-move's; a fix in the submodule,
// -submodule*'s. A driver's side
// (tests/drivers/{name}/landing.cjs) readies each repository and reads what
// landed where; this file names no driver and no tool. Conformance layer:
// quick-fix-world.cjs's `quickFixNestedConformance`, built once per driver
// and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { git } = require('./engine-harness.cjs');
const { UNIT, SET, quickFixNestedConformance } = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const ID = `${UNIT}-1-1`;

/** An answer's repositories, each by the name it gives it. @param {{repos: {repo: string}[]}} answer */
const reposOf = (answer) => answer.repos.map(({ repo }) => repo);

for (const { name } of listDrivers('landing')) {
  const { project, built, closed, landed } = quickFixNestedConformance(name, `engine-landing-quick-fix-nested-${name}-`);

  /** Where each checkout stands: the branch it has out. @param {import('./quick-fix-world.cjs').NestedQuickFix} at */
  const out = (at) => [at.dir, at.ext, at.lib].map((dir) => git(dir, ['symbolic-ref', '--short', 'HEAD']).trim());

  describe(`the ${name} landing driver's quick-fix across nested repositories (7.2.24, R16)`, () => {
    it('a fix across the project and the clone lands through a pull request in each, the clone\'s share on the quick-fix\'s branch cut from the branch it lands on, children first, each checkout back on the branch it lands on', () => {
      const at = project();
      const trunk = git(at.lib, ['rev-parse', 'trunk']).trim();
      const opened = built(at, 1, { [SET[0].file]: SET[0].text, 'lib/lib.txt': 'lib --colour\n' });
      const cut = [git(at.lib, ['rev-parse', 'trunk']).trim(), git(at.lib, ['merge-base', 'fix/typo', 'trunk']).trim()];
      const close = closed(at);

      assert.deepStrictEqual([reposOf(opened), cut], [['lib', '.'], [trunk, trunk]]);
      assert.deepStrictEqual([close.landed.map((/** @type {any} */ { repo, merged }) => [repo, merged]), landed(at)], [
        [['lib', ['1.1']], ['.', ['1.1']]], { '.': [[ID, [SET[0].file]]], ext: [], lib: [[ID, ['lib.txt']]] },
      ]);
      assert.deepStrictEqual(out(at), ['main', 'main', 'trunk']);
    });
  });
}
