'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite (7.3.1, 7.3.4): the contract every landing
// driver meets, run through the `land` verbs against each shipped driver in
// turn — a task's pull request, a stack in the order its tasks were merged
// back, a phase merged, finish, a task whose branch moved on since it
// opened refused at its phase's merge with the way back, its commits kept
// on a branch, and nothing under `.leeway/` landed (4.S2). After every
// test, the default branch holds nothing under `.leeway/`. The local driver
// runs fully here (7.3.6, 7.S11), and the host's driver against its
// stand-in tool (7.3.7). A driver's own side
// (tests/drivers/{name}/landing.cjs) readies the world for it, names the
// environment every call runs under, and reads what the default branch
// gained and holds; this file names no driver and no tool. Conformance layer: the landing world (landing-world.cjs), built
// once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const harness = require('./engine-harness.cjs');

const { git, tip, fixtureFrom, cleanupFixture } = harness;
const { TASKS, openArgs, commitFiles, mergeBack, buildLanding, followRemedy } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/workflow-engine/scripts/domain/drivers.cjs');

const { card, total, notes, loudNotes, rounding, currency } = TASKS;

/** Whether a path is the state's, in any case of its letters. @param {string} file */
const isState = (file) => /^\.leeway(\/|$)/i.test(file);

for (const { name } of listDrivers('landing')) {
  /** @type {{env: Record<string, string|undefined>, prepare: (dir: string) => void, landed: (dir: string) => {subject: string, task: string|null, paths: string[]}[], holds: (dir: string) => string[]}} */
  const side = require(path.join(__dirname, '..', 'drivers', name, 'landing.cjs'));
  const ok = (/** @type {string} */ at, /** @type {string[]} */ args) => harness.ok(at, args, { env: side.env });
  const refuses = (/** @type {string} */ at, /** @type {string[]} */ args) => harness.refuses(at, args, { env: side.env });
  const world = fixtureFrom(`engine-landing-${name}-`, (dir) => {
    buildLanding(dir);
    side.prepare(dir);
  });

  describe(`the ${name} landing driver`, () => {
    /** @type {string|null} */
    let dir = null;
    afterEach(() => {
      if (dir === null) return;
      const at = dir;
      dir = null;
      try {
        assert.deepStrictEqual(side.holds(at).filter(isState), [], 'the default branch holds the state (4.S2)');
      } finally {
        cleanupFixture(at);
      }
    });

    /** A copy of the world. @returns {string} */
    const project = () => {
      dir = world();
      return dir;
    };

    it('a task\'s pull request: opened from the default branch, and the first of its phase\'s stack', () => {
      const at = project();
      const opened = ok(at, openArgs(card));
      assert.deepStrictEqual({ task: opened.task, branch: opened.branch, base: opened.base, driver: opened.driver }, {
        task: '1.1', branch: card.branch, base: 'main', driver: name,
      });
      assert.deepStrictEqual(ok(at, ['land', 'chain', 'pay', '1.1']).stack, ['1.1']);
    });

    it('a stack, in the order its tasks were merged back: a parallel task refused until it is on the chain\'s tip, named', () => {
      const at = project();
      ok(at, openArgs(total));
      assert.match(refuses(at, openArgs(card)).error, new RegExp(`^land: task 1\\.1's branch ${card.branch} does not descend from the chain's tip, ${total.branch} \\([0-9a-f]{7}\\) — merge it back onto ${total.branch} first$`));
      mergeBack(at, card.branch, total.branch);
      assert.strictEqual(ok(at, openArgs(card)).base, total.branch);
      assert.deepStrictEqual(ok(at, ['land', 'chain', 'pay', '1.1']).stack, ['1.2', '1.1']);
    });

    it('a phase merged: the default branch gains one commit per task, in the stack\'s order, each its own change under its title and id', () => {
      const at = project();
      ok(at, openArgs(total));
      mergeBack(at, card.branch, total.branch);
      ok(at, openArgs(card));
      assert.deepStrictEqual(ok(at, ['land', 'phase', 'pay', '1']).merged, ['1.2', '1.1']);
      assert.deepStrictEqual(side.landed(at), [
        { subject: 'feat(pay): Show total', task: 'pay-1-2', paths: ['total.txt'] },
        { subject: 'feat(pay): Add card', task: 'pay-1-1', paths: ['card.txt'] },
      ]);
    });

    it('phases side by side: each merges onto the default branch as the other left it', () => {
      const at = project();
      ok(at, openArgs(card));
      ok(at, openArgs(rounding));
      ok(at, ['land', 'phase', 'pay', '2']);
      ok(at, ['land', 'phase', 'pay', '1']);
      assert.deepStrictEqual(side.landed(at), [
        { subject: 'fix(pay): Round totals', task: 'pay-2-1', paths: ['round.txt'] },
        { subject: 'feat(pay): Add card', task: 'pay-1-1', paths: ['card.txt'] },
      ]);
    });

    it('finish: the phases still standing land after every other, a phase built on another after it (7.2.6, 7.S10)', () => {
      const at = project();
      ok(at, openArgs(rounding));
      ok(at, openArgs(currency));
      ok(at, openArgs(card));
      ok(at, ['land', 'phase', 'pay', '1']);
      assert.deepStrictEqual(ok(at, ['land', 'finish', 'pay']).phases.map((/** @type {{phase: number}} */ merged) => merged.phase), [2, 3]);
      assert.deepStrictEqual(side.landed(at), [
        { subject: 'feat(pay): Add card', task: 'pay-1-1', paths: ['card.txt'] },
        { subject: 'fix(pay): Round totals', task: 'pay-2-1', paths: ['round.txt'] },
        { subject: 'fix(pay): Name the currency', task: 'pay-3-1', paths: ['currency.txt'] },
      ]);
    });

    it('a task whose branch moved on since it opened: its phase is refused, naming where it opened, keeping what it holds now on a branch and putting it back, and merges once that is done', () => {
      const at = project();
      ok(at, openArgs(card));
      const opened = tip(at, card.branch);
      const moved = commitFiles(at, card.branch, card.branch, { 'card.txt': 'card, fixed\n' });
      const { error } = refuses(at, ['land', 'phase', 'pay', '1']);
      assert.match(error, new RegExp(`^land: task 1\\.1's branch ${card.branch} has moved since it was opened at ${opened.slice(0, 7)}`));
      assert.deepStrictEqual(side.landed(at), []);
      followRemedy(at, error);
      assert.notStrictEqual(git(at, ['branch', '--contains', moved]).trim(), '', 'the moved commit is on no branch');
      ok(at, ['land', 'phase', 'pay', '1']);
      assert.deepStrictEqual(side.landed(at), [{ subject: 'feat(pay): Add card', task: 'pay-1-1', paths: ['card.txt'] }]);
    });

    it('nothing under .leeway/ lands: a task whose change carries the state is refused, and nothing of it lands (4.S2)', () => {
      const at = project();
      assert.strictEqual(refuses(at, openArgs(notes)).error, 'land: task 1.3\'s change carries .leeway/notes.md — the workflows\' state never lands on a code branch, so take it off the task\'s branch and open the task again');
      assert.strictEqual(refuses(at, openArgs(loudNotes)).error, 'land: task 1.9\'s change carries .LEEWAY/notes.md — the workflows\' state never lands on a code branch, so take it off the task\'s branch and open the task again');
      assert.deepStrictEqual(ok(at, ['land', 'finish', 'pay']).phases, []);
      assert.deepStrictEqual(side.landed(at), []);
    });
  });
}
