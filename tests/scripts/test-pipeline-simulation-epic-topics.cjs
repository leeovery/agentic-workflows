'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's epic topic lifecycle: a topic cancelled at
// each stage, a later stage locking the earlier; a topic postponed to the
// roadmap and pulled back; and the holds a cancel, a postpone, a
// specification cancel or a reactivate releases, or leaves standing.
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
const derivations = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/derivations.cjs'));
const EPIC_GATEWAY = require(path.join(ROOT, 'skills/leeway-continue-epic/scripts/gateway.cjs'));
const {
  epicMenu, epicCancelMenu, epicPostponeMenu, epicPullForwardMenu,
} = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/projections/epic.cjs'));
const { Sim, sessionLog, sendArgv, mappedEpic, presenceRow, arriveAtEpicMenu } = require('./pipeline-world.cjs');

// A discussion in flight on alpha with its research reopened beneath it by
// a peer, sitting in it — a discussion cannot be born beneath live
// research, so the research lands first and the peer's reopen is the hop
// under it.
function researchBeneath(sim, wu, peer) {
  sim.run(['workunit', 'create', wu, 'epic', '--description', 'Cancel units', '--session-log-file', sessionLog(sim, wu)]);
  sim.run(['discovery-map', 'add-batch', wu, '--file', sim.write(`.leeway/.cache/${wu}/discovery/topics.json`,
    [{ name: 'alpha', routing: 'research', summary: 'alpha' }])]);
  sim.run(['discovery-session', 'close', wu, '-m', `discovery(${wu}): shape the map`]);
  sim.run(['topic', 'start', wu, 'research', 'alpha']);
  sim.run(['topic', 'complete', wu, 'research', 'alpha']);
  sim.run(['topic', 'start', wu, 'discussion', 'alpha']);
  peer.run(['topic', 'reopen', wu, 'research', 'alpha']);
  peer.run(['presence', 'beat', wu, 'research', 'alpha']);
}

describe('pipeline simulation: epic-topics', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('epic topic cancel: one unit per stage, a later stage locking the earlier, waits released before the holders close', () => {
    const wu = 'cuts';
    sim.run(['workunit', 'create', wu, 'epic', '--description', 'Cancel units', '--session-log-file', sessionLog(sim, wu)]);
    const topics = sim.write(`.leeway/.cache/${wu}/discovery/topics.json`, [
      { name: 'export', routing: 'discussion', summary: 'Data export' },
      { name: 'auth', routing: 'discussion', summary: 'Auth flow' },
      { name: 'billing', routing: 'discussion', summary: 'Billing' },
      { name: 'roles', routing: 'discussion', summary: 'Roles' },
    ]);
    sim.run(['discovery-map', 'add-batch', wu, '--file', topics]);
    sim.run(['discovery-map', 'sequence', wu, 'export=1', 'auth=2', 'billing=3', 'roles=4']);
    sim.run(['discovery-session', 'close', wu, '-m', `discovery(${wu}): shape the map`]);
    const detail = () => EPIC_GATEWAY.discover(sim.dir, wu);
    const pickable = () => epicCancelMenu(detail()).keys.filter((k) => k.action === 'cancel').map((k) => `${k.phase}/${k.topic}`);
    const locked = () => detail().cancellable.filter((u) => u.locked !== undefined).map((u) => `${u.stage}/${u.name}: ${u.locked}`);
    const cancelledUnits = () => detail().cancelled.map((u) => `${u.stage}/${u.name}`);
    const menuOptions = () => epicMenu(wu, detail()).keys.filter((k) => ['cancel_topic', 'reactivate_topic'].includes(k.action)).map((k) => k.key);

    // A never-started topic: listed, gated, marked on the map alone, refused
    // by the map's remove while cancelled, and returned fresh.
    assert.deepStrictEqual(pickable(), ['discovery/export', 'discovery/auth', 'discovery/billing', 'discovery/roles']);
    assert.deepStrictEqual(menuOptions(), ['a']);
    assert.match(sim.render(['cancel-gate', `${wu}.discovery.export`], { expect: 'content' }),
      /Cancelling \*\*Export\*\* takes it off the board — nothing has started, so only the map row is marked; it can be reactivated later\./);
    const marked = sim.run(['topic', 'cancel', wu, 'discovery', 'export']);
    assert.deepStrictEqual([marked.cancelled, marked.discarded, marked.abandoned, marked.released_waits], [[], [], [], []]);
    assert.deepStrictEqual(sim.manifest(wu).phases.discovery.items.export,
      { routing: 'discussion', source: 'discovery', summary: 'Data export', cancelled: true, previous_order: 1 });
    assert.match(sim.render(['topic-receipt', `${wu}.discovery.export`, '--verb', 'cancel'], { expect: 'content' }), /Cancelled "Export"\./);
    assert.deepStrictEqual(cancelledUnits(), ['discovery/export']);
    assert.deepStrictEqual(menuOptions(), ['a', 'e']);
    sim.refuses(['discovery-map', 'remove', wu, 'export'], /it is cancelled and stays on the map as record; reactivate it from the epic menu first/);
    sim.refuses(['topic', 'cancel', wu, 'discovery', 'export'], /"export" is already cancelled/);
    const returned = sim.run(['topic', 'reactivate', wu, 'discovery', 'export']);
    assert.deepStrictEqual(returned.restored, []);
    assert.deepStrictEqual(sim.manifest(wu).phases.discovery.items.export, { routing: 'discussion', source: 'discovery', summary: 'Data export', order: 1 });
    assert.match(sim.render(['topic-receipt', `${wu}.discovery.export`, '--verb', 'reactivate'], { expect: 'content' }), /Reactivated "Export"\.\n/);
    assert.deepStrictEqual(cancelledUnits(), []);

    // A started topic: a discussion in flight with a spawned experiment, a
    // message waiting in its mailbox, and a proposed grouping over its
    // discussion. The cancel takes all of it in one write — the wait
    // released first, so the flag lands on the holder while it is still
    // live.
    sim.run(['topic', 'start', wu, 'discussion', 'auth']);
    sim.write(`.leeway/${wu}/discussion/auth.md`, '# Discussion — Auth\n');
    const e1 = sim.run(['experiment', 'create', wu, 'auth', '--slug', 'latency', '--from', 'discussion',
      '--problem', sim.write(`.leeway/.cache/${wu}/discussion/auth/problem.md`, '# Problem — latency\n')]);
    assert.strictEqual(e1.id, 'E1');
    sim.write('.leeway/.cache/scratch/message-scratch.md', 'Token lifetime\n\nHow long?\n');
    sim.run(['topic', 'send', wu, 'auth', '--content', '.leeway/.cache/scratch/message-scratch.md', '--slug', 'token-lifetime']);
    sim.run(['manifest', 'apply', wu, '--file', sim.write(`.leeway/.cache/${wu}/specification/grouping-ops.json`,
      [{ op: 'set', path: `${wu}.specification.grouping`, fields: { status: 'proposed', sources: { auth: { status: 'pending' } } } }])]);
    assert.deepStrictEqual(locked(), [], 'a proposed grouping never locks');
    assert.match(sim.render(['cancel-gate', `${wu}.discovery.auth`], { expect: 'content' }).replace(/\n\u00a0+/g, ' '),
      /Cancelling \*\*Auth\*\* marks its discussion \[in-progress\] cancelled — it can be reactivated later\. 1 open experiment \(E1\) ends abandoned on the register\. The proposed grouping \*\*Grouping\*\* is discarded — the next grouping analysis rebuilds from the new world\./);
    const taken = sim.run(['topic', 'cancel', wu, 'discovery', 'auth']);
    assert.deepStrictEqual(taken.cancelled, [{ phase: 'discussion', previous_status: 'in-progress' }]);
    assert.deepStrictEqual(taken.released_waits, [{ phase: 'discussion', released: ['E1'], remaining: [] }]);
    assert.deepStrictEqual(taken.abandoned, ['E1']);
    assert.deepStrictEqual(taken.discarded, ['grouping']);
    let m = sim.manifest(wu);
    assert.deepStrictEqual(m.phases.discussion.items.auth, { status: 'cancelled', previous_status: 'in-progress', reconcile_needed: 'experiment' },
      'the release flagged the holder before the cancel closed it');
    assert.strictEqual(m.phases.experiment.items.auth.status, 'completed', 'the series settles over its abandoned record');
    assert.strictEqual(m.phases.experiment.items.auth.experiments.E1.reason, 'topic cancelled');
    assert.strictEqual(m.phases.specification.items.grouping, undefined, 'the proposed grouping is discarded, never cancelled');
    assert.strictEqual(m.phases.discovery.items.auth.cancelled, true);
    assert.ok(!epicMenu(wu, detail()).keys.some((k) => k.action === 'continue_experiment'), 'no live record, no laboratory row');
    assert.deepStrictEqual(cancelledUnits(), ['discovery/auth']);
    // The conversation's start refuses the cancelled topic in the red register, naming the reactivate.
    assert.match(sim.render(['entry-gate', `${wu}.discussion.auth`, '--own'], { expect: 'content' }),
      /⚑ "Auth" is cancelled[\s\S]*> Reactivate it from the epic menu \(`e\/reactivate`\)\./);

    // The reactivate restores the conversation with the release flag live,
    // its message still waiting; answered, the discussion concludes.
    const back = sim.run(['topic', 'reactivate', wu, 'discovery', 'auth']);
    assert.deepStrictEqual(back.restored, [{ phase: 'discussion', status: 'in-progress' }]);
    assert.match(sim.render(['topic-receipt', `${wu}.discovery.auth`, '--verb', 'reactivate'], { expect: 'content' }),
      /Reactivated "Auth"\. Restored discussion \[in-progress\]\./);
    sim.render(['entry-gate', `${wu}.discussion.auth`, '--own'], { expect: 'empty' });
    assert.strictEqual(sim.manifest(wu).phases.discussion.items.auth.reconcile_needed, 'experiment', 'the flag is live again');
    sim.run(['manifest', 'delete', `${wu}.discussion.auth`, 'reconcile_needed']);
    const lifetime = sim.run(['ledger', 'ask', `${wu}.discussion.auth`], null, JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'How long does a token live?' }));
    sim.run(['topic', 'answered', wu, 'auth', '001-token-lifetime', '--entry', lifetime.id]);
    sim.run(['topic', 'complete', wu, 'discussion', 'auth']);

    // The Definition stage: roles specified and planned; billing specified,
    // planned, and under implementation.
    for (const topic of ['billing', 'roles']) {
      sim.run(['topic', 'start', wu, 'discussion', topic]);
      sim.write(`.leeway/${wu}/discussion/${topic}.md`, `# Discussion — ${topic}\n`);
      sim.run(['topic', 'complete', wu, 'discussion', topic]);
      sim.run(['topic', 'start', wu, 'specification', topic]);
      sim.run(['manifest', 'set', `${wu}.specification.${topic}`, `sources.${topic}.status`, 'incorporated']);
      sim.write(`.leeway/${wu}/specification/${topic}/specification.md`, `# Spec — ${topic}\n`);
      sim.run(['topic', 'complete', wu, 'specification', topic]);
      sim.run(['topic', 'start', wu, 'planning', topic]);
      sim.run(['topic', 'complete', wu, 'planning', topic]);
    }
    sim.run(['build-order', 'sequence', wu, 'roles=1', 'billing=2']);
    sim.run(['topic', 'start', wu, 'implementation', 'billing']);

    // The locks: a started specification holds its source topic, code holds
    // the specification. Both rows stay on the menu, keyless with the reason.
    assert.deepStrictEqual(locked(), [
      'discovery/billing: locked by specification "Billing" — cancel it first',
      'discovery/roles: locked by specification "Roles" — cancel it first',
      'specification/billing: implementation started — fix forward',
    ]);
    assert.deepStrictEqual(pickable(), ['discovery/auth', 'discovery/export', 'specification/roles']);
    sim.refuses(['topic', 'cancel', wu, 'discovery', 'roles'], /refused while the specification "roles" sources its discussion — cancel the specification first/);
    sim.refuses(['topic', 'cancel', wu, 'specification', 'billing'], /"billing" is locked — implementation has started/);
    sim.refuses(['render', 'cancel-gate', `${wu}.specification.billing`], /is locked — implementation has started/);

    // The specification unit's cancel takes its plan and its build order,
    // frees the source, and flips the sequencing flag; the freed source then
    // cancels with nothing to discard.
    assert.match(sim.render(['cancel-gate', `${wu}.specification.roles`], { expect: 'content' }).replace(/\n\u00a0+/g, ' '),
      /Cancelling \*\*Roles\*\* marks the specification and its plan cancelled and frees its source discussion \(Roles\) to be regrouped or cancelled; it can be reactivated later\./);
    const specCut = sim.run(['topic', 'cancel', wu, 'specification', 'roles']);
    assert.deepStrictEqual(specCut.cancelled, [
      { phase: 'specification', previous_status: 'completed' },
      { phase: 'planning', previous_status: 'completed' },
    ]);
    m = sim.manifest(wu);
    assert.strictEqual(m.phases.specification.items.roles.previous_order, 1);
    assert.strictEqual(m.phases.specification.items.roles.order, undefined);
    assert.strictEqual(m.phases.planning.items.roles.status, 'cancelled');
    assert.strictEqual(m.phases.discussion.items.roles.status, 'completed', 'the source discussion is untouched');
    assert.ok(detail().unaccounted_discussions.includes('roles'), 'the freed source reads unaccounted again');
    assert.strictEqual(detail().build_order_needs_sequencing, true);
    assert.match(sim.render(['topic-receipt', `${wu}.specification.roles`, '--verb', 'cancel'], { expect: 'content' }), /Cancelled "Roles"\./);
    // Its start refuses it in the red register, naming the reactivate.
    assert.match(sim.render(['entry-gate', `${wu}.specification.roles`, '--own'], { expect: 'content' }),
      /⚑ "Roles" is cancelled[\s\S]*> Reactivate it from the epic menu \(`e\/reactivate`\)\./);

    // The cancelled key stays reserved: a grouping lands under a new name
    // and takes the freed source; under the cancelled name it is refused
    // with nothing written, and so is a delete of the cancelled item.
    const manifestBytes = () => fs.readFileSync(path.join(sim.dir, '.leeway', wu, 'manifest.json'), 'utf8');
    const groupingOps = (name, status) => sim.write(`.leeway/.cache/${wu}/specification/${name}-${status}-ops.json`,
      [{ op: 'set', path: `${wu}.specification.${name}`, fields: { status, sources: { roles: { status: 'pending' } } } }]);
    sim.run(['manifest', 'apply', wu, '--file', groupingOps('roles-v2', 'proposed')]);
    assert.ok(!detail().unaccounted_discussions.includes('roles'), 'the new grouping accounts for the freed source');
    const reserved = manifestBytes();
    sim.refuses(['manifest', 'apply', wu, '--file', groupingOps('roles', 'proposed')],
      /^specification item "roles" is cancelled — reactivate it instead \(engine topic reactivate cuts specification roles\)$/);
    sim.refuses(['manifest', 'apply', wu, '--file', sim.write(`.leeway/.cache/${wu}/specification/drop-ops.json`,
      [{ op: 'delete', path: `${wu}.specification`, field: 'items.roles' }])], /specification item "roles" is cancelled — reactivate it instead/);
    sim.refuses(['manifest', 'delete', `${wu}.specification.roles`, 'previous_order'], /specification item "roles" is cancelled — reactivate it instead/);
    assert.strictEqual(manifestBytes(), reserved, 'the refusals wrote nothing');

    // The freed source cancels, taking the proposed grouping over it.
    const freed = sim.run(['topic', 'cancel', wu, 'discovery', 'roles']);
    assert.deepStrictEqual([freed.cancelled, freed.discarded], [[{ phase: 'discussion', previous_status: 'completed' }], ['roles-v2']]);
    assert.strictEqual(sim.manifest(wu).phases.specification.items['roles-v2'], undefined);
    assert.deepStrictEqual(cancelledUnits(), ['discovery/roles', 'specification/roles']);

    // The specification cannot return over a cancelled source, nor over a
    // source another started specification has taken since; the reactivate
    // menu carries each hold on the row. Once both clear it returns with
    // its plan and its build order, discarding the proposed grouping over
    // its source.
    const specLock = () => detail().cancelled.find((u) => u.stage === 'specification' && u.name === 'roles').locked;
    sim.refuses(['topic', 'reactivate', wu, 'specification', 'roles'],
      /^reactivating "roles" is refused while its source "roles" is cancelled — reactivate the topic first$/);
    assert.strictEqual(specLock(), 'locked — its source "Roles" is cancelled; reactivate the topic first');
    sim.run(['topic', 'reactivate', wu, 'discovery', 'roles']);
    sim.run(['manifest', 'apply', wu, '--file', groupingOps('roles-v2', 'in-progress')]);
    sim.refuses(['topic', 'reactivate', wu, 'specification', 'roles'],
      /^reactivating "roles" is refused while the specification "roles-v2" sources "roles" — regroup the discussions from the menu \(s\/spec\)$/);
    assert.strictEqual(specLock(), 'locked — the specification "Roles V2" now sources "Roles"; regroup the discussions from the menu (s/spec)');
    sim.run(['topic', 'cancel', wu, 'specification', 'roles-v2']);
    sim.run(['manifest', 'apply', wu, '--file', groupingOps('roles-v3', 'proposed')]);
    assert.strictEqual(specLock(), undefined, 'a cancelled sibling and a proposed grouping hold nothing');
    const specBack = sim.run(['topic', 'reactivate', wu, 'specification', 'roles']);
    assert.deepStrictEqual(specBack.restored, [{ phase: 'specification', status: 'completed' }, { phase: 'planning', status: 'completed' }]);
    assert.deepStrictEqual(specBack.discarded, ['roles-v3']);
    assert.strictEqual(sim.manifest(wu).phases.specification.items['roles-v3'], undefined, 'the proposed grouping is gone, never cancelled');
    assert.strictEqual(sim.manifest(wu).phases.specification.items.roles.order, 1);
    assert.match(sim.render(['topic-receipt', `${wu}.specification.roles`, '--verb', 'reactivate'], { expect: 'content' }),
      /Reactivated "Roles"\. Restored specification \[completed\] · planning \[completed\]\./);
    sim.render(['entry-gate', `${wu}.specification.roles`, '--own'], { expect: 'empty' });
    assert.deepStrictEqual(cancelledUnits(), ['specification/roles-v2']);
    assert.strictEqual(detail().cancelled[0].locked, 'locked — the specification "Roles" now sources "Roles"; regroup the discussions from the menu (s/spec)');

    // A closed map row takes no message — dead-ended or cancelled — the
    // backstop for a peer closing the target under a landing; the cancel
    // marker sits over the dead end and lifts off it.
    sim.run(['discovery-map', 'handle', wu, 'export']);
    sim.refuses(sendArgv(sim, wu, 'export'), /^the topic "export" is closed as a dead end — reopening it goes through the epic menu's discovery row$/);
    sim.run(['topic', 'cancel', wu, 'discovery', 'export']);
    assert.match(sim.run(sendArgv(sim, wu, 'export')).inbox_path, /\/\.leeway\/\.inbox\/ideas\/\d{4}-\d{2}-\d{2}--a-message\.md$/,
      'a cancelled topic\'s message goes to the inbox as an idea');
    sim.refuses(['discovery-map', 'unhandle', wu, 'export'], /it's cancelled; reactivate it from the epic menu first/);
    sim.run(['topic', 'reactivate', wu, 'discovery', 'export']);
    assert.strictEqual(detail().discovery_map.find((r) => r.name === 'export').lifecycle, 'handled');
    sim.run(['discovery-map', 'unhandle', wu, 'export']);

    // A cancel that would take nothing refuses: an off-map topic whose only
    // item is superseded, a specification carrying no status.
    sim.run(['manifest', 'set', `${wu}.research.ghost`, 'status=superseded', 'superseded_by=auth']);
    sim.refuses(['topic', 'cancel', wu, 'discovery', 'ghost'], /^"ghost" has nothing to cancel — no live item under its name and no map row$/);
    sim.run(['manifest', 'set', `${wu}.specification.blank`, 'sources.roles.status', 'pending']);
    sim.refuses(['topic', 'cancel', wu, 'specification', 'blank'], /^specification "blank" has nothing to cancel — it carries no status$/);
    sim.run(['manifest', 'delete', `${wu}.research`, 'items.ghost']);
    sim.run(['manifest', 'delete', `${wu}.specification`, 'items.blank']);

    // A stash-less cancelled item returns to never-attempted.
    sim.run(['manifest', 'set', `${wu}.discussion.stale`, 'status', 'cancelled']);
    assert.deepStrictEqual(cancelledUnits(), ['discovery/stale', 'specification/roles-v2']);
    const revived = sim.run(['topic', 'reactivate', wu, 'discovery', 'stale']);
    assert.deepStrictEqual(revived.restored, [{ phase: 'discussion', status: null }]);
    assert.deepStrictEqual(sim.manifest(wu).phases.discussion.items.stale, {});
    sim.run(['manifest', 'delete', `${wu}.discussion`, 'items.stale']);

    // There is no phase-level cancel and no cascade.
    for (const phase of ['research', 'discussion', 'experiment', 'planning', 'implementation', 'review']) {
      sim.refuses(['topic', 'cancel', wu, phase, 'billing'], /^cancel is topic-level per stage — discovery/);
      sim.refuses(['topic', 'reactivate', wu, phase, 'billing'], /^reactivate is topic-level per stage — discovery/);
    }
    sim.refuses(['topic', 'cancel', wu, 'discovery', 'export', '--cascade'], /Usage: engine topic cancel <work-unit> <discovery\|specification> <topic>/);
  });

  it('epic topic postpone: the topic leaves for the roadmap, the roadmap owns it, and the pull brings it back', () => {
    const wu = 'later';
    sim.run(['workunit', 'create', wu, 'epic', '--description', 'Postpone units', '--session-log-file', sessionLog(sim, wu)]);
    sim.run(['discovery-map', 'add-batch', wu, '--file', sim.write(`.leeway/.cache/${wu}/discovery/topics.json`, [
      { name: 'fresh-one', routing: 'discussion', summary: 'Nothing started' },
      { name: 'researched', routing: 'research', summary: 'Research landed' },
      { name: 'decided', routing: 'discussion', summary: 'Discussion concluded' },
      { name: 'specd', routing: 'discussion', summary: 'Specified already' },
    ])]);
    sim.run(['discovery-map', 'sequence', wu, 'fresh-one=1', 'researched=2', 'decided=3', 'specd=4']);
    sim.run(['discovery-session', 'close', wu, '-m', `discovery(${wu}): shape the map`]);
    const detail = () => EPIC_GATEWAY.discover(sim.dir, wu);
    const postponable = () => epicPostponeMenu(detail()).keys.filter((k) => k.action === 'postpone').map((k) => k.topic);
    const pullable = () => epicPullForwardMenu(detail()).keys.filter((k) => k.action === 'pull-forward').map((k) => [k.topic, k.item]);
    const menuActions = () => epicMenu(wu, detail()).keys.map((k) => k.action);

    sim.run(['topic', 'start', wu, 'research', 'researched']);
    sim.write(`.leeway/${wu}/research/researched.md`, '# Research — researched\n');
    sim.run(['topic', 'complete', wu, 'research', 'researched']);
    for (const topic of ['decided', 'specd']) {
      sim.run(['topic', 'start', wu, 'discussion', topic]);
      sim.write(`.leeway/${wu}/discussion/${topic}.md`, `# Discussion — ${topic}\n`);
      sim.run(['topic', 'complete', wu, 'discussion', topic]);
    }
    sim.run(['topic', 'start', wu, 'specification', 'specd']);
    sim.run(['manifest', 'set', `${wu}.specification.specd`, 'sources.specd.status', 'incorporated']);

    // Every Discovery unit is offered; the spec'd one is locked with its reason.
    assert.deepStrictEqual(postponable(), ['decided', 'researched', 'fresh-one']);
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
    const second = sim.run(['topic', 'postpone', wu, 'researched', '--horizon', 'later']);
    assert.deepStrictEqual(second.roadmap, { name: 'researched', horizon: 'later', born_map: false, born_horizon: true, reverted_join: false });
    assert.deepStrictEqual(second.postponed, [{ phase: 'research', previous_status: 'completed' }]);
    sim.run(['topic', 'postpone', wu, 'decided', '--horizon', 'later']);

    // The lifecycle, the aggregation, the sequencing flag, and the epic's
    // own completion all walk past a topic that has left.
    const d = detail();
    assert.deepStrictEqual(d.postponed, [
      { name: 'decided', horizon: 'later', item: 'decided', waiting: true },
      { name: 'fresh-one', horizon: 'next', item: 'fresh-one', waiting: true },
      { name: 'researched', horizon: 'later', item: 'researched', waiting: true },
    ]);
    assert.strictEqual(d.discovery_map.find((r) => r.name === 'researched').lifecycle, 'postponed');
    assert.strictEqual(sim.read(['manifest', 'get', `${wu}.research.researched`, 'status']), 'postponed');
    assert.match(sim.render(['entry-gate', `${wu}.research.researched`, '--own'], { expect: 'content' }),
      /⚑ "Researched" is postponed to the roadmap[\s\S]*> Pull it forward from the epic menu \(`f\/forward`\)\./);
    assert.strictEqual(derivations.phaseStatus(sim.manifest(wu), 'research'), null, 'the only research item is postponed — the phase aggregates to nothing');
    assert.strictEqual(d.needs_sequencing, false, 'a postponed row carries no order and asks for none');
    assert.strictEqual(d.convergence_state, 'settled', 'a topic that has left holds convergence open no more than a cancelled one');
    assert.deepStrictEqual(d.postponable.map((u) => u.name), ['specd'], 'a postponed unit leaves the postpone list');
    assert.deepStrictEqual(postponable(), [], 'and the one unit left is locked, so nothing is pickable');
    assert.ok(!d.cancellable.some((u) => u.name === 'fresh-one'), 'a postponed unit leaves the cancel list too');
    // The gap analysis reads completed artifacts: the postponed research and
    // the postponed discussion both drop out of its input set.
    assert.deepStrictEqual(derivations.collectAnalysisInputs(sim.manifest(wu), path.join(sim.dir, '.leeway'), 'gap-analysis')
      .map((f) => path.basename(f)), ['specd.md']);

    // The roadmap owns it: cancel and reactivate refuse, a send lands.
    sim.refuses(['topic', 'cancel', wu, 'discovery', 'decided'], /"decided" is postponed — the roadmap owns it/);
    sim.refuses(['topic', 'reactivate', wu, 'discovery', 'decided'], /"decided" is postponed, not cancelled — pull it forward from the roadmap instead/);
    sim.write('.leeway/.cache/scratch/message-scratch.md', 'Mail that waits\n\nStill?\n');
    const held = JSON.stringify(sim.manifest(wu));
    const mail = sim.run(['topic', 'send', wu, 'decided', '--content', '.leeway/.cache/scratch/message-scratch.md', '--slug', 'mail-that-waits']);
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
    assert.deepStrictEqual(pullable(), [['decided', 'decided'], ['researched', 'researched']]);

    // The pull is the return: the same epic restores the unit it postponed.
    const back = sim.run(['roadmap', 'pull-forward', 'researched', '--into', wu]);
    assert.deepStrictEqual(back.restored, [{ phase: 'research', status: 'completed' }]);
    assert.match(sim.render(['topic-receipt', `${wu}.discovery.researched`, '--verb', 'restore'], { expect: 'content' }),
      /Pulled "Researched" forward\. Restored research \[completed\]\./);
    assert.strictEqual(sim.manifest(wu).phases.discovery.items.researched.order, 2, 'the map order returns');
    assert.strictEqual(sim.manifest(wu).phases.research.items.researched.status, 'completed');
    sim.render(['entry-gate', `${wu}.research.researched`, '--own'], { expect: 'empty' });
    assert.strictEqual('postponed_from' in sim.run(['roadmap', 'state']).items.find((i) => i.name === 'researched'), false);
    assert.strictEqual(sim.run(['roadmap', 'state']).items.find((i) => i.name === 'researched').state, 'in-flight');

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
    const stranded = sim.render(['entry-gate', `${wu}.discussion.decided`, '--own'], { expect: 'content' });
    assert.match(stranded, /> Its roadmap item has gone to another epic — the topic stays postponed here, with no way back\./);
    assert.ok(!stranded.includes('f/forward'));

    // A pulled-from-roadmap topic postponed again re-waits its own item.
    sim.run(['topic', 'postpone', next, 'decided', '--horizon', 'someday']);
    const rewaited = sim.run(['topic', 'postpone', wu, 'researched', '--horizon', 'someday']);
    assert.deepStrictEqual(rewaited.roadmap, { name: 'researched', horizon: 'someday', born_map: false, born_horizon: false, reverted_join: true });
    assert.strictEqual(sim.run(['roadmap', 'state']).items.find((i) => i.name === 'researched').state, 'waiting');
  });

  it('a discovery cancel from inside the conversation releases its own holds, and leaves a peer\'s standing', () => {
    const wu = 'cutsown';
    const peer = sim.session('peer-session', 1);
    researchBeneath(sim, wu, peer);

    const before = sim.run(['presence', 'scan', wu]);
    assert.strictEqual(presenceRow(before, 'discussion', 'alpha').held, true);
    assert.strictEqual(presenceRow(before, 'research', 'alpha').held, true);

    const taken = sim.run(['topic', 'cancel', wu, 'discovery', 'alpha']);
    assert.deepStrictEqual(taken.cancelled, [
      { phase: 'research', previous_status: 'in-progress' },
      { phase: 'discussion', previous_status: 'in-progress' },
    ]);
    const after = sim.run(['presence', 'scan', wu]);
    assert.strictEqual(presenceRow(after, 'discussion', 'alpha'), undefined, 'the caller\'s own hold is released with the item');
    const peerRow = presenceRow(after, 'research', 'alpha');
    assert.strictEqual(peerRow.held, true, 'the peer is still in its topic — a cancel never evicts another session');
    assert.strictEqual(peerRow.session_id, peer.id);
    // The session that cancelled its topic hands off to the epic menu, which
    // shows no banner: the receipt was the session's.
    assert.strictEqual(arriveAtEpicMenu(sim, wu, 'discussion', 'cancelled'), '');
  });

  it('a postpone releases its own holds too, and a peer\'s next commit over the hold clears rather than beats', () => {
    const wu = 'putsoff';
    const peer = sim.session('peer-session', 1);
    researchBeneath(sim, wu, peer);

    const taken = sim.run(['topic', 'postpone', wu, 'alpha', '--horizon', 'next']);
    assert.deepStrictEqual(taken.postponed, [
      { phase: 'research', previous_status: 'in-progress' },
      { phase: 'discussion', previous_status: 'in-progress' },
    ]);
    const after = sim.run(['presence', 'scan', wu]);
    assert.strictEqual(presenceRow(after, 'discussion', 'alpha'), undefined, 'the caller\'s own hold leaves with the topic');
    assert.strictEqual(presenceRow(after, 'research', 'alpha').held, true, 'a postpone never evicts another session');
    assert.strictEqual(arriveAtEpicMenu(sim, wu, 'discussion', 'postponed'), '');

    // The peer's own cadence commit meets a topic that has left: postponed is
    // terminal, so the commit releases the slot instead of re-taking it.
    peer.run(['commit', wu, '-m', `research(${wu}): last words`, '--topic', 'research/alpha']);
    assert.deepStrictEqual(sim.run(['presence', 'scan', wu]).sessions, []);
  });

  it('a specification cancel releases the calling session\'s specification and planning holds', () => {
    const wu = 'cutsplan';
    mappedEpic(sim, wu, ['gamma']);
    sim.run(['topic', 'start', wu, 'specification', 'gamma']);
    sim.write(`.leeway/${wu}/specification/gamma/specification.md`, '# Spec — gamma\n');
    // A plan is born on a settled record alone, so the specification
    // concludes before the plan opens beneath it.
    sim.run(['topic', 'complete', wu, 'specification', 'gamma']);
    sim.run(['topic', 'start', wu, 'planning', 'gamma']);
    assert.strictEqual(presenceRow(sim.run(['presence', 'scan', wu]), 'planning', 'gamma').held, true);

    const taken = sim.run(['topic', 'cancel', wu, 'specification', 'gamma']);
    assert.deepStrictEqual(taken.cancelled, [
      { phase: 'specification', previous_status: 'completed' },
      { phase: 'planning', previous_status: 'in-progress' },
    ]);
    assert.deepStrictEqual(sim.run(['presence', 'scan', wu]).sessions, [],
      'both units of the Definition stage release together');
  });

  it('a cancel from the epic menu — a session owning nothing on the unit — touches no row', () => {
    const wu = 'cutsmenu';
    mappedEpic(sim, wu, ['delta']);
    const peer = sim.session('peer-session', 1);
    peer.run(['topic', 'start', wu, 'discussion', 'delta']);

    sim.run(['topic', 'cancel', wu, 'discovery', 'delta']);
    const row = presenceRow(sim.run(['presence', 'scan', wu]), 'discussion', 'delta');
    assert.strictEqual(row.held, true, 'the menu session owns nothing here, so it releases nothing');
    assert.strictEqual(row.session_id, peer.id);
  });

  it('a reactivate releases nothing — the session sitting in the restored topic keeps its hold', () => {
    const wu = 'cutsback';
    mappedEpic(sim, wu, ['epsilon']);
    sim.run(['topic', 'start', wu, 'discussion', 'epsilon']);
    sim.run(['topic', 'cancel', wu, 'discovery', 'epsilon']);
    assert.deepStrictEqual(sim.run(['presence', 'scan', wu]).sessions, []);

    sim.run(['presence', 'beat', wu, 'discussion', 'epsilon']);
    sim.run(['topic', 'reactivate', wu, 'discovery', 'epsilon']);
    assert.strictEqual(presenceRow(sim.run(['presence', 'scan', wu]), 'discussion', 'epsilon').held, true);
  });
});
