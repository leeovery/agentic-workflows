'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's cross-cutting scenario: the discussion to
// specification hop handing straight on, with nothing to revisit.
//
// Layer: simulation. World: the project every scenario starts from
// (pipeline-world.cjs), a copy per scenario; each replays the engine calls
// the skill prose makes, in prose order, and the oracle
// (pipeline-oracle.cjs) audits the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const ROOT = path.join(__dirname, '../..');
const BRIDGE = require(path.join(ROOT, 'skills/leeway-bridge/scripts/gateway.cjs'));
const { Sim, sessionLog, handoff, discussed, bridgeTo, linearPick, startNew } = require('./pipeline-world.cjs');

describe('pipeline simulation: cross-cutting', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('cross-cutting: the discussion→specification hop hands straight on, with nothing to revisit', () => {
    const wu = 'error-shape';
    startNew(sim, 'cross-cutting');
    sim.run(['workunit', 'create', wu, 'cross-cutting', '--description', 'One error envelope', '--session-log-file', sessionLog(sim, wu)]);
    // Cross-cutting goes to its discussion first, as a feature does.
    handoff(sim, `/leeway-discussion-process cross-cutting ${wu}`);
    assert.deepStrictEqual(discussed(sim, wu, wu).next, { kind: 'handoff', skill: 'leeway-specification-process', args: ['cross-cutting', wu] });
    // The decided discussion is no revisit — it reopens by a message — and
    // the pipeline ends at specification, so the bridge offers nothing.
    assert.match(BRIDGE.format(BRIDGE.discover(sim.dir, wu)), /^revisitable_phases: \(none\)$/m);
    // A session that stops here resumes from the cross-cutting continue menu,
    // which hands off where the bridge does.
    assert.strictEqual(linearPick(sim, wu, 'continue').line, `→ Specification · ${wu}`);
    bridgeTo(sim, wu, 'specification');
  });
});
