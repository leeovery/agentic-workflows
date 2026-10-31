'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's plan holds: a plan held while its specification
// is unsettled — its entry, its birth, its conclusion and its menu row
// alike — and the send door reaching the hold, a planning-origin sources
// stale sparing the plan's own specification.
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
const EPIC_GATEWAY = require(path.join(ROOT, 'skills/leeway-continue-epic/scripts/gateway.cjs'));
const { epicMenu } = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/projections/epic.cjs'));
const { Sim, send, mappedEpic, discussed, arriveAtEpicMenu } = require('./pipeline-world.cjs');

describe('pipeline simulation: plan holds', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('a plan is held while its specification is unsettled — entry, birth, conclusion, and the menu row alike', () => {
    const wu = 'holdplan';
    mappedEpic(sim, wu, ['billing', 'fees']);
    /** Walk a topic Discovery → a concluded specification extracting its discussion. */
    const settle = (topic) => {
      discussed(sim, wu, topic);
      sim.run(['topic', 'start', wu, 'specification', topic]);
      sim.run(['manifest', 'set', `${wu}.specification.${topic}`, `sources.${topic}.status`, 'incorporated']);
      sim.write(`.leeway/${wu}/specification/${topic}/specification.md`, `# Spec — ${topic}\n`);
      sim.run(['topic', 'complete', wu, 'specification', topic]);
    };
    settle('billing');
    settle('fees');

    // A settled record opens the plan: the entry passes and the birth stands.
    sim.render(['entry-gate', `${wu}.planning.billing`], { expect: 'empty' });
    sim.run(['topic', 'start', wu, 'planning', 'billing']);

    // A message lands back on both source discussions: each specification's
    // row stales and takes the flag — the record is moving beneath the plan.
    for (const topic of ['billing', 'fees']) {
      const ro = send(sim, wu, topic, topic, `${topic}-moves`);
      assert.deepStrictEqual(ro.sources_staled, [topic]);
      assert.strictEqual(ro.reconcile_flagged, true);
      assert.strictEqual(sim.manifest(wu).phases.specification.items[topic].reconcile_needed, 'discussion');
    }

    // Every planning surface holds: the conclusion, the entry, an unborn
    // plan's birth, and the epic menu's rows.
    sim.refuses(['topic', 'complete', wu, 'planning', 'billing'],
      /^planning "billing" awaits its specification \(a source has moved beneath the extraction \(billing\), its own input moved\) — settle the specification to release the wait$/);
    sim.refuses(['topic', 'start', wu, 'planning', 'fees'],
      /^planning can't start on "fees" — its specification is unsettled \(a source has moved beneath the extraction \(fees\), its own input moved\); a plan is built from a settled record, so the specification's entry is the way in$/);
    assert.match(sim.render(['entry-gate', `${wu}.planning.billing`], { expect: 'content' }),
      /Entry blocked — the specification for "Billing" is unsettled/);
    // The pause is the plan's, in the plan's voice.
    assert.match(sim.render(['wait-gate', `${wu}.planning.billing`], { expect: 'content' }),
      /⚑ Conclusion blocked — this plan awaits its specification[\s\S]*Keep planning here/);
    assert.match(arriveAtEpicMenu(sim, wu, 'planning', 'paused'),
      /Planning paused for "Holdplan" — "Billing" awaits its specification/);
    const planRows = () => epicMenu(wu, EPIC_GATEWAY.discover(sim.dir, wu)).keys
      .filter((k) => k.action === 'continue_planning' || k.action === 'start_planning').map((k) => k.topic).sort();
    assert.deepStrictEqual(planRows(), [], 'a held plan carries no menu row — the specification\'s is the way in');
    assert.deepStrictEqual(EPIC_GATEWAY.discover(sim.dir, wu).phases.planning[0].blocked_by, ['specification']);

    // The specification reconciles — the discussion re-concludes, the row
    // re-incorporates, the flag clears — and every hold releases with it.
    for (const topic of ['billing', 'fees']) {
      discussed(sim, wu, topic);
      sim.run(['manifest', 'delete', `${wu}.specification.${topic}`, 'reconcile_needed']);
      sim.run(['manifest', 'set', `${wu}.specification.${topic}`, `sources.${topic}.status`, 'incorporated']);
    }
    sim.render(['entry-gate', `${wu}.planning.billing`], { expect: 'empty' });
    assert.deepStrictEqual(planRows(), ['billing', 'fees'], 'the settled record returns both rows');
    sim.write(`.leeway/${wu}/planning/billing/planning.md`, '# Plan\n');
    assert.strictEqual(sim.run(['topic', 'complete', wu, 'planning', 'billing']).status, 'completed');
    sim.run(['topic', 'start', wu, 'planning', 'fees']);
  });

  it('the send door reaches the hold, and a planning-origin sources stale spares the plan\'s own specification', () => {
    const wu = 'holdgate';
    mappedEpic(sim, wu, ['shared']);
    // One discussion, two specifications extracting it, a plan on one.
    discussed(sim, wu, 'shared');
    for (const spec of ['alpha-spec', 'beta-spec']) {
      sim.run(['topic', 'start', wu, 'specification', spec]);
      sim.run(['manifest', 'set', `${wu}.specification.${spec}`, 'sources.shared.status', 'incorporated']);
      sim.write(`.leeway/${wu}/specification/${spec}/specification.md`, `# Spec — ${spec}\n`);
      sim.run(['topic', 'complete', wu, 'specification', spec]);
    }
    sim.run(['topic', 'start', wu, 'planning', 'alpha-spec']);

    // D4's door: a send lands a message on the source discussion.
    // The specification never transitions — it still reads `completed` —
    // and its source row alone carries the landing, which is why the hold
    // cannot key on the specification's status.
    const landed = send(sim, wu, 'shared', 'shared');
    assert.deepStrictEqual(landed.sources_staled.sort(), ['alpha-spec', 'beta-spec']);
    assert.strictEqual(sim.manifest(wu).phases.specification.items['alpha-spec'].status, 'completed',
      'the specification never transitioned — only its row moved');
    sim.refuses(['topic', 'complete', wu, 'planning', 'alpha-spec'], /awaits its specification/);

    // Reconcile both specifications and the hold releases.
    discussed(sim, wu, 'shared');
    for (const spec of ['alpha-spec', 'beta-spec']) {
      sim.run(['manifest', 'delete', `${wu}.specification.${spec}`, 'reconcile_needed']);
      sim.run(['manifest', 'set', `${wu}.specification.${spec}`, 'sources.shared.status', 'incorporated']);
    }
    sim.render(['wait-gate', `${wu}.planning.alpha-spec`], { expect: 'empty' });

    // A decision landed from planning (landing-a-resolution.md) reads the
    // discussion's record and lands on the ledger — a decision the record
    // never made, asked and answered, each write committing itself: the
    // sibling extraction goes stale, the plan's own specification is spared
    // because the planner re-aligned it — so the plan is never held.
    const at = `${wu}.discussion.shared`;
    sim.run(['ledger', 'record', wu, 'shared']);
    const retention = sim.run(['ledger', 'ask', at], null, JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'How long are records kept?' })).id;
    sim.run(['ledger', 'decide', at, '--answers', retention], null, JSON.stringify({ by: 'person', who_moved_whom: 'none', text: 'A year.', why: 'The regulator asks for a year.' }));
    const staled = sim.run(['sources', 'stale', wu, 'shared', '--except', 'alpha-spec']);
    assert.deepStrictEqual(staled.staled, ['beta-spec']);
    assert.strictEqual(sim.manifest(wu).phases.specification.items['alpha-spec'].sources.shared.status, 'incorporated');
    sim.render(['entry-gate', `${wu}.planning.alpha-spec`], { expect: 'empty' });
    sim.render(['wait-gate', `${wu}.planning.alpha-spec`], { expect: 'empty' });
    sim.write(`.leeway/${wu}/planning/alpha-spec/planning.md`, '# Plan\n');
    assert.strictEqual(sim.run(['topic', 'complete', wu, 'planning', 'alpha-spec']).status, 'completed');
  });
});
