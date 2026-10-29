'use strict';

// ---------------------------------------------------------------------------
// What the local landing driver (workflow-engine/scripts/drivers/landing/
// local/driver.cjs) records, and the shapes of landing it reads: where each
// task's branch stood when it opened, dropped only when its phase lands, its
// phase's stack begins again without it, or the unit finishes; a task
// landed by hand, which nothing records, passed over; a task its phase
// holds already, or with no commit past the chain's tip, refused, and a
// branch the tip holds, or a fault in another stack, counting for nothing;
// a commit naming tasks of two phases no task of either; a phase merged on
// a merge's second parent; a task whose commits change nothing past the tip
// opening as a landing that changes nothing, and why; landings squashed
// into one commit, each landing; the oldest task a stacked phase's base
// lacks named first; and a subject, title or path the person wrote named
// with no backquote left to open a command. Its stacks are
// test-engine-land-local.cjs's. Git layer: the landing world
// (landing-world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { ok, git, tip, initRepo } = require('./engine-harness.cjs');
const {
  TASKS, openArgs, own, track, cutTask, commitFiles, mergeBack, landedOn, useLandingWorld, refusedMoving, followRemedy, commandsOf, short,
} = require('./landing-world.cjs');

const { card, total, rounding } = TASKS;
const project = useLandingWorld('engine-land-reads-');

describe('land: what the local driver records, and the shapes of landing it reads', () => {
  it('records where a task\'s branch stood when it opened, kept while its phase\'s branch is gone, and dropped when its phase lands — replayed or fast-forwarded — when its phase\'s stack begins again without it, or at finish', () => {
    const dir = project();
    const opened = () => git(dir, ['for-each-ref', '--format=%(refname:lstrip=4) %(objectname)', 'refs/leeway/opened/pay/']).split('\n').filter(Boolean);
    git(dir, ['checkout', '-q', '-b', 'wip']);
    ok(dir, openArgs(card));
    ok(dir, openArgs(rounding));
    assert.deepStrictEqual(opened(), [`1.1 ${tip(dir, card.branch)}`, `2.1 ${tip(dir, rounding.branch)}`]);
    const landing = tip(dir, 'feat/pay-phase-1');
    git(dir, ['branch', '-D', 'feat/pay-phase-1']);
    commitFiles(dir, 'main', 'main', { 'other.txt': 'other\n' }, { message: 'other work' });
    ok(dir, ['land', 'phase', 'pay', '2']);
    assert.deepStrictEqual(opened(), [`1.1 ${tip(dir, card.branch)}`]);
    git(dir, ['branch', 'feat/pay-phase-1', landing]);
    commitFiles(dir, card.branch, card.branch, { 'card.txt': 'card, fixed\n' });
    assert.match(refusedMoving(dir, ['land', 'phase', 'pay', '1']), /^land: task 1\.1's branch feat\/pay-1\.1-add-card has moved since it was opened/);
    git(dir, ['branch', '-f', 'feat/pay-phase-1', 'main']);
    const more = cutTask(dir, '1.4', 'feat', 'More', 'main', { 'more.txt': 'more\n' });
    ok(dir, openArgs(more));
    assert.deepStrictEqual(opened(), [`1.4 ${tip(dir, more.branch)}`]);
    const forward = tip(dir, 'feat/pay-phase-1');
    assert.strictEqual(own(ok(dir, ['land', 'phase', 'pay', '1'])).commit, forward);
    assert.deepStrictEqual(opened(), []);
    ok(dir, openArgs(cutTask(dir, '5.1', 'fix', 'Five', 'main', { 'five.txt': 'five\n' })));
    git(dir, ['branch', '-D', 'feat/pay-phase-5']);
    assert.deepStrictEqual(own(ok(dir, ['land', 'finish', 'pay'])).phases, []);
    assert.deepStrictEqual(opened(), []);
  });

  it('passes over a task landed by hand, which nothing records the opening of: its gone branch is made again at the commit a task holds with its tree, and its phase merges', () => {
    const dir = project();
    commitFiles(dir, 'feat/pay-phase-1', 'main', card.files, { message: 'feat(pay): Add card\n\nTask: pay-1-1\n' });
    const saved = cutTask(dir, '1.5', 'feat', 'Saved cards', card.branch, { 'saved.txt': 'saved\n' });
    const was = tip(dir, card.branch);
    git(dir, ['branch', '-D', card.branch]);
    const gone = refusedMoving(dir, openArgs(saved));
    assert.strictEqual(gone, `land: task 1.1's branch is gone, and phase 1's chain ends at it — make it again with \`git branch ${card.branch} ${short(was)}\` and land again`);
    followRemedy(dir, gone);
    ok(dir, openArgs(saved));
    assert.deepStrictEqual(own(ok(dir, ['land', 'phase', 'pay', '1'])).merged, ['1.1', '1.5']);
  });

  it('takes a commit naming tasks of two phases for no task of its phase', () => {
    const dir = project();
    ok(dir, openArgs(card));
    const both = commitFiles(dir, 'feat/pay-phase-1', 'feat/pay-phase-1', { ...total.files, ...rounding.files }, {
      message: 'feat(pay): Show total\n\nTask: pay-1-2\n\nfix(pay): Round totals\n\nTask: pay-2-1\n',
    });
    assert.match(refusedMoving(dir, ['land', 'chain', 'pay', '1.1']), new RegExp(`^land: feat/pay-phase-1 holds ${short(both)} "feat\\(pay\\): Show total", which is no task of phase 1 — `));
  });

  it('names a subject, title or path the person wrote with each backquote a quote, so its refusal opens no command of theirs', () => {
    const dir = project();
    ok(dir, openArgs(card));
    const top = commitFiles(dir, 'feat/pay-phase-1', 'feat/pay-phase-1', { 'tidy.txt': 'tidy\n' }, { message: 'Rename `card` to `payment`' });
    const stray = refusedMoving(dir, ['land', 'chain', 'pay', '1.1']);
    assert.ok(stray.startsWith(`land: feat/pay-phase-1 holds ${short(top)} "Rename 'card' to 'payment'", which is no task of phase 1 — `), stray);
    assert.deepStrictEqual(commandsOf(stray).map((command) => command.split(' ')[0]), ['git', 'git']);

    for (const [shown, title] of [['1.4', 'Use `rm -rf build` in clean'], ['1.6', 'Bind the ` key']]) {
      const world = project();
      ok(world, openArgs(card));
      const titled = cutTask(world, shown, 'feat', title, card.branch, { 'clean.txt': 'clean\n' });
      ok(world, openArgs(titled));
      const landing = git(world, ['log', '-1', '--format=%B', 'feat/pay-phase-1']);
      const amended = commitFiles(world, 'feat/pay-phase-1', 'feat/pay-phase-1^', { 'clean.txt': 'clean, amended\n' }, { message: landing });
      const changed = refusedMoving(world, openArgs(cutTask(world, '1.5', 'feat', 'Saved cards', titled.branch, { 'saved.txt': 'saved\n' })));
      assert.ok(changed.startsWith(`land: feat/pay-phase-1's commit for task ${shown}, ${short(amended)} "feat(pay): ${title.replace(/`/g, "'")}", has changed since it was opened — `), changed);
      assert.deepStrictEqual(commandsOf(changed).map((command) => command.split(' ')[0]), ['git', 'git'], title);
    }

    const paths = project();
    const carried = cutTask(paths, '1.4', 'feat', 'Carry notes', 'main', { '.leeway/no`tes.md': 'state\n' });
    const vendored = initRepo(path.join(paths, 'vendor', 'li`b'));
    git(vendored, ['commit', '-q', '--allow-empty', '-m', 'lib']);
    git(vendored, ['branch', '-m', 'main', 'trunk']);
    git(vendored, ['branch', card.branch]);
    assert.deepStrictEqual([carried, card].map((task) => refusedMoving(paths, openArgs(task))), [
      'land: task 1.4\'s change carries .leeway/no\'tes.md — the workflows\' state never lands on a code branch, so take it off the task\'s branch and open the task again',
      'land: in vendor/li\'b, no default branch to land on — the remote names none, and the repository has no branch init.defaultBranch names, nor main or master; '
      + 'name it with `git config init.defaultBranch <branch>` there',
    ]);
    ok(paths, openArgs(cutTask(paths, '4.1', 'fix', 'Word the card', 'main', { 'card`s.txt': 'a card\n' })));
    commitFiles(paths, 'main', 'main', { 'card`s.txt': 'main\'s card\n' });
    const conflict = refusedMoving(paths, ['land', 'phase', 'pay', '4']);
    assert.ok(conflict.startsWith('land: task 4.1 conflicts with main at card\'s.txt, so nothing moved — '), conflict);
  });

  it('refuses a task its phase holds already, and one with no commit past the chain\'s tip; a branch the tip holds counts for nothing, and a fault in another stack stops no other', () => {
    const dir = project();
    ok(dir, openArgs(card));
    const nothing = track(dir, '1.6', 'feat', 'Nothing yet');
    git(dir, ['branch', nothing.branch, card.branch]);
    git(dir, ['branch', 'feat/pay-1.7-early', card.branch]);
    assert.deepStrictEqual([openArgs(card), openArgs(nothing)].map((args) => refusedMoving(dir, args)), [
      'land: task 1.1 is in phase 1\'s stack already — there is nothing more to open',
      `land: task 1.6's branch feat/pay-1.6-nothing-yet changes nothing past ${card.branch} — commit its change there first`,
    ]);
    ok(dir, openArgs(rounding));
    commitFiles(dir, 'feat/pay-phase-2', 'feat/pay-phase-2', { 'tidy.txt': 'tidy\n' }, { message: 'my tidy' });
    const saved = cutTask(dir, '1.5', 'feat', 'Saved cards', card.branch, { 'saved.txt': 'saved\n' });
    assert.strictEqual(own(ok(dir, openArgs(saved))).base, card.branch);
  });

  it('counts a phase merged into the default branch on a merge\'s second parent, as a merge by hand or a pull leaves it', () => {
    const dir = project();
    ok(dir, openArgs(rounding));
    git(dir, ['merge', '--no-ff', '-q', '-m', 'merge phase 2 by hand', 'feat/pay-phase-2']);
    const more = cutTask(dir, '4.1', 'fix', 'Round more', rounding.branch, { 'more.txt': 'more\n' });
    mergeBack(dir, more.branch, 'main');
    assert.strictEqual(own(ok(dir, openArgs(more))).base, 'main');
    assert.strictEqual(refusedMoving(dir, ['land', 'phase', 'pay', '2']), 'land: phase 2 is merged into main already — there is nothing more to merge');
  });

  it('opens a task that changes nothing past the tip — its change landed by hand and merged back, or undone by its own commits — as a landing that changes nothing, saying which; replayed, it is no landing found empty', () => {
    const dir = project();
    git(dir, ['checkout', '-q', '-b', 'wip']);
    commitFiles(dir, total.branch, total.branch, {}, { removed: ['total.txt'], message: 'not the total after all' });
    const undone = own(ok(dir, openArgs(total))).landed_empty;
    commitFiles(dir, 'main', 'main', rounding.files, { message: 'round the totals, by hand' });
    mergeBack(dir, rounding.branch, 'main');
    assert.deepStrictEqual([undone, own(ok(dir, openArgs(rounding))).landed_empty], [
      [{ task: '1.2', why: 'its commits change nothing' }],
      [{ task: '2.1', why: 'its change was on main already' }],
    ]);
    const replayed = ['1', '2'].map((phase) => own(ok(dir, ['land', 'phase', 'pay', phase])));
    assert.deepStrictEqual(replayed.map(({ merged, landed_empty }) => [merged, landed_empty]), [[['1.2'], undefined], [['2.1'], undefined]]);
    assert.deepStrictEqual(landedOn(dir, 'main').map(({ task, paths }) => [task, paths]), [[null, ['round.txt']], ['pay-1-2', []], ['pay-2-1', []]]);
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
    assert.deepStrictEqual(own(ok(dir, ['land', 'chain', 'pay', '1.2'])).stack, ['1.1', '1.2']);
    assert.strictEqual(refusedMoving(dir, openArgs(card)), 'land: task 1.1 is in phase 1\'s stack already — there is nothing more to open');
    commitFiles(dir, 'main', 'main', { 'other.txt': 'other\n' }, { message: 'other work' });
    assert.deepStrictEqual(own(ok(dir, ['land', 'phase', 'pay', '1'])).merged, ['1.1', '1.2']);
    assert.deepStrictEqual(landedOn(dir, 'main').map(({ subject, paths }) => [subject, paths]), [
      ['other work', ['other.txt']],
      ['feat(pay): Add card', ['card.txt', 'total.txt']],
    ]);
    assert.strictEqual(own(ok(dir, openArgs(cutTask(dir, '4.1', 'feat', 'After', 'main', { 'after.txt': 'after\n' })))).base, 'main');
  });

  it('names the oldest task a stacked phase\'s base lacks, where the default branch lacks several', () => {
    const dir = project();
    ok(dir, openArgs(rounding));
    const down = cutTask(dir, '2.2', 'fix', 'Round down', rounding.branch, { 'down.txt': 'down\n' });
    ok(dir, openArgs(down));
    ok(dir, openArgs(cutTask(dir, '3.2', 'fix', 'Currency down', down.branch, { 'cd.txt': 'cd\n' })));
    git(dir, ['branch', '-D', 'feat/pay-phase-2']);
    assert.match(refusedMoving(dir, ['land', 'phase', 'pay', '3']), /^land: phase 3 is built on task 2\.1, which main does not hold/);
  });
});
