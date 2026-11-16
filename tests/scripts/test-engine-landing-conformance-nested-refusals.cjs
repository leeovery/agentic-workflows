'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's refusals across nested repositories
// (7.3.4, 7.2.17, the landing half of 7.S19): the contract every landing
// driver meets where a verb is refused in one repository of a project that
// nests clones of its own, run through the `land` verbs against each shipped
// driver in turn. A merge refused in one repository leaves those before it
// merged and those after it untouched, the refusal naming it and what merged
// where; landing again merges the rest, each once. A landing by hand under
// its default message that a merge before the refusal brought to the default
// branch there is left to the next verb's read, the refusal recording only
// what merged before it (landing-record.cjs, 7.2.22). A task whose branch in
// one repository does not descend from its chain's tip there opens nowhere.
// The walk itself is test-engine-landing-conformance-nested.cjs's. A
// driver's side (tests/drivers/{name}/landing.cjs) readies each repository,
// refuses a merge in one, and reads what landed where; this file names no
// driver and no tool. Conformance layer: the nested world
// (landing-world.cjs), built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { NESTED, NESTED_TASKS, openArgs, track, commitFiles, nestedConformance } = require('./landing-world.cjs');
const { git, readManifest } = require('./engine-harness.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const { rates, show } = NESTED_TASKS;

for (const { name } of listDrivers('landing')) {
  const { side, project, ok, refuses, tasksLanded } = nestedConformance(name, `engine-landing-nested-refusals-${name}-`);

  describe(`the ${name} landing driver refused across nested repositories (7.2.17, 7.S19)`, () => {
    it('a merge refused in one repository: those before it stand merged and those after it untouched, the refusal naming it and what merged where — and landing again merges the rest, each once', () => {
      const at = project();
      for (const task of [rates, show]) ok(at.dir, openArgs(task));
      const { env: refusing, undo } = side.refuseMerge(at.lib);

      assert.match(refuses(at.dir, ['land', 'phase', 'pay', '1'], refusing), /^land: in lib, .+ \(phase 1 merged in ext before it\)$/);
      assert.deepStrictEqual(tasksLanded(at), { '.': [], ext: ['pay-1-1'], lib: [] });
      undo();
      assert.deepStrictEqual(ok(at.dir, ['land', 'phase', 'pay', '1']).repos.map((/** @type {{repo: string}} */ { repo }) => repo), ['lib', '.']);
      assert.deepStrictEqual(tasksLanded(at), { '.': ['pay-1-1', 'pay-1-2'], ext: ['pay-1-1'], lib: ['pay-1-1'] });
    });

    it('a merge refused in one repository after one in ext brought there a task\'s landing by hand under its default message: the refusal records only what merged before it, that landing left to the next verb\'s read', () => {
      const at = project();
      const word = track(at.dir, '4.2', 'feat', 'Word ext');
      git(at.dir, ['branch', word.branch, 'main']);
      git(at.lib, ['branch', word.branch, NESTED.lib.into]);
      commitFiles(at.ext, word.branch, NESTED.ext.into, { 'ext-word.txt': 'word\n' });
      for (const task of [word, rates, show]) ok(at.dir, openArgs(task));
      side.byHandUnpulled(at.ext, word.branch);
      const { env: refusing, undo } = side.refuseMerge(at.lib);
      refuses(at.dir, ['land', 'phase', 'pay', '1'], refusing);
      undo();
      const recorded = Object.entries(readManifest(at.dir, 'pay').landings ?? {}).filter(([, byRepo]) => 'ext' in byRepo).map(([id]) => id);

      assert.deepStrictEqual(recorded, ['pay-1-1']);
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
