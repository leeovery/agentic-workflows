'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's own oracle over the ledger: audited once per
// state it reads, afresh when any read changes, a stale copy failing.
//
// Layer: simulation. World: the project every scenario starts from
// (pipeline-world.cjs), a copy per scenario; each replays the engine calls
// the skill prose makes, in prose order, and the oracle
// (pipeline-oracle.cjs) audits the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '../..');
const { statePath } = require(path.join(ROOT, 'skills/leeway-engine/scripts/kernel/state-root.cjs'));
const { startItem } = require('./engine-harness.cjs');
const { Sim, mappedEpic } = require('./pipeline-world.cjs');
const { auditState, ledgerAuditsOf } = require('./pipeline-oracle.cjs');

describe('pipeline simulation: the oracle\'s ledger audit', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('the oracle audits the ledger once per state it reads: a step that leaves every read as it was passes as it was, and a step that changes any of them — a copy, not the ledger or a manifest — is audited afresh, a stale copy failing', () => {
    const wu = 'fumi';
    mappedEpic(sim, wu, ['note-window']);
    startItem(sim.dir, wu, 'discussion', 'note-window');
    sim.run(['ledger', 'ask', `${wu}.discussion.note-window`], null, JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'What does the note window cover?' }));
    const before = ledgerAuditsOf(sim.dir);
    sim.run(['presence', 'beat', wu, 'discussion', 'note-window']);
    assert.deepStrictEqual(ledgerAuditsOf(sim.dir), { full: before.full, passed: before.passed + 1 }, 'a beat touches nothing the ledger audit reads');

    const copy = statePath(sim.dir, '.knowledge', 'records', wu, 'note-window.md');
    const kept = fs.readFileSync(copy, 'utf8');
    fs.writeFileSync(copy, '# A stale copy\n');
    assert.throws(() => auditState(sim.dir, 'a stale copy'), /does not name every entry its record shows/);
    assert.strictEqual(ledgerAuditsOf(sim.dir).full, before.full + 1, 'the changed copy is audited afresh');
    fs.writeFileSync(copy, kept);
    auditState(sim.dir, 'the copy restored');
    assert.deepStrictEqual(ledgerAuditsOf(sim.dir), { full: before.full + 1, passed: before.passed + 2 }, 'the copy restored is the state last audited');
  });
});
