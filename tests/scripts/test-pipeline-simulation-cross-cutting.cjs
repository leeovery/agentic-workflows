'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's cross-cutting scenarios: the discussion to
// specification hop handing straight on, with nothing to revisit; a
// specification still being written stopping a peer's fresh plan, a
// completed one referenced; and a cross-cutting concern promoted out of an
// epic with its discussions, the roadmap's sources following the files.
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
const LINEAR_GATEWAY = require(path.join(ROOT, 'skills/leeway-continue-linear/scripts/gateway.cjs'));
const BRIDGE = require(path.join(ROOT, 'skills/leeway-bridge/scripts/gateway.cjs'));
const LIB = require(path.join(ROOT, 'skills/leeway-engine/scripts/lib.cjs'));
const { epicDashboard } = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/projections/epic.cjs'));
const {
  Sim, sessionLog, arrive, handoffEntry, enterEntry, handoff, decideTopic, discussed, bridgeTo, linearPick, startNew, send, sendArgv,
} = require('./pipeline-world.cjs');

const { specDetail } = require('./pipeline-oracle.cjs');

describe('pipeline simulation: cross-cutting', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('cross-cutting: the discussion→specification hop hands straight on, with nothing to revisit', () => {
    const wu = 'error-shape';
    startNew(sim, 'cross-cutting');
    sim.run(['workunit', 'create', wu, 'cross-cutting', '--description', 'One error envelope', '--session-log-file', sessionLog(sim, wu)]);
    // Cross-cutting goes to its discussion first, as a feature does.
    handoff(sim, `/leeway-discussion-process cross-cutting ${wu}`);
    assert.deepStrictEqual(discussed(sim, wu, wu).next, { kind: 'handoff', skill: 'leeway-specification-process', args: ['cross-cutting', wu] });
    // The decided discussion is no revisit — it reopens by a message — and
    // the pipeline ends at specification, so the bridge offers nothing.
    assert.match(BRIDGE.format(BRIDGE.discover(sim.dir, wu)), /^revisitable_phases: \(none\)$/m);
    // A session that stops here resumes from the cross-cutting continue menu,
    // which hands off where the bridge does.
    assert.strictEqual(linearPick(sim, wu, 'continue').line, `→ Specification · ${wu}`);
    bridgeTo(sim, wu, 'specification');
  });

  it('cross-cutting: a specification still being written stops a peer\'s fresh plan; a completed one is referenced', async () => {
    const cc = 'error-envelope';
    sim.run(['workunit', 'create', cc, 'cross-cutting', '--description', 'One error envelope', '--session-log-file', sessionLog(sim, cc)]);
    discussed(sim, cc, cc);
    sim.run(['topic', 'start', cc, 'specification', cc]);

    // The peer's fresh plan stops over it (cross-cutting-context B):
    // which specs bear on the plan is the session's read, so the names ride a
    // payload, and the surface checks each against the record.
    const peer = 'checkout-flow';
    sim.run(['workunit', 'create', peer, 'feature', '--description', 'Checkout flow', '--session-log-file', sessionLog(sim, peer)]);
    const units = sim.write(`.leeway/.cache/${peer}/planning/${peer}/cross-cutting.json`, { units: [cc] });
    assert.match(sim.render(['cross-cutting-gate', '--file', units], { expect: 'content' }), /• error-envelope/);
    // An unfinished spec is never offered as a reference (cross-cutting-context D).
    const refs = sim.write(`.leeway/.cache/${peer}/planning/${peer}/cross-cutting-references.json`, {
      units: [{ name: cc, summary: 'Every error leaves in one envelope.' }],
    });
    sim.refuses(['render', 'cross-cutting-references', '--file', refs],
      /"error-envelope" is not a cross-cutting work unit with a completed specification/);

    // Once the spec lands there is nothing left to warn a plan about — the
    // knowledge query surfaces it, and the plan references it instead.
    sim.write(`.leeway/${cc}/specification/${cc}/specification.md`,
      `# Spec — ${cc}\n\n## Envelope\n\nEvery error leaves in one envelope: a code, a message, and a trace id.\n`);
    assert.match(sim.render(['step-opening', `${cc}.specification.${cc}`, '--step', 'conclude'], { expect: 'content' }),
      /> Wrapping up\. Final assessment, sign-off, and closure — the pipeline completes here\./, 'a cross-cutting specification is terminal');
    sim.run(['topic', 'complete', cc, 'specification', cc]);
    // cross-cutting-context D: the query filtered to completed cross-cutting
    // specifications finds it, and nothing of the unit's discussion record.
    const surfaced = await sim.engineAsync(['knowledge', 'query', 'one error envelope for every failure',
      '--work-type', 'cross-cutting', '--phase', 'specification', '--limit', '10']);
    assert.strictEqual(surfaced.code, 0, surfaced.stderr);
    assert.match(surfaced.stdout, /^\[specification \| error-envelope\/error-envelope \| high \| \d{4}-\d{2}-\d{2}\]$/m);
    assert.doesNotMatch(surfaced.stdout, /^\[record \|/m);
    sim.refuses(['render', 'cross-cutting-gate', '--file', units],
      /"error-envelope" is not a cross-cutting work unit with a specification in progress/);
    assert.match(sim.render(['cross-cutting-references', '--file', refs], { expect: 'content' }),
      /• error-envelope: Every error leaves in one envelope\./);
  });

  it('spec promotion: a cross-cutting concern leaves the epic with its discussions, roadmap sources follow the files, and the unit routes to each moved discussion by name', () => {
    const wu = 'host';
    sim.run(['workunit', 'create', wu, 'epic', '--description', 'Hosts a cc message', '--session-log-file', sessionLog(sim, wu)]);
    const topics = sim.write(`.leeway/.cache/${wu}/discovery/topics.json`, [
      { name: 'logging', summary: 'Logging everywhere' },
      { name: 'tracing', summary: 'Tracing everywhere' },
      { name: 'billing', summary: 'Billing' },
    ]);
    sim.run(['discovery-map', 'add-batch', wu, '--file', topics]);
    sim.run(['discovery-session', 'close', wu, '-m', `discovery(${wu}): three topics`]);
    // The logging discussion parks a question for later — the roadmap item
    // first, its source the topic's log, then the move to it.
    enterEntry(sim, wu, 'discussion', 'logging');
    const at = `${wu}.discussion.logging`;
    const person = { by: 'person', who_moved_whom: 'none' };
    sim.write(`.leeway/${wu}/topics/logging/log.md`, '# Logging\n');
    sim.run(['roadmap', 'add', 'log-shipping', '--horizon', 'v2', '--summary', 'ship logs to a vendor',
      '--origin', `park:${wu}`, '--source', `${wu}/topics/logging/log.md`]);
    const shipping = sim.run(['ledger', 'ask', at], null, JSON.stringify({ ...person, text: 'Do we ship logs to a vendor?' })).id;
    sim.run(['ledger', 'move', at, '--question', shipping, '--to', 'roadmap:log-shipping'], null, JSON.stringify(person));
    const levels = sim.run(['ledger', 'ask', at], null, JSON.stringify({ ...person, text: 'Which levels do we keep?' })).id;
    sim.run(['ledger', 'decide', at, '--answers', levels], null, JSON.stringify({ ...person, text: 'Info and up.', why: 'Debug is noise.' }));
    decideTopic(sim, wu, 'logging');
    for (const topic of ['tracing', 'billing']) discussed(sim, wu, topic);
    sim.run(['topic', 'start', wu, 'specification', 'logging']);
    sim.run(['manifest', 'set', `${wu}.specification.logging`, 'sources.logging.status=incorporated', 'sources.tracing.status=incorporated']);
    sim.write(`.leeway/${wu}/specification/logging/specification.md`, '# Spec — Logging\n');
    sim.run(['commit', wu, '-m', `spec(${wu}): logging`, '--topic', 'specification/logging']);
    // A gap beyond this specification's scope parks off the spec — the gap
    // exit's roadmap home.
    sim.run(['roadmap', 'add', 'log-retention', '--horizon', 'v2', '--summary', 'keep logs for a year',
      '--origin', `park:${wu}`, '--source', `${wu}/specification/logging/specification.md`]);
    sim.run(['topic', 'complete', wu, 'specification', 'logging']);

    const res = sim.run(['workunit', 'promote', wu, 'logging', '--to', 'logging-cc', '--description', 'Logging, project-wide']);
    assert.deepStrictEqual(res.roadmap_sources_rewritten, [
      { item: 'log-shipping', from: `${wu}/topics/logging/log.md`, to: 'logging-cc/topics/logging/log.md' },
      { item: 'log-retention', from: `${wu}/specification/logging/specification.md`, to: 'logging-cc/specification/logging-cc/specification.md' },
    ]);
    const parked = sim.run(['roadmap', 'state']).items;
    assert.deepStrictEqual(parked.find((i) => i.name === 'log-retention').sources, ['logging-cc/specification/logging-cc/specification.md']);
    assert.strictEqual(sim.manifest('logging-cc').work_type, 'cross-cutting');
    assert.strictEqual(sim.manifest(wu).phases.specification.items.logging.status, 'promoted');
    assert.match(sim.render(['promote-receipt', `${wu}.specification.logging`, '--to', 'logging-cc'], { expect: 'content' }),
      /Promoted to Cross-Cutting/, 'promote receipt renders from the promoted item');

    // Promotion is terminal on the source item.
    sim.refuses(['topic', 'start', wu, 'specification', 'logging'], /promoted/);
    sim.refuses(['topic', 'complete', wu, 'specification', 'logging'], /promoted/);
    sim.refuses(['topic', 'supersede', wu, 'specification', 'logging', '--by', 'other'], /promoted|not found/);

    // The moved discussions left with it: the epic records each promoted,
    // its grouping never counts or proposes them — the one discussion left
    // is the lone one — and its dashboard reads them decided, naming the unit.
    assert.deepStrictEqual(Object.fromEntries(Object.entries(sim.manifest(wu).phases.discussion.items).map(([name, item]) => [name, [item.status, item.promoted_to]])), {
      logging: ['promoted', 'logging-cc'],
      tracing: ['promoted', 'logging-cc'],
      billing: ['completed', undefined],
    });
    sim.refuses(sendArgv(sim, wu, 'tracing', 'billing', 'to-tracing'), /^the topic "tracing" was promoted to "logging-cc" — it carries on there$/);
    // Past specification, moved elsewhere: the topics lock against cancel
    // and postpone, the sub-views naming the unit.
    sim.refuses(['topic', 'cancel', wu, 'discovery', 'tracing'],
      /the specification "logging" \(promoted to "logging-cc"\) sources its discussion — promotion is terminal/);
    sim.refuses(['topic', 'postpone', wu, 'tracing', '--horizon', 'v2'], /a topic past specification is past "not yet"/);
    const units = EPIC_GATEWAY.discover(sim.dir, wu);
    for (const topic of ['logging', 'tracing']) {
      assert.match(units.cancellable.find((u) => u.name === topic)?.locked ?? '', /\(promoted to "logging-cc"\) — promotion is terminal/);
      assert.match(units.postponable.find((u) => u.name === topic)?.locked ?? '', /\(promoted to "logging-cc"\)/);
    }
    assert.strictEqual(units.cancellable.find((u) => u.name === 'billing')?.locked, undefined);
    const grouping = specDetail(sim.dir, wu);
    assert.strictEqual(grouping.counts.discussion_count, 1);
    assert.strictEqual(grouping.scenario, 'single');
    assert.strictEqual(grouping.single?.discussion, 'billing');
    const dashboard = epicDashboard(wu, EPIC_GATEWAY.discover(sim.dir, wu));
    assert.match(dashboard, /✓ Logging\n[^\n]*\n[^\n]*↳ Decided · promoted to logging-cc/, dashboard);
    assert.match(dashboard, /✓ Tracing\n[^\n]*\n[^\n]*↳ Decided · promoted to logging-cc/, dashboard);

    // The unit records the moved discussions whole under their own names,
    // as its specification's sources, their logs moved with them.
    const cc = 'logging-cc';
    assert.deepStrictEqual(Object.fromEntries(Object.entries(sim.manifest(cc).phases.discussion.items).map(([name, item]) => [name, item.status])), {
      logging: 'completed',
      tracing: 'completed',
    });
    for (const topic of ['logging', 'tracing']) {
      assert.ok(fs.existsSync(path.join(sim.dir, `.leeway/${cc}/topics/${topic}/log.md`)), `${topic}'s log moved with it`);
    }
    assert.deepStrictEqual(sim.manifest(cc).phases.specification.items[cc].sources, {
      logging: { status: 'incorporated' },
      tracing: { status: 'incorporated' },
    });

    // Reactivated, it offers its specification for revisit and never a
    // moved discussion — a decided discussion reopens by a message.
    sim.run(['workunit', 'reactivate', cc]);
    arrive(sim, cc);
    const linear = LINEAR_GATEWAY.view(sim.dir, cc);
    assert.match(linear, /^ {2}1 {2}— {2}revisit_phase {2}logging-cc {2}→ \/leeway-specification-process cross-cutting logging-cc$/m, linear);
    assert.doesNotMatch(linear, /leeway-discussion-process/, linear);

    // A message reopens tracing and flags the unit's specification through
    // the reverse join; in flight, the discussion is the next route, by
    // name, and its entry resumes it.
    const reopened = send(sim, cc, 'tracing', cc, 'sampling');
    assert.strictEqual(reopened.reopened, true);
    assert.strictEqual(reopened.reconcile_flagged, true);
    assert.deepStrictEqual(reopened.sources_staled, [cc]);
    assert.strictEqual(sim.manifest(cc).phases.specification.items[cc].reconcile_needed, 'discussion');
    assert.match(BRIDGE.format(BRIDGE.discover(sim.dir, cc)),
      new RegExp(`^next_route: /leeway-discussion-process cross-cutting ${cc} tracing$`, 'm'));
    handoff(sim, `/leeway-discussion-process cross-cutting ${cc} tracing`);

    // Decided again, the next route is the specification's reconcile — by
    // the unit alone, its specification carrying the unit's name.
    assert.deepStrictEqual(discussed(sim, cc, 'tracing', { question: 'Which spans do we sample?', answer: 'One in ten.' }).next,
      { kind: 'handoff', skill: 'leeway-specification-process', args: ['cross-cutting', cc] });
    const dump = BRIDGE.format(BRIDGE.discover(sim.dir, cc));
    assert.match(dump, new RegExp(`^next_route: /leeway-specification-process cross-cutting ${cc}$`, 'm'), dump);
    assert.match(dump, /^revisitable_phases: \(none\)$/m, dump);
    assert.strictEqual(LIB.detail.activeWorkUnit(sim.dir, cc)?.unit.phase_label, 'specification (input moved — reconcile)');
    bridgeTo(sim, cc, 'specification');

    // The specification's entry reconciles: reopened, its flag cleared, and
    // the source gate holding the re-conclusion until the stale row is
    // re-incorporated; then the pipeline's end completes the unit.
    handoffEntry(sim, cc, 'specification', cc);
    sim.render(['entry-gate', `${cc}.specification.${cc}`], { expect: 'empty' });
    sim.run(['topic', 'reopen', cc, 'specification', cc]);
    sim.run(['manifest', 'delete', `${cc}.specification.${cc}`, 'reconcile_needed']);
    sim.refuses(['topic', 'complete', cc, 'specification', cc], /unresolved source rows \(tracing\)/);
    sim.run(['manifest', 'set', `${cc}.specification.${cc}`, 'sources.tracing.status', 'incorporated']);
    sim.run(['topic', 'complete', cc, 'specification', cc]);
    assert.match(BRIDGE.format(BRIDGE.discover(sim.dir, cc)), /^next_phase: done$/m);
    sim.run(['workunit', 'complete', cc, '-m', `workflow(${cc}): complete cross-cutting pipeline`]);
    assert.strictEqual(sim.manifest(cc).status, 'completed');
  });
});
