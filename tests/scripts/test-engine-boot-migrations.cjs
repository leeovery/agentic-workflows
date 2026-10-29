'use strict';

// ---------------------------------------------------------------------------
// Boot's migrations (workflow-engine/scripts/domain/boot.cjs): the run's
// report and notices, the stop gate's lines stripped; what boot commits of a
// run and what it leaves to the reviewed commit, the migrations record
// included; a peer session's staged work surviving every commit; and a
// failing migrate.cjs a hard error.
//
// Layer: verb. World: the project fixture (boot-world.cjs), a git repository
// with its state worktree and the workflows' hooks, made once per process and
// copied; boot runs from a copy of the engine beside a stand-in migration
// runner whose behaviour the test picks through the environment.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { git, stateGit, commitAll, statePath, layout, writeState } = harness;
const REAL_SCRIPTS = path.dirname(harness.ENGINE);
const { OWNED_PATHS } = require(path.join(REAL_SCRIPTS, 'domain/commit.cjs'));

const { createFile } = require('./discovery-test-utils.cjs');
const { WORKFLOW_HOOKS, hooked, LABELS_ON, stubbed, readyKnowledge, completedDiscussion, bootProject, runEngine, runEngineFails } = require('./boot-world.cjs');

describe('engine boot', () => {
  let fix;
  beforeEach(() => { fix = bootProject(); });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  it('pending migration: changed true, report captured with the stop-gate lines stripped', () => {
    const res = runEngine(stubbed, fix.project, ['boot'], { STUB_MIGRATE_MODE: 'update' });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.migrations.changed, true);
    assert.strictEqual(res.migrations.output, '1 migration(s) applied, 2 file(s) updated.');
    // The migration landed in the project's .leeway tree.
    assert.ok(fs.existsSync(statePath(fix.project, layout.unit('payments', 'marker.md'))));
    assert.match(stateGit(fix.project, ['status', '--porcelain']), /marker\.md/);
  });

  it('carries the run\'s notices for the person, stripped from the report', () => {
    const notices = [{ id: '067', description: 'a removal', notice: 'Removed a setting — add it back if you want it.' }];
    const res = runEngine(stubbed, fix.project, ['boot'], {
      STUB_MIGRATE_MODE: 'update',
      STUB_MIGRATE_NOTICES: JSON.stringify(notices),
    });

    assert.deepStrictEqual(res.migrations.notices, notices);
    assert.deepStrictEqual(res.migrations.verify, []);
    assert.strictEqual(res.migrations.output, '1 migration(s) applied, 2 file(s) updated.');
    assert.deepStrictEqual(res.warnings, []);
  });

  it('notices boot cannot read degrade to a warning and an empty list', () => {
    for (const payload of ['not json', '{"notice": "not a list"}']) {
      const res = runEngine(stubbed, fix.project, ['boot'], { STUB_MIGRATE_NOTICES: payload });
      assert.deepStrictEqual(res.migrations.notices, [], payload);
      assert.strictEqual(res.warnings.length, 1, payload);
      assert.match(res.warnings[0], /^migration notices unreadable: /, payload);
      assert.ok(!res.migrations.output.includes('MIGRATION_NOTICES'), payload);
    }
  });

  it('a migration touching config files commits none of them — the reviewed commit takes them with the rest', () => {
    const res = runEngine(stubbed, fix.project, ['boot'], {
      STUB_MIGRATE_MODE: 'update-config',
      STUB_MIGRATE_SETTINGS: hooked(WORKFLOW_HOOKS, { permissions: {} }),
    });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.migrations.changed, true);
    assert.deepStrictEqual(res.warnings, []);
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'init');
    assert.strictEqual(stateGit(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'init');
    assert.deepStrictEqual(
      git(fix.project, ['status', '--porcelain', '--', ...OWNED_PATHS]).split('\n').filter(Boolean).sort(),
      [' M .claude/settings.json', ' M .gitignore']);
    assert.deepStrictEqual(stateGit(fix.project, ['status', '--porcelain']).split('\n').filter(Boolean), ['?? .state/']);

    runEngine(stubbed, fix.project, ['commit', '--migrations', '-m', 'chore: apply workflow migrations']);

    assert.deepStrictEqual(
      git(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n').sort(),
      ['.claude/settings.json', '.gitignore']);
    assert.deepStrictEqual(
      stateGit(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n'),
      [layout.migrations]);
  });

  it('while a reviewed migration commit follows, boot\'s settings write rides it — a confined commit would carry the migration\'s edit of the same file past the review', () => {
    writeState(fix.project, layout.projectManifest, JSON.stringify({ defaults: { tmux_labels: true } }, null, 2) + '\n');
    commitAll(fix.project, 'labels on');
    const codeHead = git(fix.project, ['rev-parse', 'HEAD']).trim();

    const res = runEngine(stubbed, fix.project, ['boot'], {
      STUB_MIGRATE_MODE: 'update-config',
      STUB_MIGRATE_SETTINGS: hooked(WORKFLOW_HOOKS, { permissions: {} }),
    });

    assert.strictEqual(res.migrations.changed, true);
    assert.deepStrictEqual(res.warnings, []);
    assert.strictEqual(res.session_hooks_installed, true);
    assert.strictEqual(git(fix.project, ['rev-parse', 'HEAD']).trim(), codeHead, 'no commit of boot\'s');
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(fix.project, '.claude/settings.json'), 'utf8')),
      { permissions: {}, ...JSON.parse(LABELS_ON) }, 'the migration\'s edit and the hooks, side by side');

    runEngine(stubbed, fix.project, ['commit', '--migrations', '-m', 'chore: apply workflow migrations']);

    assert.deepStrictEqual(
      git(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n').sort(),
      ['.claude/settings.json', '.gitignore']);
    assert.deepStrictEqual(
      stateGit(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n'),
      [layout.migrations]);
    assert.strictEqual(git(fix.project, ['status', '--porcelain', '--', ...OWNED_PATHS]).trim(), '', 'the reviewed commit took it all');
  });

  it('no migrations ran: dirty config files are left untouched, never committed by boot', () => {
    // Track a config baseline, then dirty both files with no migration running.
    createFile(fix.project, '.claude/settings.json', hooked(WORKFLOW_HOOKS, { permissions: {} }));
    createFile(fix.project, '.gitignore', '.leeway/\nnode_modules\n');
    commitAll(fix.project, 'config baseline');
    createFile(fix.project, '.claude/settings.json', hooked(WORKFLOW_HOOKS, { permissions: { allow: ['x'] } }));
    createFile(fix.project, '.gitignore', '.leeway/\nnode_modules\n.DS_Store\n');

    const res = runEngine(stubbed, fix.project, ['boot']);

    assert.strictEqual(res.migrations.changed, false);
    // Both stay dirty; HEAD is still the baseline, not a config commit.
    const status = git(fix.project, ['status', '--porcelain']);
    assert.match(status, /\.claude\/settings\.json/);
    assert.match(status, /\.gitignore/);
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'config baseline');
  });

  it('a migration that ran while changing nothing still recorded it — boot commits the migrations record line no review gate would sweep', () => {
    const res = runEngine(stubbed, fix.project, ['boot'], { STUB_MIGRATE_MODE: 'record-only' });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.migrations.changed, false);
    assert.strictEqual(res.migrations.ran, 1);
    assert.deepStrictEqual(res.warnings, []);
    assert.strictEqual(res.migrations_committed, stateGit(fix.project, ['rev-parse', '--short', 'HEAD']).trim());
    assert.strictEqual(stateGit(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'chore: record workflow migrations');
    assert.deepStrictEqual(
      stateGit(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n'),
      [layout.migrations]
    );
    assert.strictEqual(stateGit(fix.project, ['status', '--porcelain']).trim(), '', 'nothing left dirty');
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'init', 'and nothing on the code side');
  });

  it('a migrations record an earlier boot left dirty is committed by the next one, which ran nothing at all', () => {
    // The state this bug leaves behind: a previous boot recorded an ID and
    // never committed it. Those migrations are recorded now, so nothing runs
    // — and the line still has to go.
    writeState(fix.project, layout.migrations, '045\n');
    commitAll(fix.project, 'record baseline');
    writeState(fix.project, layout.migrations, '045\n046\n');

    const res = runEngine(stubbed, fix.project, ['boot']);

    assert.strictEqual(res.migrations.ran, 0, 'nothing ran this boot');
    assert.strictEqual(res.migrations.changed, false);
    assert.deepStrictEqual(res.warnings, []);
    assert.strictEqual(res.migrations_committed, stateGit(fix.project, ['rev-parse', '--short', 'HEAD']).trim());
    assert.strictEqual(stateGit(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'chore: record workflow migrations');
    assert.strictEqual(stateGit(fix.project, ['status', '--porcelain']).trim(), '');
  });

  it('a run that changed documents leaves the migrations record to the reviewed commit — boot never commits it twice', () => {
    const res = runEngine(stubbed, fix.project, ['boot'], { STUB_MIGRATE_MODE: 'update' });

    assert.strictEqual(res.migrations.changed, true);
    assert.strictEqual(res.migrations.ran, 1);
    assert.strictEqual(res.migrations_committed, null);
    // The record's line waits with the rest of the diff for the skill's
    // `commit --migrations`, which the review gate runs on the user's yes.
    assert.match(stateGit(fix.project, ['status', '--porcelain', '--', layout.migrations]), /migrations/);
    assert.strictEqual(stateGit(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'init');
  });

  it('a migrations record with nothing to commit — already clean — is null and silent', () => {
    // Clean: the run recorded nothing new (a re-append restoring what HEAD
    // already holds), so the tracked record matches HEAD.
    writeState(fix.project, layout.migrations, '045\n');
    commitAll(fix.project, 'record baseline');

    const clean = runEngine(stubbed, fix.project, ['boot'], { STUB_MIGRATE_REPORT: '{"ran": 2}' });
    assert.strictEqual(clean.migrations.ran, 2);
    assert.strictEqual(clean.migrations_committed, null);
    assert.deepStrictEqual(clean.warnings, []);
    assert.strictEqual(stateGit(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'record baseline');
  });

  it('a failing commit of the migrations record is a warning, never a block — the record is already right on disk', () => {
    // Another git process holding the state branch's ref lock.
    fs.writeFileSync(path.join(fix.project, '.git/refs/heads/leeway-state.lock'), '');

    const res = runEngine(stubbed, fix.project, ['boot'], { STUB_MIGRATE_MODE: 'record-only' });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.migrations.ran, 1);
    assert.strictEqual(res.migrations_committed, null);
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /migrations record commit failed/);
    assert.ok(fs.existsSync(statePath(fix.project, layout.migrations)), 'the recorded run survives');
  });

  it('a run report boot cannot read degrades to a warning — ran 0, the migrations record still committed, plumbing still stripped', () => {
    for (const payload of ['not json at all', '{"ran": "two"}', '{"ran": -1}']) {
      const res = runEngine(stubbed, fix.project, ['boot'], {
        STUB_MIGRATE_MODE: 'record-only',
        STUB_MIGRATE_REPORT: payload,
      });

      assert.strictEqual(res.ok, true, payload);
      assert.strictEqual(res.migrations.ran, 0, payload);
      assert.strictEqual(res.migrations_committed, stateGit(fix.project, ['rev-parse', '--short', 'HEAD']).trim(), payload);
      assert.strictEqual(res.warnings.length, 1, `${payload}: ${JSON.stringify(res.warnings)}`);
      assert.match(res.warnings[0], /^migration run report unreadable: /);
      assert.strictEqual(res.migrations.output, '[SKIP] No changes needed', payload);
      assert.ok(!res.migrations.output.includes('MIGRATIONS_RUN'), payload);
    }
  });

  it('a runner that reports nothing reads as no migrations run — the migrations record it wrote still committed', () => {
    const res = runEngine(stubbed, fix.project, ['boot'], {
      STUB_MIGRATE_MODE: 'record-only',
      STUB_MIGRATE_NO_REPORT: '1',
    });

    assert.strictEqual(res.migrations.ran, 0);
    assert.strictEqual(res.migrations_committed, stateGit(fix.project, ['rev-parse', '--short', 'HEAD']).trim());
    assert.deepStrictEqual(res.warnings, []);
  });

  it('a peer session\'s staged work survives every one of boot\'s commits', () => {
    // Boot runs at `workflow-start`, which is a session opening beside every
    // other one on the checkout. Its commits — the migrations record and the
    // project settings sync — must take their own paths and nothing else,
    // staged peer content included.
    writeState(fix.project, layout.doc('payments', 'discussion', 'topic-a'), '# Topic A\n');
    writeState(fix.project, layout.projectManifest, JSON.stringify({ defaults: { tmux_labels: true } }, null, 2) + '\n');
    commitAll(fix.project, 'a peer topic');
    writeState(fix.project, layout.doc('payments', 'discussion', 'topic-a'), '# Topic A\nhalf a turn\n');
    stateGit(fix.project, ['add', '--', layout.doc('payments', 'discussion', 'topic-a')]);

    const res = runEngine(stubbed, fix.project, ['boot'], { STUB_MIGRATE_MODE: 'record-only' });

    assert.strictEqual(res.ok, true);
    assert.deepStrictEqual(res.warnings, []);
    assert.strictEqual(res.session_hooks_installed, true);
    assert.deepStrictEqual(git(fix.project, ['log', '-2', '--pretty=%s']).trim().split('\n'), [
      'chore: install workflow session hooks',
      'init',
    ]);
    assert.deepStrictEqual(stateGit(fix.project, ['log', '-2', '--pretty=%s']).trim().split('\n'), [
      'chore: record workflow migrations',
      'a peer topic',
    ]);
    const files = stateGit(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n').filter(Boolean);
    assert.deepStrictEqual(files, [layout.migrations], 'boot swept nothing of a peer session\'s staged state');
    assert.strictEqual(stateGit(fix.project, ['diff', '--cached', '--name-only']).trim(),
      'payments/discussion/topic-a.md', 'and left it staged exactly as it was');
  });

  it('a failing migrate.cjs is a hard error — ok false, stderr detail, exit 1', () => {
    readyKnowledge(fix.project);
    completedDiscussion(fix.project, '# Payments\n\nCards ship first.\n');
    const knowledge = statePath(fix.project, layout.knowledge());
    const before = Object.fromEntries(fs.readdirSync(knowledge).map((f) => [f, fs.readFileSync(path.join(knowledge, f), 'utf8')]));

    const err = runEngineFails(stubbed, fix.project, ['boot'], { STUB_MIGRATE_MODE: 'fail' });

    assert.match(err.error, /migrate\.cjs failed/);
    assert.match(err.error, /never half-run silently/);
    assert.match(err.error, /boom: migration 099 exploded/);
    // The knowledge legs never ran: a ready store with a completed
    // discussion awaiting its index is left exactly as it stood.
    const after = Object.fromEntries(fs.readdirSync(knowledge).map((f) => [f, fs.readFileSync(path.join(knowledge, f), 'utf8')]));
    assert.deepStrictEqual(after, before);
    assert.deepStrictEqual(harness.indexedFiles(fix.project), []);
  });
});
