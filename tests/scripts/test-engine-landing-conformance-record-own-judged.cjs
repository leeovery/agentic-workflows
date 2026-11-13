'use strict';

// ---------------------------------------------------------------------------
// A task cut from another's branch whose landing is judged by its own
// change (task-landed.cjs, `ownJudged`, S3), against each shipped driver in
// turn. Taking back a file of that task's, that task landed by the engine,
// then squashed by hand, its parent's file kept as git's squash reads its
// whole branch: judged by its own change, over that task's tip, it changed
// after its landing, and `land open` and `land phase` land the take-back.
// That task given a commit and merged back into it before either landed,
// both then squashed by hand and never opened: the merge made before its
// landing is never read as past it, its record holding the landing as its
// read set it — `land open` answers already for that task and opens this
// one, and `land phase` lands the take-back. Conformance layer: the
// landing world (landing-world.cjs), built once per driver and copied for
// each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const harness = require('./engine-harness.cjs');

const { fixtureFrom, cleanupFixture } = harness;
const { UNIT, openArgs, own, cutTask, commitFiles, mergeBack, buildLanding } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const PHASE = ['land', 'phase', UNIT, '4'];

for (const { name } of listDrivers('landing')) {
  /** @type {{env: Record<string, string|undefined>, prepare: (dir: string) => void, holds: (dir: string) => string[], squashedHere: (dir: string, branch: string) => void}} */
  const side = require(path.join(__dirname, '..', 'drivers', name, 'landing.cjs'));
  const as = { env: side.env };
  const ok = (/** @type {string} */ at, /** @type {string[]} */ args) => harness.ok(at, args, as);
  const world = fixtureFrom(`engine-landing-record-own-judged-${name}-`, (dir) => {
    buildLanding(dir);
    side.prepare(dir);
  });
  /** @type {string|null} */
  let dir = null;
  afterEach(() => {
    if (dir !== null) cleanupFixture(dir);
    dir = null;
  });
  /** 4.1, writing tip.txt and keep.txt, and 4.2 cut from it, taking tip.txt back, in a world's copy. */
  const chain = () => {
    const at = (dir = world());
    const tip = cutTask(at, '4.1', 'feat', 'Write tip', 'main', { 'tip.txt': 'tip\n', 'keep.txt': 'keep\n' });
    const note = cutTask(at, '4.2', 'feat', 'Take note', tip.branch, { 'note.txt': 'note\n' });
    commitFiles(at, note.branch, note.branch, {}, { removed: ['tip.txt'] });
    return { at, tip, note };
  };

  describe(`the ${name} landing driver's task cut from another's branch, its landing judged by its own change (S3)`, () => {
    it('taking back that task\'s file, that task landed by the engine, then squashed by hand, its parent\'s file kept: changed after its landing, judged by its own change, and land open and land phase land the take-back', () => {
      const { at, tip, note } = chain();
      ok(at, openArgs(tip));
      ok(at, PHASE);
      side.squashedHere(at, note.branch);
      const kept = side.holds(at).includes('tip.txt');
      ok(at, openArgs(note));
      const answer = own(ok(at, PHASE));

      assert.deepStrictEqual([kept, answer.merged, ['tip.txt', 'keep.txt', 'note.txt'].map((file) => side.holds(at).includes(file))], [true, ['4.2'], [false, true, true]]);
    });

    it('taking back that task\'s file, that task then given a commit and merged back into it before either landed, both squashed by hand and never opened: land open answers already for that task and opens this one, never refusing the merge made before its landing, and land phase lands the take-back', () => {
      const { at, tip, note } = chain();
      commitFiles(at, tip.branch, tip.branch, { 'extra.txt': 'extra\n' });
      mergeBack(at, note.branch, tip.branch);
      commitFiles(at, note.branch, note.branch, { 'more.txt': 'more\n' });
      for (const task of [tip, note]) side.squashedHere(at, task.branch);
      const kept = side.holds(at).includes('tip.txt');
      const opened = [tip, note].map((task) => ok(at, openArgs(task)).already ?? false);
      const answer = own(ok(at, PHASE));

      assert.deepStrictEqual([kept, opened, answer.merged, ['tip.txt', 'keep.txt', 'note.txt', 'extra.txt', 'more.txt'].map((file) => side.holds(at).includes(file))], [
        true, [true, false], ['4.2'], [false, true, true, true, true],
      ]);
    });
  });
}
