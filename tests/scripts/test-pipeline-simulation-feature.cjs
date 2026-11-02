'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's feature scenarios: the whole pipeline from
// discovery to a completed review, its spec entered at the unit, landed,
// reviewed and cut into phases, and ready to build's pick beginning the
// build; the start menu's working set of inbox ideas seeding discovery; a
// discussion entered through `enter`, begun and then resumed by a later
// conversation.
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
const { KNOWLEDGE_DIR } = require(path.join(ROOT, 'skills/leeway-engine/scripts/kernel/knowledge/files.cjs'));
const BRIDGE = require(path.join(ROOT, 'skills/leeway-bridge/scripts/gateway.cjs'));
const { statePath } = require(path.join(ROOT, 'skills/leeway-engine/scripts/kernel/state-root.cjs'));
const {
  Sim, sessionLog, enterEntry, carryOn, handoff, answerGate, decideTopic, startKeys, startNew, shapedInTheProduct, briefDraft, startThisWork, workTheSet, walkDeliveryPhases, specToBuild,
} = require('./pipeline-world.cjs');

const { shellWords } = require('./pipeline-oracle.cjs');

describe('pipeline simulation: feature', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('feature: discovery → discussion → spec → plan → implement → review → complete', () => {
    const wu = 'pay';
    // The start menu's new-feature pick hands the work to discovery, which
    // shapes it in the product's conversation; start this work's yes creates
    // the unit, its brief its one topic's, and hands it to its discussion.
    startNew(sim, 'feature');
    const shaped = shapedInTheProduct(sim, 'payments');
    const started = startThisWork(sim, {
      type: 'feature', name: wu, description: 'Payments feature', reason: 'One topic, decided in one discussion.',
      shaped_by: [shaped], brief: briefDraft(sim, wu, wu),
    });
    assert.deepStrictEqual(started.next, { kind: 'handoff', skill: 'leeway-discussion-process', args: ['feature', wu] });
    handoff(sim, `/leeway-discussion-process feature ${wu}`);

    // First phase: discussion (topic = work unit for single-topic types),
    // entered through `enter`, which starts it; the conversation reads the
    // product record before it opens.
    enterEntry(sim, wu, 'discussion', wu);
    sim.run(['ledger', 'product', wu, wu]);
    // The person answers their question, and the topic closes at the decided
    // screen: its yes lands Claude's product-record line, completes the topic
    // and hands it to the specification.
    const at = `${wu}.discussion.${wu}`;
    const person = { by: 'person', who_moved_whom: 'none' };
    const asked = sim.run(['ledger', 'ask', at], null, JSON.stringify({ ...person, text: 'Which card networks does checkout take?' })).id;
    const card = sim.run(['ledger', 'decide', at, '--answers', asked], null, JSON.stringify({ ...person, text: 'Visa and Mastercard.', why: 'Our acquirer takes those two.' })).id;
    sim.write(`.leeway/${wu}/topics/${wu}/log.md`, `# ${wu}\n\nVisa and Mastercard; refunds left to another day.\n`);
    // The person puts Apple Pay off for later, naming its horizon: it goes on
    // the roadmap at once. The closing pass then finds work no topic owns: a
    // feature has no map, so that candidate parks on the roadmap at the yes,
    // on the horizon the person picks before the screen.
    sim.run(['roadmap', 'add', 'apple-pay', '--horizon', 'later', '--summary', 'Take Apple Pay.', '--origin', `park:${wu}`, '--source', `${wu}/topics/${wu}`]);
    assert.match(sim.render(['horizon-pick', '--park', 'refunds'], { expect: 'content' }), /^Putting "Refunds" on the roadmap\.$/m);
    assert.deepStrictEqual(answerGate(sim, 'horizon pick', '--pick', '1').next, { kind: 'continue' });
    const decided = decideTopic(sim, wu, wu, {
      lines: [{ text: 'Payments take Visa and Mastercard only.', why: 'The acquirer takes those two.', widens: card }],
      candidates: [{ name: 'refunds', reason: 'Nothing decides how a refund reaches the card.', horizon: 'later' }],
    });
    assert.deepStrictEqual([decided.parked, decided.next], [[{ name: 'refunds', horizon: 'later' }], { kind: 'handoff', skill: 'leeway-specification-process', args: ['feature', wu] }]);
    assert.strictEqual(BRIDGE.discover(sim.dir, wu).next_phase, 'specification');
    // The completion indexed into a store, which every commit's audit in
    // `run` holds untracked from here on.
    assert.ok(fs.existsSync(statePath(sim.dir, KNOWLEDGE_DIR, 'store.bin')), 'the completion built the store');
    assert.match(sim.render(['knowledge-ready'], { expect: 'content' }), /^Knowledge base ready — keyword-only\.$/m);
    // The engine's own door reads back what the close indexed in process: the
    // records — the topic's, and the unit's own, which holds the line.
    assert.deepStrictEqual(sim.engine(['knowledge', 'check']), { stdout: 'ready\n', stderr: '', code: 0 });
    assert.match(sim.engine(['knowledge', 'status']).stdout, /^By phase:\n {2}record: 3\n\n/m);
    // A hop short of review carries no skip row, and the decided discussion
    // behind it is no revisit — it reopens by a message — so the hop asks
    // nothing.
    sim.render(['next-phase-gate', wu, '--prev', 'discussion', '--next', 'specification'], { expect: 'empty' });
    // The spec, entered at the unit, lands citing what was decided, is
    // reviewed and cut into phases; ready to build's pick begins the build.
    assert.deepStrictEqual(specToBuild(sim, wu, [wu]).next, { kind: 'continue' });

    walkDeliveryPhases(sim, wu, wu);

    // The bridge's one stop before review: proceed, complete without
    // review, or revisit — the delivery phases behind it are completed, so
    // all three.
    const gate = sim.render(['next-phase-gate', wu, '--prev', 'implementation', '--next', 'review'], { expect: 'content' });
    assert.match(gate, /\*\*`y\/yes`\*\* +→ Proceed to review/);
    assert.match(gate, /\*\*`d\/done`\*\* +→ Complete without review/);
    assert.match(gate, /\*\*`r\/revisit`\*\* → Revisit an earlier phase/);
    const done = sim.run(['workunit', 'complete', wu, '-m', `workflow(${wu}): pipeline complete`]);
    assert.strictEqual(done.status, 'completed');
    assert.strictEqual(sim.manifest(wu).status, 'completed');
    assert.match(sim.render(['workunit-receipt', wu, '--verb', 'complete', '--pipeline'], { expect: 'content' }),
      /Feature Completed/, 'pipeline completion renders the banner receipt');
  });

  it('start: a working set of inbox ideas hands discovery its seeds, which start this work lands', () => {
    const ideas = [
      sim.write('.leeway/.inbox/ideas/2026-01-01--saved-search-filters.md', '# Saved Search Filters\n'),
      sim.write('.leeway/.inbox/ideas/2026-01-01--filter-default-view.md', '# Filter Default View\n'),
    ];
    assert.ok(startKeys(sim).some((k) => k.action === 'view_inbox'), 'the start menu offers the inbox');
    // Ideas carry no work type, so discovery decides it.
    const seeds = ideas.map((rel) => path.join(sim.dir, rel));
    const route = `/leeway-discovery start none "${seeds.join(',')}"`;
    assert.strictEqual(workTheSet(sim, ideas).text, `Invoke \`${route}\`.`);
    const wu = 'saved-filters';
    const started = startThisWork(sim, {
      type: 'feature', name: wu, description: 'Saved search filters', reason: 'One topic, decided in one discussion.',
      shaped_by: [shapedInTheProduct(sim, 'filters')], seeds, brief: briefDraft(sim, wu, wu),
    });
    assert.deepStrictEqual(started.seeds.map((/** @type {{source: string}} */ seed) => seed.source), ['inbox:idea', 'inbox:idea']);
    // The yes moved the seeds out of the inbox, and the handoff checks each
    // is still there — so it can only come first.
    sim.refuses(['handoff', ...shellWords(route)], /inbox file not found/);
  });

  it('feature: a discussion entered through `enter` — the first entry starts it on what discovery left, a later conversation resumes it on its record and its log', () => {
    const wu = 'filters';
    const keys = () => [...sim.sections.matchAll(/^([a-z ]+): /gm)].map((m) => m[1]);
    const header = () => /^log header: (.*)$/m.exec(sim.sections)?.[1];
    const log = `.leeway/${wu}/topics/${wu}/log.md`;
    startNew(sim, 'feature');
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Saved filters', '--session-log-file', sessionLog(sim, wu)]);
    handoff(sim, `/leeway-discussion-process feature ${wu}`);
    const first = enterEntry(sim, wu, 'discussion', wu);
    assert.deepStrictEqual([first.started, typeof first.committed], [true, 'string'], 'the first entry starts the topic and commits the start');
    assert.ok(!fs.existsSync(path.join(sim.dir, log)), 'nothing is written ahead of the opening');
    assert.deepStrictEqual(keys(), ['discovery log', 'product', 'log', 'log header']);
    sim.write(log, `${header()}\n\nWhere it stands.\n`);
    assert.doesNotMatch(carryOn(sim).text, /has not written to the log yet/, 'the conversation that wrote the log owes no header');

    const again = enterEntry(sim, wu, 'discussion', wu);
    assert.deepStrictEqual([again.started, again.committed], [false, undefined], 'a later entry resumes, starting nothing');
    assert.deepStrictEqual(keys(), ['discovery log', 'product', 'record', 'map', 'affected', 'log', 'log header'], 'a new conversation owes its own header');
    assert.match(carryOn(sim).text, /has not written to the log yet/);
  });
});
