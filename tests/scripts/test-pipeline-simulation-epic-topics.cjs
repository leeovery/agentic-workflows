'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's epic topic lifecycle: a topic cancelled at
// each stage, a later stage locking the earlier; and the holds a cancel, a
// postpone, a specification cancel or a reactivate releases, or leaves
// standing. A topic postponed to the roadmap and pulled back is
// test-pipeline-simulation-epic-postpone.cjs.
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
const EPIC_GATEWAY = require(path.join(ROOT, 'skills/leeway-continue-epic/scripts/gateway.cjs'));
const { epicMenu, epicCancelMenu } = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/projections/epic.cjs'));
const {
  Sim, mapTopics, sessionLog, sendArgv, mappedEpic, presenceRow, arriveAtEpicMenu, askedOn, enterEntry, decideTopic, discussed,
} = require('./pipeline-world.cjs');

describe('pipeline simulation: epic-topics', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('epic topic cancel: one unit per stage, a later stage locking the earlier, waits released before the holders close', () => {
    const wu = 'cuts';
    sim.run(['workunit', 'create', wu, 'epic', '--description', 'Cancel units', '--session-log-file', sessionLog(sim, wu)]);
    mapTopics(sim, wu, [
      { name: 'export', summary: 'Data export' },
      { name: 'auth', summary: 'Auth flow' },
      { name: 'billing', summary: 'Billing' },
      { name: 'roles', summary: 'Roles' },
    ]);
    sim.run(['topic', 'order', wu, 'export=1', 'auth=2', 'billing=3', 'roles=4']);
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
      { source: 'discovery', summary: 'Data export', cancelled: true, previous_order: 1 });
    assert.match(sim.render(['topic-receipt', `${wu}.discovery.export`, '--verb', 'cancel'], { expect: 'content' }), /Cancelled "Export"\./);
    assert.deepStrictEqual(cancelledUnits(), ['discovery/export']);
    assert.deepStrictEqual(menuOptions(), ['a', 'e']);
    sim.refuses(['topic', 'remove', wu, 'export'], /^"export" can't be removed — it is cancelled and stays on the map as record; reactivate it from the epic menu first$/);
    sim.refuses(['topic', 'cancel', wu, 'discovery', 'export'], /"export" is already cancelled/);
    const returned = sim.run(['topic', 'reactivate', wu, 'discovery', 'export']);
    assert.deepStrictEqual(returned.restored, []);
    assert.deepStrictEqual(sim.manifest(wu).phases.discovery.items.export, { source: 'discovery', summary: 'Data export', order: 1 });
    assert.match(sim.render(['topic-receipt', `${wu}.discovery.export`, '--verb', 'reactivate'], { expect: 'content' }), /Reactivated "Export"\.\n/);
    assert.deepStrictEqual(cancelledUnits(), []);

    // A started topic: a discussion in flight with a spawned experiment, a
    // message waiting in its mailbox, and a proposed grouping over its
    // discussion. The cancel takes all of it in one write — the wait
    // released first, so the flag lands on the holder while it is still
    // live.
    enterEntry(sim, wu, 'discussion', 'auth');
    sim.write(`.leeway/${wu}/topics/auth/log.md`, '# Discussion — Auth\n');
    const latency = askedOn(sim, wu, 'auth', 'What latency does auth hold to?');
    const e1 = sim.run(['experiment', 'create', wu, 'auth', '--slug', 'latency', '--from', 'discussion', '--question', latency,
      '--problem', sim.write(`.leeway/.cache/${wu}/discussion/auth/problem.md`, '# Problem — latency\n')]);
    assert.strictEqual(e1.id, 'E1');
    sim.write('.leeway/.cache/scratch/message-scratch.md', 'Token lifetime\n\nHow long?\n');
    sim.run(['topic', 'send', wu, 'auth', '--from', 'billing', '--content', '.leeway/.cache/scratch/message-scratch.md', '--slug', 'token-lifetime']);
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
    // Its waiting message went to the inbox as an idea, and the receipt says so.
    assert.deepStrictEqual([taken.inbox.length, JSON.parse(sim.read(['topic', 'mailbox', wu, 'auth'])).count], [1, 0]);
    assert.match(sim.render(['topic-receipt', `${wu}.discovery.auth`, '--verb', 'cancel', '--inbox', String(taken.inbox.length)], { expect: 'content' }),
      /Cancelled "Auth"\. Its 1 waiting message went to the inbox as an idea\./);
    let m = sim.manifest(wu);
    assert.deepStrictEqual(m.phases.discussion.items.auth, { status: 'cancelled', previous_status: 'in-progress' });
    assert.strictEqual(m.phases.experiment.items.auth.status, 'completed', 'the series settles over its abandoned record');
    assert.strictEqual(m.phases.experiment.items.auth.experiments.E1.reason, 'topic cancelled');
    assert.strictEqual(m.phases.specification.items.grouping, undefined, 'the proposed grouping is discarded, never cancelled');
    assert.strictEqual(m.phases.discovery.items.auth.cancelled, true);
    assert.ok(!epicMenu(wu, detail()).keys.some((k) => k.action === 'continue_experiment'), 'no live record, no laboratory row');
    assert.deepStrictEqual(cancelledUnits(), ['discovery/auth']);
    // The conversation's entry refuses the cancelled topic, naming the reactivate.
    sim.refuses(['enter', 'discussion', wu, 'auth'], /^the topic "auth" is cancelled — reactivating it goes through the epic menu/);

    // The reactivate restores the conversation, no message waiting in it;
    // its open question answered, the topic is decided.
    const back = sim.run(['topic', 'reactivate', wu, 'discovery', 'auth']);
    assert.deepStrictEqual(back.restored, [{ phase: 'discussion', status: 'in-progress' }]);
    assert.match(sim.render(['topic-receipt', `${wu}.discovery.auth`, '--verb', 'reactivate'], { expect: 'content' }),
      /Reactivated "Auth"\. Restored discussion \[in-progress\]\./);
    enterEntry(sim, wu, 'discussion', 'auth');
    const claudes = { by: 'claude', who_moved_whom: 'none' };
    sim.run(['ledger', 'decide', `${wu}.discussion.auth`, '--answers', latency], null, JSON.stringify({ ...claudes, text: 'Under 200 ms.', why: 'The abandoned experiment left the budget as it stood.' }));
    decideTopic(sim, wu, 'auth');

    // The Definition stage: roles specified and planned; billing specified,
    // planned, and under implementation.
    for (const topic of ['billing', 'roles']) {
      discussed(sim, wu, topic);
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

    // A cancelled map row takes no message — the backstop for a peer closing
    // the target under a landing.
    sim.run(['topic', 'cancel', wu, 'discovery', 'export']);
    assert.match(sim.run(sendArgv(sim, wu, 'export', 'auth')).inbox_path, /\/\.leeway\/\.inbox\/ideas\/\d{4}-\d{2}-\d{2}--a-message\.md$/,
      'a cancelled topic\'s message goes to the inbox as an idea');
    sim.run(['topic', 'reactivate', wu, 'discovery', 'export']);

    // A cancel that would take nothing refuses: an off-map topic whose only
    // item is promoted, a specification carrying no status.
    sim.run(['manifest', 'set', `${wu}.discussion.ghost`, 'status=promoted', 'promoted_to=elsewhere']);
    sim.refuses(['topic', 'cancel', wu, 'discovery', 'ghost'], /^"ghost" has nothing to cancel — no live item under its name and no map row$/);
    sim.run(['manifest', 'set', `${wu}.specification.blank`, 'sources.roles.status', 'pending']);
    sim.refuses(['topic', 'cancel', wu, 'specification', 'blank'], /^specification "blank" has nothing to cancel — it carries no status$/);
    sim.run(['manifest', 'delete', `${wu}.specification`, 'items.blank']);

    // A stash-less cancelled item returns to never-attempted.
    sim.run(['manifest', 'set', `${wu}.discussion.stale`, 'status', 'cancelled']);
    assert.deepStrictEqual(cancelledUnits(), ['discovery/stale', 'specification/roles-v2']);
    const revived = sim.run(['topic', 'reactivate', wu, 'discovery', 'stale']);
    assert.deepStrictEqual(revived.restored, [{ phase: 'discussion', status: null }]);
    assert.deepStrictEqual(sim.manifest(wu).phases.discussion.items.stale, {});
    sim.run(['manifest', 'delete', `${wu}.discussion`, 'items.stale']);

    // There is no phase-level cancel and no cascade.
    for (const phase of ['discussion', 'experiment', 'planning', 'implementation', 'review']) {
      sim.refuses(['topic', 'cancel', wu, phase, 'billing'], /^cancel is topic-level per stage — discovery/);
      sim.refuses(['topic', 'reactivate', wu, phase, 'billing'], /^reactivate is topic-level per stage — discovery/);
    }
    sim.refuses(['topic', 'cancel', wu, 'discovery', 'export', '--cascade'], /Usage: engine topic cancel <work-unit> <discovery\|specification> <topic>/);
  });

  it('a discovery cancel from inside the conversation releases its own holds, and leaves a peer\'s standing', () => {
    const wu = 'cutsown';
    const peer = sim.session('peer-session', 1);
    // A discussion in flight on alpha with the experiment it spawned beneath
    // it, a peer sitting in the laboratory.
    mappedEpic(sim, wu, ['alpha']);
    enterEntry(sim, wu, 'discussion', 'alpha');
    sim.run(['experiment', 'create', wu, 'alpha', '--slug', 'latency', '--from', 'discussion', '--question', askedOn(sim, wu, 'alpha', 'What latency does alpha hold to?'),
      '--problem', sim.write(`.leeway/.cache/${wu}/discussion/alpha/problem.md`, '# Problem — latency\n')]);
    peer.run(['presence', 'beat', wu, 'experiment', 'alpha']);

    const before = sim.run(['presence', 'scan', wu]);
    assert.strictEqual(presenceRow(before, 'discussion', 'alpha').held, true);
    assert.strictEqual(presenceRow(before, 'experiment', 'alpha').held, true);

    const taken = sim.run(['topic', 'cancel', wu, 'discovery', 'alpha']);
    assert.deepStrictEqual(taken.cancelled, [{ phase: 'discussion', previous_status: 'in-progress' }]);
    assert.deepStrictEqual(taken.abandoned, ['E1']);
    const after = sim.run(['presence', 'scan', wu]);
    assert.strictEqual(presenceRow(after, 'discussion', 'alpha'), undefined, 'the caller\'s own hold is released with the item');
    const peerRow = presenceRow(after, 'experiment', 'alpha');
    assert.strictEqual(peerRow.held, true, 'the peer is still in its topic — a cancel never evicts another session');
    assert.strictEqual(peerRow.session_id, peer.id);
    // The session that cancelled its topic hands off to the epic menu, which
    // shows no banner: the receipt was the session's.
    assert.strictEqual(arriveAtEpicMenu(sim, wu, 'discussion', 'cancelled'), '');
  });

  it('a postpone releases its own hold and never a peer\'s, whose next commit over it clears rather than beats', () => {
    const wu = 'putsoff';
    const peer = sim.session('peer-session', 1);
    mappedEpic(sim, wu, ['alpha', 'beta']);
    enterEntry(sim, wu, 'discussion', 'alpha');
    peer.run(['enter', 'discussion', wu, 'beta']);

    const taken = sim.run(['topic', 'postpone', wu, 'alpha', '--horizon', 'next']);
    assert.deepStrictEqual(taken.postponed, [{ phase: 'discussion', previous_status: 'in-progress' }]);
    assert.strictEqual(presenceRow(sim.run(['presence', 'scan', wu]), 'discussion', 'alpha'), undefined, 'the caller\'s own hold leaves with the topic');
    assert.strictEqual(arriveAtEpicMenu(sim, wu, 'discussion', 'postponed'), '');

    // Back at the menu, the session postpones the topic a peer sits in.
    sim.run(['topic', 'postpone', wu, 'beta', '--horizon', 'next']);
    assert.strictEqual(presenceRow(sim.run(['presence', 'scan', wu]), 'discussion', 'beta').held, true, 'a postpone never evicts another session');

    // The peer's own cadence commit meets a topic that has left: postponed is
    // terminal, so the commit releases the slot instead of re-taking it.
    peer.run(['commit', wu, '-m', `discussion(${wu}/beta): last words`, '--topic', 'discussion/beta']);
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
    peer.run(['presence', 'beat', wu, 'discussion', 'delta']);

    sim.run(['topic', 'cancel', wu, 'discovery', 'delta']);
    const row = presenceRow(sim.run(['presence', 'scan', wu]), 'discussion', 'delta');
    assert.strictEqual(row.held, true, 'the menu session owns nothing here, so it releases nothing');
    assert.strictEqual(row.session_id, peer.id);
  });

  it('a reactivate releases nothing — the session sitting in the restored topic keeps its hold', () => {
    const wu = 'cutsback';
    mappedEpic(sim, wu, ['epsilon']);
    enterEntry(sim, wu, 'discussion', 'epsilon');
    sim.run(['topic', 'cancel', wu, 'discovery', 'epsilon']);
    assert.deepStrictEqual(sim.run(['presence', 'scan', wu]).sessions, []);

    sim.run(['presence', 'beat', wu, 'discussion', 'epsilon']);
    sim.run(['topic', 'reactivate', wu, 'discovery', 'epsilon']);
    assert.strictEqual(presenceRow(sim.run(['presence', 'scan', wu]), 'discussion', 'epsilon').held, true);
  });
});
