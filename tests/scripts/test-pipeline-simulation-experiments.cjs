'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's experiments: an epic's spawn, walk to verdict,
// splits, releases and series; a feature's waiting conversation routed to
// the laboratory and back; the question on the map an experiment measures,
// and its report reaching the topic as a message once that question closed;
// and the single-topic backs re-rendering the start menu.
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
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '../..');
const EPIC_GATEWAY = require(path.join(ROOT, 'skills/leeway-continue-epic/scripts/gateway.cjs'));
const {
  epicMenu, epicDashboard,
} = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/projections/epic.cjs'));
const { drawLabel } = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/projections/surfaces.cjs'));
const {
  Sim, sessionLog, carryOn, menuEntry, handoffEntry, handoff, bridgeTo, arriveAtEpicMenu, pauseCheck, startKeys,
} = require('./pipeline-world.cjs');

describe('pipeline simulation: experiments', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('epic experiments: spawn, the walk to verdict, splits, releases, series continuation', () => {
    const wu = 'lab';
    sim.run(['workunit', 'create', wu, 'epic', '--description', 'Measured decisions', '--session-log-file', sessionLog(sim, wu)]);
    const topics = sim.write(`.leeway/.cache/${wu}/discovery/topics.json`, [
      { name: 'timing', routing: 'discussion', summary: 'Timing behaviour' },
      { name: 'layout', routing: 'discussion', summary: 'Layout rules' },
    ]);
    sim.run(['discovery-map', 'add-batch', wu, '--file', topics]);
    sim.run(['discovery-session', 'close', wu, '-m', `discovery(${wu}): shape the map`]);
    menuEntry(sim, wu);
    handoffEntry(sim, wu, 'discussion', 'timing');
    sim.run(['topic', 'start', wu, 'discussion', 'timing']);
    sim.write(`.leeway/${wu}/discussion/timing.md`, '# Discussion — Timing\n');
    menuEntry(sim, wu);
    handoffEntry(sim, wu, 'discussion', 'layout');
    sim.run(['topic', 'start', wu, 'discussion', 'layout']);
    sim.write(`.leeway/${wu}/discussion/layout.md`, '# Discussion — Layout\n');

    // The spawn, mid-discussion: id + item + the problem statement + the
    // spawning item's lock, one transaction — the session writes the problem
    // to a cache scratch and the create installs it, so no conceived record
    // ever exists without its problem file. The cadence commit picks the
    // record up.
    const e1Problem = sim.write(`.leeway/.cache/${wu}/discussion/timing/problem.md`,
      '# Problem — window placement\n\n*From: timing · discussion*\n');
    const e1 = sim.run(['experiment', 'create', wu, 'timing', '--slug', 'window-placement', '--from', 'discussion', '--problem', e1Problem]);
    assert.strictEqual(e1.id, 'E1');
    assert.strictEqual(e1.dir, path.join(sim.dir, `.leeway/${wu}/topics/timing/experiments/E1-window-placement`));
    assert.deepStrictEqual(e1.awaiting, { phase: 'discussion', ids: ['E1'] });
    assert.ok(fs.existsSync(path.join(e1.dir, 'problem.md')), 'the create installs the problem statement');
    assert.ok(!fs.existsSync(path.join(sim.dir, e1Problem)), 'the scratch is consumed');
    sim.run(['commit', wu, '-m', `discussion(${wu}/timing): spawn E1 window-placement`, '--topic', 'discussion/timing']);
    // The spawning session commits the record --sweep — the experiment topic
    // is the laboratory's slot, never the spawner's to claim.
    sim.run(['commit', wu, '-m', `experiment(${wu}/timing): E1 problem statement`, '--topic', 'experiment/timing', '--sweep']);

    // The now-or-later choice rides the recorded spawn — addressed to the
    // spawning item, refused for an id it holds no wait on.
    assert.match(sim.render(['experiment-spawn-gate', `${wu}.discussion.timing`, '--id', 'E1'], { expect: 'content' }),
      /Work E1 now\?/);
    sim.refuses(['render', 'experiment-spawn-gate', `${wu}.discussion.timing`, '--id', 'E9'],
      /holds no evidence wait on E9/);

    // Another topic's spawn numbers its own series.
    const e2 = sim.run(['experiment', 'create', wu, 'layout', '--slug', 'grid-density', '--from', 'discussion',
      '--problem', sim.write(`.leeway/.cache/${wu}/discussion/layout/problem.md`, '# Problem — grid density\n')]);
    assert.strictEqual(e2.id, 'E1');

    // The menu is experiment-shaped: one leading entry per topic with live
    // records, ranked above every other recommendation — which record to
    // work resolves inside the phase, never in the route.
    const menu = epicMenu(wu, EPIC_GATEWAY.discover(sim.dir, wu));
    const expEntries = menu.keys.filter((k) => k.action === 'continue_experiment');
    assert.deepStrictEqual(expEntries.map((k) => [k.key, k.topic]),
      [['1', 'timing'], ['2', 'layout']]);
    assert.strictEqual(expEntries.some((k) => k.recommended), true, 'a live experiment leads the recommendations');
    assert.match(expEntries[0].route, new RegExp(`^/leeway-experiment-process epic ${wu} timing$`));
    assert.match(drawLabel(expEntries[0].label), /1 experiment queued/);
    sim.render(['epic-soft-gate', wu, '--action', 'continue_experiment', '--topic', 'timing'], { expect: 'empty' });

    // Both waiting conversations refuse to conclude while their evidence is
    // out; the wait gate is the refusal's graceful face, and it renders only
    // over a live wait — empty where nothing blocks.
    sim.refuses(['topic', 'complete', wu, 'discussion', 'timing'], /awaits experiment evidence \(E1\)/);
    sim.refuses(['topic', 'complete', wu, 'discussion', 'layout'], /awaits experiment evidence \(E1\)/);
    assert.match(sim.render(['wait-gate', `${wu}.discussion.timing`], { expect: 'content' }),
      /Conclusion blocked — this discussion awaits experiment evidence \(E1\)/);
    // A yes at either pause runs the in-flight check — a review this session
    // dispatched is still running, so the gate asks in the pause's words, and
    // a proceed leaves it running — then hands the session to the bridge and
    // on to the epic menu, whose banner names each waiting conversation.
    sim.run(['agent', 'dispatch', wu, 'discussion', 'timing', '--kind', 'review']);
    assert.deepStrictEqual(pauseCheck(sim, wu, 'discussion', 'timing').map((r) => r.id), ['review-001']);
    assert.match(arriveAtEpicMenu(sim, wu, 'discussion', 'paused'),
      /\nDiscussion paused for ".*" — "Timing" awaits experiment evidence \(E1\); "Layout" awaits experiment evidence \(E1\)\.\n$/);

    // The walk to verdict: design → the register and the briefing freeze →
    // run → conclude. The freeze is its own verb; the approval gate renders
    // only over a designed record.
    // The dashboard renders over the live series — the waiting cue on the
    // map row, the state audited whole after the spawn transactions.
    assert.match(epicDashboard(wu, EPIC_GATEWAY.discover(sim.dir, wu)), /awaiting E1/);

    menuEntry(sim, wu);
    handoffEntry(sim, wu, 'experiment', 'timing');
    sim.write(`${e1.dir}/design.md`, '# Design — E1\n\nQuestion, prediction, decision rule.\n');
    sim.run(['experiment', 'advance', wu, 'timing', 'E1']);
    assert.match(sim.render(['experiment-register', `${wu}.experiment.timing`], { expect: 'content' }),
      /Experiments — Timing \(1 experiment\)/);
    assert.match(sim.render(['experiment-approval-gate', `${wu}.experiment.timing`, '--id', 'E1'], { expect: 'content' }),
      /Approve E1's design\?/);
    sim.run(['experiment', 'approve', wu, 'timing', 'E1']);
    sim.run(['experiment', 'advance', wu, 'timing', 'E1']);

    // A split: the running question decomposes into sub-experiments walked in
    // miniature; the lock stays on E1 and the parent's verdict waits for them.
    const sub = sim.run(['experiment', 'create', wu, 'timing', '--slug', 'single-monitor', '--parent', 'E1']);
    assert.strictEqual(sub.id, 'E1.1');
    assert.strictEqual(sub.dir, path.join(sim.dir, `.leeway/${wu}/topics/timing/experiments/E1-window-placement/E1.1-single-monitor`));
    sim.refuses(['experiment', 'conclude', wu, 'timing', 'E1', '--verdict', 'held'], /live sub-experiments/);
    sim.write(`${sub.dir}/design.md`, '# Design — E1.1\n');
    sim.run(['experiment', 'advance', wu, 'timing', 'E1.1']);
    sim.run(['experiment', 'approve', wu, 'timing', 'E1.1']);
    sim.run(['experiment', 'advance', wu, 'timing', 'E1.1']);
    const subDone = sim.run(['experiment', 'conclude', wu, 'timing', 'E1.1', '--verdict', 'placed correctly']);
    assert.strictEqual(subDone.released_waits, undefined, 'a sub releases nothing — the lock is the parent to release');

    // The parent's conclusion synthesises the subs, releases the wait once,
    // and flags the conversation so its re-entry surfaces the evidence.
    sim.write(`${e1.dir}/report.md`, '# Report — E1\n\nResults, verdict, reproduce notes.\n');
    const verdict = sim.run(['experiment', 'conclude', wu, 'timing', 'E1', '--verdict', 'all layouts placed correctly; adopted']);
    assert.deepStrictEqual(verdict.released_waits, [{ phase: 'discussion', released: ['E1'], remaining: [] }]);
    assert.strictEqual(verdict.item_status, 'completed', 'timing\'s records are all terminal — the item closes itself');
    sim.run(['commit', wu, '-m', `experiment(${wu}/timing): conclude E1 — adopted`, '--topic', 'experiment/timing']);
    const timing = sim.manifest(wu).phases.discussion.items.timing;
    assert.strictEqual(timing.awaiting_experiments, undefined);
    assert.strictEqual(timing.reconcile_needed, 'experiment');

    // The released conversation reconciles — at re-entry, or at its next
    // check in session — and concludes; the completion refuses until the
    // evidence is read and the flag cleared (prose-owned — simulated here).
    sim.refuses(['topic', 'complete', wu, 'discussion', 'timing'],
      /^discussion "timing" carries reconcile_needed: experiment — an experiment wait released beneath this conversation — evidence, or an abandonment; read what landed into the session and clear the flag before concluding$/);
    sim.run(['manifest', 'delete', `${wu}.discussion.timing`, 'reconcile_needed']);
    sim.run(['topic', 'complete', wu, 'discussion', 'timing']);
    sim.run(['commit', wu, '-m', `discussion(${wu}): complete timing discussion`, '--topic', 'discussion/timing']);

    // Series continuation: the next questions spawn E2 and E3 onto the
    // completed series and reopen it; abandonment is the other release — the
    // waiting point reverts to open, no downstream hop.
    sim.run(['topic', 'reopen', wu, 'discussion', 'timing']);
    const next = sim.run(['experiment', 'create', wu, 'timing', '--slug', 'multi-monitor', '--from', 'discussion',
      '--problem', sim.write(`.leeway/.cache/${wu}/discussion/timing/problem.md`, '# Problem — multi-monitor\n')]);
    assert.strictEqual(next.id, 'E2');
    const third = sim.run(['experiment', 'create', wu, 'timing', '--slug', 'stacking-order', '--from', 'discussion',
      '--problem', sim.write(`.leeway/.cache/${wu}/discussion/timing/problem.md`, '# Problem — stacking order\n')]);
    assert.strictEqual(third.id, 'E3');
    // Entered over two live records, the laboratory puts the pick to the
    // user, and a back out of it hands the work to the epic menu with no
    // banner — nothing ended.
    assert.match(sim.render(['experiment-pick', `${wu}.experiment.timing`], { expect: 'content' }), /b\/back/);
    handoff(sim, `/leeway-continue-epic ${wu}`);
    // Reached from the return leg's gate instead, the same pick's back puts
    // that gate back — the person came to the picker through it.
    const offer = sim.render(['experiment-next-gate', `${wu}.experiment.timing`], { expect: 'content' });
    assert.match(sim.render(['experiment-pick', `${wu}.experiment.timing`], { expect: 'content' }), /b\/back/);
    assert.strictEqual(sim.render(['experiment-next-gate', `${wu}.experiment.timing`], { expect: 'content' }), offer,
      'the gate the picker was reached through is put back as it stood');
    const dropped = sim.run(['experiment', 'abandon', wu, 'timing', 'E2', '--reason', 'settled by E1 after all']);
    assert.deepStrictEqual(dropped.released_waits, [{ phase: 'discussion', released: ['E2'], remaining: ['E3'] }]);
    assert.strictEqual(dropped.item_status, 'in-progress', 'a live sibling keeps the item open');

    // The return leg re-renders the register — the series moved — ahead of
    // its gate: a record just closed and E3 still lives, so the session
    // offers the next experiment or the menu; once the series is finished
    // the gate refuses and the bridge exit follows.
    assert.match(sim.render(['experiment-register', `${wu}.experiment.timing`], { expect: 'content' }),
      /Experiments — Timing \(4 experiments\)[\s\S]*E2 multi-monitor\n.*↳ Abandoned — settled by E1 after all/);
    assert.match(sim.render(['experiment-next-gate', `${wu}.experiment.timing`], { expect: 'content' }),
      /The series still holds E3 stacking-order\./);
    const last = sim.run(['experiment', 'abandon', wu, 'timing', 'E3', '--reason', 'settled by E1 after all']);
    assert.deepStrictEqual(last.released_waits, [{ phase: 'discussion', released: ['E3'], remaining: [] }]);
    assert.strictEqual(last.item_status, 'completed', 'every record terminal closes the item');
    sim.refuses(['render', 'experiment-next-gate', `${wu}.experiment.timing`], /no live experiments/);
    sim.run(['manifest', 'delete', `${wu}.discussion.timing`, 'reconcile_needed']);
    sim.run(['topic', 'complete', wu, 'discussion', 'timing']);

    // Cancellation is the release's menu-side edge, and the series belongs
    // to its topic: the cancel gate names the record that ends abandoned,
    // the topic's cancel releases layout's wait (the flag landing while the
    // holder is live) and abandons the record, and the reactivate brings
    // the conversation back with the flag live. There is no series-level
    // cancel to refuse.
    sim.refuses(['topic', 'cancel', wu, 'experiment', 'layout'], /^cancel is topic-level per stage — discovery/);
    assert.match(sim.render(['cancel-gate', `${wu}.discovery.layout`], { expect: 'content' }).replace(/\n\u00a0+/g, ' '),
      /marks its discussion \[in-progress\] cancelled — it can be reactivated later\. 1 open experiment \(E1\) ends abandoned on the register\./);
    const cancelled = sim.run(['topic', 'cancel', wu, 'discovery', 'layout']);
    assert.deepStrictEqual(cancelled.released_waits, [{ phase: 'discussion', released: ['E1'], remaining: [] }]);
    assert.deepStrictEqual(cancelled.abandoned, ['E1'], 'the cancel closes every open record — no zombie survives');
    assert.strictEqual(sim.manifest(wu).phases.experiment.items.layout.experiments.E1.reason, 'topic cancelled');
    assert.strictEqual(sim.manifest(wu).phases.experiment.items.layout.status, 'completed', 'the series settles, never cancelled');
    assert.strictEqual(sim.manifest(wu).phases.discussion.items.layout.reconcile_needed, 'experiment', 'the release flagged the holder before it closed');
    sim.run(['topic', 'reactivate', wu, 'discovery', 'layout']);
    assert.strictEqual(sim.manifest(wu).phases.discussion.items.layout.status, 'in-progress');
    // An abandonment is a release too: the discussion reads it before it concludes.
    sim.refuses(['topic', 'complete', wu, 'discussion', 'layout'], /^discussion "layout" carries reconcile_needed: experiment/);
    sim.run(['manifest', 'delete', `${wu}.discussion.layout`, 'reconcile_needed']);
    sim.run(['topic', 'complete', wu, 'discussion', 'layout']);
    assert.ok(!epicMenu(wu, EPIC_GATEWAY.discover(sim.dir, wu)).keys
      .some((k) => k.action === 'continue_experiment'), 'terminal records retire from the menu');

    // The series is never reactivated on its own — its rows stand; a new
    // spawn from the reopened conversation revives it at the next id.
    sim.refuses(['topic', 'reactivate', wu, 'experiment', 'layout'], /^reactivate is topic-level per stage — discovery/);

    // Reopen: the series item is derived bookkeeping no phase's start
    // reconciles, so the settled series is left untouched.
    const reopened = sim.run(['topic', 'reopen', wu, 'discussion', 'layout']);
    assert.strictEqual(reopened.reconcile_flagged, undefined, 'no specification downstream — nothing takes the flag');
    assert.strictEqual(sim.manifest(wu).phases.experiment.items.layout.reconcile_needed, undefined,
      'the series item never takes a reconcile flag');

    const revived = sim.run(['experiment', 'create', wu, 'layout', '--slug', 'follow-up', '--from', 'discussion',
      '--problem', sim.write(`.leeway/.cache/${wu}/discussion/layout/problem.md`, '# Problem — follow-up\n')]);
    assert.strictEqual(revived.id, 'E2', 'the revival allocates the next id over the closed rows');
    assert.strictEqual(sim.manifest(wu).phases.experiment.items.layout.status, 'in-progress');
    const settled = sim.run(['experiment', 'abandon', wu, 'layout', 'E2', '--reason', 'settled without the follow-up']);
    assert.strictEqual(settled.item_status, 'completed');
    sim.run(['manifest', 'delete', `${wu}.discussion.layout`, 'reconcile_needed']);
    sim.run(['topic', 'complete', wu, 'discussion', 'layout']);
  });

  it('single-topic backs: the laboratory picker and the code gate re-render the start menu', () => {
    const wu = 'frame-rate';
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Frame pacing', '--session-log-file', sessionLog(sim, wu)]);
    menuEntry(sim, wu);
    handoffEntry(sim, wu, 'discussion', wu);
    sim.run(['topic', 'start', wu, 'discussion', wu]);
    sim.write(`.leeway/${wu}/discussion/${wu}.md`, `# Discussion — ${wu}\n`);
    for (const slug of ['vsync-cost', 'jank-budget']) {
      sim.run(['experiment', 'create', wu, wu, '--slug', slug, '--from', 'discussion',
        '--problem', sim.write(`.leeway/.cache/${wu}/discussion/${wu}/problem.md`, `# Problem — ${slug}\n`)]);
    }
    sim.run(['commit', wu, '-m', `discussion(${wu}): spawn E1 and E2`, '--topic', `discussion/${wu}`]);
    assert.deepStrictEqual(pauseCheck(sim, wu, 'discussion', wu), []);
    bridgeTo(sim, wu, 'experiment');
    sim.handOver();

    // Two live records put the pick to the user; a back out of it, on a unit
    // whose continue menu would hand straight back on, lands on the start
    // menu — the arrival recorded, the state re-read, the unit still there.
    assert.match(sim.render(['experiment-pick', `${wu}.experiment.${wu}`], { expect: 'content' }), /b\/back/);
    const startKey = () => startKeys(sim).find((k) => k.work_unit === wu);
    assert.strictEqual(sim.run(['session', 'repair']).repaired, false, 'the sim has no tmux label to put back');
    assert.strictEqual(carryOn(sim).position, null, 'the start menu is no position');
    assert.ok(startKey(), 'the start menu lists the unit the laboratory was entered from');

    // A peer holds the code slot; the gated session's back lands on the
    // start menu the same way.
    const holder = sim.session('code-session');
    holder.render(['code-gate', `${wu}.implementation.${wu}`], { expect: 'empty' });
    const gatedPid = spawnSync('node', ['-e', '']).pid;
    assert.ok(gatedPid, 'could not mint a dead pid');
    const gated = sim.session('review-session', gatedPid);
    assert.match(gated.render(['code-gate', `${wu}.review.${wu}`], { expect: 'content' }), /Another session is implementing/);
    assert.strictEqual(gated.run(['session', 'repair']).repaired, false, 'the sim has no tmux label to put back');
    assert.ok(startKey(), 'the start menu is re-rendered over the same state');
  });

  it('feature experiments: the waiting conversation routes to the laboratory and back', () => {
    const wu = 'render-path';
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Rendering decisions', '--session-log-file', sessionLog(sim, wu)]);
    menuEntry(sim, wu);
    handoffEntry(sim, wu, 'discussion', wu);
    sim.run(['topic', 'start', wu, 'discussion', wu]);
    sim.write(`.leeway/${wu}/discussion/${wu}.md`, `# Discussion — ${wu}\n`);

    // The spawn holds the conversation behind its evidence: the bridge routes
    // to the experiment until the wait releases — the now-and-later exits
    // land on the same state.
    const e1 = sim.run(['experiment', 'create', wu, wu, '--slug', 'frame-budget', '--from', 'discussion',
      '--problem', sim.write(`.leeway/.cache/${wu}/discussion/${wu}/problem.md`, '# Problem — frame budget\n')]);
    assert.ok(fs.existsSync(path.join(e1.dir, 'problem.md')), 'the spawn installs the problem statement');
    sim.run(['commit', wu, '-m', `discussion(${wu}): spawn E1 frame-budget`, '--topic', `discussion/${wu}`]);
    sim.refuses(['topic', 'complete', wu, 'discussion', wu], /awaits experiment evidence/);

    // The pause runs the in-flight check, then hands off to the laboratory,
    // which starts in a fresh context.
    assert.deepStrictEqual(pauseCheck(sim, wu, 'discussion', wu), []);
    bridgeTo(sim, wu, 'experiment');
    handoffEntry(sim, wu, 'experiment', wu);
    sim.run(['experiment', 'advance', wu, wu, 'E1']);
    sim.run(['experiment', 'approve', wu, wu, 'E1']);
    sim.run(['experiment', 'advance', wu, wu, 'E1']);
    sim.run(['experiment', 'conclude', wu, wu, 'E1', '--verdict', 'budget holds at 60fps']);
    sim.run(['commit', wu, '-m', `experiment(${wu}): conclude E1`, '--topic', `experiment/${wu}`]);

    // The verdict lands the route back on the conversation, which reads the
    // evidence before it can conclude.
    bridgeTo(sim, wu, 'discussion');
    assert.strictEqual(sim.manifest(wu).phases.discussion.items[wu].reconcile_needed, 'experiment');
    sim.refuses(['topic', 'complete', wu, 'discussion', wu], /carries reconcile_needed: experiment/);
    sim.run(['manifest', 'delete', `${wu}.discussion.${wu}`, 'reconcile_needed']);

    // A second spawn holds the conversation again; the record's abandon is
    // the release — the wait closes, the series settles over its terminal
    // records, and the holder carries the flag until its next entry. A
    // feature's topic is its work unit, so the topic-level cancel is the
    // epic's; the work-unit cancel abandons a feature whole.
    sim.run(['experiment', 'create', wu, wu, '--slug', 'input-latency', '--from', 'discussion',
      '--problem', sim.write(`.leeway/.cache/${wu}/discussion/${wu}/problem.md`, '# Problem — input latency\n')]);
    sim.refuses(['topic', 'complete', wu, 'discussion', wu], /awaits experiment evidence \(E2\)/);
    const dropped = sim.run(['experiment', 'abandon', wu, wu, 'E2', '--reason', 'settled by E1']);
    assert.deepStrictEqual(dropped.released_waits, [{ phase: 'discussion', released: ['E2'], remaining: [] }]);
    assert.strictEqual(sim.manifest(wu).phases.experiment.items[wu].experiments.E2.reason, 'settled by E1');
    assert.strictEqual(sim.manifest(wu).phases.experiment.items[wu].status, 'completed',
      'every record terminal — the derived status settles');
    assert.strictEqual(sim.manifest(wu).phases.discussion.items[wu].reconcile_needed, 'experiment',
      'the holder carries the release flag — the abandonment surfaces at its next entry');
    sim.run(['manifest', 'delete', `${wu}.discussion.${wu}`, 'reconcile_needed']);
    sim.run(['topic', 'complete', wu, 'discussion', wu]);
    bridgeTo(sim, wu, 'specification');
  });

  it('the question an experiment measures: waiting on the map while it runs, held from Claude\'s close, and its report a message once the person closed it first', () => {
    const wu = 'cold-start';
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Launch time', '--session-log-file', sessionLog(sim, wu)]);
    menuEntry(sim, wu);
    handoffEntry(sim, wu, 'discussion', wu);
    sim.run(['topic', 'start', wu, 'discussion', wu]);
    const at = `${wu}.discussion.${wu}`;
    const made = { by: 'claude', who_moved_whom: 'none' };
    const ledger = (/** @type {string[]} */ args, /** @type {Record<string, unknown>} */ content) => sim.run(['ledger', ...args], null, JSON.stringify(content)).id;

    // The spawn names the map's question it measures; the oracle holds the
    // map's waiting mark to the record after every call.
    const budget = ledger(['ask', at], { ...made, text: 'What launch time do we hold to?' });
    const e1 = sim.run(['experiment', 'create', wu, wu, '--slug', 'launch-budget', '--from', 'discussion', '--question', budget,
      '--problem', sim.write(`.leeway/.cache/${wu}/discussion/${wu}/problem.md`, '# Problem — launch budget\n')]);
    sim.run(['commit', wu, '-m', `discussion(${wu}): spawn E1 launch-budget`, '--topic', `discussion/${wu}`]);
    sim.refuses(['ledger', 'decide', at, '--answers', budget], /is measured by experiment E1, still running/, null,
      JSON.stringify({ ...made, text: 'Under a second.', why: 'It feels instant.' }));

    // The laboratory runs while the person closes the question themselves;
    // the report then reaches the topic as a message.
    bridgeTo(sim, wu, 'experiment');
    handoffEntry(sim, wu, 'experiment', wu);
    for (const step of ['advance', 'approve', 'advance']) sim.run(['experiment', step, wu, wu, 'E1']);
    ledger(['decide', at, '--answers', budget], { by: 'person', who_moved_whom: 'none', text: 'Under a second.', why: 'It feels instant.' });
    sim.write(path.relative(sim.dir, path.join(e1.dir, 'report.md')), '# Report — E1\n\nCold launch lands at 0.8 s.\n');
    const concluded = sim.run(['experiment', 'conclude', wu, wu, 'E1', '--verdict', 'under a second holds']);
    assert.strictEqual(concluded.report_sent.topic, wu, 'the question closed where it was asked, so the report goes back there');
    assert.ok(fs.existsSync(concluded.report_sent.message_path), 'the report waits in the topic\'s mailbox');
    sim.run(['commit', wu, '-m', `experiment(${wu}): conclude E1`, '--topic', `experiment/${wu}`]);
  });
});
