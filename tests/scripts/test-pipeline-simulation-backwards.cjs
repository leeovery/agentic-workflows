'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's backwards walk: a feature's decided discussion,
// which the bridge offers no revisit into, reopened by a message sent to it
// while its spec is entered but not yet written, and decided again; past its
// spec no message reaches it and the spec is never reopened; then, the
// pipeline run out, each reopen of the hop family landing its staleness one
// hop downstream, until every flag is cleared and the pipeline reads done.
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
const { Sim, startUnit, discussed, arrive, send, sendArgv, specEntry, specToBuild, walkDeliveryPhases } = require('./pipeline-world.cjs');

describe('pipeline simulation: backwards', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('backwards: a decided discussion reopens by a message, never a revisit; re-decided, the map keeps deriving', () => {
    const wu = 'revisit';
    startUnit(sim, 'feature', wu, 'Revisit flow');
    discussed(sim, wu, wu);

    // The bridge offers no way back into the decided discussion: no revisit
    // row, no revisit menu, and neither the entry nor topic reopen takes it.
    arrive(sim, wu);
    const dump = BRIDGE.format(BRIDGE.discover(sim.dir, wu));
    assert.match(dump, /^revisitable_phases: \(none\)$/m);
    assert.match(dump, /^revisit_routes: \(none\)$/m);
    sim.render(['next-phase-gate', wu, '--prev', 'discussion', '--next', 'specification'], { expect: 'empty' });
    sim.refuses(['render', 'revisit-phases', wu], /has no completed earlier phase to revisit/);
    sim.refuses(['enter', 'discussion', wu], /is decided — it reopens/);
    sim.refuses(['topic', 'reopen', wu, 'discussion', wu], /^a decided discussion reopens through a message sent to it/);

    // A message reopens it once the spec is entered and before it is written:
    // the spec waits for the topic again, and takes it once re-decided.
    specEntry(sim, wu, [wu]);
    assert.strictEqual(send(sim, wu, wu, wu, 'a-first-gap').reopened, true);
    assert.strictEqual(sim.manifest(wu).phases.discussion.items[wu].status, 'in-progress');
    sim.refuses(['enter', 'specification', wu], /^revisit's spec waits until its topic is decided/);
    discussed(sim, wu, wu);
    specToBuild(sim, wu, [wu]);
    assert.ok(!('specification' in sim.manifest(wu).phases), 'the one spec keeps no items');

    // Past its spec no message reaches the topic, and the spec is never
    // reopened: a change is settled in the spec (11.9.1).
    sim.refuses(sendArgv(sim, wu, wu, wu, 'a-late-gap'), /^revisit has its spec — a topic exists only before it/);
    sim.refuses(['topic', 'reopen', wu, 'specification', wu], /^revisit's spec keeps no items — it is entered at the work unit/);

    // Run the pipeline out, then walk the hop family backwards: staleness
    // lands at each reopen, one hop downstream, value = the upstream phase.
    walkDeliveryPhases(sim, wu, wu);
    let ro;

    // planning → implementation: the pipeline hop, same-named item.
    ro = sim.run(['topic', 'reopen', wu, 'planning', wu]);
    assert.deepStrictEqual(ro.reconcile_flagged, [{ phase: 'implementation', topic: wu }]);
    assert.strictEqual(sim.manifest(wu).phases.implementation.items[wu].reconcile_needed, 'planning');
    sim.run(['topic', 'complete', wu, 'planning', wu]);
    sim.run(['manifest', 'delete', `${wu}.implementation.${wu}`, 'reconcile_needed']);

    // implementation → review; a second reopen never clobbers the live flag.
    ro = sim.run(['topic', 'reopen', wu, 'implementation', wu]);
    assert.deepStrictEqual(ro.reconcile_flagged, [{ phase: 'review', topic: wu }]);
    assert.strictEqual(sim.manifest(wu).phases.review.items[wu].reconcile_needed, 'implementation');
    sim.run(['topic', 'complete', wu, 'implementation', wu]);
    ro = sim.run(['topic', 'reopen', wu, 'implementation', wu]);
    assert.strictEqual(ro.reconcile_flagged, undefined, 'existing flag never clobbered');
    sim.run(['topic', 'complete', wu, 'implementation', wu]);
    sim.run(['manifest', 'delete', `${wu}.review.${wu}`, 'reconcile_needed']);

    // review is the pipeline tail — reopening it flags nothing.
    ro = sim.run(['topic', 'reopen', wu, 'review', wu]);
    assert.strictEqual(ro.reconcile_flagged, undefined);
    sim.run(['topic', 'complete', wu, 'review', wu]);
    // Every flag cleared, every phase re-completed: the pipeline reads done.
    assert.strictEqual(BRIDGE.discover(sim.dir, wu).next_phase, 'done');
  });
});
