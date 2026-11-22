'use strict';

// ---------------------------------------------------------------------------
// The landing record of a task whose branch was merged into past its
// landing (task-landed.cjs, `mergedPast`, 7.2.22), against each shipped
// driver in turn. One squashed by hand, then given a commit and the default
// branch merged back, is refused by `land open` before it reads or records
// anything, naming the commit that landed and the way on, its branch made
// again on the default branch with that commit alone; followed, it lands
// it. One squashed by hand and read, the default branch then given a file
// merged into its branch, a fix made on it, and the default branch then
// taking that file out and rewording a line of its own, is refused by
// `land open`, moving nothing, the way on its branch made again on the
// default branch with its own commits since, the merge and what it brought
// in left out; followed, the fix lands and the default branch keeps its own
// later changes. A branch rewritten past its landing is
// test-engine-landing-conformance-record-rewritten.cjs's. Conformance
// layer: the landing world (landing-world.cjs), built once per driver and
// copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const harness = require('./engine-harness.cjs');

const { tip, git, fixtureFrom, cleanupFixture, readManifest, stateGit } = harness;
const { UNIT, TASKS, openArgs, own, commitFiles, mergeBack, buildLanding, followedOn, short } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/ledger-engine/scripts/domain/drivers.cjs');

const { card } = TASKS;

for (const { name } of listDrivers('landing')) {
  /**
   * @type {{
   *   env: Record<string, string|undefined>, prepare: (dir: string) => void, holds: (dir: string) => string[],
   *   squashedHere: (dir: string, branch: string) => void, on: (dir: string) => string, picked: (dir: string, commit: string) => void,
   * }}
   */
  const side = require(path.join(__dirname, '..', 'drivers', name, 'landing.cjs'));
  const as = { env: side.env };
  const ok = (/** @type {string} */ at, /** @type {string[]} */ args) => harness.ok(at, args, as);
  const refused = (/** @type {string} */ at, /** @type {string[]} */ args) => harness.refuses(at, args, as).error;
  const world = fixtureFrom(`engine-landing-record-merged-past-${name}-`, (dir) => {
    buildLanding(dir);
    side.prepare(dir);
  });
  /** @type {string|null} */
  let dir = null;
  afterEach(() => {
    if (dir !== null) cleanupFixture(dir);
    dir = null;
  });
  /** The state branch's newest commit's subject. @param {string} at */
  const lastState = (at) => stateGit(at, ['log', '-1', '--format=%s']).trim();
  /**
   * The refusal of 1.1's branch, whose commit `landed` landed at `landing`,
   * merged into at `merge` past it, its own commit since `mine`.
   * @param {string} at @param {string} merge @param {string} landing @param {string} landed @param {string} mine
   */
  const mergedPast = (at, merge, landing, landed, mine) => {
    const into = side.on(at) === at ? 'main' : 'origin/main';
    return `land: task 1.1's branch ${card.branch} merged ${short(merge)} past its work's landing on main (${short(landing)}), at its commit ${short(landed)}, and nothing is read past a merge — `
      + `make ${card.branch} again on ${into} with its own commits since that one, leaving out the merge and what it brought in, with \`git switch --no-track -C ${card.branch} ${into}\` then \`git cherry-pick ${short(mine)}\`, and open the task with \`land open ${UNIT} 1.1\``;
  };

  describe(`the ${name} landing driver's landing record of a task whose branch was merged into past its landing (7.2.22)`, () => {
    it('a task squashed by hand, then given a commit and the default branch merged back: land open refuses before it reads or records anything, the default branch as it was, naming the commit that landed and the way on, its branch made again on the default branch with that commit alone; followed, land phase lands it', () => {
      const at = (dir = world());
      const landed = tip(at, card.branch);
      side.squashedHere(at, card.branch);
      const landing = tip(at, 'main');
      const more = commitFiles(at, card.branch, card.branch, { 'card-more.txt': 'more\n' });
      mergeBack(at, card.branch, 'main');
      const merge = tip(at, card.branch);
      const before = lastState(at);
      const refusal = refused(at, openArgs(card));
      const stood = [readManifest(at, UNIT).landings, lastState(at) === before, tip(at, 'main')];
      followedOn(at, card.branch, refusal, side.env);
      ok(at, openArgs(card));
      const merged = own(ok(at, ['land', 'phase', UNIT, '1'])).merged;

      assert.deepStrictEqual([refusal, stood, merged, side.holds(at).includes('card-more.txt')], [mergedPast(at, merge, landing, landed, more), [undefined, true, landing], ['1.1'], true]);
    });

    it('a task squashed by hand and read, the default branch then given a file merged into its branch, a fix made on it, and the default branch then taking that file out and rewording a line of its own: land open refuses, moving nothing, naming the merge and the way on — its branch made again on the default branch with the fix alone; followed, land phase lands the fix, the default branch keeping its own later changes', () => {
      const at = (dir = world());
      const landed = tip(at, card.branch);
      side.squashedHere(at, card.branch);
      const landing = tip(at, 'main');
      ok(at, openArgs(card));
      side.picked(at, commitFiles(at, 'aside', 'main', { 'z.txt': 'z\n', 'app.txt': 'app, X\n' }, { message: 'Add z' }));
      mergeBack(at, card.branch, 'main');
      const merge = tip(at, card.branch);
      const fix = commitFiles(at, card.branch, card.branch, { 'card-fix.txt': 'fix\n' });
      side.picked(at, commitFiles(at, 'aside', 'aside', { 'app.txt': 'app, Y\n' }, { removed: ['z.txt'], message: 'Take z out' }));
      const state = () => [readManifest(at, UNIT).landings, lastState(at), tip(at, 'main')];
      const before = state();
      const refusal = refused(at, openArgs(card));
      const stood = state();
      followedOn(at, card.branch, refusal, side.env);
      ok(at, openArgs(card));
      const merged = own(ok(at, ['land', 'phase', UNIT, '1'])).merged;

      assert.deepStrictEqual([refusal, stood, merged, ['z.txt', 'card-fix.txt'].map((file) => side.holds(at).includes(file)), git(side.on(at), ['show', 'main:app.txt'])], [
        mergedPast(at, merge, landing, landed, fix), before, ['1.1'], [false, true], 'app, Y\n',
      ]);
    });
  });
}
