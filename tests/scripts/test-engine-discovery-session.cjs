'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const REAL_SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');

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

// Stub knowledge CLI: records each invocation to knowledge-calls.log in the
// project cwd; failure is env-driven.
const STUB_KNOWLEDGE = `#!/usr/bin/env node
'use strict';
const fs = require('fs');
fs.appendFileSync('knowledge-calls.log', process.argv.slice(2).join(' ') + '\\n');
if (process.env.STUB_KNOWLEDGE_EXIT) {
  process.stderr.write('kb exploded\\n');
  process.exit(parseInt(process.env.STUB_KNOWLEDGE_EXIT, 10));
}
process.exit(0);
`;

/** An epic mid-session: the marker names session 002, both logs on disk. */
function epicManifest(overrides = {}) {
  return {
    name: 'payments',
    work_type: 'epic',
    status: 'in-progress',
    created: '2026-06-01',
    description: 'payments overhaul',
    phases: {
      discovery: {
        active_session: '002',
        items: { 'fee-model': { routing: 'discussion', source: 'discovery', summary: 'Fees' } },
        dismissed: ['dead-idea'],
      },
    },
    ...overrides,
  };
}

/**
 * A hermetic skills layout (real engine scripts, stub knowledge CLI) beside a
 * git-repo project carrying the epic and its session logs.
 */
function setupFixture({ epic = epicManifest() } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-disc-session-'));
  const skills = path.join(root, 'skills');
  fs.cpSync(REAL_SCRIPTS, path.join(skills, 'workflow-engine/scripts'), { recursive: true });
  writeFile(skills, 'workflow-knowledge/scripts/knowledge.cjs', STUB_KNOWLEDGE);

  const project = path.join(root, 'project');
  fs.mkdirSync(project, { recursive: true });
  git(project, ['init', '-q', '-b', 'main']);
  git(project, ['config', 'user.email', 'test@example.com']);
  git(project, ['config', 'user.name', 'Test']);
  git(project, ['config', 'commit.gpgsign', 'false']);

  writeFile(project, '.workflows/manifest.json', JSON.stringify({
    work_units: { payments: { work_type: 'epic' } },
  }, null, 2) + '\n');
  writeFile(project, '.workflows/payments/manifest.json', JSON.stringify(epic, null, 2) + '\n');
  writeFile(project, '.workflows/payments/discovery/sessions/session-001.md', '# Discovery Session 001\n\n## Conclusion\n\n2 topic(s) added.\n');
  writeFile(project, '.workflows/payments/discovery/sessions/session-002.md', '# Discovery Session 002\n\n## Conclusion\n\n(none)\n');
  git(project, ['add', '-A']);
  git(project, ['commit', '-q', '-m', 'init']);

  return { root, project, engine: path.join(skills, 'workflow-engine/scripts/engine.cjs') };
}

/** Run the engine expecting success; returns the parsed JSON response. */
function engine(fix, args, env = {}) {
  const out = execFileSync('node', [fix.engine, ...args], {
    cwd: fix.project,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return JSON.parse(out.trim());
}

/** Run the engine expecting failure; returns the parsed stderr JSON. */
function engineFails(fix, args, env = {}) {
  const res = spawnSync('node', [fix.engine, ...args], {
    cwd: fix.project,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  assert.strictEqual(res.status, 1, `expected exit 1, got ${res.status}\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
  assert.strictEqual(res.stdout, '');
  const parsed = JSON.parse(res.stderr.trim());
  assert.strictEqual(parsed.ok, false);
  return parsed;
}

function readManifest(fix, wu) {
  return JSON.parse(fs.readFileSync(path.join(fix.project, '.workflows', wu, 'manifest.json'), 'utf8'));
}

function knowledgeCalls(fix) {
  const log = path.join(fix.project, 'knowledge-calls.log');
  return fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n') : [];
}

function shortHead(fix) {
  return git(fix.project, ['rev-parse', '--short', 'HEAD']).trim();
}

/** Every file under `.workflows/`, rel path → content — the pristine check. */
function treeSnapshot(fix) {
  /** @type {Record<string, string>} */
  const files = {};
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else files[path.relative(fix.project, full)] = fs.readFileSync(full, 'utf8');
    }
  };
  walk(path.join(fix.project, '.workflows'));
  return {
    files,
    commits: git(fix.project, ['rev-list', '--count', 'HEAD']).trim(),
    status: git(fix.project, ['status', '--porcelain']),
  };
}

const CLOSE = ['discovery-session', 'close', 'payments', '-m', 'discovery(payments): synthesise 2 new topic(s)'];

describe('engine discovery-session close — happy path', () => {
  let fix;
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true }); });

  it('clears the marker, indexes the closed log, and commits the session dirt with the caller message', () => {
    fix = setupFixture();
    // The session's uncommitted dirt — the model's Conclusion write.
    const finalised = '# Discovery Session 002\n\n## Conclusion\n\n2 topic(s) added. Map now has 3 topics.\n';
    writeFile(fix.project, '.workflows/payments/discovery/sessions/session-002.md', finalised);
    writeFile(fix.project, 'unrelated.txt', 'outside the scope\n');
    const res = engine(fix, CLOSE);

    assert.deepStrictEqual(res, {
      ok: true,
      work_unit: 'payments',
      session: '002',
      session_log: '.workflows/payments/discovery/sessions/session-002.md',
      committed: shortHead(fix),
      warnings: [],
    });

    // Marker gone, the rest of the discovery phase intact; the log content is
    // untouched — the engine never writes prose.
    const m = readManifest(fix, 'payments');
    assert.deepStrictEqual(m.phases.discovery, {
      items: { 'fee-model': { routing: 'discussion', source: 'discovery', summary: 'Fees' } },
      dismissed: ['dead-idea'],
    });
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.workflows/payments/discovery/sessions/session-002.md'), 'utf8'), finalised);

    // The marker's log — not a re-glob — is what gets indexed.
    assert.deepStrictEqual(knowledgeCalls(fix), ['index .workflows/payments/discovery/sessions/session-002.md']);

    // One commit scoped to the work unit with the caller's message; the
    // Conclusion write rides along; unrelated files stay out.
    assert.strictEqual(git(fix.project, ['rev-list', '--count', 'HEAD']).trim(), '2');
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'discovery(payments): synthesise 2 new topic(s)');
    const staged = git(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n');
    assert.deepStrictEqual(staged.sort(), [
      '.workflows/payments/discovery/sessions/session-002.md',
      '.workflows/payments/manifest.json',
    ]);
    assert.match(git(fix.project, ['status', '--porcelain']), /\?\? unrelated\.txt/);
  });

  it('accepts --message as the long form', () => {
    fix = setupFixture();
    const res = engine(fix, ['discovery-session', 'close', 'payments', '--message', 'discovery(payments): finalise session log']);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'discovery(payments): finalise session log');
  });

  it('a marker-only close still commits — the marker delete is the dirt', () => {
    fix = setupFixture();
    const res = engine(fix, CLOSE);
    assert.strictEqual(res.committed, shortHead(fix));
    assert.strictEqual(git(fix.project, ['rev-list', '--count', 'HEAD']).trim(), '2');
    assert.strictEqual(readManifest(fix, 'payments').phases.discovery.active_session, undefined);
  });

  it('KB failure is a warning, never a block — the close still lands and commits', () => {
    fix = setupFixture();
    const res = engine(fix, CLOSE, { STUB_KNOWLEDGE_EXIT: '1' });
    assert.strictEqual(res.warnings.length, 1, res.warnings.join('\n'));
    assert.match(res.warnings[0], /knowledge index \(discovery\/sessions\/session-002\.md\) failed/);
    assert.strictEqual(res.committed, shortHead(fix));
    assert.strictEqual(readManifest(fix, 'payments').phases.discovery.active_session, undefined);
  });
});

describe('engine discovery-session close — guards refuse loudly, everything pristine', () => {
  let fix;
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true }); });

  /** Assert the refusal leaves every `.workflows/` byte identical, no commit, no KB call. */
  function refusedPristine(args, pattern) {
    const before = treeSnapshot(fix);
    const err = engineFails(fix, args);
    assert.match(err.error, pattern);
    assert.deepStrictEqual(treeSnapshot(fix), before);
    assert.deepStrictEqual(knowledgeCalls(fix), []);
    return err;
  }

  it('refuses an unknown work unit', () => {
    fix = setupFixture();
    refusedPristine(['discovery-session', 'close', 'ghost', '-m', 'msg'], /manifest not found/);
  });

  it('refuses when no marker is set — a browse-only session has nothing to close', () => {
    const epic = epicManifest();
    delete epic.phases.discovery.active_session;
    fix = setupFixture({ epic });
    refusedPristine(CLOSE, /no active discovery session for "payments"/);
  });

  it('refuses a marker naming a session with no log on disk', () => {
    const epic = epicManifest();
    epic.phases.discovery.active_session = '003';
    fix = setupFixture({ epic });
    refusedPristine(CLOSE, /session log missing on disk: \.workflows\/payments\/discovery\/sessions\/session-003\.md/);
  });

  it('rejects a missing message, extra positionals, and unknown subcommands', () => {
    fix = setupFixture();
    assert.match(engineFails(fix, ['discovery-session', 'close', 'payments']).error, /Usage: engine discovery-session close/);
    assert.match(engineFails(fix, ['discovery-session', 'close', '-m', 'msg']).error, /Usage: engine discovery-session close/);
    assert.match(engineFails(fix, ['discovery-session', 'close', 'payments', 'extra', '-m', 'msg']).error, /unexpected argument "extra"/);
    assert.match(engineFails(fix, ['discovery-session', 'open', 'payments', '-m', 'msg']).error, /Usage: engine discovery-session close/);
    assert.match(engineFails(fix, ['discovery-session']).error, /Usage: engine discovery-session close/);
  });
});
