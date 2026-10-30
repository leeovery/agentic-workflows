'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's refusals across nested repositories
// (7.3.4, 7.2.17, the landing half of 7.S19): the contract every landing
// driver meets where a verb is refused in one repository of a project that
// nests repositories of its own — a submodule and a clone — run through the
// `land` verbs against each shipped driver in turn. A merge refused in one
// repository leaves those before it merged and those after it untouched,
// the refusal naming it and what merged where; landing again merges the
// rest, each once; and a task pinning the submodule where it lands nothing
// then keeps its pin. A task whose branch in one repository does not
// descend from its chain's tip there opens nowhere. The walk itself is
// test-engine-landing-conformance-nested.cjs's. A driver's side
// (tests/drivers/{name}/landing.cjs) readies each repository, refuses a
// merge in one, and reads what landed where; this file names no driver and
// no tool. Conformance layer: the nested world (landing-world.cjs), built
// once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { NESTED, NESTED_TASKS, openArgs, cutTask, commitFiles, nestedConformance } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/workflow-engine/scripts/domain/drivers.cjs');

const { rates, show } = NESTED_TASKS;

for (const { name } of listDrivers('landing')) {
  const { side, project, pointer, ok, refuses, tasksLanded, pointsAtSubmodule } = nestedConformance(name, `engine-landing-nested-refusals-${name}-`);

  describe(`the ${name} landing driver refused across nested repositories (7.2.17, 7.S19)`, () => {
    it('a merge refused in one repository: those before it stand merged and those after it untouched, the refusal naming it and what merged where — and landing again merges the rest, each once; a task pinning the submodule where it lands nothing then keeps its pin', () => {
      const at = project();
      const release = commitFiles(at.ext, 'release', NESTED.ext.into, { 'release.txt': 'release\n' });
      const pin = cutTask(at.dir, '4.1', 'chore', 'Pin ext to its release', 'main', {}, { gitlinks: { [NESTED.ext.folder]: release } });
      for (const task of [rates, show, pin]) ok(at.dir, openArgs(task));
      const { env: refusing, undo } = side.refuseMerge(at.lib);

      assert.match(refuses(at.dir, ['land', 'phase', 'pay', '1'], refusing), /^land: in lib, .+ \(phase 1 merged in ext before it\)$/);
      assert.deepStrictEqual(tasksLanded(at), { '.': [], ext: ['pay-1-1'], lib: [] });
      undo();
      assert.deepStrictEqual(ok(at.dir, ['land', 'phase', 'pay', '1']).repos.map((/** @type {{repo: string}} */ { repo }) => repo), ['lib', '.']);
      assert.ok(pointsAtSubmodule(at), 'phase 1 left the submodule\'s pointer off its default branch');
      ok(at.dir, ['land', 'phase', 'pay', '4']);
      assert.strictEqual(pointer(at), release);
      assert.deepStrictEqual(tasksLanded(at), { '.': ['pay-1-1', 'pay-1-2', 'pay-4-1'], ext: ['pay-1-1'], lib: ['pay-1-1'] });
    });

    it('a task whose branch in one repository does not descend from its chain\'s tip there opens nowhere — refused before anything opens, naming the repository', () => {
      const at = project();
      ok(at.dir, openArgs(rates));
      commitFiles(at.ext, show.branch, rates.branch, { 'ext-show.txt': 'show\n' });
      commitFiles(at.lib, show.branch, NESTED.lib.into, { 'lib-show.txt': 'show\n' });

      assert.match(refuses(at.dir, openArgs(show)), new RegExp(`^land: in lib, task 1\\.2's branch ${show.branch} does not descend from the chain's tip, ${rates.branch} \\(\\w+\\) — merge it back onto ${rates.branch} first$`));
      assert.deepStrictEqual([at.dir, at.ext, at.lib].map(side.opened), [['pay-1-1'], ['pay-1-1'], ['pay-1-1']]);
    });
  });
}
