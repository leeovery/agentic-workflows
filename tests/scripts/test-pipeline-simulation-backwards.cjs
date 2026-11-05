'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's backwards walk: a feature's discussion closed
// into its spec, which the bridge offers no revisit into, its close voided
// by a message sent to it while its spec is entered but not yet written, and
// closed again; past its spec no message reaches it, the spec is never
// reopened, and the build's places stand by its cut, reopened by no topic
// verb.
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
const { Sim, startUnit, discussed, arrive, send, sendArgv, specEntry, specToBuild } = require('./pipeline-world.cjs');

describe('pipeline simulation: backwards', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('backwards: a discussion closed into its spec is never revisited — a message voids its close, the spec waiting until it closes again; past its spec, nothing reaches it', () => {
    const wu = 'revisit';
    startUnit(sim, 'feature', wu, 'Revisit flow');
    discussed(sim, wu, wu);

    // The bridge offers no way back into the closed discussion: no revisit
    // row, no revisit menu, and topic reopen does not take it.
    arrive(sim, wu);
    const dump = BRIDGE.format(BRIDGE.discover(sim.dir, wu));
    assert.match(dump, /^revisitable_phases: \(none\)$/m);
    assert.match(dump, /^revisit_routes: \(none\)$/m);
    sim.render(['next-phase-gate', wu, '--prev', 'discussion', '--next', 'specification'], { expect: 'empty' });
    sim.refuses(['render', 'revisit-phases', wu], /has no completed earlier phase to revisit/);
    sim.refuses(['topic', 'reopen', wu, 'discussion', wu], /^a decided discussion reopens through a message sent to it/);

    // A message voids the close once the spec is entered and before it is
    // written: the spec waits for the topic again, and takes it once closed
    // again.
    specEntry(sim, wu, [wu]);
    send(sim, wu, wu, wu, 'a-first-gap');
    assert.strictEqual(sim.manifest(wu).phases.discussion.items[wu].status, 'in-progress');
    sim.refuses(['enter', 'specification', wu], /^revisit's spec waits until its discussion closes/);
    discussed(sim, wu, wu);
    specToBuild(sim, wu, [wu]);
    assert.ok(!('specification' in sim.manifest(wu).phases), 'the one spec keeps no items');

    // Past its spec no message reaches the topic, and the spec is never
    // reopened: a change is settled in the spec (11.9.1).
    sim.refuses(sendArgv(sim, wu, wu, wu, 'a-late-gap'), /^revisit has its spec — a topic exists only before it/);
    sim.refuses(['topic', 'reopen', wu, 'specification', wu], /^revisit's spec keeps no items — it is entered at the work unit/);

    // The build's places stand by its cut: no topic verb reopens them.
    sim.refuses(['topic', 'reopen', wu, 'implementation', wu], /^implementation stands by the build's cut — it is entered by `engine enter implementation <work-unit>`/);
    sim.refuses(['topic', 'reopen', wu, 'review', wu], /^review stands by the build's cut/);
  });
});
