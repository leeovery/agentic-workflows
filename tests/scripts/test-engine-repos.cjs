'use strict';

//
// Tests for the project's repos (kernel/repos.cjs): which folders inside a
// project are repos of their own, which repo owns a path, the order a code
// commit takes through them, and the dirt and history read across them.
//

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { git, initRepo, setupGitFixture, addSubmodule, cleanupFixture } = require('./engine-harness.cjs');
const { projectRepos, repoOf, commitGroups, projectDirtyEntries, projectPathsTouchedBySubject } = require('../../skills/workflow-engine/scripts/kernel/repos.cjs');

function writeFile(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function commitAll(dir, message) {
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', message]);
}

/** A repo of its own at `rel` inside `dir`, one commit holding `file`. */
function nestedRepo(dir, rel, file = 'index.js') {
  const repo = initRepo(path.join(dir, rel));
  writeFile(repo, file, '1\n');
  commitAll(repo, 'init');
  return repo;
}

const dirsOf = (repos) => repos.map((repo) => repo.dir);

describe('projectRepos: the repos a project holds', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture('engine-repos-');
    writeFile(dir, '.gitignore', '.leeway/\napi/\nnode_modules/\n');
    writeFile(dir, 'src/app.js', '1\n');
    commitAll(dir, 'init');
  });
  afterEach(() => cleanupFixture(dir));

  it('finds an ignored clone, an untracked repo at any depth, a submodule and a repo inside another — the root first, then by folder', () => {
    const api = nestedRepo(dir, 'api');
    nestedRepo(dir, 'api/lib');
    writeFile(dir, 'packages/notes.txt', 'a loose file beside the repo\n');
    nestedRepo(dir, 'packages/tools/cli');
    addSubmodule(dir, 'vendor/sdk', api);

    const repos = projectRepos(dir);

    assert.deepStrictEqual(dirsOf(repos), ['', 'api', 'api/lib', 'packages/tools/cli', 'vendor/sdk']);
    assert.deepStrictEqual(repos.map((repo) => repo.path),
      [dir, ...['api', 'api/lib', 'packages/tools/cli', 'vendor/sdk'].map((rel) => path.join(dir, rel))]);
    assert.deepStrictEqual(repos.map((repo) => repo.heldOut), [['packages/tools/cli', 'vendor/sdk'], ['lib'], [], [], []],
      'each git holds out the untracked repos and submodules directly inside it — never one it ignores, never one further down');
    assert.deepStrictEqual(repos.map((repo) => repo.submodules), [['vendor/sdk'], [], [], [], []]);
  });

  it('never looks inside an ignored folder that is not a repo, and takes no submodule with nothing checked out', () => {
    writeFile(dir, 'node_modules/left-pad/index.js', '1\n');
    nestedRepo(dir, 'node_modules/dep');
    const sha = git(dir, ['rev-parse', 'HEAD']).trim();
    git(dir, ['update-index', '--add', '--cacheinfo', `160000,${sha},libs/absent`]);

    assert.deepStrictEqual(projectRepos(dir), [{ dir: '', path: dir, heldOut: [], submodules: [] }]);
  });

  it('a linked worktree of the project\'s own repository is no repo of its own — its folder stays the root\'s dirt', () => {
    git(dir, ['worktree', 'add', '-q', '-b', 'side', path.join(dir, 'trees/side')]);
    const api = nestedRepo(dir, 'api');
    addSubmodule(dir, 'vendor/sdk', api);

    const repos = projectRepos(dir);

    assert.deepStrictEqual(dirsOf(repos), ['', 'api', 'vendor/sdk'], 'a submodule\'s own git dir is not the root\'s');
    assert.deepStrictEqual(repos[0].heldOut, ['vendor/sdk']);
    assert.deepStrictEqual(projectDirtyEntries(repos), [{ path: 'trees/side/', status: '??' }]);
  });

  it('knows the project\'s own worktree reached through a symbolic link', () => {
    git(dir, ['worktree', 'add', '-q', '-b', 'side', path.join(dir, 'trees/side')]);
    const link = `${dir}-link`;
    fs.symlinkSync(dir, link);
    try {
      assert.deepStrictEqual(dirsOf(projectRepos(link)), ['']);
    } finally {
      fs.rmSync(link);
    }
  });

  it('takes a folder whose .git git cannot read for no repo — never a failure', () => {
    writeFile(dir, '.gitignore', '.leeway/\napi/\nnode_modules/\nstale/\n');
    commitAll(dir, 'ignore the stale worktree');
    git(dir, ['worktree', 'add', '-q', '-b', 'stale', path.join(dir, 'stale')]);
    fs.rmSync(path.join(dir, '.git/worktrees/stale'), { recursive: true });

    assert.deepStrictEqual(dirsOf(projectRepos(dir)), ['']);
  });

  it('takes a folder whose repository cannot be resolved for no repo — a dangling .git link, a git dir the resolve fails on', () => {
    fs.mkdirSync(path.join(dir, 'node_modules/broken'), { recursive: true });
    fs.symlinkSync(path.join(dir, 'nowhere'), path.join(dir, 'node_modules/broken/.git'));
    const api = initRepo(path.join(dir, 'api'));
    writeFile(api, 'index.js', '1\n');
    commitAll(api, 'init');
    const realpathSync = fs.realpathSync;
    fs.realpathSync = /** @type {typeof fs.realpathSync} */ ((/** @type {string} */ p, ...rest) => {
      if (String(p).endsWith(`${path.sep}api${path.sep}.git`)) throw Object.assign(new Error(`EACCES: permission denied, realpath '${p}'`), { code: 'EACCES' });
      return realpathSync(p, ...rest);
    });
    try {
      assert.deepStrictEqual(dirsOf(projectRepos(dir)), ['']);
    } finally {
      fs.realpathSync = realpathSync;
    }
  });

  it('a project nested in a larger repository finds only the repos inside it', () => {
    const project = path.join(dir, 'apps/web');
    writeFile(project, 'src/app.js', '1\n');
    commitAll(dir, 'the project');
    nestedRepo(dir, 'tools');
    nestedRepo(project, 'service');

    assert.deepStrictEqual(projectRepos(project), [
      { dir: '', path: project, heldOut: ['service'], submodules: [] },
      { dir: 'service', path: path.join(project, 'service'), heldOut: [], submodules: [] },
    ]);
  });
});

describe('commitGroups: a code commit\'s order', () => {
  const repo = (dir, submodules = []) => ({ dir, path: `/p/${dir}`, heldOut: submodules, submodules });
  const repos = [repo('', ['sdk']), repo('api'), repo('sdk', ['inner']), repo('sdk/inner'), repo('web')];
  const plan = (paths) => commitGroups(repos, paths).map((group) => [group.repo.dir, group.paths]);

  it('commits the deepest repos first, then by folder, so a repo commits before the one it is nested in', () => {
    assert.deepStrictEqual(plan(['app.js', 'web/x.js', 'api/y.js']), [['api', ['y.js']], ['web', ['x.js']], ['', ['app.js']]]);
  });

  it('a parent takes the folder of each submodule the call reaches into, up the chain — never an untouched one', () => {
    assert.deepStrictEqual(plan(['sdk/inner/x.js']), [['sdk/inner', ['x.js']], ['sdk', ['inner']], ['', ['sdk']]]);
    assert.deepStrictEqual(plan(['app.js', 'sdk/z.js']), [['sdk', ['z.js']], ['', ['app.js', 'sdk']]]);
    assert.deepStrictEqual(plan(['app.js']), [['', ['app.js']]]);
  });
});

describe('repoOf: the repo that owns a path', () => {
  const repos = [{ dir: '', path: '/p' }, { dir: 'api', path: '/p/api' }, { dir: 'api/lib', path: '/p/api/lib' }];

  it('answers the deepest repo whose folder holds the path, else the root', () => {
    assert.strictEqual(repoOf(repos, 'api/lib/x.js').dir, 'api/lib');
    assert.strictEqual(repoOf(repos, 'api/src/x.js').dir, 'api');
    assert.strictEqual(repoOf(repos, 'api').dir, 'api', 'a repo owns its own folder');
    assert.strictEqual(repoOf(repos, 'apiary/x.js').dir, '', 'a folder sharing the name\'s prefix is not inside it');
    assert.strictEqual(repoOf(repos, 'src/app.js').dir, '');
  });
});

describe('dirt and history across the repos', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture('engine-repos-dirt-');
    writeFile(dir, '.gitignore', '.leeway/\napi/\n');
    commitAll(dir, 'chore: ignore the clone');
    writeFile(dir, 'src/app.js', '1\n');
    commitAll(dir, 'impl(pay): T1 — the app');
  });
  afterEach(() => cleanupFixture(dir));

  it('reads every repo\'s dirt in project paths, each untracked file on its own, the root first — never a parent\'s view of a nested repo, never .leeway/', () => {
    const api = nestedRepo(dir, 'api', 'src/handler.js');
    const cli = nestedRepo(dir, 'tools/cli');
    writeFile(dir, 'packages/notes.txt', 'loose\n');
    const kit = nestedRepo(dir, 'packages/kit');
    const sdk = addSubmodule(dir, 'vendor/sdk', api);
    writeFile(sdk, 'moved.js', '1\n');
    commitAll(sdk, 'the pointer moves');
    writeFile(sdk, 'src/handler.js', '2\n');
    writeFile(sdk, 'src/new/sdk.js', 'new\n');
    writeFile(dir, 'src/app.js', '2\n');
    writeFile(dir, 'src/new/a.js', 'new\n');
    writeFile(dir, 'src/new/b.js', 'new\n');
    writeFile(api, 'src/handler.js', '2\n');
    writeFile(api, 'src/new/api.js', 'new\n');
    writeFile(cli, 'bin/run.js', 'new\n');
    writeFile(kit, 'lib/kit.js', 'new\n');
    writeFile(dir, '.leeway/pay/notes.md', 'a doc session\'s own\n');
    writeFile(dir, '.gitignore', 'api/\n');

    assert.deepStrictEqual(git(dir, ['status', '--porcelain', '--untracked-files=all']).split('\n').filter(Boolean), [
      ' M .gitignore', ' M src/app.js', ' M vendor/sdk', '?? .leeway/', '?? packages/kit/', '?? packages/notes.txt',
      '?? src/new/a.js', '?? src/new/b.js', '?? tools/cli/',
    ], 'the root\'s git names the nested repos and the state by their folders, file by file never');
    assert.deepStrictEqual(projectDirtyEntries(projectRepos(dir)), [
      { path: '.gitignore', status: ' M' },
      { path: 'src/app.js', status: ' M' },
      { path: 'packages/notes.txt', status: '??' },
      { path: 'src/new/a.js', status: '??' },
      { path: 'src/new/b.js', status: '??' },
      { path: 'api/src/handler.js', status: ' M' },
      { path: 'api/src/new/api.js', status: '??' },
      { path: 'packages/kit/lib/kit.js', status: '??' },
      { path: 'tools/cli/bin/run.js', status: '??' },
      { path: 'vendor/sdk/src/handler.js', status: ' M' },
      { path: 'vendor/sdk/src/new/sdk.js', status: '??' },
    ], 'an ignored clone, an untracked nested repo and a submodule never reach the root\'s dirt; each one\'s own reads under its folder');
  });

  it('a project nested in a larger repository reads only its own folder of it, named from the project', () => {
    const project = path.join(dir, 'apps/web');
    writeFile(project, 'src/a.js', '1\n');
    writeFile(dir, 'other/o.js', '1\n');
    commitAll(dir, 'impl(pay): T3 — the project and its sibling');
    writeFile(dir, 'other/o.js', '2\n');
    commitAll(dir, 'impl(pay): T4 — the sibling alone');
    writeFile(project, 'src/a.js', '2\n');
    writeFile(dir, 'other/o.js', '3\n');
    writeFile(dir, '.leeway/pay/notes.md', 'a doc session\'s own\n');
    const repos = projectRepos(project);

    assert.deepStrictEqual(projectDirtyEntries(repos), [{ path: 'src/a.js', status: ' M' }]);
    assert.deepStrictEqual([...projectPathsTouchedBySubject(repos, 'impl(pay):')], ['src/a.js']);
  });

  it('reads history across the repos in project paths — a repo with no commits yet has touched nothing', () => {
    const api = nestedRepo(dir, 'api', 'src/routes.js');
    writeFile(api, 'src/handler.js', '1\n');
    commitAll(api, 'impl(pay): T2 — the handler');
    initRepo(path.join(dir, 'fresh'));
    writeFile(dir, 'fresh/notes.txt', 'nothing committed\n');
    const repos = projectRepos(dir);

    assert.deepStrictEqual(dirsOf(repos), ['', 'api', 'fresh']);
    assert.deepStrictEqual([...projectPathsTouchedBySubject(repos, 'impl(pay):')].sort(),
      ['api/src/handler.js', 'src/app.js']);
  });
});
