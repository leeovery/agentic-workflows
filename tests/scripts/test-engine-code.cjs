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

const { git, initRepo, setupGitFixture, addSubmodule, cleanupFixture } = harness;

const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const PREFIX = 'impl(pay): T1-';

function writeFile(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function commitAll(dir, message) {
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', message]);
}

const sha = (dir, rev = 'HEAD') => git(dir, ['rev-parse', rev]).trim();

/** The `diff --git` header lines of a patch, in order. */
const headers = (patch) => patch.split('\n').filter((line) => line.startsWith('diff --git '));

/** What `git diff --no-index` prints for an untracked file — it exits 1 when the sides differ. */
function addedByGit(dir, file) {
  const res = spawnSync('git', ['diff', '--no-index', '--', '/dev/null', file], { cwd: dir, encoding: 'utf8' });
  assert.strictEqual(res.status, 1, res.stderr);
  return res.stdout;
}

describe('engine code log and diff --subject: the commits a subject prefix selects', () => {
  let dir;
  let api;
  let sdk;
  beforeEach(() => {
    dir = setupGitFixture('engine-code-log-');
    writeFile(dir, '.gitignore', 'api/\n');
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

describe('engine code diff and status: the change not yet committed', () => {
  let dir;
  let api;
  let kit;
  let fresh;
  beforeEach(() => {
    dir = setupGitFixture('engine-code-dirt-');
    writeFile(dir, '.gitignore', 'api/\n');
    writeFile(dir, 'src/app.js', '1\n');
    writeFile(dir, '.workflows/pay/manifest.json', '{}\n');
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

  it('diff: every repo\'s tracked change, then every untracked file as an addition — named from the project, .workflows/ and the parents\' view of a nested repo held out', () => {
    writeFile(dir, 'src/app.js', '2\n');
    writeFile(dir, 'src/staged.js', 'staged\n');
    git(dir, ['add', 'src/staged.js']);
    writeFile(dir, 'src/new.js', 'new\n');
    writeFile(dir, '.workflows/pay/manifest.json', '{"changed":true}\n');
    writeFile(dir, '.workflows/pay/notes.md', 'a doc session\'s own\n');
    writeFile(api, 'src/handler.js', '2\n');
    writeFile(api, 'src/extra.js', 'extra\n');
    writeFile(kit, 'kit.js', '2\n');
    writeFile(fresh, 'staged.txt', 'staged\n');
    git(fresh, ['add', 'staged.txt']);
    writeFile(fresh, 'loose.txt', 'loose\n');

    const patch = harness.output(dir, ['code', 'diff']);

    assert.deepStrictEqual(headers(patch), [
      'diff --git a/src/app.js b/src/app.js',
      'diff --git a/src/staged.js b/src/staged.js',
      'diff --git a/api/src/handler.js b/api/src/handler.js',
      'diff --git a/fresh/staged.txt b/fresh/staged.txt',
      'diff --git a/kit/kit.js b/kit/kit.js',
      'diff --git a/src/new.js b/src/new.js',
      'diff --git a/api/src/extra.js b/api/src/extra.js',
      'diff --git a/fresh/loose.txt b/fresh/loose.txt',
    ], 'a repo with no commits yet shows every file as an addition; a submodule\'s moved pointer is no change');
    assert.ok(patch.includes('--- /dev/null\n+++ b/fresh/staged.txt\n@@ -0,0 +1 @@\n+staged\n'));
    assert.ok(patch.includes('--- /dev/null\n+++ b/api/src/extra.js\n@@ -0,0 +1 @@\n+extra\n'));
  });

  it('diff: a clean project prints nothing', () => {
    assert.strictEqual(harness.output(dir, ['code', 'diff']), '');
  });

  it('status: every repo\'s uncommitted files with their porcelain status, named from the project', () => {
    writeFile(dir, 'src/app.js', '2\n');
    writeFile(dir, '.workflows/pay/notes.md', 'a doc session\'s own\n');
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

  it('diff answers git diff HEAD, then each untracked file as git diff --no-index adds it; status answers the porcelain', () => {
    writeFile(dir, 'src/app.js', '4\n');
    writeFile(dir, 'src/new.js', 'new\n');

    assert.strictEqual(harness.output(dir, ['code', 'diff']), git(dir, ['diff', 'HEAD']) + addedByGit(dir, 'src/new.js'));
    assert.deepStrictEqual(harness.ok(dir, ['code', 'status']).files, [
      { path: 'src/app.js', status: ' M' },
      { path: 'src/new.js', status: '??' },
    ]);
  });
});

describe('engine code log and diff <work-unit> <topic>: a topic\'s task commits', () => {
  let dir;
  let api;
  beforeEach(() => {
    dir = setupGitFixture('engine-code-task-');
    writeFile(dir, '.gitignore', 'api/\n');
    commitAll(dir, 'chore: init');
    writeFile(dir, 'src/auth.js', '1\n');
    commitAll(dir, 'impl(pay): Tauth-1-1 — login');
    writeFile(dir, 'src/logout.js', '1\n');
    commitAll(dir, 'impl(pay): Tauth-2-1 — logout');
    writeFile(dir, 'src/stray.js', '1\n');
    commitAll(dir, 'impl(pay): Tauth-1-1x — no internal id');
    writeFile(dir, '.workflows/pay/manifest.json', '{}\n');
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
    assert.deepStrictEqual(res.repos, [{ repo: '.', base: sha(dir, 'HEAD~4') }, { repo: 'api', base: sha(api, 'HEAD~1') }]);
    assert.deepStrictEqual(harness.ok(dir, ['code', 'log', 'pay', 'auth-flow']).commits.map((c) => c.subject),
      ['impl(pay): Tauth-flow-1-1 — the sibling topic']);
  });

  it('log --phase: only that phase\'s task commits, and each repo\'s base from its earliest of them', () => {
    const res = harness.ok(dir, ['code', 'log', 'pay', 'auth', '--phase', '2']);

    assert.deepStrictEqual(res.commits.map((c) => [c.repo, c.subject]), [['.', 'impl(pay): Tauth-2-1 — logout']]);
    assert.deepStrictEqual(res.files, ['src/logout.js']);
    assert.deepStrictEqual(res.repos, [{ repo: '.', base: sha(dir, 'HEAD~3') }]);
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

  it('diff and status: the uncommitted change in the project alone — the larger repository\'s dirt, .workflows/, the ignored clone\'s folder and the nested repo\'s held out of the root', () => {
    writeFile(project, 'src/app.js', '3\n');
    writeFile(project, 'src/new.js', 'new\n');
    writeFile(project, '.workflows/pay/notes.md', 'a doc session\'s own\n');
    writeFile(dir, 'other/o.js', '4\n');
    writeFile(dir, 'other/new.js', 'new\n');
    writeFile(api, 'src/handler.js', '2\n');
    writeFile(kit, 'kit.js', '2\n');

    assert.deepStrictEqual(headers(harness.output(project, ['code', 'diff'])), [
      'diff --git a/src/app.js b/src/app.js',
      'diff --git a/api/src/handler.js b/api/src/handler.js',
      'diff --git a/kit/kit.js b/kit/kit.js',
      'diff --git a/src/new.js b/src/new.js',
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
