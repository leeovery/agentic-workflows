'use strict';

// ---------------------------------------------------------------------------
// What the local landing driver (workflow-engine/scripts/drivers/landing/
// local/driver.cjs) records, and the shapes of landing it reads: where each
// task's branch stood when it opened, kept until its phase lands or the task
// is in no stack; a task its phase holds already, or with no commit past the
// chain's tip, refused, and a branch the tip holds, or a fault in another
// stack, counting for nothing; a phase merged on a merge's second parent; a
// change landed by hand opening as a landing that changes nothing; landings
// squashed into one commit, each landing; and the oldest task a stacked
// phase's base lacks named first. Its stacks are test-engine-land-local.cjs's.
// Git layer: the landing world (landing-world.cjs), built once and copied for
// each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, git, tip } = require('./engine-harness.cjs');
const { TASKS, openArgs, commitFiles, mergeBack, landedOn, useLandingWorld, refusedMoving } = require('./landing-world.cjs');

const { card, total, rounding } = TASKS;
const project = useLandingWorld('engine-land-reads-');

/** The argv opening a task the test makes a branch of. @param {string} task @param {string} type @param {string} title */
const open = (task, type, title) => ['land', 'open', 'pay', task, '--type', type, '--title', title];

describe('land: what the local driver records, and the shapes of landing it reads', () => {
  it('records where a task\'s branch stood when it opened, until its phase lands or it is in no stack', () => {
    const dir = project();
    const opened = () => git(dir, ['for-each-ref', '--format=%(refname:lstrip=4) %(objectname)', 'refs/leeway/opened/pay/']).split('\n').filter(Boolean);
    ok(dir, openArgs(card));
    ok(dir, openArgs(rounding));
    assert.deepStrictEqual(opened(), [`1.1 ${tip(dir, card.branch)}`, `2.1 ${tip(dir, rounding.branch)}`]);
    git(dir, ['branch', '-f', 'feat/pay-phase-2', 'main']);
    commitFiles(dir, 'feat/pay-1.4-more', card.branch, { 'more.txt': 'more\n' });
    ok(dir, open('1.4', 'feat', 'More'));
    assert.deepStrictEqual(opened(), [`1.1 ${tip(dir, card.branch)}`, `1.4 ${tip(dir, 'feat/pay-1.4-more')}`]);
    ok(dir, ['land', 'phase', 'pay', '1']);
    assert.deepStrictEqual(opened(), []);
  });

  it('refuses a task its phase holds already, and one with no commit past the chain\'s tip; a branch the tip holds counts for nothing, and a fault in another stack stops no other', () => {
    const dir = project();
    ok(dir, openArgs(card));
    git(dir, ['branch', 'feat/pay-1.6-nothing-yet', card.branch]);
    git(dir, ['branch', 'feat/pay-1.7-early', card.branch]);
    assert.deepStrictEqual([openArgs(card), open('1.6', 'feat', 'Nothing yet')].map((args) => refusedMoving(dir, args)), [
      'land: task 1.1 is in phase 1\'s stack already — there is nothing more to open',
      `land: task 1.6's branch feat/pay-1.6-nothing-yet changes nothing past ${card.branch} — commit its change there first`,
    ]);
    ok(dir, openArgs(rounding));
    commitFiles(dir, 'feat/pay-phase-2', 'feat/pay-phase-2', { 'tidy.txt': 'tidy\n' }, { message: 'my tidy' });
    commitFiles(dir, 'feat/pay-1.5-saved-cards', card.branch, { 'saved.txt': 'saved\n' });
    assert.strictEqual(ok(dir, open('1.5', 'feat', 'Saved cards')).base, card.branch);
  });

  it('counts a phase merged into the default branch on a merge\'s second parent, as a merge by hand or a pull leaves it', () => {
    const dir = project();
    ok(dir, openArgs(rounding));
    git(dir, ['merge', '--no-ff', '-q', '-m', 'merge phase 2 by hand', 'feat/pay-phase-2']);
    commitFiles(dir, 'fix/pay-4.1-round-more', rounding.branch, { 'more.txt': 'more\n' });
    mergeBack(dir, 'fix/pay-4.1-round-more', 'main');
    assert.strictEqual(ok(dir, open('4.1', 'fix', 'Round more')).base, 'main');
    assert.strictEqual(refusedMoving(dir, ['land', 'phase', 'pay', '2']), 'land: phase 2 is merged into main already — there is nothing more to merge');
  });

  it('opens a task whose commits change nothing past the tip — its change landed by hand, merged back — as a landing that changes nothing, and names it', () => {
    const dir = project();
    git(dir, ['checkout', '-q', '-b', 'wip']);
    commitFiles(dir, 'main', 'main', rounding.files, { message: 'round the totals, by hand' });
    mergeBack(dir, rounding.branch, 'main');
    assert.deepStrictEqual(ok(dir, openArgs(rounding)).landed_empty, [{ task: '2.1', why: 'its change was on main already' }]);
    assert.deepStrictEqual(ok(dir, ['land', 'phase', 'pay', '2']).merged, ['2.1']);
    assert.deepStrictEqual(landedOn(dir, 'main').map(({ task, paths }) => [task, paths]), [[null, ['round.txt']], ['pay-2-1', []]]);
  });

  it('lands each task a commit names, where landings were squashed into one, their messages joined — replayed once onto a default branch that moved on', () => {
    const dir = project();
    git(dir, ['checkout', '-q', '-b', 'wip']);
    ok(dir, openArgs(card));
    mergeBack(dir, total.branch, card.branch);
    ok(dir, openArgs(total));
    const tree = git(dir, ['rev-parse', 'feat/pay-phase-1^{tree}']).trim();
    const joined = 'feat(pay): Add card\n\nTask: pay-1-1\n\nfeat(pay): Show total\n\nTask: pay-1-2\n';
    git(dir, ['update-ref', 'refs/heads/feat/pay-phase-1', git(dir, ['commit-tree', tree, '-p', 'main', '-m', joined]).trim()]);
    assert.deepStrictEqual(ok(dir, ['land', 'chain', 'pay', '1.2']).stack, ['1.1', '1.2']);
    assert.strictEqual(refusedMoving(dir, openArgs(card)), 'land: task 1.1 is in phase 1\'s stack already — there is nothing more to open');
    commitFiles(dir, 'main', 'main', { 'other.txt': 'other\n' }, { message: 'other work' });
    assert.deepStrictEqual(ok(dir, ['land', 'phase', 'pay', '1']).merged, ['1.1', '1.2']);
    assert.deepStrictEqual(landedOn(dir, 'main').map(({ subject, paths }) => [subject, paths]), [
      ['other work', ['other.txt']],
      ['feat(pay): Add card', ['card.txt', 'total.txt']],
    ]);
    commitFiles(dir, 'feat/pay-4.1-after', 'main', { 'after.txt': 'after\n' });
    assert.strictEqual(ok(dir, open('4.1', 'feat', 'After')).base, 'main');
  });

  it('names the oldest task a stacked phase\'s base lacks, where the default branch lacks several', () => {
    const dir = project();
    ok(dir, openArgs(rounding));
    commitFiles(dir, 'fix/pay-2.2-round-down', rounding.branch, { 'down.txt': 'down\n' });
    ok(dir, open('2.2', 'fix', 'Round down'));
    commitFiles(dir, 'fix/pay-3.2-currency-down', 'fix/pay-2.2-round-down', { 'cd.txt': 'cd\n' });
    ok(dir, open('3.2', 'fix', 'Currency down'));
    git(dir, ['branch', '-D', 'feat/pay-phase-2']);
    assert.match(refusedMoving(dir, ['land', 'phase', 'pay', '3']), /^land: phase 3 is built on task 2\.1, which main does not hold/);
  });
});
