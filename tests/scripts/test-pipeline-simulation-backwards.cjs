'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's backwards walk: a feature's discussion closed
// into its spec, which the bridge offers no revisit into, its close voided
// by every way its discussion goes on before the spec is written — the
// discussion entered again, a question asked on the topic, a message sent
// to it while the spec is entered — the spec waiting each time until it
// closes again (11.2.1, 9.7.9); past its spec the topic takes no message
// and no ledger write, the spec is never reopened, and the build's places
// stand by its cut, reopened by no topic verb.
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
const { Sim, startUnit, discussed, arrive, send, sendArgv, specEntry, specToBuild, enterEntry } = require('./pipeline-world.cjs');

describe('pipeline simulation: backwards', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('backwards: a discussion closed into its spec is never revisited — re-entered, asked a question or sent a message, its close is void and the spec waits until it closes again; past its spec, nothing reaches it', () => {
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
    sim.refuses(['topic', 'reopen', wu, 'discussion', wu], /^a discussion decided, or closed into its spec, reopens through a message sent to it/);

    // Entered again, the discussion goes on, so its close is void: the spec
    // waits until it closes again.
    const waits = /^revisit's spec waits until its discussion closes/;
    enterEntry(sim, wu, 'discussion', wu);
    sim.refuses(['enter', 'specification', wu], waits);
    discussed(sim, wu, wu);

    // A question asked on the topic voids the close as well.
    const at = `${wu}.discussion.${wu}`;
    const person = { by: 'person', who_moved_whom: 'none' };
    const late = sim.run(['ledger', 'ask', at], null, JSON.stringify({ ...person, text: 'Does a revisit keep its notes?' })).id;
    sim.refuses(['enter', 'specification', wu], waits);
    sim.run(['ledger', 'decide', at, '--answers', late], null, JSON.stringify({ ...person, text: 'It keeps them.', why: 'Notes are the point.' }));
    discussed(sim, wu, wu);

    // So does a message once the spec is entered and before it is written.
    specEntry(sim, wu, [wu]);
    send(sim, wu, wu, wu, 'a-first-gap');
    sim.refuses(['enter', 'specification', wu], waits);
    discussed(sim, wu, wu);
    specToBuild(sim, wu, [wu]);
    assert.ok(!('specification' in sim.manifest(wu).phases), 'the one spec keeps no items');

    // Past its spec no message reaches the topic, and the spec is never
    // reopened: a change is settled in the spec (11.9.1).
    sim.refuses(sendArgv(sim, wu, wu, wu, 'a-late-gap'), /^revisit has its spec — a topic exists only before it/);
    const decision = JSON.parse(sim.read(['ledger', 'record', wu, wu])).decisions[0].id;
    for (const [verb, flags, content] of /** @type {[string, string[], Record<string, unknown>][]} */ ([
      ['ask', [], { ...person, text: 'One more thing?' }],
      ['decide', ['--answers', late], { ...person, text: 'Kept.', why: 'So.' }],
      ['replace', ['--replaces', decision, '--reason', 'changed-mind'], { ...person, text: 'Dropped.', why: 'So.', drops: [] }],
      ['move', ['--question', late, '--to', 'roadmap:later'], person],
    ])) {
      sim.refuses(['ledger', verb, at, ...flags], new RegExp(`^ledger ${verb}: revisit has its spec — a topic exists only before it, and a change the person asks for is settled at revisit\\.specification$`), null, JSON.stringify(content));
    }
    sim.refuses(['topic', 'reopen', wu, 'specification', wu], /^revisit's spec keeps no items — it is entered at the work unit/);

    // The build's places stand by its cut: no topic verb reopens them.
    sim.refuses(['topic', 'reopen', wu, 'implementation', wu], /^implementation stands by the build's cut — it is entered by `engine enter implementation <work-unit>`/);
    sim.refuses(['topic', 'reopen', wu, 'review', wu], /^review stands by the build's cut/);
  });
});
