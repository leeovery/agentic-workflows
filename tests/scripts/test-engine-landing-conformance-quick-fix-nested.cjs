'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix across nested repositories
// (7.2.24, R16): the contract every landing driver meets where the project
// nests repositories of its own — a submodule and a clone — run through the
// engine's verbs against each shipped driver in turn. A fix lands in every
// repository it touches through one pull request in each, its share there
// committed through the door on the quick-fix's branch cut from the branch
// that repository lands on, never on that branch itself: across the project
// and the clone, children first, each checkout back on the branch it lands
// on; and in the clone alone — done, recorded and landed though the
// project holds none of it. The clone lacking the branch its host holds is
// test-engine-landing-conformance-quick-fix-nested-host.cjs's; a fix in the
// submodule is test-engine-landing-conformance-quick-fix-submodule.cjs's. A
// driver's side (tests/drivers/{name}/landing.cjs) readies each repository
// and reads what landed where; this file names no driver and no tool.
// Conformance layer: quick-fix-world.cjs's `quickFixNestedConformance`,
// built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { git, readManifest } = require('./engine-harness.cjs');
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

    it('a fix in the clone alone is done, recorded and landed there, the project holding none of it', () => {
      const at = project();
      const opened = built(at, 1, { 'lib/lib.txt': 'lib --colour\n' });
      closed(at);

      assert.deepStrictEqual([reposOf(opened), landed(at), readManifest(at.dir, UNIT).status], [
        ['lib'], { '.': [], ext: [], lib: [[ID, ['lib.txt']]] }, 'completed',
      ]);
    });
  });
}
