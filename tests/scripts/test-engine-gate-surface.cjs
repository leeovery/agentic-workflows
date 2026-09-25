'use strict';

//
// Tests for the gate mod's footing in boot: the `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS`
// flag every boot keeps in the project's `.claude/settings.json`, and the
// `gate_surface` field it reports — `on` where the mod announced itself,
// `restart` where this boot wrote the flag, `off` otherwise.
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
const ANNOUNCED = { WORKFLOWS_GATE_SURFACE: '1' };
const HOOK_ENGINE = 'node "$CLAUDE_PROJECT_DIR/.claude/skills/workflow-engine/scripts/engine.cjs"';
const hook = (/** @type {string} */ verb) => ({ type: 'command', command: `${HOOK_ENGINE} ${verb}` });
// The session hooks boot wants while labels were never asked, already in
// place: boot's own hook sync is then never the write a flag test reads.
const SESSION_HOOKS = { SessionEnd: [{ hooks: [hook('presence cleanup')] }] };
// The knowledge files boot keeps listed in `.worktreeinclude`, likewise in
// place, so boot's own include write never lands on top of the flag's.
const WORKTREE_INCLUDE = ['store.msp', 'metadata.json', 'config.json'].map((f) => `.workflows/.knowledge/${f}\n`).join('');

// Boot resolves its migrate and knowledge siblings from its own file, so the
// engine is copied beside stubs of both — the layout an install has.
const STUB_MIGRATE = `#!/usr/bin/env node
'use strict';
process.stdout.write('[SKIP] No changes needed\\n');
process.stdout.write('---MIGRATIONS_RUN---\\n');
process.stdout.write(JSON.stringify({ ran: 0, tracking: '.workflows/.state/migrations' }) + '\\n');
`;

// STUB_AFTER_COMPACT is a script `compact` leaves running as it returns —
// a peer acting while boot is still under way.
const STUB_KNOWLEDGE = `#!/usr/bin/env node
'use strict';
if (process.argv[2] === 'compact' && process.env.STUB_AFTER_COMPACT) {
  require('child_process').spawn(process.execPath, ['-e', process.env.STUB_AFTER_COMPACT], { detached: true, stdio: 'ignore' }).unref();
}
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

let dir; // temp project root — a git repo, since boot commits what it writes

function settingsPath() {
  return path.join(dir, '.claude', 'settings.json');
}

function settings() {
  return JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
}

function writeSettings(content) {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n');
}

/** Commit whatever the fixture has staged out of the way, so HEAD reads boot's own. */
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

/** Boot against the fixture, `env` layered over the suite's own. */
const boot = (env = {}) => booter.ok(dir, ['boot'], { env });

describe('engine boot — the function-hooks flag and gate_surface', () => {
  beforeEach(() => {
    dir = harness.setupGitFixture('engine-gate-surface-');
    writeSettings({ hooks: SESSION_HOOKS });
    fs.writeFileSync(path.join(dir, '.worktreeinclude'), WORKTREE_INCLUDE);
    commitAll('settings');
  });
  afterEach(() => harness.cleanupFixture(dir));

  it('a project without the flag gets it, committed confined, and reports restart — the next boot writes nothing and reports off', () => {
    fs.writeFileSync(path.join(dir, 'peer-dirt.txt'), 'a peer session\'s file\n');
    const res = boot();
    assert.strictEqual(res.gate_surface, 'restart');
    assert.deepStrictEqual(res.warnings, []);
    assert.deepStrictEqual(settings(), { hooks: SESSION_HOOKS, env: { [FLAG]: '1' } });
    assert.deepStrictEqual(head(), { subject: 'chore: sync workflow gate surface', files: ['.claude/settings.json'] });
    assert.match(git(dir, ['status', '--porcelain']), /\?\? peer-dirt\.txt/, 'the commit takes its own path and nothing else');

    const at = git(dir, ['rev-parse', 'HEAD']);
    assert.strictEqual(boot().gate_surface, 'off', 'the flag is there, and the mod did not announce itself');
    assert.strictEqual(git(dir, ['rev-parse', 'HEAD']), at, 'nothing new to commit');
  });

  it('the mod announced in boot\'s environment reports on — the boot that wrote the flag included', () => {
    const res = boot(ANNOUNCED);
    assert.strictEqual(res.gate_surface, 'on', 'the flag came from elsewhere — the user\'s settings, the shell');
    assert.deepStrictEqual(settings(), { hooks: SESSION_HOOKS, env: { [FLAG]: '1' } }, 'and the project gets it all the same');
    assert.strictEqual(boot(ANNOUNCED).gate_surface, 'on');
    assert.strictEqual(boot({ WORKFLOWS_GATE_SURFACE: '0' }).gate_surface, 'off', 'only `1` is the announcement');
  });

  it('every other env key and every other setting stands', () => {
    const permissions = { allow: ['Bash(ls)'] };
    writeSettings({ permissions, env: { EDITOR: 'vim' }, hooks: SESSION_HOOKS });
    commitAll('settings of the project\'s own');
    assert.strictEqual(boot().gate_surface, 'restart');
    assert.deepStrictEqual(settings(), { permissions, env: { EDITOR: 'vim', [FLAG]: '1' }, hooks: SESSION_HOOKS });
  });

  it('never takes the flag out — not when the session hooks beside it move', () => {
    const labelled = {
      SessionEnd: [{ hooks: [hook('session cleanup'), hook('presence cleanup')] }],
      SessionStart: [{ matcher: 'resume', hooks: [hook('session resume')] }],
    };
    writeSettings({ hooks: labelled, env: { [FLAG]: '1' } });
    commitAll('label hooks the project never asked for');
    const res = boot();
    assert.strictEqual(res.session_hooks_installed, true);
    assert.strictEqual(res.gate_surface, 'off');
    assert.deepStrictEqual(settings(), { hooks: SESSION_HOOKS, env: { [FLAG]: '1' } });
    assert.deepStrictEqual(head(), { subject: 'chore: install workflow session hooks', files: ['.claude/settings.json'] });
  });

  it('both syncs moving in one boot make one commit that says so', () => {
    git(dir, ['rm', '-q', '--', '.claude/settings.json']);
    commitAll('no settings');
    const res = boot();
    assert.strictEqual(res.session_hooks_installed, true);
    assert.strictEqual(res.gate_surface, 'restart');
    assert.deepStrictEqual(settings(), { hooks: SESSION_HOOKS, env: { [FLAG]: '1' } });
    assert.deepStrictEqual(head(), { subject: 'chore: sync workflow project settings', files: ['.claude/settings.json'] });
  });

  it('a settings file that does not parse is a warning, never a block — left as found, and nothing owed a restart', () => {
    writeSettings('{not json');
    const res = boot();
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.gate_surface, 'off');
    assert.deepStrictEqual(res.warnings.filter((w) => /^gate surface not synced: \.claude\/settings\.json is not valid JSON/.test(w)).length, 1);
    assert.strictEqual(fs.readFileSync(settingsPath(), 'utf8'), '{not json');
  });

  it('a settings commit git refuses is a warning, never a block — the flag is on disk and the restart still owed', () => {
    const hooksDir = path.join(dir, '.git', 'hooks');
    fs.mkdirSync(hooksDir, { recursive: true });
    fs.writeFileSync(path.join(hooksDir, 'pre-commit'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
    const res = boot();
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.gate_surface, 'restart');
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /^project settings commit failed: /);
    assert.deepStrictEqual(settings(), { hooks: SESSION_HOOKS, env: { [FLAG]: '1' } });
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'settings', 'nothing landed');
  });

  it('reads the flag inside the hold its write takes — one a peer wrote while boot waited on the lock is never written twice', () => {
    fs.writeFileSync(path.join(dir, '.workflows', '.project-lock'), '');
    const peer = `setTimeout(() => {
      const fs = require('fs');
      fs.writeFileSync('.claude/settings.json', ${JSON.stringify(JSON.stringify({ hooks: SESSION_HOOKS, env: { [FLAG]: '1' } }))});
      fs.unlinkSync('.workflows/.project-lock');
    }, 500);`;
    const res = boot({ STUB_AFTER_COMPACT: peer });
    assert.strictEqual(res.gate_surface, 'off');
    assert.deepStrictEqual(settings(), { hooks: SESSION_HOOKS, env: { [FLAG]: '1' } });
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'settings', 'nothing of boot\'s landed');
  });

  it('WORKFLOWS_SKIP_SESSION_HOOKS=1 — the test harness\'s switch — holds the settings file still: no flag, no commit', () => {
    git(dir, ['rm', '-q', '--', '.claude/settings.json']);
    commitAll('no settings');
    const res = boot({ WORKFLOWS_SKIP_SESSION_HOOKS: '1' });
    assert.strictEqual(res.gate_surface, 'off');
    assert.ok(!fs.existsSync(settingsPath()));
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'no settings', 'no commit of boot\'s');
  });
});
