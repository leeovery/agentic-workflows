'use strict';

// ---------------------------------------------------------------------------
// Boot through the repo's real scripts (workflow-engine/scripts/domain/boot.cjs
// with workflow-migrate/scripts/migrate.cjs and the knowledge base): the
// real migrations and index against an isolated project, a migration's
// checks handed back, and its notices told once.
//
// Layer: verb. World: the project fixture (boot-world.cjs), made once per
// process and copied; the engine is the repo's own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { git, stateGit, commitAll, statePath, layout, writeState } = harness;
const REAL_SCRIPTS = path.dirname(harness.ENGINE);
const REAL_ENGINE_SKILL = path.dirname(REAL_SCRIPTS);
const store = require(path.join(REAL_SCRIPTS, 'kernel/knowledge/store.cjs'));

const { createFile } = require('./discovery-test-utils.cjs');
const { FLAG, WORKFLOW_HOOKS, OWN_HOOKS, hooked, LABELS_ON, legacyLayout, setupProject, real, runEngine } = require('./boot-world.cjs');

describe('engine boot (real scripts)', () => {
  let root;
  let project;
  beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'engine-boot-real-')));
    project = setupProject(root);
  });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  it('runs the real migrate.cjs and knowledge base against an isolated project', () => {
    const settingsBefore = fs.readFileSync(path.join(project, '.claude/settings.json'), 'utf8');
    const codeHead = git(project, ['rev-parse', 'HEAD']).trim();
    const first = runEngine(real, project, ['boot']);
    assert.strictEqual(first.ok, true);
    assert.strictEqual(first.migrations.changed, false);
    assert.strictEqual(typeof first.migrations.output, 'string');
    assert.deepStrictEqual(first.migrations.verify, []);
    assert.deepStrictEqual(first.migrations.notices, []);
    // The trimmed report never leaks the prose stop-gate lines or the machine blocks.
    assert.ok(!first.migrations.output.includes('STOP_GATE'));
    assert.ok(!first.migrations.output.includes('VERIFY_ADDENDA'));
    assert.ok(!first.migrations.output.includes('MIGRATIONS_RUN'));
    // The code-tree fleet has no `.workflows/` to upgrade: every one is
    // recorded unrun, none creates the folder, and the settings stay as found.
    assert.strictEqual(first.migrations.ran, 0);
    const fleet = fs.readdirSync(path.join(REAL_ENGINE_SKILL, '..', 'workflow-migrate/scripts/migrations'))
      .map((f) => (f.match(/^[0-9]+/) || [''])[0]).filter(Boolean).sort();
    assert.deepStrictEqual(fs.readFileSync(statePath(project, layout.migrations), 'utf8').trim().split('\n').sort(), fleet);
    assert.ok(!fs.existsSync(path.join(project, '.workflows')), 'no legacy state folder made from nothing');
    assert.strictEqual(fs.readFileSync(path.join(project, '.claude/settings.json'), 'utf8'), settingsBefore);
    // The migrations record, the only dirt, committed on the state branch — the code
    // branch takes none of it.
    assert.strictEqual(first.migrations_committed, stateGit(project, ['rev-parse', '--short', 'HEAD']).trim());
    assert.strictEqual(stateGit(project, ['log', '-1', '--pretty=%s']).trim(), 'chore: record workflow migrations');
    assert.strictEqual(git(project, ['rev-parse', 'HEAD']).trim(), codeHead);
    // No knowledge store in the fixture — the hard stop: nothing is created.
    assert.strictEqual(first.knowledge, 'not-ready');
    assert.strictEqual(first.indexed, false);
    assert.strictEqual(first.compacted, false);
    assert.ok(!fs.existsSync(statePath(project, layout.knowledge())));

    // The user runs knowledge setup outside the session — simulated here by
    // writing what setup writes: a keyword-only config and a real store file
    // the readiness check loads.
    writeState(project, layout.knowledge('config.json'), '{"knowledge":{}}\n');
    writeState(project, layout.knowledge('metadata.json'), '{"provider":null}\n');
    store.saveStore(store.createStore(), statePath(project, layout.knowledge('store.bin')));

    // …and the restart's boot finds the store ready and leaves the whole
    // directory out of git: the state's own ignore rule keeps it out.
    const second = runEngine(real, project, ['boot']);
    assert.strictEqual(second.ok, true);
    assert.strictEqual(second.migrations.changed, false);
    assert.strictEqual(second.migrations.ran, 0);
    assert.strictEqual(second.migrations_committed, null);
    assert.strictEqual(second.knowledge, 'ready');
    assert.strictEqual(second.indexed, true);
    assert.strictEqual(second.compacted, true);
    assert.strictEqual(stateGit(project, ['status', '--porcelain', '--untracked-files=all', '--', '.knowledge']).trim(), '');

    // Third boot: nothing new to commit, the migrations record included — an index and
    // a compact with nothing to do write nothing.
    const third = runEngine(real, project, ['boot']);
    assert.strictEqual(third.knowledge, 'ready');
    assert.deepStrictEqual(third.warnings, []);
    assert.strictEqual(third.migrations_committed, null);
  });

  it('a project carrying the function-hooks flag the workflows wrote has it taken out by the migrations, the hook sync beside it — boot commits neither, and the reviewed migration commit records both', () => {
    legacyLayout(project);
    writeState(project, layout.projectManifest, JSON.stringify({ defaults: { tmux_labels: true } }, null, 2) + '\n');
    createFile(project, '.claude/settings.json', JSON.stringify({ hooks: OWN_HOOKS, env: { [FLAG]: '1' } }, null, 2) + '\n');
    commitAll(project, 'labels on, the flag in the project');
    const before = git(project, ['rev-parse', 'HEAD']).trim();

    const res = runEngine(real, project, ['boot']);

    assert.strictEqual(res.migrations.changed, true, 'the review gate owns the commit');
    assert.strictEqual(res.session_hooks_installed, true);
    assert.strictEqual(git(project, ['rev-parse', 'HEAD']).trim(), before, 'boot commits none of it');
    const migrated = fs.readFileSync(path.join(project, '.claude/settings.json'), 'utf8');
    assert.ok(!('env' in JSON.parse(migrated)), 'the flag out, and env with it');
    assert.deepStrictEqual(JSON.parse(migrated).hooks, JSON.parse(LABELS_ON).hooks, 'the label hooks in');

    runEngine(real, project, ['commit', '--migrations', '-m', 'chore: apply workflow migrations']);

    assert.strictEqual(git(project, ['show', 'HEAD:.claude/settings.json']), migrated);
    assert.strictEqual(git(project, ['status', '--porcelain', '--', '.claude']).trim(), '');
  });
});

describe('engine boot verification addenda (real scripts)', () => {
  let root;
  let project;
  beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'engine-boot-verify-')));
    project = setupProject(root);
  });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  it('carries an executed migration\'s checks in migrations.verify, stripped from the report', () => {
    legacyLayout(project);
    createFile(project, '.workflows/payments/discussion/alpha.md',
      '# D\n\n## Triage\n\n### Parked\n*From: x · discussion · d*\n\nBody.\n');

    const res = runEngine(real, project, ['boot']);

    assert.strictEqual(res.ok, true);
    const entry = res.migrations.verify.find((v) => v.id === '054');
    assert.ok(entry, `054 addendum present: ${JSON.stringify(res.migrations.verify)}`);
    assert.match(entry.verify, /Converted entries from: payments\/discussion\/alpha\.md/);
    assert.match(entry.info, /triage queue/);
    assert.ok(!res.migrations.output.includes('VERIFY_ADDENDA'), 'plumbing stripped from the report');
    // Second boot: recorded — nothing re-fires.
    const second = runEngine(real, project, ['boot']);
    assert.deepStrictEqual(second.migrations.verify, []);
  });

  it('hands back 054\'s check and then 071\'s, naming the mailbox, where one boot runs both over a straggler 054 cannot convert', () => {
    legacyLayout(project);
    createFile(project, '.workflows/payments/discussion/alpha.md',
      '# D\n\n## Triage:\n\n### Parked\n*From: x · discussion · d*\n\nBody.\n');

    const res = runEngine(real, project, ['boot']);

    assert.strictEqual(res.ok, true);
    const addenda = res.migrations.verify.filter((v) => v.id === '054' || v.id === '071');
    assert.deepStrictEqual(addenda.map((v) => v.id), ['054', '071'], JSON.stringify(res.migrations.verify));
    assert.ok(addenda[1].verify.includes('.workflows/{wu}/{phase}/.mailbox/{topic}/'), addenda[1].verify);
    assert.ok(addenda[1].verify.includes('Nothing goes into a .triage/ directory'), addenda[1].verify);
  });
});

describe('engine boot migration notices (real scripts)', () => {
  let root;
  let project;
  beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'engine-boot-notices-')));
    project = setupProject(root);
  });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  it('tells the person of a plan-mode setting the project had committed, once', () => {
    legacyLayout(project);
    createFile(project, '.claude/settings.json', hooked(WORKFLOW_HOOKS, { showClearContextOnPlanAccept: true }));
    git(project, ['commit', '-q', '-am', 'plan mode on']);

    const res = runEngine(real, project, ['boot']);

    assert.strictEqual(res.ok, true);
    assert.deepStrictEqual(res.migrations.notices.map((n) => n.id), ['067']);
    assert.match(res.migrations.notices[0].notice, /^Removed `showClearContextOnPlanAccept` from `\.claude\/settings\.json`/);
    assert.ok(!res.migrations.output.includes('MIGRATION_NOTICES'), 'plumbing stripped from the report');
    assert.strictEqual(res.migrations.changed, true);
    assert.ok(!('showClearContextOnPlanAccept' in JSON.parse(fs.readFileSync(path.join(project, '.claude/settings.json'), 'utf8'))));
    // Second boot: recorded — nothing re-fires.
    assert.deepStrictEqual(runEngine(real, project, ['boot']).migrations.notices, []);
  });
});
