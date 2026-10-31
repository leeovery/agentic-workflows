'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's backwards walk: a feature's decided discussion,
// which the bridge offers no revisit into, reopened by a message sent to it
// and decided again after its specification exists; then, the pipeline run
// out, each reopen of the hop family landing its staleness one hop
// downstream, until every flag is cleared and the pipeline reads done.
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
const { Sim, sessionLog, discussed, arrive, handoffEntry, send, walkDeliveryPhases } = require('./pipeline-world.cjs');

describe('pipeline simulation: backwards', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('backwards: a decided discussion reopens by a message, never a revisit; re-decided, the map keeps deriving', () => {
    const wu = 'revisit';
    const log = sessionLog(sim, wu);
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Revisit flow', '--session-log-file', log]);
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

    // A message reopens it after downstream exists: the spec keeps its state, derivations hold.
    sim.render(['entry-gate', `${wu}.specification.${wu}`], { expect: 'empty' });
    handoffEntry(sim, wu, 'specification', wu);
    assert.strictEqual(sim.read(['manifest', 'get', `${wu}.specification.${wu}`, 'status']), '', 'no specification item — a first start');
    sim.run(['topic', 'start', wu, 'specification', wu]);
    assert.strictEqual(send(sim, wu, wu, wu, 'a-first-gap').reopened, true);
    assert.strictEqual(sim.manifest(wu).phases.discussion.items[wu].status, 'in-progress');
    discussed(sim, wu, wu);
    assert.strictEqual(sim.manifest(wu).phases.specification.items[wu].status, 'in-progress');

    // Run the pipeline out, then walk the hop family backwards: staleness
    // lands at each reopen, one hop downstream, value = the upstream phase.
    walkDeliveryPhases(sim, wu, wu, { sources: [wu] });

    // discussion → specification (reverse join), the message's landing the
    // reopen: flag + stale source row.
    let ro = send(sim, wu, wu, wu, 'a-second-gap');
    assert.strictEqual(ro.reconcile_flagged, true);
    assert.deepStrictEqual(ro.sources_staled, [wu]);
    discussed(sim, wu, wu);
    // Re-completion clears nothing: the flag waits for the entry advisory,
    // the stale row for the spec's own reconciliation.
    let spec = sim.manifest(wu).phases.specification.items[wu];
    assert.strictEqual(spec.reconcile_needed, 'discussion');
    assert.strictEqual(spec.sources[wu].status, 'stale');
    // The read side never routes forward past the flag: the bridge's next
    // phase is the flagged spec, not done — the terminal branch stays untaken.
    const bridged = BRIDGE.discover(sim.dir, wu);
    assert.strictEqual(bridged.next_phase, 'specification');
    assert.deepStrictEqual(bridged.reconcile_pending, [`specification/${wu} (discussion)`]);
    sim.run(['manifest', 'delete', `${wu}.specification.${wu}`, 'reconcile_needed']);
    // The flag is not the whole signal: a source row still reading stale is
    // the specification moving with no flag and no reopen, and the walk stops
    // there rather than handing the plan a document about to change.
    assert.strictEqual(BRIDGE.discover(sim.dir, wu).next_phase, 'specification');
    sim.run(['manifest', 'set', `${wu}.specification.${wu}`, `sources.${wu}.status`, 'incorporated']);
    assert.strictEqual(BRIDGE.discover(sim.dir, wu).next_phase, 'done', 'every row incorporated: the record has stopped moving');

    // specification → planning: the pipeline hop, same-named item.
    ro = sim.run(['topic', 'reopen', wu, 'specification', wu]);
    assert.deepStrictEqual(ro.reconcile_flagged, [{ phase: 'planning', topic: wu }]);
    assert.strictEqual(ro.sources_staled, undefined);
    assert.strictEqual(sim.manifest(wu).phases.planning.items[wu].reconcile_needed, 'specification');
    sim.run(['topic', 'complete', wu, 'specification', wu]);
    sim.run(['manifest', 'delete', `${wu}.planning.${wu}`, 'reconcile_needed']);

    // planning → implementation.
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
