'use strict';

// ---------------------------------------------------------------------------
// The gate mod at boot (ledger-engine/scripts/domain/boot.cjs with
// domain/gate-surface.cjs): whether the mod runs, could or cannot, and the
// gates it puts to the start — the notice where it could run and is not, the
// stop at a Claude Code older than the floor, nothing where it cannot run
// (22.S33) — no Claude Code settings written;
// and the hook sync beside it, its commit, its file's mode and link kept.
//
// Layer: verb. World: the project fixture (boot-world.cjs), a git repository
// with its state worktree and Ledger's hooks, made once per run and
// copied; boot runs from a copy of the engine beside a stand-in migration
// runner whose behaviour the test picks through the environment.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { git, commitAll, LEDGER_HOOKS, OWN_HOOKS, hooked } = harness;

const { createFile } = require('./discovery-test-utils.cjs');
const { hookHelpers, FLAG, bootProject } = require('./boot-world.cjs');

describe('engine boot: the project\'s session hooks, and the gate mod', () => {
  let fix;
  beforeEach(() => { fix = bootProject(); });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });
  const { dropSettings, commitSettings, bootWith } = hookHelpers(() => fix);

  /** The fixture's own settings, as boot leaves every project. */
  const HOOKS_ONLY = { hooks: OWN_HOOKS };
  /** @param {object} value */
  const json = (value) => JSON.stringify(value, null, 2) + '\n';
  /** Where the mod stands, as boot reports it: `mod`, and whether the start's gates carry its notice or the floor's stop. @param {Record<string, any>} res */
  const standing = (res) => ({ mod: res.mod, notice: res.gates.includes('mod-notice'), floor: res.gates.includes('claude-code-floor') });
  const RUNNING = { mod: 'running', notice: false, floor: false };
  const COULD = { mod: 'could', notice: true, floor: false };
  const OUTDATED = { mod: 'cannot', notice: false, floor: true };
  const CANNOT = { mod: 'cannot', notice: false, floor: false };
  /** Claude Code's terminal app, at the oldest version the mod runs on. */
  const TERMINAL = { CLAUDE_CODE_ENTRYPOINT: 'cli', AI_AGENT: 'claude-code_2-1-287_agent', CLAUDE_CODE_REMOTE: undefined };
  /** HEAD's subject and the sorted paths it touched. */
  function head() {
    return {
      subject: git(fix.project, ['log', '-1', '--pretty=%s']).trim(),
      files: git(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n').filter(Boolean).sort(),
    };
  }
  /** Install the mod where an install puts it, committed, so boot's commits are the only new ones. */
  function installMod() {
    createFile(fix.project, '.claude/skills/ledger-gates/.claude-plugin/plugin.json', '{"name":"ledger-gates"}\n');
    commitAll(fix.project, 'install the mod');
  }
  /** The fixture's Claude Code config directory, and a home holding no `.claude` — neither made unless a test makes it. */
  const claudeDir = () => path.join(fix.root, 'claude-config');
  const homeDir = () => path.join(fix.root, 'home');
  const userSettingsFile = () => path.join(claudeDir(), 'settings.json');
  const projectSettingsText = () => fs.readFileSync(path.join(fix.project, '.claude/settings.json'), 'utf8');
  /** Boot in the terminal app under the fixture's Claude Code config and home, `env` layered over it. */
  const bootTerminal = (env = {}) => bootWith({ env: { ...TERMINAL, CLAUDE_CONFIG_DIR: claudeDir(), HOME: homeDir(), ...env } });

  it('22.S33: where the mod can run and is not running, boot reports it could, the start\'s notice due, and writes no Claude Code settings — the user\'s file stays absent, the project untouched, nothing committed', () => {
    installMod();
    const project = projectSettingsText();
    for (const configDir of [claudeDir(), undefined]) {
      const res = bootTerminal({ CLAUDE_CONFIG_DIR: configDir });
      assert.deepStrictEqual(standing(res), COULD, String(configDir));
      assert.deepStrictEqual(res.warnings, []);
    }
    assert.ok(!fs.existsSync(claudeDir()), 'the config directory not made');
    assert.ok(!fs.existsSync(homeDir()), 'nor ~/.claude');
    assert.strictEqual(projectSettingsText(), project);
    assert.strictEqual(head().subject, 'install the mod', 'no commit of boot\'s');
    assert.strictEqual(git(fix.project, ['status', '--porcelain']).trim(), '');
  });

  it('a user settings file is left byte-for-byte as found, whatever it holds — a function-hooks flag of any value, or a file that does not parse', () => {
    installMod();
    const contents = [
      '{"env":{"CLAUDE_CODE_ENABLE_FUNCTION_HOOKS":"1"}}',
      '{"model":"opus","env":{"CLAUDE_CODE_ENABLE_FUNCTION_HOOKS":"0","EDITOR":"vim"}}\n',
      '{not json',
    ];
    for (const content of contents) {
      createFile(claudeDir(), 'settings.json', content);
      fs.chmodSync(userSettingsFile(), 0o600);
      const before = fs.statSync(userSettingsFile());
      const res = bootTerminal();
      assert.deepStrictEqual(standing(res), COULD, content);
      assert.deepStrictEqual(res.warnings, [], content);
      assert.strictEqual(fs.readFileSync(userSettingsFile(), 'utf8'), content);
      const after = fs.statSync(userSettingsFile());
      assert.strictEqual(after.mtimeMs, before.mtimeMs, `${content}: never rewritten`);
      assert.strictEqual(after.mode & 0o777, 0o600);
    }
  });

  it('the mod announced in boot\'s environment reports it running, no notice due — only `1` is the announcement', () => {
    installMod();
    assert.deepStrictEqual(standing(bootTerminal({ LEDGER_GATE_SURFACE: '1' })), RUNNING);
    assert.deepStrictEqual(standing(bootTerminal({ LEDGER_GATE_SURFACE: '0' })), COULD);
    assert.ok(!fs.existsSync(claudeDir()), 'nothing made either way');
  });

  it('a readable release before 2.1.287 is the floor\'s stop, the mod unable to run — announced or not — and touches no file', () => {
    installMod();
    for (const version of ['2-1-286', '2-1-282', '2-0-999', '1-9-999']) {
      const res = bootTerminal({ AI_AGENT: `claude-code_${version}_agent` });
      assert.deepStrictEqual(standing(res), OUTDATED, version);
    }
    assert.deepStrictEqual(standing(bootTerminal({ AI_AGENT: 'claude-code_2-1-286_agent', LEDGER_GATE_SURFACE: '1' })), OUTDATED);
    assert.ok(!fs.existsSync(claudeDir()), 'nothing made');
    assert.ok(!fs.existsSync(homeDir()), 'nor ~/.claude');
  });

  it('every version from 2.1.287 on is one the mod runs on', () => {
    installMod();
    for (const version of ['2-1-287', '2-1-300', '2-2-0', '3-0-0']) {
      assert.deepStrictEqual(standing(bootTerminal({ AI_AGENT: `claude-code_${version}_agent` })), COULD, version);
      assert.deepStrictEqual(standing(bootTerminal({ AI_AGENT: `claude-code_${version}_agent`, LEDGER_GATE_SURFACE: '1' })), RUNNING, version);
    }
  });

  it('the Desktop app\'s Code tab is where the mod runs too — on Anthropic\'s API or a third-party provider: running, could, the floor\'s stop, touching no file', () => {
    installMod();
    for (const entrypoint of ['claude-desktop', 'claude-desktop-3p']) {
      const desktop = { CLAUDE_CODE_ENTRYPOINT: entrypoint };
      assert.deepStrictEqual(standing(bootTerminal(desktop)), COULD, entrypoint);
      assert.deepStrictEqual(standing(bootTerminal({ ...desktop, LEDGER_GATE_SURFACE: '1' })), RUNNING, entrypoint);
      assert.deepStrictEqual(standing(bootTerminal({ ...desktop, AI_AGENT: 'claude-code_2-1-286_agent' })), OUTDATED, entrypoint);
    }
    assert.ok(!fs.existsSync(claudeDir()), 'nothing made');
    assert.ok(!fs.existsSync(homeDir()), 'nor ~/.claude');
    assert.strictEqual(head().subject, 'install the mod', 'no commit of boot\'s');
  });

  it('22.S33: where the mod cannot run, boot touches no file and reports it cannot, no notice due', () => {
    const old = { AI_AGENT: 'claude-code_2-1-286_agent' };
    assert.deepStrictEqual(standing(bootTerminal()), CANNOT, 'the mod not installed in the project');
    assert.deepStrictEqual(standing(bootTerminal(old)), CANNOT, 'the mod not installed, whatever the version');
    installMod();
    const elsewhere = [
      ['Claude Code on the web', { CLAUDE_CODE_REMOTE: 'true' }],
      ['on the web at an older release', { CLAUDE_CODE_REMOTE: 'true', ...old }],
      ['the VS Code extension', { CLAUDE_CODE_ENTRYPOINT: 'claude-vscode' }],
      ['the VS Code extension, announced', { CLAUDE_CODE_ENTRYPOINT: 'claude-vscode', LEDGER_GATE_SURFACE: '1' }],
      ['a Desktop cloud session', { CLAUDE_CODE_ENTRYPOINT: 'remote_desktop' }],
      ['a Desktop cloud session, flagged remote', { CLAUDE_CODE_ENTRYPOINT: 'remote_desktop', CLAUDE_CODE_REMOTE: 'true' }],
      ['the Desktop app on the web', { CLAUDE_CODE_ENTRYPOINT: 'claude-desktop', CLAUDE_CODE_REMOTE: 'true' }],
      ['another entrypoint', { CLAUDE_CODE_ENTRYPOINT: 'sdk-cli' }],
      ['no entrypoint', { CLAUDE_CODE_ENTRYPOINT: undefined }],
      ['no version', { AI_AGENT: undefined }],
      ['a version that does not parse', { AI_AGENT: 'claude-code_2-1_agent' }],
      ['an identity in another shape', { AI_AGENT: 'claude-code_2-1-300_sdk' }],
      ['another agent', { AI_AGENT: 'cursor' }],
    ];
    for (const [where, env] of elsewhere) {
      const res = bootTerminal(env);
      assert.deepStrictEqual(standing(res), CANNOT, where);
    }
    assert.ok(!fs.existsSync(claudeDir()), 'nothing made');
    assert.strictEqual(head().subject, 'install the mod', 'no commit of boot\'s');
  });

  it('the harness switch holds the project\'s settings file alone — the mod reports as it would without it', () => {
    installMod();
    dropSettings();
    for (const [version, status] of [['2-1-287', COULD], ['2-1-286', OUTDATED]]) {
      const res = bootWith({ holdSettings: true, env: { ...TERMINAL, CLAUDE_CONFIG_DIR: claudeDir(), HOME: homeDir(), AI_AGENT: `claude-code_${version}_agent` } });
      assert.deepStrictEqual(standing(res), status, version);
      assert.strictEqual(res.session_hooks_installed, false);
    }
    assert.ok(!fs.existsSync(path.join(fix.project, '.claude/settings.json')), 'the project\'s settings held');
    assert.ok(!fs.existsSync(claudeDir()));
    assert.strictEqual(head().subject, 'no settings', 'no commit of boot\'s');
  });

  it('a flag in the project\'s settings is neither read nor written — the mod\'s own announcement alone decides', () => {
    installMod();
    for (const value of ['1', '0']) {
      const project = json({ ...HOOKS_ONLY, env: { [FLAG]: value } });
      commitSettings(project);
      assert.deepStrictEqual(standing(bootTerminal()), COULD, `a project flag of ${value}`);
      assert.deepStrictEqual(standing(bootTerminal({ LEDGER_GATE_SURFACE: '1' })), RUNNING, `a project flag of ${value}`);
      assert.strictEqual(projectSettingsText(), project, 'left as found');
    }
  });

  it('a hook sync in a boot where the mod can run — the project commit carries the hooks alone', () => {
    installMod();
    dropSettings();
    const res = bootTerminal();
    assert.strictEqual(res.session_hooks_installed, true);
    assert.deepStrictEqual(standing(res), COULD);
    assert.strictEqual(projectSettingsText(), hooked(LEDGER_HOOKS));
    assert.deepStrictEqual(head(), { subject: 'chore: install Ledger session hooks', files: ['.claude/settings.json'] });
  });

  it('a project settings file the hook sync rewrites keeps its permission mode', () => {
    for (const mode of [0o600, 0o644]) {
      commitSettings(json({ model: 'opus' }));
      fs.chmodSync(path.join(fix.project, '.claude/settings.json'), mode);
      assert.strictEqual(bootWith().session_hooks_installed, true, mode.toString(8));
      assert.strictEqual(projectSettingsText(), json({ model: 'opus', ...HOOKS_ONLY }));
      assert.strictEqual(fs.statSync(path.join(fix.project, '.claude/settings.json')).mode & 0o777, mode, mode.toString(8));
    }
  });

  it('a symlinked project settings file gets the hooks at the file it names — the link stands, an existing target or one not yet made', () => {
    const link = path.join(fix.project, '.claude/settings.json');
    const permissions = { allow: ['Bash(ls)'] };
    for (const [name, before, after] of [
      ['shared-settings.json', json({ permissions }), json({ permissions, ...HOOKS_ONLY })],
      ['fresh-settings.json', null, hooked(LEDGER_HOOKS)],
    ]) {
      const target = path.join(fix.root, 'shared', name);
      if (before !== null) createFile(fix.root, `shared/${name}`, before);
      fs.rmSync(link, { force: true });
      fs.symlinkSync(target, link);
      const res = bootWith();
      assert.strictEqual(res.session_hooks_installed, true, name);
      assert.deepStrictEqual(res.warnings, [], name);
      assert.ok(fs.lstatSync(link).isSymbolicLink(), `${name}: still a link`);
      assert.strictEqual(fs.readlinkSync(link), target, name);
      assert.strictEqual(fs.readFileSync(target, 'utf8'), after, name);
    }
  });

  it('a session-hooks commit git refuses is a warning, never a block — the hooks are on disk', () => {
    dropSettings();
    createFile(fix.project, '.git/hooks/pre-commit', '#!/bin/sh\nexit 1\n');
    fs.chmodSync(path.join(fix.project, '.git/hooks/pre-commit'), 0o755);
    const res = bootWith();
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.session_hooks_installed, true);
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /^project settings commit failed, and the next boot tries again: /);
    assert.strictEqual(projectSettingsText(), hooked(LEDGER_HOOKS));
    assert.strictEqual(head().subject, 'no settings', 'nothing landed');
  });
});
