'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver (workflow-engine/scripts/drivers/landing/github/)
// on its own ground, past what every driver does (the landing conformance
// suite's): the calls it makes on gh and the stack extension for a stack of
// three tasks — each branch pushed as its pull request opens, each pull
// request based on the one before, the stack linked with the default branch
// as its base whatever GitHub's own default is, and merged whole, each pull
// request squashed under its title and " (#N)", the default branch here
// brought to the merge (7.S7, 7.S13); a stack merged only once the
// repository squashes into the pull request's title and description, a
// lone pull request whatever it squashes into (7.2.18); a phase stacked on
// a higher one, merged after it; which pull request is a task's, and which
// is no task's; the refusals a person meets, each saying what is missing or
// what happened and the way on, never an install command (22.4.7) — gh not
// installed or not signed in, the extension missing, GitHub's rate limit,
// no network, a merge GitHub refuses, a pull request closed or a stack
// merged in part by hand on GitHub, a task with nothing to land, opened
// already or opened into a merged phase, and a push refused; the push
// naming its branch, with no tag and no prompt; the default branch here
// left where the person's work, a failed fetch or git itself stops it,
// warned once with the way to bring it up, the merge standing; the
// stand-in gh at the driver's floors, failing closed; and the live run
// refusing without the person's word (7.3.7, 7.S15). Git layer: the
// landing world on a fake GitHub (world.cjs), built once and copied for
// each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const harness = require('../../scripts/engine-harness.cjs');
const { TASKS, openArgs, cutTask, mergeBack, landedOn, useLandingWorld } = require('../../scripts/landing-world.cjs');
const { loadDriver } = require('../../../skills/workflow-engine/scripts/domain/drivers.cjs');
const side = require('./landing.cjs');
const { GITHUB_SQUASH } = require('./gh-stub.cjs');
const { GH_ENV, ghEnv, github, onGithub, bareOf, calls, closeByHand, mergeByHand, defaultOnGithub, tipOnGithub } = require('./world.cjs');

const { git, tip } = harness;
const { card, total, rounding } = TASKS;
const project = useLandingWorld('github-landing-', side.prepare);

/** A verb that must go through, under the stand-in gh. @param {string} dir @param {string[]} args @param {Record<string, string|undefined>} [env] */
const ok = (dir, args, env = {}) => harness.ok(dir, args, { env: { ...GH_ENV, ...env } });

/** A verb that must refuse, its refusal. @param {string} dir @param {string[]} args @param {Record<string, string|undefined>} [env] */
const refused = (dir, args, env = {}) => harness.refuses(dir, args, { env: { ...GH_ENV, ...env } }).error;

/** The pull requests GitHub holds, each its number, state and base. @param {string} dir */
const pulls = (dir) => github(dir).pulls.map(({ number, state, base }) => ({ number, state, base }));

/** The query every verb reads the unit's pull requests by. */
const LIST = 'pr list --state all --limit 1000 --json number,state,headRefName,baseRefName,headRefOid,title,body';

/** A phase of two: card opened from main, total merged back onto it and opened on it, the two linked. @param {string} dir */
function stackOfTwo(dir) {
  ok(dir, openArgs(card));
  mergeBack(dir, total.branch, card.branch);
  ok(dir, openArgs(total));
  ok(dir, ['land', 'chain', 'pay', '1.2']);
}

describe('the remotes it serves (22.4.3)', () => {
  it('reads a GitHub repository off every form a remote URL takes, and serves those alone', () => {
    const driver = /** @type {any} */ (loadDriver('landing', 'github'));
    for (const url of [
      'git@github.com:acme/portal.git', 'git@github.com:acme/portal', 'https://github.com/acme/portal.git',
      'https://github.com/acme/portal/', 'https://token@github.com/acme/portal', 'ssh://git@github.com/acme/portal.git',
      'ssh://git@github.com:22/acme/portal.git', 'git://github.com/acme/portal.git', 'https://GitHub.com/acme/portal',
    ]) {
      assert.deepStrictEqual([driver.repositoryOf(url), driver.serves(url)], [{ owner: 'acme', repo: 'portal' }, true], url);
    }
    for (const url of ['https://gitlab.com/acme/portal.git', 'git@github.com.evil.io:acme/portal.git', 'https://github.com/acme', '/srv/git/portal.git']) {
      assert.deepStrictEqual([driver.repositoryOf(url), driver.serves(url)], [null, false], url);
    }
  });
});

describe('a stack of three tasks on GitHub (7.S7, 7.S13)', () => {
  it('pushes each branch as its pull request opens, bases each on the one before, links them on the default branch — never GitHub\'s own — merges the stack whole, each squashed under its title and " (#N)", and brings the default branch here to the merge', () => {
    const dir = project();
    const started = tip(dir, 'main');
    defaultOnGithub(dir, 'release');

    assert.deepStrictEqual(ok(dir, openArgs(card)), { ok: true, task: '1.1', branch: card.branch, base: 'main', pull_request: 1, driver: 'github' });
    assert.strictEqual(tipOnGithub(dir, card.branch), tip(dir, card.branch), 'the branch is pushed as its pull request opens');
    assert.deepStrictEqual(ok(dir, ['land', 'chain', 'pay', '1.1']), { ok: true, phase: 1, stack: ['1.1'], pull_requests: [1], driver: 'github' });
    mergeBack(dir, total.branch, card.branch);
    assert.strictEqual(ok(dir, openArgs(total)).base, card.branch);
    ok(dir, ['land', 'chain', 'pay', '1.2']);
    const tax = cutTask(dir, '1.4', 'feat', 'Add tax', total.branch, { 'tax.txt': 'tax\n' });
    assert.deepStrictEqual(ok(dir, openArgs(tax)), { ok: true, task: '1.4', branch: tax.branch, base: total.branch, pull_request: 4, driver: 'github' });
    assert.deepStrictEqual(ok(dir, ['land', 'chain', 'pay', '1.4']), { ok: true, phase: 1, stack: ['1.1', '1.2', '1.4'], pull_requests: [1, 2, 4], driver: 'github' });

    assert.deepStrictEqual(pulls(dir), [
      { number: 1, state: 'OPEN', base: 'main' }, { number: 2, state: 'OPEN', base: card.branch }, { number: 4, state: 'OPEN', base: total.branch },
    ]);
    assert.deepStrictEqual(landedOn(bareOf(dir), 'main'), [], 'nothing merges before the phase does');

    assert.deepStrictEqual(ok(dir, ['land', 'phase', 'pay', '1']), { ok: true, phase: 1, into: 'main', merged: ['1.1', '1.2', '1.4'], pull_requests: [1, 2, 4], driver: 'github' });
    assert.deepStrictEqual(landedOn(bareOf(dir), 'main'), [
      { subject: 'feat(pay): Add card (#1)', task: 'pay-1-1', paths: ['card.txt'] },
      { subject: 'feat(pay): Show total (#2)', task: 'pay-1-2', paths: ['total.txt'] },
      { subject: 'feat(pay): Add tax (#4)', task: 'pay-1-4', paths: ['tax.txt'] },
    ]);
    assert.deepStrictEqual(pulls(dir).map(({ state }) => state), ['MERGED', 'MERGED', 'MERGED']);
    assert.strictEqual(git(bareOf(dir), ['rev-parse', 'release']).trim(), started, 'GitHub\'s own default branch took nothing');
    assert.strictEqual(tip(dir, 'main'), side.defaultTip(dir), 'the default branch here is at the merge');
    assert.deepStrictEqual(calls(dir), [
      LIST, `pr create --base main --head ${card.branch} --title feat(pay): Add card --body Task: pay-1-1`,
      LIST,
      LIST, `pr create --base ${card.branch} --head ${total.branch} --title feat(pay): Show total --body Task: pay-1-2`,
      LIST, 'stack link --base main --remote origin 1 2',
      LIST, `pr create --base ${total.branch} --head ${tax.branch} --title feat(pay): Add tax --body Task: pay-1-4`,
      LIST, 'stack link --base main --remote origin 1 2 4',
      LIST, 'api repos/acme/portal', 'stack link --base main --remote origin 1 2 4', 'stack merge 4 --yes --squash',
    ]);
  });
});

describe('the squash default (7.2.18)', () => {
  it('squashing as GitHub does unless told: a lone pull request merges under its title and " (#N)", and a stack is refused naming the setting while either half is not the pull request\'s — merged once it is set', () => {
    const dir = project();
    onGithub(dir, (state) => {
      state.squash = { ...GITHUB_SQUASH };
    });
    stackOfTwo(dir);
    ok(dir, openArgs(rounding));
    ok(dir, ['land', 'phase', 'pay', '2']);
    assert.deepStrictEqual(landedOn(bareOf(dir), 'main'), [{ subject: 'fix(pay): Round totals (#4)', task: 'pay-2-1', paths: ['round.txt'] }]);

    const refusal = 'land: acme/portal does not squash a pull request into its title and description, so phase 1\'s stack would land under other subjects than its tasks\' — '
      + 'set the repository\'s squash default to "Pull request title and description" in its Settings, under Pull Requests, and land again';
    for (const squash of [GITHUB_SQUASH, { squash_merge_commit_title: 'PR_TITLE', squash_merge_commit_message: 'COMMIT_MESSAGES' }, { squash_merge_commit_title: 'COMMIT_OR_PR_TITLE', squash_merge_commit_message: 'PR_BODY' }]) {
      onGithub(dir, (state) => {
        state.squash = { ...squash };
      });
      assert.strictEqual(refused(dir, ['land', 'phase', 'pay', '1']), refusal, JSON.stringify(squash));
    }
    assert.deepStrictEqual(pulls(dir).map(({ state }) => state), ['OPEN', 'OPEN', 'MERGED']);
    assert.strictEqual(ok(dir, ['github-squash', 'yes']).github_squash, 'set');
    ok(dir, ['land', 'phase', 'pay', '1']);
    assert.deepStrictEqual(landedOn(bareOf(dir), 'main').slice(1), [
      { subject: 'feat(pay): Add card (#1)', task: 'pay-1-1', paths: ['card.txt'] },
      { subject: 'feat(pay): Show total (#2)', task: 'pay-1-2', paths: ['total.txt'] },
    ]);
  });
});

describe('phases and their pull requests', () => {
  it('a phase built on a higher phase not yet merged: its pull request based on that phase\'s top, its merge refused naming it, and finish merging that one first', () => {
    const dir = project();
    const four = cutTask(dir, '4.1', 'feat', 'Add four', 'main', { 'four.txt': 'four\n' });
    const more = cutTask(dir, '4.2', 'feat', 'Add more', four.branch, { 'more.txt': 'more\n' });
    ok(dir, openArgs(four));
    ok(dir, openArgs(more));
    ok(dir, ['land', 'chain', 'pay', '4.2']);
    const fix = cutTask(dir, '3.2', 'fix', 'Fix four', more.branch, { 'fix.txt': 'fix\n' });

    assert.strictEqual(ok(dir, openArgs(fix)).base, more.branch);
    assert.strictEqual(refused(dir, ['land', 'phase', 'pay', '3']), 'land: phase 3 stacks on phase 4, which has not merged — merge it first with `land phase pay 4`, then land again');
    assert.deepStrictEqual(landedOn(bareOf(dir), 'main'), []);

    assert.deepStrictEqual(ok(dir, ['land', 'finish', 'pay']).phases.map((/** @type {{phase: number}} */ phase) => phase.phase), [4, 3]);
    assert.deepStrictEqual(landedOn(bareOf(dir), 'main'), [
      { subject: 'feat(pay): Add four (#1)', task: 'pay-4-1', paths: ['four.txt'] },
      { subject: 'feat(pay): Add more (#2)', task: 'pay-4-2', paths: ['more.txt'] },
      { subject: 'fix(pay): Fix four (#4)', task: 'pay-3-2', paths: ['fix.txt'] },
    ]);
    assert.ok(calls(dir).includes('pr edit 4 --base main'), 'the lone pull request is based on the default branch before it merges');
  });

  it('a task opened into a phase merged already: refused, to number it in a phase not yet merged, nothing pushed', () => {
    const dir = project();
    ok(dir, openArgs(card));
    ok(dir, ['land', 'phase', 'pay', '1']);
    const late = cutTask(dir, '1.5', 'feat', 'Add late', 'main', { 'late.txt': 'late\n' });

    assert.strictEqual(refused(dir, openArgs(late)), 'land: phase 1 is merged into main — task 1.5 lands in a phase not yet merged, so number it in one');
    assert.deepStrictEqual([tipOnGithub(dir, late.branch), pulls(dir).length], ['', 1]);
  });

  it('a task with nothing past the chain\'s tip: refused as every driver refuses it, no pull request opened and nothing pushed', () => {
    const dir = project();
    const empty = cutTask(dir, '1.5', 'feat', 'Add nothing', 'main', {});
    git(dir, ['update-ref', `refs/heads/${empty.branch}`, 'main']);

    assert.strictEqual(refused(dir, openArgs(empty)), `land: task 1.5's branch ${empty.branch} changes nothing past main — commit its change there first`);
    assert.deepStrictEqual([pulls(dir), tipOnGithub(dir, empty.branch)], [[], '']);
  });

  it('a task\'s open pull request outranks a closed one of its own, whatever their numbers, and one that is no task\'s — the person\'s own, or a bot\'s — is passed over', () => {
    const dir = project();
    ok(dir, openArgs(card));
    onGithub(dir, (state) => {
      state.pulls.push(
        { number: 2, state: 'CLOSED', head: card.branch, base: 'main', title: 'feat(pay): Add card', body: 'Task: pay-1-1' },
        { number: 3, state: 'OPEN', head: 'dependabot/npm_and_yarn/lodash-4.17.21', base: 'main', title: 'Bump lodash', body: '' },
        { number: 4, state: 'OPEN', head: 'my-own-fix', base: 'main', title: 'Fix the footer', body: '' },
      );
      state.next = 5;
    });

    assert.deepStrictEqual(ok(dir, ['land', 'phase', 'pay', '1']).pull_requests, [1]);
    assert.deepStrictEqual(landedOn(bareOf(dir), 'main').map(({ subject }) => subject), ['feat(pay): Add card (#1)']);
    assert.deepStrictEqual(pulls(dir).map(({ state }) => state), ['MERGED', 'CLOSED', 'OPEN', 'OPEN']);
  });

  it('finish stopped by a pull request closed by hand in a phase another stacks on: refused naming it, and the phases finish merged before it', () => {
    const dir = project();
    const three = cutTask(dir, '3.2', 'fix', 'Fix three', 'main', { 'three.txt': 'three\n' });
    const again = cutTask(dir, '3.3', 'fix', 'Fix three again', three.branch, { 'again.txt': 'again\n' });
    const two = cutTask(dir, '2.5', 'fix', 'Fix two', again.branch, { 'two.txt': 'two\n' });
    for (const task of [card, three, again, two]) ok(dir, openArgs(task));
    closeByHand(dir, 3);

    assert.strictEqual(
      refused(dir, ['land', 'finish', 'pay']),
      'land: task 3.3\'s pull request #3 was closed on GitHub without being merged — reopen it there, as `gh pr reopen 3` does, and land again (finish merged phase 1 before it)',
    );
    assert.deepStrictEqual(landedOn(bareOf(dir), 'main').map(({ task }) => task), ['pay-1-1']);
  });
});

describe('the default branch here, once a phase merges', () => {
  it('holding a commit GitHub\'s does not: every phase finish merges stands, and the answer warns once that it was not moved', () => {
    const dir = project();
    ok(dir, openArgs(card));
    ok(dir, openArgs(rounding));
    fs.writeFileSync(path.join(dir, 'local.txt'), 'local\n');
    git(dir, ['add', 'local.txt']);
    git(dir, ['commit', '-q', '-m', 'local work']);
    const ours = tip(dir, 'main');

    const finished = ok(dir, ['land', 'finish', 'pay']);
    assert.deepStrictEqual([finished.phases.length, finished.warnings], [2, ['main here holds commits origin/main does not, so it was not moved to the merge — bring it up to date with origin/main yourself']]);
    assert.deepStrictEqual([tip(dir, 'main'), landedOn(bareOf(dir), 'main').map(({ task }) => task)], [ours, ['pay-1-1', 'pay-2-1']]);
  });

  it('its fetch failing: the merge stands, and the answer warns, in git\'s words, that it was not brought up', () => {
    const dir = project();
    ok(dir, openArgs(card));
    const bin = fs.mkdtempSync(path.join(dir, '..', 'no-fetch-'));
    fs.writeFileSync(path.join(bin, 'ssh'), `#!/bin/sh\ncase "$*" in *git-upload-pack*) echo 'the test refuses fetching' >&2; exit 1 ;; esac\nexec "${path.join(__dirname, 'ssh')}" "$@"\n`, { mode: 0o755 });
    git(dir, ['config', 'core.sshCommand', path.join(bin, 'ssh')]);
    const ours = tip(dir, 'main');
    try {
      const { warnings } = ok(dir, ['land', 'phase', 'pay', '1']);

      assert.match(warnings[0], /^main here was not brought up to the merge, as origin\/main could not be fetched \(git fetch failed: the test refuses fetching .*\) — fetch it, and fast-forward main to it$/);
      assert.deepStrictEqual([warnings.length, tip(dir, 'main'), landedOn(bareOf(dir), 'main').map(({ task }) => task)], [1, ours, ['pay-1-1']]);
    } finally {
      fs.rmSync(bin, { recursive: true, force: true });
    }
  });

  it('git failing as it moves it — its index locked: the merge stands, the answer warns in git\'s words, and landing the phase again brings it up', () => {
    const dir = project();
    ok(dir, openArgs(card));
    const lock = path.join(dir, '.git', 'index.lock');
    fs.writeFileSync(lock, '');
    const ours = tip(dir, 'main');

    const { warnings } = ok(dir, ['land', 'phase', 'pay', '1']);
    assert.match(warnings[0], /^main here was not moved to the merge, origin\/main at \w+: git merge failed: .*index\.lock.* — once that is clear, `git merge --ff-only origin\/main` where main is checked out brings it up$/);
    assert.deepStrictEqual([warnings.length, tip(dir, 'main'), landedOn(bareOf(dir), 'main').map(({ task }) => task)], [1, ours, ['pay-1-1']]);
    fs.rmSync(lock);

    assert.strictEqual(refused(dir, ['land', 'phase', 'pay', '1']), 'land: phase 1 is merged into main already — there is nothing more to merge');
    assert.strictEqual(tip(dir, 'main'), side.defaultTip(dir));
  });

  it('checked out with a file not tracked in the merge\'s way: the file kept, the answer naming it and the command that brings the branch up once it is clear', () => {
    const dir = project();
    ok(dir, openArgs(card));
    fs.writeFileSync(path.join(dir, 'card.txt'), 'mine\n');
    const ours = tip(dir, 'main');

    const [warning] = ok(dir, ['land', 'phase', 'pay', '1']).warnings;
    assert.strictEqual(
      warning,
      `main here was not moved to the merge, origin/main at ${harness.git(dir, ['rev-parse', '--short', 'origin/main']).trim()}: main is checked out at ${fs.realpathSync(dir)}, where files not tracked are in the way: card.txt — once that is clear, \`git merge --ff-only origin/main\` where main is checked out brings it up`,
    );
    assert.deepStrictEqual([tip(dir, 'main'), fs.readFileSync(path.join(dir, 'card.txt'), 'utf8')], [ours, 'mine\n']);
    fs.rmSync(path.join(dir, 'card.txt'));
    execFileSync('sh', ['-c', /** @type {string} */ (/`([^`]+)`/.exec(warning)?.[1])], { cwd: dir });
    assert.strictEqual(tip(dir, 'main'), side.defaultTip(dir));
  });
});

describe('what stops a verb, and the way on (22.4.7)', () => {
  it('gh not installed: refused naming gh and its extension and where their updates are, no command, nothing pushed', () => {
    const dir = project();
    const bin = fs.mkdtempSync(path.join(dir, '..', 'bin-'));
    for (const tool of ['git', 'tick']) fs.symlinkSync(execFileSync('sh', ['-c', `command -v ${tool}`], { encoding: 'utf8' }).trim(), path.join(bin, tool));
    try {
      const error = refused(dir, openArgs(card), { PATH: bin });
      assert.strictEqual(error, 'land: the landing driver needs gh and gh-stack, not installed — gh\'s updates are at https://cli.github.com; gh-stack\'s updates are at https://github.com/github/gh-stack');
      assert.strictEqual(tipOnGithub(dir, card.branch), '');
    } finally {
      fs.rmSync(bin, { recursive: true, force: true });
    }
  });

  it('the stack extension missing: refused naming it and where its updates are, at the first call that needs it, nothing linked', () => {
    const dir = project();
    ok(dir, openArgs(card));
    mergeBack(dir, total.branch, card.branch);
    ok(dir, openArgs(total));

    assert.strictEqual(refused(dir, ['land', 'chain', 'pay', '1.2'], { GH_STUB_NO_STACK: '1' }), 'land: the landing driver needs gh-stack, not installed — gh-stack\'s updates are at https://github.com/github/gh-stack');
    assert.deepStrictEqual(github(dir).stacks, []);
  });

  it('gh not signed in: refused saying so and how to sign in, before anything is pushed', () => {
    const dir = project();
    assert.strictEqual(refused(dir, openArgs(card), { GH_STUB_FAULT: 'signed-out' }), 'land: gh could not read acme/portal\'s pull requests: it is not signed in to github.com — sign in with `gh auth login`, and land again');
    assert.strictEqual(tipOnGithub(dir, card.branch), '');
  });

  it('GitHub\'s rate limit: refused in GitHub\'s words, to land again once it resets — and landing again opens the task, its branch pushed already', () => {
    const dir = project();
    assert.strictEqual(
      refused(dir, openArgs(card), { GH_STUB_FAULT: 'rate-limit@pr create' }),
      'land: gh could not open task 1.1\'s pull request: GitHub\'s rate limit stopped it (GraphQL: API rate limit already exceeded for user ID 1.) — wait for the limit to reset, and land again',
    );
    assert.deepStrictEqual([tipOnGithub(dir, card.branch), pulls(dir)], [tip(dir, card.branch), []]);
    assert.strictEqual(ok(dir, openArgs(card)).pull_request, 1);
    assert.strictEqual(refused(dir, openArgs(card)), 'land: task 1.1 is in phase 1\'s stack already — there is nothing more to open');
  });

  it('no network: refused in gh\'s words, to land again once it is back, nothing merged', () => {
    const dir = project();
    ok(dir, openArgs(card));
    assert.strictEqual(
      refused(dir, ['land', 'phase', 'pay', '1'], { GH_STUB_FAULT: 'offline' }),
      'land: gh could not read acme/portal\'s pull requests: it could not reach GitHub (error connecting to api.github.com check your internet connection or https://githubstatus.com) — land again once the network is back',
    );
    assert.deepStrictEqual(pulls(dir), [{ number: 1, state: 'OPEN', base: 'main' }]);
  });

  it('the stack extension failing, its exit the same whatever failed: refused by what its words say — signed out, the rate limit, or a merge GitHub refuses, in GitHub\'s words — nothing merged, and merged when landed again', () => {
    const dir = project();
    stackOfTwo(dir);

    for (const [fault, refusal] of [
      ['signed-out@stack link', 'land: gh could not link phase 1\'s pull requests into its stack: it is not signed in to github.com — sign in with `gh auth login`, and land again'],
      ['rate-limit@stack merge', 'land: gh could not merge phase 1\'s stack: GitHub\'s rate limit stopped it (GraphQL: API rate limit already exceeded for user ID 1.) — wait for the limit to reset, and land again'],
      ['unmergeable@stack merge', 'land: gh could not merge phase 1\'s stack: GraphQL: Required status check "test" is expected. (mergePullRequest) — settle what GitHub names, then land again'],
    ]) {
      assert.strictEqual(refused(dir, ['land', 'phase', 'pay', '1'], { GH_STUB_FAULT: fault }), refusal, fault);
      assert.deepStrictEqual(pulls(dir).map(({ state }) => state), ['OPEN', 'OPEN'], fault);
    }
    ok(dir, ['land', 'phase', 'pay', '1']);
    assert.deepStrictEqual(pulls(dir).map(({ state }) => state), ['MERGED', 'MERGED']);
  });

  it('a pull request closed by hand on GitHub: its phase refused, naming it and how to reopen it — and merged once it is', () => {
    const dir = project();
    ok(dir, openArgs(card));
    closeByHand(dir, 1);

    const error = refused(dir, ['land', 'phase', 'pay', '1']);
    assert.strictEqual(error, 'land: task 1.1\'s pull request #1 was closed on GitHub without being merged — reopen it there, as `gh pr reopen 1` does, and land again');
    assert.deepStrictEqual(landedOn(bareOf(dir), 'main'), []);
    execFileSync('sh', ['-c', /** @type {string} */ (/`([^`]+)`/.exec(error)?.[1])], { cwd: dir, env: ghEnv() });
    ok(dir, ['land', 'phase', 'pay', '1']);
    assert.deepStrictEqual(landedOn(bareOf(dir), 'main').map(({ task }) => task), ['pay-1-1']);
  });

  it('a stack merged in part by hand on GitHub: its phase refused, and a task opened into it, naming what merged and what did not — and landed once the rest is merged there', () => {
    const dir = project();
    stackOfTwo(dir);
    mergeByHand(dir, 1);
    const tax = cutTask(dir, '1.4', 'feat', 'Add tax', total.branch, { 'tax.txt': 'tax\n' });

    const partly = 'land: phase 1\'s stack was merged in part by hand on GitHub — #1 (task 1.1) is merged, and #2 (task 1.2) is not; merge the rest there too, and the phase is landed';
    assert.strictEqual(refused(dir, ['land', 'phase', 'pay', '1']), partly);
    assert.strictEqual(refused(dir, openArgs(tax)), partly);
    assert.deepStrictEqual(pulls(dir).map(({ state }) => state), ['MERGED', 'OPEN']);
    mergeByHand(dir, 2, 'main');
    assert.strictEqual(refused(dir, ['land', 'phase', 'pay', '1']), 'land: phase 1 is merged into main already — there is nothing more to merge');
  });

  it('a push refused: no pull request opened, in git\'s words, to open the task again once what git names is cleared', () => {
    const dir = project();
    const theirs = git(bareOf(dir), ['commit-tree', 'main^{tree}', '-p', 'main', '-m', 'pushed from elsewhere']).trim();
    git(bareOf(dir), ['update-ref', `refs/heads/${card.branch}`, theirs]);

    assert.match(refused(dir, openArgs(card)), new RegExp(`^land: ${card.branch} could not be pushed to origin \\(git push failed: .*\\[rejected\\].*\\), so task 1\\.1's pull request was not opened — clear what git names, and open the task again$`));
    assert.deepStrictEqual([pulls(dir), tipOnGithub(dir, card.branch)], [[], theirs]);
  });

  it('the push names its branch whatever the person\'s push settings, carries no tag, and git never waits on a prompt — the push as a task opens and the fetch once its phase merges run with git\'s prompt off, as the state branch\'s do', () => {
    const dir = project();
    git(dir, ['config', 'remote.origin.push', 'refs/heads/*:refs/heads/elsewhere/*']);
    git(dir, ['config', 'push.followTags', 'true']);
    git(dir, ['tag', '-a', '-m', 'a note on the card', 'card-note', card.branch]);
    const bin = fs.mkdtempSync(path.join(dir, '..', 'prompt-'));
    const seen = path.join(bin, 'seen');
    fs.writeFileSync(path.join(bin, 'ssh'), `#!/bin/sh\nprintf '%s\\n' "\${GIT_TERMINAL_PROMPT-unset}" >> "${seen}"\nexec "${path.join(__dirname, 'ssh')}" "$@"\n`, { mode: 0o755 });
    git(dir, ['config', 'core.sshCommand', path.join(bin, 'ssh')]);
    try {
      ok(dir, openArgs(card));
      assert.deepStrictEqual(
        [tipOnGithub(dir, card.branch), git(bareOf(dir), ['for-each-ref', '--format=%(refname)', 'refs/heads/elsewhere/', 'refs/tags/card-note']).trim()],
        [tip(dir, card.branch), ''],
      );
      ok(dir, ['land', 'phase', 'pay', '1']);

      assert.deepStrictEqual(fs.readFileSync(seen, 'utf8').split('\n').filter(Boolean), ['0', '0']);
    } finally {
      fs.rmSync(bin, { recursive: true, force: true });
    }
  });
});

describe('the stand-in gh and the live run (7.3.7, 7.S15)', () => {
  it('the stand-in runs only with GH_CONFIG_DIR pinned to a temp folder, and only where a fake GitHub was made', () => {
    const gh = path.join(__dirname, 'bin', 'gh');
    const unpinned = spawnSync(gh, ['pr', 'list'], { cwd: project(), encoding: 'utf8', env: { ...ghEnv(), GH_CONFIG_DIR: os.homedir() } });
    assert.deepStrictEqual([unpinned.status, unpinned.stderr], [99, 'the stub runs only with GH_CONFIG_DIR pinned to a temp folder\n']);
    const plain = harness.setupGitFixture('github-landing-plain-');
    try {
      assert.strictEqual(spawnSync(gh, ['pr', 'list'], { cwd: plain, encoding: 'utf8', env: ghEnv() }).status, 98);
    } finally {
      harness.cleanupFixture(plain);
    }
  });

  it('the stand-in is the oldest gh and stack extension the driver works with: it answers their versions as the driver\'s floors', () => {
    const driver = /** @type {any} */ (loadDriver('landing', 'github'));
    const was = process.env.PATH;
    process.env.PATH = GH_ENV.PATH;
    try {
      assert.deepStrictEqual(driver.needs.map((/** @type {any} */ need) => [need.tool, need.found()]), [['gh', '2.30.0'], ['gh-stack', '0.1.0']]);
      assert.deepStrictEqual(driver.needs.map((/** @type {any} */ need) => need.floor), ['2.30.0', '0.1.0']);
    } finally {
      process.env.PATH = was;
    }
  });

  it('the stand-in refuses a pull request whose head holds nothing past its base, as GitHub does', () => {
    const dir = project();
    git(bareOf(dir), ['branch', 'level', 'main']);
    const made = spawnSync(path.join(__dirname, 'bin', 'gh'), ['pr', 'create', '--base', 'main', '--head', 'level', '--title', 'Level'], { cwd: dir, encoding: 'utf8', env: ghEnv() });
    assert.deepStrictEqual([made.status, made.stderr], [1, 'pull request create failed: GraphQL: No commits between main and level (createPullRequest)\n']);
    assert.deepStrictEqual(pulls(dir), []);
  });

  it('no live GitHub run without the person\'s word: the live run refuses without the scratch repository named, calling nothing, and no gate runs it', () => {
    const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-called-'));
    fs.writeFileSync(path.join(bin, 'gh'), `#!/bin/sh\ntouch "${bin}/called"\n`, { mode: 0o755 });
    try {
      for (const args of [[], ['portal'], ['acme/portal', 'more']]) {
        const ran = spawnSync(process.execPath, [path.join(__dirname, 'live-run.cjs'), ...args], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
        assert.deepStrictEqual([ran.status, ran.stderr], [2, 'live-run: name the scratch repository on GitHub you created for this run, as <owner>/<repo> — nothing has been done\n'], args.join(' '));
      }
      assert.strictEqual(fs.existsSync(path.join(bin, 'called')), false);
    } finally {
      fs.rmSync(bin, { recursive: true, force: true });
    }
    const scripts = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'package.json'), 'utf8')).scripts;
    assert.deepStrictEqual(Object.values(scripts).filter((script) => script.includes('live-run')), []);
  });
});
