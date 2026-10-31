'use strict';

// ---------------------------------------------------------------------------
// The commit door's state scopes: the pathspec'd commits on the state
// branch — `engine commit --topic`, `--discovery`, `--product`, `--imports`,
// `--state` and `--plan` — each taking its own scope and nothing beside it,
// and `--migrations`, the state with the paths the workflows own in the code
// tree.
//
// Layer: git. World: the project world and its code projects, built once and
// copied (engine-harness.cjs), the commit door's epic over them
// (commit-door-world.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const harness = require('./engine-harness.cjs');
const { ok, refuses, git, stateGit, commitAll, cleanupFixture, fixtureFrom, statePath, layout, createFile, writeState, readState } = harness;
const { headFiles, statusLines, codeHeadFiles, codeStatusLines, epicManifest, twoTopics, setupTwoTopicFixture } = require('./commit-door-world.cjs');
const { commitStaged } = require('../../skills/leeway-engine/scripts/kernel/git.cjs');

describe('engine commit --topic: pathspec isolation', () => {
  let dir;
  beforeEach(() => { dir = setupTwoTopicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('commits own topic + manifest, leaves the other topic dirty and uncommitted', () => {
    writeState(dir, layout.doc('payments', 'investigation', 'topic-a'), '# Topic A\nprogress\n');
    writeState(dir, layout.doc('payments', 'investigation', 'topic-b'), '# Topic B\npeer session dirt\n');
    writeState(dir, layout.manifest('payments'), JSON.stringify(epicManifest(), null, 2) + '\n\n');

    const res = ok(dir, ['commit', 'payments', '-m', 'investigation(payments/topic-a): progress', '--topic', 'investigation/topic-a']);

    assert.strictEqual(res.ok, true);
    assert.match(res.committed, /^[0-9a-f]+$/);
    const files = headFiles(dir);
    assert.ok(files.includes(layout.doc('payments', 'investigation', 'topic-a')), 'own topic committed');
    assert.ok(files.includes(layout.manifest('payments')), 'manifest committed');
    assert.ok(!files.includes(layout.doc('payments', 'investigation', 'topic-b')), 'peer topic not committed');
    assert.deepStrictEqual(statusLines(dir), [` M ${layout.doc('payments', 'investigation', 'topic-b')}`], 'peer dirt untouched');
  });

  it('commits an experiment record tree whole — documents, data, nested sub-records — and leaves the tree clean', () => {
    writeState(dir, layout.experiment('payments', 'topic-a', 'E1-x', 'problem.md'), '# Problem\n');
    writeState(dir, layout.experiment('payments', 'topic-a', 'E1-x', 'design.md'), '# Design\n');
    writeState(dir, layout.experiment('payments', 'topic-a', 'E1-x', 'data', 'samples.csv'), 'a,b\n');
    writeState(dir, layout.experiment('payments', 'topic-a', 'E1-x', 'E1.1-y', 'report.md'), '# Sub report\n');
    writeState(dir, layout.manifest('payments'), JSON.stringify(epicManifest(), null, 2) + '\n\n');
    writeState(dir, layout.doc('payments', 'investigation', 'topic-b'), '# Topic B\npeer session dirt\n');

    const res = ok(dir, ['commit', 'payments', '-m', 'experiment(payments/topic-a): E1 designed', '--topic', 'experiment/topic-a']);
    assert.strictEqual(res.ok, true);
    const files = headFiles(dir);
    for (const rel of [
      layout.experiment('payments', 'topic-a', 'E1-x', 'problem.md'),
      layout.experiment('payments', 'topic-a', 'E1-x', 'design.md'),
      layout.experiment('payments', 'topic-a', 'E1-x', 'data', 'samples.csv'),
      layout.experiment('payments', 'topic-a', 'E1-x', 'E1.1-y', 'report.md'),
      layout.manifest('payments'),
    ]) {
      assert.ok(files.includes(rel), `record tree committed whole: ${rel}`);
    }
    assert.deepStrictEqual(statusLines(dir), [` M ${layout.doc('payments', 'investigation', 'topic-b')}`],
      'the record tree is clean; only the peer dirt remains');
  });

  it('commits an untracked artifact directory (specification phase)', () => {
    writeState(dir, layout.spec('payments', 'topic-a'), '# Spec\n');

    const res = ok(dir, ['commit', 'payments', '-m', 'spec(payments): construct topic-a', '--topic', 'specification/topic-a']);

    assert.match(res.committed, /^[0-9a-f]+$/);
    assert.ok(headFiles(dir).includes(layout.spec('payments', 'topic-a')));
  });

  it('reports nothing to commit on clean paths, and on paths that do not exist', () => {
    const clean = ok(dir, ['commit', 'payments', '-m', 'noop', '--topic', 'investigation/topic-a']);
    assert.strictEqual(clean.committed, null);
    assert.strictEqual(clean.note, 'nothing to commit');

    const missing = ok(dir, ['commit', 'payments', '-m', 'noop', '--topic', 'review/never-started']);
    assert.strictEqual(missing.committed, null);
    assert.strictEqual(missing.note, 'nothing to commit');
  });

  it('regression: --topic commits survive an emptied mailbox (the post-drain state)', () => {
    // A message lands and is committed, its removal is committed, then the
    // work goes on: the emptied-but-present directory must not poison later
    // --topic commits.
    writeState(dir, layout.mailbox('payments', 'topic-a', '001-q.md'), 'Q\n');
    commitAll(dir, 'a delivered message');
    fs.unlinkSync(statePath(dir, layout.mailbox('payments', 'topic-a', '001-q.md')));
    const drain = ok(dir, ['commit', 'payments', '-m', 'investigation(payments/topic-a): drain mailbox', '--topic', 'investigation/topic-a']);
    assert.match(drain.committed, /^[0-9a-f]+$/, 'the drain commit stages the deletion');

    writeState(dir, layout.doc('payments', 'investigation', 'topic-a'), '# Topic A\nprogress after the drain\n');
    const after = ok(dir, ['commit', 'payments', '-m', 'investigation(payments/topic-a): progress', '--topic', 'investigation/topic-a']);
    assert.match(after.committed, /^[0-9a-f]+$/, 'the emptied mailbox directory no longer breaks the pathspec');
    assert.ok(fs.existsSync(statePath(dir, layout.mailbox('payments', 'topic-a'))), 'the empty dir is still on disk — excluded, not deleted');
  });

  it('an investigation\'s mailbox rides its own topic\'s commit', () => {
    // A mailbox is legal for investigation, and a delivery whose own tail commit
    // failed leaves the message file on disk with a pending note prescribing
    // `--topic investigation/{topic} --sweep` as the retry. Without the
    // sidecar in the scope that retry commits the manifest and walks past the
    // message it was run to land.
    writeState(dir, layout.manifest('crash-fix'), JSON.stringify({
      name: 'crash-fix',
      work_type: 'bugfix',
      status: 'in-progress',
      phases: { investigation: { items: { 'crash-fix': { status: 'in-progress' } } } },
    }, null, 2) + '\n');
    writeState(dir, layout.doc('crash-fix', 'investigation', 'crash-fix'), '# Investigation — Crash Fix\n');
    commitAll(dir, 'a bugfix under investigation');

    writeState(dir, layout.mailbox('crash-fix', 'crash-fix', '001-q.md'),
      '### Q\n*From: topic-a · discussion · 2026-01-01*\n\nBody.\n');
    const landed = ok(dir, ['commit', 'crash-fix', '-m', 'investigation(crash-fix): land the message',
      '--topic', 'investigation/crash-fix', '--sweep']);

    assert.match(landed.committed, /^[0-9a-f]+$/);
    assert.ok(headFiles(dir).includes(layout.mailbox('crash-fix', 'crash-fix', '001-q.md')),
      'the waiting message rides the investigation topic commit');

    // And the drain's deletion commits on the same scope.
    fs.unlinkSync(statePath(dir, layout.mailbox('crash-fix', 'crash-fix', '001-q.md')));
    const drain = ok(dir, ['commit', 'crash-fix', '-m', 'investigation(crash-fix): drain mailbox',
      '--topic', 'investigation/crash-fix']);
    assert.match(drain.committed, /^[0-9a-f]+$/, 'the drain commit stages the deletion');
    assert.deepStrictEqual(statusLines(dir), [], 'nothing left dirty');
  });

  it('rejects malformed and illegal --topic specs', () => {
    assert.match(refuses(dir, ['commit', 'payments', '-m', 'x', '--topic', 'bogus/topic-a']).error, /expected <phase>\/<topic>/);
    assert.match(refuses(dir, ['commit', 'payments', '-m', 'x', '--topic', 'discussion']).error, /expected <phase>\/<topic>/);
    assert.match(refuses(dir, ['commit', 'payments', '-m', 'x', '--topic', 'discussion/..']).error, /invalid topic name/);
    assert.match(refuses(dir, ['commit', 'payments', '-m', 'x', '--topic', 'investigation/topic-a', '--plan', 'topic-a']).error, /Usage/);
    assert.match(refuses(dir, ['commit', '--inbox', '-m', 'x', '--topic', 'investigation/topic-a']).error, /Usage/);
    assert.match(refuses(dir, ['commit', 'payments', '-m', 'x', '--topic', 'toString/topic-a']).error, /expected <phase>\/<topic>/);
    assert.match(refuses(dir, ['commit', 'payments', '-m', 'x', '--topic', '__proto__/topic-a']).error, /expected <phase>\/<topic>/);
  });
});

describe('engine commit --discovery: a unit\'s discovery scope', () => {
  let dir;
  beforeEach(() => { dir = setupTwoTopicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('commits the unit\'s discovery logs, each topic\'s brief and the manifest — never a live peer\'s topic or a topic\'s mail', () => {
    writeState(dir, layout.session('payments', '001'), '# Session 001\n');
    writeState(dir, layout.topic('payments', 'topic-a', 'brief.md'), '# Brief — topic A\n');
    writeState(dir, layout.manifest('payments'), JSON.stringify(epicManifest(), null, 2) + '\n\n');
    writeState(dir, layout.doc('payments', 'investigation', 'topic-b'), '# Topic B\npeer session dirt\n');
    writeState(dir, layout.mailbox('payments', 'topic-a', '001-retry-policy.md'), '# A message waiting\n');

    const res = ok(dir, ['commit', 'payments', '--discovery', '-m', 'discovery(payments): shape the map']);

    assert.match(res.committed, /^[0-9a-f]+$/);
    assert.deepStrictEqual(headFiles(dir).sort(), [layout.session('payments', '001'), layout.manifest('payments'), layout.topic('payments', 'topic-a', 'brief.md')].sort());
    assert.deepStrictEqual(statusLines(dir).sort(), [` M ${layout.doc('payments', 'investigation', 'topic-b')}`, `?? ${layout.mailbox('payments', 'topic-a')}/`].sort(), 'peer dirt and the mail untouched');
  });

  it('commits a brief removed and a topic folder removed whole, leaving the state clean', () => {
    writeState(dir, layout.topic('payments', 'topic-a', 'brief.md'), '# Brief — topic A\n');
    writeState(dir, layout.topic('payments', 'topic-b', 'brief.md'), '# Brief — topic B\n');
    commitAll(dir, 'two briefs');
    fs.unlinkSync(statePath(dir, layout.topic('payments', 'topic-a', 'brief.md')));
    fs.rmSync(statePath(dir, layout.topic('payments', 'topic-b')), { recursive: true });

    ok(dir, ['commit', 'payments', '--discovery', '-m', 'discovery(payments): two topics gone']);

    assert.deepStrictEqual(headFiles(dir).sort(), [layout.topic('payments', 'topic-a', 'brief.md'), layout.topic('payments', 'topic-b', 'brief.md')].sort());
    assert.deepStrictEqual(statusLines(dir), []);
  });

  it('reports nothing to commit on a work unit with no discovery content', () => {
    const clean = ok(dir, ['commit', 'payments', '--discovery', '-m', 'noop']);
    assert.strictEqual(clean.committed, null);
    assert.strictEqual(clean.note, 'nothing to commit');
  });

  it('refuses --discovery beside another scope flag', () => {
    assert.match(refuses(dir, ['commit', 'payments', '--discovery', '-m', 'x', '--topic', 'investigation/topic-a']).error, /Usage/);
    assert.match(refuses(dir, ['commit', '--discovery', '-m', 'x']).error, /Usage/);
  });
});

// The product's session log and the project manifest written, beside every
// file `commit --product` leaves out: a unit's brief, the inbox, the
// roadmap's notes, and a shared file no log links (9.S38).
const productWorld = fixtureFrom('engine-commit-product-', (dir) => {
  twoTopics(dir);
  writeState(dir, layout.productSession('001'), '# Product session 001\n');
  writeState(dir, layout.projectManifest, `${readState(dir, layout.projectManifest).trimEnd()}\n\n`);
  writeState(dir, layout.topic('payments', 'topic-a', 'brief.md'), '# Brief — topic A\n');
  writeState(dir, layout.inbox('ideas', '2026-10-30--dark-mode.md'), '# Dark mode\n');
  writeState(dir, '.roadmap/notes/ideas/2026-10-30--loyalty.md', '# Loyalty\n');
  writeState(dir, '.product/assets/market.md', '# Market\n');
});

describe('engine commit --product: the product\'s conversation\'s scope', () => {
  it('commits the product\'s session logs and the project manifest — never a unit\'s files, the inbox, the roadmap\'s notes or an unlinked shared file; beside a work unit or another scope it is refused', () => {
    const dir = productWorld();
    try {
      assert.match(refuses(dir, ['commit', 'payments', '--product', '-m', 'x']).error, /Usage/);
      assert.match(refuses(dir, ['commit', '--product', '--inbox', '-m', 'x']).error, /Usage/);
      const untracked = ['?? .inbox/', '?? .product/assets/', '?? .roadmap/', '?? payments/topics/'];

      ok(dir, ['commit', '--product', '-m', 'product: session 001']);
      assert.deepStrictEqual([headFiles(dir).sort(), statusLines(dir).sort()], [[layout.productSession('001'), layout.projectManifest].sort(), untracked]);
    } finally {
      cleanupFixture(dir);
    }
  });
});

describe('engine commit --imports: the landing\'s retry scope', () => {
  let dir;
  beforeEach(() => { dir = setupTwoTopicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('commits the imports home and the manifest — never a live peer\'s topic', () => {
    writeState(dir, layout.imports('payments', 'dockset-05.jpeg'), 'jpeg bytes\n');
    writeState(dir, layout.manifest('payments'), JSON.stringify(epicManifest(), null, 2) + '\n\n');
    writeState(dir, layout.doc('payments', 'investigation', 'topic-b'), '# Topic B\npeer session dirt\n');

    const res = ok(dir, ['commit', 'payments', '--imports', '-m', 'workflow(payments): import 1 file(s) for discussion/topic-a']);

    assert.match(res.committed, /^[0-9a-f]+$/);
    const files = headFiles(dir);
    assert.ok(files.includes(layout.imports('payments', 'dockset-05.jpeg')), 'the landed file committed');
    assert.ok(files.includes(layout.manifest('payments')), 'the manifest its entry lives on committed');
    assert.ok(!files.includes(layout.doc('payments', 'investigation', 'topic-b')), 'the peer session\'s topic is not swept');
    assert.deepStrictEqual(statusLines(dir), [` M ${layout.doc('payments', 'investigation', 'topic-b')}`], 'peer dirt untouched');
  });

  it('refuses --imports beside another scope flag, and with no work unit', () => {
    assert.match(refuses(dir, ['commit', 'payments', '--imports', '-m', 'x', '--discovery']).error, /Usage/);
    assert.match(refuses(dir, ['commit', 'payments', '--imports', '-m', 'x', '--topic', 'investigation/topic-a']).error, /Usage/);
    assert.match(refuses(dir, ['commit', '--imports', '-m', 'x']).error, /Usage/);
  });
});

describe('engine commit --state: the analysis scopes', () => {
  let dir;
  beforeEach(() => { dir = setupTwoTopicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('the work unit form takes its analysis dir and its manifest', () => {
    writeState(dir, layout.unitState('payments', 'discussion-consolidation-analysis.md'), '# Groupings\n');
    writeState(dir, layout.manifest('payments'), JSON.stringify(epicManifest(), null, 2) + '\n\n');
    // A live peer mid-write, in the same work unit — the theft this scope closes.
    writeState(dir, layout.doc('payments', 'investigation', 'topic-b'), '# Topic B\npeer session dirt\n');
    writeState(dir, layout.spec('payments', 'topic-a'), '# Spec\nhalf written\n');

    const res = ok(dir, ['commit', 'payments', '--state', '-m', 'spec(payments): grouping analysis']);

    assert.match(res.committed, /^[0-9a-f]+$/);
    const files = headFiles(dir);
    assert.ok(files.includes(layout.unitState('payments', 'discussion-consolidation-analysis.md')), 'the analysis rides');
    assert.ok(files.includes(layout.manifest('payments')), 'so does the manifest it wrote');
    assert.deepStrictEqual(
      statusLines(dir).sort(),
      [` M ${layout.doc('payments', 'investigation', 'topic-b')}`, `?? ${layout.unit('payments', 'specification')}/`],
      'both live peers keep every byte they had not committed',
    );
  });

  it('the global form takes .leeway/.state and nothing else', () => {
    writeState(dir, layout.projectState('environment-setup.md'), '# Environment\n');
    writeState(dir, layout.doc('payments', 'investigation', 'topic-b'), '# Topic B\npeer session dirt\n');
    writeState(dir, layout.manifest('payments'), JSON.stringify(epicManifest(), null, 2) + '\n\n');

    const res = ok(dir, ['commit', '--state', '-m', 'chore: record environment setup']);

    assert.deepStrictEqual(headFiles(dir), [layout.projectState('environment-setup.md')]);
    assert.match(res.committed, /^[0-9a-f]+$/);
    assert.deepStrictEqual(
      statusLines(dir).sort(),
      [` M ${layout.doc('payments', 'investigation', 'topic-b')}`, ` M ${layout.manifest('payments')}`],
      'a work unit is none of the global state dir\'s business',
    );
  });

  it('reports nothing to commit on a clean scope, and refuses a second scope flag', () => {
    const clean = ok(dir, ['commit', 'payments', '--state', '-m', 'noop']);
    assert.strictEqual(clean.committed, null);
    assert.strictEqual(clean.note, 'nothing to commit');

    assert.match(refuses(dir, ['commit', 'payments', '--state', '--discovery', '-m', 'x']).error, /Usage/);
    assert.match(refuses(dir, ['commit', 'payments', '--state', '-m', 'x', '--topic', 'investigation/topic-a']).error, /Usage/);
    assert.match(refuses(dir, ['commit', 'payments', '--state', '-m', 'x', '--plan', 'topic-a']).error, /Usage/);
    assert.match(refuses(dir, ['commit', '--state', '--inbox', '-m', 'x']).error, /Usage/);
    assert.match(refuses(dir, ['commit', '--state', '-m', 'x', '--topic', 'investigation/topic-a']).error, /Usage/);
    assert.match(refuses(dir, ['commit', 'no-such-unit', '--state', '-m', 'x']).error, /no work unit directory/);
  });

  it('never beats — an analysis is not a session sitting in a topic', () => {
    writeState(dir, layout.unitState('payments', 'discussion-consolidation-analysis.md'), '# Groupings\n');
    ok(dir, ['commit', 'payments', '--state', '-m', 'spec(payments): grouping analysis']);
    assert.ok(!fs.existsSync(statePath(dir, layout.cache('payments'))), 'no heartbeat anywhere');
  });
});

describe('engine commit --plan: the planning topic plus the plan\'s storage', () => {
  let dir;
  beforeEach(() => { dir = setupTwoTopicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('commits the planning topic and the declared storage, leaving foreign dirt behind', () => {
    const manifest = epicManifest();
    manifest.phases.planning = { items: { 'topic-a': { status: 'in-progress', storage_paths: ['plans/topic-a'] } } };
    writeState(dir, layout.manifest('payments'), JSON.stringify(manifest, null, 2) + '\n');
    createFile(dir, 'plans/topic-a/tasks.md', '# Tasks\n');
    createFile(dir, 'src/app.js', 'const x = 1;\n');
    commitAll(dir, 'plan storage');

    writeState(dir, layout.plan('payments', 'topic-a'), '# Plan\n');
    createFile(dir, 'plans/topic-a/tasks.md', '# Tasks\n- one\n');
    createFile(dir, 'src/app.js', 'const x = 2;\n');
    // A peer session mid-write, inside the same work unit.
    writeState(dir, layout.doc('payments', 'investigation', 'topic-b'), '# Topic B\npeer session dirt\n');

    const res = ok(dir, ['commit', 'payments', '-m', 'plan(payments): author', '--plan', 'topic-a']);

    assert.strictEqual(res.committed, stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim());
    assert.strictEqual(res.code_committed, git(dir, ['rev-parse', '--short', 'HEAD']).trim());
    assert.deepStrictEqual(headFiles(dir), [layout.plan('payments', 'topic-a')], 'the planning topic rides the state');
    assert.deepStrictEqual(codeHeadFiles(dir), ['plans/topic-a/tasks.md'],
      'the declared storage rides the code tree — and code outside it never does');
    assert.deepStrictEqual(statusLines(dir), [` M ${layout.doc('payments', 'investigation', 'topic-b')}`],
      'a sibling topic inside the same work unit is not a planning session\'s to commit');
    assert.deepStrictEqual(codeStatusLines(dir), [' M src/app.js'], 'nor is code outside the plan\'s storage');
  });

  it('leaves a sibling planning topic alone', () => {
    const manifest = epicManifest();
    manifest.phases.planning = { items: {
      'topic-a': { status: 'in-progress', storage_paths: [] },
      'topic-b': { status: 'in-progress', storage_paths: [] },
    } };
    writeState(dir, layout.manifest('payments'), JSON.stringify(manifest, null, 2) + '\n');
    writeState(dir, layout.plan('payments', 'topic-a'), '# Plan A\n');
    writeState(dir, layout.plan('payments', 'topic-b'), '# Plan B\n');
    commitAll(dir, 'two plans');

    writeState(dir, layout.plan('payments', 'topic-a'), '# Plan A\nphase 1\n');
    writeState(dir, layout.plan('payments', 'topic-b'), '# Plan B\na peer planner mid-write\n');

    ok(dir, ['commit', 'payments', '-m', 'planning(payments): draft phase structure', '--plan', 'topic-a']);

    assert.ok(headFiles(dir).includes(layout.plan('payments', 'topic-a')));
    assert.deepStrictEqual(statusLines(dir), [` M ${layout.plan('payments', 'topic-b')}`],
      'the peer planning session keeps its own dirt');
  });

  it('refuses a planning topic name that is a path', () => {
    assert.match(refuses(dir, ['commit', 'payments', '-m', 'x', '--plan', '../escapee']).error, /invalid planning topic name/);
    assert.match(refuses(dir, ['commit', 'payments', '-m', 'x', '--plan', 'a/b']).error, /invalid planning topic name/);
  });

  it('never takes another process\'s staged code', () => {
    const manifest = epicManifest();
    manifest.phases.planning = { items: { 'topic-a': { status: 'in-progress', storage_paths: [] } } };
    writeState(dir, layout.manifest('payments'), JSON.stringify(manifest, null, 2) + '\n');
    createFile(dir, 'src/app.js', 'const x = 1;\n');
    commitAll(dir, 'code');

    writeState(dir, layout.plan('payments', 'topic-a'), '# Plan\n');
    createFile(dir, 'src/app.js', 'const x = 2;\n');
    git(dir, ['add', '--', 'src/app.js']);

    const res = ok(dir, ['commit', 'payments', '-m', 'plan(payments): author', '--plan', 'topic-a']);

    assert.ok(headFiles(dir).includes(layout.plan('payments', 'topic-a')), 'the plan lands');
    assert.strictEqual(res.code_committed, null, 'staged code is not swept into a plan commit');
    assert.strictEqual(git(dir, ['diff', '--cached', '--name-only']).trim(), 'src/app.js', 'and stays staged');
  });
});

describe('engine commit --migrations: the state and the paths the workflows own', () => {
  const setup = fixtureFrom('engine-commit-', (at) => {
    writeState(at, layout.manifest('payments'), '{"name":"payments"}\n');
    createFile(at, '.claude/settings.json', '{}\n');
    createFile(at, '.worktreeinclude', '.leeway/.knowledge/store.bin\n');
    createFile(at, '.gitignore', '.leeway/\nnode_modules\n');
    createFile(at, 'src/app.js', 'const x = 1;\n');
    commitAll(at, 'init');
  });
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { cleanupFixture(dir); });

  const migrate = (message = 'chore: apply workflow migrations') => ok(dir, ['commit', '--migrations', '-m', message]);

  /** `git show --name-status` of the code tree's HEAD, sorted. */
  function headChanges() {
    return git(dir, ['show', '--name-status', '--pretty=format:', 'HEAD']).trim().split('\n').filter(Boolean).sort();
  }

  /** `git show --name-status` of the state branch's HEAD, sorted. */
  function stateChanges() {
    return stateGit(dir, ['show', '--name-status', '--pretty=format:', 'HEAD']).trim().split('\n').filter(Boolean).sort();
  }

  const codeHead = () => git(dir, ['rev-parse', '--short', 'HEAD']).trim();
  const stateHead = () => stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim();

  it('commits the whole state on its branch and every owned code path on the code branch — one commit each, nothing else (6.S25)', () => {
    createFile(dir, '.claude/settings.json', '{"permissions":{}}\n');
    fs.unlinkSync(path.join(dir, '.worktreeinclude'));
    createFile(dir, '.gitignore', '.leeway/\nnode_modules\n.DS_Store\n');
    writeState(dir, layout.manifest('payments'), '{"name":"payments","v":2}\n');
    writeState(dir, layout.migrations, '062\n');
    writeState(dir, layout.knowledge('store.bin'), 'local store\n');
    writeState(dir, layout.cache('payments', 'state.json'), '{}\n');
    createFile(dir, 'src/app.js', 'const x = 2;\n');
    createFile(dir, 'src/new.js', 'const n = 1;\n');

    const res = migrate();

    assert.deepStrictEqual(res, { ok: true, committed: stateHead(), code_committed: codeHead() });
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'chore: apply workflow migrations');
    assert.strictEqual(stateGit(dir, ['log', '-1', '--pretty=%s']).trim(), 'chore: apply workflow migrations');
    assert.deepStrictEqual(headChanges(), ['D\t.worktreeinclude', 'M\t.claude/settings.json', 'M\t.gitignore']);
    assert.deepStrictEqual(stateChanges(), [`A\t${layout.migrations}`, `M\t${layout.manifest('payments')}`]);
    assert.deepStrictEqual(codeStatusLines(dir).sort(), [' M src/app.js', '?? src/new.js'], 'code stays as it was');
    assert.deepStrictEqual(statusLines(dir), [], 'and the ignored store and cache stay out of the state');
    assert.strictEqual(stateGit(dir, ['ls-files', '--', '.knowledge', '.cache']).trim(), '');
  });

  it('commits one side alone where only it changed', () => {
    writeState(dir, layout.manifest('payments'), '{"name":"payments","v":2}\n');
    const before = codeHead();
    assert.deepStrictEqual(migrate(), { ok: true, committed: stateHead(), code_committed: null });
    assert.strictEqual(codeHead(), before, 'the code branch takes no state commit');

    createFile(dir, '.claude/settings.json', '{"hooks":{}}\n');
    const state = stateHead();
    assert.deepStrictEqual(migrate(), { ok: true, committed: null, code_committed: codeHead() });
    assert.strictEqual(stateHead(), state);
  });

  it('records a removal a migration staged in the code tree, the file left on disk', () => {
    createFile(dir, '.gitignore', '.leeway/\nnode_modules\n.worktreeinclude\n');
    git(dir, ['add', '--', '.gitignore']);
    git(dir, ['commit', '-q', '-m', 'the include is local now']);
    git(dir, ['rm', '-q', '--cached', '--', '.worktreeinclude']);

    migrate();

    assert.deepStrictEqual(headChanges(), ['D\t.worktreeinclude']);
    assert.strictEqual(git(dir, ['ls-files', '--', '.worktreeinclude']).trim(), '', 'no longer tracked');
    assert.ok(fs.existsSync(path.join(dir, '.worktreeinclude')), 'and still on disk');
    assert.deepStrictEqual(codeStatusLines(dir), []);
  });

  it('leaves another process\'s staged work out of the commit, still staged', () => {
    createFile(dir, 'src/app.js', 'const x = 2;\n');
    git(dir, ['add', '--', 'src/app.js']);
    createFile(dir, '.claude/settings.json', '{"hooks":{}}\n');

    migrate();

    assert.deepStrictEqual(headChanges(), ['M\t.claude/settings.json']);
    assert.strictEqual(git(dir, ['diff', '--cached', '--name-only']).trim(), 'src/app.js');
  });

  it('leaves an owned path the project ignores to git — never forced in', () => {
    createFile(dir, '.gitignore', '.leeway/\nnode_modules\n.claude/\n');
    git(dir, ['rm', '-q', '--cached', '--', '.claude/settings.json']);
    commitAll(dir, 'the project ignores its Claude Code settings');
    createFile(dir, '.claude/settings.json', '{"hooks":{}}\n');
    writeState(dir, layout.manifest('payments'), '{"name":"payments","v":2}\n');

    const res = migrate();

    assert.strictEqual(res.code_committed, null);
    assert.deepStrictEqual(stateChanges(), [`M\t${layout.manifest('payments')}`]);
    assert.strictEqual(git(dir, ['ls-files', '--', '.claude']).trim(), '');
  });

  it('leaves a tracked file whose directory the project ignores as it is — the rest still commit', () => {
    createFile(dir, '.gitignore', '.leeway/\nnode_modules\n.claude/\n');
    commitAll(dir, 'the project ignores .claude/ and still tracks its settings');
    createFile(dir, '.claude/settings.json', '{"hooks":{}}\n');
    createFile(dir, '.worktreeinclude', '.leeway/.knowledge/metadata.json\n');

    migrate();

    assert.deepStrictEqual(headChanges(), ['M\t.worktreeinclude']);
    assert.deepStrictEqual(codeStatusLines(dir), [' M .claude/settings.json']);
  });

  it('leaves settings beyond a symbolic link as they are — the rest still commit', () => {
    git(dir, ['rm', '-r', '-q', '--', '.claude']);
    createFile(dir, 'config/claude/settings.json', '{}\n');
    fs.symlinkSync('config/claude', path.join(dir, '.claude'));
    commitAll(dir, '.claude links to the shared config');
    createFile(dir, 'config/claude/settings.json', '{"hooks":{}}\n');
    createFile(dir, '.worktreeinclude', '.leeway/.knowledge/metadata.json\n');

    migrate();

    assert.deepStrictEqual(headChanges(), ['M\t.worktreeinclude']);
    assert.deepStrictEqual(codeStatusLines(dir), [' M config/claude/settings.json']);
  });

  it('never reads another process\'s hold on the index as a refusal', () => {
    createFile(dir, '.claude/settings.json', '{"hooks":{}}\n');
    fs.writeFileSync(path.join(dir, '.git', 'index.lock'), '');
    const before = codeHead();

    const res = refuses(dir, ['commit', '--migrations', '-m', 'x'], { env: { LEEWAY_GIT_LOCK_BUDGET_MS: '200' } });

    assert.match(res.error, /index\.lock/);
    assert.strictEqual(codeHead(), before);
  });

  it('commits a project nested in its repository under the project\'s own directory — the state the repository\'s', () => {
    const repo = harness.setupGitFixture('engine-commit-nested-');
    try {
      const project = path.join(repo, 'apps/web');
      createFile(repo, 'README.md', '# monorepo\n');
      writeState(repo, layout.manifest('payments'), '{"name":"payments"}\n');
      createFile(project, '.claude/settings.json', '{}\n');
      commitAll(repo, 'init');
      writeState(repo, layout.manifest('payments'), '{"name":"payments","v":2}\n');
      writeState(repo, layout.migrations, '062\n');
      createFile(project, '.claude/settings.json', '{"hooks":{}}\n');
      createFile(project, '.gitignore', '.DS_Store\n');

      ok(project, ['commit', '--migrations', '-m', 'chore: apply workflow migrations']);

      assert.deepStrictEqual(git(repo, ['show', '--name-status', '--pretty=format:', 'HEAD']).trim().split('\n').sort(), [
        'A\tapps/web/.gitignore',
        'M\tapps/web/.claude/settings.json',
      ]);
      assert.deepStrictEqual(stateGit(repo, ['show', '--name-status', '--pretty=format:', 'HEAD']).trim().split('\n').sort(), [
        'A\t.state/migrations',
        `M\t${layout.manifest('payments')}`,
      ]);
      assert.deepStrictEqual(codeStatusLines(repo), []);
      assert.deepStrictEqual(statusLines(repo), []);
    } finally {
      cleanupFixture(repo);
    }
  });

  it('refuses when HEAD\'s tree cannot be read — never a commit built on an empty tree', () => {
    createFile(dir, '.claude/settings.json', '{"hooks":{}}\n');
    writeState(dir, layout.manifest('payments'), '{"name":"payments","v":2}\n');
    const [code, state] = [codeHead(), stateHead()];
    // A git that fails the tree read alone, as a branch with no commits
    // would: exit 1, and every other call goes to the real git.
    const shim = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-git-shim-'));
    try {
      const realGit = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
      fs.writeFileSync(path.join(shim, 'git'),
        `#!/bin/sh\ncase "$*" in *'HEAD^{tree}'*) echo 'fatal: tree unreadable' >&2; exit 1;; esac\nexec '${realGit}' "$@"\n`,
        { mode: 0o755 });

      const res = refuses(dir, ['commit', '--migrations', '-m', 'x'], { env: { PATH: `${shim}:${process.env.PATH}` } });

      assert.match(res.error, /tree unreadable/);
      assert.deepStrictEqual([codeHead(), stateHead()], [code, state]);
    } finally {
      fs.rmSync(shim, { recursive: true, force: true });
    }
  });

  it('answers nothing to commit on clean owned paths and a clean state, and where no owned path exists', () => {
    assert.deepStrictEqual(migrate('noop'), { ok: true, committed: null, note: 'nothing to commit', code_committed: null });

    git(dir, ['rm', '-r', '-q', '--', '.claude', '.worktreeinclude']);
    git(dir, ['commit', '-q', '-m', 'code only']);
    const before = codeHead();
    assert.deepStrictEqual(migrate('noop'), { ok: true, committed: null, note: 'nothing to commit', code_committed: null });
    assert.strictEqual(codeHead(), before);
  });

  it('makes the first commit on a code branch with none yet', () => {
    git(dir, ['checkout', '-q', '--orphan', 'fresh']);
    git(dir, ['rm', '-r', '-q', '--cached', '--', '.']);

    const res = migrate();

    assert.strictEqual(res.code_committed, codeHead());
    assert.deepStrictEqual(git(dir, ['ls-files']).trim().split('\n'), ['.claude/settings.json', '.gitignore', '.worktreeinclude']);
    assert.deepStrictEqual(codeStatusLines(dir), ['?? src/'], 'code stays untracked');
  });

  it('refuses while a merge is in progress, staging nothing', () => {
    createFile(dir, '.claude/settings.json', '{"hooks":{}}\n');
    fs.writeFileSync(path.join(dir, '.git', 'MERGE_HEAD'), git(dir, ['rev-parse', 'HEAD']));
    const before = codeHead();

    assert.match(refuses(dir, ['commit', '--migrations', '-m', 'x']).error, /a merge is in progress \(MERGE_HEAD\)/);
    assert.strictEqual(codeHead(), before);
    assert.strictEqual(git(dir, ['diff', '--cached', '--name-only']).trim(), '');
  });

  it('refuses beside another scope, and without a message', () => {
    assert.match(refuses(dir, ['commit', '--migrations', '--workflows', '-m', 'x']).error, /Usage/);
    assert.match(refuses(dir, ['commit', '--migrations', '--state', '-m', 'x']).error, /Usage/);
    assert.match(refuses(dir, ['commit', 'payments', '--migrations', '-m', 'x']).error, /Usage/);
    assert.match(refuses(dir, ['commit', '--paths', 'src/app.js', '--migrations', '-m', 'x',
      '--for', 'payments', 'implementation/topic-a']).error, /Usage/);
    assert.match(refuses(dir, ['commit', '--migrations']).error, /Usage/);
  });

  it('takes each path literally — a file named with brackets is that file, never its glob siblings', () => {
    for (const rel of ['app/[id]/page.tsx', 'app/[id]/old.tsx', 'app/i/page.tsx', 'app/d/page.tsx']) createFile(dir, rel, `// ${rel}\n`);
    commitAll(dir, 'routes');
    for (const rel of ['app/[id]/page.tsx', 'app/i/page.tsx', 'app/d/page.tsx']) createFile(dir, rel, '// edited\n');
    fs.unlinkSync(path.join(dir, 'app/[id]/old.tsx'));
    git(dir, ['add', '--', 'app/d/page.tsx']);

    const sha = commitStaged(dir, ['app/[id]/page.tsx', 'app/[id]/old.tsx'], 'chore: the bracketed files');

    assert.strictEqual(sha, codeHead());
    assert.deepStrictEqual(headChanges(), ['D\tapp/[id]/old.tsx', 'M\tapp/[id]/page.tsx']);
    assert.deepStrictEqual(codeStatusLines(dir), ['M  app/d/page.tsx', ' M app/i/page.tsx'],
      'the glob siblings stay as they were — one staged, one not');
  });
});
