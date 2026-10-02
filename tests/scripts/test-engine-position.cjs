'use strict';

//
// Tests for the conversation's position (domain/position.cjs): what every
// arrival records in the conversation's folder, labels on or off — a phase,
// a work unit's menu, the project-level places — only for a conversation
// the engine has marked and only a place this project has; the task `task
// start` adds and its `task complete` takes off; and the start menu's
// repair dropping it.
//

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const harness = require('./engine-harness.cjs');

let dir; // a workflows project
let config; // this test's system config directory

/** The engine as the conversation `sessionId` runs it — null runs it with no id. */
function env(sessionId = 'sess-1') {
  return { WORKFLOWS_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: sessionId ?? undefined, TMUX: undefined, TMUX_PANE: undefined };
}

/** A call that must succeed, its response line parsed. */
function ok(args, sessionId) {
  return harness.ok(dir, args, { env: env(sessionId) });
}

/** The conversation's folder. */
function folder(sessionId = 'sess-1') {
  return path.join(config, 'conversations', sessionId);
}

/** The position recorded for a conversation, or null. */
function position(sessionId = 'sess-1') {
  try { return JSON.parse(fs.readFileSync(path.join(folder(sessionId), 'position.json'), 'utf8')); } catch { return null; }
}

/** Hand-write a position, its conversation marked. */
function writePosition(record, sessionId = 'sess-1') {
  fs.mkdirSync(folder(sessionId), { recursive: true });
  fs.writeFileSync(path.join(folder(sessionId), 'workflow'), '');
  fs.writeFileSync(path.join(folder(sessionId), 'position.json'), JSON.stringify(record));
}

/** Mark a conversation as the engine does: any call it makes in the project. */
function mark(sessionId = 'sess-1') {
  harness.output(dir, ['manifest', 'exists', 'pay'], { env: env(sessionId) });
}

/** A file in the project, its directory made. */
function write(rel, content = '# content\n') {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), content);
  return rel;
}

/** A work unit's manifest, its `phases` given. */
function workUnit(name, workType, phases = {}, extra = {}) {
  write(`.workflows/${name}/manifest.json`, JSON.stringify({ name, work_type: workType, status: 'in-progress', phases, ...extra }, null, 2));
}

beforeEach(() => {
  dir = harness.setupGitFixture('engine-position-');
  config = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-position-config-'));
  workUnit('pay', 'epic', {
    implementation: { items: { ledger: { status: 'in-progress', current_task: null, fix_attempts: 0 } } },
    planning: { items: { ledger: { status: 'completed', format: 'flat-files' } } },
  });
  mark();
});

afterEach(() => {
  for (const d of [dir, config]) fs.rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe('the position every arrival records', () => {
  it('records each place the label calls name, labels off — a phase, a work unit, the project-level places', () => {
    ok(['session', 'label', 'pay', 'discussion', 'ledger']);
    assert.deepStrictEqual(position(), { name: 'pay', phase: 'discussion', topic: 'ledger' });
    ok(['session', 'label', 'pay']);
    assert.deepStrictEqual(position(), { name: 'pay' });
    for (const name of ['roadmap', 'baseline']) {
      ok(['session', 'label', name]);
      assert.deepStrictEqual(position(), { name });
    }
  });

  it('records only for a conversation the engine has marked — the first call marks it after it runs, and no id records nothing', () => {
    ok(['session', 'label', 'pay', 'discussion', 'ledger'], 'sess-new');
    assert.strictEqual(position('sess-new'), null, 'never creating the folder');
    ok(['session', 'label', 'pay', 'discussion', 'ledger'], 'sess-new');
    assert.deepStrictEqual(position('sess-new'), { name: 'pay', phase: 'discussion', topic: 'ledger' });
    ok(['session', 'label', 'pay', 'review', 'ledger'], null);
    assert.deepStrictEqual(position('sess-new'), { name: 'pay', phase: 'discussion', topic: 'ledger' });
  });

  it('records no place this project lacks, keeping the last one — a missing work unit, an unknown phase, an identity with a phase', () => {
    ok(['session', 'label', 'pay', 'discussion', 'ledger']);
    ok(['session', 'label', 'ghost']);
    ok(['session', 'label', 'pay', 'deploying', 'ledger']);
    ok(['session', 'label', 'ghost', 'discussion', 'ledger']);
    ok(['session', 'label', 'roadmap', 'discovery', 'roadmap']);
    ok(['session', 'label', 'pay', 'discussion', 'led.ger']);
    assert.deepStrictEqual(position(), { name: 'pay', phase: 'discussion', topic: 'ledger' });
  });

  it('task start adds the task in flight; that task\'s complete takes it off, another\'s leaves it', () => {
    ok(['session', 'label', 'pay', 'implementation', 'ledger']);
    ok(['task', 'start', 'pay', 'ledger', 'ledger-2-3']);
    assert.deepStrictEqual(position(), { name: 'pay', phase: 'implementation', topic: 'ledger', task: '2.3' });
    ok(['task', 'complete', 'pay', 'ledger', 'ledger-1-1']);
    assert.strictEqual(position().task, '2.3', 'an out-of-band completion of another task');
    ok(['task', 'complete', 'pay', 'ledger', 'ledger-2-3', '--next-task', '~']);
    assert.deepStrictEqual(position(), { name: 'pay', phase: 'implementation', topic: 'ledger' });
  });

  it('a re-label of the same implementation keeps the task; arriving anywhere else leaves none behind', () => {
    ok(['session', 'label', 'pay', 'implementation', 'ledger']);
    ok(['task', 'start', 'pay', 'ledger', 'ledger-2-3']);
    ok(['session', 'label', 'pay', 'implementation', 'ledger']);
    assert.strictEqual(position().task, '2.3');
    ok(['session', 'label', 'pay']);
    assert.deepStrictEqual(position(), { name: 'pay' });
    ok(['session', 'label', 'pay', 'implementation', 'ledger']);
    assert.deepStrictEqual(position(), { name: 'pay', phase: 'implementation', topic: 'ledger' }, 'no task until task start');
  });

  it('task start writes the whole position — the conversation is in that implementation, on that task', () => {
    ok(['session', 'label', 'pay', 'discussion', 'ledger']);
    ok(['task', 'start', 'pay', 'ledger', 'ledger-1-4']);
    assert.deepStrictEqual(position(), { name: 'pay', phase: 'implementation', topic: 'ledger', task: '1.4' });
  });

  it('the start menu is no position: repair takes the calling conversation\'s own off, labels off, and leaves another\'s', () => {
    writePosition({ name: 'pay' }, 'sess-2');
    ok(['session', 'label', 'pay', 'discussion', 'ledger']);
    assert.deepStrictEqual(ok(['session', 'repair']), { ok: true, repaired: false });
    assert.strictEqual(position(), null);
    assert.deepStrictEqual(position('sess-2'), { name: 'pay' });
  });

  it('a position that cannot be written never fails the verb', () => {
    fs.mkdirSync(path.join(folder(), 'position.json'));
    assert.deepStrictEqual(ok(['session', 'label', 'pay', 'discussion', 'ledger']), { ok: true, labelled: false, reason: 'disabled' });
    assert.strictEqual(ok(['task', 'start', 'pay', 'ledger', 'ledger-2-3']).task, 'ledger-2-3');
  });
});
