'use strict';

// ---------------------------------------------------------------------------
// `engine session label-config`, the project-manifest opt-in and its two
// commits, and `syncSessionHooks`, the hooks it syncs in the project's
// settings: SessionEnd's `session cleanup` while labels are on, `presence
// cleanup` and `conversation end` regardless; SessionStart's `session resume`
// while labels are on; PreToolUse's layout, brief and shell groups regardless.
//
// Layer: verb. World: session-label-world.cjs — the shared tmux stub stands
// in for tmux, and the engine only ever sees the stub.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { syncSessionHooks } = require('../../skills/leeway-engine/scripts/domain/session-label.cjs');
const harness = require('./engine-harness.cjs');
const { world, LAYOUT_GROUP, GUARD_GROUPS, SESSION_HOOK, RESUME_HOOK, PRESENCE_HOOK, END_HOOK, LABELS_ON, LABELS_OFF, git, stateGit, setup, teardown, engine, resume, projectManifest, settingsPath, settings, writeSettings, head, CHOICE } = require('./session-label-world.cjs');

describe('engine session label-config', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('records the opt-in on the project manifest, installs the session hooks, and commits each where it lives, confined', () => {
    fs.writeFileSync(path.join(world.dir, 'peer-dirt.txt'), 'a peer session\'s file\n');
    fs.writeFileSync(path.join(world.dir, '.leeway', 'pay', 'spec.md'), 'a peer session\'s state\n');
    const before = projectManifest();
    const res = engine(['session', 'label-config', 'true']);
    assert.deepStrictEqual(res, { ok: true, tmux_labels: true });
    assert.deepStrictEqual(projectManifest(), { ...before, defaults: { tmux_labels: true } });
    assert.deepStrictEqual(settings(), LABELS_ON);
    assert.deepStrictEqual({ state: head(stateGit), code: head(git) }, CHOICE);
    assert.match(git(['status', '--porcelain']), /\?\? peer-dirt\.txt/, 'the code commit takes its own path and nothing else');
    assert.match(stateGit(['status', '--porcelain', '--untracked-files=all']), /\?\? pay\/spec\.md/, 'the state commit takes its own path and nothing else');
  });

  it('preserves every other manifest key and every other default', () => {
    fs.writeFileSync(path.join(world.dir, '.leeway', 'manifest.json'),
      JSON.stringify({ work_units: { pay: { work_type: 'feature' } }, defaults: { plan_format: 'tick' } }, null, 2) + '\n');
    engine(['session', 'label-config', 'true']);
    assert.deepStrictEqual(projectManifest(), {
      work_units: { pay: { work_type: 'feature' } },
      defaults: { plan_format: 'tick', tmux_labels: true },
    });
    assert.strictEqual(fs.readFileSync(path.join(world.dir, '.leeway', 'manifest.json'), 'utf8').slice(-2), '}\n', 'the manifest\'s own formatting');
  });

  it('opting out records false, takes `session cleanup` out, leaves the workflows\' own hooks standing, and commits both', () => {
    engine(['session', 'label-config', 'true']);
    const res = engine(['session', 'label-config', 'false']);
    assert.deepStrictEqual(res, { ok: true, tmux_labels: false });
    assert.strictEqual(projectManifest().defaults.tmux_labels, false);
    assert.deepStrictEqual(settings(), LABELS_OFF, 'the workflows\' own hooks are no label preference');
    assert.deepStrictEqual({ state: head(stateGit), code: head(git) }, CHOICE);
  });

  it('declining on a project the hooks never reached still installs the workflows\' own hooks', () => {
    const res = engine(['session', 'label-config', 'false']);
    assert.deepStrictEqual(res, { ok: true, tmux_labels: false });
    assert.deepStrictEqual(settings(), LABELS_OFF);
    assert.deepStrictEqual({ state: head(stateGit), code: head(git) }, CHOICE);
  });

  it('re-recording the same choice is idempotent — no twin hook, nothing to commit', () => {
    engine(['session', 'label-config', 'true']);
    const before = [git(['rev-parse', 'HEAD']), stateGit(['rev-parse', 'HEAD'])];
    engine(['session', 'label-config', 'true']);
    assert.deepStrictEqual(settings(), LABELS_ON);
    assert.deepStrictEqual([git(['rev-parse', 'HEAD']), stateGit(['rev-parse', 'HEAD'])], before);
  });

  it('refuses to replace a project manifest that no longer parses', () => {
    const p = path.join(world.dir, '.leeway', 'manifest.json');
    fs.writeFileSync(p, '{not json', 'utf8');
    const err = engine(['session', 'label-config', 'true'], { expectFail: true });
    assert.match(err.error, /not valid JSON/);
    assert.strictEqual(fs.readFileSync(p, 'utf8'), '{not json');
    assert.ok(!fs.existsSync(settingsPath()), 'no hook lands for a choice that was not recorded');
  });

  it('a settings file that does not parse is left alone — the choice is recorded and the hooks reported', () => {
    writeSettings('{not json');
    const res = engine(['session', 'label-config', 'true']);
    assert.strictEqual(res.tmux_labels, true);
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /session hooks not synced: \.claude\/settings\.json is not valid JSON/);
    assert.strictEqual(fs.readFileSync(settingsPath(), 'utf8'), '{not json');
    assert.deepStrictEqual(head(stateGit), CHOICE.state);
    assert.deepStrictEqual(head(git), { subject: 'ignore the state', files: ['.gitignore'] }, 'no settings commit');
  });

  it('a code commit git refuses is a warning, never a failure — the hooks wait on disk, and the state commits beside it', () => {
    const hooksDir = path.join(world.dir, '.git', 'hooks');
    fs.mkdirSync(hooksDir, { recursive: true });
    fs.writeFileSync(path.join(hooksDir, 'pre-commit'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
    const res = engine(['session', 'label-config', 'true']);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.tmux_labels, true);
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /^commit failed, and the next boot tries again: /);
    assert.deepStrictEqual(projectManifest().defaults, { tmux_labels: true });
    assert.deepStrictEqual(settings(), LABELS_ON);
    assert.strictEqual(git(['log', '-1', '--pretty=%s']).trim(), 'ignore the state', 'nothing landed in the code tree');
    assert.match(git(['status', '--porcelain']), /\.claude\//, 'the settings wait, uncommitted');
    assert.deepStrictEqual(head(stateGit), CHOICE.state, 'the state\'s git runs no hook of the code tree\'s');
  });

  it('while git holds an operation open in the code tree, records the choice and says the hooks wait for the next boot — the settings file left alone', () => {
    fs.mkdirSync(path.join(world.dir, '.git', 'rebase-merge'));
    const res = engine(['session', 'label-config', 'true']);
    assert.strictEqual(res.tmux_labels, true);
    assert.deepStrictEqual(res.warnings, ['session hooks not written: a rebase is in progress in the code tree — the next boot writes them']);
    assert.deepStrictEqual(projectManifest().defaults, { tmux_labels: true });
    assert.ok(!fs.existsSync(settingsPath()), 'no settings write inside the rebase');
    assert.deepStrictEqual(head(stateGit), CHOICE.state);
  });

  it('LEEWAY_HOLD_PROJECT_SETTINGS=1 — the test harness\'s switch — records the choice and leaves the settings file alone', () => {
    const res = engine(['session', 'label-config', 'true'], { extraEnv: { LEEWAY_HOLD_PROJECT_SETTINGS: '1' } });
    assert.deepStrictEqual(res, { ok: true, tmux_labels: true });
    assert.deepStrictEqual(projectManifest().defaults, { tmux_labels: true });
    assert.ok(!fs.existsSync(settingsPath()), 'no settings write under the switch');
    assert.deepStrictEqual(head(stateGit), CHOICE.state);
    assert.deepStrictEqual(head(git), { subject: 'ignore the state', files: ['.gitignore'] }, 'no settings commit');
  });
});

describe('syncSessionHooks', () => {
  beforeEach(setup);
  afterEach(teardown);

  const BOTH = { session: true, workflows: true };
  const WORKFLOWS = { session: false, workflows: true };
  const NONE = { session: false, workflows: false };

  it('installs the labels-on set into an absent settings file — one group per matcher, the SessionStart group matched to resume, the layout, brief and shell groups under PreToolUse', () => {
    assert.deepStrictEqual(syncSessionHooks(world.dir, BOTH), { changed: true });
    assert.deepStrictEqual(settings(), LABELS_ON);
    assert.ok(fs.readFileSync(settingsPath(), 'utf8').endsWith('}\n'));
  });

  it('installs the workflows\' own alone while labels are off — no SessionStart event at all', () => {
    assert.deepStrictEqual(syncSessionHooks(world.dir, WORKFLOWS), { changed: true });
    assert.deepStrictEqual(settings(), LABELS_OFF);
  });

  it('installs beside everything already there — permissions, other events, foreign groups and their matchers on every event', () => {
    const theirs = { type: 'command', command: 'say goodbye' };
    writeSettings({
      permissions: { allow: ['Bash(ls)'] },
      hooks: {
        Stop: [{ hooks: [{ type: 'command', command: 'echo stop' }] }],
        SessionEnd: [{ matcher: 'clear', hooks: [theirs] }],
        SessionStart: [{ matcher: 'startup', hooks: [theirs] }],
        PreToolUse: [{ matcher: 'Write', hooks: [theirs] }],
      },
      showClearContextOnPlanAccept: true,
    });
    assert.deepStrictEqual(syncSessionHooks(world.dir, BOTH), { changed: true });
    assert.deepStrictEqual(settings(), {
      permissions: { allow: ['Bash(ls)'] },
      hooks: {
        Stop: [{ hooks: [{ type: 'command', command: 'echo stop' }] }],
        SessionEnd: [{ matcher: 'clear', hooks: [theirs] }, { hooks: [SESSION_HOOK, PRESENCE_HOOK, END_HOOK] }],
        SessionStart: [{ matcher: 'startup', hooks: [theirs] }, { matcher: 'resume', hooks: [RESUME_HOOK] }],
        PreToolUse: [{ matcher: 'Write', hooks: [theirs] }, ...GUARD_GROUPS],
      },
      showClearContextOnPlanAccept: true,
    });
  });

  it('settings holding the layout group alone gain the brief and shell groups — ours stripped and landed one group per matcher, every foreign group and its matcher kept, a foreign Bash group beside ours', () => {
    const theirs = { type: 'command', command: 'say goodbye' };
    writeSettings({
      hooks: {
        SessionEnd: [{ hooks: [PRESENCE_HOOK, END_HOOK] }],
        PreToolUse: [
          { matcher: 'Bash', hooks: [theirs] },
          { matcher: 'Write|Edit', hooks: [theirs, LAYOUT_GROUP.hooks[0]] },
          { matcher: 'Agent', hooks: [theirs] },
        ],
      },
    });
    assert.deepStrictEqual(syncSessionHooks(world.dir, WORKFLOWS), { changed: true });
    assert.deepStrictEqual(settings(), {
      hooks: {
        SessionEnd: [{ hooks: [PRESENCE_HOOK, END_HOOK] }],
        PreToolUse: [
          { matcher: 'Bash', hooks: [theirs] },
          { matcher: 'Write|Edit', hooks: [theirs] },
          { matcher: 'Agent', hooks: [theirs] },
          ...GUARD_GROUPS,
        ],
      },
    });
    assert.deepStrictEqual(syncSessionHooks(world.dir, WORKFLOWS), { changed: false });
  });

  it('a second sync changes nothing — the hooks are recognised by their command, whatever surrounds them', () => {
    syncSessionHooks(world.dir, BOTH);
    assert.deepStrictEqual(syncSessionHooks(world.dir, BOTH), { changed: false });
    assert.strictEqual(settings().hooks.SessionEnd.length, 1);
    assert.strictEqual(settings().hooks.SessionStart.length, 1);
    // Hand-adjusted copies — a different path prefix, a timeout, ours split
    // across groups, a foreign group added after ours, a widened matcher,
    // the PreToolUse groups swapped round a foreign one and ours sharing
    // foreign groups, the shell hook a foreign Bash group's — still make up
    // the wanted set, so nothing is rewritten, twinned or moved.
    writeSettings({
      hooks: {
        SessionEnd: [
          { hooks: [{ type: 'command', command: 'node "/abs/engine.cjs" session cleanup', timeout: 5 }] },
          { hooks: [END_HOOK, PRESENCE_HOOK] },
          { matcher: 'clear', hooks: [{ type: 'command', command: 'say goodbye' }] },
        ],
        SessionStart: [
          { matcher: 'startup|resume', hooks: [{ type: 'command', command: 'node "/abs/engine.cjs" session resume' }] },
        ],
        PreToolUse: [
          { matcher: 'SendMessage|Agent', hooks: [{ type: 'command', command: 'node "/abs/engine.cjs" brief guard', timeout: 5 }] },
          { matcher: 'Bash', hooks: [{ type: 'command', command: 'say goodbye' }, { type: 'command', command: 'node "/abs/engine.cjs" shell guard', timeout: 5 }] },
          { matcher: 'Edit|Write|NotebookEdit|Bash', hooks: [{ type: 'command', command: 'echo first' }, { type: 'command', command: 'node "/abs/engine.cjs" layout guard', timeout: 5 }] },
        ],
      },
    });
    const text = fs.readFileSync(settingsPath(), 'utf8');
    assert.deepStrictEqual(syncSessionHooks(world.dir, BOTH), { changed: false });
    assert.strictEqual(fs.readFileSync(settingsPath(), 'utf8'), text, 'no reorder, no rewrite');
  });

  it('the mark is the exact `engine.cjs" <verb>` form — a re-quoted command is not recognised', () => {
    writeSettings({ hooks: { SessionEnd: [{ hooks: [{ type: 'command', command: "node '$CLAUDE_PROJECT_DIR/.claude/skills/leeway-engine/scripts/engine.cjs' presence cleanup" }] }] } });
    assert.deepStrictEqual(syncSessionHooks(world.dir, WORKFLOWS), { changed: true });
    assert.strictEqual(settings().hooks.SessionEnd.length, 2, 'the re-quoted copy reads as foreign and ours lands beside it');
  });

  it('turning labels off takes `session cleanup` and `session resume` out — the emptied SessionStart event with them — and leaves the workflows\' own; nothing wanted empties the file', () => {
    syncSessionHooks(world.dir, BOTH);
    assert.deepStrictEqual(syncSessionHooks(world.dir, WORKFLOWS), { changed: true });
    assert.deepStrictEqual(settings(), LABELS_OFF);
    assert.deepStrictEqual(syncSessionHooks(world.dir, NONE), { changed: true });
    assert.deepStrictEqual(settings(), {}, 'the hook, its group, the event, and the emptied hooks object all go');
    assert.deepStrictEqual(syncSessionHooks(world.dir, NONE), { changed: false });
  });

  it('strips ours alone from a shared group and leaves sibling groups, events, matchers, and keys standing — on both events', () => {
    const theirs = { type: 'command', command: 'say goodbye' };
    writeSettings({
      permissions: { allow: ['Bash(ls)'] },
      hooks: {
        Stop: [{ hooks: [{ type: 'command', command: 'echo stop' }] }],
        SessionEnd: [{ hooks: [theirs, SESSION_HOOK, PRESENCE_HOOK, END_HOOK] }, { matcher: 'clear', hooks: [theirs] }],
        SessionStart: [{ matcher: 'startup|resume', hooks: [theirs, RESUME_HOOK] }],
      },
    });
    assert.deepStrictEqual(syncSessionHooks(world.dir, NONE), { changed: true });
    assert.deepStrictEqual(settings(), {
      permissions: { allow: ['Bash(ls)'] },
      hooks: {
        Stop: [{ hooks: [{ type: 'command', command: 'echo stop' }] }],
        SessionEnd: [{ hooks: [theirs] }, { matcher: 'clear', hooks: [theirs] }],
        SessionStart: [{ matcher: 'startup|resume', hooks: [theirs] }],
      },
    });
  });

  it('a shared group keeps its matcher when ours come out of it', () => {
    const theirs = { type: 'command', command: 'say goodbye' };
    writeSettings({ hooks: { SessionEnd: [{ matcher: 'clear', hooks: [theirs, SESSION_HOOK] }] } });
    assert.deepStrictEqual(syncSessionHooks(world.dir, NONE), { changed: true });
    assert.deepStrictEqual(settings(), { hooks: { SessionEnd: [{ matcher: 'clear', hooks: [theirs] }] } });
  });

  it('collapses twins into the one wanted group per event', () => {
    writeSettings({
      hooks: {
        SessionEnd: [{ hooks: [SESSION_HOOK] }, { hooks: [SESSION_HOOK] }],
        SessionStart: [{ matcher: 'resume', hooks: [RESUME_HOOK] }, { matcher: 'resume', hooks: [RESUME_HOOK] }],
      },
    });
    assert.deepStrictEqual(syncSessionHooks(world.dir, BOTH), { changed: true });
    assert.deepStrictEqual(settings(), LABELS_ON);
  });

  it('reconciles the two events independently — a missing SessionStart group lands while a recognised SessionEnd group is left as it was', () => {
    const hand = { hooks: [{ type: 'command', command: 'node "/abs/engine.cjs" session cleanup', timeout: 5 }, PRESENCE_HOOK, END_HOOK] };
    writeSettings({ hooks: { SessionEnd: [hand], PreToolUse: GUARD_GROUPS } });
    assert.deepStrictEqual(syncSessionHooks(world.dir, BOTH), { changed: true });
    assert.deepStrictEqual(settings(), { hooks: { SessionEnd: [hand], PreToolUse: GUARD_GROUPS, SessionStart: [{ matcher: 'resume', hooks: [RESUME_HOOK] }] } });
  });

  it('a hook of ours is ours under any event — a resume hook misplaced under SessionEnd moves to SessionStart', () => {
    writeSettings({ hooks: { SessionEnd: [{ hooks: [SESSION_HOOK, PRESENCE_HOOK, RESUME_HOOK] }] } });
    assert.deepStrictEqual(syncSessionHooks(world.dir, BOTH), { changed: true });
    assert.deepStrictEqual(settings(), LABELS_ON);
  });

  it('nothing to remove is nothing changed — an absent file stays absent', () => {
    assert.deepStrictEqual(syncSessionHooks(world.dir, NONE), { changed: false });
    assert.ok(!fs.existsSync(settingsPath()));
  });

  it('a settings file that does not parse is left untouched and reported, never thrown', () => {
    writeSettings('{not json');
    for (const want of [BOTH, NONE]) {
      const res = syncSessionHooks(world.dir, want);
      assert.strictEqual(res.changed, false);
      assert.match(res.error, /\.claude\/settings\.json is not valid JSON/);
    }
    writeSettings('[]');
    assert.match(syncSessionHooks(world.dir, BOTH).error, /root is not an object/);
    assert.strictEqual(fs.readFileSync(settingsPath(), 'utf8'), '[]');
  });
});
