'use strict';

// ---------------------------------------------------------------------------
// The `land` verbs' argv contract (workflow-engine/scripts/domain/landing.cjs,
// with landing-git.cjs and landing-names.cjs): the usage and the shapes they
// refuse, writing nothing; the landing driver settled and committed by the
// first verb where no setting names one, and kept once it does (7.S21); the
// default branch read off the remote, `init.defaultBranch`, `main` or
// `master`, never the state branch (4.9.4); a task's branch named from its
// type and title, and judged by its own change; a change reaching a nested
// repository refused. What every driver does is the landing conformance
// suite's; the local driver's stacks, test-engine-land-local.cjs's; the
// person's checkouts, test-engine-land-checkout.cjs's and
// test-engine-land-worktrees.cjs's. Verb layer: the landing world
// (landing-world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, refuses, git, stateGit, tip, initRepo, statePath } = require('./engine-harness.cjs');
const { TASKS, openArgs, commitFiles, setLandingDriver, useLandingWorld, followRemedy } = require('./landing-world.cjs');

const { card } = TASKS;
const project = useLandingWorld('engine-land-verbs-');

/** The state branch's tip, and whether a project manifest is there. @param {string} dir */
const stateAt = (dir) => ({ tip: tip(statePath(dir), 'HEAD'), manifest: fs.existsSync(statePath(dir, 'manifest.json')) });

/** The argv opening a task the test makes a branch of. @param {string} task @param {string} type @param {string} title */
const open = (task, type, title) => ['land', 'open', 'pay', task, '--type', type, '--title', title];

describe('land: what it refuses before anything is read, writing nothing', () => {
  it('refuses another sub-verb, a missing or extra argument or flag, with the usage', () => {
    const dir = project();
    const before = stateAt(dir);
    const usage = 'Usage: engine land open <work-unit> <phase>.<task> --type <type> --title <title> | engine land chain <work-unit> <phase>.<task>'
      + ' | engine land phase <work-unit> <phase> | engine land finish <work-unit>';
    for (const args of [
      ['land'], ['land', 'merge', 'pay'], ['land', 'open', 'pay', '1.1', '--type', 'feat'], ['land', 'open', 'pay', '1.1', '--type', 'feat', '--title'],
      [...openArgs(card), '--slug', 'x'], ['land', 'chain', 'pay'], ['land', 'phase', 'pay', '1', '2'], ['land', 'finish'],
    ]) {
      assert.strictEqual(refuses(dir, args).error, usage, args.join(' '));
    }
    assert.deepStrictEqual(stateAt(dir), before);
  });

  it('refuses a unit, task, type, title or phase of another shape', () => {
    const dir = project();
    const before = stateAt(dir);
    const refusals = /** @type {[string[], string][]} */ ([
      [['land', 'open', 'Pay', '1.1', '--type', 'feat', '--title', 'Add card'], 'task-id: Work unit name "Pay" must be a kebab-case slug — lowercase letters and digits, joined by single hyphens'],
      [open('1-1', 'feat', 'Add card'), 'task-id: "1-1" is not a task — it is {phase}.{n}'],
      [open('1.1', 'Feat', 'Add card'), 'land: the task\'s type is a lowercase word, as feat or fix — got "Feat"'],
      [open('1.1', 'feat', '  '), 'land: the task\'s title is one line of text — got "  "'],
      [open('1.1', 'feat', 'Add\ncard'), 'land: the task\'s title is one line of text — got "Add\\ncard"'],
      [['land', 'phase', 'pay', '01'], 'land: the phase is a whole number from 1 — got "01"'],
      [['land', 'finish', 'research'], 'task-id: Work unit name "research" conflicts with a phase name'],
    ]);
    for (const [args, error] of refusals) assert.strictEqual(refuses(dir, args).error, error, args.join(' '));
    assert.deepStrictEqual(stateAt(dir), before);
  });

  it('refuses a task whose branch, named from its type and title, is not there', () => {
    const dir = project();
    const before = stateAt(dir);
    assert.deepStrictEqual(
      [open('1.4', 'feat', 'Pay by link: QR codes, NFC & café terminals'), open('1.5', 'feat', 'Итоги корзины')].map((args) => refuses(dir, args).error),
      [
        'land: task 1.4 has no branch feat/pay-1.4-pay-by-link-qr-codes-nfc-cafe-terminals — its type and title name it, so open it with those its branch was named from',
        'land: task 1.5 has no branch feat/pay-1.5-task — its type and title name it, so open it with those its branch was named from',
      ],
    );
    assert.deepStrictEqual(stateAt(dir), before);
  });
});

describe('land: the landing driver setting (7.1.4, 7.S21)', () => {
  it('is settled by the first verb where none is set — the local driver, with no remote — and its state commit carries it; a GitHub remote added later leaves it', () => {
    const dir = project();
    const opened = ok(dir, openArgs(card));
    assert.deepStrictEqual([opened.driver, opened.committed], ['local', tip(statePath(dir), 'HEAD').slice(0, opened.committed.length)]);
    assert.strictEqual(stateGit(dir, ['show', '--name-only', '--format=%s', 'HEAD']), 'chore: the landing driver is local\n\nmanifest.json\n');
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(statePath(dir, 'manifest.json'), 'utf8')).drivers, { landing: 'local' });

    git(dir, ['remote', 'add', 'origin', 'git@github.com:acme/pay.git']);
    const before = stateAt(dir);
    const chained = ok(dir, ['land', 'chain', 'pay', '1.1']);
    assert.deepStrictEqual([chained.driver, 'committed' in chained, stateAt(dir)], ['local', false, before]);
  });

  it('is committed once settled though the driver then refuses', () => {
    const dir = project();
    assert.strictEqual(refuses(dir, ['land', 'chain', 'pay', '1.1']).error, 'land: task 1.1 is not open — open it first');
    assert.strictEqual(stateGit(dir, ['log', '-1', '--format=%s']), 'chore: the landing driver is local\n');
  });
});

describe('land: the default branch everything lands on', () => {
  it('is the branch the remote names its HEAD, which the repository must have — made from the remote\'s as the refusal says', () => {
    const dir = project();
    setLandingDriver(dir, 'local');
    git(dir, ['remote', 'add', 'origin', 'https://git.example.org/acme/pay.git']);
    git(dir, ['update-ref', 'refs/remotes/origin/trunk', 'main']);
    git(dir, ['symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/trunk']);
    const { error } = refuses(dir, openArgs(card));
    assert.strictEqual(error, 'land: the default branch is trunk, and the repository has no local branch of that name — make one with `git branch trunk origin/trunk`');
    followRemedy(dir, error);
    assert.strictEqual(ok(dir, openArgs(card)).base, 'trunk');
  });

  it('is the branch init.defaultBranch names where there is no remote, ahead of main', () => {
    const dir = project();
    git(dir, ['branch', 'trunk', 'main']);
    git(dir, ['config', 'init.defaultBranch', 'trunk']);
    assert.strictEqual(ok(dir, openArgs(card)).base, 'trunk');
  });

  it('is never the branch the main checkout is on: with nothing naming one, the verb refuses, saying how to name it, and lands there once named', () => {
    const dir = project();
    const before = stateAt(dir);
    git(dir, ['branch', '-m', 'main', 'trunk']);
    assert.strictEqual(
      refuses(dir, openArgs(card)).error,
      'land: no default branch to land on — the remote names none, and the repository has no branch init.defaultBranch names, nor main or master; '
      + 'name it with `git config init.defaultBranch <branch>` in the project',
    );
    assert.deepStrictEqual(stateAt(dir), before);
    git(dir, ['config', 'init.defaultBranch', 'trunk']);
    assert.strictEqual(ok(dir, openArgs(card)).base, 'trunk');
  });

  it('is never the state branch: the verb refuses, writing nothing (4.9.4)', () => {
    const dir = project();
    const before = stateAt(dir);
    git(dir, ['config', 'init.defaultBranch', 'leeway-state']);
    assert.strictEqual(
      refuses(dir, openArgs(card)).error,
      'land: the default branch reads as leeway-state, the workflows\' state branch, which nothing lands on — name the project\'s own with `git config init.defaultBranch <branch>`',
    );
    assert.deepStrictEqual(stateAt(dir), before);
  });
});

describe('land open: a task judged by its own change', () => {
  it('refuses a task whose change moves a nested repository\'s pointer', () => {
    const dir = project();
    commitFiles(dir, 'feat/pay-1.4-bump-lib', 'main', { 'bump.txt': 'bump\n' }, { gitlinks: { 'vendor/lib': tip(dir, 'main') } });
    assert.strictEqual(
      refuses(dir, open('1.4', 'feat', 'Bump lib')).error,
      'land: task 1.4\'s change reaches the nested repository vendor/lib — nested repositories are not supported yet, so take that change off the task\'s branch and open the task again',
    );
  });

  it('refuses a task with a branch of its own in a nested clone', () => {
    const dir = project();
    const lib = initRepo(path.join(dir, 'vendor', 'lib'));
    git(lib, ['commit', '-q', '--allow-empty', '-m', 'lib']);
    git(lib, ['branch', card.branch]);
    assert.strictEqual(
      refuses(dir, openArgs(card)).error,
      'land: task 1.1\'s change reaches the nested repository vendor/lib — nested repositories are not supported yet, so take that change off the task\'s branch and open the task again',
    );
  });

  it('takes nothing the default branch gained since the task was cut for the task\'s own change', () => {
    const dir = project();
    git(dir, ['update-index', '--add', '--cacheinfo', `160000,${tip(dir, 'main')},vendor/lib`]);
    git(dir, ['commit', '-q', '-m', 'vendor the lib']);
    assert.strictEqual(
      refuses(dir, openArgs(card)).error,
      `land: task 1.1's branch ${card.branch} does not descend from the chain's tip, main (${tip(dir, 'main').slice(0, 7)}) — merge it back onto main first`,
    );
  });
});
