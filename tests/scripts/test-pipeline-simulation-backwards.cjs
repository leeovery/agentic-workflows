'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's backwards walk: a feature's discussion closed
// into its spec, which the bridge offers no revisit into, its close voided
// as its discussion goes on before the spec is written — the discussion
// entered again, in the entry's commit, a message sent to it while the spec
// is entered — the spec waiting each time until it closes again (11.2.1,
// 9.7.9); once the spec is written, before its one screen is answered and
// after, the topic takes no entry, no message and no ledger write, the spec
// is never reopened, and the build's places stand by its cut, reopened by no
// topic verb.
//
// Layer: simulation. World: the project every scenario starts from
// (pipeline-world.cjs), a copy per scenario; each replays the engine calls
// the skill prose makes, in prose order, and the oracle
// (pipeline-oracle.cjs) audits the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { stateGit, layout } = require('./engine-harness.cjs');
const { Sim, startUnit, discussed, arrive, send, sendArgv, specEntry, specWritten, specBuilt, enterEntry } = require('./pipeline-world.cjs');

describe('pipeline simulation: backwards', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('backwards: a discussion closed into its spec is never revisited — re-entered or sent a message, its close is void and the spec waits until it closes again; once the spec is written, nothing reaches it', () => {
    const wu = 'revisit';
    startUnit(sim, 'feature', wu, 'Revisit flow');
    discussed(sim, wu, wu);

    // The bridge offers no way back into the closed discussion: no revisit
    // menu.
    arrive(sim, wu);
    sim.refuses(['render', 'revisit-phases', wu], /has no completed earlier phase to revisit/);

    // Entered again, the discussion goes on, so its close is void in the
    // entry's own commit: the spec waits until it closes again.
    const waits = /^revisit's spec waits until its discussion closes/;
    enterEntry(sim, wu, 'discussion', wu);
    assert.strictEqual(stateGit(sim.dir, ['log', '-1', '--format=%s']).trim(), 'discussion(revisit): carry on revisit');
    assert.deepStrictEqual(stateGit(sim.dir, ['show', '--name-only', '--format=', 'HEAD']).trim().split('\n'), [layout.manifest(wu)]);
    sim.refuses(['enter', 'specification', wu], waits);
    discussed(sim, wu, wu);

    // So does a message once the spec is entered and before it is written.
    specEntry(sim, wu, [wu]);
    send(sim, wu, wu, wu, 'a-first-gap');
    sim.refuses(['enter', 'specification', wu], waits);
    discussed(sim, wu, wu);

    // Once the spec is written, before its one screen is answered as after,
    // nothing reaches the topic: no entry, no message, no ledger write — a
    // change is settled in the spec (11.9.1).
    const at = `${wu}.discussion.${wu}`;
    const person = { by: 'person', who_moved_whom: 'none' };
    const past = (/** @type {string} */ verb) => new RegExp(`^ledger ${verb}: revisit has its spec — a topic exists only before it, and a change the person asks for is settled at revisit\\.specification$`);
    const shut = () => {
      sim.refuses(['enter', 'discussion', wu, wu], /^revisit has its spec — a topic exists only before it, and a change is settled in the spec from here/);
      sim.refuses(sendArgv(sim, wu, wu, wu, 'a-late-gap'), /^revisit has its spec — a topic exists only before it/);
      sim.refuses(['ledger', 'ask', at], past('ask'), null, JSON.stringify({ ...person, text: 'One more thing?' }));
    };
    specWritten(sim, wu, [wu]);
    shut();
    specBuilt(sim, wu);
    assert.ok(!('specification' in sim.manifest(wu).phases), 'the one spec keeps no items');
    shut();
    const decision = JSON.parse(sim.read(['ledger', 'record', wu, wu])).decisions[0].id;
    sim.refuses(['ledger', 'replace', at, '--replaces', decision, '--reason', 'changed-mind'], past('replace'), null, JSON.stringify({ ...person, text: 'Dropped.', why: 'So.', drops: [] }));
  });
});
