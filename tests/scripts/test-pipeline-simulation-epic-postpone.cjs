'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's epic postpone: a topic leaving for the roadmap,
// the roadmap owning it while it waits, and the pull bringing it back —
// into its own epic, restored, or into another, seeded with the prior
// record's address. A topic cancelled, and the holds a cancel or a postpone
// releases, are test-pipeline-simulation-epic-topics.cjs.
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
const derivations = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/derivations.cjs'));
const EPIC_GATEWAY = require(path.join(ROOT, 'skills/leeway-continue-epic/scripts/gateway.cjs'));
const {
  epicMenu, epicPostponeMenu, epicPullForwardMenu,
} = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/projections/epic.cjs'));
const { Sim, sessionLog, enterEntry, discussed } = require('./pipeline-world.cjs');

describe('pipeline simulation: epic postpone', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('epic topic postpone: the topic leaves for the roadmap, the roadmap owns it, and the pull brings it back', () => {
    const wu = 'later';
    sim.run(['workunit', 'create', wu, 'epic', '--description', 'Postpone units', '--session-log-file', sessionLog(sim, wu)]);
    sim.run(['discovery-map', 'add-batch', wu, '--file', sim.write(`.leeway/.cache/${wu}/discovery/topics.json`, [
      { name: 'fresh-one', routing: 'discussion', summary: 'Nothing started' },
      { name: 'talking', routing: 'discussion', summary: 'Discussion under way' },
      { name: 'decided', routing: 'discussion', summary: 'Discussion concluded' },
      { name: 'specd', routing: 'discussion', summary: 'Specified already' },
    ])]);
    sim.run(['discovery-map', 'sequence', wu, 'fresh-one=1', 'talking=2', 'decided=3', 'specd=4']);
    sim.run(['discovery-session', 'close', wu, '-m', `discovery(${wu}): shape the map`]);
    const detail = () => EPIC_GATEWAY.discover(sim.dir, wu);
    const postponable = () => epicPostponeMenu(detail()).keys.filter((k) => k.action === 'postpone').map((k) => k.topic);
    const pullable = () => epicPullForwardMenu(detail()).keys.filter((k) => k.action === 'pull-forward').map((k) => [k.topic, k.item]);
    const menuActions = () => epicMenu(wu, detail()).keys.map((k) => k.action);

    for (const topic of ['decided', 'specd']) discussed(sim, wu, topic);
    enterEntry(sim, wu, 'discussion', 'talking');
    sim.run(['topic', 'start', wu, 'specification', 'specd']);
    sim.run(['manifest', 'set', `${wu}.specification.specd`, 'sources.specd.status', 'incorporated']);

    // Every Discovery unit is offered; the spec'd one is locked with its reason.
    assert.deepStrictEqual(postponable(), ['decided', 'talking', 'fresh-one']);
    assert.strictEqual(detail().postponable.find((u) => u.name === 'specd').locked,
      'postponing "specd" is refused while the specification "specd" sources its discussion — a topic past specification is past "not yet"');
    sim.refuses(['topic', 'postpone', wu, 'specd', '--horizon', 'next'], /a topic past specification is past "not yet"/);
    sim.refuses(['render', 'postpone-gate', `${wu}.discovery.specd`, '--horizon', 'next'], /a topic past specification is past "not yet"/);

    // The map is born at the first postpone; the second takes a new horizon.
    assert.strictEqual(sim.run(['roadmap', 'state']).exists, false);
    sim.render(['postpone-gate', `${wu}.discovery.fresh-one`, '--horizon', 'next'], { expect: 'content' });
    const first = sim.run(['topic', 'postpone', wu, 'fresh-one', '--horizon', 'next']);
    assert.deepStrictEqual(first.roadmap, { name: 'fresh-one', horizon: 'next', born_map: true, born_horizon: true, reverted_join: false });
    assert.match(sim.render(['topic-receipt', `${wu}.discovery.fresh-one`, '--verb', 'postpone'], { expect: 'content' }),
      /Postponed "Fresh One" → next\./);
    const second = sim.run(['topic', 'postpone', wu, 'talking', '--horizon', 'later']);
    assert.deepStrictEqual(second.roadmap, { name: 'talking', horizon: 'later', born_map: false, born_horizon: true, reverted_join: false });
    assert.deepStrictEqual(second.postponed, [{ phase: 'discussion', previous_status: 'in-progress' }]);
    sim.run(['topic', 'postpone', wu, 'decided', '--horizon', 'later']);

    // The lifecycle, the aggregation, the sequencing flag, and the epic's
    // own completion all walk past a topic that has left.
    const d = detail();
    assert.deepStrictEqual(d.postponed, [
      { name: 'decided', horizon: 'later', item: 'decided', waiting: true },
      { name: 'fresh-one', horizon: 'next', item: 'fresh-one', waiting: true },
      { name: 'talking', horizon: 'later', item: 'talking', waiting: true },
    ]);
    assert.strictEqual(d.discovery_map.find((r) => r.name === 'talking').lifecycle, 'postponed');
    assert.strictEqual(sim.read(['manifest', 'get', `${wu}.discussion.talking`, 'status']), 'postponed');
    sim.refuses(['enter', 'discussion', wu, 'talking'], /^the topic "talking" is postponed to the roadmap — pulling it forward goes through the epic menu/);
    assert.strictEqual(derivations.phaseStatus(sim.manifest(wu), 'discussion'), 'completed', 'the postponed conversation under way no longer holds the phase in progress');
    assert.strictEqual(d.needs_sequencing, false, 'a postponed row carries no order and asks for none');
    assert.strictEqual(d.convergence_state, 'settled', 'a topic that has left holds convergence open no more than a cancelled one');
    assert.deepStrictEqual(d.postponable.map((u) => u.name), ['specd'], 'a postponed unit leaves the postpone list');
    assert.deepStrictEqual(postponable(), [], 'and the one unit left is locked, so nothing is pickable');
    assert.ok(!d.cancellable.some((u) => u.name === 'fresh-one'), 'a postponed unit leaves the cancel list too');
    // The gap analysis reads the decided discussions' records: the postponed
    // one drops out of its input set.
    assert.deepStrictEqual(derivations.collectAnalysisInputs(sim.manifest(wu), path.join(sim.dir, '.leeway'), 'gap-analysis')
      .map((f) => path.basename(f)), ['specd.md']);

    // The roadmap owns it: cancel and reactivate refuse, a send lands.
    sim.refuses(['topic', 'cancel', wu, 'discovery', 'decided'], /"decided" is postponed — the roadmap owns it/);
    sim.refuses(['topic', 'reactivate', wu, 'discovery', 'decided'], /"decided" is postponed, not cancelled — pull it forward from the roadmap instead/);
    sim.write('.leeway/.cache/scratch/message-scratch.md', 'Mail that waits\n\nStill?\n');
    const held = JSON.stringify(sim.manifest(wu));
    const mail = sim.run(['topic', 'send', wu, 'decided', '--from', 'fresh-one', '--content', '.leeway/.cache/scratch/message-scratch.md', '--slug', 'mail-that-waits']);
    assert.strictEqual(mail.message_path, path.join(sim.dir, `.leeway/${wu}/topics/decided/mail/001-mail-that-waits.md`),
      'a message for a topic that waits is mail that waits with it');
    assert.strictEqual(JSON.stringify(sim.manifest(wu)), held, 'the send leaves the hold alone');

    // `roadmap remove` is the door to "actually never".
    const removed = sim.run(['roadmap', 'remove', 'fresh-one']);
    assert.deepStrictEqual(removed.epic_row_cancelled, { work_unit: wu, topic: 'fresh-one' });
    assert.strictEqual(sim.manifest(wu).phases.discovery.items['fresh-one'].cancelled, true);
    assert.strictEqual(sim.manifest(wu).phases.discovery.items['fresh-one'].postponed, undefined);

    // The menu's return row and its sub-view carry what still waits — the
    // removed item is gone from both, the cancelled row with it.
    assert.ok(menuActions().includes('pull_forward_topic'));
    assert.deepStrictEqual(pullable(), [['decided', 'decided'], ['talking', 'talking']]);

    // The pull is the return: the same epic restores the unit it postponed.
    const back = sim.run(['roadmap', 'pull-forward', 'talking', '--into', wu]);
    assert.deepStrictEqual(back.restored, [{ phase: 'discussion', status: 'in-progress' }]);
    assert.match(sim.render(['topic-receipt', `${wu}.discovery.talking`, '--verb', 'restore'], { expect: 'content' }),
      /Pulled "Talking" forward\. Restored discussion \[in-progress\]\./);
    assert.strictEqual(sim.manifest(wu).phases.discovery.items.talking.order, 2, 'the map order returns');
    assert.strictEqual(sim.manifest(wu).phases.discussion.items.talking.status, 'in-progress');
    enterEntry(sim, wu, 'discussion', 'talking');
    assert.strictEqual('postponed_from' in sim.run(['roadmap', 'state']).items.find((i) => i.name === 'talking'), false);
    assert.strictEqual(sim.run(['roadmap', 'state']).items.find((i) => i.name === 'talking').state, 'in-flight');

    // A pull into a different epic seeds a fresh topic carrying the prior
    // record's address; a bind does the same for a plain pull.
    const next = 'later-v2';
    sim.run(['workunit', 'create', next, 'epic', '--description', 'The next release', '--session-log-file', sessionLog(sim, next)]);
    sim.run(['discovery-session', 'close', next, '-m', `discovery(${next}): shape the map`]);
    const elsewhere = sim.run(['roadmap', 'pull-forward', 'decided', '--into', next, '--routing', 'discussion']);
    assert.deepStrictEqual(elsewhere.prior, { work_unit: wu, topic: 'decided' });
    assert.deepStrictEqual(sim.manifest(next).phases.discovery.items.decided.prior, { work_unit: wu, topic: 'decided' });
    assert.strictEqual(sim.manifest(wu).phases.discovery.items.decided.postponed, true, 'the prior epic keeps its record');
    // Taken by another epic, the item no longer waits: the prior epic's row
    // stays postponed with no way back, and its return row withdraws.
    assert.deepStrictEqual(detail().postponed.filter((t) => t.waiting), []);
    assert.deepStrictEqual(pullable(), []);
    assert.ok(!menuActions().includes('pull_forward_topic'));
    sim.refuses(['enter', 'discussion', wu, 'decided'], /^the topic "decided" is postponed, and its roadmap item has gone to another epic — it stays postponed here, with no way back$/);

    // A pulled-from-roadmap topic postponed again re-waits its own item.
    sim.run(['topic', 'postpone', next, 'decided', '--horizon', 'someday']);
    const rewaited = sim.run(['topic', 'postpone', wu, 'talking', '--horizon', 'someday']);
    assert.deepStrictEqual(rewaited.roadmap, { name: 'talking', horizon: 'someday', born_map: false, born_horizon: false, reverted_join: true });
    assert.strictEqual(sim.run(['roadmap', 'state']).items.find((i) => i.name === 'talking').state, 'waiting');
  });
});
