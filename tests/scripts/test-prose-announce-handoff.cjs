'use strict';

// Every command a walker runs in a world announces the handoff stand-in, so
// the engine answers a handoff `mod`, the stand-in takes it as the mod does —
// its HANDOFF section cut from the result — and the walk ends at the recorded
// call rather than running on into the next skill. Two failures matter: a
// walker's world command left unannounced, and an announcement reaching a
// command that is not a walker's in a world — the orchestrator's, or one
// run anywhere else.

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { ANNOUNCEMENT, announced, unannounced } = require('../prose/lib/announce-handoff.cjs');
const { ENGINE } = require('../prose/lib/worlds.cjs');

const HOOK = path.join(__dirname, '..', 'prose', 'lib', 'announce-handoff.cjs');

let world;

/** Feed the hook a payload exactly as the harness would, on stdin. */
function fire(payload) {
  const r = spawnSync('node', [HOOK], { input: JSON.stringify(payload), encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  return r.stdout.trim() ? JSON.parse(r.stdout) : null;
}

/** A walker's Bash call, in the shape Claude Code hands a PreToolUse hook. */
function bash(command, extra = {}) {
  return {
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    agent_type: 'prose-walker',
    cwd: os.tmpdir(),
    tool_input: { command, description: 'Run the engine' },
    ...extra,
  };
}

beforeEach(() => {
  world = fs.mkdtempSync(path.join(os.tmpdir(), 'prose-world-'));
});

afterEach(() => {
  fs.rmSync(world, { recursive: true, force: true });
});

describe('prose handoff announcement', () => {
  it('announces the handoff on a walker command run in a world, keeping the rest of the input', () => {
    const command = `cd ${world} && node .claude/skills/workflow-engine/scripts/engine.cjs manifest get pay status`;
    const out = fire(bash(command));
    assert.deepStrictEqual(out, {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        updatedInput: { command: `${ANNOUNCEMENT}${command}`, description: 'Run the engine' },
      },
    });
  });

  it('takes a handoff call as the mod does — its output through the cut', () => {
    const command = `cd ${world} && node .claude/skills/workflow-engine/scripts/engine.cjs handoff workflow-review-process feature pay`;
    const out = fire(bash(command)).hookSpecificOutput.updatedInput.command;
    assert.strictEqual(out, announced(command));
    assert.notStrictEqual(out, `${ANNOUNCEMENT}${command}`, 'a handoff call is more than announced');
  });

  it('finds the world in the working directory when the command names none', () => {
    const out = fire(bash('git status', { cwd: world }));
    assert.strictEqual(out.hookSpecificOutput.updatedInput.command, `${ANNOUNCEMENT}git status`);
  });

  it('decides nothing about permission — the command still meets its prompt', () => {
    const out = fire(bash(`cd ${world} && ls`));
    assert.ok(!('permissionDecision' in out.hookSpecificOutput));
  });

  it('leaves a command run outside any world alone', () => {
    assert.strictEqual(fire(bash('ls /tmp')), null);
  });

  it('leaves the orchestrator\'s commands alone, though they name the world', () => {
    assert.strictEqual(fire(bash(`node tests/prose/run.cjs diff case --world ${world}`, { agent_type: 'prose-orchestrator' })), null);
  });

  it('leaves every tool but Bash alone', () => {
    assert.strictEqual(fire(bash(`cat ${world}/x`, { tool_name: 'Read' })), null);
  });

  it('never announces a command twice', () => {
    assert.strictEqual(fire(bash(`${ANNOUNCEMENT}cd ${world} && ls`)), null);
  });

  it('survives a payload it cannot read', () => {
    const r = spawnSync('node', [HOOK], { input: 'not json', encoding: 'utf8' });
    assert.strictEqual(r.status, 0);
    assert.strictEqual(r.stdout, '');
  });

  it('gives the engine the announcement it answers `mod` to, and cuts the HANDOFF section from what comes back', () => {
    fs.mkdirSync(path.join(world, '.workflows'));
    const out = fire(bash(`cd ${world} && node ${ENGINE} handoff workflow-baseline && echo after`));
    // The walker's commands run in the developer's shell — bash or zsh.
    const shells = ['bash', 'zsh'].filter((shell) => spawnSync(shell, ['-c', 'true']).status === 0);
    for (const shell of shells) {
      const run = spawnSync(shell, ['-c', out.hookSpecificOutput.updatedInput.command], { encoding: 'utf8' });
      assert.strictEqual(run.status, 0, `${shell}: ${run.stderr}`);
      assert.match(run.stdout, /^handoff: mod$/m);
      assert.match(run.stdout, /^=== DISPLAY: handoff .*\n→ Baseline$/m);
      assert.ok(!run.stdout.includes('=== HANDOFF'), `${shell}: the section is cut`);
      assert.ok(!run.stdout.includes('"skill"'), `${shell}: its payload with it`);
      assert.match(run.stdout, /^after$/m, `${shell}: what follows the section stands`);
    }
  });

  it('keeps a refused handoff\'s exit status and its error through the cut', () => {
    fs.mkdirSync(path.join(world, '.workflows'));
    const out = fire(bash(`cd ${world} && node ${ENGINE} handoff workflow-nowhere`));
    const run = spawnSync('bash', ['-c', out.hookSpecificOutput.updatedInput.command], { encoding: 'utf8' });
    assert.strictEqual(run.status, 1);
    assert.match(run.stderr, /workflow-nowhere\\" is not a handoff target/);
  });

  it('takes the stand-in off for the record, and nothing else', () => {
    const handoff = 'cd x && node engine.cjs handoff workflow-baseline';
    assert.strictEqual(unannounced(`${ANNOUNCEMENT}cd x && ls`), 'cd x && ls');
    assert.strictEqual(unannounced(announced(handoff)), handoff);
    assert.strictEqual(unannounced('cd x && ls'), 'cd x && ls');
  });
});
