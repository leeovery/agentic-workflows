'use strict';

//
// Tests for the gate surface's per-project opt-in: `gate-surface config`,
// the `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` flag it keeps in the project's
// `.claude/settings.json`, boot's `gate_surface` field and the re-sync it
// runs against a recorded choice, and the consent gate's render.
//

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const harness = require('./engine-harness.cjs');

const { git } = harness;
const FLAG = 'CLAUDE_CODE_ENABLE_FUNCTION_HOOKS';
// The session hook every booted project's settings carry, so boot's own
// hook sync is never the change a gate-surface test is reading.
const PRESENCE_HOOK = {
  type: 'command',
  command: 'node "$CLAUDE_PROJECT_DIR/.claude/skills/workflow-engine/scripts/engine.cjs" presence cleanup',
};
const SESSION_HOOKS = { SessionEnd: [{ hooks: [PRESENCE_HOOK] }] };

let dir; // temp project root — a git repo, since recording the choice commits

function writeFile(rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function setup() {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-gate-surface-'));
  fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'Test']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  git(dir, ['commit', '-q', '--allow-empty', '-m', 'init']);
}

function teardown() {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

/** `gate-surface config <value>` against the fixture. */
const config = (value, opts) => harness.ok(dir, ['gate-surface', 'config', String(value)], opts);

function projectManifest() {
  return JSON.parse(fs.readFileSync(path.join(dir, '.workflows', 'manifest.json'), 'utf8'));
}

function settingsPath() {
  return path.join(dir, '.claude', 'settings.json');
}

function settings() {
  return JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
}

function writeSettings(content) {
  writeFile('.claude/settings.json', typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n');
}

/** Commit whatever the fixture has staged out of the way, so HEAD reads the engine's own. */
function commitAll(message) {
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', message]);
}

/** HEAD's subject and the sorted paths it touched. */
function head() {
  return {
    subject: git(dir, ['log', '-1', '--pretty=%s']).trim(),
    files: git(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n').filter(Boolean).sort(),
  };
}

describe('engine gate-surface config', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('records the opt-in on the project manifest, writes the flag, and commits both files confined', () => {
    fs.writeFileSync(path.join(dir, 'peer-dirt.txt'), 'a peer session\'s file\n');
    const res = config(true);
    assert.deepStrictEqual(res, { ok: true, gate_surface: true });
    assert.deepStrictEqual(projectManifest(), { defaults: { gate_surface: true } }, 'a missing manifest is created around the choice');
    assert.deepStrictEqual(settings(), { env: { [FLAG]: '1' } });
    assert.deepStrictEqual(head(), {
      subject: 'chore: record gate-surface choice',
      files: ['.claude/settings.json', '.workflows/manifest.json'],
    });
    assert.match(git(dir, ['status', '--porcelain']), /\?\? peer-dirt\.txt/, 'the commit takes its own two paths and nothing else');
  });

  it('preserves every other manifest key and every other default', () => {
    writeFile('.workflows/manifest.json',
      JSON.stringify({ work_units: { pay: { work_type: 'feature' } }, defaults: { tmux_labels: true } }, null, 2) + '\n');
    config(true);
    assert.deepStrictEqual(projectManifest(), {
      work_units: { pay: { work_type: 'feature' } },
      defaults: { tmux_labels: true, gate_surface: true },
    });
    assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows', 'manifest.json'), 'utf8').slice(-2), '}\n', 'the manifest\'s own formatting');
  });

  it('leaves every other env key and everything else in the settings file standing', () => {
    writeSettings({ permissions: { allow: ['Bash(ls)'] }, env: { EDITOR: 'vim' }, hooks: SESSION_HOOKS });
    config(true);
    assert.deepStrictEqual(settings(), {
      permissions: { allow: ['Bash(ls)'] },
      env: { EDITOR: 'vim', [FLAG]: '1' },
      hooks: SESSION_HOOKS,
    });
  });

  it('opting out takes the flag back out, leaves its env siblings, and commits both', () => {
    writeSettings({ env: { EDITOR: 'vim', [FLAG]: '1' } });
    commitAll('settings');
    const res = config(false);
    assert.deepStrictEqual(res, { ok: true, gate_surface: false });
    assert.strictEqual(projectManifest().defaults.gate_surface, false);
    assert.deepStrictEqual(settings(), { env: { EDITOR: 'vim' } });
    assert.deepStrictEqual(head(), {
      subject: 'chore: record gate-surface choice',
      files: ['.claude/settings.json', '.workflows/manifest.json'],
    });
  });

  it('an env block the flag alone filled goes with it', () => {
    config(true);
    config(false);
    assert.deepStrictEqual(settings(), {});
  });

  it('declining on a project the flag never reached commits the manifest alone', () => {
    writeSettings({ hooks: SESSION_HOOKS });
    commitAll('settings');
    const res = config(false);
    assert.deepStrictEqual(res, { ok: true, gate_surface: false });
    assert.deepStrictEqual(settings(), { hooks: SESSION_HOOKS }, 'nothing to sync, nothing written');
    assert.deepStrictEqual(head(), { subject: 'chore: record gate-surface choice', files: ['.workflows/manifest.json'] });
  });

  it('a value already on the flag is left as it is — no second write, nothing to commit', () => {
    config(true);
    const before = git(dir, ['rev-parse', 'HEAD']);
    config(true);
    assert.deepStrictEqual(settings(), { env: { [FLAG]: '1' } });
    assert.strictEqual(git(dir, ['rev-parse', 'HEAD']), before);
  });

  it('refuses a value that is not a boolean, and an unknown subcommand', () => {
    assert.match(harness.refuses(dir, ['gate-surface', 'config', 'yes']).error, /Usage: engine gate-surface config <true\|false>/);
    assert.match(harness.refuses(dir, ['gate-surface', 'config']).error, /Usage: engine gate-surface config <true\|false>/);
    assert.match(harness.refuses(dir, ['gate-surface', 'record', 'true']).error, /Usage: engine gate-surface config <true\|false>/);
    assert.ok(!fs.existsSync(path.join(dir, '.workflows', 'manifest.json')), 'nothing recorded by a refusal');
  });

  it('refuses to replace a project manifest that no longer parses', () => {
    const p = path.join(dir, '.workflows', 'manifest.json');
    fs.writeFileSync(p, '{not json', 'utf8');
    assert.match(harness.refuses(dir, ['gate-surface', 'config', 'true']).error, /not valid JSON/);
    assert.strictEqual(fs.readFileSync(p, 'utf8'), '{not json');
    assert.ok(!fs.existsSync(settingsPath()), 'no flag lands for a choice that was not recorded');
  });

  it('a settings file that does not parse is left alone — the choice is recorded and the sync reported', () => {
    writeSettings('{not json');
    const res = config(true);
    assert.strictEqual(res.gate_surface, true);
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /gate surface not synced: \.claude\/settings\.json is not valid JSON/);
    assert.strictEqual(fs.readFileSync(settingsPath(), 'utf8'), '{not json');
    assert.deepStrictEqual(head(), { subject: 'chore: record gate-surface choice', files: ['.workflows/manifest.json'] });
  });

  it('a commit git refuses is a warning, never a failure — the choice and the flag are on disk', () => {
    const hooksDir = path.join(dir, '.git', 'hooks');
    fs.mkdirSync(hooksDir, { recursive: true });
    fs.writeFileSync(path.join(hooksDir, 'pre-commit'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
    const res = config(true);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.gate_surface, true);
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /^commit failed: /);
    assert.deepStrictEqual(projectManifest(), { defaults: { gate_surface: true } });
    assert.deepStrictEqual(settings(), { env: { [FLAG]: '1' } });
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'init', 'nothing landed');
  });
});

// ---------------------------------------------------------------------------
// Boot: the state it reports, and the re-sync it runs against a recorded
// choice. The engine is copied beside stub migrate/knowledge siblings, which
// boot resolves from its own file — the layout an install has.
// ---------------------------------------------------------------------------

const STUB_MIGRATE = `#!/usr/bin/env node
'use strict';
process.stdout.write('[SKIP] No changes needed\\n');
process.stdout.write('---MIGRATIONS_RUN---\\n');
process.stdout.write(JSON.stringify({ ran: 0, tracking: '.workflows/.state/migrations' }) + '\\n');
`;

const STUB_KNOWLEDGE = `#!/usr/bin/env node
'use strict';
process.stdout.write(process.argv[2] === 'check' ? 'ready\\n' : '');
process.exit(0);
`;

/** The engine beside its stubs — one tree for the whole file. */
function stubbedEngine() {
  const skills = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-gate-surface-skills-'));
  process.on('exit', () => fs.rmSync(skills, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  fs.cpSync(path.dirname(harness.ENGINE), path.join(skills, 'workflow-engine/scripts'), { recursive: true });
  for (const [rel, content] of [
    ['workflow-migrate/scripts/migrate.cjs', STUB_MIGRATE],
    ['workflow-knowledge/scripts/knowledge.cjs', STUB_KNOWLEDGE],
  ]) {
    const full = path.join(skills, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return harness.harness(path.join(skills, 'workflow-engine/scripts/engine.cjs'));
}

const booter = stubbedEngine();

describe('engine boot gate surface', () => {
  beforeEach(() => {
    setup();
    // The session hooks boot wants, already in place: its own hook sync is
    // then never the write a gate-surface assertion is reading.
    writeSettings({ hooks: SESSION_HOOKS });
    commitAll('settings');
  });
  afterEach(teardown);

  /** Record the choice on the manifest and commit it, so boot's only new dirt is its own. */
  function recordChoice(value) {
    writeFile('.workflows/manifest.json', JSON.stringify({ defaults: { gate_surface: value } }, null, 2) + '\n');
    commitAll('record the defaults');
  }

  const boot = () => booter.ok(dir, ['boot']);

  it('reports prompt while the choice was never recorded, and touches nothing', () => {
    // A flag the project set for itself: never asked is never ours to remove.
    writeSettings({ env: { [FLAG]: '1' }, hooks: SESSION_HOOKS });
    commitAll('a flag of the project\'s own');
    const res = boot();
    assert.strictEqual(res.gate_surface, 'prompt');
    assert.deepStrictEqual(res.warnings, []);
    assert.deepStrictEqual(settings(), { env: { [FLAG]: '1' }, hooks: SESSION_HOOKS });
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'a flag of the project\'s own', 'nothing of boot\'s landed');
  });

  it('a recorded `on` re-syncs the flag back in, committed confined — and a second boot changes nothing', () => {
    recordChoice(true);
    const res = boot();
    assert.strictEqual(res.gate_surface, 'on');
    assert.deepStrictEqual(settings(), { hooks: SESSION_HOOKS, env: { [FLAG]: '1' } });
    assert.deepStrictEqual(head(), { subject: 'chore: sync workflow gate surface', files: ['.claude/settings.json'] });
    const at = git(dir, ['rev-parse', 'HEAD']);
    assert.strictEqual(boot().gate_surface, 'on');
    assert.strictEqual(git(dir, ['rev-parse', 'HEAD']), at, 'nothing new to commit');
    assert.strictEqual(git(dir, ['status', '--porcelain']).trim(), '', 'and no new dirt');
  });

  it('a recorded `off` takes a flag added behind its back back out', () => {
    recordChoice(false);
    writeSettings({ env: { [FLAG]: '1', EDITOR: 'vim' }, hooks: SESSION_HOOKS });
    commitAll('a flag by hand');
    const res = boot();
    assert.strictEqual(res.gate_surface, 'off');
    assert.deepStrictEqual(settings(), { env: { EDITOR: 'vim' }, hooks: SESSION_HOOKS });
    assert.deepStrictEqual(head(), { subject: 'chore: sync workflow gate surface', files: ['.claude/settings.json'] });
  });

  it('both syncs moving in one boot make one commit that says so', () => {
    recordChoice(true);
    // Settings the hooks never reached either: one write, one commit.
    git(dir, ['rm', '-q', '--', '.claude/settings.json']);
    commitAll('no settings');
    const res = boot();
    assert.strictEqual(res.session_hooks_installed, true);
    assert.strictEqual(res.gate_surface, 'on');
    assert.deepStrictEqual(settings(), { hooks: SESSION_HOOKS, env: { [FLAG]: '1' } });
    assert.deepStrictEqual(head(), { subject: 'chore: sync workflow project settings', files: ['.claude/settings.json'] });
  });

  it('a settings file that does not parse is a warning under a recorded choice, never a block', () => {
    recordChoice(true);
    writeSettings('{not json');
    const res = boot();
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.gate_surface, 'on');
    assert.deepStrictEqual(res.warnings.filter((w) => w.startsWith('gate surface not synced: ')).length, 1);
    assert.strictEqual(fs.readFileSync(settingsPath(), 'utf8'), '{not json');
  });
});

describe('render gate-surface-gate', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('is a static yes/no consent gate', () => {
    assert.strictEqual(harness.output(dir, ['render', 'gate-surface-gate']), [
      "=== MENU: gate surface gate (emit verbatim as markdown, then STOP for the user's response) ===",
      Array(12).fill('·').join(' '),
      '**`◆ Turn the gate surface on for this project?`**',
      '',
      '**`y/yes`** → Draw the gates above the prompt',
      '**`n/no`**  → Keep the gates as text menus',
      '',
    ].join('\n'));
  });
});
