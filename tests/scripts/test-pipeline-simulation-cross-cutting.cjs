'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's cross-cutting scenarios: the discussion to
// specification hop offering proceed or revisit, never the skip; a
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
const path = require('path');
const ROOT = path.join(__dirname, '../..');
const EPIC_GATEWAY = require(path.join(ROOT, 'skills/leeway-continue-epic/scripts/gateway.cjs'));
const LINEAR_GATEWAY = require(path.join(ROOT, 'skills/leeway-continue-linear/scripts/gateway.cjs'));
const BRIDGE = require(path.join(ROOT, 'skills/leeway-bridge/scripts/gateway.cjs'));
const LIB = require(path.join(ROOT, 'skills/leeway-engine/scripts/lib.cjs'));
const { epicDashboard } = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/projections/epic.cjs'));
const {
  Sim, sessionLog, arrive, handoffEntry, handoff, bridgeTo, linearPick, startNew,
} = require('./pipeline-world.cjs');

const { specDetail } = require('./pipeline-oracle.cjs');

describe('pipeline simulation: cross-cutting', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('cross-cutting: the discussion→specification hop offers proceed or revisit, never the skip', () => {
    const wu = 'error-shape';
    startNew(sim, 'cross-cutting');
    sim.run(['workunit', 'create', wu, 'cross-cutting', '--description', 'One error envelope', '--session-log-file', sessionLog(sim, wu)]);
    // Cross-cutting takes the same first-phase choice as a feature; the
    // fixed-first-phase types never reach the gate at all.
    const read = sim.write(`.leeway/.cache/${wu}/discovery/first-phase.json`,
      { read: 'Discussion is the usual spine here — research is optional.' });
    assert.match(sim.render(['first-phase-gate', wu, '--file', read], { expect: 'content' }),
      /\*\*`r\/research`\*\* +→ Explore feasibility and options first, no/);
    handoff(sim, `/leeway-discussion-process cross-cutting ${wu}`);
    handoffEntry(sim, wu, 'discussion', wu);
    sim.render(['entry-gate', `${wu}.discussion.${wu}`], { expect: 'empty' });
    sim.run(['topic', 'start', wu, 'discussion', wu]);
    sim.write(`.leeway/${wu}/discussion/${wu}.md`, `# Discussion — ${wu}\n`);
    sim.run(['commit', wu, '-m', `discussion(${wu}): capture`, '--topic', `discussion/${wu}`]);
    sim.run(['topic', 'complete', wu, 'discussion', wu]);
    // The pipeline ends at specification, so review is never this type's
    // next phase — the gate refuses the hop rather than offering a skip.
    const hop = sim.render(['next-phase-gate', wu, '--prev', 'discussion', '--next', 'specification'], { expect: 'content' });
    assert.match(hop, /\*\*`y\/yes`\*\* +→ Proceed to specification/);
    assert.match(hop, /\*\*`r\/revisit`\*\* → Revisit an earlier phase/);
    assert.ok(!hop.includes('d/done'), hop);
    sim.refuses(['render', 'next-phase-gate', wu, '--prev', 'discussion', '--next', 'review'], /unknown --next "review" for a cross-cutting/);
    // A session that stops here resumes from the cross-cutting continue menu,
    // which hands off where the bridge does.
    assert.strictEqual(linearPick(sim, wu, 'continue').line, `→ Specification · ${wu}`);
    bridgeTo(sim, wu, 'specification');
  });

  it('cross-cutting: a specification still being written stops a peer\'s fresh plan; a completed one is referenced', async () => {
    const cc = 'error-envelope';
    sim.run(['workunit', 'create', cc, 'cross-cutting', '--description', 'One error envelope', '--session-log-file', sessionLog(sim, cc)]);
    sim.run(['topic', 'start', cc, 'discussion', cc]);
    sim.write(`.leeway/${cc}/discussion/${cc}.md`, `# Discussion — ${cc}\n`);
    sim.run(['topic', 'complete', cc, 'discussion', cc]);
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
    // specifications finds it, and nothing of the unit's discussion.
    const surfaced = await sim.engineAsync(['knowledge', 'query', 'one error envelope for every failure',
      '--work-type', 'cross-cutting', '--phase', 'specification', '--limit', '10']);
    assert.strictEqual(surfaced.code, 0, surfaced.stderr);
    assert.match(surfaced.stdout, /^\[specification \| error-envelope\/error-envelope \| high \| \d{4}-\d{2}-\d{2}\]$/m);
    assert.doesNotMatch(surfaced.stdout, /^\[discussion \|/m);
    sim.refuses(['render', 'cross-cutting-gate', '--file', units],
      /"error-envelope" is not a cross-cutting work unit with a specification in progress/);
    assert.match(sim.render(['cross-cutting-references', '--file', refs], { expect: 'content' }),
      /• error-envelope: Every error leaves in one envelope\./);
  });

  it('spec promotion: a cross-cutting concern leaves the epic with its discussions, roadmap sources follow the files, and the unit routes to each moved discussion by name', () => {
    const wu = 'host';
    sim.run(['workunit', 'create', wu, 'epic', '--description', 'Hosts a cc message', '--session-log-file', sessionLog(sim, wu)]);
    const topics = sim.write(`.leeway/.cache/${wu}/discovery/topics.json`, [
      { name: 'logging', routing: 'discussion', summary: 'Logging everywhere' },
      { name: 'tracing', routing: 'discussion', summary: 'Tracing everywhere' },
      { name: 'billing', routing: 'discussion', summary: 'Billing' },
    ]);
    sim.run(['discovery-map', 'add-batch', wu, '--file', topics]);
    sim.run(['discovery-session', 'close', wu, '-m', `discovery(${wu}): three topics`]);
    for (const topic of ['logging', 'tracing', 'billing']) {
      sim.run(['topic', 'start', wu, 'discussion', topic]);
      sim.write(`.leeway/${wu}/discussion/${topic}.md`, `# Discussion — ${topic}\n`);
    }
    // The discussion parks a tangent off its own record — the off-topic
    // valve's call, its source the discussion file.
    sim.run(['roadmap', 'add', 'log-shipping', '--horizon', 'v2', '--summary', 'ship logs to a vendor',
      '--origin', `park:${wu}`, '--source', `${wu}/discussion/logging.md`]);
    sim.run(['discussion-map', 'add', wu, 'tracing', 'sampling']);
    sim.run(['discussion-map', 'set', wu, 'tracing', 'sampling', 'decided']);
    for (const topic of ['logging', 'tracing', 'billing']) sim.run(['topic', 'complete', wu, 'discussion', topic]);
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
      { item: 'log-shipping', from: `${wu}/discussion/logging.md`, to: 'logging-cc/discussion/logging.md' },
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
    const sampling = { sampling: { status: 'decided', parent: null } };
    assert.deepStrictEqual(sim.manifest(wu).phases.discussion.items, {
      logging: { status: 'promoted', promoted_to: 'logging-cc' },
      tracing: { status: 'promoted', subtopics: sampling, promoted_to: 'logging-cc' },
      billing: { status: 'completed' },
    });
    sim.refuses(['topic', 'reopen', wu, 'discussion', 'tracing'], /promoted \(to "logging-cc"\)/);
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

    // The unit records the moved discussions whole under their own names —
    // the Discussion Map a revisit reopens with them — as its
    // specification's sources.
    const cc = 'logging-cc';
    assert.deepStrictEqual(sim.manifest(cc).phases.discussion.items, {
      logging: { status: 'completed' },
      tracing: { status: 'completed', subtopics: sampling },
    });
    assert.deepStrictEqual(sim.manifest(cc).phases.specification.items[cc].sources, {
      logging: { status: 'incorporated' },
      tracing: { status: 'incorporated' },
    });

    // Reactivated, it offers each moved discussion for revisit by name, and
    // the route the pick hands off names the one picked.
    sim.run(['workunit', 'reactivate', cc]);
    arrive(sim, cc);
    const linear = LINEAR_GATEWAY.view(sim.dir, cc);
    assert.match(linear, /^ {2}1 {2}— {2}revisit_phase {2}logging {2}→ \/leeway-discussion-process cross-cutting logging-cc logging$/m, linear);
    assert.match(linear, /^ {2}2 {2}— {2}revisit_phase {2}tracing {2}→ \/leeway-discussion-process cross-cutting logging-cc tracing$/m, linear);
    assert.match(linear, /^ {2}3 {2}— {2}revisit_phase {2}logging-cc {2}→ \/leeway-specification-process cross-cutting logging-cc$/m, linear);
    assert.match(sim.render(['revisit-phases', cc], { expect: 'content' }), /\*\*`2`\*\* +→ Discussion "Tracing" — \*completed\*/);
    handoff(sim, `/leeway-discussion-process cross-cutting ${cc} tracing`);

    // The reopen flags the unit's specification through the reverse join;
    // in flight, the discussion is the next route, by name.
    handoffEntry(sim, cc, 'discussion', 'tracing');
    const reopened = sim.run(['topic', 'reopen', cc, 'discussion', 'tracing']);
    assert.deepStrictEqual(reopened.reconcile_flagged, [{ phase: 'specification', topic: cc }]);
    assert.deepStrictEqual(reopened.sources_staled, [cc]);
    assert.match(BRIDGE.format(BRIDGE.discover(sim.dir, cc)),
      new RegExp(`^next_route: /leeway-discussion-process cross-cutting ${cc} tracing$`, 'm'));

    // Concluded again, the next route is the specification's reconcile — by
    // the unit alone, its specification carrying the unit's name.
    sim.run(['topic', 'complete', cc, 'discussion', 'tracing']);
    const dump = BRIDGE.format(BRIDGE.discover(sim.dir, cc));
    assert.match(dump, new RegExp(`^next_route: /leeway-specification-process cross-cutting ${cc}$`, 'm'), dump);
    assert.match(dump, /^revisitable_phases: discussion\/logging, discussion\/tracing$/m, dump);
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
