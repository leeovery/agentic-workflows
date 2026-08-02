'use strict';

//
// Tests for the presence heartbeat: beat / clear / scan, liveness aging,
// and the engine-rendered deferral section.
//

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ENGINE = path.join(__dirname, '../../skills/workflow-engine/scripts/engine.cjs');

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-presence-'));
  fs.mkdirSync(path.join(dir, '.workflows', 'pay'), { recursive: true });
  return dir;
}
function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
function engine(dir, args) {
  const out = execFileSync('node', [ENGINE, ...args], { cwd: dir, encoding: 'utf8' });
  const nl = out.indexOf('\n');
  return { res: JSON.parse((nl === -1 ? out : out.slice(0, nl)).trim()), sections: nl === -1 ? '' : out.slice(nl + 1) };
}
function engineFails(dir, args) {
  const r = spawnSync('node', [ENGINE, ...args], { cwd: dir, encoding: 'utf8' });
  assert.strictEqual(r.status, 1);
  return JSON.parse(r.stderr.trim());
}

describe('engine presence', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { cleanup(dir); });

  it('beat creates the heartbeat; scan reports it live with the deferral section', () => {
    const beat = engine(dir, ['presence', 'beat', 'pay', 'discussion', 'alpha']).res;
    assert.deepStrictEqual(beat, { ok: true, work_unit: 'pay', phase: 'discussion', topic: 'alpha', beat: true });
    assert.ok(fs.existsSync(path.join(dir, '.workflows/.cache/pay/discussion/alpha/presence')));

    const { res, sections } = engine(dir, ['presence', 'scan', 'pay']);
    assert.strictEqual(res.live, 1);
    assert.strictEqual(res.stale_after_seconds, 900);
    assert.strictEqual(res.sessions[0].phase, 'discussion');
    assert.strictEqual(res.sessions[0].topic, 'alpha');
    assert.strictEqual(res.sessions[0].live, true);
    assert.ok(sections.includes('DISPLAY: presence deferral'), 'deferral section rides a live scan');
    assert.ok(sections.includes('discussion/alpha'));
  });

  it('an aged heartbeat reads stale — no deferral section', () => {
    engine(dir, ['presence', 'beat', 'pay', 'research', 'beta']);
    const p = path.join(dir, '.workflows/.cache/pay/research/beta/presence');
    const past = new Date(Date.now() - 20 * 60 * 1000);
    fs.utimesSync(p, past, past);

    const { res, sections } = engine(dir, ['presence', 'scan', 'pay']);
    assert.strictEqual(res.live, 0);
    assert.strictEqual(res.sessions[0].live, false);
    assert.ok(res.sessions[0].age_seconds >= 1100);
    assert.strictEqual(sections, '', 'nothing live, nothing rendered');
  });

  it('clear drops the heartbeat and is a no-op when never set', () => {
    engine(dir, ['presence', 'beat', 'pay', 'discussion', 'alpha']);
    const cleared = engine(dir, ['presence', 'clear', 'pay', 'discussion', 'alpha']).res;
    assert.strictEqual(cleared.cleared, true);
    assert.strictEqual(engine(dir, ['presence', 'scan', 'pay']).res.sessions.length, 0);
    assert.strictEqual(engine(dir, ['presence', 'clear', 'pay', 'discussion', 'alpha']).res.cleared, true);
  });

  it('refuses illegal phases, unknown work units, and malformed calls', () => {
    assert.match(engineFails(dir, ['presence', 'beat', 'pay', 'planning', 'x']).error, /research\|discussion only/);
    assert.match(engineFails(dir, ['presence', 'scan', 'ghost']).error, /no work unit directory/);
    assert.match(engineFails(dir, ['presence', 'beat', 'pay', 'discussion']).error, /Usage/);
    assert.match(engineFails(dir, ['presence', 'bogus']).error, /Usage/);
  });
});
