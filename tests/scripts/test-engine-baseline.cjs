'use strict';

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const harness = require('./engine-harness.cjs');

const { git } = harness;

function writeFile(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}
const run = (dir, args) => harness.ok(dir, args);
function refuses(dir, args, pattern) {
  const parsed = harness.refuses(dir, args);
  assert.match(parsed.error, pattern);
  return parsed;
}
function projectManifest(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.workflows/manifest.json'), 'utf8'));
}

describe('engine baseline record', () => {
  let dir;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-baseline-'));
    git(dir, ['init', '-q', '-b', 'main']);
    git(dir, ['config', 'user.email', 'test@example.com']);
    git(dir, ['config', 'user.name', 'Test']);
    git(dir, ['config', 'commit.gpgsign', 'false']);
    writeFile(dir, '.workflows/manifest.json', JSON.stringify({ work_units: { pay: { work_type: 'feature' } } }, null, 2) + '\n');
    writeFile(dir, '.workflows/pay/manifest.json', '{"name":"pay","work_type":"feature","status":"in-progress"}\n');
    writeFile(dir, '.workflows/pay/discussion/pay.md', '# Discussion\n');
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'init']);
  });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  it('native: writes the verdict and commits it confined to the project manifest — a peer session\'s dirt never rides', () => {
    // A peer mid-write: an untracked scratch note and a modified discussion.
    writeFile(dir, '.workflows/pay/NOTES.md', 'peer scratch\n');
    writeFile(dir, '.workflows/pay/discussion/pay.md', '# Discussion\n\npeer session dirt\n');

    const res = run(dir, ['baseline', 'record', 'native']);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.status, 'native');
    assert.match(res.committed, /^[0-9a-f]+$/);
    assert.deepStrictEqual(projectManifest(dir).baseline, { status: 'native' });
    assert.deepStrictEqual(projectManifest(dir).work_units, { pay: { work_type: 'feature' } }, 'sibling keys survive');

    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'baseline: the project grew up on the workflows');
    const landed = git(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).split('\n').map((l) => l.trim()).filter(Boolean);
    assert.deepStrictEqual(landed, ['.workflows/manifest.json']);
    const status = git(dir, ['status', '--porcelain']).split('\n').filter(Boolean);
    assert.ok(status.some((l) => l.startsWith('?? ') && l.includes('NOTES.md')), `the peer's untracked note is still untracked:\n${status.join('\n')}`);
    assert.ok(status.some((l) => l.startsWith(' M ') && l.includes('discussion/pay.md')), `the peer's modified discussion is still dirty:\n${status.join('\n')}`);
  });

  it('skipped: the decline, with its own message', () => {
    const res = run(dir, ['baseline', 'record', 'skipped']);
    assert.strictEqual(res.status, 'skipped');
    assert.deepStrictEqual(projectManifest(dir).baseline, { status: 'skipped' });
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'baseline: decline the assessment offer');
  });

  it('refuses any other value, and refuses once anything is recorded — the judgment happens once', () => {
    refuses(dir, ['baseline', 'record', 'bananas'], /one of native, skipped — got "bananas"/);
    refuses(dir, ['baseline', 'record'], /Usage: engine baseline record/);
    refuses(dir, ['baseline', 'nope'], /Unknown baseline command/);
    assert.strictEqual(projectManifest(dir).baseline, undefined, 'a refused verdict writes nothing');

    run(dir, ['baseline', 'record', 'native']);
    refuses(dir, ['baseline', 'record', 'skipped'], /the baseline is "native" — the verdict is recorded once/);
    refuses(dir, ['baseline', 'record', 'native'], /recorded once/);
    for (const status of ['in-progress', 'completed', 'skipped']) {
      const m = projectManifest(dir);
      m.baseline = { status, areas: { overview: 'completed' } };
      writeFile(dir, '.workflows/manifest.json', JSON.stringify(m, null, 2) + '\n');
      refuses(dir, ['baseline', 'record', 'native'], new RegExp(`the baseline is "${status}"`));
    }
  });

  it('a nothing-recorded object and a missing project manifest both take the verdict', () => {
    const m = projectManifest(dir);
    m.baseline = {};
    writeFile(dir, '.workflows/manifest.json', JSON.stringify(m, null, 2) + '\n');
    git(dir, ['commit', '-q', '-am', 'nothing recorded']);
    run(dir, ['baseline', 'record', 'native']);
    assert.deepStrictEqual(projectManifest(dir).baseline, { status: 'native' });

    fs.rmSync(path.join(dir, '.workflows/manifest.json'));
    git(dir, ['commit', '-q', '-am', 'drop the project manifest']);
    const res = run(dir, ['baseline', 'record', 'skipped']);
    assert.deepStrictEqual(projectManifest(dir).baseline, { status: 'skipped' });
    assert.match(res.committed, /^[0-9a-f]+$/);
  });
});

describe('the baseline signal across the project\'s repos', () => {
  const { baselineSignal } = require('../../skills/workflow-engine/scripts/domain/baseline.cjs');
  let dir;
  let api;
  beforeEach(() => {
    dir = harness.setupGitFixture('engine-baseline-repos-');
    writeFile(dir, '.gitignore', 'api/\n');
    writeFile(dir, 'README.md', '# Project\n');
    api = harness.initRepo(path.join(dir, 'api'));
  });
  afterEach(() => harness.cleanupFixture(dir));

  /** Commit everything in the repo at `repo`, authored and committed on `date`. */
  function commitOn(repo, message, date) {
    const when = `${date}T12:00:00Z`;
    git(repo, ['add', '-A']);
    execFileSync('git', ['commit', '-q', '-m', message], { cwd: repo, env: { ...process.env, GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when } });
  }

  it('totals history and files across the root and a clone it ignores — the arrival stays the root\'s, and cuts the clone at its last commit before it', () => {
    writeFile(api, 'src/a.js', 'a\n');
    writeFile(api, 'src/b.js', 'b\n');
    commitOn(api, 'api: the first endpoints', '2025-01-15');
    commitOn(dir, 'initial', '2025-03-01');
    writeFile(api, 'src/c.js', 'c\n');
    commitOn(api, 'api: billing', '2025-05-01');
    writeFile(dir, '.workflows/manifest.json', '{}\n');
    commitOn(dir, 'add workflows', '2025-09-01');
    writeFile(api, 'src/d.js', 'd\n');
    commitOn(api, 'api: built on the workflows', '2025-10-01');

    assert.deepStrictEqual(baselineSignal(dir), {
      root_date: '2025-01-15', workflows_date: '2025-09-01', commits_total: 5, commits_before: 3,
      history_before: ['2025-01-15  api: the first endpoints', '2025-03-01  initial', '2025-05-01  api: billing'],
      files_at_arrival: 5, tree_at_arrival: ['api/ (3)', '.gitignore', 'README.md'],
    });
  });

  it('with nothing under .workflows/ committed, every repo\'s whole history and HEAD tree came before — a submodule\'s pointer is never a file, an empty repo adds nothing', () => {
    writeFile(api, 'src/a.js', 'a\n');
    writeFile(api, 'src/b.js', 'b\n');
    commitOn(api, 'api: the first endpoints', '2025-02-01');
    commitOn(dir, 'initial', '2025-03-01');
    const sdkSource = harness.initRepo(`${dir}-sdk-source`);
    writeFile(sdkSource, 'index.js', 'sdk\n');
    commitOn(sdkSource, 'sdk: the client', '2025-01-10');
    harness.addSubmodule(dir, 'vendor/sdk', sdkSource);
    execFileSync('git', ['commit', '-q', '--amend', '--no-edit', '--date', '2025-04-01T12:00:00Z'],
      { cwd: dir, env: { ...process.env, GIT_COMMITTER_DATE: '2025-04-01T12:00:00Z' } });
    harness.initRepo(path.join(dir, 'fresh'));
    writeFile(dir, 'fresh/notes.txt', 'nothing committed\n');

    try {
      assert.deepStrictEqual(baselineSignal(dir), {
        root_date: '2025-01-10', workflows_date: null, commits_total: 4, commits_before: 4,
        history_before: ['2025-01-10  sdk: the client', '2025-02-01  api: the first endpoints', '2025-03-01  initial', '2025-04-01  add vendor/sdk'],
        files_at_arrival: 6, tree_at_arrival: ['api/ (2)', '.gitignore', '.gitmodules', 'README.md', 'vendor/ (1)'],
      });
    } finally {
      harness.cleanupFixture(`${dir}-sdk-source`);
    }
  });

  it('a shallow nested clone adds its tree alone — its truncated history is no account of what came before', () => {
    const source = harness.initRepo(`${dir}-api-source`);
    writeFile(source, 'src/a.js', 'a\n');
    commitOn(source, 'api: one', '2025-01-01');
    writeFile(source, 'src/b.js', 'b\n');
    commitOn(source, 'api: two', '2025-02-01');
    fs.rmSync(api, { recursive: true, force: true });
    execFileSync('git', ['clone', '-q', '--depth', '1', `file://${source}`, api]);
    commitOn(dir, 'initial', '2025-03-01');

    try {
      assert.deepStrictEqual(baselineSignal(dir), {
        root_date: '2025-03-01', workflows_date: null, commits_total: 1, commits_before: 1,
        history_before: ['2025-03-01  initial'],
        files_at_arrival: 4, tree_at_arrival: ['api/ (2)', '.gitignore', 'README.md'],
      });
    } finally {
      harness.cleanupFixture(`${dir}-api-source`);
    }
  });
});

describe('the baseline signal\'s failures', () => {
  const reposModule = require.resolve('../../skills/workflow-engine/scripts/kernel/repos.cjs');
  const baselineModule = require.resolve('../../skills/workflow-engine/scripts/domain/baseline.cjs');

  it('throws a failure that is no git read — only a failed git read nulls the signal', () => {
    const dir = harness.setupGitFixture('engine-baseline-bug-');
    const repos = require(reposModule);
    const projectRepos = repos.projectRepos;
    // A repo list with no root: the signal's own code then reads a property of undefined.
    repos.projectRepos = () => [];
    delete require.cache[baselineModule];
    try {
      const { baselineSignal } = require(baselineModule);
      assert.throws(() => baselineSignal(dir), TypeError);
    } finally {
      repos.projectRepos = projectRepos;
      delete require.cache[baselineModule];
      harness.cleanupFixture(dir);
    }
  });
});

describe('the baseline signal of a project inside a larger repository', () => {
  const { baselineSignal } = require('../../skills/workflow-engine/scripts/domain/baseline.cjs');
  let dir;
  beforeEach(() => { dir = harness.setupGitFixture('engine-baseline-nested-'); });
  afterEach(() => harness.cleanupFixture(dir));

  function commitOn(message, date) {
    const when = `${date}T12:00:00Z`;
    git(dir, ['add', '-A']);
    execFileSync('git', ['commit', '-q', '-m', message], { cwd: dir, env: { ...process.env, GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when } });
  }

  it('reads the commits that touched the project\'s folder alone — never its siblings\'', () => {
    const project = path.join(dir, 'apps/web');
    writeFile(dir, 'tools/build.sh', 'build\n');
    commitOn('tools: the build', '2025-01-01');
    writeFile(project, 'src/app.js', '1\n');
    commitOn('web: the app', '2025-02-01');
    writeFile(dir, 'tools/lint.sh', 'lint\n');
    commitOn('tools: the linter', '2025-03-01');
    writeFile(project, '.workflows/manifest.json', '{}\n');
    commitOn('web: add workflows', '2025-04-01');
    writeFile(dir, 'tools/deploy.sh', 'deploy\n');
    commitOn('tools: deploy', '2025-05-01');

    assert.deepStrictEqual(baselineSignal(project), {
      root_date: '2025-02-01', workflows_date: '2025-04-01', commits_total: 2, commits_before: 1,
      history_before: ['2025-02-01  web: the app'],
      files_at_arrival: 1, tree_at_arrival: ['src/ (1)'],
    });
  });
});
