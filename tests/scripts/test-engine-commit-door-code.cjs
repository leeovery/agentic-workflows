'use strict';

// ---------------------------------------------------------------------------
// The commit door's code commit: `engine commit --paths`, the declared paths
// committed in the code tree under the commit lock, and across the repos
// nested in the project — each path in the repo that owns it, a submodule's
// pointer recorded in its parent, refused before any repo commits where one
// cannot.
//
// Layer: git. World: the project world and its code projects, built once and
// copied (engine-harness.cjs), the commit door's epic over them
// (commit-door-world.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const harness = require('./engine-harness.cjs');
const { ok, refuses, git, commitAll, cleanupFixture, fixtureFrom, statePath, layout, createFile, writeState } = harness;
const { codeHeadFiles, codeStatusLines, epicManifest, implementing } = require('./commit-door-world.cjs');

describe('engine commit --paths: the code commit', () => {
  const setup = fixtureFrom('engine-commit-', (at) => implementing(at, { 'src/other.js': 'const y = 1;\n', 'src/gone.js': 'const z = 1;\n' }));
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { cleanupFixture(dir); });

  const forTopic = ['--for', 'payments', 'implementation/topic-a'];

  it('commits the named paths and answers the dirt still outside .leeway', () => {
    createFile(dir, 'src/app.js', 'const x = 2;\n');
    createFile(dir, 'src/new.js', 'const n = 1;\n');
    createFile(dir, 'src/other.js', 'const y = 2;\n');
    writeState(dir, layout.doc('payments', 'investigation', 'topic-b'), '# Topic B\na doc session\'s dirt\n');

    const res = ok(dir, ['commit', '--paths', 'src/app.js', 'src/new.js', '-m', 'feat(topic-a): the task', ...forTopic]);

    assert.deepStrictEqual(res.committed, [{ repo: '.', sha: git(dir, ['rev-parse', '--short', 'HEAD']).trim() }],
      'a project of one repo commits once, in the root');
    const files = codeHeadFiles(dir);
    assert.deepStrictEqual(files.sort(), ['src/app.js', 'src/new.js'], 'exactly the named paths — untracked included');
    assert.deepStrictEqual(res.left_dirty, ['src/other.js'],
      'the forgotten path is named; a doc session\'s .leeway dirt is its own');
  });

  it('records a task\'s deletion and beats the named code topic', () => {
    fs.unlinkSync(path.join(dir, 'src/gone.js'));

    const res = ok(dir, ['commit', '--paths', 'src/gone.js', '-m', 'refactor(topic-a): drop the module', ...forTopic]);

    assert.ok(codeHeadFiles(dir).includes('src/gone.js'), 'the deletion rides the commit');
    assert.deepStrictEqual(res.left_dirty, []);
    assert.ok(fs.existsSync(statePath(dir, layout.cache('payments', 'implementation', 'topic-a', 'presence'))),
      '--for beats the code topic');
  });

  it('carries a staged rename, and reads the residual dirt past its two-field record', () => {
    // `git status --porcelain -z` writes a rename as one record with TWO
    // NUL-separated paths. Miscounting there would misread every path after
    // it, so `left_dirty` would name files the task never touched.
    git(dir, ['mv', 'src/other.js', 'src/renamed.js']);
    createFile(dir, 'src/left-behind.js', '// not this task\n');

    const res = ok(dir, ['commit', '--paths', 'src/other.js', 'src/renamed.js',
      '-m', 'refactor(topic-a): move the module', ...forTopic]);

    assert.deepStrictEqual(
      git(dir, ['show', '--name-only', '--no-renames', '--pretty=format:', 'HEAD']).trim().split('\n').filter(Boolean).sort(),
      ['src/other.js', 'src/renamed.js'], 'both sides of the rename ride the commit');
    assert.deepStrictEqual(res.left_dirty, ['src/left-behind.js'],
      'the rename record is consumed whole — nothing after it shifts');
  });

  it('answers nothing to commit when the named paths are clean', () => {
    const res = ok(dir, ['commit', '--paths', 'src/app.js', '-m', 'noop', ...forTopic]);
    assert.deepStrictEqual(res.committed, []);
    assert.strictEqual(res.note, 'nothing to commit');
  });

  it('takes every path literally — a routing file is that file, never a pattern its siblings match', () => {
    const named = ['app/[id]/page.tsx', 'app/(marketing)/page.tsx', 'src/a*b?.js', ':notes.md'];
    for (const rel of [...named, 'app/i/page.tsx', 'app/d/page.tsx', 'src/aXbY.js']) createFile(dir, rel, `// ${rel}\n`);

    const res = ok(dir, ['commit', '--paths', ...named, '-m', 'feat(topic-a): the routes', ...forTopic]);

    assert.deepStrictEqual(codeHeadFiles(dir).sort(), [...named].sort(), 'exactly the named files');
    assert.deepStrictEqual(res.left_dirty, ['app/d/page.tsx', 'app/i/page.tsx', 'src/aXbY.js'],
      'the siblings a glob would have matched stay uncommitted, named as they are');
    assert.deepStrictEqual(ok(dir, ['code', 'status']).files,
      res.left_dirty.map((rel) => ({ path: rel, status: '??' })), 'code status names them as they are too');
  });

  it('takes a tracked path literally through its edit, its deletion, a staged removal and a retry', () => {
    for (const rel of ['app/[slug]/page.tsx', 'app/[slug]/old.tsx', 'app/(shop)/cart.tsx', 'app/s/page.tsx', 'app/s/old.tsx']) {
      createFile(dir, rel, `// ${rel}\n`);
    }
    commitAll(dir, 'routes');
    for (const rel of ['app/[slug]/page.tsx', 'app/s/page.tsx', 'app/s/old.tsx']) createFile(dir, rel, '// edited\n');
    fs.unlinkSync(path.join(dir, 'app/[slug]/old.tsx'));
    git(dir, ['rm', '-q', '--', ':(literal)app/(shop)/cart.tsx']);
    const call = ['commit', '--paths', 'app/[slug]/page.tsx', 'app/[slug]/old.tsx', 'app/(shop)/cart.tsx',
      '-m', 'feat(topic-a): the slug route', ...forTopic];

    const res = ok(dir, call);

    assert.deepStrictEqual(git(dir, ['show', '--name-status', '--pretty=format:', 'HEAD']).trim().split('\n').sort(),
      ['D\tapp/(shop)/cart.tsx', 'D\tapp/[slug]/old.tsx', 'M\tapp/[slug]/page.tsx']);
    assert.deepStrictEqual(res.left_dirty, ['app/s/old.tsx', 'app/s/page.tsx']);

    const again = ok(dir, call);
    assert.deepStrictEqual(again.committed, [], 'the HEAD commit\'s own deletions pass the retry, with nothing left');
  });

  it('refuses a literal path git cannot stage or does not hold — a sibling its pattern would match stands in for none', () => {
    createFile(dir, '.gitignore', '.leeway/\n*.log\n');
    createFile(dir, 'app/[id]/debug.log', 'noise\n');
    createFile(dir, 'app/x/page.tsx', '// a sibling\n');
    commitAll(dir, 'routes');
    fs.symlinkSync('app', path.join(dir, 'alias'));
    createFile(dir, 'app/[id]/page.tsx', '// the route\n');

    assert.strictEqual(refuses(dir, ['commit', '--paths', 'app/[id]/debug.log', '-m', 'x', ...forTopic]).error,
      'commit --paths: git in . refuses to stage "app/[id]/debug.log" (an ignore rule, or a path beyond a symbolic link)');
    assert.strictEqual(refuses(dir, ['commit', '--paths', 'alias/[id]/page.tsx', '-m', 'x', ...forTopic]).error,
      'commit --paths: git in . refuses to stage "alias/[id]/page.tsx" (an ignore rule, or a path beyond a symbolic link)');
    assert.strictEqual(refuses(dir, ['commit', '--paths', 'app/[x]/page.tsx', '-m', 'x', ...forTopic]).error,
      'commit --paths: "app/[x]/page.tsx" is neither on disk nor tracked');
    assert.strictEqual(git(dir, ['diff', '--cached', '--name-only']).trim(), '', 'a refusal stages nothing');
  });

  it('refuses escapes, workflow artifacts, and a missing target', () => {
    assert.match(refuses(dir, ['commit', '--paths', '../elsewhere.js', '-m', 'x', ...forTopic]).error, /resolves outside the project/);
    assert.match(refuses(dir, ['commit', '--paths', '/etc/hosts', '-m', 'x', ...forTopic]).error, /resolves outside the project/);
    assert.strictEqual(refuses(dir, ['commit', '--paths', '.leeway/payments/investigation/topic-a.md', '-m', 'x', ...forTopic]).error,
      'commit --paths: ".leeway/payments/investigation/topic-a.md" is in the workflows\' state — it commits by its own scope (--topic/--discovery/--plan)');
    assert.match(refuses(dir, ['commit', '--paths', 'src/never-written.js', '-m', 'x', ...forTopic]).error, /neither on disk nor tracked/);
    assert.match(refuses(dir, ['commit', '--paths', '-m', 'x', ...forTopic]).error, /Usage/);
    assert.match(refuses(dir, ['commit', '--paths', 'src/app.js', '-m', 'x']).error, /Usage/);
    assert.match(refuses(dir, ['commit', '--paths', 'src/app.js', '-m', 'x', '--for', 'payments', 'investigation/topic-a']).error, /Usage/);
    assert.match(refuses(dir, ['commit', '--paths', 'src/app.js', '--for', 'payments', 'review/topic-a']).error, /Usage/);
    assert.match(refuses(dir, ['commit', 'payments', '--paths', 'src/app.js', '-m', 'x', ...forTopic]).error, /Usage/);
    assert.strictEqual(codeStatusLines(dir).length, 0, 'a refusal touches nothing');
  });

  it('names a path in the state as in the state from a code worktree too, never as outside the project', () => {
    const wt = `${dir}-side`;
    git(dir, ['worktree', 'add', '-q', '-b', 'side', wt]);
    try {
      const inState = statePath(dir, layout.doc('payments', 'investigation', 'topic-a'));
      assert.strictEqual(harness.refuses(wt, ['commit', '--paths', inState, '-m', 'x', ...forTopic]).error,
        `commit --paths: "${inState}" is in the workflows' state — it commits by its own scope (--topic/--discovery/--plan)`);
    } finally {
      cleanupFixture(wt);
    }
  });

  it('refuses a --for target that does not exist — the phantom-hold repro', () => {
    // The commit beats what --for names. A typo there mints a hold on a topic
    // no session owns and no session-end sweeps, and the checkout's code slot
    // then reads taken forever. It must refuse before anything is staged.
    createFile(dir, 'src/app.js', 'const x = 2;\n');

    assert.match(refuses(dir, ['commit', '--paths', 'src/app.js', '-m', 'x',
      '--for', 'payments', 'implementation/topic-typo']).error,
    /no implementation item "topic-typo" in "payments"/);
    assert.match(refuses(dir, ['commit', '--paths', 'src/app.js', '-m', 'x',
      '--for', 'no-such-unit', 'implementation/topic-a']).error,
    /no work unit directory/);
    assert.match(refuses(dir, ['commit', '--paths', 'src/app.js', '-m', 'x',
      '--for', 'payments', 'implementation/..']).error,
    /invalid topic name/);
    assert.match(refuses(dir, ['commit', '--paths', 'src/app.js', '-m', 'x',
      '--for', '../escapee', 'implementation/topic-a']).error,
    /invalid work unit name/);

    assert.ok(!fs.existsSync(statePath(dir, layout.cache('payments', 'implementation', 'topic-typo'))),
      'no ghost heartbeat is minted');
    assert.deepStrictEqual(codeStatusLines(dir), [' M src/app.js'], 'a refusal stages nothing');
  });

  it('refuses a path deleted long before — only the HEAD commit\'s own deletion passes', () => {
    fs.unlinkSync(path.join(dir, 'src/gone.js'));
    commitAll(dir, 'drop the module');
    createFile(dir, 'src/app.js', 'const x = 2;\n');
    commitAll(dir, 'later work');

    assert.match(refuses(dir, ['commit', '--paths', 'src/gone.js', '-m', 'x', ...forTopic]).error,
      /"src\/gone\.js" is neither on disk nor tracked/);
  });

  it('commits in a project nested in its repository under the project\'s own directory, reading only its own folder', () => {
    const repo = harness.setupGitFixture('engine-commit-nested-paths-');
    try {
      const project = path.join(repo, 'apps/web');
      const manifest = epicManifest();
      manifest.phases.implementation = { items: { 'topic-a': { status: 'in-progress' } } };
      writeState(repo, layout.manifest('payments'), JSON.stringify(manifest, null, 2) + '\n');
      createFile(project, 'src/app.js', 'const x = 1;\n');
      createFile(repo, 'other/x.js', 'const s = 1;\n');
      commitAll(repo, 'init');
      createFile(project, 'src/app.js', 'const x = 2;\n');
      createFile(project, 'src/leftover.js', 'const l = 1;\n');
      writeState(repo, layout.doc('payments', 'investigation', 'topic-b'), '# a doc session\'s own\n');
      createFile(repo, 'other/x.js', 'const s = 2;\n');

      const res = ok(project, ['commit', '--paths', 'src/app.js', '-m', 'feat(topic-a): the task', ...forTopic]);

      assert.deepStrictEqual(res.committed, [{ repo: '.', sha: git(repo, ['rev-parse', '--short', 'HEAD']).trim() }]);
      assert.deepStrictEqual(codeHeadFiles(repo), ['apps/web/src/app.js']);
      assert.deepStrictEqual(res.left_dirty, ['src/leftover.js'],
        'named from the project — never a sibling folder\'s dirt, never the state\'s');
    } finally {
      cleanupFixture(repo);
    }
  });
});

describe('engine commit --paths: code in repos of its own', () => {
  const setup = fixtureFrom('engine-commit-', (at) => {
    implementing(at, { '.gitignore': '.leeway/\napi/\n' });
    // An ignored clone: a repo of its own that the root's .gitignore lists.
    const clone = harness.initRepo(path.join(at, 'api'));
    createFile(clone, 'src/handler.js', 'const h = 1;\n');
    createFile(clone, 'src/other.js', 'const o = 1;\n');
    createFile(clone, 'src/old.js', 'const d = 1;\n');
    commitAll(clone, 'init');
  });
  let dir;
  let api;
  beforeEach(() => {
    dir = setup();
    api = path.join(dir, 'api');
  });
  afterEach(() => { cleanupFixture(dir); });

  const forTopic = ['--for', 'payments', 'implementation/topic-a'];
  const head = (repo) => git(repo, ['rev-parse', '--short', 'HEAD']).trim();
  const subject = (repo) => git(repo, ['log', '-1', '--format=%s']).trim();
  /** The commit the root's HEAD records for a submodule. */
  const pointer = (rel) => git(dir, ['rev-parse', `HEAD:${rel}`]).trim();
  /** A pre-commit hook in the repo that refuses every commit. */
  const refusingHook = (repo, name) => {
    const hook = path.join(repo, '.git/hooks/pre-commit');
    fs.mkdirSync(path.dirname(hook), { recursive: true });
    fs.writeFileSync(hook, `#!/bin/sh\necho "the ${name} hook refuses" >&2\nexit 1\n`, { mode: 0o755 });
    return hook;
  };

  it('commits each path in the repo that owns it — one call, a commit per repo, one message, the nested repo first', () => {
    createFile(dir, 'src/app.js', 'const x = 2;\n');
    createFile(api, 'src/handler.js', 'const h = 2;\n');
    createFile(api, 'src/new.js', 'const n = 1;\n');

    const res = ok(dir, ['commit', '--paths', 'src/app.js', 'api/src/handler.js', 'api/src/new.js',
      '-m', 'feat(topic-a): the task', ...forTopic]);

    assert.deepStrictEqual(res.committed, [{ repo: 'api', sha: head(api) }, { repo: '.', sha: head(dir) }]);
    assert.deepStrictEqual(codeHeadFiles(dir), ['src/app.js']);
    assert.deepStrictEqual(codeHeadFiles(api).sort(), ['src/handler.js', 'src/new.js']);
    assert.deepStrictEqual([subject(dir), subject(api)], ['feat(topic-a): the task', 'feat(topic-a): the task']);
    assert.deepStrictEqual(res.left_dirty, []);
  });

  it('takes a path in a nested repo literally — a routing file in a clone or a submodule is that file', () => {
    const sdk = harness.addSubmodule(dir, 'sdk', api);
    const named = ['api/app/[id]/page.tsx', 'api/app/(marketing)/page.tsx', 'sdk/routes/[slug]/+page.svelte'];
    for (const rel of [...named, 'api/app/i/page.tsx', 'sdk/routes/s/+page.svelte']) createFile(dir, rel, `// ${rel}\n`);

    const res = ok(dir, ['commit', '--paths', ...named, '-m', 'feat(topic-a): the routes', ...forTopic]);

    assert.deepStrictEqual(res.committed, [{ repo: 'api', sha: head(api) }, { repo: 'sdk', sha: head(sdk) }, { repo: '.', sha: head(dir) }]);
    assert.deepStrictEqual(codeHeadFiles(api).sort(), ['app/(marketing)/page.tsx', 'app/[id]/page.tsx']);
    assert.deepStrictEqual(codeHeadFiles(sdk), ['routes/[slug]/+page.svelte']);
    assert.deepStrictEqual(codeHeadFiles(dir), ['sdk'], 'the submodule\'s new pointer, and nothing else');
    assert.deepStrictEqual(res.left_dirty, ['api/app/i/page.tsx', 'sdk/routes/s/+page.svelte']);
  });

  it('carries no pathspec magic into a nested repo — a name opening on a colon is that file, or not on disk', () => {
    createFile(api, ':weird.txt', 'odd\n');
    createFile(api, 'weird.txt', 'plain\n');
    createFile(api, 'keep.txt', 'kept\n');
    createFile(api, 'src/handler.js', 'const h = 2;\n');
    const apiBefore = head(api);

    assert.strictEqual(refuses(dir, ['commit', '--paths', 'api/:(exclude)keep.txt', '-m', 'x', ...forTopic]).error,
      'commit --paths: "api/:(exclude)keep.txt" is neither on disk nor tracked');
    assert.strictEqual(head(api), apiBefore, 'never a sweep of the clone');

    const res = ok(dir, ['commit', '--paths', 'api/:weird.txt', '-m', 'feat(topic-a): the odd file', ...forTopic]);

    assert.deepStrictEqual(res.committed, [{ repo: 'api', sha: head(api) }]);
    assert.deepStrictEqual(codeHeadFiles(api), [':weird.txt']);
    assert.deepStrictEqual(res.left_dirty.sort(), ['api/keep.txt', 'api/src/handler.js', 'api/weird.txt']);
  });

  it('commits a nested repo\'s paths alone — the root gains no commit', () => {
    const rootBefore = head(dir);
    createFile(api, 'src/handler.js', 'const h = 2;\n');

    const res = ok(dir, ['commit', '--paths', 'api/src/handler.js', '-m', 'feat(topic-a): the task', ...forTopic]);

    assert.deepStrictEqual(res.committed, [{ repo: 'api', sha: head(api) }]);
    assert.strictEqual(head(dir), rootBefore);
    assert.ok(fs.existsSync(statePath(dir, layout.cache('payments', 'implementation', 'topic-a', 'presence'))),
      'the commit beats the code topic once, in the project');
  });

  it('answers every repo\'s leftover in left_dirty, project-relative — never a parent\'s view of a nested repo', () => {
    const web = harness.initRepo(path.join(dir, 'web'));
    createFile(web, 'index.js', 'const w = 1;\n');
    commitAll(web, 'init');
    createFile(api, 'src/handler.js', 'const h = 2;\n');
    createFile(api, 'src/other.js', 'const o = 2;\n');
    createFile(web, 'index.js', 'const w = 2;\n');

    const res = ok(dir, ['commit', '--paths', 'api/src/handler.js', '-m', 'feat(topic-a): the task', ...forTopic]);

    assert.ok(codeStatusLines(dir).includes('?? web/'), 'the root\'s git names the untracked repo\'s folder');
    assert.deepStrictEqual(res.left_dirty, ['api/src/other.js', 'web/index.js']);
  });

  it('records a submodule\'s new pointer in its parent when the call reaches into it, the submodule first', () => {
    const sdk = harness.addSubmodule(dir, 'sdk', api);
    createFile(sdk, 'src/handler.js', 'const h = 2;\n');
    createFile(dir, 'src/app.js', 'const x = 2;\n');

    const both = ok(dir, ['commit', '--paths', 'src/app.js', 'sdk/src/handler.js', '-m', 'feat(topic-a): the task', ...forTopic]);

    assert.deepStrictEqual(both.committed, [{ repo: 'sdk', sha: head(sdk) }, { repo: '.', sha: head(dir) }]);
    assert.deepStrictEqual(codeHeadFiles(dir).sort(), ['sdk', 'src/app.js']);
    assert.strictEqual(pointer('sdk'), git(sdk, ['rev-parse', 'HEAD']).trim(), 'the gitlink records the submodule\'s new HEAD');
    assert.deepStrictEqual(both.left_dirty, []);

    createFile(sdk, 'src/other.js', 'const o = 2;\n');
    const alone = ok(dir, ['commit', '--paths', 'sdk/src/other.js', '-m', 'feat(topic-a): the rest', ...forTopic]);

    assert.deepStrictEqual(alone.committed, [{ repo: 'sdk', sha: head(sdk) }, { repo: '.', sha: head(dir) }],
      'a call naming the submodule alone records its pointer too');
    assert.deepStrictEqual(codeHeadFiles(dir), ['sdk']);
    assert.strictEqual(pointer('sdk'), git(sdk, ['rev-parse', 'HEAD']).trim());

    createFile(sdk, 'scratch.txt', 'stray\n');
    const again = ok(dir, ['commit', '--paths', 'sdk/src/other.js', '-m', 'feat(topic-a): the rest', ...forTopic]);

    assert.deepStrictEqual(again.committed, [], 'work uncommitted inside the submodule is no pointer to record');
    assert.strictEqual(again.note, 'nothing to commit');
  });

  it('refuses a call that would commit in a repo on a detached HEAD, before any repo commits', () => {
    const sdk = harness.addSubmodule(dir, 'sdk', api);
    const branch = git(sdk, ['symbolic-ref', '--short', 'HEAD']).trim();
    git(sdk, ['checkout', '-q', '--detach']);
    createFile(sdk, 'src/handler.js', 'const h = 2;\n');
    createFile(dir, 'src/app.js', 'const x = 2;\n');
    const call = ['commit', '--paths', 'src/app.js', 'sdk/src/handler.js', '-m', 'feat(topic-a): the task', ...forTopic];
    const [rootBefore, sdkBefore] = [head(dir), head(sdk)];

    assert.strictEqual(refuses(dir, call).error,
      'commit --paths: sdk is on a detached HEAD — check out a branch there, then run the commit again');
    assert.deepStrictEqual([head(dir), head(sdk)], [rootBefore, sdkBefore], 'nothing commits in any repo');

    git(sdk, ['checkout', '-q', branch]);
    git(dir, ['checkout', '-q', '--detach']);

    assert.strictEqual(refuses(dir, ['commit', '--paths', 'sdk/src/handler.js', '-m', 'feat(topic-a): the task', ...forTopic]).error,
      'commit --paths: . is on a detached HEAD — check out a branch there, then run the commit again',
      'the parent a reached submodule\'s pointer lands in is checked too');
    assert.strictEqual(head(sdk), sdkBefore);

    git(dir, ['checkout', '-q', '-']);
    const landed = ok(dir, call);

    assert.deepStrictEqual(landed.committed, [{ repo: 'sdk', sha: head(sdk) }, { repo: '.', sha: head(dir) }]);
    assert.deepStrictEqual(codeHeadFiles(dir).sort(), ['sdk', 'src/app.js']);
  });

  it('refuses a call that would commit in a repo mid-operation — a rebase in a submodule, a merge in the root — before any repo commits', () => {
    const sdk = harness.addSubmodule(dir, 'sdk', api);
    createFile(sdk, 'src/handler.js', 'const h = 2;\n');
    commitAll(sdk, 'the submodule moves on');
    assert.throws(() => git(sdk, ['rebase', '-q', '--exec', 'false', 'HEAD~1']), 'the rebase stops at its failing exec');
    createFile(sdk, 'src/other.js', 'const o = 2;\n');
    createFile(dir, 'src/app.js', 'const x = 2;\n');
    const [rootBefore, sdkBefore] = [head(dir), head(sdk)];

    assert.strictEqual(refuses(dir, ['commit', '--paths', 'src/app.js', 'sdk/src/other.js', '-m', 'feat(topic-a): the task', ...forTopic]).error,
      'commit --paths: a rebase is in progress in sdk (rebase-merge) — finish or abort it there, then run the commit again',
      'never read as the detached HEAD the rebase leaves');
    assert.deepStrictEqual([head(dir), head(sdk)], [rootBefore, sdkBefore], 'nothing commits in any repo');

    git(sdk, ['rebase', '--abort']);
    git(dir, ['checkout', '-q', '-b', 'side']);
    createFile(dir, 'src/side.js', 'const s = 1;\n');
    commitAll(dir, 'the side');
    git(dir, ['checkout', '-q', '-']);
    git(dir, ['merge', '-q', '--no-ff', '--no-commit', 'side']);
    createFile(api, 'src/handler.js', 'const h = 3;\n');
    const apiBefore = head(api);

    assert.strictEqual(refuses(dir, ['commit', '--paths', 'src/app.js', 'api/src/handler.js', '-m', 'feat(topic-a): the task', ...forTopic]).error,
      'commit --paths: a merge is in progress in . (MERGE_HEAD) — finish or abort it there, then run the commit again');
    assert.deepStrictEqual([head(dir), head(api)], [rootBefore, apiBefore], 'the clone, whose commit would come first, made none');
  });

  it('never checks a repo the call does not commit in — a detached clone blocks nothing elsewhere', () => {
    git(api, ['checkout', '-q', '--detach']);
    createFile(dir, 'src/app.js', 'const x = 2;\n');

    const res = ok(dir, ['commit', '--paths', 'src/app.js', '-m', 'feat(topic-a): the task', ...forTopic]);

    assert.deepStrictEqual(res.committed, [{ repo: '.', sha: head(dir) }]);
  });

  it('commits beside a folder whose .git is a dangling link — no repo, never a failure', () => {
    createFile(dir, '.gitignore', '.leeway/\napi/\nbroken/\n');
    commitAll(dir, 'the broken folder is ignored');
    fs.mkdirSync(path.join(dir, 'broken'));
    fs.symlinkSync(path.join(dir, 'nowhere'), path.join(dir, 'broken/.git'));
    createFile(dir, 'src/app.js', 'const x = 2;\n');

    const res = ok(dir, ['commit', '--paths', 'src/app.js', '-m', 'feat(topic-a): the task', ...forTopic]);

    assert.deepStrictEqual(res.committed, [{ repo: '.', sha: head(dir) }]);
    assert.deepStrictEqual(res.left_dirty, []);
  });

  it('records the pointer of a submodule the call reaches into inside a folder the call also names', () => {
    const sub = harness.addSubmodule(dir, 'packages/sub', api);
    createFile(dir, 'packages/readme.txt', 'the packages\n');
    createFile(sub, 'lib.txt', 'a library\n');

    const res = ok(dir, ['commit', '--paths', 'packages', 'packages/sub/lib.txt', '-m', 'feat(topic-a): the task', ...forTopic]);

    assert.deepStrictEqual(res.committed, [{ repo: 'packages/sub', sha: head(sub) }, { repo: '.', sha: head(dir) }]);
    assert.deepStrictEqual(codeHeadFiles(dir).sort(), ['packages/readme.txt', 'packages/sub']);
    assert.strictEqual(pointer('packages/sub'), git(sub, ['rev-parse', 'HEAD']).trim());
    assert.deepStrictEqual(codeStatusLines(dir), []);
  });

  it('never commits a nested repo in its parent the call did not reach into — an untouched submodule, an untracked repo', () => {
    const sdk = harness.addSubmodule(dir, 'sdk', api);
    const before = pointer('sdk');
    createFile(sdk, 'src/handler.js', 'const h = 2;\n');
    commitAll(sdk, 'the submodule moves on its own');
    createFile(dir, 'src/app.js', 'const x = 2;\n');

    const res = ok(dir, ['commit', '--paths', 'src/app.js', '-m', 'feat(topic-a): the task', ...forTopic]);

    assert.deepStrictEqual(res.committed, [{ repo: '.', sha: head(dir) }]);
    assert.deepStrictEqual(codeHeadFiles(dir), ['src/app.js']);
    assert.strictEqual(pointer('sdk'), before, 'the untouched gitlink stays where it was');
    assert.ok(codeStatusLines(dir).includes(' M sdk'), 'the moved pointer is the root\'s git to see');
    assert.deepStrictEqual(res.left_dirty, [], 'and never dirt');

    createFile(dir, 'packages/notes.txt', 'loose\n');
    const kit = harness.initRepo(path.join(dir, 'packages/kit'));
    createFile(kit, 'kit.js', 'const k = 1;\n');
    commitAll(kit, 'init');

    const folder = ok(dir, ['commit', '--paths', 'packages', '-m', 'chore(topic-a): the notes', ...forTopic]);

    assert.deepStrictEqual(folder.committed, [{ repo: '.', sha: head(dir) }]);
    assert.deepStrictEqual(codeHeadFiles(dir), ['packages/notes.txt'], 'the folder\'s files ride, the repo inside it never does');
    assert.strictEqual(git(dir, ['ls-files', '--stage', '--', 'packages/kit']).trim(), '', 'no gitlink staged for the untracked repo');
  });

  it('commits beside a submodule its parent ignores, and records that submodule\'s pointer when the call reaches into it', () => {
    createFile(dir, '.gitignore', '.leeway/\napi/\nvendor/\n');
    commitAll(dir, 'the vendor folder is ignored');
    const sdk = harness.addSubmodule(dir, 'vendor/sdk', api, { force: true });
    const before = pointer('vendor/sdk');
    createFile(sdk, 'src/handler.js', 'const h = 2;\n');
    commitAll(sdk, 'the submodule moves on its own');
    createFile(dir, 'index.js', 'const i = 1;\n');

    const beside = ok(dir, ['commit', '--paths', 'index.js', '-m', 'feat(topic-a): the task', ...forTopic]);

    assert.deepStrictEqual(beside.committed, [{ repo: '.', sha: head(dir) }]);
    assert.deepStrictEqual(codeHeadFiles(dir), ['index.js']);
    assert.strictEqual(pointer('vendor/sdk'), before);
    assert.strictEqual(git(dir, ['diff', '--cached', '--name-only']).trim(), '', 'nothing is left staged');

    createFile(sdk, 'src/other.js', 'const o = 2;\n');
    const into = ok(dir, ['commit', '--paths', 'vendor/sdk/src/other.js', '-m', 'feat(topic-a): the rest', ...forTopic]);

    assert.deepStrictEqual(into.committed, [{ repo: 'vendor/sdk', sha: head(sdk) }, { repo: '.', sha: head(dir) }]);
    assert.strictEqual(pointer('vendor/sdk'), git(sdk, ['rev-parse', 'HEAD']).trim(), 'the pointer lands without being added');
  });

  it('names the repo whose commit failed, and the commits already made', () => {
    createFile(api, 'src/handler.js', 'const h = 2;\n');
    const hook = refusingHook(api, 'api');

    assert.strictEqual(refuses(dir, ['commit', '--paths', 'api/src/handler.js', '-m', 'x', ...forTopic]).error,
      'the commit in api failed: git commit failed: the api hook refuses');

    fs.rmSync(hook);
    createFile(dir, 'src/app.js', 'const x = 2;\n');
    refusingHook(dir, 'root');

    assert.strictEqual(refuses(dir, ['commit', '--paths', 'src/app.js', 'api/src/handler.js', '-m', 'x', ...forTopic]).error,
      `the commit in . failed after api committed ${head(api)} — re-running the same call commits the rest: git commit failed: the root hook refuses`);
  });

  it('re-running a call one repo failed is the retry — a deletion a nested repo already committed answers nothing', () => {
    fs.unlinkSync(path.join(api, 'src/old.js'));
    createFile(dir, 'src/app.js', 'const x = 2;\n');
    const hook = refusingHook(dir, 'root');
    const call = ['commit', '--paths', 'api/src/old.js', 'src/app.js', '-m', 'feat(topic-a): the task', ...forTopic];
    const rootBefore = head(dir);

    refuses(dir, call);

    const apiSha = head(api);
    assert.strictEqual(git(api, ['show', '--name-status', '--pretty=format:', 'HEAD']).trim(), 'D\tsrc/old.js',
      'the clone committed the deletion before the root failed');
    assert.strictEqual(head(dir), rootBefore, 'the root committed nothing');

    fs.rmSync(hook);
    const retried = ok(dir, call);

    assert.deepStrictEqual(retried.committed, [{ repo: '.', sha: head(dir) }], 'the clone has nothing left in the paths');
    assert.strictEqual(head(api), apiSha);
    assert.deepStrictEqual(codeHeadFiles(dir), ['src/app.js']);
    assert.deepStrictEqual(retried.left_dirty, []);
  });

  it('re-running the call picks up a submodule\'s pointer its parent failed to record', () => {
    const sdk = harness.addSubmodule(dir, 'sdk', api);
    createFile(sdk, 'src/handler.js', 'const h = 2;\n');
    const hook = refusingHook(dir, 'root');
    const call = ['commit', '--paths', 'sdk/src/handler.js', '-m', 'feat(topic-a): the task', ...forTopic];

    assert.match(refuses(dir, call).error, new RegExp(`^the commit in \\. failed after sdk committed ${head(sdk)} — `));

    fs.rmSync(hook);
    const retried = ok(dir, call);

    assert.deepStrictEqual(retried.committed, [{ repo: '.', sha: head(dir) }], 'the submodule has nothing left; its pointer has');
    assert.strictEqual(pointer('sdk'), git(sdk, ['rev-parse', 'HEAD']).trim());
  });

  it('checks every path in the repo that owns it before any repo commits', () => {
    createFile(dir, '.gitignore', '.leeway/\napi/\n*.log\n');
    commitAll(dir, 'logs are ignored');
    createFile(api, 'src/handler.js', 'const h = 2;\n');
    createFile(dir, 'debug.log', 'noise\n');
    const apiBefore = head(api);

    assert.strictEqual(refuses(dir, ['commit', '--paths', 'api/src/handler.js', 'debug.log', '-m', 'x', ...forTopic]).error,
      'commit --paths: git in . refuses to stage "debug.log" (an ignore rule, or a path beyond a symbolic link)');
    assert.strictEqual(head(api), apiBefore, 'the clone, whose commit would come first, made none');
    assert.strictEqual(git(api, ['diff', '--cached', '--name-only']).trim(), '', 'and staged nothing');

    createFile(dir, 'src/app.js', 'const x = 2;\n');
    const rootBefore = head(dir);

    assert.match(refuses(dir, ['commit', '--paths', 'src/app.js', 'api/src/never-written.js', '-m', 'x', ...forTopic]).error,
      /"api\/src\/never-written\.js" is neither on disk nor tracked/);
    assert.strictEqual(head(dir), rootBefore);
    assert.deepStrictEqual(codeStatusLines(dir), [' M src/app.js'], 'a refusal stages nothing');

    createFile(dir, '.gitignore', '.leeway/\napi/\n*.log\nlib/gen/\n');
    commitAll(dir, 'generated code is ignored');
    harness.addSubmodule(dir, 'lib/gen/sdk', api, { force: true });
    createFile(dir, 'lib/util.js', 'const u = 1;\n');

    assert.strictEqual(refuses(dir, ['commit', '--paths', 'api/src/handler.js', 'lib', '-m', 'x', ...forTopic]).error,
      'commit --paths: git in . refuses to stage "lib" (an ignore rule, or a path beyond a symbolic link)',
      'a folder holding a submodule its parent ignores is checked as the commit would stage it');
    assert.strictEqual(head(api), apiBefore);

    git(api, ['rm', '-q', '--', 'src/old.js']);
    const res = ok(dir, ['commit', '--paths', 'api/src/old.js', '-m', 'refactor(topic-a): drop the module', ...forTopic]);

    assert.deepStrictEqual(res.committed, [{ repo: 'api', sha: head(api) }], 'a deletion staged in the clone is its to commit');
    assert.deepStrictEqual(git(api, ['show', '--name-status', '--pretty=format:', 'HEAD']).trim(), 'D\tsrc/old.js');
  });
});
