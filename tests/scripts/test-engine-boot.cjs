'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const REAL_SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const REAL_ENGINE = path.join(REAL_SCRIPTS, 'engine.cjs');

// Hermetic git: no user/system config leaks into fixtures or the engine's
// spawned git subprocesses.
process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_SYSTEM = '/dev/null';

/** @param {string} dir @param {string[]} args */
function git(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
}

function writeFile(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

/** A project fixture: a real git repo with a `.workflows/` tree. */
function setupProject(root) {
  const project = path.join(root, 'project');
  fs.mkdirSync(project, { recursive: true });
  git(project, ['init', '-q', '-b', 'main']);
  git(project, ['config', 'user.email', 'test@example.com']);
  git(project, ['config', 'user.name', 'Test']);
  git(project, ['config', 'commit.gpgsign', 'false']);
  writeFile(project, '.workflows/payments/manifest.json', '{"name":"payments"}\n');
  git(project, ['add', '-A']);
  git(project, ['commit', '-q', '-m', 'init']);
  return project;
}

// Stub migrate.cjs: env-driven behaviour, mimicking the real report format
// byte-for-byte (boot parses the report, so the stub must reproduce it).
const STUB_MIGRATE = `#!/usr/bin/env node
'use strict';
const fs = require('fs');
const mode = process.env.STUB_MIGRATE_MODE || '';
if (mode === 'update') {
  fs.mkdirSync('.workflows/.state', { recursive: true });
  fs.mkdirSync('.workflows/payments', { recursive: true });
  fs.appendFileSync('.workflows/.state/migrations', '045\\n');
  fs.writeFileSync('.workflows/payments/marker.md', 'migrated\\n');
  process.stdout.write(
    '\\n' +
    '1 migration(s) applied, 2 file(s) updated.\\n' +
    '\\n' +
    '---STOP_GATE: FILES_UPDATED---\\n' +
    'You MUST now follow the migration skill instructions to STOP and let the user review.\\n' +
    'Follow the explicit instructions in the migration skill before proceeding.\\n'
  );
} else if (mode === 'update-config') {
  fs.mkdirSync('.workflows/.state', { recursive: true });
  fs.mkdirSync('.claude', { recursive: true });
  fs.appendFileSync('.workflows/.state/migrations', '046\\n');
  fs.writeFileSync('.claude/settings.json', '{"permissions":{}}\\n');
  fs.appendFileSync('.gitignore', '.DS_Store\\n');
  process.stdout.write(
    '\\n' +
    '1 migration(s) applied, 3 file(s) updated.\\n' +
    '\\n' +
    '---STOP_GATE: FILES_UPDATED---\\n' +
    'You MUST now follow the migration skill instructions to STOP and let the user review.\\n'
  );
} else if (mode === 'fail') {
  process.stdout.write('partial output before the failure\\n');
  process.stderr.write('boom: migration 099 exploded\\n');
  process.exit(1);
} else {
  process.stdout.write('[SKIP] No changes needed\\n');
}
`;

// Stub knowledge CLI: records each invocation to knowledge-calls.log in the
// project cwd; check/init/compact behaviour is env-driven.
const STUB_KNOWLEDGE = `#!/usr/bin/env node
'use strict';
const fs = require('fs');
const cmd = process.argv[2] || '';
fs.appendFileSync('knowledge-calls.log', process.argv.slice(2).join(' ') + '\\n');
if (cmd === 'check') {
  if (process.env.STUB_CHECK_EXIT) process.exit(parseInt(process.env.STUB_CHECK_EXIT, 10));
  process.stdout.write((process.env.STUB_CHECK || 'not-ready') + '\\n');
  process.exit(0);
}
if (cmd === 'compact') {
  if (process.env.STUB_COMPACT_EXIT) {
    process.stderr.write('compact blew up\\n');
    process.exit(parseInt(process.env.STUB_COMPACT_EXIT, 10));
  }
  process.exit(0);
}
process.exit(1);
`;

/**
 * A hermetic skills layout: the real engine scripts copied into a temp skills root, with stub
 * migrate.cjs / knowledge.cjs siblings — exercising the engine's own
 * __dirname-relative resolution exactly as installed.
 */
function setupSkillsFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-boot-'));
  const skills = path.join(root, 'skills');
  fs.cpSync(REAL_SCRIPTS, path.join(skills, 'workflow-engine/scripts'), { recursive: true });
  writeFile(skills, 'workflow-migrate/scripts/migrate.cjs', STUB_MIGRATE);
  writeFile(skills, 'workflow-knowledge/scripts/knowledge.cjs', STUB_KNOWLEDGE);
  return {
    root,
    project: setupProject(root),
    engine: path.join(skills, 'workflow-engine/scripts/engine.cjs'),
  };
}

/** Run an engine expecting success; returns the parsed JSON response. */
function runEngine(engine, dir, args, env = {}) {
  const out = execFileSync('node', [engine, ...args], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return JSON.parse(out.trim());
}

/** Run an engine expecting failure; returns the parsed stderr JSON. */
function runEngineFails(engine, dir, args, env = {}) {
  const res = spawnSync('node', [engine, ...args], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  assert.strictEqual(res.status, 1, `expected exit 1, got ${res.status}\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
  assert.strictEqual(res.stdout, '');
  const parsed = JSON.parse(res.stderr.trim());
  assert.strictEqual(parsed.ok, false);
  return parsed;
}

function knowledgeCalls(project) {
  const log = path.join(project, 'knowledge-calls.log');
  return fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n') : [];
}

describe('engine boot', () => {
  let fix;
  beforeEach(() => { fix = setupSkillsFixture(); });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true }); });

  it('happy path: no pending migrations, knowledge ready — compact runs', () => {
    const res = runEngine(fix.engine, fix.project, ['boot'], { STUB_CHECK: 'ready' });

    assert.deepStrictEqual(res, {
      ok: true,
      migrations: { changed: false, output: '[SKIP] No changes needed' },
      knowledge: 'ready',
      compacted: true,
      kb_committed: null,
      warnings: [],
    });
    assert.deepStrictEqual(knowledgeCalls(fix.project), ['check', 'compact']);
  });

  it('pending migration: changed true, report captured with the stop-gate lines stripped', () => {
    const res = runEngine(fix.engine, fix.project, ['boot'], {
      STUB_MIGRATE_MODE: 'update',
      STUB_CHECK: 'ready',
    });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.migrations.changed, true);
    assert.strictEqual(res.migrations.output, '1 migration(s) applied, 2 file(s) updated.');
    // The migration landed in the project's .workflows tree.
    assert.ok(fs.existsSync(path.join(fix.project, '.workflows/payments/marker.md')));
    assert.match(git(fix.project, ['status', '--porcelain', '--', '.workflows']), /marker\.md/);
  });

  it('a migration touching config files commits settings.json and .gitignore, leaving .workflows to the skill', () => {
    const res = runEngine(fix.engine, fix.project, ['boot'], { STUB_MIGRATE_MODE: 'update-config' });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.migrations.changed, true);
    // Boot commits exactly the two config paths the skill's .workflows-scoped
    // migration commit would otherwise leave dirty.
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'chore: apply workflow migration config changes');
    const show = git(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n').sort();
    assert.deepStrictEqual(show, ['.claude/settings.json', '.gitignore']);
    // The .workflows changes stay uncommitted — the skill's reviewed commit owns them.
    assert.match(git(fix.project, ['status', '--porcelain', '--', '.workflows']), /\.workflows\/\.state/);
  });

  it('no migrations ran: dirty config files are left untouched, never committed by boot', () => {
    // Track a config baseline, then dirty both files with no migration running.
    writeFile(fix.project, '.claude/settings.json', '{"permissions":{}}\n');
    writeFile(fix.project, '.gitignore', 'node_modules\n');
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'config baseline']);
    writeFile(fix.project, '.claude/settings.json', '{"permissions":{"allow":["x"]}}\n');
    writeFile(fix.project, '.gitignore', 'node_modules\n.DS_Store\n');

    const res = runEngine(fix.engine, fix.project, ['boot']);

    assert.strictEqual(res.migrations.changed, false);
    // Both stay dirty; HEAD is still the baseline, not a config commit.
    const status = git(fix.project, ['status', '--porcelain']);
    assert.match(status, /\.claude\/settings\.json/);
    assert.match(status, /\.gitignore/);
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'config baseline');
  });

  it('knowledge not-ready is terminal: no init, no commit, setup stays a human choice', () => {
    const res = runEngine(fix.engine, fix.project, ['boot']);

    assert.strictEqual(res.knowledge, 'not-ready');
    assert.strictEqual(res.compacted, false);
    assert.strictEqual(res.kb_committed, null);
    assert.deepStrictEqual(res.warnings, []);
    assert.deepStrictEqual(knowledgeCalls(fix.project), ['check']);
  });

  it('the post-setup first boot commits the untracked store as initialise', () => {
    // knowledge setup ran outside the session and left untracked store files.
    writeFile(fix.project, '.workflows/.knowledge/store.msp', 'v1\n');
    writeFile(fix.project, '.workflows/.knowledge/config.json', '{}\n');

    const res = runEngine(fix.engine, fix.project, ['boot'], { STUB_CHECK: 'ready' });

    assert.strictEqual(res.knowledge, 'ready');
    assert.strictEqual(res.kb_committed, git(fix.project, ['rev-parse', '--short', 'HEAD']).trim());
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'chore(knowledge): initialise store');
    const show = git(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n').sort();
    assert.deepStrictEqual(show, ['.workflows/.knowledge/config.json', '.workflows/.knowledge/store.msp']);
  });

  it('finds compact dirt on the ready path and commits it', () => {
    writeFile(fix.project, '.workflows/.knowledge/store.msp', 'v1\n');
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'store v1']);
    writeFile(fix.project, '.workflows/.knowledge/store.msp', 'v2-compacted\n');

    const res = runEngine(fix.engine, fix.project, ['boot'], { STUB_CHECK: 'ready' });

    assert.strictEqual(res.knowledge, 'ready');
    assert.strictEqual(res.compacted, true);
    assert.strictEqual(res.kb_committed, git(fix.project, ['rev-parse', '--short', 'HEAD']).trim());
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'chore(knowledge): compact store');
  });

  it('a crashing knowledge check is not-ready — never a crash', () => {
    const res = runEngine(fix.engine, fix.project, ['boot'], { STUB_CHECK_EXIT: '2' });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.knowledge, 'not-ready');
    assert.strictEqual(res.compacted, false);
    assert.strictEqual(res.kb_committed, null);
  });

  it('a failing compact is a warning, never a block', () => {
    const res = runEngine(fix.engine, fix.project, ['boot'], {
      STUB_CHECK: 'ready',
      STUB_COMPACT_EXIT: '1',
    });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.knowledge, 'ready');
    assert.strictEqual(res.compacted, false);
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /knowledge compact failed: compact blew up/);
  });

  it('a failing migrate.cjs is a hard error — ok false, stderr detail, exit 1', () => {
    const err = runEngineFails(fix.engine, fix.project, ['boot'], { STUB_MIGRATE_MODE: 'fail' });

    assert.match(err.error, /migrate\.cjs failed/);
    assert.match(err.error, /never half-run silently/);
    assert.match(err.error, /boom: migration 099 exploded/);
    // The knowledge legs never ran.
    assert.deepStrictEqual(knowledgeCalls(fix.project), []);
  });
});

describe('engine boot system-config detection', () => {
  let fix;
  let home;
  beforeEach(() => {
    fix = setupSkillsFixture();
    // Hermetic home: system-config detection resolves ~ via $HOME, so the
    // developer's real ~/.config/workflows never leaks into assertions.
    home = path.join(fix.root, 'home');
    fs.mkdirSync(home, { recursive: true });
  });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true }); });

  function writeSystemConfig(content) {
    writeFile(home, '.config/workflows/config.json', content);
  }

  it('not-ready with no system config reports absent', () => {
    const res = runEngine(fix.engine, fix.project, ['boot'], { HOME: home });

    assert.strictEqual(res.knowledge, 'not-ready');
    assert.deepStrictEqual(res.system_config, { status: 'absent', provider: null, model: null });
  });

  it('not-ready with a valid provider config reports provider and model — never key material', () => {
    writeSystemConfig(JSON.stringify({
      knowledge: { provider: 'openai', model: 'text-embedding-3-small', dimensions: 1536 },
    }));
    // Both key sources present on disk/env — neither may reach the response.
    writeFile(home, '.config/workflows/credentials.json', JSON.stringify({
      credentials: { openai: { api_key: 'sk-STORED-SECRET' } },
    }));

    const res = runEngine(fix.engine, fix.project, ['boot'], {
      HOME: home,
      OPENAI_API_KEY: 'sk-ENV-SECRET',
    });

    assert.strictEqual(res.knowledge, 'not-ready');
    assert.deepStrictEqual(res.system_config, {
      status: 'valid',
      provider: 'openai',
      model: 'text-embedding-3-small',
    });
    assert.ok(!JSON.stringify(res).includes('SECRET'));
  });

  it('not-ready with a valid providerless config reports valid with nulls (keyword-only)', () => {
    writeSystemConfig(JSON.stringify({ knowledge: {} }));

    const res = runEngine(fix.engine, fix.project, ['boot'], { HOME: home });

    assert.deepStrictEqual(res.system_config, { status: 'valid', provider: null, model: null });
  });

  it('not-ready with an unparseable or wrongly-shaped config reports invalid', () => {
    writeSystemConfig('not json at all');
    const res1 = runEngine(fix.engine, fix.project, ['boot'], { HOME: home });
    assert.deepStrictEqual(res1.system_config, { status: 'invalid', provider: null, model: null });

    writeSystemConfig(JSON.stringify({ nothing: 'here' }));
    const res2 = runEngine(fix.engine, fix.project, ['boot'], { HOME: home });
    assert.deepStrictEqual(res2.system_config, { status: 'invalid', provider: null, model: null });
  });

  it('ready responses carry no system_config field', () => {
    writeSystemConfig(JSON.stringify({ knowledge: { provider: 'openai', model: 'm' } }));

    const res = runEngine(fix.engine, fix.project, ['boot'], { HOME: home, STUB_CHECK: 'ready' });

    assert.strictEqual(res.knowledge, 'ready');
    assert.ok(!('system_config' in res));
  });
});

describe('engine boot (real scripts)', () => {
  let root;
  let project;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-boot-real-'));
    project = setupProject(root);
  });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

  it('runs the real migrate.cjs and knowledge CLI against an isolated project', async () => {
    const first = runEngine(REAL_ENGINE, project, ['boot']);
    assert.strictEqual(first.ok, true);
    assert.strictEqual(typeof first.migrations.changed, 'boolean');
    assert.strictEqual(typeof first.migrations.output, 'string');
    // The trimmed report never leaks the prose stop-gate lines.
    assert.ok(!first.migrations.output.includes('STOP_GATE'));
    // No knowledge store in the fixture — the hard stop: nothing is created.
    assert.strictEqual(first.knowledge, 'not-ready');
    assert.strictEqual(first.compacted, false);
    assert.strictEqual(first.kb_committed, null);
    assert.ok(!fs.existsSync(path.join(project, '.workflows/.knowledge')));
    // The tracking file landed in the fixture, not the repo.
    assert.ok(fs.existsSync(path.join(project, '.workflows/.state/migrations')));

    // The user runs knowledge setup outside the session — simulated here by
    // writing what setup writes: a keyword-only config and a real store file
    // (created by the same store module the CLI bundles, so the real `check`
    // loads it).
    writeFile(project, '.workflows/.knowledge/config.json', '{"knowledge":{}}\n');
    writeFile(project, '.workflows/.knowledge/metadata.json', '{"provider":null}\n');
    const store = require('../../src/knowledge/store.js');
    await store.createStore(3).then((db) => store.saveStore(db, path.join(project, '.workflows/.knowledge/store.msp')));

    // …and the restart's boot finds the store ready and commits it: the
    // untracked setup output rides `chore(knowledge): initialise store`.
    const second = runEngine(REAL_ENGINE, project, ['boot']);
    assert.strictEqual(second.ok, true);
    assert.strictEqual(second.migrations.changed, false);
    assert.strictEqual(second.knowledge, 'ready');
    assert.strictEqual(second.compacted, true);
    assert.strictEqual(second.kb_committed, git(project, ['rev-parse', '--short', 'HEAD']).trim());
    assert.strictEqual(git(project, ['log', '-1', '--pretty=%s']).trim(), 'chore(knowledge): initialise store');

    // Third boot: nothing new to commit.
    const third = runEngine(REAL_ENGINE, project, ['boot']);
    assert.strictEqual(third.knowledge, 'ready');
    assert.strictEqual(third.kb_committed, null);
  });
});

describe('engine commit --workflows', () => {
  let root;
  let project;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-boot-commit-'));
    project = setupProject(root);
  });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

  it('stages the whole .workflows tree — many work units plus .state — and commits', () => {
    writeFile(project, '.workflows/payments/manifest.json', '{"name":"payments","v":2}\n');
    writeFile(project, '.workflows/auth-flow/manifest.json', '{"name":"auth-flow"}\n');
    writeFile(project, '.workflows/.state/migrations', '045\n');
    writeFile(project, 'unrelated.txt', 'outside the scope\n');

    const res = runEngine(REAL_ENGINE, project, ['commit', '--workflows', '-m', 'chore: apply workflow migrations']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.committed, git(project, ['rev-parse', '--short', 'HEAD']).trim());
    assert.strictEqual(git(project, ['log', '-1', '--pretty=%s']).trim(), 'chore: apply workflow migrations');
    // Everything under .workflows landed in the one commit…
    const show = git(project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n').sort();
    assert.deepStrictEqual(show, [
      '.workflows/.state/migrations',
      '.workflows/auth-flow/manifest.json',
      '.workflows/payments/manifest.json',
    ]);
    // …and the unrelated file stays uncommitted.
    assert.match(git(project, ['status', '--porcelain']), /\?\? unrelated\.txt/);
  });

  it('a clean tree is fine: committed null, nothing-to-commit note, exit 0', () => {
    const res = runEngine(REAL_ENGINE, project, ['commit', '--workflows', '-m', 'noop']);
    assert.deepStrictEqual(res, { ok: true, committed: null, note: 'nothing to commit' });
  });

  it('rejects mixed scopes — exactly one of {wu, --inbox, --workflows}', () => {
    assert.match(
      runEngineFails(REAL_ENGINE, project, ['commit', '--workflows', 'payments', '-m', 'msg']).error,
      /Usage: engine commit/);
    assert.match(
      runEngineFails(REAL_ENGINE, project, ['commit', '--workflows', '--inbox', '-m', 'msg']).error,
      /Usage: engine commit/);
    assert.match(
      runEngineFails(REAL_ENGINE, project, ['commit', '--workflows']).error,
      /Usage: engine commit/);
  });
});
