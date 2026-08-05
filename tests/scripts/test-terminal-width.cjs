'use strict';

// Contract suite for kernel/terminal.cjs — the display-width resolver.
//
// Detection reads the reader's real terminal, which a test cannot depend on,
// so every case here drives the parts that ARE deterministic: the override,
// the clamps, the fallback, the memo, and the device reader's behaviour on
// devices that do and do not exist.

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MODULE = require.resolve('../../skills/workflow-engine/scripts/kernel/terminal.cjs');

/** Fresh module instance with a scripted environment. */
function loadWith(env) {
  delete require.cache[MODULE];
  const saved = {};
  for (const key of ['WORKFLOWS_DISPLAY_WIDTH', 'CLAUDE_PID', 'TMUX', 'TMUX_PANE']) {
    saved[key] = process.env[key];
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  const mod = require(MODULE);
  return { mod, restore() {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    delete require.cache[MODULE];
  } };
}

// No CLAUDE_PID, no tmux, and a ppid chain that cannot reach a tty in a
// spawned test runner — the "nothing answers" environment.
const BLIND = { WORKFLOWS_DISPLAY_WIDTH: undefined, CLAUDE_PID: undefined, TMUX: undefined, TMUX_PANE: undefined };

describe('terminal width — override', () => {
  it('takes an explicit override verbatim', () => {
    const { mod, restore } = loadWith({ ...BLIND, WORKFLOWS_DISPLAY_WIDTH: '90' });
    assert.equal(mod.resolveDisplayWidth(), 90);
    restore();
  });

  it('clamps an override above the cap', () => {
    const { mod, restore } = loadWith({ ...BLIND, WORKFLOWS_DISPLAY_WIDTH: '400' });
    assert.equal(mod.resolveDisplayWidth(), mod.CAP);
    restore();
  });

  it('clamps an override below the floor', () => {
    const { mod, restore } = loadWith({ ...BLIND, WORKFLOWS_DISPLAY_WIDTH: '5' });
    assert.equal(mod.resolveDisplayWidth(), mod.MIN);
    restore();
  });

  it('ignores a non-numeric override and falls through', () => {
    const { mod, restore } = loadWith({ ...BLIND, WORKFLOWS_DISPLAY_WIDTH: 'wide' });
    const resolved = mod.resolveDisplayWidth();
    assert.ok(resolved >= mod.MIN && resolved <= mod.CAP, `resolved ${resolved} out of range`);
    restore();
  });

  it('ignores a zero or negative override', () => {
    for (const bad of ['0', '-20']) {
      const { mod, restore } = loadWith({ ...BLIND, WORKFLOWS_DISPLAY_WIDTH: bad });
      const resolved = mod.resolveDisplayWidth();
      assert.ok(resolved >= mod.MIN, `override ${bad} should not win`);
      restore();
    }
  });
});

describe('terminal width — no answer', () => {
  it('falls back to the width that shipped before detection', () => {
    const { mod, restore } = loadWith(BLIND);
    // detectColumns may still find a tty when the suite runs attached to one;
    // the contract is only that a blind environment lands on the fallback.
    if (mod.detectColumns() === null) {
      assert.equal(mod.resolveDisplayWidth(), mod.FALLBACK);
    }
    restore();
  });

  it('a bogus CLAUDE_PID does not throw', () => {
    const { mod, restore } = loadWith({ ...BLIND, CLAUDE_PID: '999999999' });
    assert.doesNotThrow(() => mod.resolveDisplayWidth());
    restore();
  });

  it('a non-numeric CLAUDE_PID does not throw', () => {
    const { mod, restore } = loadWith({ ...BLIND, CLAUDE_PID: 'not-a-pid' });
    assert.doesNotThrow(() => mod.resolveDisplayWidth());
    restore();
  });
});

describe('terminal width — device reader', () => {
  let dir;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'width-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('returns null for a device that does not exist', () => {
    const { mod, restore } = loadWith(BLIND);
    assert.equal(mod.columnsOfDevice('/dev/definitely-not-a-tty'), null);
    restore();
  });

  it('returns null for a regular file rather than throwing', () => {
    const { mod, restore } = loadWith(BLIND);
    const file = path.join(dir, 'plain.txt');
    fs.writeFileSync(file, 'not a terminal');
    assert.equal(mod.columnsOfDevice(file), null);
    restore();
  });

  it('leaks no file descriptors across repeated failed reads', () => {
    const { mod, restore } = loadWith(BLIND);
    const before = fs.readdirSync('/dev/fd').length;
    for (let i = 0; i < 50; i += 1) mod.columnsOfDevice('/dev/definitely-not-a-tty');
    const after = fs.readdirSync('/dev/fd').length;
    assert.ok(after <= before + 2, `fd count grew from ${before} to ${after}`);
    restore();
  });
});

describe('terminal width — memo', () => {
  it('resolves once and reuses the answer', () => {
    const { mod, restore } = loadWith({ ...BLIND, WORKFLOWS_DISPLAY_WIDTH: '80' });
    assert.equal(mod.displayWidth(), 80);
    process.env.WORKFLOWS_DISPLAY_WIDTH = '100';
    assert.equal(mod.displayWidth(), 80, 'memo should not re-read the environment');
    restore();
  });

  it('re-resolves after a reset', () => {
    const { mod, restore } = loadWith({ ...BLIND, WORKFLOWS_DISPLAY_WIDTH: '80' });
    assert.equal(mod.displayWidth(), 80);
    process.env.WORKFLOWS_DISPLAY_WIDTH = '100';
    mod.resetDisplayWidth();
    assert.equal(mod.displayWidth(), 100);
    restore();
  });
});

describe('terminal width — consumers', () => {
  it('trees wrap to the resolved width', () => {
    const { restore } = loadWith({ ...BLIND, WORKFLOWS_DISPLAY_WIDTH: '100' });
    const renderPath = require.resolve('../../skills/workflow-engine/scripts/kernel/render.cjs');
    delete require.cache[renderPath];
    const { renderTree } = require(renderPath);
    const long = 'word '.repeat(60).trim();
    const out = renderTree([{ title: 'Node', body: [long] }]);
    for (const line of out.split('\n')) {
      assert.ok(line.length <= 100, `line of ${line.length} exceeds the resolved width`);
    }
    assert.ok(out.split('\n').some((l) => l.length > 70), 'body should use the wider budget');
    delete require.cache[renderPath];
    restore();
  });

  it('a narrower resolved width produces narrower trees', () => {
    const { restore } = loadWith({ ...BLIND, WORKFLOWS_DISPLAY_WIDTH: '50' });
    const renderPath = require.resolve('../../skills/workflow-engine/scripts/kernel/render.cjs');
    delete require.cache[renderPath];
    const { renderTree } = require(renderPath);
    const long = 'word '.repeat(60).trim();
    const out = renderTree([{ title: 'Node', body: [long] }]);
    for (const line of out.split('\n')) {
      assert.ok(line.length <= 50, `line of ${line.length} exceeds the resolved width`);
    }
    delete require.cache[renderPath];
    restore();
  });
});
