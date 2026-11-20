'use strict';

// ---------------------------------------------------------------------------
// A task's worktree laid out (ledger-engine/scripts/domain/task-worktree.cjs,
// `task worktree` in task-verbs.cjs; the record on the position, position.cjs
// and conversation.cjs's `taskAt`): run by the builder in the worktree Claude
// Code's isolation made, it makes the task's branch there where the task is
// built on, never where the isolation started — a task of the cut on its
// own phase's chain alone, at its tip in each repository holding it, else
// at the tip of the branch it lands on —
// the isolation's own branch left as it stands, and lays each child
// repository out at its folder on the same branch — at the branch it lands
// on, whatever its checkout is on, a branch made already checked out as it
// stands, a worktree already there on another branch taking it in place as
// the project's own does, switched to where clean — recording the worktree
// against the task, and answering a run again so (12.7.10); a task started
// again after a `/clear` taking its branch over from the clean worktree it
// was built in before, that worktree's child repositories' worktrees
// removed and it detached, and refused, naming why, where that worktree
// holds changes not committed or is a task's in flight in this
// conversation, whose builder the orchestrator sends back in; a
// branch out in a worktree whose folder is gone, or in a repository's own
// checkout, refused with the way on, which lays it out once followed; every
// refusal making nothing. Git layer: the task worktree world (task-worktree-world.cjs),
// built once and copied for each test, an isolation's worktree beside the
// project for each builder; a task of the cut made on its own phase's
// chain alone, never on another phase's work not landed, while one of the
// review's fix phases is made on the unit's work not landed below it
// (7.2.6). The layout made holding the writer lock; the steps that prepare
// the environment run in the project's folder of the worktree once it is
// laid out, after the include is copied, with the writer lock let go —
// those for each worktree and for both, never those for the build's first
// task nor a note — none again once all have passed there, the marker in
// the worktree's git directory, a failure refusing with the step's exit
// code and output and run again by the call after, and a call while
// another runs them refused (22.5.1, 22.S35). A task stays in flight once
// boot routes the conversation's words, its worktree laid out after
// (24.2.4). Taking the worktree apart as the task ends, and
// tasks side by side: test-engine-task-worktree-end.cjs.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  ok, refuses, git, tip, createFile, initRepo, statePath, commitAll, confirmEnvironment, holdLock, lockAttempts, layout, FROZEN_AT,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { NESTED, NESTED_TASKS, TRACKER, commitFiles, followRemedy } = require('./landing-world.cjs');
const { readPosition, tasksInFlight } = require('../../skills/ledger-engine/scripts/domain/conversation.cjs');
const { laidOutOf } = require('../../skills/ledger-engine/scripts/domain/round-report.cjs');
const {
  SIDE, UNIT, FEES, SHOW, CAP, taskWorktreeWorld, as, building, isolation, layOut, layOutOrRefusal, madeIn, checkoutsOf,
} = require('./task-worktree-world.cjs');

const { rates, cache } = NESTED_TASKS;
const project = taskWorktreeWorld('engine-task-worktree-');

/** A cut of two phases, so phase 3 is the review's fixes of round 1 once both have closed, as their closes record it. */
const CUT = Object.freeze({
  phases: [1, 2].map((phase) => ({ name: `Phase ${phase}`, goal: 'Fees are charged.', scenarios: [], sections: [String(phase)], relies_on: [] })),
});
const CUT_CLOSED = Object.fromEntries([1, 2].flatMap((phase) => ['start', 'close'].map((at) => [`phase-${phase}-${at}`, { items: {}, closed: FROZEN_AT }])));

/**
 * Task 3.1 laid out at `tree`, each refusal's way on followed from the
 * project until it lays out: the refusals, in order.
 * @param {string} dir @param {string} tree @param {string} session
 */
function followingRemedies(dir, tree, session) {
  const refusals = [];
  for (let tries = 0; tries < 4; tries += 1) {
    const res = layOutOrRefusal(tree, session);
    if (res.error === undefined) break;
    refusals.push(res.error);
    followRemedy(dir, res.error);
  }
  return refusals;
}

describe('task worktree: every repository laid out (12.7.10, 7.2.21)', () => {
  it('makes the task\'s branch in place and lays each child repository out on it — at the branch it lands on, its checkout on a branch of its own — recording the worktree against the task and the commit each repository was laid out at, the isolation\'s branch left as it stands', () => {
    const at = project();
    git(at.ext, ['checkout', '-q', rates.branch]);
    git(at.lib, ['checkout', '-q', cache.branch]);
    const session = building(at.dir, ['3.1']);
    const tree = isolation(at.dir, 'a');
    const was = { head: tip(tree, 'HEAD'), status: git(tree, ['status', '--porcelain']) };

    const answer = ok(tree, layOut('3.1'), as(session));

    assert.deepStrictEqual(answer, {
      ok: true, task: '3.1', id: 'pay-3-1', branch: FEES, worktree: tree,
      repos: [{ repo: '.', path: tree }, { repo: 'ext', path: path.join(tree, 'ext') }, { repo: 'lib', path: path.join(tree, 'lib') }],
      recorded: true,
    });
    assert.deepStrictEqual(checkoutsOf(tree), [[FEES, was.head], [FEES, tip(at.ext, NESTED.ext.into)], [FEES, tip(at.lib, NESTED.lib.into)]]);
    for (const [clone, { into }] of [[at.ext, NESTED.ext], [at.lib, NESTED.lib]]) assert.notStrictEqual(tip(clone, into), tip(clone, 'HEAD'), 'the clone\'s own checkout is elsewhere');
    assert.deepStrictEqual([tip(at.dir, 'worktree-agent-a'), git(tree, ['status', '--porcelain'])], [was.head, was.status]);
    assert.deepStrictEqual(readPosition(session)?.tasks, [{ task: '3.1', builder: null, reviewers: [], worktree: tree }]);
    assert.deepStrictEqual(laidOutOf(at.dir, { unit: UNIT, phase: 3, n: 1 }), { '': was.head, ext: tip(at.ext, NESTED.ext.into), lib: tip(at.lib, NESTED.lib.into) });
  });

  it('12.7.10: lays a task of the cut out on its own phase\'s chain alone, never where the isolation started nor on another phase\'s work not landed — with nothing of its phase chained, at the tip of the branch each repository lands on; then at its chain\'s tip, so a phase relying on nothing unfinished, started beside one still open whose review\'s fix then moves its chain, lays its next task out with no refusal', () => {
    const at = project();
    const { show } = NESTED_TASKS;
    for (const n of [1, 2]) TRACKER.done(statePath(at.dir), { unit: UNIT, phase: 1, n });
    commitAll(at.dir, 'phase 1 done, at its review, none landed');
    const session = building(at.dir, ['3.1', '3.2']);
    const [a, b] = ['a', 'b'].map((name) => isolation(at.dir, name));
    const started = tip(a, 'HEAD');
    createFile(at.dir, 'later.txt', 'later\n');
    commitAll(at.dir, 'the branch the project lands on moves on');

    ok(a, layOut('3.1'), as(session));
    const first = checkoutsOf(a);
    createFile(a, 'fees.txt', 'fees\n');
    git(a, ['add', 'fees.txt']);
    git(a, ['commit', '-q', '-m', 'add fees']);
    TRACKER.done(statePath(at.dir), { unit: UNIT, phase: 3, n: 1 });
    commitAll(at.dir, 'task 3.1 chained');
    commitFiles(at.dir, show.branch, show.branch, { 'show-fix.txt': 'fixed\n' });
    ok(b, layOut('3.2'), as(session));

    assert.notStrictEqual(started, tip(at.dir, 'main'), 'the isolation started behind the branch the project lands on');
    assert.deepStrictEqual(first, [[FEES, tip(at.dir, 'main')], [FEES, tip(at.ext, NESTED.ext.into)], [FEES, tip(at.lib, NESTED.lib.into)]]);
    assert.deepStrictEqual(checkoutsOf(b), [[SHOW, tip(at.dir, FEES)], [SHOW, tip(at.ext, NESTED.ext.into)], [SHOW, tip(at.lib, NESTED.lib.into)]]);
  });

  it('makes a task of one of the review\'s fix phases on the unit\'s work not landed below it, at that work\'s tip in each repository holding it — refused, making nothing, where the worktree has changes not committed (7.2.6)', () => {
    const at = project();
    const { show } = NESTED_TASKS;
    createManifest(at.dir, UNIT, { build: { position: 'auto' }, cut: CUT, checklists: CUT_CLOSED });
    for (const n of [1, 2]) TRACKER.done(statePath(at.dir), { unit: UNIT, phase: 1, n });
    TRACKER.close(statePath(at.dir), { unit: UNIT, phase: 2, n: 1 }, 'not needed');
    commitAll(at.dir, 'the cut closed, its work not landed');
    const session = building(at.dir, ['3.1']);
    const [a, b] = ['a', 'b'].map((name) => isolation(at.dir, name));
    createFile(b, 'app.txt', 'my edit\n');
    const before = madeIn(at);

    const dirty = refuses(b, layOut('3.1'), as(session)).error;
    const refused = madeIn(at);
    ok(a, layOut('3.1'), as(session));

    assert.strictEqual(dirty, `task worktree: ${FEES} is made at ${tip(at.dir, show.branch).slice(0, 7)}, where the task is built on, and ${b} has changes not committed: app.txt, so nothing was laid out — commit them, or move them out of the way, then run it again`);
    assert.deepStrictEqual(refused, before);
    assert.deepStrictEqual(checkoutsOf(a), [[FEES, tip(at.dir, show.branch)], [FEES, tip(at.ext, rates.branch)], [FEES, tip(at.lib, rates.branch)]]);
  });

  it('prepares each child repository it lays out as Claude Code prepares the root: the ignored files its own .worktreeinclude names copied, and the directories the project\'s settings name in worktree.symlinkDirectories linked', () => {
    const at = project();
    for (const [file, text] of Object.entries({ '.gitignore': '.env\n.secret\nvendor/\n', '.worktreeinclude': '.secret\n', '.env': 'LIB=1\n', '.secret': 'SECRET=1\n', 'vendor/kit.txt': 'kit\n' })) createFile(at.lib, file, text);
    createFile(at.dir, '.claude/settings.local.json', JSON.stringify({ worktree: { symlinkDirectories: ['vendor'] } }));
    const session = building(at.dir, ['3.1']);
    const tree = isolation(at.dir, 'a');

    ok(tree, layOut('3.1'), as(session));

    const lib = path.join(tree, 'lib');
    assert.deepStrictEqual(
      [fs.readFileSync(path.join(lib, '.secret'), 'utf8'), fs.existsSync(path.join(lib, '.env')), fs.lstatSync(path.join(lib, 'vendor')).isSymbolicLink(), fs.realpathSync(path.join(lib, 'vendor'))],
      ['SECRET=1\n', false, true, fs.realpathSync(path.join(at.lib, 'vendor'))],
    );
  });

  it('13.3.4: lays a one-line task out from the project\'s checkout in the engine\'s own layout, every repository on its branch and prepared as Claude Code prepares an isolation worktree; answers it laid out already run again; and takes it apart as the task ends, refused while it holds changes not committed', () => {
    const at = project();
    for (const [file, text] of Object.entries({ '.gitignore': '.secret\nvendor/\n', '.worktreeinclude': '.secret\n', '.secret': 'SECRET=1\n', 'vendor/kit.txt': 'kit\n' })) createFile(at.lib, file, text);
    git(at.lib, ['add', '.gitignore', '.worktreeinclude']);
    git(at.lib, ['commit', '-q', '-m', 'ignore the secret']);
    createFile(at.dir, '.claude/settings.local.json', JSON.stringify({ worktree: { symlinkDirectories: ['vendor'] } }));
    const { task } = ok(at.dir, ['task', 'create', UNIT, '3', '--title', 'Bold the fee', '--type', 'feat', '--why', 'one word, nothing for a reviewer to read']);
    const session = building(at.dir, [task]);

    const laid = ok(at.dir, layOut(task), as(session));
    const top = path.join(fs.realpathSync(at.dir), '.claude', 'worktrees', `ledger-${UNIT}-${task}`);
    const lib = path.join(top, 'lib');
    assert.deepStrictEqual([fs.realpathSync(laid.worktree), laid.repos.map(({ repo, already }) => [repo, already ?? false])], [top, [['.', false], ['ext', false], ['lib', false]]]);
    assert.deepStrictEqual(checkoutsOf(top).map(([branch]) => branch), [laid.branch, laid.branch, laid.branch]);
    assert.deepStrictEqual([fs.readFileSync(path.join(lib, '.secret'), 'utf8'), fs.lstatSync(path.join(lib, 'vendor')).isSymbolicLink()], ['SECRET=1\n', true]);
    assert.deepStrictEqual(ok(at.dir, layOut(task), as(session)).repos.map(({ already }) => already), [true, true, true]);

    createFile(lib, 'loose.txt', 'not committed\n');
    assert.match(refuses(at.dir, ['task', 'close', UNIT, task, '--reason', 'Not needed.'], as(session)).error, /^task close: .*\/lib holds changes not committed: loose\.txt, so nothing moved/);
    fs.rmSync(path.join(lib, 'loose.txt'));
    ok(at.dir, ['task', 'close', UNIT, task, '--reason', 'Not needed.'], as(session));
    assert.ok(!fs.existsSync(top), 'its layout taken apart');
    assert.ok(git(at.dir, ['branch', '--list', laid.branch]).includes(laid.branch), 'its branch kept');
  });

  it('answers each repository laid out already where it is run again, making nothing', () => {
    const at = project();
    const session = building(at.dir, ['3.1']);
    const tree = isolation(at.dir, 'a');
    ok(tree, layOut('3.1'), as(session));
    const before = madeIn(at);

    assert.deepStrictEqual(ok(tree, layOut('3.1'), as(session)).repos.map(({ repo, already }) => [repo, already]), [['.', true], ['ext', true], ['lib', true]]);
    assert.deepStrictEqual(madeIn(at), before);
  });

  it('checks a child repository\'s branch made already, and out nowhere, out as it stands', () => {
    const at = project();
    git(at.lib, ['branch', FEES, cache.branch]);
    const session = building(at.dir, ['3.1']);
    const tree = isolation(at.dir, 'a');

    ok(tree, layOut('3.1'), as(session));

    assert.deepStrictEqual(checkoutsOf(tree)[2], [FEES, tip(at.lib, cache.branch)]);
  });

  it('lays out only the folder of a larger repository the project is, a clone in it at the branch it lands on (7.2.17)', () => {
    const at = project();
    createFile(at.dir, 'app/app.txt', 'app\n');
    commitAll(at.dir, 'the app');
    const deep = initRepo(path.join(at.dir, 'app', 'deep'));
    git(deep, ['commit', '-q', '--allow-empty', '-m', 'deep']);
    git(deep, ['checkout', '-q', '-b', 'mine']);
    git(deep, ['commit', '-q', '--allow-empty', '-m', 'past the branch it lands on']);
    const session = building(at.dir, ['3.1']);
    const tree = isolation(at.dir, 'a');
    const app = path.join(tree, 'app');

    const answer = ok(app, layOut('3.1'), as(session));

    assert.deepStrictEqual([answer.worktree, answer.repos], [tree, [{ repo: '.', path: app }, { repo: 'deep', path: path.join(app, 'deep') }]]);
    assert.deepStrictEqual(checkoutsOf(app, ['.', 'deep'])[1], [FEES, tip(deep, 'main')]);
  });

  it('refuses, making nothing: no conversation, the task not in flight, the project\'s own checkout, another task\'s worktree, a task with no type, its branch made already where this worktree has changes not committed or out in another worktree, a child\'s folder holding something else', () => {
    const at = project();
    SIDE.makeTask(statePath(at.dir), 'Round fees', { unit: UNIT, phase: 3, n: 5 });
    const session = building(at.dir, ['3.1', '3.2', '3.3', '3.5']);
    const [a, b, c, d, e] = ['a', 'b', 'c', 'd', 'e'].map((name) => isolation(at.dir, name));
    git(at.lib, ['worktree', 'add', '-q', '-b', 'unmounted', path.join(e, NESTED.lib.folder), NESTED.lib.into]);
    fs.rmSync(path.join(e, NESTED.lib.folder), { recursive: true });
    ok(a, layOut('3.1'), as(session));
    git(at.dir, ['branch', SHOW, 'main']);
    createFile(b, 'app.txt', 'my edit\n');
    fs.mkdirSync(path.join(c, NESTED.lib.folder));
    createFile(c, `${NESTED.lib.folder}/mine.txt`, 'mine\n');
    const stray = path.join(path.dirname(a), 'lib-tree');
    git(at.lib, ['worktree', 'add', '-q', '-b', CAP, stray, NESTED.lib.into]);
    const before = madeIn(at);

    const refusals = [
      [b, layOut('3.1'), {}],
      [b, layOut('3.4'), as(session)],
      [at.dir, layOut('3.1'), as(session)],
      [a, layOut('3.2'), as(session)],
      [b, layOut('3.5'), as(session)],
      [b, layOut('3.2'), as(session)],
      [b, layOut('3.1'), as(session)],
      [c, layOut('3.3'), as(session)],
      [d, layOut('3.3'), as(session)],
      [e, layOut('3.3'), as(session)],
    ].map(([cwd, args, opts]) => refuses(/** @type {string} */ (cwd), /** @type {string[]} */ (args), /** @type {object} */ (opts)).error);

    assert.deepStrictEqual(refusals, [
      'task worktree: no conversation is named, so no task is in flight — CLAUDE_CODE_SESSION_ID is unset; run it from the Claude Code conversation building the task',
      'task worktree: task 3.4 of pay is not in flight in this conversation — start it with `engine task start pay 3.4`, then run it again',
      `task worktree: ${fs.realpathSync(at.dir)} is the project's own checkout — run it in the worktree made for task 3.1 of pay`,
      `task worktree: this worktree, ${a}, is task 3.1 of pay's — build task 3.2 of pay in a worktree of its own`,
      'task worktree: task 3.5 of pay has no type in the tracker, and its branch is named from it — give it one with `engine task type pay 3.5 <type>`, then run it again',
      `task worktree: ${SHOW} is made already, and ${b} has changes not committed: app.txt, so nothing was laid out — commit them, or move them out of the way, then run it again`,
      `task worktree: task 3.1 of pay's branch ${FEES} is checked out at ${a}, where task 3.1 of pay is in flight in this conversation, so it is never taken over — stop, and report it: the orchestrator sends the builder of task 3.1 of pay back in, to carry on at ${a}`,
      'task worktree: lib in this worktree holds something other than a worktree of lib — move it out of the way, then run it again',
      `task worktree: task 3.3 of pay's branch ${CAP} is checked out in lib at ${stray} — build the task there`,
      `task worktree: lib in this worktree is a worktree of lib, at ${path.join(e, 'lib')}, whose folder is missing — remove that worktree with \`git -C ${fs.realpathSync(at.lib)} worktree remove ${path.join(e, 'lib')}\`, then run it again`,
    ]);
    assert.deepStrictEqual(madeIn(at), before);
  });

  it('takes the branch in place where a worktree is on another branch, the project\'s own and a child\'s alike — made where the task is built on, or, made already and out nowhere, switched to where the worktree is clean', () => {
    const at = project();
    const session = building(at.dir, ['3.1', '3.2']);
    git(at.dir, ['branch', FEES, rates.branch]);
    git(at.lib, ['branch', SHOW, cache.branch]);
    const [a, b] = ['a', 'b'].map((name) => isolation(at.dir, name));
    git(at.lib, ['worktree', 'add', '-q', '-b', 'mine', path.join(a, NESTED.lib.folder), cache.branch]);
    git(at.lib, ['worktree', 'add', '-q', '-b', 'yours', path.join(b, NESTED.lib.folder), NESTED.lib.into]);
    createFile(b, 'lib/lib.txt', 'my edit\n');

    ok(a, layOut('3.1'), as(session));
    const dirty = refuses(b, layOut('3.2'), as(session)).error;
    git(path.join(b, NESTED.lib.folder), ['checkout', '--', 'lib.txt']);
    ok(b, layOut('3.2'), as(session));

    assert.deepStrictEqual(checkoutsOf(a), [[FEES, tip(at.dir, rates.branch)], [FEES, tip(at.ext, NESTED.ext.into)], [FEES, tip(at.lib, NESTED.lib.into)]]);
    assert.strictEqual(dirty, `task worktree: ${SHOW} is made already, and ${path.join(b, 'lib')} has changes not committed: lib.txt, so nothing was laid out — commit them, or move them out of the way, then run it again`);
    assert.deepStrictEqual(checkoutsOf(b)[2], [SHOW, tip(at.lib, cache.branch)]);
  });

  it('a task started again after a /clear takes its branch over from the worktree it was built in before — refused, naming why and making nothing, while that worktree or a child repository\'s worktree in it holds changes not committed; then each child repository\'s worktree there removed, that worktree detached at its own commit with nothing moved — and is laid out here on the work committed there', () => {
    const at = project();
    const first = building(at.dir, ['3.1']);
    const a = isolation(at.dir, 'a');
    ok(a, layOut('3.1'), as(first));
    createFile(a, 'fees.txt', 'fees\n');
    createFile(a, 'lib/lib-fees.txt', 'fees\n');
    ok(a, ['commit', '--paths', 'fees.txt', 'lib/lib-fees.txt', '--task', UNIT, '3.1', '-m', 'feat(pay): add fees'], as(first));
    const built = { project: tip(a, 'HEAD'), lib: tip(path.join(a, 'lib'), 'HEAD') };
    const session = building(at.dir, ['3.1']);
    const b = isolation(at.dir, 'b');
    createFile(a, 'mine.txt', 'mine\n');
    createFile(a, 'lib/left.txt', 'left\n');
    const before = madeIn(at);

    const { error } = refuses(b, layOut('3.1'), as(session));
    const refused = madeIn(at);
    fs.rmSync(path.join(a, 'mine.txt'));
    fs.rmSync(path.join(a, 'lib', 'left.txt'));
    const answer = ok(b, layOut('3.1'), as(session));

    assert.strictEqual(error, `task worktree: task 3.1 of pay's branch ${FEES} is checked out at ${a}, with changes not committed — ${a}: mine.txt; ${path.join(a, 'lib')}: left.txt — so it was not taken over, and nothing was laid out — commit them, or move them out of the way, then run it again`);
    assert.deepStrictEqual(refused, before);

    assert.deepStrictEqual(answer.taken_over, { worktree: a, removed: [path.join(a, 'ext'), path.join(a, 'lib')] });
    assert.deepStrictEqual(checkoutsOf(b), [[FEES, built.project], [FEES, tip(at.ext, FEES)], [FEES, built.lib]]);
    assert.deepStrictEqual([git(a, ['rev-parse', '--abbrev-ref', 'HEAD']).trim(), tip(a, 'HEAD'), git(a, ['status', '--porcelain'])], ['HEAD', built.project, '']);
    assert.deepStrictEqual(['ext', 'lib'].map((folder) => fs.existsSync(path.join(a, folder))), [false, false]);
    assert.deepStrictEqual(readPosition(session)?.tasks, [{ task: '3.1', builder: null, reviewers: [], worktree: b }]);
  });

  it('7.2.17: in a project that is a folder of a larger repository, a worktree is read at the project\'s folder alone — its branch made already where that folder holds changes not committed refused, a change beside the folder passed over; and a /clear\'s take-over passes a change outside the folder and the project\'s own untracked clone in it, refusing a change inside it, named from the folder', () => {
    const at = project();
    createFile(at.dir, 'app/readme.txt', 'app\n');
    createFile(at.dir, 'pnpm-lock.yaml', 'lock: 1\n');
    commitAll(at.dir, 'the app, and the repository\'s lockfile');
    const svc = initRepo(path.join(at.dir, 'app', 'svc'));
    createFile(svc, 'svc.txt', 'svc\n');
    git(svc, ['add', 'svc.txt']);
    git(svc, ['commit', '-q', '-m', 'svc']);
    git(at.dir, ['branch', SHOW, 'main']);
    const first = building(at.dir, ['3.1', '3.2']);
    const [a, c] = ['a', 'c'].map((name) => isolation(at.dir, name));
    createFile(c, 'app/mine.txt', 'mine\n');
    createFile(c, 'pnpm-lock.yaml', 'lock: 3\n');
    const madeAlready = refuses(path.join(c, 'app'), layOut('3.2'), as(first)).error;
    ok(path.join(a, 'app'), layOut('3.1'), as(first));
    createFile(a, 'pnpm-lock.yaml', 'lock: 2\n');
    createFile(a, 'app/mine.txt', 'mine\n');
    const session = building(at.dir, ['3.1']);
    const b = isolation(at.dir, 'b');

    const inside = refuses(path.join(b, 'app'), layOut('3.1'), as(session)).error;
    fs.rmSync(path.join(a, 'app', 'mine.txt'));
    const answer = ok(path.join(b, 'app'), layOut('3.1'), as(session));

    assert.deepStrictEqual([madeAlready, inside], [
      `task worktree: ${SHOW} is made already, and ${path.join(c, 'app')} has changes not committed: mine.txt, so nothing was laid out — commit them, or move them out of the way, then run it again`,
      `task worktree: task 3.1 of pay's branch ${FEES} is checked out at ${a}, with changes not committed — ${path.join(a, 'app')}: mine.txt — so it was not taken over, and nothing was laid out — commit them, or move them out of the way, then run it again`,
    ]);
    assert.deepStrictEqual(answer.taken_over, { worktree: a, removed: [path.join(a, 'app', 'svc')] });
  });

  it('names a branch held by a worktree whose folder is gone, the way on removing it as the landing\'s remedy does — and lays out once each is followed', () => {
    const at = project();
    const session = building(at.dir, ['3.1']);
    const a = isolation(at.dir, 'a');
    ok(a, layOut('3.1'), as(session));
    fs.renameSync(a, `${a} unmounted`);
    const b = isolation(at.dir, 'b');
    const [ext, lib] = [at.ext, at.lib].map((repo) => fs.realpathSync(repo));

    const refusals = followingRemedies(at.dir, b, session);

    const gone = (/** @type {string} */ where, /** @type {string} */ tree, /** @type {string} */ command) => `task worktree: task 3.1 of pay's branch ${FEES} is checked out${where} at ${tree}, whose folder is missing — remove that worktree with \`${command}\`, then run it again`;
    assert.deepStrictEqual(refusals, [
      gone('', a, `git worktree remove ${a}`),
      gone(' in ext', path.join(a, 'ext'), `git -C ${ext} worktree remove ${path.join(a, 'ext')}`),
      gone(' in lib', path.join(a, 'lib'), `git -C ${lib} worktree remove ${path.join(a, 'lib')}`),
    ]);
    assert.deepStrictEqual(checkoutsOf(b).map(([branch]) => branch), [FEES, FEES, FEES]);
  });

  it('names a branch out in a repository\'s own checkout — the project\'s, or a child\'s, as a person trying the branch leaves it — the way on switching it off there, and lays out once each is followed', () => {
    const at = project();
    git(at.dir, ['checkout', '-q', '-b', FEES]);
    git(at.lib, ['checkout', '-q', '-b', FEES, NESTED.lib.into]);
    const session = building(at.dir, ['3.1']);
    const b = isolation(at.dir, 'b');
    const [dir, lib] = [at.dir, at.lib].map((repo) => fs.realpathSync(repo));

    const refusals = followingRemedies(at.dir, b, session);

    const own = (/** @type {string} */ where, /** @type {string} */ tree) => `task worktree: task 3.1 of pay's branch ${FEES} is checked out${where} at ${tree}, its own checkout — check out another branch there, as \`git -C ${tree} switch --detach\` does, then run it again`;
    assert.deepStrictEqual(refusals, [own('', dir), own(' in lib', lib)]);
    assert.deepStrictEqual(checkoutsOf(b).map(([branch]) => branch), [FEES, FEES, FEES]);
  });
});

describe('task worktree after the conversation left its place (24.2.4)', () => {
  it('a task in flight stays in flight through Claude\'s entry: boot, given words it routes, leaves the place, and the task\'s worktree is laid out after, the place still left — the bare command\'s boot keeping it so, test-engine-position.cjs\'s', () => {
    const at = project();
    const session = building(at.dir, ['3.1']);
    const tree = isolation(at.dir, 'a');

    const routed = ok(at.dir, ['boot'], { ...as(session), stdin: 'make the header blue' }).go;
    const laid = layOutOrRefusal(tree, session);

    assert.deepStrictEqual([routed, laid, readPosition(session), tasksInFlight(session).map(({ task, worktree }) => [task, worktree])], ['route', {}, null, [['3.1', tree]]]);
  });
});

describe('task worktree: the steps that prepare the environment (22.5.1)', () => {
  /** The project with the steps `prepare` names recorded — anything else it writes committed with them — and a builder's worktree for task 3.1. @param {(dir: string) => object[]} prepare */
  function preparing(prepare) {
    const at = project();
    confirmEnvironment(at.dir, { prepare: prepare(at.dir) });
    commitAll(at.dir, 'the steps that prepare the environment');
    return { at, session: building(at.dir, ['3.1']), tree: isolation(at.dir, 'a') };
  }

  /** What the steps wrote in the worktree. @param {string} tree */
  const wrote = (tree) => fs.readFileSync(path.join(tree, 'prepared.txt'), 'utf8');

  /** The worktree's own git directory, where the marker and the claim sit. @param {string} tree */
  const gitDirOf = (tree) => path.resolve(tree, git(tree, ['rev-parse', '--git-dir']).trim());

  it('22.S35: lays the task out holding the writer lock, then runs the steps for each worktree and for both, in order, once the include is copied, with the lock let go — never the build\'s first task\'s nor a note — none again once all have passed, the marker kept out of the worktree\'s files', (t) => {
    const { at, session, tree } = preparing((dir) => [
      { name: 'Before the build', when: 'first', command: 'echo first >> prepared.txt' },
      { name: 'Secret', when: 'worktree', command: 'cat lib/.secret >> prepared.txt' },
      { name: 'Signing key', when: 'worktree', note: 'Copy it from the vault' },
      { name: 'Unlocked', when: 'worktree', command: `test ! -e "${statePath(dir, layout.lock)}" && echo unlocked >> prepared.txt` },
      { name: 'Dependencies', when: 'both', command: 'echo both >> prepared.txt' },
    ]);
    for (const [file, text] of Object.entries({ '.gitignore': '.secret\n', '.worktreeinclude': '.secret\n', '.secret': 'SECRET=1\n' })) createFile(at.lib, file, text);
    const lock = holdLock(statePath(at.dir, layout.lock));
    const attempts = lockAttempts(t, lock, () => fs.unlinkSync(lock));
    /** @type {boolean[]} */
    const heldAsLaidOut = [];
    const rename = fs.renameSync;
    t.mock.method(fs, 'renameSync', (/** @type {string} */ from, /** @type {string} */ to) => {
      if (String(to).endsWith('laid-out.json')) heldAsLaidOut.push(fs.existsSync(lock));
      return rename(from, to);
    });

    const first = ok(tree, layOut('3.1'), as(session));
    const tried = [...attempts];
    const again = ok(tree, layOut('3.1'), as(session));

    assert.deepStrictEqual([tried, heldAsLaidOut], [['taken', 'made'], [true]], 'the layout waits on a live holder and writes holding the lock');
    assert.deepStrictEqual([first.prepared.map((/** @type {{name: string}} */ step) => step.name), wrote(tree)], [['Secret', 'Unlocked', 'Dependencies'], 'SECRET=1\nunlocked\nboth\n']);
    assert.deepStrictEqual([again.prepared, again.repos.every((/** @type {{already?: boolean}} */ repo) => repo.already), wrote(tree)], [undefined, true, 'SECRET=1\nunlocked\nboth\n']);
    assert.deepStrictEqual([git(tree, ['status', '--porcelain']), fs.existsSync(path.join(gitDirOf(tree), 'ledger-prepared'))], ['?? prepared.txt\n', true], 'the worktree holds nothing but what the steps wrote');
  });

  it('a step that fails stops the task with its exit code and output, the project\'s setup, the worktree laid out; the call again runs the steps again', () => {
    const { session, tree } = preparing(() => [
      { name: 'Dependencies', when: 'both', command: 'echo both >> prepared.txt' },
      { name: 'Ready', when: 'worktree', command: 'test -f ready.txt || { echo "no ready.txt here"; exit 3; }' },
    ]);
    const refused = refuses(tree, layOut('3.1'), as(session)).error;
    fs.writeFileSync(path.join(tree, 'ready.txt'), 'ready\n');
    const again = ok(tree, layOut('3.1'), as(session));

    assert.strictEqual(refused, 'task worktree: the project\'s setup failed: its step "Ready" that prepares the environment exited 3, so the task does not start in this worktree. The last of its output, 40 lines at most:\nno ready.txt here');
    assert.deepStrictEqual([again.repos.every((/** @type {{already?: boolean}} */ repo) => repo.already), again.prepared.map((/** @type {{name: string}} */ step) => step.name), wrote(tree)], [true, ['Dependencies', 'Ready'], 'both\nboth\n']);
  });

  it('a call while another runs the steps there refuses, running none; a claim whose holder is gone is taken over', () => {
    const { session, tree } = preparing(() => [{ name: 'Dependencies', when: 'worktree', command: 'echo both >> prepared.txt' }]);
    const claim = holdLock(path.join(gitDirOf(tree), 'ledger-preparing'));

    const refused = refuses(tree, layOut('3.1'), as(session)).error;
    const ran = fs.existsSync(path.join(tree, 'prepared.txt'));
    fs.writeFileSync(claim, JSON.stringify({ pid: 2 ** 22 + 1, pid_start: 'gone' }));
    const taken = ok(tree, layOut('3.1'), as(session));

    assert.deepStrictEqual([refused, ran], ['task worktree: the project\'s steps are running in another call; wait for it', false]);
    assert.deepStrictEqual([taken.prepared.map((/** @type {{name: string}} */ step) => step.name), wrote(tree), fs.existsSync(claim)], [['Dependencies'], 'both\n', false]);
  });

  it('7.2.17: in a project that is a folder of a larger repository, the steps run in the project\'s folder of the worktree, never its top', () => {
    const { session, tree } = preparing((dir) => {
      createFile(dir, 'app/readme.txt', 'app\n');
      return [{ name: 'Where', when: 'worktree', command: 'pwd > where.txt' }];
    });
    const app = path.join(tree, 'app');

    ok(app, layOut('3.1'), as(session));

    assert.deepStrictEqual([fs.readFileSync(path.join(app, 'where.txt'), 'utf8').trim(), fs.existsSync(path.join(tree, 'where.txt'))], [fs.realpathSync(app), false]);
  });
});
