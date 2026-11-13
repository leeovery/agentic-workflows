'use strict';

// ---------------------------------------------------------------------------
// Boot through the repo's real scripts (leeway-engine/scripts/domain/boot.cjs
// with leeway-migrate/scripts/migrate.cjs and the knowledge base): the
// real migrations and index against an isolated project, a migration's
// checks handed back, and its notices told once. A project with a legacy
// `.workflows/` meets the reshape's directives: boot stops at each, bare,
// until the session records it, and the boot that completes the run hands
// back everything the migrations before them journaled. A real project on
// the layout before Leeway's, with no `.leeway/`, meets the reshape: the
// guard refusing over uncommitted changes and over a live session, boot
// stopping with nothing written (21.S5, 21.S6), and a project at 070 running
// the guard, then the chain from its old record, then the move, a run killed
// once the guard has placed the state carried on by the next boot (21.S2).
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
const { execFileSync } = require('child_process');
const harness = require('./engine-harness.cjs');
const { git, stateGit, commitAll, statePath, layout, writeState, WORKFLOW_HOOKS, OWN_HOOKS, hooked } = harness;
const REAL_SCRIPTS = path.dirname(harness.ENGINE);
const REAL_ENGINE_SKILL = path.dirname(REAL_SCRIPTS);
const store = require(path.join(REAL_SCRIPTS, 'kernel/knowledge/store.cjs'));

const { createFile } = require('./discovery-test-utils.cjs');
const { LAST_CODE_TREE_MIGRATION } = require(path.join(REAL_ENGINE_SKILL, '..', 'leeway-migrate/scripts/migrate.cjs'));
const { FLAG, LABELS_ON, MIGRATED_TO_070, legacyLayout, setupProject, legacyProject, real, runEngine, runEngineFails } = require('./boot-world.cjs');

/** A process's start time as the old skills recorded it: `ps`, in UTC and the C locale. @param {number} pid */
const startOf = (pid) => execFileSync('ps', ['-p', String(pid), '-o', 'lstart='], { encoding: 'utf8', env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' } }).trim();

/** The migrations record's lines. @param {string} project */
const recordOf = (project) => fs.readFileSync(statePath(project, layout.migrations), 'utf8').split('\n').filter(Boolean);

/** What boot answers where it stops at a directive, and nothing else. */
const DIRECTIVE_STOP = ['ok', 'state', 'id', 'file', 'done', 'of', 'warnings'];

/**
 * Boot run through the migration's directives: each stop carries none of
 * the run's handbacks, its directive is recorded — its check passing on a
 * unit with no topics — and boot runs again, until a boot completes.
 * @param {string} project
 */
function bootThroughDirectives(project) {
  let res = runEngine(real, project, ['boot']);
  for (let stops = 0; res.state === 'directive'; stops += 1) {
    assert.ok(stops < 10, 'boot stops at each directive once');
    assert.deepStrictEqual(Object.keys(res).filter((key) => !DIRECTIVE_STOP.includes(key)), [], `the stop is bare: ${JSON.stringify(res)}`);
    runEngine(real, project, ['checklist', 'close', 'directive', res.id]);
    res = runEngine(real, project, ['boot']);
  }
  return res;
}

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
    // recorded unrun, none creates the folder, and the settings stay as found;
    // the migrations past it run and find nothing to do, its directives
    // recorded unrun beside it.
    const names = fs.readdirSync(path.join(REAL_ENGINE_SKILL, '..', 'leeway-migrate/scripts/migrations'))
      .filter((f) => /^[0-9]+-/.test(f) && !f.endsWith('.check.cjs'));
    const idOf = (/** @type {string} */ f) => f.slice(0, f.indexOf('-'));
    const fleet = names.map(idOf).sort();
    const directives = new Set(names.filter((f) => f.endsWith('.md')).map(idOf));
    assert.strictEqual(first.migrations.ran, fleet.filter((id) => Number(id) > LAST_CODE_TREE_MIGRATION && !directives.has(id)).length);
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

    const res = bootThroughDirectives(project);

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

describe('engine boot runs the reshape (real scripts)', () => {
  let root;
  let project;
  /** Boot's environment: no user-level folder of today's skills for the move to carry, never the machine's. */
  let env;
  beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'engine-boot-reshape-')));
    project = legacyProject(root);
    env = { WORKFLOWS_CONFIG_DIR: path.join(root, 'no-workflows-config') };
  });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  /** Every file of the project as it stands, `.git/` aside, with its text; and the repository's refs and checkouts. */
  function projectAsItStands() {
    /** @type {Record<string, string>} */
    const files = {};
    const walk = (/** @type {string} */ rel) => {
      for (const entry of fs.readdirSync(path.join(project, rel), { withFileTypes: true })) {
        const at = path.join(rel, entry.name);
        if (entry.isDirectory()) { if (at !== '.git') walk(at); } else files[at] = fs.readFileSync(path.join(project, at), 'utf8');
      }
    };
    walk('');
    return { files, refs: git(project, ['for-each-ref']), worktrees: git(project, ['worktree', 'list', '--porcelain']) };
  }

  it('21.S5, 21.S6: the guard refuses over uncommitted changes under .workflows/, then over another session live in the project — boot stops with its facts, and nothing is written but the exclude line', () => {
    createFile(project, '.workflows/payments/discussion/draft.md', '# Draft\n');
    const before = projectAsItStands();

    assert.deepStrictEqual(runEngine(real, project, ['boot'], env), { ok: true, state: 'guard', cause: 'dirty', unit: null, phase: null, topic: null, active: null, warnings: [] });

    const written = Date.now() - 180 * 1000;
    const row = path.join(project, '.workflows/.cache/payments/discussion/payments/presence');
    createFile(path.dirname(row), 'presence', JSON.stringify({ pid: process.pid, pid_start: startOf(process.pid), session_id: 'another-session' }));
    fs.utimesSync(row, new Date(written), new Date(written));
    before.files[path.relative(project, row)] = fs.readFileSync(row, 'utf8');

    // The calling session in a time zone and locale of its own: the row's start time is UTC's and the C locale's.
    const live = runEngine(real, project, ['boot'], { ...env, CLAUDE_CODE_SESSION_ID: 'this-session', CLAUDE_PID: undefined, TZ: 'Asia/Tokyo', LANG: 'en_GB.UTF-8', LC_ALL: undefined, LC_TIME: undefined });

    assert.deepStrictEqual({ ...live, active: undefined }, { ok: true, state: 'guard', cause: 'live', unit: 'payments', phase: 'discussion', topic: 'payments', active: undefined, warnings: [] });
    assert.ok(live.active >= 180 && live.active < 210, `active ${live.active}s ago`);
    const facts = ['--cause', live.cause, '--unit', live.unit, '--phase', live.phase, '--topic', live.topic, '--active', String(live.active)];
    assert.match(real.output(project, ['render', 'migration-guard-stop', ...facts]), /^> Another session is working in this project: Payments, in its discussion, last active 3m ago\./m);
    assert.deepStrictEqual(projectAsItStands(), before);
    assert.ok(!fs.existsSync(statePath(project)), 'no state folder: no record, no lock, no journal');
    assert.strictEqual(fs.readFileSync(path.join(project, '.git/info/exclude'), 'utf8').split('\n').filter((line) => line === '/.leeway/').length, 1);
  });

  it('21.3.4: the guard\'s stop draws its two screens from boot\'s facts — the live session by its unit, phase and topic, the topic left out where it is the unit, and how long ago — refusing facts that are not a refusal\'s', () => {
    const screen = (/** @type {string[]} */ facts) => real.output(project, ['render', 'migration-guard-stop', ...facts]);

    assert.strictEqual(screen(['--cause', 'live', '--unit', 'fumi', '--phase', 'discussion', '--topic', 'licensing-and-trial-integrity', '--active', '180']), [
      '=== DISPLAY: migration guard stop (emit verbatim as a properties code block (```properties fence)) ===',
      '⚑ The migration can\'t run while another session is live here',
      '',
      '=== DISPLAY: migration guard account (emit verbatim as markdown (not a code block)) ===',
      '> Another session is working in this project: Fumi, in the discussion of Licensing And Trial Integrity, last active 3m ago. A major upgrade never runs under a live session, so nothing has been changed.',
      '>',
      '> End that session, then run `/leeway` here again.',
      '',
    ].join('\n'));
    assert.strictEqual(screen(['--cause', 'dirty']), [
      '=== DISPLAY: migration guard stop (emit verbatim as a properties code block (```properties fence)) ===',
      '⚑ The migration can\'t run: .workflows/ has uncommitted changes',
      '',
      '=== DISPLAY: migration guard account (emit verbatim as markdown (not a code block)) ===',
      '> The migration\'s commit would sweep them in with its own, so nothing has been changed.',
      '>',
      '> Commit or discard them, then run `/leeway` here again.',
      '',
    ].join('\n'));
    assert.deepStrictEqual([
      ['--cause', 'dirty', '--unit', 'fumi'],
      ['--cause', 'live', '--unit', 'fumi', '--phase', 'discussion', '--topic', 'licensing'],
      ['--cause', 'live', '--unit', 'fumi', '--phase', 'discussion', '--topic', 'licensing', '--active', '3m'],
      ['--cause', 'busy'],
    ].map((facts) => real.refuses(project, ['render', 'migration-guard-stop', ...facts]).error), [
      'render migration-guard-stop: --unit names the live session a refusal for uncommitted changes has none of',
      'render migration-guard-stop: --active takes the seconds since the live session was last active, got ""',
      'render migration-guard-stop: --active takes the seconds since the live session was last active, got "3m"',
      'render migration-guard-stop: --cause is live or dirty, as boot\'s guard stop answers it, got "busy"',
    ]);
  });

  it('21.S2: a project at 070 runs the guard, then the chain from the old record, 071 on, then the split, nothing in it to split, and the move — 072\'s kind on the moved roadmap — to the records directive; a run killed once the guard has placed the state is carried on by the next boot', () => {
    const kill = path.join(root, 'kill-after-guard.cjs');
    fs.writeFileSync(kill, "const fs = require('fs');\nconst real = fs.appendFileSync;\nfs.appendFileSync = (file, data, ...rest) => { real(file, data, ...rest); if (String(file).endsWith('.state/migrations') && data === '074\\n') process.exit(9); };\n");

    assert.match(runEngineFails(real, project, ['boot'], { ...env, NODE_OPTIONS: `--require ${kill}` }).error, /migrate\.cjs failed/);
    assert.deepStrictEqual(recordOf(project), [...MIGRATED_TO_070, '074']);

    const stopped = runEngine(real, project, ['boot'], env);

    assert.deepStrictEqual([stopped.state, stopped.id], ['directive', '079-records']);
    assert.deepStrictEqual(recordOf(project), [...MIGRATED_TO_070, '074', '071', '072', '073', '075', '076', '077', '078']);
    assert.strictEqual(JSON.parse(fs.readFileSync(statePath(project, layout.projectManifest), 'utf8')).roadmap.items['dark-mode'].kind, 'idea');
    assert.strictEqual(git(project, ['for-each-ref', 'refs/heads/leeway-state']), '', 'nothing committed before the migration\'s commit');
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

    const res = bootThroughDirectives(project);

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

    const res = bootThroughDirectives(project);

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

    const res = bootThroughDirectives(project);

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
