'use strict';

//
// Tests for `engine code` (domain/code.cjs): the code change read across
// every repo in the project — the commits a subject prefix selects, the
// change they made, the change not yet committed, and the dirt — named from
// the project, and in a project of one repo what git itself answers.
//

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const harness = require('./engine-harness.cjs');

const { git, commitAll, initRepo, setupGitFixture, addSubmodule, cleanupFixture } = harness;
const { diffPatch } = require('../../skills/workflow-engine/scripts/kernel/git.cjs');

const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const PREFIX = 'impl(pay): T1-';

function writeFile(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

const sha = (dir, rev = 'HEAD') => git(dir, ['rev-parse', rev]).trim();

/** The `diff --git` header lines of a patch, in order. */
const headers = (patch) => patch.split('\n').filter((line) => line.startsWith('diff --git '));


describe('engine code log and diff --subject: the commits a subject prefix selects', () => {
  let dir;
  let api;
  let sdk;
  beforeEach(() => {
    dir = setupGitFixture('engine-code-log-');
    writeFile(dir, '.gitignore', '.leeway/\napi/\n');
    writeFile(dir, 'src/app.js', '1\n');
    writeFile(dir, 'src/other.js', '1\n');
    commitAll(dir, 'chore: init');
    writeFile(dir, 'src/app.js', '2\n');
    commitAll(dir, `${PREFIX}1 — the app`);
    writeFile(dir, 'src/other.js', '2\n');
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'fix: the other file', '-m', `Follows ${PREFIX}1 — a body mention.`]);
    writeFile(dir, 'src/app.js', '3\n');
    commitAll(dir, `chore: ${PREFIX}9 — the prefix mid-subject`);

    // The clone the project ignores: its first commit is a task's.
    api = initRepo(path.join(dir, 'api'));
    writeFile(api, 'src/handler.js', '1\n');
    commitAll(api, `${PREFIX}2 — the handler`);
    writeFile(api, 'src/routes.js', '1\n');
    commitAll(api, `${PREFIX}3 — the routes`);
    writeFile(api, 'README.md', '# API\n');
    commitAll(api, 'docs: the readme');

    // A submodule whose own history the task commit lands in.
    const source = initRepo(path.join(dir, '..', `${path.basename(dir)}-sdk-source`));
    writeFile(source, 'index.js', '1\n');
    commitAll(source, 'init');
    sdk = addSubmodule(dir, 'vendor/sdk', source);
    writeFile(sdk, 'lib.js', '1\n');
    commitAll(sdk, `${PREFIX}4 — the sdk`);

    // A repo with no commits yet.
    initRepo(path.join(dir, 'fresh'));
    writeFile(dir, 'fresh/notes.txt', 'nothing committed\n');
  });
  afterEach(() => {
    cleanupFixture(dir);
    cleanupFixture(`${dir}-sdk-source`);
  });

  it('log: the commits grouped by repo and oldest first, the files they touched named from the project, and each repo\'s base', () => {
    const res = harness.ok(dir, ['code', 'log', '--subject', PREFIX]);

    assert.deepStrictEqual(res.commits, [
      { repo: '.', sha: sha(dir, 'HEAD~3'), subject: `${PREFIX}1 — the app` },
      { repo: 'api', sha: sha(api, 'HEAD~2'), subject: `${PREFIX}2 — the handler` },
      { repo: 'api', sha: sha(api, 'HEAD~1'), subject: `${PREFIX}3 — the routes` },
      { repo: 'vendor/sdk', sha: sha(sdk), subject: `${PREFIX}4 — the sdk` },
    ], 'a body mention, the prefix mid-subject and the later commits are never selected; the empty repo adds nothing');
    assert.deepStrictEqual(res.files, ['api/src/handler.js', 'api/src/routes.js', 'src/app.js', 'vendor/sdk/lib.js']);
    assert.deepStrictEqual(res.repos, [
      { repo: '.', base: sha(dir, 'HEAD~4') },
      { repo: 'api', base: EMPTY_TREE },
      { repo: 'vendor/sdk', base: sha(sdk, 'HEAD~1') },
    ], 'the parent of each repo\'s earliest — the empty tree where that is the repo\'s first commit');
  });

  it('log: a prefix nothing opens answers empty', () => {
    assert.deepStrictEqual(harness.ok(dir, ['code', 'log', '--subject', 'impl(other):']),
      { ok: true, commits: [], files: [], repos: [] });
  });

  it('diff --subject: each repo\'s change from its base to HEAD, confined to the files its commits touched, named from the project', () => {
    const patch = harness.output(dir, ['code', 'diff', '--subject', PREFIX]);

    assert.deepStrictEqual(headers(patch), [
      'diff --git a/src/app.js b/src/app.js',
      'diff --git a/api/src/handler.js b/api/src/handler.js',
      'diff --git a/api/src/routes.js b/api/src/routes.js',
      'diff --git a/vendor/sdk/lib.js b/vendor/sdk/lib.js',
    ], 'the root first, then the nested repos in folder order — never a file only an unselected commit touched');
    assert.ok(patch.includes('--- a/src/app.js\n+++ b/src/app.js\n@@ -1 +1 @@\n-1\n+3\n'),
      'the range runs to HEAD: a later commit on a selected file is part of the change');
    assert.ok(patch.includes('new file mode 100644\nindex 0000000..d00491f\n--- /dev/null\n+++ b/api/src/handler.js\n'),
      'from the empty tree, the clone\'s first commit is all additions');
  });

  it('diff --subject: a prefix nothing opens prints nothing', () => {
    assert.strictEqual(harness.output(dir, ['code', 'diff', '--subject', 'impl(other):']), '');
  });
});

describe('engine code log and diff with a selection: what a commit carries', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture('engine-code-carries-');
    writeFile(dir, 'src/old.ts', 'export const x = 1;\n');
    commitAll(dir, 'chore: init');
  });
  afterEach(() => {
    cleanupFixture(dir);
    cleanupFixture(`${dir}-sdk-source`);
  });

  it('a move names both its paths, and its diff reads as a deletion and an addition', () => {
    const api = initRepo(path.join(dir, 'api'));
    writeFile(dir, '.gitignore', '.leeway/\napi/\n');
    commitAll(dir, 'chore: ignore the clone');
    writeFile(api, 'src/old.ts', 'export const x = 1;\n');
    commitAll(api, 'chore: init');
    git(api, ['mv', 'src/old.ts', 'src/new.ts']);
    git(api, ['commit', '-q', '-m', 'impl(pay): Tmv-1-1 — the move']);

    assert.deepStrictEqual(harness.ok(dir, ['code', 'log', 'pay', 'mv']).files, ['api/src/new.ts', 'api/src/old.ts']);
    const patch = harness.output(dir, ['code', 'diff', 'pay', 'mv']);
    assert.deepStrictEqual(headers(patch), ['diff --git a/api/src/new.ts b/api/src/new.ts', 'diff --git a/api/src/old.ts b/api/src/old.ts']);
    assert.ok(patch.includes('deleted file mode 100644\nindex '), 'the old path\'s deletion is part of the change');
    assert.ok(patch.includes('--- a/api/src/old.ts\n+++ /dev/null\n'));
  });

  it('a signed history reads the same under the user\'s log.showSignature', () => {
    const key = path.join(dir, '.git', 'signing-key');
    spawnSync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-f', key]);
    git(dir, ['config', 'gpg.format', 'ssh']);
    git(dir, ['config', 'user.signingkey', key]);
    for (const n of [1, 2]) {
      writeFile(dir, `src/signed-${n}.ts`, `${n}\n`);
      git(dir, ['add', '-A']);
      git(dir, ['commit', '-q', '-S', '-m', `impl(pay): Tsig-1-${n} — signed`]);
    }
    git(dir, ['config', 'log.showSignature', 'true']);
    assert.match(git(dir, ['log', '-1']), /signature/, 'the fixture prints a signature with each commit');

    assert.deepStrictEqual(harness.ok(dir, ['code', 'log', 'pay', 'sig']).files, ['src/signed-1.ts', 'src/signed-2.ts']);
  });

  it('a submodule\'s pointer is never its parent\'s change: the pointer\'s own commit drops out, a commit carrying more keeps the rest', () => {
    const source = initRepo(`${dir}-sdk-source`);
    writeFile(source, 'index.js', '1\n');
    commitAll(source, 'init');
    const sdk = addSubmodule(dir, 'vendor/sdk', source);
    writeFile(sdk, 'lib.js', '1\n');
    commitAll(sdk, 'impl(pay): Tsdk-1-1 — the client');
    git(dir, ['add', 'vendor/sdk']);
    git(dir, ['commit', '-q', '-m', 'impl(pay): Tsdk-1-1 — the client']);
    writeFile(sdk, 'lib.js', '2\n');
    commitAll(sdk, 'impl(pay): Tsdk-1-2 — the client and its caller');
    writeFile(dir, 'src/caller.ts', 'call\n');
    git(dir, ['add', 'vendor/sdk', 'src/caller.ts']);
    git(dir, ['commit', '-q', '-m', 'impl(pay): Tsdk-1-2 — the client and its caller']);

    const log = harness.ok(dir, ['code', 'log', 'pay', 'sdk']);
    assert.deepStrictEqual(log.commits.map((c) => [c.repo, c.subject]), [
      ['.', 'impl(pay): Tsdk-1-2 — the client and its caller'],
      ['vendor/sdk', 'impl(pay): Tsdk-1-1 — the client'],
      ['vendor/sdk', 'impl(pay): Tsdk-1-2 — the client and its caller'],
    ]);
    assert.deepStrictEqual(log.files, ['src/caller.ts', 'vendor/sdk/lib.js']);
    const patch = harness.output(dir, ['code', 'diff', 'pay', 'sdk']);
    assert.deepStrictEqual(headers(patch), ['diff --git a/src/caller.ts b/src/caller.ts', 'diff --git a/vendor/sdk/lib.js b/vendor/sdk/lib.js']);
    assert.ok(!patch.includes('Subproject commit'));
  });
});

describe('engine code diff and status: the change not yet committed', () => {
  let dir;
  let api;
  let kit;
  let fresh;
  beforeEach(() => {
    dir = setupGitFixture('engine-code-dirt-');
    writeFile(dir, '.gitignore', '.leeway/\napi/\n');
    writeFile(dir, 'src/app.js', '1\n');
    writeFile(dir, '.leeway/pay/manifest.json', '{}\n');
    commitAll(dir, 'init');
    api = initRepo(path.join(dir, 'api'));
    writeFile(api, 'src/handler.js', '1\n');
    commitAll(api, 'init');
    kit = initRepo(path.join(dir, 'kit'));
    writeFile(kit, 'kit.js', '1\n');
    commitAll(kit, 'init');
    const sdk = addSubmodule(dir, 'vendor/sdk', api);
    writeFile(sdk, 'moved.js', '1\n');
    commitAll(sdk, 'the pointer moves');
    fresh = initRepo(path.join(dir, 'fresh'));
  });
  afterEach(() => cleanupFixture(dir));

  it('diff: one patch per repo in repo order, its tracked change and its untracked files as additions together — named from the project, .leeway/ and the parents\' view of a nested repo held out', () => {
    writeFile(dir, 'src/app.js', '2\n');
    writeFile(dir, 'src/staged.js', 'staged\n');
    git(dir, ['add', 'src/staged.js']);
    writeFile(dir, 'src/new.js', 'new\n');
    writeFile(dir, '.leeway/pay/manifest.json', '{"changed":true}\n');
    writeFile(dir, '.leeway/pay/notes.md', 'a doc session\'s own\n');
    writeFile(api, 'src/handler.js', '2\n');
    writeFile(api, 'src/extra.js', 'extra\n');
    writeFile(kit, 'kit.js', '2\n');
    writeFile(fresh, 'staged.txt', 'staged\n');
    git(fresh, ['add', 'staged.txt']);
    writeFile(fresh, 'loose.txt', 'loose\n');

    const patch = harness.output(dir, ['code', 'diff']);

    assert.deepStrictEqual(headers(patch), [
      'diff --git a/src/app.js b/src/app.js',
      'diff --git a/src/new.js b/src/new.js',
      'diff --git a/src/staged.js b/src/staged.js',
      'diff --git a/api/src/extra.js b/api/src/extra.js',
      'diff --git a/api/src/handler.js b/api/src/handler.js',
      'diff --git a/fresh/loose.txt b/fresh/loose.txt',
      'diff --git a/fresh/staged.txt b/fresh/staged.txt',
      'diff --git a/kit/kit.js b/kit/kit.js',
    ], 'a repo with no commits yet shows every file as an addition; a submodule\'s moved pointer is no change');
    assert.ok(patch.includes('--- /dev/null\n+++ b/fresh/staged.txt\n@@ -0,0 +1 @@\n+staged\n'));
    assert.ok(patch.includes('--- /dev/null\n+++ b/api/src/extra.js\n@@ -0,0 +1 @@\n+extra\n'));
  });

  it('diff: the real index is never touched — what is staged stays staged, and no untracked file is left intent-to-add', () => {
    writeFile(dir, 'src/staged.js', 'staged\n');
    git(dir, ['add', 'src/staged.js']);
    writeFile(dir, 'src/new.js', 'new\n');
    writeFile(api, 'src/extra.js', 'extra\n');
    const before = [dir, api].map((repo) => [git(repo, ['diff', '--cached']), git(repo, ['ls-files', '--stage']), git(repo, ['status', '--porcelain'])]);

    assert.match(harness.output(dir, ['code', 'diff']), /\+\+\+ b\/src\/new\.js/);

    assert.deepStrictEqual([dir, api].map((repo) => [git(repo, ['diff', '--cached']), git(repo, ['ls-files', '--stage']), git(repo, ['status', '--porcelain'])]), before);
    assert.deepStrictEqual(fs.readdirSync(path.join(dir, '.git')).filter((name) => name.startsWith('workflows-')), [], 'the scratch index is removed');
  });

  it('diff: an edit made in the index\'s own second still reads as a change — the scratch index keeps the real one\'s time', () => {
    git(dir, ['config', 'core.trustctime', 'false']);
    const file = path.join(dir, 'src/app.js');
    const index = path.join(dir, '.git/index');
    const second = Math.floor(Date.now() / 1000) - 60;
    fs.utimesSync(file, second, second);
    git(dir, ['add', 'src/app.js']);
    fs.writeFileSync(file, '2\n');
    fs.utimesSync(file, second, second);
    fs.utimesSync(index, second, second);

    assert.deepStrictEqual(headers(harness.output(dir, ['code', 'diff'])), ['diff --git a/src/app.js b/src/app.js']);
  });

  it('diff: an untracked file with CRLF endings under core.autocrlf=input, and an untracked link to a folder, read as additions', () => {
    git(dir, ['config', 'core.autocrlf', 'input']);
    writeFile(dir, 'src/crlf.txt', 'one\r\ntwo\r\n');
    fs.symlinkSync('src', path.join(dir, 'srclink'));

    const patch = harness.output(dir, ['code', 'diff']);

    assert.deepStrictEqual(headers(patch), ['diff --git a/src/crlf.txt b/src/crlf.txt', 'diff --git a/srclink b/srclink']);
    assert.ok(patch.includes('new file mode 120000'), 'the link reads as the link it is');
    assert.ok(patch.includes('+one'));
  });

  it('a diff whose git exits anything but 0 fails — exit 1 included, never read as a patch', () => {
    writeFile(dir, 'src/app.js', '2\n');

    assert.match(diffPatch(dir, ['HEAD']), /^\+2/m);
    assert.throws(() => diffPatch(dir, ['--exit-code', 'HEAD']), /^Error: git diff failed/);
    assert.throws(() => diffPatch(dir, ['no-such-rev']), /^Error: git diff failed/);
  });

  it('diff: a clean project prints nothing', () => {
    assert.strictEqual(harness.output(dir, ['code', 'diff']), '');
  });

  it('status: untracked files are read whatever the user\'s status.showUntrackedFiles', () => {
    git(dir, ['config', 'status.showUntrackedFiles', 'no']);
    writeFile(dir, 'src/new/one.js', '1\n');

    assert.deepStrictEqual(harness.ok(dir, ['code', 'status']).files, [{ path: 'src/new/one.js', status: '??' }]);
  });

  it('status names each untracked file in a new folder on its own, so a commit naming the task\'s file leaves a stranger\'s in left_dirty by name', () => {
    writeFile(dir, '.leeway/pay/manifest.json', JSON.stringify({
      name: 'pay', work_type: 'feature', status: 'in-progress',
      phases: { implementation: { items: { pay: { status: 'in-progress' } } } },
    }));
    harness.stateGit(dir, ['add', 'pay/manifest.json']);
    harness.stateGit(dir, ['commit', '-q', '-m', 'chore: the work unit']);
    writeFile(dir, 'src/billing/charge.js', 'the task\'s\n');
    writeFile(dir, 'src/billing/stranger.js', 'not the task\'s\n');
    writeFile(api, 'src/billing/refund.js', 'not the task\'s\n');

    assert.deepStrictEqual(harness.ok(dir, ['code', 'status']).files, [
      { path: 'src/billing/charge.js', status: '??' },
      { path: 'src/billing/stranger.js', status: '??' },
      { path: 'api/src/billing/refund.js', status: '??' },
    ]);
    const res = harness.ok(dir, ['commit', '--paths', 'src/billing/charge.js', '-m', 'impl(pay): Tpay-1-1 — the charge', '--for', 'pay', 'implementation/pay']);
    assert.deepStrictEqual(git(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim(), 'src/billing/charge.js');
    assert.deepStrictEqual(res.left_dirty, ['src/billing/stranger.js', 'api/src/billing/refund.js']);
  });

  it('a repo inside the project\'s .leeway/ is the workflows\' own — never a repo of the project, its dirt and commits never code', () => {
    const imported = initRepo(path.join(dir, '.leeway/pay/imports/checkout'));
    writeFile(imported, 'lib.js', '1\n');
    commitAll(imported, `${PREFIX}1 — an imported checkout`);
    writeFile(imported, 'lib.js', '2\n');

    assert.deepStrictEqual(harness.ok(dir, ['code', 'status']).files, []);
    assert.deepStrictEqual(harness.ok(dir, ['code', 'log', '--subject', PREFIX]).commits, []);
    assert.strictEqual(harness.output(dir, ['code', 'diff']), '');
  });

  it('status: every repo\'s uncommitted files with their porcelain status, named from the project', () => {
    writeFile(dir, 'src/app.js', '2\n');
    writeFile(dir, '.leeway/pay/notes.md', 'a doc session\'s own\n');
    writeFile(api, 'src/extra.js', 'extra\n');
    writeFile(fresh, 'loose.txt', 'loose\n');

    assert.deepStrictEqual(harness.ok(dir, ['code', 'status']), {
      ok: true,
      files: [
        { path: 'src/app.js', status: ' M' },
        { path: 'api/src/extra.js', status: '??' },
        { path: 'fresh/loose.txt', status: '??' },
      ],
    });
  });
});

describe('engine code: the state held out of the code\'s dirt where nothing ignores it', () => {
  let dir;
  let side;
  beforeEach(() => {
    dir = setupGitFixture('engine-code-unignored-');
    writeFile(dir, '.leeway/pay/manifest.json', JSON.stringify({
      name: 'pay',
      work_type: 'feature',
      status: 'in-progress',
      phases: { implementation: { items: { pay: { status: 'in-progress' } } } },
    }, null, 2) + '\n');
    writeFile(dir, 'src/app.js', '1\n');
    commitAll(dir, 'init');
    // Tracked files alone: an `add -A` would take the unignored state in as
    // a nested repository.
    writeFile(dir, '.gitignore', '');
    git(dir, ['commit', '-q', '-am', 'nothing ignored']);
    side = `${dir}-side`;
    git(dir, ['worktree', 'add', '-q', '-b', 'side', side]);
  });
  afterEach(() => {
    cleanupFixture(side);
    cleanupFixture(dir);
  });

  it('code status and a code commit\'s left_dirty never name .leeway/ — from the main checkout, a code worktree, and inside the state', () => {
    const state = path.join(dir, '.leeway');
    writeFile(state, 'pay/notes.md', 'a doc session\'s own\n');
    assert.match(git(dir, ['status', '--porcelain']), /^\?\? \.leeway\/$/m, 'git sees the state: the hold-out alone keeps it out');

    for (const [where, checkout] of [[dir, dir], [side, side], [state, dir]]) {
      assert.deepStrictEqual(harness.ok(where, ['code', 'status']).files, [], `code status from ${where}`);
      writeFile(checkout, 'src/app.js', `${where}\n`);
      const res = harness.ok(where, ['commit', '--paths', path.join(checkout, 'src/app.js'), '-m', 'impl(pay): the app', '--for', 'pay', 'implementation/pay']);
      assert.deepStrictEqual(res.left_dirty, [], `left_dirty from ${where}`);
    }
  });
});

describe('engine code in a project of one repo: what git answers', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture('engine-code-single-');
    writeFile(dir, 'src/app.js', '1\n');
    writeFile(dir, 'src/lib.js', '1\n');
    commitAll(dir, 'chore: init');
    writeFile(dir, 'src/app.js', '2\n');
    commitAll(dir, `${PREFIX}1 — the app`);
    writeFile(dir, 'src/lib.js', '2\n');
    commitAll(dir, 'chore: the lib');
    writeFile(dir, 'src/app.js', '3\n');
    commitAll(dir, `${PREFIX}2 — the app again`);
  });
  afterEach(() => cleanupFixture(dir));

  it('log and diff --subject answer what git log and git diff do over the same range', () => {
    const log = harness.ok(dir, ['code', 'log', '--subject', PREFIX]);
    const selected = git(dir, ['log', '--reverse', '--format=%H %s', `--grep=${PREFIX}`, '--fixed-strings'])
      .split('\n').filter(Boolean).map((line) => ({ repo: '.', sha: line.slice(0, 40), subject: line.slice(41) }));
    assert.deepStrictEqual(log.commits, selected);
    assert.deepStrictEqual(log.files, ['src/app.js']);
    assert.deepStrictEqual(log.repos, [{ repo: '.', base: sha(dir, `${selected[0].sha}^`) }]);

    assert.strictEqual(harness.output(dir, ['code', 'diff', '--subject', PREFIX]),
      git(dir, ['diff', `${selected[0].sha}^`, 'HEAD', '--', 'src/app.js']));
  });

  it('diff answers git diff HEAD with the untracked files intent-to-add; status answers the porcelain', () => {
    writeFile(dir, 'src/app.js', '4\n');
    writeFile(dir, 'src/new.js', 'new\n');

    const patch = harness.output(dir, ['code', 'diff']);
    assert.deepStrictEqual(harness.ok(dir, ['code', 'status']).files, [
      { path: 'src/app.js', status: ' M' },
      { path: 'src/new.js', status: '??' },
    ]);
    git(dir, ['add', '--intent-to-add', 'src/new.js']);
    assert.strictEqual(patch, git(dir, ['diff', 'HEAD']));
  });
});

describe('engine code log and diff <work-unit> <topic>: a topic\'s task commits', () => {
  let dir;
  let api;
  beforeEach(() => {
    dir = setupGitFixture('engine-code-task-');
    writeFile(dir, '.gitignore', '.leeway/\napi/\n');
    commitAll(dir, 'chore: init');
    writeFile(dir, 'src/auth.js', '1\n');
    commitAll(dir, 'impl(pay): Tauth-1-1 — login');
    writeFile(dir, 'src/logout.js', '1\n');
    commitAll(dir, 'impl(pay): Tauth-2-1 — logout');
    writeFile(dir, 'src/stray.js', '1\n');
    commitAll(dir, 'impl(pay): Tauth-1-1x — no internal id');
    // The state's own commit, on the state branch: never a task commit of the code.
    writeFile(dir, '.leeway/pay/manifest.json', '{}\n');
    commitAll(dir, 'impl(pay): record Tauth-1-1');
    api = initRepo(path.join(dir, 'api'));
    writeFile(api, 'src/flow.js', '1\n');
    commitAll(api, 'impl(pay): Tauth-flow-1-1 — the sibling topic');
    writeFile(api, 'src/api.js', '1\n');
    commitAll(api, 'impl(pay): Tauth-1-2');
  });
  afterEach(() => cleanupFixture(dir));

  it('log: every task commit of the topic across the repos — never a sibling topic whose name extends it, never a subject whose id runs on', () => {
    const res = harness.ok(dir, ['code', 'log', 'pay', 'auth']);

    assert.deepStrictEqual(res.commits.map((c) => [c.repo, c.subject]), [
      ['.', 'impl(pay): Tauth-1-1 — login'],
      ['.', 'impl(pay): Tauth-2-1 — logout'],
      ['api', 'impl(pay): Tauth-1-2'],
    ]);
    assert.deepStrictEqual(res.files, ['api/src/api.js', 'src/auth.js', 'src/logout.js']);
    assert.deepStrictEqual(res.repos, [{ repo: '.', base: sha(dir, 'HEAD~3') }, { repo: 'api', base: sha(api, 'HEAD~1') }]);
    assert.deepStrictEqual(harness.ok(dir, ['code', 'log', 'pay', 'auth-flow']).commits.map((c) => c.subject),
      ['impl(pay): Tauth-flow-1-1 — the sibling topic']);
  });

  it('log: an id ends the subject or meets a character no id continues with — a colon, an em dash with no space', () => {
    const subjects = [
      'impl(pay): Tauth-1-3: the colon',
      'impl(pay): Tauth-1-4—no space',
      'impl(pay): Tauth-1-5',
      'impl(pay): Tauth-1-12 — runs to its own end',
      'impl(pay): Tauth-1-1_x — an underscore runs on',
      'impl(pay): Tauth-2-1-1 — the auth-2 topic',
    ];
    subjects.forEach((subject, i) => {
      writeFile(dir, `src/edge-${i}.js`, '1\n');
      commitAll(dir, subject);
    });

    assert.deepStrictEqual(harness.ok(dir, ['code', 'log', 'pay', 'auth', '--phase', '1']).commits.map((c) => c.subject), [
      'impl(pay): Tauth-1-1 — login',
      'impl(pay): Tauth-1-3: the colon',
      'impl(pay): Tauth-1-4—no space',
      'impl(pay): Tauth-1-5',
      'impl(pay): Tauth-1-12 — runs to its own end',
      'impl(pay): Tauth-1-2',
    ]);
    assert.deepStrictEqual(harness.ok(dir, ['code', 'log', 'pay', 'auth-2']).commits.map((c) => c.subject),
      ['impl(pay): Tauth-2-1-1 — the auth-2 topic'], 'and auth\'s own Tauth-2-1 is never auth-2\'s');
  });

  it('log --phase: only that phase\'s task commits, and each repo\'s base from its earliest of them', () => {
    const res = harness.ok(dir, ['code', 'log', 'pay', 'auth', '--phase', '2']);

    assert.deepStrictEqual(res.commits.map((c) => [c.repo, c.subject]), [['.', 'impl(pay): Tauth-2-1 — logout']]);
    assert.deepStrictEqual(res.files, ['src/logout.js']);
    assert.deepStrictEqual(res.repos, [{ repo: '.', base: sha(dir, 'HEAD~2') }]);
    assert.deepStrictEqual(harness.ok(dir, ['code', 'log', 'pay', 'auth', '--phase', '1']).files, ['api/src/api.js', 'src/auth.js']);
  });

  it('diff: the change the selected commits made, confined to their files', () => {
    assert.deepStrictEqual(headers(harness.output(dir, ['code', 'diff', 'pay', 'auth', '--phase', '1'])), [
      'diff --git a/src/auth.js b/src/auth.js',
      'diff --git a/api/src/api.js b/api/src/api.js',
    ]);
    assert.deepStrictEqual(headers(harness.output(dir, ['code', 'diff', 'pay', 'auth'])), [
      'diff --git a/src/auth.js b/src/auth.js',
      'diff --git a/src/logout.js b/src/logout.js',
      'diff --git a/api/src/api.js b/api/src/api.js',
    ]);
  });
});

describe('engine code in a project nested inside a larger repository: the project\'s folder alone, named from it', () => {
  let dir;
  let project;
  let api;
  let kit;
  beforeEach(() => {
    dir = setupGitFixture('engine-code-nested-');
    project = path.join(dir, 'apps/web');
    writeFile(project, '.gitignore', 'api/\n');
    writeFile(project, 'src/app.js', '1\n');
    writeFile(dir, 'other/o.js', '1\n');
    commitAll(dir, 'chore: init');
    writeFile(project, 'src/app.js', '2\n');
    writeFile(dir, 'other/o.js', '2\n');
    commitAll(dir, 'impl(pay): Tweb-1-1 — the project and its sibling');
    writeFile(dir, 'other/o.js', '3\n');
    commitAll(dir, 'impl(pay): Tweb-1-2 — the sibling alone');
    api = initRepo(path.join(project, 'api'));
    writeFile(api, 'src/handler.js', '1\n');
    commitAll(api, 'impl(pay): Tweb-1-3 — the clone');
    kit = initRepo(path.join(project, 'kit'));
    writeFile(kit, 'kit.js', '1\n');
    commitAll(kit, 'init');
  });
  afterEach(() => cleanupFixture(dir));

  it('log: a commit that touched nothing in the project is none of its, and every path is the project\'s', () => {
    const res = harness.ok(project, ['code', 'log', 'pay', 'web']);

    assert.deepStrictEqual(res.commits.map((c) => [c.repo, c.subject]), [
      ['.', 'impl(pay): Tweb-1-1 — the project and its sibling'],
      ['api', 'impl(pay): Tweb-1-3 — the clone'],
    ]);
    assert.deepStrictEqual(res.files, ['api/src/handler.js', 'src/app.js']);
    assert.deepStrictEqual(res.repos, [{ repo: '.', base: sha(dir, 'HEAD~2') }, { repo: 'api', base: EMPTY_TREE }]);
  });

  it('diff with a selection: headers named from the project, nothing outside it', () => {
    assert.deepStrictEqual(headers(harness.output(project, ['code', 'diff', 'pay', 'web'])), [
      'diff --git a/src/app.js b/src/app.js',
      'diff --git a/api/src/handler.js b/api/src/handler.js',
    ]);
  });

  it('diff and status: the uncommitted change in the project alone — the larger repository\'s dirt, the ignored clone\'s folder and the nested repo\'s held out of the root', () => {
    writeFile(project, 'src/app.js', '3\n');
    writeFile(project, 'src/new.js', 'new\n');
    writeFile(dir, 'other/o.js', '4\n');
    writeFile(dir, 'other/new.js', 'new\n');
    writeFile(api, 'src/handler.js', '2\n');
    writeFile(kit, 'kit.js', '2\n');

    assert.deepStrictEqual(headers(harness.output(project, ['code', 'diff'])), [
      'diff --git a/src/app.js b/src/app.js',
      'diff --git a/src/new.js b/src/new.js',
      'diff --git a/api/src/handler.js b/api/src/handler.js',
      'diff --git a/kit/kit.js b/kit/kit.js',
    ]);
    assert.deepStrictEqual(harness.ok(project, ['code', 'status']).files, [
      { path: 'src/app.js', status: ' M' },
      { path: 'src/new.js', status: '??' },
      { path: 'api/src/handler.js', status: ' M' },
      { path: 'kit/kit.js', status: ' M' },
    ]);
  });
});

describe('engine code: usage', () => {
  let dir;
  beforeEach(() => { dir = setupGitFixture('engine-code-usage-'); });
  afterEach(() => cleanupFixture(dir));

  it('refuses a missing or empty prefix, the two forms mixed, a phase that is no phase number, an unknown flag, a stray positional and an unknown verb', () => {
    for (const args of [
      ['code'],
      ['code', 'nope'],
      ['code', 'log'],
      ['code', 'log', '--subject'],
      ['code', 'log', '--subject', ''],
      ['code', 'log', '--subject', 'a', '--subject', 'b'],
      ['code', 'log', '--subject', 'a', 'extra'],
      ['code', 'log', '--subject', 'a', '--phase', '1'],
      ['code', 'log', 'pay', 'auth', '--subject', 'a'],
      ['code', 'log', 'pay'],
      ['code', 'log', 'pay', 'auth', 'extra'],
      ['code', 'log', 'pay', ''],
      ['code', 'log', 'pay', 'auth', '--phase'],
      ['code', 'log', 'pay', 'auth', '--phase', 'two'],
      ['code', 'log', 'pay', 'auth', '--phase', '0'],
      ['code', 'log', 'pay', 'auth', '--phase', '1', '--phase', '2'],
      ['code', 'log', '--phase', '1'],
      ['code', 'log', '--grep', 'a'],
      ['code', 'diff', '--subject'],
      ['code', 'diff', '--bogus', 'x'],
      ['code', 'diff', 'extra'],
      ['code', 'diff', '--phase', '1'],
      ['code', 'status', '--subject', 'a'],
      ['code', 'status', 'pay', 'auth'],
      ['code', 'status', 'extra'],
    ]) {
      assert.match(harness.refuses(dir, args).error,
        /^Usage: engine code log \(<work-unit> <topic> \[--phase <N>\] \| --subject <prefix>\) \| engine code diff \[<work-unit> <topic> \[--phase <N>\] \| --subject <prefix>\] \| engine code status$/,
        args.join(' '));
    }
  });
});
