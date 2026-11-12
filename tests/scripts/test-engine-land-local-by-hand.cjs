'use strict';

// ---------------------------------------------------------------------------
// The local landing driver (leeway-engine/scripts/drivers/landing/local/
// driver.cjs) and work landed by hand, read as the one read of what has
// landed reads it (task-landed.cjs, 7.2.22): a phase squashed by hand —
// under the person's own message, git's own squash message, or its task's
// branch squashed alone — a later phase then rewriting its line, answered
// merged by `land phase` and passed by `land finish`, never replayed over
// the later work (R25); a phase squashed by hand, or its task merged by a
// merge commit, answered merged, the review's change drawing it at the
// commit holding its change; a phase's branch holding the person's own
// commit past its tasks, fast-forwarded or merged onto main by hand,
// answered merged already, as the close reads it. Only content decides a landing (R28): a task
// of two commits, its first cherry-picked onto main by hand, its copy
// carrying the door's stamp, has not landed, and `land phase` merges it. A
// task changed after its phase landed is test-engine-land-local-again.cjs's.
// The review's change of tasks of two commits merged by hand after
// another unit's landing, each way in one second, drawn from the commit
// before each to the one holding its change; of a task with the person's
// own commit between its own, or past its last, and a later task cut from
// it, rebased together, their branches kept, each drawn from its own run,
// the person's own copy the earlier's work (`ownersOf`), each task's last
// commit searched for once, and again with the last commit of a task not
// landed beside them, cut before them, the person's own commit past its
// last, and drawn again from the record that read writes, searching
// nothing, the recorded tasks' tips never read whole; of such tasks
// fast-forwarded onto main, the person's own commit on main before them and on the earlier's branch below its
// first commit in neither part, no task's work (R32); of a task merged by
// a merge commit, then the person's own on its branch merged by another,
// one part through both; of two tasks squashed under both their names, the
// later then changed and its commit cherry-picked, each run its own part,
// never overlapping; of a task fast-forwarded, then squashed again beside
// another, then its next commit fast-forwarded, every commit of its drawn,
// the other's squash a part between; and of tasks merged by merge commits, read in the git
// calls two cost, however many (12.14). The driver's stacks are
// test-engine-land-local.cjs's. Git layer: the landing world
// (landing-world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, git, tip, traced, statePath, datedAt, MERGED_BY_HAND } = require('./engine-harness.cjs');
const { TASKS, TRACKER, openArgs, own, cutTask, commitFiles, useLandingWorld, alreadyMoving, finishReady } = require('./landing-world.cjs');

const { changeOf } = require('../../skills/leeway-engine/scripts/domain/review-change.cjs');
const { unitLanded } = require('../../skills/leeway-engine/scripts/domain/task-landed.cjs');
const { projectRepos } = require('../../skills/leeway-engine/scripts/kernel/repos.cjs');
const { workMessage } = require('../../skills/leeway-engine/scripts/domain/commit-task.cjs');

const { card } = TASKS;
const project = useLandingWorld('engine-land-local-by-hand-');

/** `act` done on main, the checkout put on it and taken back. @param {string} dir @param {() => void} act */
function onMain(dir, act) {
  const back = git(dir, ['symbolic-ref', '--short', 'HEAD']).trim();
  git(dir, ['switch', '-q', 'main']);
  act();
  git(dir, ['switch', '-q', back]);
}

/** The review's change, its work not landed read from phases 1 to `phases`, as `read` takes it. @template T @param {string} dir @param {number} phases @param {(change: ReturnType<typeof changeOf>) => T} read */
const changeRead = (dir, phases, read) => read(changeOf(dir, 'pay', phases, null, projectRepos(dir), []));

/** Each landing the change draws, by its subject. @param {ReturnType<typeof changeOf>} change */
const subjects = (change) => change.holding.flatMap(({ parts }) => parts.map(({ landed }) => landed?.subject ?? null));

/** Each part the change draws, by the commits it is read between. @param {ReturnType<typeof changeOf>} change */
const ranges = (change) => change.holding.flatMap(({ parts }) => parts.map(({ from, to }) => [from, to]));

/** Whether task `shown` of the unit has landed on main, as the one read reads it. @param {string} dir @param {string} shown */
const landedNow = (dir, shown) => {
  const [phase, n] = shown.split('.').map(Number);
  return unitLanded(dir, 'pay', projectRepos(dir), null).landed({ unit: 'pay', phase, n });
};

/** What `read` answers, and the searches it makes of whether a line holds a change (`lg.holdChanges`). @template T @param {() => T} read @returns {[T, number]} */
const searching = (read) => {
  const { result, commands } = traced(read);
  return [result, commands.filter((command) => command.startsWith('merge-tree')).length];
};

/** Where tasks 4.1 and 4.2 landed on main, in one read. @param {string} dir */
const bothLandings = (dir) => {
  const read = unitLanded(dir, 'pay', projectRepos(dir), null).on(projectRepos(dir)[0], 'refs/heads/main');
  return [1, 2].map((n) => read.landing({ unit: 'pay', phase: 4, n }));
};

/** What main holds of `file`. @param {string} dir @param {string} file */
const onMainNow = (dir, file) => git(dir, ['show', `main:${file}`]);

describe('land: a phase landed by hand on the local driver, merged as the one read reads it (7.2.22, R25)', () => {
  for (const [how, squash] of /** @type {const} */ ([
    ['under the person\'s own message', [['merge', '-q', '--squash', 'feat/pay-phase-4'], ['commit', '-q', '-m', 'In my own words']]],
    ['under git\'s own squash message', [['merge', '-q', '--squash', 'feat/pay-phase-4'], ['commit', '-q', '--no-edit']]],
    ['its task\'s branch squashed alone, under the person\'s own message', [['merge', '-q', '--squash', 'feat/pay-4.1-add-tip'], ['commit', '-q', '-m', 'In my own words']]],
  ])) {
    it(`a phase whose task of two commits rewrote its own line, squashed by hand ${how}, then a later phase rewriting the line: land phase answers it merged and land finish passes it, never replaying it over the later work`, () => {
      const dir = project();
      const task = cutTask(dir, '4.1', 'feat', 'Add tip', 'main', { 'tip.txt': 'one\ntwo\nthree\n' });
      commitFiles(dir, task.branch, task.branch, { 'tip.txt': 'one\nTWO\nthree\n' });
      ok(dir, openArgs(task));
      onMain(dir, () => squash.forEach((args) => git(dir, [...args])));
      ok(dir, openArgs(cutTask(dir, '5.1', 'feat', 'Quiet two', 'main', { 'tip.txt': 'one\nTwo!\nthree\n' })));
      ok(dir, ['land', 'phase', 'pay', '5']);
      const phase = alreadyMoving(dir, ['land', 'phase', 'pay', '4']);
      finishReady(dir);

      assert.deepStrictEqual([phase, ok(dir, ['land', 'finish', 'pay']), onMainNow(dir, 'tip.txt')], [
        { ok: true, phase: 4, already: true, repos: [], driver: 'local' }, { ok: true, repos: [], driver: 'local' }, 'one\nTwo!\nthree\n',
      ]);
    });
  }

  for (const [how, merged, drawn] of /** @type {const} */ ([
    ['its phase squashed under the person\'s own message', [['merge', '-q', '--squash', 'feat/pay-phase-1'], ['commit', '-q', '-m', 'In my own words']], 'In my own words'],
    ['its task merged by a merge commit', [['merge', '-q', '--no-ff', '-m', 'Merge the card', card.branch]], 'Merge the card'],
  ])) {
    it(`${how}: land phase answers it merged, and the review's change draws it at the commit holding its change`, () => {
      const dir = project();
      ok(dir, openArgs(card));
      onMain(dir, () => merged.forEach((args) => git(dir, [...args])));

      assert.deepStrictEqual([alreadyMoving(dir, ['land', 'phase', 'pay', '1']).repos, changeRead(dir, 1, subjects)], [[], [drawn]]);
    });
  }

  for (const [how, merged] of /** @type {const} */ ([
    ['fast-forwarded', ['merge', '-q', '--ff-only', 'feat/pay-phase-4']],
    ['merged by a merge commit', ['merge', '-q', '--no-ff', '-m', 'Merge the phase', 'feat/pay-phase-4']],
  ])) {
    it(`a phase's tasks opened, the person's own commit made on its branch, then that branch ${how} onto main by hand: land phase answers it merged already, as the close reads its stack merged, moving nothing`, () => {
      const dir = project();
      const first = cutTask(dir, '4.1', 'feat', 'Add tip', 'main', { 'tip.txt': 'tip\n' });
      ok(dir, openArgs(first));
      ok(dir, openArgs(cutTask(dir, '4.2', 'feat', 'Add note', first.branch, { 'note.txt': 'note\n' })));
      commitFiles(dir, 'feat/pay-phase-4', 'feat/pay-phase-4', { 'fix.txt': 'fix\n' }, { message: 'my fix on the phase branch' });
      onMain(dir, () => git(dir, [...merged]));

      assert.deepStrictEqual(alreadyMoving(dir, ['land', 'phase', 'pay', '4']), { ok: true, phase: 4, already: true, repos: [], driver: 'local' });
    });
  }
});

describe('land: only content decides a landing on the local driver, the door\'s stamp never naming one (R28)', () => {
  it('a task of two commits, its first cherry-picked onto main by hand after the second, its copy carrying the stamp: not landed — land phase merges it, main gaining the rest of its work', () => {
    const dir = project();
    const task = cutTask(dir, '4.1', 'feat', 'Add ab', 'main', { 'a.txt': 'a\n' });
    const first = tip(dir, task.branch);
    commitFiles(dir, task.branch, task.branch, { 'b.txt': 'b\n' });
    ok(dir, openArgs(task));
    datedAt(new Date(Date.now() + 60_000).toISOString(), () => onMain(dir, () => git(dir, ['cherry-pick', first])));
    const before = landedNow(dir, '4.1');
    const landed = own(ok(dir, ['land', 'phase', 'pay', '4']));

    assert.deepStrictEqual([before, landed.merged, ['a.txt', 'b.txt'].map((file) => onMainNow(dir, file)), landedNow(dir, '4.1')], [false, ['4.1'], ['a\n', 'b\n'], true]);
  });
});

describe('land: the review\'s change of work landed by hand on the local driver (7.2.22, 12.14)', () => {
  it('its tasks of two commits each merged by hand after another unit\'s landing — by a merge commit, a rebase, its copies carrying their stamps and its branch deleted after, and a squash under the person\'s own message, all in one second: each drawn from the commit before it to the commit on main holding its change, a rebase\'s from before its first copy', () => {
    const dir = project();
    const voucher = commitFiles(dir, 'other-work', 'main', { 'voucher.txt': 'voucher\n' }, { message: workMessage('feat(other): add the voucher', { unit: 'other', phase: 1, n: 2 }) });
    onMain(dir, () => git(dir, ['merge', '-q', '--ff-only', voucher]));
    const branches = Object.keys(MERGED_BY_HAND).map((_, at) => {
      const n = at + 1;
      const { branch } = cutTask(dir, `4.${n}`, 'feat', `Part ${n}`, 'main', { [`part-${n}.txt`]: `${n}\n` });
      commitFiles(dir, branch, branch, { [`part-${n}-more.txt`]: `${n}, more\n` });
      return branch;
    });
    // A minute on from the tasks' own commits, which the world makes now.
    const second = new Date(Date.now() + 60_000).toISOString();
    const drawn = Object.entries(MERGED_BY_HAND).map(([how, merged], at) => {
      const from = tip(dir, 'main');
      datedAt(second, () => onMain(dir, () => merged(dir, branches[at])));
      if (how === 'a rebase') git(dir, ['branch', '-D', branches[at]]);
      return [from, tip(dir, 'main'), git(dir, ['log', '-1', '--format=%s', 'main']).trim()];
    });
    const parts = changeRead(dir, 4, (change) => change.holding.flatMap(({ parts }) => parts.map(({ from, to, landed }) => [from, to, landed?.subject ?? null])));

    assert.deepStrictEqual(parts, drawn);
  });

  it('a task of its commit, the person\'s own and its commit again, and a later task cut from its branch, rebased onto main by hand together, their branches kept: each drawn from its own run — the earlier whole, from the commit before its first copy, the person\'s own copy its work as its branch holds it; the later from the earlier\'s last', () => {
    const dir = project();
    const { branch } = cutTask(dir, '4.1', 'feat', 'Part 1', 'main', { 'part-1.txt': '1\n' });
    commitFiles(dir, branch, branch, { 'mine.txt': 'mine\n' }, { message: 'my own words between' });
    commitFiles(dir, branch, branch, { 'part-1-more.txt': '1, more\n' });
    const later = cutTask(dir, '4.2', 'feat', 'Part 2', branch, { 'part-2.txt': '2\n' });
    const from = tip(dir, 'main');
    datedAt(new Date(Date.now() + 60_000).toISOString(), () => onMain(dir, () => MERGED_BY_HAND['a rebase'](dir, later.branch)));
    const [earlierLast, laterLast] = [tip(dir, 'main~1'), tip(dir, 'main')];

    assert.deepStrictEqual(changeRead(dir, 4, ranges), [[from, earlierLast], [earlierLast, laterLast]]);
  });

  it('a task of its commit and the person\'s own past it, and a later task cut from its branch, rebased onto main by hand together, their branches kept: the earlier drawn through the person\'s own copy past its last commit, its landing\'s run reaching on through its work; the later from that copy — each task\'s last commit searched for once, as reading where they landed searches, and again with the last commit of a task not landed beside them, cut before them, the person\'s own commit past its last, and the earlier\'s tip past it once more, for the record that read writes; the same drawn again from that record, searching nothing, the recorded tasks\' tips never read whole', () => {
    const dir = project();
    const { branch } = cutTask(dir, '4.1', 'feat', 'Part 1', 'main', { 'part-1.txt': '1\n' });
    commitFiles(dir, branch, branch, { 'mine.txt': 'mine\n' }, { message: 'my own words past it' });
    const later = cutTask(dir, '4.2', 'feat', 'Part 2', branch, { 'part-2.txt': '2\n' });
    const from = tip(dir, 'main');
    datedAt(new Date(Date.now() + 60_000).toISOString(), () => onMain(dir, () => MERGED_BY_HAND['a rebase'](dir, later.branch)));
    const [mine, laterLast] = [tip(dir, 'main~1'), tip(dir, 'main')];
    const open = cutTask(dir, '4.3', 'feat', 'Part 3', from, { 'part-3.txt': '3\n' });
    commitFiles(dir, open.branch, open.branch, { 'mine-3.txt': 'mine\n' }, { message: 'my own words past part 3' });

    const [, searched] = searching(() => bothLandings(dir));
    const drawn = [[from, mine], [mine, laterLast]];

    assert.deepStrictEqual([searching(() => changeRead(dir, 4, ranges)), searching(() => changeRead(dir, 4, ranges))], [[drawn, searched + 2], [drawn, 0]]);
  });

  it('a task of its commit, the person\'s own between and its commit again, and a later task cut from its branch, fast-forwarded onto main by hand, the person\'s own commit on main before it and on its branch below its first: each drawn from its own run — the earlier from its first commit through the person\'s own between, the later from the earlier\'s last — the person\'s own on main and below the task\'s first in neither, no task\'s work (R32)', () => {
    const dir = project();
    const hotfix = commitFiles(dir, 'hotfix', 'main', { 'hotfix.txt': 'hotfix\n' }, { message: 'my own hotfix' });
    onMain(dir, () => git(dir, ['merge', '-q', '--ff-only', hotfix]));
    const start = commitFiles(dir, 'feat/pay-4.1-part-1', 'main', { 'start.txt': 'start\n' }, { message: 'my own start' });
    const { branch } = cutTask(dir, '4.1', 'feat', 'Part 1', start, { 'part-1.txt': '1\n' });
    commitFiles(dir, branch, branch, { 'mine.txt': 'mine\n' }, { message: 'my own words between' });
    const earlierLast = commitFiles(dir, branch, branch, { 'part-1-more.txt': '1, more\n' });
    const later = cutTask(dir, '4.2', 'feat', 'Part 2', branch, { 'part-2.txt': '2\n' });
    onMain(dir, () => git(dir, ['merge', '-q', '--ff-only', later.branch]));

    assert.deepStrictEqual(changeRead(dir, 4, ranges), [[start, earlierLast], [earlierLast, tip(dir, 'main')]]);
  });

  it('a task merged onto main by hand by a merge commit, then the person\'s own commit on its branch merged there by another: one part reaching through both, the person\'s own its work (R32)', () => {
    const dir = project();
    const { branch } = cutTask(dir, '4.1', 'feat', 'Part 1', 'main', { 'part-1.txt': '1\n' });
    const from = tip(dir, 'main');
    onMain(dir, () => git(dir, ['merge', '-q', '--no-ff', '-m', 'Merge part 1', branch]));
    commitFiles(dir, branch, branch, { 'mine.txt': 'mine\n' }, { message: 'my own words past it' });
    onMain(dir, () => git(dir, ['merge', '-q', '--no-ff', '-m', 'Merge my own words', branch]));

    assert.deepStrictEqual(changeRead(dir, 4, ranges), [[from, tip(dir, 'main')]]);
  });

  it('two tasks squashed by hand under both their Task: lines, then the later changed and its commit cherry-picked onto main: each run its own part, never overlapping — the earlier the squash, the later from it to the copy', () => {
    const dir = project();
    const first = cutTask(dir, '4.1', 'feat', 'Part 1', 'main', { 'part-1.txt': '1\n' });
    const later = cutTask(dir, '4.2', 'feat', 'Part 2', first.branch, { 'part-2.txt': '2\n' });
    const from = tip(dir, 'main');
    onMain(dir, () => {
      git(dir, ['merge', '-q', '--squash', later.branch]);
      git(dir, ['commit', '-q', '-m', 'feat(pay): Part 1', '-m', 'Task: pay-4-1', '-m', 'feat(pay): Part 2', '-m', 'Task: pay-4-2']);
    });
    const squash = tip(dir, 'main');
    const more = commitFiles(dir, later.branch, later.branch, { 'part-2-more.txt': '2, more\n' });
    datedAt(new Date(Date.now() + 60_000).toISOString(), () => onMain(dir, () => git(dir, ['cherry-pick', more])));

    assert.deepStrictEqual(changeRead(dir, 4, ranges), [[from, squash], [squash, tip(dir, 'main')]]);
  });

  it('a task fast-forwarded onto main by hand, then squashed there again under its Task: line beside another task\'s, then its next commit fast-forwarded: drawn whole — its first commit a part of its own, the squash the other\'s, its next commit a third — none of its own dropped', () => {
    const dir = project();
    const from = tip(dir, 'main');
    const first = cutTask(dir, '4.1', 'feat', 'Part 1', 'main', { 'part-1.txt': '1\n' });
    onMain(dir, () => git(dir, ['merge', '-q', '--ff-only', first.branch]));
    const one = tip(dir, 'main');
    const later = cutTask(dir, '4.2', 'feat', 'Part 2', 'main', { 'part-2.txt': '2\n' });
    onMain(dir, () => {
      git(dir, ['merge', '-q', '--squash', later.branch]);
      git(dir, ['commit', '-q', '-m', 'feat(pay): Part 1', '-m', 'Task: pay-4-1', '-m', 'feat(pay): Part 2', '-m', 'Task: pay-4-2']);
    });
    const squash = tip(dir, 'main');
    const next = commitFiles(dir, first.branch, squash, { 'part-1-more.txt': '1, more\n' });
    onMain(dir, () => git(dir, ['merge', '-q', '--ff-only', next]));

    assert.deepStrictEqual(changeRead(dir, 4, ranges), [[from, one], [one, squash], [squash, next]]);
  });

  it('its tasks done and merged by merge commits: two, six and twelve read in the same git calls, every task\'s last commit read once', () => {
    const dir = project();
    /** @type {number[]} */
    const counts = [];
    /** @type {number[]} */
    const lasts = [];
    for (const [from, to] of [[1, 2], [3, 6], [7, 12]]) {
      for (let n = from; n <= to; n += 1) {
        const task = cutTask(dir, `4.${n}`, 'feat', `Part ${n}`, 'main', { [`part-${n}.txt`]: `${n}\n` });
        onMain(dir, () => git(dir, ['merge', '-q', '--no-ff', '-m', `Merge part ${n}`, task.branch]));
        TRACKER.done(statePath(dir), { unit: 'pay', phase: 4, n });
      }
      const { commands } = traced(() => changeRead(dir, 4, subjects));
      counts.push(commands.length);
      lasts.push(commands.filter((command) => command.includes(' --reflog')).length);
    }

    assert.deepStrictEqual([counts, lasts, changeRead(dir, 4, subjects).length], [counts.map(() => counts[0]), [1, 1, 1], 12]);
  });
});
