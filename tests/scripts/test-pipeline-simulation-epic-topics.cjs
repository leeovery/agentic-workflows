'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's epic topic lifecycle: a topic cancelled before
// and after its discussion starts; and the holds a cancel, a postpone or a
// reactivate releases, or leaves standing. A topic postponed to the roadmap and pulled back is
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
const {
  Sim, mapTopics, sessionLog, sendArgv, mappedEpic, presenceRow, arriveAtEpicMenu, epicSetAside, askedOn, enterEntry, decideTopic,
} = require('./pipeline-world.cjs');

describe('pipeline simulation: epic-topics', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('epic topic cancel: never started and started, waits released before the holders close', () => {
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
    const setAside = () => epicSetAside(sim, wu);

    // A never-started topic: gated, marked on the map alone and set aside on
    // the epic's menu, refused by the map's remove while cancelled, and
    // returned fresh.
    assert.match(sim.render(['cancel-gate', `${wu}.discovery.export`], { expect: 'content' }),
      /Cancelling \*\*Export\*\* takes it off the board — nothing has started, so only the map row is marked; it can be reactivated later\./);
    const marked = sim.run(['topic', 'cancel', wu, 'discovery', 'export']);
    assert.deepStrictEqual([marked.cancelled, marked.abandoned, marked.released_waits], [[], [], []]);
    assert.deepStrictEqual(sim.manifest(wu).phases.discovery.items.export,
      { source: 'discovery', summary: 'Data export', cancelled: true, previous_order: 1 });
    assert.match(sim.render(['topic-receipt', `${wu}.discovery.export`, '--verb', 'cancel'], { expect: 'content' }), /Cancelled "Export"\./);
    assert.deepStrictEqual(setAside(), ['└─ Export — cancelled']);
    sim.refuses(['topic', 'remove', wu, 'export'], /^"export" can't be removed — it is cancelled and stays on the map as record; reactivate it first: topic reactivate cuts discovery export$/);
    sim.refuses(['topic', 'cancel', wu, 'discovery', 'export'], /"export" is already cancelled/);
    const returned = sim.run(['topic', 'reactivate', wu, 'discovery', 'export']);
    assert.deepStrictEqual(returned.restored, []);
    assert.deepStrictEqual(sim.manifest(wu).phases.discovery.items.export, { source: 'discovery', summary: 'Data export', order: 1 });
    assert.match(sim.render(['topic-receipt', `${wu}.discovery.export`, '--verb', 'reactivate'], { expect: 'content' }), /Reactivated "Export"\.\n/);
    assert.deepStrictEqual(setAside(), []);

    // A started topic: a discussion in flight with a spawned experiment and
    // a message waiting in its mailbox. The cancel takes all of it in one
    // write — the wait
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
    assert.match(sim.render(['cancel-gate', `${wu}.discovery.auth`], { expect: 'content' }).replace(/\n\u00a0+/g, ' '),
      /Cancelling \*\*Auth\*\* marks its discussion \[in-progress\] cancelled — it can be reactivated later\. 1 open experiment \(E1\) ends abandoned on the register\./);
    const taken = sim.run(['topic', 'cancel', wu, 'discovery', 'auth']);
    assert.deepStrictEqual(taken.cancelled, [{ phase: 'discussion', previous_status: 'in-progress' }]);
    assert.deepStrictEqual(taken.released_waits, [{ phase: 'discussion', released: ['E1'], remaining: [] }]);
    assert.deepStrictEqual(taken.abandoned, ['E1']);
    // Its waiting message went to the inbox as an idea, and the receipt says so.
    assert.deepStrictEqual([taken.inbox.length, JSON.parse(sim.read(['topic', 'mailbox', wu, 'auth'])).count], [1, 0]);
    assert.match(sim.render(['topic-receipt', `${wu}.discovery.auth`, '--verb', 'cancel', '--inbox', String(taken.inbox.length)], { expect: 'content' }),
      /Cancelled "Auth"\. Its 1 waiting message went to the inbox as an idea\./);
    const m = sim.manifest(wu);
    assert.deepStrictEqual(m.phases.discussion.items.auth, { status: 'cancelled', previous_status: 'in-progress' });
    assert.strictEqual(m.phases.experiment.items.auth.status, 'completed', 'the series settles over its abandoned record');
    assert.strictEqual(m.phases.experiment.items.auth.experiments.E1.reason, 'topic cancelled');
    assert.strictEqual(m.phases.discovery.items.auth.cancelled, true);
    assert.deepStrictEqual(setAside(), ['└─ Auth — cancelled'], 'set aside, no row of its own leading into the laboratory');
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

    // A cancelled map row takes no message — the backstop for a peer closing
    // the target under a landing.
    sim.run(['topic', 'cancel', wu, 'discovery', 'export']);
    assert.match(sim.run(sendArgv(sim, wu, 'export', 'auth')).inbox_path, /\/\.leeway\/\.inbox\/ideas\/\d{4}-\d{2}-\d{2}--a-message\.md$/,
      'a cancelled topic\'s message goes to the inbox as an idea');
    sim.run(['topic', 'reactivate', wu, 'discovery', 'export']);


    // A stash-less cancelled item returns to never-attempted.
    sim.run(['manifest', 'set', `${wu}.discussion.stale`, 'status', 'cancelled']);
    const revived = sim.run(['topic', 'reactivate', wu, 'discovery', 'stale']);
    assert.deepStrictEqual(revived.restored, [{ phase: 'discussion', status: null }]);
    assert.deepStrictEqual(sim.manifest(wu).phases.discussion.items.stale, {});
    // A cancel that would take nothing refuses: an off-map topic with no
    // live item.
    sim.refuses(['topic', 'cancel', wu, 'discovery', 'stale'], /^"stale" has nothing to cancel — no live item under its name and no map row$/);
    sim.run(['manifest', 'delete', `${wu}.discussion`, 'items.stale']);

    // There is no phase-level cancel and no cascade.
    for (const phase of ['discussion', 'experiment', 'specification', 'planning', 'implementation', 'review']) {
      sim.refuses(['topic', 'cancel', wu, phase, 'billing'], /^cancel is topic-level — discovery/);
      sim.refuses(['topic', 'reactivate', wu, phase, 'billing'], /^reactivate is topic-level — discovery/);
    }
    sim.refuses(['topic', 'cancel', wu, 'discovery', 'export', '--cascade'], /Usage: engine topic cancel <work-unit> discovery <topic>/);
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
    // 18.S56: the session that cancelled its topic hands off onto the epic
    // menu, which sets it aside.
    assert.match(arriveAtEpicMenu(sim, wu, taken.next), /^SET ASIDE\n {2}└─ Alpha — cancelled$/m);
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
    assert.match(arriveAtEpicMenu(sim, wu, taken.next), /^SET ASIDE\n {2}└─ Alpha — postponed · roadmap next$/m, '18.S56: a postpone inside its session lands on the epic menu');

    // Back at the menu, the session postpones the topic a peer sits in.
    sim.run(['topic', 'postpone', wu, 'beta', '--horizon', 'next']);
    assert.strictEqual(presenceRow(sim.run(['presence', 'scan', wu]), 'discussion', 'beta').held, true, 'a postpone never evicts another session');

    // The peer's own cadence commit meets a topic that has left: postponed is
    // terminal, so the commit releases the slot instead of re-taking it.
    peer.run(['commit', wu, '-m', `discussion(${wu}/beta): last words`, '--topic', 'discussion/beta']);
    assert.deepStrictEqual(sim.run(['presence', 'scan', wu]).sessions, []);
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
