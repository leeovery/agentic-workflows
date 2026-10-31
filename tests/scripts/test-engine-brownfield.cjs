'use strict';

// ---------------------------------------------------------------------------
// The brownfield offer (leeway-engine/scripts/domain/brownfield.cjs):
// `brownfield record`, the offer's answer written and committed confined to
// the project manifest — native, skipped or accepted once, while nothing is
// recorded, and completed once an accepted offer's research has landed
// (8.12.11, 8.12.13) — and the baseline signal, the code history from before
// the workflows arrived, read across the project's repos (8.12.10).
//
// Layer: git. World: the project fixture for the verb; plain repositories
// the test commits into, with dated commits and a state begun at a date, for
// the signal.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const harness = require('./engine-harness.cjs');
const { datedAt, createFile: writeFile, writeState, readState, statePath, layout } = require('./discovery-test-utils.cjs');
const { createState } = require('../../skills/leeway-engine/scripts/domain/state-worktree.cjs');

const { git, stateGit, commitAll, refusedPristine } = harness;

/** The project manifest as it stands on disk. @param {string} dir */
const projectManifest = (dir) => JSON.parse(readState(dir, layout.projectManifest));

/** The subject of the state branch's last commit. @param {string} dir */
const lastSubject = (dir) => stateGit(dir, ['log', '-1', '--pretty=%s']).trim();

describe('engine brownfield record', () => {
  let dir;
  beforeEach(() => {
    dir = harness.setupGitFixture('engine-brownfield-');
    writeState(dir, layout.projectManifest, JSON.stringify({ work_units: { pay: { work_type: 'feature' } } }, null, 2) + '\n');
    writeState(dir, layout.manifest('pay'), '{"name":"pay","work_type":"feature","status":"in-progress"}\n');
    writeState(dir, 'pay/summary.md', '# Summary\n');
    commitAll(dir, 'init');
  });
  afterEach(() => harness.cleanupFixture(dir));

  it('native: writes the answer and commits it on the state branch, confined to the project manifest — a peer session\'s dirt never rides', () => {
    writeState(dir, 'pay/spec.md', 'peer scratch\n');
    writeState(dir, 'pay/summary.md', '# Summary\n\npeer session dirt\n');

    const res = harness.ok(dir, ['brownfield', 'record', 'native']);
    assert.deepStrictEqual(res, { ok: true, answer: 'native', committed: res.committed });
    assert.match(res.committed, /^[0-9a-f]+$/);
    assert.deepStrictEqual(projectManifest(dir), { work_units: { pay: { work_type: 'feature' } }, brownfield_offer: 'native' });
    assert.strictEqual(lastSubject(dir), 'brownfield: the project grew up on the workflows');
    assert.deepStrictEqual(stateGit(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).split('\n').filter(Boolean), ['manifest.json']);
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'ignore the state', 'the default branch takes no state commit');
    const status = stateGit(dir, ['status', '--porcelain']).split('\n').filter(Boolean).sort();
    assert.deepStrictEqual(status, [' M pay/summary.md', '?? pay/spec.md'], 'the peer\'s files are as it left them');
  });

  it('skipped and accepted answer the offer too, each under its own message', () => {
    for (const [answer, subject] of [['skipped', 'brownfield: decline the research offer'], ['accepted', 'brownfield: accept the research offer']]) {
      writeState(dir, layout.projectManifest, JSON.stringify({ work_units: {} }) + '\n');
      commitAll(dir, `reset for ${answer}`);
      assert.strictEqual(harness.ok(dir, ['brownfield', 'record', answer]).answer, answer);
      assert.deepStrictEqual([projectManifest(dir).brownfield_offer, lastSubject(dir)], [answer, subject]);
    }
  });

  it('completed follows accepted, once its research has landed (8.12.13)', () => {
    harness.ok(dir, ['brownfield', 'record', 'accepted']);
    assert.strictEqual(harness.ok(dir, ['brownfield', 'record', 'completed']).answer, 'completed');
    assert.deepStrictEqual([projectManifest(dir).brownfield_offer, lastSubject(dir)], ['completed', 'brownfield: the research landed']);
  });

  it('refuses any other value, and any answer out of order — the offer is answered once, and only an accepted one completes', () => {
    refusedPristine(dir, ['brownfield', 'record', 'in-progress'], /the answer is one of native, skipped, accepted, completed — got "in-progress"/);
    refusedPristine(dir, ['brownfield', 'record'], /^Usage: engine brownfield record <native\|skipped\|accepted\|completed>$/);
    refusedPristine(dir, ['brownfield', 'nope'], /^Unknown brownfield command: nope\. Usage: engine brownfield record/);
    refusedPristine(dir, ['brownfield', 'record', 'completed'], /the offer's answer is "none" — completed follows "accepted"$/);

    harness.ok(dir, ['brownfield', 'record', 'accepted']);
    for (const answer of ['native', 'skipped', 'accepted']) {
      refusedPristine(dir, ['brownfield', 'record', answer], new RegExp(`the offer's answer is "accepted" — ${answer} follows nothing recorded$`));
    }
    harness.ok(dir, ['brownfield', 'record', 'completed']);
    refusedPristine(dir, ['brownfield', 'record', 'completed'], /the offer's answer is "completed" — completed follows "accepted"$/);

    writeState(dir, layout.projectManifest, JSON.stringify({ work_units: {}, brownfield_offer: 'skipped' }) + '\n');
    commitAll(dir, 'declined');
    refusedPristine(dir, ['brownfield', 'record', 'completed'], /the offer's answer is "skipped" — completed follows "accepted"$/);
  });

  it('a missing project manifest takes an answer', () => {
    fs.rmSync(statePath(dir, layout.projectManifest));
    commitAll(dir, 'drop the project manifest');
    const res = harness.ok(dir, ['brownfield', 'record', 'skipped']);
    assert.strictEqual(projectManifest(dir).brownfield_offer, 'skipped');
    assert.match(res.committed, /^[0-9a-f]+$/);
  });
});

/**
 * The workflows arriving in the repo at `dir` on `date`: its state begun by
 * the machinery, the state's first commit carrying that date.
 * @param {string} dir @param {string} date
 */
function beginState(dir, date) {
  datedAt(`${date}T12:00:00Z`, () => createState(path.join(dir, '.leeway')));
}

/** A repo with no state yet, its code history the test's to write. @param {string} prefix */
function bareProject(prefix) {
  return harness.initRepo(fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix))));
}

describe('the baseline signal across the project\'s repos', () => {
  const { baselineSignal } = require('../../skills/leeway-engine/scripts/domain/brownfield.cjs');
  let dir;
  let api;
  beforeEach(() => {
    dir = bareProject('engine-brownfield-repos-');
    writeFile(dir, '.gitignore', 'api/\n.leeway/\n');
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

  it('totals history and files across the root and a clone it ignores — the arrival is the state\'s first commit, and cuts each repo at its last commit before it', () => {
    writeFile(api, 'src/a.js', 'a\n');
    writeFile(api, 'src/b.js', 'b\n');
    commitOn(api, 'api: the first endpoints', '2025-01-15');
    commitOn(dir, 'initial', '2025-03-01');
    writeFile(api, 'src/c.js', 'c\n');
    commitOn(api, 'api: billing', '2025-05-01');
    beginState(dir, '2025-09-01');
    writeFile(api, 'src/d.js', 'd\n');
    commitOn(api, 'api: built on the workflows', '2025-10-01');
    writeFile(dir, 'src/e.js', 'e\n');
    commitOn(dir, 'built on the workflows', '2025-11-01');

    assert.deepStrictEqual(baselineSignal(dir), {
      root_date: '2025-01-15', workflows_date: '2025-09-01', commits_total: 5, commits_before: 3,
      history_before: ['2025-01-15  api: the first endpoints', '2025-03-01  initial', '2025-05-01  api: billing'],
      files_at_arrival: 5, tree_at_arrival: ['api/ (3)', '.gitignore', 'README.md'],
    });
  });

  it('with the state begun after every commit, every repo\'s whole history and HEAD tree came before — a submodule\'s pointer is never a file, an empty repo adds nothing', () => {
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
    beginState(dir, '2025-06-01');

    try {
      assert.deepStrictEqual(baselineSignal(dir), {
        root_date: '2025-01-10', workflows_date: '2025-06-01', commits_total: 4, commits_before: 4,
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
    beginState(dir, '2025-06-01');

    try {
      assert.deepStrictEqual(baselineSignal(dir), {
        root_date: '2025-03-01', workflows_date: '2025-06-01', commits_total: 1, commits_before: 1,
        history_before: ['2025-03-01  initial'],
        files_at_arrival: 4, tree_at_arrival: ['api/ (2)', '.gitignore', 'README.md'],
      });
    } finally {
      harness.cleanupFixture(`${dir}-api-source`);
    }
  });
});

describe('the baseline signal\'s failures', () => {
  const reposModule = require.resolve('../../skills/leeway-engine/scripts/kernel/repos.cjs');
  const brownfieldModule = require.resolve('../../skills/leeway-engine/scripts/domain/brownfield.cjs');

  it('throws a failure that is no git read — only a failed git read nulls the signal', () => {
    const dir = harness.setupGitFixture('engine-brownfield-bug-');
    const repos = require(reposModule);
    const projectRepos = repos.projectRepos;
    // A repo list with no root: the signal's own code then reads a property of undefined.
    repos.projectRepos = () => [];
    delete require.cache[brownfieldModule];
    try {
      const { baselineSignal } = require(brownfieldModule);
      assert.throws(() => baselineSignal(dir), TypeError);
    } finally {
      repos.projectRepos = projectRepos;
      delete require.cache[brownfieldModule];
      harness.cleanupFixture(dir);
    }
  });
});

describe('the baseline signal of a project inside a larger repository', () => {
  const { baselineSignal } = require('../../skills/leeway-engine/scripts/domain/brownfield.cjs');
  let dir;
  beforeEach(() => {
    dir = bareProject('engine-brownfield-nested-');
    writeFile(dir, '.gitignore', '.leeway/\n');
  });
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
    beginState(dir, '2025-04-01');
    writeFile(dir, 'tools/deploy.sh', 'deploy\n');
    commitOn('tools: deploy', '2025-05-01');
    writeFile(project, 'src/app.js', '2\n');
    commitOn('web: built on the workflows', '2025-06-01');

    assert.deepStrictEqual(baselineSignal(project), {
      root_date: '2025-02-01', workflows_date: '2025-04-01', commits_total: 2, commits_before: 1,
      history_before: ['2025-02-01  web: the app'],
      files_at_arrival: 1, tree_at_arrival: ['src/ (1)'],
    });
  });
});
