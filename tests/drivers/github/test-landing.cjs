'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver (workflow-engine/scripts/drivers/landing/github/)
// on its own ground, past what every driver does (the landing conformance
// suite's): the calls it makes on gh and the stack extension for a stack of
// three tasks — each branch pushed as its pull request opens, each pull
// request based on the one before, the stack linked with the default branch
// as its base whatever GitHub's own default is, and merged whole, each pull
// request squashed (7.S7, 7.S13); the refusals a person meets, each saying
// what is missing or what happened and the way on, never an install
// command (22.4.7) — gh not installed or not signed in, the extension
// missing, GitHub's rate limit, no network, a pull request closed or a
// stack merged in part by hand on GitHub, and a push refused; the
// stand-in gh failing closed; and the live run refusing without the
// person's word (7.3.7, 7.S15). Git layer: the landing world on a fake
// GitHub (world.cjs), built once and copied for each test.
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
const { GH_ENV, ghEnv, github, bareOf, calls, closeByHand, mergeByHand, defaultOnGithub, tipOnGithub } = require('./world.cjs');

const { git, tip } = harness;
const { card, total } = TASKS;
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
  it('pushes each branch as its pull request opens, bases each on the one before, links them on the default branch — never GitHub\'s own — and merges the stack whole, each squashed', () => {
    const dir = project();
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
      { subject: 'feat(pay): Add card', task: 'pay-1-1', paths: ['card.txt'] },
      { subject: 'feat(pay): Show total', task: 'pay-1-2', paths: ['total.txt'] },
      { subject: 'feat(pay): Add tax', task: 'pay-1-4', paths: ['tax.txt'] },
    ]);
    assert.deepStrictEqual(pulls(dir).map(({ state }) => state), ['MERGED', 'MERGED', 'MERGED']);
    assert.strictEqual(git(bareOf(dir), ['rev-parse', 'release']).trim(), tip(dir, 'main'), 'GitHub\'s own default branch took nothing');
    assert.deepStrictEqual(calls(dir), [
      LIST, `pr create --base main --head ${card.branch} --title feat(pay): Add card --body Task: pay-1-1`,
      LIST,
      LIST, `pr create --base ${card.branch} --head ${total.branch} --title feat(pay): Show total --body Task: pay-1-2`,
      LIST, 'stack link --base main --remote origin 1 2',
      LIST, `pr create --base ${total.branch} --head ${tax.branch} --title feat(pay): Add tax --body Task: pay-1-4`,
      LIST, 'stack link --base main --remote origin 1 2 4',
      LIST, 'stack link --base main --remote origin 1 2 4', 'stack merge 4 --yes --squash',
    ]);
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

  it('a stack merged in part by hand on GitHub: its phase refused, and a task opened into it, naming what merged and what did not — and done once the rest is merged there', () => {
    const dir = project();
    stackOfTwo(dir);
    mergeByHand(dir, 1);
    const tax = cutTask(dir, '1.4', 'feat', 'Add tax', total.branch, { 'tax.txt': 'tax\n' });

    const partly = 'land: phase 1\'s stack was merged in part by hand on GitHub — #1 (task 1.1) is merged, and #2 (task 1.2) is not; merge the rest there too, and land again';
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
