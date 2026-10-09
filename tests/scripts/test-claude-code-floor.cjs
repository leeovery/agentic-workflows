'use strict';

// The oldest Claude Code the workflows run on is one value wherever it is
// written: the engine's, the gate mod's, and the stop workflow-start puts
// to an older Claude Code.

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { MIN_VERSION } = require('../../skills/workflow-engine/scripts/domain/gate-surface.cjs');

const ROOT = path.join(__dirname, '..', '..');

describe('the Claude Code floor', () => {
  const floor = MIN_VERSION.join('.');

  it("is the gate mod's own", () => {
    const source = fs.readFileSync(path.join(ROOT, 'skills/workflow-gates/hooks/register.ts'), 'utf8');
    const oldest = /const OLDEST = \[(\d+), (\d+), (\d+)\]/.exec(source);
    assert.ok(oldest, 'the mod names its oldest Claude Code as OLDEST');
    assert.strictEqual(oldest.slice(1).join('.'), floor);
  });

  it("is the version workflow-start's stop names to an older Claude Code", () => {
    const setup = fs.readFileSync(path.join(ROOT, 'skills/workflow-start/references/claude-code-setup.md'), 'utf8');
    const branch = setup.split('#### If `gate_surface` is `outdated`')[1]?.split('\n####')[0];
    assert.ok(branch, 'the Claude Code setup has its outdated branch');
    const named = /Claude Code (\d+\.\d+\.\d+) or newer/.exec(branch);
    assert.ok(named, 'the outdated stop names the version it needs');
    assert.strictEqual(named[1], floor);
  });
});
