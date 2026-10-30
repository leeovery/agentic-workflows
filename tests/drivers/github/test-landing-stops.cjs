'use strict';

// ---------------------------------------------------------------------------
// What stops GitHub's landing driver (leeway-engine/scripts/drivers/
// landing/github/), and where it leaves the default branch here, past what
// every driver does (the landing conformance suite's): the refusals a
// person meets, each saying what is missing or what happened and the way
// on, never an install command (22.4.7) — gh not installed or not signed
// in, the extension missing, GitHub's rate limit, no network, a merge
// GitHub refuses, a pull request GitHub finds conflicting with its base,
// GitHub's answer for a pull request's head before a push never taken, a
// stack merged in part by hand on GitHub, a task with
// nothing to land or opened into a merged phase, a default branch here
// holding commits GitHub's lacks at the open, naming them, and a push
// refused; a task opened already, and a phase merged, answered as done
// already; the push naming its branch, with no tag and no prompt; the
// default branch here checked out with changes to files the merge changes
// refused before anything merges, other changes carried across; the
// default branch here left where the person's work, a failed fetch or git
// itself stops it, warned once with the way to bring it up, the merge
// standing; the stand-in gh at the driver's floors, failing closed,
// merging a stack all or none, and slow, where a test arms it, to work out
// whether a pull request pushed to can merge; and the live run refusing
// without the person's word (7.3.7, 7.S15). GitHub still working it out
// when the driver's wait ends is test-landing-nested-merge-up.cjs's. The
// driver's calls and stacks are test-landing.cjs's. Git layer: the landing
// world on a fake GitHub (world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const harness = require('../../scripts/engine-harness.cjs');
const { TASKS, openArgs, own, cutTask, commitFiles, mergeBack, landedOn, useLandingWorld } = require('../../scripts/landing-world.cjs');
const { loadDriver } = require('../../../skills/leeway-engine/scripts/domain/drivers.cjs');
const side = require('./landing.cjs');
const { GH_ENV, ghEnv, github, onGithub, bareOf, calls, closeByHand, mergeByHand, lagOnGithub, tipOnGithub, pulls, ok, refused, stackOfTwo } = require('./world.cjs');

const { git, tip } = harness;
const { card, total, rounding } = TASKS;
const project = useLandingWorld('github-landing-stops-', side.prepare);

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
    assert.deepStrictEqual([own(finished).phases.length, finished.warnings], [2, ['main here holds commits origin/main does not, so it was not moved to the merge — bring it up to date with origin/main yourself']]);
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

    assert.deepStrictEqual(ok(dir, ['land', 'phase', 'pay', '1']), { ok: true, phase: 1, already: true, repos: [], driver: 'github' });
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

  it('checked out with changes not committed: the merge refused before anything merges where it changes them, naming them — and, where it does not, made, the branch here brought to it with the changes carried across', () => {
    const dir = project();
    ok(dir, openArgs(cutTask(dir, '1.4', 'feat', 'Edit the app', 'main', { 'app.txt': 'app edited\n' })));
    fs.writeFileSync(path.join(dir, 'app.txt'), 'mine\n');

    assert.match(refused(dir, ['land', 'phase', 'pay', '1']), new RegExp(`^land: main is checked out at ${fs.realpathSync(dir)}, with changes not committed: app\\.txt, so nothing moved — commit them, or detach `));
    assert.deepStrictEqual(pulls(dir).map(({ state }) => state), ['OPEN']);
    git(dir, ['checkout', '--', 'app.txt']);
    fs.writeFileSync(path.join(dir, 'note.txt'), 'note\n');
    git(dir, ['add', 'note.txt']);
    assert.strictEqual(ok(dir, ['land', 'phase', 'pay', '1']).warnings, undefined);
    assert.deepStrictEqual([tip(dir, 'main'), git(dir, ['status', '--porcelain']), fs.readFileSync(path.join(dir, 'app.txt'), 'utf8')], [side.defaultTip(dir), 'A  note.txt\n', 'app edited\n']);
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
    assert.strictEqual(own(ok(dir, openArgs(card))).pull_request, 1);
    assert.deepStrictEqual(ok(dir, openArgs(card)), { ok: true, task: '1.1', branch: card.branch, already: true, repos: [], driver: 'github' });
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

  it('a pull request GitHub finds conflicting with its base: its phase refused before anything merges, naming it, and how to settle it', () => {
    const dir = project();
    ok(dir, openArgs(card));
    const main = commitFiles(dir, 'theirs', 'main', { 'card.txt': 'theirs\n' });
    git(bareOf(dir), ['fetch', '-q', dir, 'theirs:refs/heads/main']);

    assert.strictEqual(
      refused(dir, ['land', 'phase', 'pay', '1']),
      `land: task 1.1's pull request #1 conflicts with main on GitHub, so phase 1's stack was not merged — merge origin/main into ${card.branch}, settling the conflict, push it, and land again`,
    );
    assert.deepStrictEqual([tipOnGithub(dir, 'main'), pulls(dir).map(({ state }) => state), calls(dir).filter((call) => call.startsWith('pr merge'))], [main, ['OPEN'], []]);
  });

  it('GitHub answering, after a push, for the head before it: that answer never taken, the pull request read again until GitHub answers for the head pushed, and merged then', () => {
    const dir = project();
    ok(dir, openArgs(card));
    commitFiles(dir, card.branch, card.branch, { 'card.txt': 'card, again\n' });
    git(dir, ['push', '-q', 'origin', card.branch]);
    lagOnGithub(dir, 2, { stale: true });

    ok(dir, ['land', 'phase', 'pay', '1']);
    assert.deepStrictEqual(calls(dir).filter((call) => /^(pr view|pr merge) /.test(call)).map((call) => call.split(' --')[0]), ['pr view 1', 'pr view 1', 'pr view 1', 'pr merge 1']);
    assert.deepStrictEqual(landedOn(bareOf(dir), 'main').map(({ task, paths }) => [task, paths]), [['pay-1-1', ['card.txt']]]);
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
    assert.deepStrictEqual(ok(dir, ['land', 'phase', 'pay', '1']), { ok: true, phase: 1, already: true, repos: [], driver: 'github' });
  });

  it('the default branch here holding a commit GitHub\'s does not, as first boot leaves it: the open refused before anything is pushed or opened, naming it — and, once it is pushed, the task landed alone under its subject', () => {
    const dir = project();
    ok(dir, ['boot']);
    const tax = cutTask(dir, '1.4', 'feat', 'Add tax', 'main', { 'tax.txt': 'tax\n' });
    const [booted] = git(dir, ['log', '--format=%H %s', 'origin/main..main']).trim().split('\n');
    assert.strictEqual(booted.slice(41), 'chore: install workflow session hooks');

    assert.strictEqual(
      refused(dir, openArgs(tax)),
      `land: main here holds a commit origin/main does not — ${booted.slice(0, 7)} "chore: install workflow session hooks" — which a task's branch cut from it would land under the task's own subject, so task 1.4 was not opened; `
      + 'push it to main on GitHub if it belongs there, as `git push origin main` does, and open the task again',
    );
    assert.deepStrictEqual([tipOnGithub(dir, tax.branch), pulls(dir)], ['', []]);
    git(dir, ['push', '-q', 'origin', 'main']);
    ok(dir, openArgs(tax));
    ok(dir, ['land', 'phase', 'pay', '1']);
    assert.deepStrictEqual(landedOn(bareOf(dir), 'main').slice(-1).map(({ subject, paths }) => [subject, paths]), [['feat(pay): Add tax (#1)', ['tax.txt']]]);
  });

  it('a push refused: no pull request opened, in git\'s words, to open the task again once what git names is cleared', () => {
    const dir = project();
    const theirs = git(bareOf(dir), ['commit-tree', 'main^{tree}', '-p', 'main', '-m', 'pushed from elsewhere']).trim();
    git(bareOf(dir), ['update-ref', `refs/heads/${card.branch}`, theirs]);

    assert.match(refused(dir, openArgs(card)), new RegExp(`^land: ${card.branch} could not be pushed to origin \\(git push failed: .*\\[rejected\\].*\\), so task 1\\.1's pull request was not opened — clear what git names, and open the task again$`));
    assert.deepStrictEqual([pulls(dir), tipOnGithub(dir, card.branch)], [[], theirs]);
  });

  it('the push names its branch whatever the person\'s push settings, carries no tag, and git never waits on a prompt — the fetch and the push as a task opens, and the fetches as its phase merges, run with git\'s prompt off, as the state branch\'s do', () => {
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

      assert.deepStrictEqual(fs.readFileSync(seen, 'utf8').split('\n').filter(Boolean), ['0', '0', '0', '0']);
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

  it('the stand-in merges a stack all or none, as GitHub does: a pull request it cannot merge leaves those below it unmerged and the default branch where it was', () => {
    const dir = project();
    stackOfTwo(dir);
    const main = commitFiles(dir, 'theirs', 'main', { 'total.txt': 'theirs\n' });
    git(bareOf(dir), ['fetch', '-q', dir, 'theirs:refs/heads/main']);
    const merged = spawnSync(path.join(__dirname, 'bin', 'gh'), ['stack', 'merge', '2', '--yes', '--squash'], { cwd: dir, encoding: 'utf8', env: ghEnv() });
    assert.deepStrictEqual([merged.status, merged.stderr], [1, 'Pull request #2 is not mergeable: the merge commit cannot be cleanly created.\n']);
    assert.deepStrictEqual([tipOnGithub(dir, 'main'), pulls(dir).map(({ state }) => state)], [main, ['OPEN', 'OPEN']]);
  });

  it('the stand-in, once a pull request\'s head is pushed to, reads it as unknown for the reads armed — or, armed stale, as at the head before — refusing its merge alone or in its stack meanwhile in GitHub\'s words, then as GitHub works it out', () => {
    const dir = project();
    ok(dir, openArgs(card));
    onGithub(dir, (state) => {
      state.stacks.push({ number: 2, base: 'main', pulls: [1] });
      state.next = 3;
    });
    const gh = (/** @type {string[]} */ args) => {
      const ran = spawnSync(path.join(__dirname, 'bin', 'gh'), args, { cwd: dir, encoding: 'utf8', env: ghEnv() });
      return [ran.status, ran.status === 0 ? ran.stdout : ran.stderr];
    };
    const view = () => gh(['pr', 'view', '1', '--json', 'mergeable,headRefOid']);
    const read = (/** @type {string} */ can, /** @type {string} */ head) => [0, `${JSON.stringify({ mergeable: can, headRefOid: head })}\n`];
    const push = (/** @type {string} */ text) => {
      commitFiles(dir, card.branch, card.branch, { 'card.txt': text });
      git(dir, ['push', '-q', 'origin', card.branch]);
      return tip(dir, card.branch);
    };

    const first = push('card, again\n');
    lagOnGithub(dir, 2);
    assert.deepStrictEqual(gh(['stack', 'merge', '1', '--yes', '--squash']), [
      1, 'Merging #1 into main via squash...\n✗ merge failed: Pull request cannot be merged because it has a merge conflict. Stack merges are atomic, so nothing was merged.\n',
    ]);
    assert.deepStrictEqual(gh(['pr', 'merge', '1', '--squash']), [1, 'GraphQL: Pull Request is not mergeable (mergePullRequest)\n']);
    assert.deepStrictEqual([view(), view(), view()], [read('UNKNOWN', first), read('UNKNOWN', first), read('MERGEABLE', first)]);
    const second = push('card, once more\n');
    lagOnGithub(dir, 1, { stale: true });
    assert.deepStrictEqual([view(), view()], [read('MERGEABLE', first), read('MERGEABLE', second)]);
    assert.deepStrictEqual(gh(['pr', 'merge', '1', '--squash']), [0, '']);
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
      for (const args of [[], ['portal'], ['acme/portal', 'ext'], ['acme/portal', 'acme/portal'], ['acme/portal', 'acme/ext', 'more']]) {
        const ran = spawnSync(process.execPath, [path.join(__dirname, 'live-run.cjs'), ...args], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
        assert.deepStrictEqual([ran.status, ran.stderr], [
          2, 'live-run: name the scratch repository on GitHub you created for this run, as <owner>/<repo>, and, for a submodule, a second one, as <owner>/<sub-repo> — nothing has been done\n',
        ], args.join(' '));
      }
      assert.strictEqual(fs.existsSync(path.join(bin, 'called')), false);
    } finally {
      fs.rmSync(bin, { recursive: true, force: true });
    }
    const scripts = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'package.json'), 'utf8')).scripts;
    assert.deepStrictEqual(Object.values(scripts).filter((script) => script.includes('live-run')), []);
  });
});
